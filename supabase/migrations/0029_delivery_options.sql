-- Delivery options (Technical Specification v2, section 6), built our way.
--
--  Methods: BNP Dispatch (flat rate per zone, Abuja and Lagos), GIG and UPS
--  (rate cards by destination zone and weight, uploaded as CSV), Walk-in
--  (free collection at the Abuja hub, with a pickup time), and the
--  merchant's Own rider (their own zones and fees, no BNP charge).
--
--  Who pays: on storefront orders the customer pays BNP's delivery fee at
--  checkout. On orders the merchant creates, the fee is billed to the
--  merchant: on the Standard invoice, or from the Enterprise wallet when the
--  order is dispatched.
--
--  Also fixes picking and billing for the delivery-fee line of store orders
--  (a line with no product): it isn't an item to pick, and it isn't goods.

begin;

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
alter table orders add column if not exists delivery_method text
  check (delivery_method is null or delivery_method in ('bnp_dispatch', 'gig', 'ups', 'walk_in', 'own_rider'));
alter table orders add column if not exists delivery_zone text
  check (delivery_zone is null or length(delivery_zone) <= 120);
alter table orders add column if not exists delivery_weight_kg numeric(8,2)
  check (delivery_weight_kg is null or delivery_weight_kg >= 0);
alter table orders add column if not exists delivery_billed_to text not null default 'none'
  check (delivery_billed_to in ('merchant', 'customer', 'none'));
alter table orders add column if not exists tracking_number text
  check (tracking_number is null or length(tracking_number) <= 100);
alter table orders add column if not exists pickup_at timestamptz;
alter table orders add column if not exists dispatched_at timestamptz;

alter table products add column if not exists weight_kg numeric(8,3)
  check (weight_kg is null or (weight_kg >= 0 and weight_kg <= 10000));

alter table invoices add column if not exists delivery_amount numeric(14,2) not null default 0;

alter table billing_charges drop constraint if exists billing_charges_kind_check;
alter table billing_charges add constraint billing_charges_kind_check
  check (kind in ('storage', 'insurance', 'fulfillment', 'adjustment', 'delivery'));
alter table billing_charges add column if not exists delivery_line_id uuid unique
  references orders (id) on delete set null;

-- ---------------------------------------------------------------------------
-- 2. Rates
-- ---------------------------------------------------------------------------
create table if not exists dispatch_zones (
  id         uuid primary key default gen_random_uuid(),
  hub        warehouse_location not null,
  name       text not null check (length(name) between 1 and 80),
  coverage   text check (coverage is null or length(coverage) <= 300),
  rate       numeric(12,2) not null check (rate >= 0),
  note       text check (note is null or length(note) <= 200),
  active     boolean not null default true,
  sort       integer not null default 0,
  created_at timestamptz not null default now(),
  unique (hub, name)
);

insert into dispatch_zones (hub, name, coverage, rate, note, sort) values
  ('Abuja', 'Abuja Zone 1', 'Jabi, Wuse, Garki, Central Abuja', 2500, 'Same day if ordered before 12 noon', 1),
  ('Abuja', 'Abuja Zone 2', 'Gwagwalada, Lugbe, Airport Road, Kubwa', 3500, 'Next day', 2),
  ('Abuja', 'Abuja Zone 3', 'Kuje, Bwari, Kwali, Abaji', 5000, null, 3),
  ('Lagos', 'Lagos Zone 1', 'Lagos Island, VI, Lekki Phase 1', 3000, 'Next day', 1),
  ('Lagos', 'Lagos Zone 2', 'Ikeja, Surulere, Yaba, Ikoyi', 3500, null, 2),
  ('Lagos', 'Lagos Zone 3', 'Badagry, Epe, Ikorodu', 5500, null, 3)
on conflict (hub, name) do nothing;

create table if not exists delivery_rate_cards (
  id               uuid primary key default gen_random_uuid(),
  carrier          text not null check (carrier in ('UPS', 'GIG')),
  origin_hub       warehouse_location not null,
  destination_zone text not null check (length(destination_zone) between 1 and 120),
  weight_min_kg    numeric(8,3) not null check (weight_min_kg >= 0),
  weight_max_kg    numeric(8,3) not null,
  rate             numeric(12,2) not null check (rate >= 0),
  effective_from   date not null default current_date,
  effective_to     date,
  is_active        boolean not null default true,
  upload_batch     uuid,
  created_at       timestamptz not null default now(),
  check (weight_max_kg > weight_min_kg)
);
create index if not exists delivery_rate_cards_lookup_idx
  on delivery_rate_cards (carrier, origin_hub, destination_zone) where is_active;

