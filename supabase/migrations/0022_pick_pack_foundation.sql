-- Barcode pick-and-pack, phase 1: foundation.
-- See "Barcode Pick-and-Pack Developer Brief" (Oct 13 2026).
--
--  * Order statuses become Created -> Reserved -> Picking -> Packed ->
--    Dispatched -> Delivered, plus Returned, Damaged and Cancelled.
--  * Each product row is one SKU and gets three stock numbers: on_hand
--    (physically in the warehouse), allocated (promised to open orders) and
--    available = on_hand - allocated. The existing `stock` column now always
--    holds available, so every screen that reads it keeps working.
--  * Orders only reserve stock. A trigger on orders applies every stock
--    effect (reserve on create/payment, release on cancel/delete, on-hand
--    drops at dispatch, comes back on return), so app code never edits stock
--    for orders directly.
--  * Every stock change is written to stock_movements.
--  * SKU variants (variant label + group), Code 128 barcodes, bins.
--
-- Run without a single wrapping transaction: new enum values can't be used
-- in the transaction that adds them, hence the explicit COMMIT below.

-- ---------------------------------------------------------------------------
-- 1. Statuses
-- ---------------------------------------------------------------------------
begin;
alter type order_status rename value 'Packaged' to 'Reserved';
alter type order_status rename value 'Shipped' to 'Dispatched';
alter type order_status add value if not exists 'Created' before 'Reserved';
alter type order_status add value if not exists 'Picking' after 'Reserved';
alter type order_status add value if not exists 'Packed' after 'Picking';
alter type order_status add value if not exists 'Cancelled' after 'Damaged';
commit;

begin;

-- Unpaid storefront checkouts never took stock under the old model; they're
-- just Created until Paystack confirms them.
update orders set status = 'Created'
where channel = 'storefront' and payment_status <> 'paid' and status = 'Reserved';

alter table orders alter column status set default 'Created';

-- ---------------------------------------------------------------------------
-- 2. Merchant codes (prefix that makes SKU barcodes unique across merchants
--    sharing one warehouse)
-- ---------------------------------------------------------------------------
alter table partners add column if not exists code text;

create or replace function unique_partner_code(base text)
returns text language plpgsql as $$
declare
  stem text := left(upper(regexp_replace(coalesce(base, ''), '[^A-Za-z0-9]', '', 'g')), 4);
  candidate text;
  n int := 1;
begin
  if length(stem) < 2 then stem := 'M' || coalesce(nullif(stem, ''), 'X'); end if;
  candidate := stem;
  while exists (select 1 from partners where code = candidate) loop
    n := n + 1;
    candidate := stem || n::text;
  end loop;
  return candidate;
end $$;

do $$
declare r record;
begin
  for r in select id, business_name from partners where code is null order by created_at loop
    update partners set code = unique_partner_code(r.business_name) where id = r.id;
  end loop;
end $$;

alter table partners alter column code set not null;
do $$ begin
  alter table partners add constraint partners_code_key unique (code);
exception when duplicate_object or duplicate_table then null; end $$;

create or replace function set_partner_code() returns trigger
language plpgsql as $$
begin
  if new.code is null then new.code := unique_partner_code(new.business_name); end if;
  return new;
end $$;

drop trigger if exists partners_set_code on partners;
create trigger partners_set_code before insert on partners
  for each row execute function set_partner_code();

-- ---------------------------------------------------------------------------
-- 3. SKU fields and the three stock numbers
-- ---------------------------------------------------------------------------
alter table products add column if not exists on_hand integer not null default 0;
alter table products add column if not exists allocated integer not null default 0;
alter table products add column if not exists variant text
  check (variant is null or length(variant) <= 60);
alter table products add column if not exists group_id uuid;
alter table products add column if not exists barcode text;
alter table products add column if not exists retail_barcode text
  check (retail_barcode is null or retail_barcode ~ '^[0-9]{8,14}$');

create index if not exists products_group_idx on products (group_id);
create index if not exists products_retail_barcode_idx on products (retail_barcode);

-- Backfill. Under the old model `stock` was already net of every open
-- order, so lines that are now Reserved were still physically here:
-- on_hand = stock + reserved, allocated = reserved, available = stock.
update products p
set allocated = r.qty,
    on_hand = p.stock + r.qty
from (
  select pr.id, coalesce(sum(o.quantity) filter (where o.status = 'Reserved'), 0)::int as qty
  from products pr
  left join orders o on o.product_id = pr.id
  group by pr.id
) r
where r.id = p.id;

update products p
set barcode = pa.code || '-' || upper(regexp_replace(p.sku, '\s+', '-', 'g'))
from partners pa
where pa.id = p.partner_id and p.barcode is null and p.sku is not null and p.sku <> '';

