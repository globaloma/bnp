-- Barcode pick-and-pack, phase 3: receiving and putaway.
-- See "Barcode Pick-and-Pack Developer Brief" (Oct 13 2026).
--
--  * Merchants announce inbound deliveries (what they're sending, per SKU).
--  * Warehouse staff receive them by scanning: each scan adds to on-hand and
--    is checked against what was announced, so gaps show up.
--  * Putaway: scan a bin, then items, to place received stock into bins.
--  * Only scans (and admins) change on-hand. Merchants no longer type stock
--    numbers; they announce deliveries instead.
--
-- Every scan goes through a security-definer function below, so the rules
-- live in one place and the client can't write stock or bin rows directly.

begin;

-- ---------------------------------------------------------------------------
-- 1. Inbound deliveries
-- ---------------------------------------------------------------------------
do $$ begin
  create type inbound_status as enum ('announced', 'receiving', 'received', 'cancelled');
exception when duplicate_object then null; end $$;

create sequence if not exists inbound_ref_seq;

create table if not exists inbound_deliveries (
  id           uuid primary key default gen_random_uuid(),
  ref          text not null unique
               default 'IN-' || lpad(nextval('inbound_ref_seq')::text, 5, '0'),
  partner_id   uuid not null references partners (id) on delete cascade,
  location     warehouse_location not null,
  status       inbound_status not null default 'announced',
  expected_on  date,
  note         text check (note is null or length(note) <= 1000),
  -- False when the warehouse logged stock that arrived without notice.
  announced    boolean not null default true,
  created_by   uuid,
  started_at   timestamptz,
  received_at  timestamptz,
  received_by  uuid,
  created_at   timestamptz not null default now()
);
create index if not exists inbound_deliveries_partner_idx on inbound_deliveries (partner_id, created_at desc);
create index if not exists inbound_deliveries_status_idx on inbound_deliveries (status, location);

create table if not exists inbound_delivery_lines (
  id            uuid primary key default gen_random_uuid(),
  delivery_id   uuid not null references inbound_deliveries (id) on delete cascade,
  product_id    uuid not null references products (id) on delete cascade,
  expected_qty  integer not null default 0 check (expected_qty >= 0),
  received_qty  integer not null default 0 check (received_qty >= 0),
  updated_at    timestamptz not null default now(),
  unique (delivery_id, product_id)
);
create index if not exists inbound_delivery_lines_product_idx on inbound_delivery_lines (product_id);

alter table inbound_deliveries enable row level security;
alter table inbound_delivery_lines enable row level security;

drop policy if exists "inbound read" on inbound_deliveries;
create policy "inbound read" on inbound_deliveries
  for select using (partner_id = auth.uid() or is_fulfillment_center() or is_admin());

drop policy if exists "inbound lines read" on inbound_delivery_lines;
create policy "inbound lines read" on inbound_delivery_lines
  for select using (exists (
    select 1 from inbound_deliveries d
    where d.id = delivery_id
      and (d.partner_id = auth.uid() or is_fulfillment_center() or is_admin())
  ));
-- No write policies: the functions below are the only writers.

-- ---------------------------------------------------------------------------
-- 2. Only scans (and admins) change on-hand
-- ---------------------------------------------------------------------------
-- bnp.stock_source is set to 'order' by the orders trigger (0022) and to
-- 'scan' by the scan functions here. Anything else is a manual write.
create or replace function products_stock_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  source text := coalesce(current_setting('bnp.stock_source', true), '');
  from_orders boolean := source = 'order';
  trusted boolean := source in ('order', 'scan') or is_admin();
  pcode text;
begin
  if tg_op = 'INSERT' then
    -- Older writers only set `stock`; treat it as the physical count.
    if new.on_hand = 0 and coalesce(new.stock, 0) <> 0 then new.on_hand := new.stock; end if;
    -- New products start empty; stock arrives through receiving.
    if not trusted then new.on_hand := 0; end if;
    new.allocated := 0;
  else
    -- Only the orders trigger may change allocated.
    if not from_orders then new.allocated := old.allocated; end if;
    -- A direct write to `stock` (older code paths) adjusts on_hand.
    if new.stock is distinct from old.stock and new.on_hand = old.on_hand then
      new.on_hand := old.on_hand + (new.stock - old.stock);
    end if;
    if new.on_hand <> old.on_hand and not trusted then
      raise exception 'Stock levels change when the warehouse scans deliveries in. Announce a delivery instead.'
        using errcode = 'P0001';
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

-- Scans write their own, more specific movement rows.
create or replace function products_log_adjustment() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  change int;
begin
  if coalesce(current_setting('bnp.stock_source', true), '') <> '' then return null; end if;
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

-- ---------------------------------------------------------------------------
-- 3. Helpers
-- ---------------------------------------------------------------------------
create or replace function require_warehouse() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_fulfillment_center() or is_admin()) then
    raise exception 'Only warehouse staff can do this.' using errcode = '42501';
  end if;
