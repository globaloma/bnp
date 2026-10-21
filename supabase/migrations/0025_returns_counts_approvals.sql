-- Barcode pick-and-pack, phase 5: returns, cycle counts, supervisor approvals.
-- See "Barcode Pick-and-Pack Developer Brief" (Oct 13 2026).
--
--  * Supervisors: warehouse accounts an admin marks as supervisors (admins
--    count too). Every staff member has their own login, so every scan in
--    stock_movements says who did it.
--  * Returns: a returned parcel only puts stock back when it is scanned in.
--    Each item is inspected: good items wait to be put back in a bin; damaged
--    ones go to quarantine (products.quarantined), outside on-hand.
--  * Cycle counts: count a bin; a gap becomes an adjustment request.
--  * Manual stock changes: also a request. Requests change stock only when a
--    supervisor approves them, and the decision is logged.

begin;

-- ---------------------------------------------------------------------------
-- 1. Supervisors
-- ---------------------------------------------------------------------------
alter table partners add column if not exists is_supervisor boolean not null default false;

create or replace function is_supervisor() returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from partners p
    where p.id = auth.uid() and p.role = 'fulfillment_center' and p.is_supervisor and p.status = 'active'
  );
$$;

create or replace function admin_set_supervisor(p_partner uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin can change supervisors.'; end if;
  update partners set is_supervisor = p_on where id = p_partner and role = 'fulfillment_center';
  if not found then raise exception 'Supervisors must be warehouse accounts.'; end if;
end $$;

-- The movement log's bin columns, linked so the stock log can show bin codes.
do $$ begin
  alter table stock_movements add constraint stock_movements_from_bin_fkey
    foreign key (from_bin) references bins (id) on delete set null;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table stock_movements add constraint stock_movements_to_bin_fkey
    foreign key (to_bin) references bins (id) on delete set null;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2. Returns
-- ---------------------------------------------------------------------------
alter table products add column if not exists quarantined integer not null default 0
  check (quarantined >= 0);
alter table orders add column if not exists returned_qty integer not null default 0
  check (returned_qty >= 0);
alter table orders add column if not exists returned_damaged_qty integer not null default 0
  check (returned_damaged_qty >= 0);
do $$ begin
  alter table orders add constraint orders_returned_le_quantity
    check (returned_qty + returned_damaged_qty <= quantity);
exception when duplicate_object then null; end $$;

-- A Returned order no longer puts stock back by itself: the goods aren't in
-- the building until the return is scanned in. Returned now counts like
-- Dispatched; the return scan adds what actually came back.
create or replace function order_stock_effect(p_status order_status, p_qty int,
                                              out alloc int, out onhand int)
language sql immutable as $$
  select
    case when p_status in ('Reserved', 'Picking', 'Packed') then p_qty else 0 end,
    case when p_status in ('Dispatched', 'Delivered', 'Damaged', 'Returned') then -p_qty else 0 end;
$$;

-- Guards from 0024, plus: returned and quarantine counts only move by scan.
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
    if not trusted then new.on_hand := 0; new.staged := 0; new.quarantined := 0; end if;
    new.allocated := 0;
  else
    if not from_orders then new.allocated := old.allocated; end if;
    if source <> 'scan' then
      new.staged := old.staged;
      new.quarantined := old.quarantined;
    end if;
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
    new.returned_qty := 0;
    new.returned_damaged_qty := 0;
    if new.status in ('Picking', 'Packed', 'Dispatched') and not scan then
      raise exception 'New orders start as Created or Reserved.' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if not scan then
    new.picked_qty := old.picked_qty;
    new.returned_qty := old.returned_qty;
    new.returned_damaged_qty := old.returned_damaged_qty;
  end if;
  if new.status is distinct from old.status
     and new.status in ('Picking', 'Packed', 'Dispatched') and not scan and not is_admin() then
    raise exception 'Picking, Packed and Dispatched are set by the warehouse scan screens.'
      using errcode = 'P0001';
  end if;
  if new.status = 'Cancelled' and old.status <> 'Cancelled' then new.picked_qty := 0; end if;
  return new;
end $$;

-- Parcels that have left and can come back.
create or replace function return_lookup(p_code text)
returns table (order_id uuid, partner_id uuid, order_ref text, merchant text, customer text,
               product_id uuid, product text, barcode text, status order_status,
               quantity int, returned int, damaged int)
language plpgsql stable security definer set search_path = public as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
begin
  perform require_warehouse();
  return query
    select o.id, o.partner_id, o.order_ref, pa.business_name, o.customer_name,
           o.product_id, coalesce(product_label(pr), o.product_name), pr.barcode, o.status,
           o.quantity, o.returned_qty, o.returned_damaged_qty
    from orders o
    join partners pa on pa.id = o.partner_id
    left join products pr on pr.id = o.product_id
    where (pa.code || '-' || o.order_ref = v_code or o.order_ref = v_code)
      and o.status in ('Dispatched', 'Delivered', 'Returned', 'Damaged')
    order by o.created_at;
end $$;

create or replace function return_scan(p_partner uuid, p_order_ref text, p_code text,
                                       p_damaged boolean default false, p_qty int default 1)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  found_product record;
  prod products;
  ln orders;
  back int;
begin
  perform require_warehouse();
  if p_qty is null or p_qty < 1 or p_qty > 10000 then
    return scan_result(false, 'error', 'Quantity must be between 1 and 10,000.');
  end if;

  select * into found_product from find_scanned_product(p_code, p_partner);
  if found_product.product_id is null then
    return scan_result(false, 'error', 'Unknown barcode: ' || btrim(p_code));
  end if;
  select * into prod from products where id = found_product.product_id for update;

  select * into ln from orders
  where partner_id = p_partner and order_ref = p_order_ref and product_id = prod.id
    and status in ('Dispatched', 'Delivered', 'Returned', 'Damaged')
    and returned_qty + returned_damaged_qty < quantity
  order by created_at limit 1 for update;
  if ln.id is null then
    if exists (select 1 from orders where partner_id = p_partner and order_ref = p_order_ref
               and product_id = prod.id) then
      return scan_result(false, 'error', 'All of ' || product_label(prod) || ' on this order is already back.');
    end if;
    return scan_result(false, 'error', 'Wrong item: ' || product_label(prod) || ' is not on this order.');
  end if;
  if p_qty > ln.quantity - ln.returned_qty - ln.returned_damaged_qty then
    return scan_result(false, 'error', 'Too many: only ' ||
      (ln.quantity - ln.returned_qty - ln.returned_damaged_qty) || ' of ' || product_label(prod) || ' went out on this order.');
  end if;

  perform set_config('bnp.stock_source', 'scan', true);
  if p_damaged then
    update orders set returned_damaged_qty = returned_damaged_qty + p_qty where id = ln.id returning * into ln;
    update products set quarantined = quarantined + p_qty where id = prod.id returning * into prod;
  else
    update orders set returned_qty = returned_qty + p_qty where id = ln.id returning * into ln;
    update products set on_hand = on_hand + p_qty where id = prod.id returning * into prod;
  end if;
  back := ln.returned_qty + ln.returned_damaged_qty;
  -- The line is marked Returned once everything on it is back.
  if back = ln.quantity and ln.status <> 'Returned' then
    update orders set status = 'Returned' where id = ln.id;
  end if;
  perform set_config('bnp.stock_source', '', true);

  insert into stock_movements
    (product_id, partner_id, movement, on_hand_change, on_hand_after, allocated_after,
     order_ref, note, actor_id)
  values
    (prod.id, prod.partner_id, 'return', case when p_damaged then 0 else p_qty end,
     prod.on_hand, prod.allocated, p_order_ref,
     case when p_damaged then p_qty || ' damaged, to quarantine' else p_qty || ' good, to put away' end,
     auth.uid());

  return scan_result(true, case when p_damaged then 'warning' else 'success' end,
    case when p_damaged
      then product_label(prod) || ' to quarantine. ' || back || ' of ' || ln.quantity || ' back.'
      else product_label(prod) || ' back in stock. Put it away. ' || back || ' of ' || ln.quantity || ' back.' end,
    jsonb_build_object('product_id', prod.id, 'order_id', ln.id,
                       'returned', ln.returned_qty, 'damaged', ln.returned_damaged_qty));
end $$;

-- ---------------------------------------------------------------------------
-- 3. Stock adjustments: counts and manual changes, approved by a supervisor
-- ---------------------------------------------------------------------------
do $$ begin
  create type adjustment_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

create table if not exists stock_adjustments (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null check (kind in ('count', 'manual', 'quarantine')),
  product_id     uuid not null references products (id) on delete cascade,
  partner_id     uuid not null references partners (id) on delete cascade,
  bin_id         uuid references bins (id) on delete set null,
  -- count: what the system expected in the bin and what was counted.
  expected_qty   integer,
  counted_qty    integer check (counted_qty is null or counted_qty >= 0),
  -- change to on-hand (count, manual) or to quarantine (quarantine kind).
  change         integer not null,
  -- quarantine kind: true sends the units back to stock, false writes them off.
  to_stock       boolean not null default false,
  reason         text not null check (length(reason) between 1 and 500),
  status         adjustment_status not null default 'pending',
  requested_by   uuid not null,
  requested_at   timestamptz not null default now(),
  decided_by     uuid,
  decided_at     timestamptz,
  decision_note  text check (decision_note is null or length(decision_note) <= 500)
);
alter table stock_adjustments add column if not exists to_stock boolean not null default false;
create index if not exists stock_adjustments_status_idx on stock_adjustments (status, requested_at desc);

alter table stock_adjustments enable row level security;
drop policy if exists "stock_adjustments read" on stock_adjustments;
create policy "stock_adjustments read" on stock_adjustments
  for select using (is_fulfillment_center() or is_admin());

create table if not exists bin_counts (
  id           uuid primary key default gen_random_uuid(),
  bin_id       uuid not null references bins (id) on delete cascade,
  product_id   uuid references products (id) on delete set null,
  expected_qty integer not null,
  counted_qty  integer not null check (counted_qty >= 0),
  adjustment_id uuid references stock_adjustments (id) on delete set null,
  counted_by   uuid not null,
  counted_at   timestamptz not null default now()
);
create index if not exists bin_counts_bin_idx on bin_counts (bin_id, counted_at desc);
alter table bin_counts enable row level security;
drop policy if exists "bin_counts read" on bin_counts;
create policy "bin_counts read" on bin_counts
  for select using (is_fulfillment_center() or is_admin());

-- Records a count of one bin. A gap becomes a pending adjustment.
create or replace function submit_bin_count(p_bin uuid, p_counted int, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  bin bins;
  held bin_stock;
  prod products;
  expected int;
  adj uuid;
begin
  perform require_warehouse();
  if p_counted is null or p_counted < 0 or p_counted > 1000000 then
    return scan_result(false, 'error', 'Enter the number you counted.');
  end if;
  select * into bin from bins where id = p_bin;
  if bin.id is null then return scan_result(false, 'error', 'Bin not found.'); end if;
  select * into held from bin_stock where bin_id = bin.id;
  expected := coalesce(held.quantity, 0);
  if held.bin_id is not null then select * into prod from products where id = held.product_id; end if;

  if p_counted <> expected and prod.id is null then
    return scan_result(false, 'error',
      'Bin ' || bin.code || ' should be empty. Put those items away from the Putaway screen.');
  end if;
  if exists (select 1 from stock_adjustments where bin_id = bin.id and status = 'pending' and kind = 'count') then
    return scan_result(false, 'error', 'Bin ' || bin.code || ' already has a count waiting for a supervisor.');
  end if;

  if p_counted <> expected then
    insert into stock_adjustments
      (kind, product_id, partner_id, bin_id, expected_qty, counted_qty, change, reason, requested_by)
    values
      ('count', prod.id, prod.partner_id, bin.id, expected, p_counted, p_counted - expected,
       coalesce(nullif(btrim(coalesce(p_note, '')), ''), 'Cycle count of ' || bin.code),
       auth.uid())
    returning id into adj;
  end if;

  insert into bin_counts (bin_id, product_id, expected_qty, counted_qty, adjustment_id, counted_by)
  values (bin.id, prod.id, expected, p_counted, adj, auth.uid());

  if adj is null then
    return scan_result(true, 'success', 'Bin ' || bin.code || ' matches: ' || expected || '.');
  end if;
  return scan_result(true, 'warning',
    'Gap in ' || bin.code || ': system says ' || expected || ', counted ' || p_counted ||
    '. Sent to a supervisor to approve.',
    jsonb_build_object('adjustment_id', adj));
end $$;

-- A manual change to on-hand (found, lost, damaged in the warehouse), or a
-- quarantine decision (back to stock or written off).
drop function if exists request_adjustment(uuid, int, text, text);
create or replace function request_adjustment(p_product uuid, p_change int, p_reason text,
                                              p_kind text default 'manual', p_to_stock boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  prod products;
  adj uuid;
begin
  perform require_warehouse();
  if p_kind not in ('manual', 'quarantine') then raise exception 'Unknown adjustment.'; end if;
  if p_change is null or p_change = 0 or abs(p_change) > 1000000 then
    return scan_result(false, 'error', 'Enter how many units to add or remove.');
  end if;
  if length(btrim(coalesce(p_reason, ''))) = 0 then
    return scan_result(false, 'error', 'Give a reason so the supervisor knows what happened.');
  end if;
  select * into prod from products where id = p_product;
  if prod.id is null then return scan_result(false, 'error', 'Product not found.'); end if;
  if p_kind = 'quarantine' and (p_change > 0 or -p_change > prod.quarantined) then
    return scan_result(false, 'error', 'Only ' || prod.quarantined || ' in quarantine.');
  end if;
  insert into stock_adjustments (kind, product_id, partner_id, change, to_stock, reason, requested_by)
  values (p_kind, prod.id, prod.partner_id, p_change, p_kind = 'quarantine' and p_to_stock,
          left(btrim(p_reason), 500), auth.uid())
  returning id into adj;
  return scan_result(true, 'success', 'Sent to a supervisor to approve.',
    jsonb_build_object('adjustment_id', adj));
end $$;

-- quarantine kind: change is negative (units leaving quarantine); to_stock
-- on the request says whether they go back to on-hand or are written off.
drop function if exists decide_adjustment(uuid, boolean, text, boolean);
create or replace function decide_adjustment(p_adjustment uuid, p_approve boolean,
                                             p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a stock_adjustments;
  prod products;
  bin_code text;
  delta_onhand int := 0;
begin
  if not is_supervisor() then
    return scan_result(false, 'error', 'Only a supervisor can approve stock changes.');
  end if;
  select * into a from stock_adjustments where id = p_adjustment for update;
  if a.id is null then return scan_result(false, 'error', 'Request not found.'); end if;
  if a.status <> 'pending' then return scan_result(false, 'error', 'Already ' || a.status || '.'); end if;

  if not p_approve then
    update stock_adjustments
    set status = 'rejected', decided_by = auth.uid(), decided_at = now(),
        decision_note = nullif(btrim(coalesce(p_note, '')), '')
    where id = a.id;
    return scan_result(true, 'success', 'Rejected. Stock is unchanged.');
  end if;

  select * into prod from products where id = a.product_id for update;
  perform set_config('bnp.stock_source', 'scan', true);

  if a.kind = 'count' then
    -- The bin may have changed since the count; apply the counted number.
    select b.code into bin_code from bins b where b.id = a.bin_id;
    update bin_stock set quantity = a.counted_qty, updated_at = now()
    where bin_id = a.bin_id and product_id = a.product_id;
    delta_onhand := a.change;
  elsif a.kind = 'manual' then
    delta_onhand := a.change;
  else
    if -a.change > prod.quarantined then
      perform set_config('bnp.stock_source', '', true);
      return scan_result(false, 'error', 'Only ' || prod.quarantined || ' left in quarantine.');
    end if;
    update products set quarantined = quarantined + a.change where id = prod.id returning * into prod;
    if a.to_stock then delta_onhand := -a.change; end if;
  end if;

  if prod.on_hand + delta_onhand < 0 then
    perform set_config('bnp.stock_source', '', true);
    return scan_result(false, 'error', 'That would take on-hand below zero.');
  end if;
  update products set on_hand = on_hand + delta_onhand where id = prod.id returning * into prod;
  perform set_config('bnp.stock_source', '', true);

  update stock_adjustments
  set status = 'approved', decided_by = auth.uid(), decided_at = now(),
      decision_note = nullif(btrim(coalesce(p_note, '')), '')
  where id = a.id;

  insert into stock_movements
    (product_id, partner_id, movement, on_hand_change, on_hand_after, allocated_after,
     from_bin, note, actor_id)
  values
    (prod.id, prod.partner_id, 'adjustment', delta_onhand, prod.on_hand, prod.allocated, a.bin_id,
     case a.kind
       when 'count' then 'Count of ' || coalesce(bin_code, 'bin') || ' approved: ' || a.expected_qty || ' to ' || a.counted_qty
       when 'manual' then 'Approved change: ' || a.reason
       else case when a.to_stock then 'Back to stock from quarantine' else 'Written off from quarantine' end
     end,
     auth.uid());

  return scan_result(true, 'success',
    case when prod.on_hand < prod.allocated
      then 'Approved. On-hand is now below what open orders need; check those orders.'
      else 'Approved. Stock updated.' end);
end $$;

grant execute on function is_supervisor() to authenticated;
grant execute on function admin_set_supervisor(uuid, boolean) to authenticated;
grant execute on function return_lookup(text) to authenticated;
grant execute on function return_scan(uuid, text, text, boolean, int) to authenticated;
grant execute on function submit_bin_count(uuid, int, text) to authenticated;
grant execute on function request_adjustment(uuid, int, text, text, boolean) to authenticated;
grant execute on function decide_adjustment(uuid, boolean, text) to authenticated;

commit;