alter table dispatch_zones enable row level security;
alter table delivery_rate_cards enable row level security;
-- Customers see delivery prices at checkout, so rates are public to read.
drop policy if exists "dispatch_zones read" on dispatch_zones;
create policy "dispatch_zones read" on dispatch_zones for select using (true);
drop policy if exists "dispatch_zones admin" on dispatch_zones;
create policy "dispatch_zones admin" on dispatch_zones for all using (is_admin()) with check (is_admin());
drop policy if exists "delivery_rate_cards read" on delivery_rate_cards;
create policy "delivery_rate_cards read" on delivery_rate_cards for select using (true);
drop policy if exists "delivery_rate_cards admin" on delivery_rate_cards;
create policy "delivery_rate_cards admin" on delivery_rate_cards for all using (is_admin()) with check (is_admin());

-- Price for a delivery, or null when that option isn't available.
create or replace function delivery_quote(p_method text, p_hub warehouse_location, p_zone text,
                                          p_weight numeric default 0)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare
  v numeric;
begin
  if p_method = 'walk_in' then
    return case when p_hub = 'Abuja' then 0 else null end;
  elsif p_method = 'bnp_dispatch' then
    select rate into v from dispatch_zones where hub = p_hub and name = p_zone and active;
    return v;
  elsif p_method in ('gig', 'ups') then
    select rate into v from delivery_rate_cards
    where carrier = upper(p_method) and origin_hub = p_hub and destination_zone = p_zone
      and is_active and weight_min_kg <= coalesce(p_weight, 0) and weight_max_kg > coalesce(p_weight, 0)
      and effective_from <= current_date and (effective_to is null or effective_to >= current_date)
    order by effective_from desc limit 1;
    return v;
  end if;
  return null;
end $$;
grant execute on function delivery_quote(text, warehouse_location, text, numeric) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Dispatch time, and the Enterprise delivery charge
-- ---------------------------------------------------------------------------
-- Billing dates are set by the database. A merchant writing to their own
-- orders can't move them (e.g. into a month that isn't billed); the server
-- (service role) and admins may set them.
create or replace function orders_billing() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  trusted boolean := auth.uid() is null or is_admin();
begin
  if tg_op = 'UPDATE' and not trusted then
    new.delivered_at := old.delivered_at;
    new.dispatched_at := old.dispatched_at;
  elsif tg_op = 'INSERT' and not trusted then
    new.delivered_at := null;
    new.dispatched_at := null;
  end if;
  if new.status = 'Delivered' and (tg_op = 'INSERT' or old.status is distinct from 'Delivered') then
    new.delivered_at := coalesce(new.delivered_at, now());
  end if;
  if new.status = 'Dispatched' and (tg_op = 'INSERT' or old.status is distinct from 'Dispatched') then
    new.dispatched_at := coalesce(new.dispatched_at, now());
  end if;
  return new;
end $$;

drop trigger if exists orders_billing on orders;
create trigger orders_billing before insert or update on orders
  for each row execute function orders_billing();

-- BNP delivery booked by a merchant must carry BNP's price. Checked once the
-- whole order is in (the fee sits on one line), so deferred to commit.
create or replace function orders_delivery_fee_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  q numeric;
  charged numeric;
begin
  if new.delivery_method is null or new.delivery_method = 'own_rider' then return null; end if;
  if auth.uid() is null or is_admin() or is_fulfillment_center() then return null; end if;
  q := delivery_quote(new.delivery_method, new.location, new.delivery_zone, coalesce(new.delivery_weight_kg, 0));
  if q is null then
    raise exception 'That delivery option is not available for this order.' using errcode = '22023';
  end if;
  select coalesce(sum(delivery_fee), 0) into charged
  from orders where partner_id = new.partner_id and order_ref = new.order_ref and status <> 'Cancelled';
  if charged <> q then
    raise exception 'The delivery price for this order is %.', q using errcode = '22023';
  end if;
  if q > 0 and exists (select 1 from orders where partner_id = new.partner_id and order_ref = new.order_ref
                       and delivery_billed_to <> 'merchant') then
    raise exception 'BNP delivery on your orders is billed to you.' using errcode = '22023';
  end if;
  return null;