end $$;

-- Finds the product a scanned code refers to: our SKU label first, then the
-- merchant's retail barcode, then (when we know the merchant) a typed SKU.
-- `ambiguous` is true when a retail barcode matches several merchants.
create or replace function find_scanned_product(p_code text, p_partner uuid default null,
                                                out product_id uuid, out ambiguous boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  code text := upper(btrim(coalesce(p_code, '')));
  n int;
begin
  ambiguous := false;
  select id into product_id from products where barcode = code;
  if product_id is not null then return; end if;

  if p_partner is not null then
    select id into product_id from products
      where partner_id = p_partner and retail_barcode = btrim(p_code) limit 1;
    if product_id is not null then return; end if;
    select id into product_id from products
      where partner_id = p_partner and upper(sku) = code limit 1;
    if product_id is not null then return; end if;
  end if;

  select count(*) into n from products where retail_barcode = btrim(p_code);
  if n > 1 then ambiguous := true; return; end if;
  select id into product_id from products where retail_barcode = btrim(p_code);
end $$;

create or replace function product_label(p products) returns text
language sql immutable as $$
  select p.name || coalesce(' (' || p.variant || ')', '');
$$;

create or replace function scan_result(p_ok boolean, p_tone text, p_message text,
                                       p_extra jsonb default '{}'::jsonb)
returns jsonb language sql immutable as $$
  select jsonb_build_object('ok', p_ok, 'tone', p_tone, 'message', p_message) || p_extra;
$$;

-- Moves on-hand for a scan and logs it.
create or replace function apply_scan_stock(p_product uuid, p_change int, p_movement text,
                                            p_ref text, p_note text,
                                            p_from_bin uuid default null, p_to_bin uuid default null)
returns products language plpgsql security definer set search_path = public as $$
declare
  rec products;
begin
  perform set_config('bnp.stock_source', 'scan', true);
  update products set on_hand = on_hand + p_change where id = p_product returning * into rec;
  perform set_config('bnp.stock_source', '', true);
  insert into stock_movements
    (product_id, partner_id, movement, on_hand_change, on_hand_after, allocated_after,
     order_ref, from_bin, to_bin, note, actor_id)
  values
    (rec.id, rec.partner_id, p_movement, p_change, rec.on_hand, rec.allocated,
     p_ref, p_from_bin, p_to_bin, p_note, auth.uid());
  return rec;
end $$;
revoke all on function apply_scan_stock(uuid, int, text, text, text, uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Merchant: announce or cancel a delivery
-- ---------------------------------------------------------------------------
-- p_lines: [{"product_id": "...", "qty": 10}, ...]
create or replace function announce_delivery(p_location warehouse_location, p_expected_on date,
                                             p_note text, p_lines jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  delivery uuid;
  line jsonb;
  prod products;
  qty int;
  added int := 0;
begin
  if me is null then raise exception 'Sign in again.' using errcode = '42501'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Add at least one product to the delivery.';
  end if;
  if jsonb_array_length(p_lines) > 300 then
    raise exception 'A delivery can list at most 300 products.';
  end if;

  insert into inbound_deliveries (partner_id, location, expected_on, note, created_by)
  values (me, p_location, p_expected_on, nullif(btrim(coalesce(p_note, '')), ''), me)
  returning id into delivery;

  for line in select * from jsonb_array_elements(p_lines) loop
    qty := coalesce((line ->> 'qty')::int, 0);
    if qty <= 0 then continue; end if;
    if qty > 100000 then raise exception 'Quantities must be under 100,000 per product.'; end if;
    select * into prod from products where id = (line ->> 'product_id')::uuid and partner_id = me;
    if prod.id is null then raise exception 'One of those products is not in your inventory.'; end if;
    if prod.location <> p_location then
      raise exception '% is stored in %, not %. Send it in a separate delivery.',
        product_label(prod), prod.location, p_location;
    end if;
    insert into inbound_delivery_lines (delivery_id, product_id, expected_qty)
    values (delivery, prod.id, qty)
    on conflict (delivery_id, product_id)
      do update set expected_qty = inbound_delivery_lines.expected_qty + excluded.expected_qty;
    added := added + 1;
  end loop;

  if added = 0 then raise exception 'Add at least one product with a quantity.'; end if;
  return delivery;
end $$;

create or replace function cancel_delivery(p_delivery uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update inbound_deliveries set status = 'cancelled'
  where id = p_delivery and partner_id = auth.uid() and status = 'announced';
  if not found then
    raise exception 'Only deliveries the warehouse has not started receiving can be cancelled.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Warehouse: receiving
-- ---------------------------------------------------------------------------
-- Stock that turned up without an announcement.
create or replace function start_unannounced_delivery(p_partner uuid, p_location warehouse_location,
                                                      p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  delivery uuid;
begin
  perform require_warehouse();
  if not exists (select 1 from partners where id = p_partner and role = 'merchant') then
    raise exception 'Pick a merchant.';
  end if;
  insert into inbound_deliveries
    (partner_id, location, status, announced, note, created_by, started_at)
  values
    (p_partner, p_location, 'receiving', false, nullif(btrim(coalesce(p_note, '')), ''), auth.uid(), now())
  returning id into delivery;
  return delivery;
end $$;

create or replace function receive_scan(p_delivery uuid, p_code text, p_qty int default 1)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d inbound_deliveries;
  found_product record;
  prod products;
  owner_name text;
  ln inbound_delivery_lines;
  tone text := 'success';
  msg text;
begin
  perform require_warehouse();
  if p_qty is null or p_qty < 1 or p_qty > 10000 then
    return scan_result(false, 'error', 'Quantity must be between 1 and 10,000.');
  end if;

  select * into d from inbound_deliveries where id = p_delivery for update;
  if d.id is null then return scan_result(false, 'error', 'Delivery not found.'); end if;
  if d.status in ('received', 'cancelled') then
    return scan_result(false, 'error', 'This delivery is already ' || d.status || '.');
  end if;

  if upper(btrim(coalesce(p_code, ''))) like 'BIN-%' then
    return scan_result(false, 'error', 'That is a bin label. Scan the item instead.');
  end if;

  select * into found_product from find_scanned_product(p_code, d.partner_id);
  if found_product.ambiguous then
    return scan_result(false, 'error', 'Several products share this barcode. Scan the BNP label instead.');
  end if;
  if found_product.product_id is null then
    return scan_result(false, 'error', 'Unknown barcode: ' || btrim(p_code));
  end if;

  select * into prod from products where id = found_product.product_id;
  if prod.partner_id <> d.partner_id then
    select business_name into owner_name from partners where id = prod.partner_id;
    return scan_result(false, 'error',
      'Wrong merchant: ' || product_label(prod) || ' belongs to ' || coalesce(owner_name, 'another merchant') || '.');
  end if;
  if prod.location <> d.location then
    return scan_result(false, 'error',
      product_label(prod) || ' is set up for the ' || prod.location || ' warehouse, not ' || d.location || '.');
  end if;

  insert into inbound_delivery_lines (delivery_id, product_id, expected_qty, received_qty)
  values (d.id, prod.id, 0, p_qty)
  on conflict (delivery_id, product_id)
    do update set received_qty = inbound_delivery_lines.received_qty + p_qty, updated_at = now()
  returning * into ln;

  if d.status = 'announced' then
    update inbound_deliveries set status = 'receiving', started_at = now() where id = d.id;
  end if;

  perform apply_scan_stock(prod.id, p_qty, 'receive', d.ref, null);

  if ln.expected_qty = 0 then
    tone := 'warning';
    msg := 'Not on the delivery list: ' || product_label(prod) || '. Counted ' || ln.received_qty || '.';
  elsif ln.received_qty > ln.expected_qty then
    tone := 'warning';
    msg := 'More than expected: ' || product_label(prod) || ' ' || ln.received_qty || ' of ' || ln.expected_qty || '.';
  elsif ln.received_qty = ln.expected_qty then
    msg := product_label(prod) || ' complete: ' || ln.received_qty || ' of ' || ln.expected_qty || '.';
  else
    msg := product_label(prod) || ': ' || ln.received_qty || ' of ' || ln.expected_qty || '.';
  end if;

  return scan_result(true, tone, msg, jsonb_build_object(
    'product_id', prod.id, 'received', ln.received_qty, 'expected', ln.expected_qty));
end $$;

-- Takes back units counted by mistake (for example a double scan).
create or replace function receive_undo(p_delivery uuid, p_product uuid, p_qty int default 1)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d inbound_deliveries;
  ln inbound_delivery_lines;
  prod products;
begin
  perform require_warehouse();
  select * into d from inbound_deliveries where id = p_delivery for update;
  if d.id is null or d.status <> 'receiving' then
    return scan_result(false, 'error', 'Only a delivery being received can be corrected.');
  end if;
  select * into ln from inbound_delivery_lines where delivery_id = d.id and product_id = p_product for update;
  if ln.id is null or ln.received_qty < p_qty or p_qty < 1 then
    return scan_result(false, 'error', 'Nothing to take back for that product.');
  end if;
  select * into prod from products where id = p_product;
  if prod.on_hand - p_qty < prod.allocated then
    return scan_result(false, 'error', 'Those units are already reserved for orders.');
  end if;

  update inbound_delivery_lines set received_qty = received_qty - p_qty, updated_at = now()
  where id = ln.id returning * into ln;
  perform apply_scan_stock(p_product, -p_qty, 'receive', d.ref, 'Correction');
  -- Lines that were never on the list disappear again when taken back to zero.
  if ln.received_qty = 0 and ln.expected_qty = 0 then delete from inbound_delivery_lines where id = ln.id; end if;

  return scan_result(true, 'success', 'Took back ' || p_qty || ' of ' || product_label(prod) || '.',
    jsonb_build_object('product_id', p_product, 'received', ln.received_qty, 'expected', ln.expected_qty));
end $$;

-- Closes a delivery. Returns the lines that didn't match.
create or replace function complete_delivery(p_delivery uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d inbound_deliveries;
  gaps jsonb;
begin
  perform require_warehouse();
  select * into d from inbound_deliveries where id = p_delivery for update;
  if d.id is null then raise exception 'Delivery not found.'; end if;
  if d.status in ('received', 'cancelled') then
    raise exception 'This delivery is already %.', d.status;
  end if;
  if not exists (select 1 from inbound_delivery_lines where delivery_id = d.id and received_qty > 0) then
    raise exception 'Nothing has been scanned yet.';
  end if;

  update inbound_deliveries
  set status = 'received', received_at = now(), received_by = auth.uid(),
      started_at = coalesce(started_at, now())
  where id = d.id;

  -- Keeps the restock feed on the overview pages working.
  insert into stock_events (partner_id, product_id, product_name, quantity_added)
  select d.partner_id, p.id, product_label(p), l.received_qty
  from inbound_delivery_lines l join products p on p.id = l.product_id
  where l.delivery_id = d.id and l.received_qty > 0;

  select coalesce(jsonb_agg(jsonb_build_object(
           'product', product_label(p), 'expected', l.expected_qty, 'received', l.received_qty)
         order by p.name), '[]'::jsonb)
  into gaps
  from inbound_delivery_lines l join products p on p.id = l.product_id
  where l.delivery_id = d.id and l.expected_qty <> l.received_qty;

  return jsonb_build_object('ref', d.ref, 'gaps', gaps);
end $$;

-- ---------------------------------------------------------------------------
-- 6. Warehouse: putaway
-- ---------------------------------------------------------------------------
-- Units on the shelf count but not yet in a bin. Dispatch takes stock off
-- on-hand before picking from bins exists (phase 4), so never below zero.
create or replace function unplaced_qty(p_product uuid) returns int
language sql stable security definer set search_path = public as $$
  select greatest(0, p.on_hand - coalesce((select sum(quantity) from bin_stock where product_id = p.id), 0))::int
  from products p where p.id = p_product;
$$;

create or replace function putaway_queue(p_location warehouse_location)
returns table (product_id uuid, name text, variant text, barcode text, merchant text,
               unplaced int, bins text[])
language plpgsql stable security definer set search_path = public as $$
begin
  perform require_warehouse();
  return query
    select p.id, p.name, p.variant, p.barcode, pa.business_name,
           greatest(0, p.on_hand - coalesce(b.binned, 0))::int,
           coalesce(b.codes, '{}')
    from products p
    join partners pa on pa.id = p.partner_id
    left join (
      select bs.product_id, sum(bs.quantity) as binned,
             array_agg(bn.code order by bn.code) filter (where bs.quantity > 0) as codes
      from bin_stock bs join bins bn on bn.id = bs.bin_id
      group by bs.product_id
    ) b on b.product_id = p.id
    where p.location = p_location and p.on_hand - coalesce(b.binned, 0) > 0
    order by pa.business_name, p.name, p.variant;
end $$;

create or replace function putaway_scan(p_bin uuid, p_code text, p_qty int default 1)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  bin bins;
  held bin_stock;
  found_product record;
  prod products;
  held_label text;
  left_over int;
  in_bin int;
begin
  perform require_warehouse();
  if p_qty is null or p_qty < 1 or p_qty > 10000 then
    return scan_result(false, 'error', 'Quantity must be between 1 and 10,000.');
  end if;
  select * into bin from bins where id = p_bin;
  if bin.id is null then return scan_result(false, 'error', 'Scan a bin first.'); end if;
  if not bin.active then return scan_result(false, 'error', 'Bin ' || bin.code || ' is switched off.'); end if;

  select * into found_product from find_scanned_product(p_code);
  if found_product.ambiguous then
    return scan_result(false, 'error', 'Several products share this barcode. Scan the BNP label instead.');
  end if;
  if found_product.product_id is null then
    return scan_result(false, 'error', 'Unknown barcode: ' || btrim(p_code));
  end if;
  select * into prod from products where id = found_product.product_id;

  if prod.location <> bin.location then
    return scan_result(false, 'error',
      'Wrong warehouse: ' || product_label(prod) || ' belongs in ' || prod.location || '.');
  end if;

  select * into held from bin_stock where bin_id = bin.id for update;
  if held.bin_id is not null and held.product_id <> prod.id and held.quantity > 0 then
    select product_label(p) into held_label from products p where p.id = held.product_id;
    return scan_result(false, 'error', 'Wrong bin: ' || bin.code || ' already holds ' || held_label || '.');
  end if;

  left_over := unplaced_qty(prod.id);
  if left_over = 0 then
    return scan_result(false, 'error', 'Nothing left to put away for ' || product_label(prod) || '.');
  end if;
  if left_over < p_qty then
    return scan_result(false, 'error', 'Only ' || left_over || ' of ' || product_label(prod) || ' left to put away.');
  end if;

  insert into bin_stock (bin_id, product_id, quantity, updated_at)
  values (bin.id, prod.id, p_qty, now())
  on conflict (bin_id) do update
    set product_id = excluded.product_id,
        quantity = case when bin_stock.product_id = excluded.product_id
                        then bin_stock.quantity + excluded.quantity else excluded.quantity end,
        updated_at = now()
  returning quantity into in_bin;

  insert into stock_movements
    (product_id, partner_id, movement, on_hand_change, on_hand_after, allocated_after,
     to_bin, note, actor_id)
  values
    (prod.id, prod.partner_id, 'putaway', 0, prod.on_hand, prod.allocated, bin.id,
     p_qty || ' into ' || bin.code, auth.uid());

  return scan_result(true, 'success',
    product_label(prod) || ' into ' || bin.code || '. Bin now holds ' || in_bin || '.',
    jsonb_build_object('product_id', prod.id, 'label', product_label(prod),
                       'in_bin', in_bin, 'left', left_over - p_qty));
end $$;

-- Internal helpers: only the functions above call them.
revoke all on function find_scanned_product(text, uuid) from public, anon, authenticated;
revoke all on function unplaced_qty(uuid) from public, anon, authenticated;

grant execute on function announce_delivery(warehouse_location, date, text, jsonb) to authenticated;
grant execute on function cancel_delivery(uuid) to authenticated;
grant execute on function start_unannounced_delivery(uuid, warehouse_location, text) to authenticated;
grant execute on function receive_scan(uuid, text, int) to authenticated;
grant execute on function receive_undo(uuid, uuid, int) to authenticated;
grant execute on function complete_delivery(uuid) to authenticated;
grant execute on function putaway_queue(warehouse_location) to authenticated;
grant execute on function putaway_scan(uuid, text, int) to authenticated;

commit;
