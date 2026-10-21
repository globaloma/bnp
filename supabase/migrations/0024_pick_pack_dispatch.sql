-- Barcode pick-and-pack, phase 4: pick, pack and dispatch.
-- See "Barcode Pick-and-Pack Developer Brief" (Oct 13 2026).
--
--  * Received stock waits in `staged` until it is put away into a bin; only
--    then does it count as on-hand and become sellable (brief steps 4 and 5).
--  * Pick: staff open one order, scan a bin, then each item. Each scan moves
--    one unit out of the bin into the order (orders.picked_qty).
--  * When every line is picked the order becomes Packed and gets a package
--    label: the merchant code plus the order number, e.g. BOXN-ORD-7KQ2MX.
--  * Dispatch: scanning the package label marks the order Dispatched, which
--    takes the stock off on-hand (orders trigger, 0022).
--  * Picking, Packed and Dispatched can only be reached by these scans.
--
-- Units that are physically in the building but in no bin (stock from before
-- bins existed, returns, units from cancelled picks) show up in the putaway
-- queue automatically: on-hand minus binned minus picked-but-not-dispatched.

begin;

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
alter table products add column if not exists staged integer not null default 0
  check (staged >= 0);
alter table orders add column if not exists picked_qty integer not null default 0
  check (picked_qty >= 0);
do $$ begin
  alter table orders add constraint orders_picked_le_quantity check (picked_qty <= quantity);
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2. Guards: only scans move staged, picked_qty and the pick statuses
-- ---------------------------------------------------------------------------
create or replace function products_stock_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  source text := coalesce(current_setting('bnp.stock_source', true), '');
  from_orders boolean := source = 'order';
  trusted boolean := source in ('order', 'scan') or is_admin();
  pcode text;
begin
  if tg_op = 'INSERT' then
    if new.on_hand = 0 and coalesce(new.stock, 0) <> 0 then new.on_hand := new.stock; end if;
    if not trusted then new.on_hand := 0; new.staged := 0; end if;
    new.allocated := 0;
  else
    if not from_orders then new.allocated := old.allocated; end if;
    if source <> 'scan' then new.staged := old.staged; end if;
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

create or replace function orders_scan_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  scan boolean := coalesce(current_setting('bnp.stock_source', true), '') = 'scan';
begin
  if tg_op = 'INSERT' then
    new.picked_qty := 0;
    if new.status in ('Picking', 'Packed', 'Dispatched') and not scan then
      raise exception 'New orders start as Created or Reserved.' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if not scan then new.picked_qty := old.picked_qty; end if;
  if new.status is distinct from old.status
     and new.status in ('Picking', 'Packed', 'Dispatched') and not scan and not is_admin() then
    raise exception 'Picking, Packed and Dispatched are set by the warehouse scan screens.'
      using errcode = 'P0001';
  end if;
  -- Units picked for an order that is cancelled go back to "waiting for a bin".
  if new.status = 'Cancelled' and old.status <> 'Cancelled' then new.picked_qty := 0; end if;
  return new;
end $$;

drop trigger if exists orders_scan_guard on orders;
create trigger orders_scan_guard before insert or update on orders
  for each row execute function orders_scan_guard();

-- ---------------------------------------------------------------------------
-- 3. Helpers
-- ---------------------------------------------------------------------------
-- On-hand units in no bin and not picked for an open order.
create or replace function unbinned_qty(p_product uuid) returns int
language sql stable security definer set search_path = public as $$
  select greatest(0, p.on_hand
    - coalesce((select sum(quantity) from bin_stock where product_id = p.id), 0)
    - coalesce((select sum(picked_qty) from orders
                where product_id = p.id and status in ('Picking', 'Packed')), 0))::int
  from products p where p.id = p_product;
$$;

-- Waiting for a bin: received units plus unbinned on-hand units.
create or replace function unplaced_qty(p_product uuid) returns int
language sql stable security definer set search_path = public as $$
  select (p.staged + unbinned_qty(p.id))::int from products p where p.id = p_product;
$$;