do $$ begin
  alter table products add constraint products_barcode_key unique (barcode);
exception when duplicate_object or duplicate_table then null; end $$;

-- ---------------------------------------------------------------------------
-- 4. Movement log
-- ---------------------------------------------------------------------------
create table if not exists stock_movements (
  id               bigint generated always as identity primary key,
  product_id       uuid not null references products (id) on delete cascade,
  partner_id       uuid not null references partners (id) on delete cascade,
  movement         text not null check (movement in
                     ('receive', 'putaway', 'pick', 'dispatch', 'return',
                      'adjustment', 'reserve', 'release')),
  on_hand_change   integer not null default 0,
  allocated_change integer not null default 0,
  on_hand_after    integer not null,
  allocated_after  integer not null,
  order_ref        text,
  from_bin         uuid,
  to_bin           uuid,
  note             text,
  actor_id         uuid,
  created_at       timestamptz not null default now()
);
create index if not exists stock_movements_product_idx on stock_movements (product_id, created_at desc);
create index if not exists stock_movements_partner_idx on stock_movements (partner_id, created_at desc);

alter table stock_movements enable row level security;
drop policy if exists "stock_movements read own" on stock_movements;
create policy "stock_movements read own" on stock_movements
  for select using (partner_id = auth.uid() or is_fulfillment_center() or is_admin());
-- No insert/update policies: only the security-definer triggers write here.

-- ---------------------------------------------------------------------------
-- 5. Products trigger: keep stock = available, protect allocated/barcode,
--    log manual on-hand changes
-- ---------------------------------------------------------------------------
create or replace function products_stock_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  from_orders boolean := coalesce(current_setting('bnp.stock_source', true), '') = 'order';
  pcode text;
begin
  if tg_op = 'INSERT' then
    -- Older writers only set `stock`; treat it as the physical count.
    if new.on_hand = 0 and coalesce(new.stock, 0) <> 0 then new.on_hand := new.stock; end if;
    new.allocated := 0;
  else
    -- Only the orders trigger may change allocated.
    if not from_orders then new.allocated := old.allocated; end if;
    -- A direct write to `stock` (older code paths) adjusts on_hand.
    if new.stock is distinct from old.stock and new.on_hand = old.on_hand then
      new.on_hand := old.on_hand + (new.stock - old.stock);
    end if;
    if new.on_hand <> old.on_hand then new.last_moved_at := now(); end if;
  end if;

  new.stock := new.on_hand - new.allocated;

  if new.sku is null or new.sku = '' then
    new.sku := 'SKU-' || upper(substr(md5(random()::text), 1, 6));
  end if;
  if tg_op = 'INSERT' or new.sku is distinct from old.sku or new.barcode is null
     or new.barcode is distinct from old.barcode then
    select code into pcode from partners where id = new.partner_id;
    new.barcode := pcode || '-' || upper(regexp_replace(new.sku, '\s+', '-', 'g'));
  end if;
  return new;
end $$;

drop trigger if exists products_stock_sync on products;
create trigger products_stock_sync before insert or update on products
  for each row execute function products_stock_sync();

create or replace function products_log_adjustment() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  change int;
begin
  if coalesce(current_setting('bnp.stock_source', true), '') = 'order' then return null; end if;
  change := new.on_hand - (case when tg_op = 'INSERT' then 0 else old.on_hand end);
  if change = 0 then return null; end if;
  insert into stock_movements
    (product_id, partner_id, movement, on_hand_change, on_hand_after, allocated_after, note, actor_id)
  values
    (new.id, new.partner_id, case when tg_op = 'INSERT' then 'receive' else 'adjustment' end,
     change, new.on_hand, new.allocated,
     case when tg_op = 'INSERT' then 'Opening stock' else 'Manual stock change' end, auth.uid());
  return null;
end $$;

drop trigger if exists products_log_adjustment on products;
create trigger products_log_adjustment after insert or update on products
  for each row execute function products_log_adjustment();

-- ---------------------------------------------------------------------------
-- 6. Orders trigger: every order stock effect in one place
-- ---------------------------------------------------------------------------
-- What a line in a given status does to stock, relative to it not existing.
create or replace function order_stock_effect(p_status order_status, p_qty int,
                                              out alloc int, out onhand int)
language sql immutable as $$
  select
    case when p_status in ('Reserved', 'Picking', 'Packed') then p_qty else 0 end,
    case when p_status in ('Dispatched', 'Delivered', 'Damaged') then -p_qty else 0 end;
$$;

create or replace function move_order_stock(p_product uuid, p_alloc int, p_onhand int,
                                            p_order_ref text)
