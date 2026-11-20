-- Enterprise Plan v2 (BNP_Enterprise_Plan_Website_Spec_v2.docx).
--
-- The flat 9%-of-sales Enterprise model is scrapped. Enterprise becomes a
-- custom, consultation-based plan:
--   * Each Enterprise merchant has a per-client RATE CARD (enterprise_rates),
--     set by admin after the consultation. Every amount is nullable = "TBC".
--   * Charges are collected by ADMIN-REVIEWED MONTHLY INVOICES, not automatic
--     wallet deductions. The monthly run builds ONE 'pending' invoice per
--     Enterprise merchant with itemised invoice_lines; admin adds/edits/removes
--     lines, then finalises (pending -> unpaid) which notifies the merchant.
--   * Storage is billed by pallet OR cubic metre, computed from live inventory
--     and each SKU's carton/pallet dimensions at month end.
--
-- Standard is untouched: its invoice (storage + 7% of delivered goods) still
-- runs exactly as in 0028/0029.
--
-- Additive and idempotent. Safe to re-run.

begin;

-- ---------------------------------------------------------------------------
-- 1. Per-merchant Enterprise rate card
-- ---------------------------------------------------------------------------
create table if not exists enterprise_rates (
  partner_id              uuid primary key references partners (id) on delete cascade,
  annual_subscription     numeric(14,2),
  storage_basis           text not null default 'pallet' check (storage_basis in ('pallet', 'm3')),
  storage_rate            numeric(14,2),
  month1_discount_pct     numeric(5,2) not null default 20 check (month1_discount_pct between 0 and 100),
  month1_done             boolean not null default false,
  pickpack_first          numeric(14,2),
  pickpack_additional     numeric(14,2),
  intake_tier_override    boolean not null default false,
  intake_flat             numeric(14,2),
  handling_container      numeric(14,2),
  kitting_enabled         boolean not null default false,
  kitting_simple          numeric(14,2),
  kitting_standard        numeric(14,2),
  kitting_complex         numeric(14,2),
  returns_enabled         boolean not null default false,
  returns_processing      numeric(14,2),
  returns_disposal        numeric(14,2),
  cod_enabled             boolean not null default false,
  cod_rate                numeric(14,2),
  special_projects_enabled boolean not null default false,
  special_projects_hr     numeric(14,2),
  insurance_rate          numeric(6,4) not null default 0.0025,
  updated_at              timestamptz not null default now()
);
alter table enterprise_rates enable row level security;
drop policy if exists "enterprise_rates read" on enterprise_rates;
create policy "enterprise_rates read" on enterprise_rates
  for select using (partner_id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------------
-- 2. Global Enterprise defaults + intake tiers (feed the public calculator
--    and seed a new client's rate card). Live on the billing_settings single row.
-- ---------------------------------------------------------------------------
alter table billing_settings add column if not exists ent_annual_subscription numeric(14,2);
alter table billing_settings add column if not exists ent_storage_pallet_rate numeric(14,2);
alter table billing_settings add column if not exists ent_storage_m3_rate     numeric(14,2);
alter table billing_settings add column if not exists ent_pickpack_first      numeric(14,2);
alter table billing_settings add column if not exists ent_pickpack_additional numeric(14,2);
alter table billing_settings add column if not exists ent_kitting_simple      numeric(14,2);
alter table billing_settings add column if not exists ent_kitting_standard    numeric(14,2);
alter table billing_settings add column if not exists ent_kitting_complex     numeric(14,2);
alter table billing_settings add column if not exists ent_returns_processing  numeric(14,2);
alter table billing_settings add column if not exists ent_returns_disposal    numeric(14,2);
alter table billing_settings add column if not exists ent_cod_rate            numeric(14,2);
alter table billing_settings add column if not exists ent_special_projects_hr numeric(14,2);
alter table billing_settings add column if not exists ent_insurance_rate      numeric(6,4) not null default 0.0025;
-- Intake (first shipment): 1..free_max units free, then four fixed unit bands.
alter table billing_settings add column if not exists ent_intake_free_max     integer not null default 200;
alter table billing_settings add column if not exists ent_intake_b1           numeric(14,2); -- (free_max+1) .. 300
alter table billing_settings add column if not exists ent_intake_b2           numeric(14,2); -- 301 .. 500
alter table billing_settings add column if not exists ent_intake_b3           numeric(14,2); -- 501 .. 1000
alter table billing_settings add column if not exists ent_intake_b4           numeric(14,2); -- 1001+
-- Restock (every subsequent inbound shipment): its own cheaper schedule, no free band.
alter table billing_settings add column if not exists ent_restock_b0          numeric(14,2); -- 1 .. 200
alter table billing_settings add column if not exists ent_restock_b1          numeric(14,2); -- 201 .. 300
alter table billing_settings add column if not exists ent_restock_b2          numeric(14,2); -- 301 .. 500
alter table billing_settings add column if not exists ent_restock_b3          numeric(14,2); -- 501 .. 1000
alter table billing_settings add column if not exists ent_restock_b4          numeric(14,2); -- 1001+
-- Container unload & floor setup, charged on top of intake/restock when a shipment
-- arrives in a container requiring unloading (added by admin at review time).
alter table billing_settings add column if not exists ent_handling_container  numeric(14,2);

-- Seed the global Enterprise defaults from the published fee schedule. coalesce
-- keeps any amount an admin has already set, so this stays safe to re-run.
update billing_settings set
  ent_annual_subscription = coalesce(ent_annual_subscription, 105000),
  ent_storage_pallet_rate = coalesce(ent_storage_pallet_rate, 65000),
  ent_pickpack_first      = coalesce(ent_pickpack_first, 5600),
  ent_pickpack_additional = coalesce(ent_pickpack_additional, 800),
  ent_insurance_rate      = coalesce(ent_insurance_rate, 0.0025),
  ent_intake_b1           = coalesce(ent_intake_b1, 60000),
  ent_intake_b2           = coalesce(ent_intake_b2, 85000),
  ent_intake_b3           = coalesce(ent_intake_b3, 105000),
  ent_intake_b4           = coalesce(ent_intake_b4, 130000),
  ent_restock_b0          = coalesce(ent_restock_b0, 10000),
  ent_restock_b1          = coalesce(ent_restock_b1, 15000),
  ent_restock_b2          = coalesce(ent_restock_b2, 21250),
  ent_restock_b3          = coalesce(ent_restock_b3, 26250),
  ent_restock_b4          = coalesce(ent_restock_b4, 32500),
  ent_handling_container  = coalesce(ent_handling_container, 98500)
where id;

-- ---------------------------------------------------------------------------
-- 3. SKU configuration for storage billing (spec Part 3.3)
-- ---------------------------------------------------------------------------
alter table products add column if not exists units_per_carton  integer check (units_per_carton is null or units_per_carton > 0);
alter table products add column if not exists cartons_per_pallet integer check (cartons_per_pallet is null or cartons_per_pallet > 0);
alter table products add column if not exists carton_l_cm       numeric(8,2) check (carton_l_cm is null or carton_l_cm >= 0);
alter table products add column if not exists carton_w_cm       numeric(8,2) check (carton_w_cm is null or carton_w_cm >= 0);
alter table products add column if not exists carton_h_cm       numeric(8,2) check (carton_h_cm is null or carton_h_cm >= 0);
alter table products add column if not exists carton_weight_kg  numeric(10,3) check (carton_weight_kg is null or carton_weight_kg >= 0);
alter table products add column if not exists storage_conditions text check (storage_conditions is null or length(storage_conditions) <= 120);

-- ---------------------------------------------------------------------------
-- 4. Invoices: a 'pending' review state + itemised lines for Enterprise
-- ---------------------------------------------------------------------------
alter table invoices drop constraint if exists invoices_status_check;
alter table invoices add constraint invoices_status_check
  check (status in ('pending', 'unpaid', 'paid', 'void'));
-- True when the invoice detail lives in invoice_lines (Enterprise). Standard
-- invoices keep their fixed storage/fulfillment/delivery columns.
alter table invoices add column if not exists itemized boolean not null default false;

create table if not exists invoice_lines (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references invoices (id) on delete cascade,
  kind        text not null,
  label       text not null,
  quantity    numeric(16,2),
  unit_rate   numeric(16,4),
  amount      numeric(14,2) not null default 0,
  source      text not null default 'auto' check (source in ('auto', 'manual')),
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists invoice_lines_invoice_idx on invoice_lines (invoice_id, sort);
alter table invoice_lines enable row level security;
drop policy if exists "invoice_lines read" on invoice_lines;
create policy "invoice_lines read" on invoice_lines for select using (
  exists (select 1 from invoices i where i.id = invoice_id and (i.partner_id = auth.uid() or is_admin()))
);

-- Seed a rate-card row for every existing Enterprise merchant from the defaults.
insert into enterprise_rates (partner_id)
select p.id from partners p
where p.role = 'merchant' and p.plan_type = 'enterprise'
on conflict (partner_id) do nothing;

-- ---------------------------------------------------------------------------
-- 5. Storage snapshot: live inventory -> pallets or m³ -> charge (spec Part 3.2)
-- ---------------------------------------------------------------------------
create or replace function enterprise_storage_snapshot(p_partner uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  r enterprise_rates;
  s billing_settings;
  basis text;
  rate numeric;
  qty numeric := 0;
begin
  select * into r from enterprise_rates where partner_id = p_partner;
  select * into s from billing_settings;
  basis := coalesce(r.storage_basis, 'pallet');
  if basis = 'm3' then
    rate := coalesce(r.storage_rate, s.ent_storage_m3_rate);
    -- Volume per carton (m³) × remaining cartons, summed across SKUs, round up 2dp.
    select coalesce(ceil(sum(
             (coalesce(carton_l_cm,0) * coalesce(carton_w_cm,0) * coalesce(carton_h_cm,0) / 1000000.0)
             * ceil(on_hand::numeric / nullif(units_per_carton,0))
           ) * 100) / 100, 0)
      into qty
      from products
     where partner_id = p_partner and on_hand > 0 and units_per_carton is not null;
  else
    rate := coalesce(r.storage_rate, s.ent_storage_pallet_rate);
    -- cartons -> pallets, rounded up per SKU, summed.
    select coalesce(sum(
             ceil( ceil(on_hand::numeric / nullif(units_per_carton,0)) / nullif(cartons_per_pallet,0) )
           ), 0)
      into qty
      from products
     where partner_id = p_partner and on_hand > 0
       and units_per_carton is not null and cartons_per_pallet is not null;
  end if;

  return jsonb_build_object(
    'basis', basis,
    'quantity', coalesce(qty, 0),
    'rate', rate,                       -- may be null when TBC
    'month1_pct', case when r.month1_done then 0 else coalesce(r.month1_discount_pct, 0) end
  );
end $$;
revoke all on function enterprise_storage_snapshot(uuid) from public, anon, authenticated;

-- Intake fee for the FIRST shipment of p_units: free up to free_max, then four
-- fixed unit bands (fee schedule §3a).
create or replace function enterprise_intake_fee(p_units integer)
returns numeric language sql stable security definer set search_path = public as $$
  select case
    when p_units <= (select ent_intake_free_max from billing_settings) then 0
    when p_units <= 300  then coalesce((select ent_intake_b1 from billing_settings), 0)
    when p_units <= 500  then coalesce((select ent_intake_b2 from billing_settings), 0)
    when p_units <= 1000 then coalesce((select ent_intake_b3 from billing_settings), 0)
    else coalesce((select ent_intake_b4 from billing_settings), 0)
  end;
$$;
revoke all on function enterprise_intake_fee(integer) from public, anon, authenticated;

-- Restock fee for every SUBSEQUENT shipment of p_units: a separate, cheaper
-- schedule with no free band (fee schedule §3b).
create or replace function enterprise_restock_fee(p_units integer)
returns numeric language sql stable security definer set search_path = public as $$
  select case
    when p_units <= 0    then 0
    when p_units <= 200  then coalesce((select ent_restock_b0 from billing_settings), 0)
    when p_units <= 300  then coalesce((select ent_restock_b1 from billing_settings), 0)
    when p_units <= 500  then coalesce((select ent_restock_b2 from billing_settings), 0)
    when p_units <= 1000 then coalesce((select ent_restock_b3 from billing_settings), 0)
    else coalesce((select ent_restock_b4 from billing_settings), 0)
  end;
$$;
revoke all on function enterprise_restock_fee(integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Build one PENDING, itemised invoice for an Enterprise merchant
-- ---------------------------------------------------------------------------
create or replace function build_enterprise_invoice(p_partner uuid, p_period date)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  p partners;
  r enterprise_rates;
  s billing_settings;
  inv invoices;
  start_ts timestamptz;
  end_ts timestamptz;
  snap jsonb;
  storage_gross numeric;
  storage_amt numeric;
  disc_pct numeric;
  stock_value numeric;
  insurance_amt numeric;
  order_count integer;
  unit_count integer;
  addl_count integer;
  returns_count integer;
  disposal_count integer;
  delivery_amt numeric;
  sort_n integer := 0;
  d record;
begin
  select * into p from partners where id = p_partner;
  if p.id is null or p.plan_type <> 'enterprise' then return null; end if;
  -- One invoice per partner/period.
  if exists (select 1 from invoices where partner_id = p_partner and period = p_period) then
    return (select id from invoices where partner_id = p_partner and period = p_period);
  end if;
  select * into r from enterprise_rates where partner_id = p_partner;
  if r.partner_id is null then
    insert into enterprise_rates (partner_id) values (p_partner)
    on conflict (partner_id) do nothing;
    select * into r from enterprise_rates where partner_id = p_partner;
  end if;
  select * into s from billing_settings;
  start_ts := (p_period::timestamp at time zone 'Africa/Lagos');
  end_ts := ((p_period + interval '1 month')::timestamp at time zone 'Africa/Lagos');

  -- Create the shell invoice in 'pending'. Legacy numeric columns are zeroed;
  -- real detail lives in invoice_lines. due_at is a placeholder until finalise.
  insert into invoices (partner_id, period, storage_sqm, storage_amount, sales_value,
                        fulfillment_rate, fulfillment_amount, delivery_amount, total,
                        status, itemized, due_at)
  values (p_partner, p_period, 0, 0, 0, 0, 0, 0, 0,
          'pending', true, now() + make_interval(days => s.grace_days))
  returning * into inv;

  -- Storage ------------------------------------------------------------------
  snap := enterprise_storage_snapshot(p_partner);
  disc_pct := coalesce((snap->>'month1_pct')::numeric, 0);
  storage_gross := round(coalesce((snap->>'quantity')::numeric, 0) * coalesce((snap->>'rate')::numeric, 0), 2);
  storage_amt := round(storage_gross * (1 - disc_pct / 100.0), 2);
  sort_n := sort_n + 1;
  insert into invoice_lines (invoice_id, kind, label, quantity, unit_rate, amount, source, sort)
  values (inv.id, 'storage',
          'Storage (' || (snap->>'quantity') || ' ' || (case when snap->>'basis' = 'm3' then 'm³' else 'pallet(s)' end)
            || case when disc_pct > 0 then ', month-1 ' || disc_pct || '% off' else '' end || ')',
          (snap->>'quantity')::numeric, (snap->>'rate')::numeric, storage_amt, 'auto', sort_n);
  -- Month-1 discount is a one-off; mark it used so later months bill in full.
  if disc_pct > 0 then update enterprise_rates set month1_done = true where partner_id = p_partner; end if;

  -- Insurance -----------------------------------------------------------------
  select coalesce(sum(on_hand * coalesce(declared_value, 0)), 0) into stock_value
    from products where partner_id = p_partner;
  insurance_amt := round(stock_value * coalesce(r.insurance_rate, s.ent_insurance_rate, 0.0025), 2);
  sort_n := sort_n + 1;
  insert into invoice_lines (invoice_id, kind, label, quantity, unit_rate, amount, source, sort)
  values (inv.id, 'insurance',
          'Insurance (' || round(coalesce(r.insurance_rate, 0.0025) * 100, 2) || '% of ₦'
            || to_char(stock_value, 'FM999,999,999,990') || ' declared value)',
          stock_value, coalesce(r.insurance_rate, 0.0025), insurance_amt, 'auto', sort_n);

  -- Pick & pack (orders delivered in the month; grouped by order_ref) ----------
  select count(distinct order_ref), coalesce(sum(quantity), 0)
    into order_count, unit_count
    from orders
   where partner_id = p_partner and delivered_at >= start_ts and delivered_at < end_ts;
  addl_count := greatest(0, coalesce(unit_count, 0) - coalesce(order_count, 0));
  sort_n := sort_n + 1;
  insert into invoice_lines (invoice_id, kind, label, quantity, unit_rate, amount, source, sort)
  values (inv.id, 'pickpack_first', 'Pick & pack — first item (' || order_count || ' orders)',
          order_count, r.pickpack_first, round(order_count * coalesce(r.pickpack_first, 0), 2), 'auto', sort_n);
  sort_n := sort_n + 1;
  insert into invoice_lines (invoice_id, kind, label, quantity, unit_rate, amount, source, sort)
  values (inv.id, 'pickpack_additional', 'Pick & pack — additional items (' || addl_count || ')',
          addl_count, r.pickpack_additional, round(addl_count * coalesce(r.pickpack_additional, 0), 2), 'auto', sort_n);

  -- Intake / restock (inbound deliveries received in the month) ----------------
  for d in
    select id.id as del_id, coalesce(sum(idl.received_qty), 0)::integer as units,
           (not exists (select 1 from inbound_deliveries e
                        where e.partner_id = p_partner and e.status = 'received'
                          and e.received_at < start_ts)) as is_first
      from inbound_deliveries id
      left join inbound_delivery_lines idl on idl.delivery_id = id.id
     where id.partner_id = p_partner and id.status = 'received'
       and id.received_at >= start_ts and id.received_at < end_ts
     group by id.id, id.received_at
  loop
    sort_n := sort_n + 1;
    insert into invoice_lines (invoice_id, kind, label, quantity, unit_rate, amount, source, sort)
    values (inv.id, 'intake',
            case when d.is_first then 'Intake' else 'Restock' end || ' (' || d.units || ' units)',
            d.units, null,
            case
              when r.intake_tier_override then coalesce(r.intake_flat, 0)
              when d.is_first then enterprise_intake_fee(d.units)
              else enterprise_restock_fee(d.units)
            end,
            'auto', sort_n);
  end loop;

  -- Returns (only if enabled on the rate card) --------------------------------
  if r.returns_enabled then
    select count(*)::integer, coalesce(sum(returned_damaged_qty), 0)::integer
      into returns_count, disposal_count
      from orders
     where partner_id = p_partner and status in ('Returned', 'Damaged')
       and updated_at >= start_ts and updated_at < end_ts;
    sort_n := sort_n + 1;
    insert into invoice_lines (invoice_id, kind, label, quantity, unit_rate, amount, source, sort)
    values (inv.id, 'returns', 'Returns processing (' || returns_count || ')',
            returns_count, r.returns_processing, round(returns_count * coalesce(r.returns_processing, 0), 2), 'auto', sort_n);
    if disposal_count > 0 then
      sort_n := sort_n + 1;
      insert into invoice_lines (invoice_id, kind, label, quantity, unit_rate, amount, source, sort)
      values (inv.id, 'returns_disposal', 'Returns — disposal (' || disposal_count || ' units)',
              disposal_count, r.returns_disposal, round(disposal_count * coalesce(r.returns_disposal, 0), 2), 'auto', sort_n);
    end if;
  end if;

  -- Delivery (BNP-fronted carrier cost, dispatched in month, at cost) ----------
  select coalesce(sum(delivery_fee), 0) into delivery_amt
    from orders
   where partner_id = p_partner and delivery_billed_to = 'merchant'
     and coalesce(delivery_fee, 0) > 0
     and dispatched_at >= start_ts and dispatched_at < end_ts;
  if delivery_amt > 0 then
    sort_n := sort_n + 1;
    insert into invoice_lines (invoice_id, kind, label, quantity, unit_rate, amount, source, sort)
    values (inv.id, 'delivery', 'Delivery (carrier cost, no markup)', null, null, delivery_amt, 'auto', sort_n);
  end if;

  -- Annual subscription (only in the account's anniversary month) --------------
  if extract(month from p_period) = extract(month from (p.created_at at time zone 'Africa/Lagos'))
     and coalesce(r.annual_subscription, 0) > 0 then
    sort_n := sort_n + 1;
    insert into invoice_lines (invoice_id, kind, label, quantity, unit_rate, amount, source, sort)
    values (inv.id, 'subscription', 'Annual subscription', 1, r.annual_subscription,
            round(r.annual_subscription, 2), 'auto', sort_n);
  end if;

  -- Roll the lines into the invoice total.
  update invoices set total = (select coalesce(sum(amount), 0) from invoice_lines where invoice_id = inv.id)
   where id = inv.id;

  return inv.id;
end $$;
revoke all on function build_enterprise_invoice(uuid, date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Rewrite the monthly run: Standard unchanged; Enterprise -> pending invoice
-- ---------------------------------------------------------------------------
create or replace function run_monthly_billing(p_period date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s billing_settings;
  p partners;
  sales numeric;
  storage numeric;
  fee numeric;
  inv invoices;
  invoiced int := 0;
  pending int := 0;
  month_end timestamptz;
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
    if p.plan_type = 'standard' then
      if exists (select 1 from invoices where partner_id = p.id and period = p_period) then continue; end if;
      storage := round(p.storage_sqm * s.storage_rate, 2);
      select coalesce(sum(line_goods_value(o)), 0) into sales
      from orders o
      where o.partner_id = p.id
        and o.delivered_at >= (p_period::timestamp at time zone 'Africa/Lagos')
        and o.delivered_at < month_end
        and not exists (select 1 from billing_charges c where c.order_line_id = o.id);
      fee := round(sales * s.standard_rate, 2);
      if storage + fee <= 0 then continue; end if;
      insert into invoices (partner_id, period, storage_sqm, storage_amount, sales_value,
                            fulfillment_rate, fulfillment_amount, total, due_at)
      values (p.id, p_period, p.storage_sqm, storage, sales, s.standard_rate, fee, storage + fee,
              now() + make_interval(days => s.grace_days))
      returning * into inv;
      insert into billing_notices (partner_id, kind, payload)
      values (p.id, 'invoice_issued', jsonb_build_object('invoice_id', inv.id, 'number', inv.number,
              'total', inv.total, 'due_at', inv.due_at, 'period', p_period));
      invoiced := invoiced + 1;
    else
      -- Enterprise: build a pending invoice for admin review (no wallet charge).
      if exists (select 1 from invoices where partner_id = p.id and period = p_period) then continue; end if;
      perform build_enterprise_invoice(p.id, p_period);
      pending := pending + 1;
    end if;
  end loop;

  return jsonb_build_object('period', p_period, 'invoices', invoiced, 'pending_enterprise', pending, 'charges', 0);
end $$;
revoke all on function run_monthly_billing(date) from public, anon, authenticated;
grant execute on function run_monthly_billing(date) to service_role;

-- ---------------------------------------------------------------------------
-- 8. Scrap the 9%: the per-delivered-order fulfillment fee no longer fires.
-- ---------------------------------------------------------------------------
create or replace function orders_fulfillment_fee() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Enterprise is now billed by monthly invoice, not a 9% wallet deduction.
  -- Kept as a no-op so the trigger and any dependents stay valid.
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- 9. Admin RPCs: rate card, defaults, invoice line editing, finalise
-- ---------------------------------------------------------------------------
create or replace function admin_set_enterprise_rates(p_partner uuid, p jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin can set rates.'; end if;
  if not exists (select 1 from partners where id = p_partner and role = 'merchant') then
    raise exception 'Merchant not found.';
  end if;
  insert into enterprise_rates (partner_id) values (p_partner) on conflict (partner_id) do nothing;
  update enterprise_rates set
    annual_subscription      = (p->>'annual_subscription')::numeric,
    storage_basis            = coalesce(nullif(p->>'storage_basis',''), storage_basis),
    storage_rate             = (p->>'storage_rate')::numeric,
    month1_discount_pct      = coalesce((p->>'month1_discount_pct')::numeric, month1_discount_pct),
    pickpack_first           = (p->>'pickpack_first')::numeric,
    pickpack_additional      = (p->>'pickpack_additional')::numeric,
    intake_tier_override     = coalesce((p->>'intake_tier_override')::boolean, false),
    intake_flat              = (p->>'intake_flat')::numeric,
    handling_container       = (p->>'handling_container')::numeric,
    kitting_enabled          = coalesce((p->>'kitting_enabled')::boolean, false),
    kitting_simple           = (p->>'kitting_simple')::numeric,
    kitting_standard         = (p->>'kitting_standard')::numeric,
    kitting_complex          = (p->>'kitting_complex')::numeric,
    returns_enabled          = coalesce((p->>'returns_enabled')::boolean, false),
    returns_processing       = (p->>'returns_processing')::numeric,
    returns_disposal         = (p->>'returns_disposal')::numeric,
    cod_enabled              = coalesce((p->>'cod_enabled')::boolean, false),
    cod_rate                 = (p->>'cod_rate')::numeric,
    special_projects_enabled = coalesce((p->>'special_projects_enabled')::boolean, false),
    special_projects_hr      = (p->>'special_projects_hr')::numeric,
    insurance_rate           = coalesce((p->>'insurance_rate')::numeric, insurance_rate),
    updated_at               = now()
  where partner_id = p_partner;
end $$;
grant execute on function admin_set_enterprise_rates(uuid, jsonb) to authenticated;

create or replace function admin_set_enterprise_defaults(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin can set defaults.'; end if;
  update billing_settings set
    ent_annual_subscription = (p->>'ent_annual_subscription')::numeric,
    ent_storage_pallet_rate = (p->>'ent_storage_pallet_rate')::numeric,
    ent_storage_m3_rate     = (p->>'ent_storage_m3_rate')::numeric,
    ent_pickpack_first      = (p->>'ent_pickpack_first')::numeric,
    ent_pickpack_additional = (p->>'ent_pickpack_additional')::numeric,
    ent_kitting_simple      = (p->>'ent_kitting_simple')::numeric,
    ent_kitting_standard    = (p->>'ent_kitting_standard')::numeric,
    ent_kitting_complex     = (p->>'ent_kitting_complex')::numeric,
    ent_returns_processing  = (p->>'ent_returns_processing')::numeric,
    ent_returns_disposal    = (p->>'ent_returns_disposal')::numeric,
    ent_cod_rate            = (p->>'ent_cod_rate')::numeric,
    ent_special_projects_hr = (p->>'ent_special_projects_hr')::numeric,
    ent_insurance_rate      = coalesce((p->>'ent_insurance_rate')::numeric, ent_insurance_rate),
    ent_intake_free_max     = coalesce((p->>'ent_intake_free_max')::integer, ent_intake_free_max),
    ent_intake_b1           = (p->>'ent_intake_b1')::numeric,
    ent_intake_b2           = (p->>'ent_intake_b2')::numeric,
    ent_intake_b3           = (p->>'ent_intake_b3')::numeric,
    ent_intake_b4           = (p->>'ent_intake_b4')::numeric,
    ent_restock_b0          = (p->>'ent_restock_b0')::numeric,
    ent_restock_b1          = (p->>'ent_restock_b1')::numeric,
    ent_restock_b2          = (p->>'ent_restock_b2')::numeric,
    ent_restock_b3          = (p->>'ent_restock_b3')::numeric,
    ent_restock_b4          = (p->>'ent_restock_b4')::numeric,
    ent_handling_container  = (p->>'ent_handling_container')::numeric
  where id;
end $$;
grant execute on function admin_set_enterprise_defaults(jsonb) to authenticated;

create or replace function admin_build_enterprise_invoice(p_partner uuid, p_period date)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin can build invoices.'; end if;
  return build_enterprise_invoice(p_partner, p_period);
end $$;
grant execute on function admin_build_enterprise_invoice(uuid, date) to authenticated;

create or replace function admin_upsert_invoice_line(
  p_line uuid, p_invoice uuid, p_kind text, p_label text,
  p_quantity numeric, p_unit_rate numeric, p_amount numeric
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  inv invoices;
  line_id uuid;
begin
  if not is_admin() then raise exception 'Only an admin can edit invoice lines.'; end if;
  if p_line is not null then
    select i.* into inv from invoices i join invoice_lines l on l.invoice_id = i.id where l.id = p_line;
  else
    select * into inv from invoices where id = p_invoice;
  end if;
  if inv.id is null then raise exception 'Invoice not found.'; end if;
  if inv.status <> 'pending' then raise exception 'Only a pending invoice can be edited.'; end if;
  if p_line is not null then
    update invoice_lines set
      kind = coalesce(nullif(btrim(p_kind), ''), kind),
      label = coalesce(nullif(btrim(p_label), ''), label),
      quantity = p_quantity, unit_rate = p_unit_rate, amount = round(coalesce(p_amount, 0), 2)
    where id = p_line returning id into line_id;
  else
    insert into invoice_lines (invoice_id, kind, label, quantity, unit_rate, amount, source,
                               sort)
    values (inv.id, coalesce(nullif(btrim(p_kind), ''), 'other'), coalesce(nullif(btrim(p_label), ''), 'Line item'),
            p_quantity, p_unit_rate, round(coalesce(p_amount, 0), 2), 'manual',
            coalesce((select max(sort) + 1 from invoice_lines where invoice_id = inv.id), 1))
    returning id into line_id;
  end if;
  update invoices set total = (select coalesce(sum(amount), 0) from invoice_lines where invoice_id = inv.id)
   where id = inv.id;
  return line_id;
end $$;
grant execute on function admin_upsert_invoice_line(uuid, uuid, text, text, numeric, numeric, numeric) to authenticated;

create or replace function admin_remove_invoice_line(p_line uuid)
returns void language plpgsql security definer set search_path = public as $$
declare inv invoices;
begin
  if not is_admin() then raise exception 'Only an admin can remove invoice lines.'; end if;
  select i.* into inv from invoices i join invoice_lines l on l.invoice_id = i.id where l.id = p_line;
  if inv.id is null then raise exception 'Line not found.'; end if;
  if inv.status <> 'pending' then raise exception 'Only a pending invoice can be edited.'; end if;
  delete from invoice_lines where id = p_line;
  update invoices set total = (select coalesce(sum(amount), 0) from invoice_lines where invoice_id = inv.id)
   where id = inv.id;
end $$;
grant execute on function admin_remove_invoice_line(uuid) to authenticated;

-- Finalise: pending -> unpaid, set the due date, notify the merchant.
create or replace function admin_finalize_invoice(p_invoice uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  inv invoices;
  s billing_settings;
begin
  if not is_admin() then raise exception 'Only an admin can finalise invoices.'; end if;
  select * into inv from invoices where id = p_invoice for update;
  if inv.id is null then raise exception 'Invoice not found.'; end if;
  if inv.status <> 'pending' then raise exception 'This invoice is already %.', inv.status; end if;
  select * into s from billing_settings;
  update invoices set status = 'unpaid',
                      total = (select coalesce(sum(amount), 0) from invoice_lines where invoice_id = inv.id),
                      issued_at = now(),
                      due_at = now() + make_interval(days => s.grace_days)
   where id = inv.id;
  insert into billing_notices (partner_id, kind, payload)
  values (inv.partner_id, 'invoice_issued', jsonb_build_object('invoice_id', inv.id, 'number', inv.number,
          'total', (select total from invoices where id = inv.id), 'due_at', now() + make_interval(days => s.grace_days),
          'period', inv.period));
end $$;
grant execute on function admin_finalize_invoice(uuid) to authenticated;

commit;