end $$;

drop trigger if exists orders_delivery_fee_check on orders;
create constraint trigger orders_delivery_fee_check after insert on orders
  deferrable initially deferred for each row execute function orders_delivery_fee_check();

-- Once BNP delivery is booked, a merchant can't change it or its price.
create or replace function orders_delivery_freeze() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or is_admin() or is_fulfillment_center() then return new; end if;
  if old.delivery_method is not null and old.delivery_method <> 'own_rider' then
    new.delivery_method := old.delivery_method;
    new.delivery_zone := old.delivery_zone;
    new.delivery_weight_kg := old.delivery_weight_kg;
    new.delivery_billed_to := old.delivery_billed_to;
    new.delivery_fee := old.delivery_fee;
  elsif new.delivery_method is distinct from old.delivery_method
        and new.delivery_method is not null and new.delivery_method <> 'own_rider' then
    raise exception 'BNP delivery is chosen when the order is created.' using errcode = '22023';
  elsif new.delivery_billed_to is distinct from old.delivery_billed_to then
    new.delivery_billed_to := old.delivery_billed_to;
  end if;
  new.tracking_number := old.tracking_number;
  return new;
end $$;

drop trigger if exists orders_delivery_freeze on orders;
create trigger orders_delivery_freeze before update on orders
  for each row execute function orders_delivery_freeze();

-- Warehouse staff record the carrier's tracking number for GIG and UPS.
create or replace function set_tracking_number(p_partner uuid, p_order_ref text, p_tracking text)
returns void language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  perform require_warehouse();
  update orders set tracking_number = nullif(left(trim(p_tracking), 100), '')
  where partner_id = p_partner and order_ref = p_order_ref;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Order not found.' using errcode = 'P0002'; end if;
end $$;
revoke all on function set_tracking_number(uuid, text, text) from public, anon;
grant execute on function set_tracking_number(uuid, text, text) to authenticated;

create or replace function orders_delivery_charge() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p partners;
begin
  if new.status <> 'Dispatched' or (tg_op = 'UPDATE' and old.status = 'Dispatched') then return null; end if;
  if new.delivery_billed_to <> 'merchant' or coalesce(new.delivery_fee, 0) <= 0 then return null; end if;
  select * into p from partners where id = new.partner_id;
  if p.plan_type <> 'enterprise' or not billing_started(lagos_month(new.dispatched_at)) then return null; end if;
  if exists (select 1 from billing_charges where delivery_line_id = new.id) then return null; end if;
  insert into billing_charges (partner_id, kind, period, delivery_line_id, order_ref, amount, note)
  values (new.partner_id, 'delivery', lagos_month(new.dispatched_at), new.id, new.order_ref, new.delivery_fee,
          'Delivery, ' || new.order_ref || coalesce(' (' || new.delivery_zone || ')', ''));
  perform charge_wallet(new.partner_id, new.delivery_fee, 'Delivery, ' || new.order_ref);
  perform check_wallet_floor(new.partner_id);
  return null;
end $$;

drop trigger if exists orders_delivery_charge on orders;
create trigger orders_delivery_charge after insert or update of status on orders
  for each row execute function orders_delivery_charge();