returns void language plpgsql security definer set search_path = public as $$
declare
  rec record;
begin
  if p_product is null or (p_alloc = 0 and p_onhand = 0) then return; end if;
  perform set_config('bnp.stock_source', 'order', true);
  update products
    set allocated = allocated + p_alloc, on_hand = on_hand + p_onhand
    where id = p_product
    returning id, partner_id, on_hand, allocated into rec;
  perform set_config('bnp.stock_source', '', true);
  if rec.id is null then return; end if;
  insert into stock_movements
    (product_id, partner_id, movement, on_hand_change, allocated_change,
     on_hand_after, allocated_after, order_ref, actor_id)
  values
    (rec.id, rec.partner_id,
     case when p_onhand < 0 then 'dispatch' when p_onhand > 0 then 'return'
          when p_alloc > 0 then 'reserve' else 'release' end,
     p_onhand, p_alloc, rec.on_hand, rec.allocated, p_order_ref, auth.uid());
end $$;

revoke all on function move_order_stock(uuid, int, int, text) from public, anon, authenticated;

create or replace function orders_apply_stock() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o record;
  n record;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select * into o from order_stock_effect(old.status, old.quantity);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    select * into n from order_stock_effect(new.status, new.quantity);
  end if;

  if tg_op = 'UPDATE' and old.product_id is not distinct from new.product_id then
    perform move_order_stock(new.product_id, n.alloc - o.alloc, n.onhand - o.onhand, new.order_ref);
  elsif tg_op = 'DELETE' then
    -- Deleting an order only releases what it still holds. Goods that were
    -- dispatched really left the building, so on-hand is not restored.
    perform move_order_stock(old.product_id, -o.alloc, 0, old.order_ref);
  else
    if tg_op = 'UPDATE' then
      perform move_order_stock(old.product_id, -o.alloc, -o.onhand, old.order_ref);
    end if;
    if tg_op in ('INSERT', 'UPDATE') then
      perform move_order_stock(new.product_id, n.alloc, n.onhand, new.order_ref);
    end if;
  end if;
  return null;
end $$;

drop trigger if exists orders_apply_stock on orders;
create trigger orders_apply_stock
  after insert or delete or update of status, quantity, product_id on orders
  for each row execute function orders_apply_stock();

-- The old payment-time deduction is replaced by Created -> Reserved.
drop function if exists decrement_stock(uuid, integer);

-- ---------------------------------------------------------------------------
-- 7. Bins
-- ---------------------------------------------------------------------------
create table if not exists bins (
  id          uuid primary key default gen_random_uuid(),
  location    warehouse_location not null,
  code        text not null check (code ~ '^[A-Z0-9][A-Z0-9-]{0,19}$'),
  barcode     text not null unique,
  active      boolean not null default true,
  created_by  uuid references partners (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (location, code)
);

create or replace function bins_set_barcode() returns trigger
language plpgsql as $$
begin
  new.code := upper(new.code);
  new.barcode := 'BIN-' ||
    case new.location when 'Abuja' then 'ABJ' when 'Lagos' then 'LOS' else 'USA' end ||
    '-' || new.code;
  return new;
end $$;

drop trigger if exists bins_set_barcode on bins;
create trigger bins_set_barcode before insert or update of code, location on bins
  for each row execute function bins_set_barcode();

-- One SKU per bin; one SKU may use several bins. Filled by putaway (phase 3).
create table if not exists bin_stock (
  bin_id      uuid primary key references bins (id) on delete restrict,
  product_id  uuid not null references products (id) on delete cascade,
  quantity    integer not null default 0 check (quantity >= 0),
  updated_at  timestamptz not null default now()
);
create index if not exists bin_stock_product_idx on bin_stock (product_id);

alter table bins enable row level security;
alter table bin_stock enable row level security;

drop policy if exists "bins warehouse manage" on bins;
create policy "bins warehouse manage" on bins
  for all using (is_fulfillment_center() or is_admin())
  with check (is_fulfillment_center() or is_admin());

drop policy if exists "bin_stock warehouse read" on bin_stock;
create policy "bin_stock warehouse read" on bin_stock
  for select using (is_fulfillment_center() or is_admin());

-- ---------------------------------------------------------------------------
-- 8. Storefront view: variants (appended; CREATE OR REPLACE can't reorder)
-- ---------------------------------------------------------------------------
create or replace view storefront_products as
  select p.id, p.partner_id, p.name, p.sku, p.category, p.sale_price,
         p.stock, p.location, p.shipping_fee, p.pickup_enabled, p.image_url,
         p.vat, p.description, p.variant, p.group_id
  from products p
  join partners pa on pa.id = p.partner_id
  where p.published = true and pa.status = 'active';

commit;