create or replace function package_code(p_partner uuid, p_order_ref text) returns text
language sql stable security definer set search_path = public as $$
  select pa.code || '-' || p_order_ref from partners pa where pa.id = p_partner;
$$;

-- Moves staged units (not on-hand) for receiving, and logs it.
create or replace function apply_staged(p_product uuid, p_change int, p_ref text, p_note text)
returns products language plpgsql security definer set search_path = public as $$
declare
  rec products;
begin
  perform set_config('bnp.stock_source', 'scan', true);
  update products set staged = staged + p_change where id = p_product returning * into rec;
  perform set_config('bnp.stock_source', '', true);
  insert into stock_movements
    (product_id, partner_id, movement, on_hand_change, on_hand_after, allocated_after,
     order_ref, note, actor_id)
  values
    (rec.id, rec.partner_id, 'receive', 0, rec.on_hand, rec.allocated, p_ref,
     coalesce(p_note || '. ', '') || p_change || ' to put away, ' || rec.staged || ' waiting',
     auth.uid());
  return rec;
end $$;

revoke all on function unbinned_qty(uuid) from public, anon, authenticated;
revoke all on function unplaced_qty(uuid) from public, anon, authenticated;
revoke all on function apply_staged(uuid, int, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Receiving: stock waits to be put away
-- ---------------------------------------------------------------------------
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

  perform apply_staged(prod.id, p_qty, d.ref, null);

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
  if prod.staged < p_qty then
    return scan_result(false, 'error', 'Those units have already been put away.');
  end if;

  update inbound_delivery_lines set received_qty = received_qty - p_qty, updated_at = now()
  where id = ln.id returning * into ln;
  perform apply_staged(p_product, -p_qty, d.ref, 'Correction');
  if ln.received_qty = 0 and ln.expected_qty = 0 then delete from inbound_delivery_lines where id = ln.id; end if;

  return scan_result(true, 'success', 'Took back ' || p_qty || ' of ' || product_label(prod) || '.',
    jsonb_build_object('product_id', p_product, 'received', ln.received_qty, 'expected', ln.expected_qty));
end $$;

-- ---------------------------------------------------------------------------
-- 5. Putaway: staged units become on-hand when they go into a bin
-- ---------------------------------------------------------------------------
create or replace function putaway_queue(p_location warehouse_location)
returns table (product_id uuid, name text, variant text, barcode text, merchant text,
               unplaced int, bins text[])
language plpgsql stable security definer set search_path = public as $$
begin
  perform require_warehouse();
  return query
    select p.id, p.name, p.variant, p.barcode, pa.business_name,
           unplaced_qty(p.id),
           coalesce((select array_agg(bn.code order by bn.code)
                     from bin_stock bs join bins bn on bn.id = bs.bin_id
                     where bs.product_id = p.id and bs.quantity > 0), '{}')
    from products p
    join partners pa on pa.id = p.partner_id
    where p.location = p_location and unplaced_qty(p.id) > 0
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
  from_staged int;
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
  select * into prod from products where id = found_product.product_id for update;

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

  -- Freshly received units first: they join on-hand now and become sellable.
  from_staged := least(prod.staged, p_qty);
  perform set_config('bnp.stock_source', 'scan', true);
  update products set staged = staged - from_staged, on_hand = on_hand + from_staged
  where id = prod.id returning * into prod;
  perform set_config('bnp.stock_source', '', true);

  insert into stock_movements
    (product_id, partner_id, movement, on_hand_change, on_hand_after, allocated_after,
     to_bin, note, actor_id)
  values
    (prod.id, prod.partner_id, 'putaway', from_staged, prod.on_hand, prod.allocated, bin.id,
     p_qty || ' into ' || bin.code, auth.uid());

  return scan_result(true, 'success',
    product_label(prod) || ' into ' || bin.code || '. Bin now holds ' || in_bin || '.',
    jsonb_build_object('product_id', prod.id, 'label', product_label(prod),
                       'in_bin', in_bin, 'left', left_over - p_qty));
end $$;

-- ---------------------------------------------------------------------------
-- 6. Pick
-- ---------------------------------------------------------------------------
-- Paid orders waiting to be picked, and orders being picked, one row per order.
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
           count(*)::int, sum(o.quantity)::int, sum(o.picked_qty)::int, min(o.placed_at)
    from orders o join partners pa on pa.id = o.partner_id
    where o.location = p_location and o.status in ('Reserved', 'Picking')
    group by o.partner_id, o.order_ref, pa.business_name
    order by min(o.placed_at);
end $$;

create or replace function start_picking(p_partner uuid, p_order_ref text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  perform require_warehouse();
  perform set_config('bnp.stock_source', 'scan', true);
  update orders set status = 'Picking'
  where partner_id = p_partner and order_ref = p_order_ref and status = 'Reserved';
  get diagnostics n = row_count;
  perform set_config('bnp.stock_source', '', true);
  if n = 0 and not exists (select 1 from orders where partner_id = p_partner
                           and order_ref = p_order_ref and status = 'Picking') then
    return scan_result(false, 'error', 'This order is not waiting to be picked.');
  end if;
  return scan_result(true, 'success', 'Picking started. Scan the first bin.');
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
  from orders where partner_id = p_partner and order_ref = p_order_ref and status = 'Picking';

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

-- Takes back a unit picked by mistake. It joins the putaway queue.
create or replace function pick_undo(p_partner uuid, p_order_ref text, p_product uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  ln orders;
  prod products;
begin
  perform require_warehouse();
  select * into ln from orders
  where partner_id = p_partner and order_ref = p_order_ref and status = 'Picking'
    and product_id = p_product and picked_qty > 0
  order by created_at desc limit 1 for update;
  if ln.id is null then return scan_result(false, 'error', 'Nothing to take back.'); end if;
  select * into prod from products where id = p_product;

  perform set_config('bnp.stock_source', 'scan', true);
  update orders set picked_qty = picked_qty - 1 where id = ln.id returning * into ln;
  perform set_config('bnp.stock_source', '', true);
  insert into stock_movements
    (product_id, partner_id, movement, on_hand_change, on_hand_after, allocated_after,
     order_ref, note, actor_id)
  values
    (prod.id, prod.partner_id, 'adjustment', 0, prod.on_hand, prod.allocated, p_order_ref,
     'Pick taken back, waiting to be put away', auth.uid());

  return scan_result(true, 'success',
    'Took back 1 ' || product_label(prod) || '. Put it back in a bin from Putaway.',
    jsonb_build_object('product_id', p_product, 'picked', ln.picked_qty, 'quantity', ln.quantity,
                       'complete', false));
end $$;

-- ---------------------------------------------------------------------------
-- 7. Dispatch
-- ---------------------------------------------------------------------------
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
    from orders where partner_id = o.partner_id and order_ref = o.order_ref and status <> 'Cancelled';
    return scan_result(false, 'error', 'Not ready: picked ' || picking || ' of ' || units || '. Finish picking first.');
  end if;

  perform set_config('bnp.stock_source', 'scan', true);
  update orders set status = 'Dispatched'
  where partner_id = o.partner_id and order_ref = o.order_ref and status = 'Packed';
  perform set_config('bnp.stock_source', '', true);

  select coalesce(sum(quantity), 0) into units from orders
  where partner_id = o.partner_id and order_ref = o.order_ref and status = 'Dispatched';

  return scan_result(true, 'success',
    'Dispatched ' || o.order_ref || ' for ' || o.customer || ' (' || units || ' item' ||
      case when units = 1 then '' else 's' end || ', ' || o.rider || ').',
    jsonb_build_object('partner_id', o.partner_id, 'order_ref', o.order_ref));
end $$;

grant execute on function pick_list(warehouse_location) to authenticated;
grant execute on function start_picking(uuid, text) to authenticated;
grant execute on function pick_scan(uuid, text, uuid, text, int) to authenticated;
grant execute on function pick_undo(uuid, text, uuid) to authenticated;
grant execute on function dispatch_scan(text) to authenticated;
grant execute on function package_code(uuid, text) to authenticated;

commit;