-- ---------------------------------------------------------------------------
-- 4. Picking and billing fixes (functions from 0024 and 0028, patched)
-- ---------------------------------------------------------------------------
create or replace function pick_list(p_location warehouse_location)
returns table (order_id uuid, partner_id uuid, order_ref text, merchant text, customer text,
               rider order_rider, status order_status, lines int, units int, picked int,
               placed_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform require_warehouse();
  return query
    select (array_agg(o.id order by o.created_at))[1], o.partner_id, o.order_ref,
           pa.business_name, max(o.customer_name), max(o.rider),
           (case when bool_or(o.status = 'Picking') then 'Picking' else 'Reserved' end)::order_status,
           (count(*) filter (where o.product_id is not null))::int,
           (coalesce(sum(o.quantity) filter (where o.product_id is not null), 0))::int,
           (coalesce(sum(o.picked_qty) filter (where o.product_id is not null), 0))::int, min(o.placed_at)
    from orders o join partners pa on pa.id = o.partner_id
    where o.location = p_location and o.status in ('Reserved', 'Picking')
    group by o.partner_id, o.order_ref, pa.business_name
    order by min(o.placed_at);
end $$;

create or replace function pick_scan(p_partner uuid, p_order_ref text, p_bin uuid, p_code text,
                                     p_qty int default 1)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  bin bins;
  held bin_stock;
  found_product record;
  prod products;
  ln orders;
  needed text;
  remaining int;
  total_left int;
begin
  perform require_warehouse();
  if p_qty is null or p_qty < 1 or p_qty > 10000 then
    return scan_result(false, 'error', 'Quantity must be between 1 and 10,000.');
  end if;
  if not exists (select 1 from orders where partner_id = p_partner and order_ref = p_order_ref
                 and status = 'Picking') then
    return scan_result(false, 'error', 'This order is not being picked.');
  end if;

  select * into bin from bins where id = p_bin;
  if bin.id is null then return scan_result(false, 'error', 'Scan the bin first.'); end if;
  select * into held from bin_stock where bin_id = bin.id for update;

  select * into found_product from find_scanned_product(p_code, p_partner);
  if found_product.product_id is null then
    return scan_result(false, 'error', 'Unknown barcode: ' || btrim(p_code));
  end if;
  select * into prod from products where id = found_product.product_id;

  -- The line on this order that still needs this product.
  select * into ln from orders
  where partner_id = p_partner and order_ref = p_order_ref and status = 'Picking'
    and product_id = prod.id and picked_qty < quantity
  order by created_at limit 1 for update;

  if ln.id is null then
    if exists (select 1 from orders where partner_id = p_partner and order_ref = p_order_ref
               and status = 'Picking' and product_id = prod.id) then
      return scan_result(false, 'error', 'Quantity complete: ' || product_label(prod) || ' is all picked.');
    end if;
    select string_agg(distinct pr.barcode, ', ') into needed
    from orders o join products pr on pr.id = o.product_id
    where o.partner_id = p_partner and o.order_ref = p_order_ref and o.status = 'Picking'
      and o.picked_qty < o.quantity;
    return scan_result(false, 'error', 'Wrong item: this order needs ' || coalesce(needed, 'nothing else') || '.');
  end if;

  if held.bin_id is null or held.product_id <> prod.id or held.quantity = 0 then
    return scan_result(false, 'error', 'Wrong bin: ' || product_label(prod) || ' is not in ' || bin.code || '.');
  end if;

  remaining := ln.quantity - ln.picked_qty;
  if p_qty > remaining then
    return scan_result(false, 'error', 'Too many: only ' || remaining || ' more ' || product_label(prod) || ' needed.');
  end if;
  if p_qty > held.quantity then
    return scan_result(false, 'error', 'Bin ' || bin.code || ' only has ' || held.quantity || ' left.');
  end if;

  update bin_stock set quantity = quantity - p_qty, updated_at = now() where bin_id = bin.id;
  perform set_config('bnp.stock_source', 'scan', true);
  update orders set picked_qty = picked_qty + p_qty where id = ln.id returning * into ln;
  perform set_config('bnp.stock_source', '', true);

  insert into stock_movements
    (product_id, partner_id, movement, on_hand_change, on_hand_after, allocated_after,
     order_ref, from_bin, note, actor_id)
  values
    (prod.id, prod.partner_id, 'pick', 0, prod.on_hand, prod.allocated, p_order_ref, bin.id,
     p_qty || ' from ' || bin.code, auth.uid());

  select coalesce(sum(quantity - picked_qty), 0) into total_left
  from orders where partner_id = p_partner and order_ref = p_order_ref and status = 'Picking'
    and product_id is not null;

  if total_left = 0 then
    perform set_config('bnp.stock_source', 'scan', true);
    update orders set status = 'Packed'
    where partner_id = p_partner and order_ref = p_order_ref and status = 'Picking';
    perform set_config('bnp.stock_source', '', true);
    return scan_result(true, 'success', 'Order complete. Print the package label and pack it.',
      jsonb_build_object('product_id', prod.id, 'picked', ln.picked_qty, 'quantity', ln.quantity,
                         'complete', true, 'package', package_code(p_partner, p_order_ref)));
  end if;

  return scan_result(true, 'success',
    product_label(prod) || ' ' || ln.picked_qty || '/' || ln.quantity || '.',
    jsonb_build_object('product_id', prod.id, 'picked', ln.picked_qty, 'quantity', ln.quantity,
                       'complete', false));
end $$;

create or replace function dispatch_scan(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  o record;
  units int;
  picking int;
begin
  perform require_warehouse();
  if v_code like 'BIN-%' then
    return scan_result(false, 'error', 'That is a bin label. Scan the package label.');
  end if;

  select ord.partner_id, ord.order_ref, pa.business_name, max(ord.customer_name) as customer,
         max(ord.rider::text) as rider,
         bool_and(ord.status = 'Packed') as packed,
         bool_or(ord.status in ('Reserved', 'Picking')) as not_ready,
         bool_or(ord.status in ('Dispatched', 'Delivered')) as gone,
         bool_and(ord.status = 'Cancelled') as cancelled
  into o
  from orders ord join partners pa on pa.id = ord.partner_id
  where pa.code || '-' || ord.order_ref = v_code
  group by ord.partner_id, ord.order_ref, pa.business_name;

  if o.partner_id is null then return scan_result(false, 'error', 'Unknown package: ' || v_code); end if;
  if o.cancelled then return scan_result(false, 'error', 'This order was cancelled. Do not send it.'); end if;
  if o.gone then return scan_result(false, 'error', 'Already dispatched: ' || v_code || '.'); end if;
  if o.not_ready then
    select coalesce(sum(picked_qty), 0), coalesce(sum(quantity), 0) into picking, units
    from orders where partner_id = o.partner_id and order_ref = o.order_ref and status <> 'Cancelled'
      and product_id is not null;
    return scan_result(false, 'error', 'Not ready: picked ' || picking || ' of ' || units || '. Finish picking first.');
  end if;

  perform set_config('bnp.stock_source', 'scan', true);
  update orders set status = 'Dispatched'
  where partner_id = o.partner_id and order_ref = o.order_ref and status = 'Packed';
  perform set_config('bnp.stock_source', '', true);

  select coalesce(sum(quantity), 0) into units from orders
  where partner_id = o.partner_id and order_ref = o.order_ref and status = 'Dispatched'
    and product_id is not null;

  return scan_result(true, 'success',
    'Dispatched ' || o.order_ref || ' for ' || o.customer || ' (' || units || ' item' ||
      case when units = 1 then '' else 's' end || ', ' || o.rider || ').',
    jsonb_build_object('partner_id', o.partner_id, 'order_ref', o.order_ref));
end $$;

create or replace function orders_fulfillment_fee() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p partners;
  s billing_settings;
  fee numeric;
begin
  if new.status <> 'Delivered' or (tg_op = 'UPDATE' and old.status = 'Delivered') then return null; end if;
  -- The delivery-fee line of a store order isn't goods.
  if new.product_id is null then return null; end if;
  select * into p from partners where id = new.partner_id;
  if p.plan_type <> 'enterprise' or not billing_started(lagos_month(new.delivered_at)) then return null; end if;
  if exists (select 1 from billing_charges where order_line_id = new.id) then return null; end if;
  select * into s from billing_settings;
  fee := round(line_goods_value(new) * s.enterprise_rate, 2);
  if fee <= 0 then return null; end if;
  insert into billing_charges (partner_id, kind, period, order_line_id, order_ref, basis, rate, amount, note)
  values (new.partner_id, 'fulfillment', lagos_month(new.delivered_at), new.id, new.order_ref,
          line_goods_value(new), s.enterprise_rate, fee, 'Fulfillment fee, ' || new.order_ref);
  perform charge_wallet(new.partner_id, fee, 'Fulfillment fee (9%), ' || new.order_ref);
  perform check_wallet_floor(new.partner_id);
  return null;
end $$;

create or replace function run_monthly_billing(p_period date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s billing_settings;
  p partners;
  sales numeric;
  storage numeric;
  fee numeric;
  stock_value numeric;
  insurance numeric;
  inv invoices;
  invoiced int := 0;
  charged int := 0;
  month_end timestamptz;
  storage_done numeric;
  insurance_done numeric;
  delivery numeric;
begin
  select * into s from billing_settings;
  if p_period is null or p_period <> date_trunc('month', p_period)::date then
    raise exception 'Give the first day of a month.';
  end if;
  if not billing_started(p_period) then
    return jsonb_build_object('skipped', 'Billing starts with ' || to_char(s.start_month, 'FMMonth YYYY'));
  end if;
  if p_period >= lagos_month() then
    raise exception 'That month has not finished yet.';
  end if;
  month_end := ((p_period + interval '1 month')::timestamp at time zone 'Africa/Lagos');

  for p in select * from partners where role = 'merchant' and status = 'active' loop
    storage := round(p.storage_sqm * s.storage_rate, 2);

    if p.plan_type = 'standard' then
      if exists (select 1 from invoices where partner_id = p.id and period = p_period) then continue; end if;
      -- Goods delivered in the month and not already charged on Enterprise.
      select coalesce(sum(line_goods_value(o)), 0) into sales
      from orders o
      where o.partner_id = p.id
        and o.product_id is not null
        and o.delivered_at >= (p_period::timestamp at time zone 'Africa/Lagos')
        and o.delivered_at < month_end
        and not exists (select 1 from billing_charges c where c.order_line_id = o.id and c.kind = 'fulfillment');
      fee := round(sales * s.standard_rate, 2);
      -- BNP delivery on orders the merchant created, dispatched this month.
      select coalesce(sum(o.delivery_fee), 0) into delivery
      from orders o
      where o.partner_id = p.id
        and o.delivery_billed_to = 'merchant'
        and o.dispatched_at >= (p_period::timestamp at time zone 'Africa/Lagos')
        and o.dispatched_at < month_end
        and not exists (select 1 from billing_charges c where c.delivery_line_id = o.id);
      if storage + fee + delivery <= 0 then continue; end if;
      insert into invoices (partner_id, period, storage_sqm, storage_amount, sales_value,
                            fulfillment_rate, fulfillment_amount, delivery_amount, total, due_at)
      values (p.id, p_period, p.storage_sqm, storage, sales, s.standard_rate, fee, delivery,
              storage + fee + delivery, now() + make_interval(days => s.grace_days))
      returning * into inv;
      insert into billing_notices (partner_id, kind, payload)
      values (p.id, 'invoice_issued', jsonb_build_object('invoice_id', inv.id, 'number', inv.number,
              'total', inv.total, 'due_at', inv.due_at, 'period', p_period));
      invoiced := invoiced + 1;

    else
      storage_done := 0;
      insurance_done := 0;
      if storage > 0 and not exists (select 1 from billing_charges where partner_id = p.id
                                      and kind = 'storage' and period = p_period) then
        insert into billing_charges (partner_id, kind, period, basis, rate, amount, note)
        values (p.id, 'storage', p_period, p.storage_sqm, s.storage_rate, storage,
                'Storage, ' || p.storage_sqm || ' m², ' || to_char(p_period, 'FMMonth YYYY'));
        perform charge_wallet(p.id, storage, 'Storage, ' || to_char(p_period, 'FMMonth YYYY'));
        storage_done := storage;
        charged := charged + 1;
      end if;

      -- Stock value now, at the start of the month, stands for month-end.
      select coalesce(sum(pr.on_hand * coalesce(pr.declared_value, 0)), 0) into stock_value
      from products pr where pr.partner_id = p.id;
      insurance := round(stock_value * s.insurance_rate, 2);
      if insurance > 0 and not exists (select 1 from billing_charges where partner_id = p.id
                                       and kind = 'insurance' and period = p_period) then
        insert into billing_charges (partner_id, kind, period, basis, rate, amount, note)
        values (p.id, 'insurance', p_period, stock_value, s.insurance_rate, insurance,
                'Insurance on ₦' || to_char(stock_value, 'FM999,999,999,990') || ' of stock');
        perform charge_wallet(p.id, insurance, 'Insurance (0.25%), ' || to_char(p_period, 'FMMonth YYYY'));
        insurance_done := insurance;
        charged := charged + 1;
      end if;
      -- Only when this run charged something, so a re-run doesn't email again.
      if storage_done > 0 or insurance_done > 0 then
        insert into billing_notices (partner_id, kind, payload)
        values (p.id, 'enterprise_monthly', jsonb_build_object('period', p_period, 'storage', storage_done,
                'insurance', insurance_done, 'stock_value', stock_value));
      end if;
      perform check_wallet_floor(p.id);
    end if;
  end loop;

  return jsonb_build_object('period', p_period, 'invoices', invoiced, 'charges', charged);
end $$;

grant execute on function pick_list(warehouse_location) to authenticated;
grant execute on function pick_scan(uuid, text, uuid, text, int) to authenticated;
grant execute on function dispatch_scan(text) to authenticated;
revoke all on function run_monthly_billing(date) from public, anon, authenticated;
grant execute on function run_monthly_billing(date) to service_role;

commit;
