-- ---------------------------------------------------------------------------
-- Standard Plan: optional Restock Fee add-on.
--
-- A Standard merchant can have a restock fee switched on by admin (off by
-- default). When it is on, every SUBSEQUENT inbound shipment, i.e. any received
-- delivery that is not the merchant's first-ever intake, that brings in more
-- than a unit threshold adds a flat fee to that month's Standard invoice.
--
-- The amount and threshold live on billing_settings so admin can change them
-- (default: ₦100,000 per restock shipment over 200 units). Nothing changes for
-- merchants who do not have the add-on switched on.
--
-- Mirrors how Enterprise bills intake/restock (migration 0038), but Standard
-- keeps its single fixed-column invoice, so the restock total rides on a new
-- invoices.restock_amount column rather than itemised invoice_lines.
--
-- Additive and idempotent. Safe to re-run.
-- ---------------------------------------------------------------------------

begin;

-- 1. Per-merchant toggle.
alter table partners add column if not exists standard_restock_enabled boolean not null default false;

-- 2. Global rate: the flat fee and the unit threshold above which it applies.
alter table billing_settings add column if not exists std_restock_fee       numeric(14,2) not null default 100000;
alter table billing_settings add column if not exists std_restock_threshold integer       not null default 200;

-- 3. Standard invoices gain a restock line amount (part of the total).
alter table invoices add column if not exists restock_amount numeric(14,2) not null default 0;

-- 4. Standard restock fee for a shipment of p_units: the flat fee when the
--    shipment is over the threshold, otherwise nothing.
create or replace function standard_restock_fee(p_units integer)
returns numeric language sql stable as $$
  select case
    when coalesce(p_units, 0) > (select std_restock_threshold from billing_settings)
      then (select std_restock_fee from billing_settings)
    else 0
  end;
$$;
revoke all on function standard_restock_fee(integer) from public, anon, authenticated;

-- 5. Admin switches a Standard merchant's restock add-on on or off.
create or replace function admin_set_standard_restock(p_partner uuid, p_enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin can change this.'; end if;
  update partners set standard_restock_enabled = coalesce(p_enabled, false)
   where id = p_partner and role = 'merchant' and plan_type = 'standard';
end $$;
revoke all on function admin_set_standard_restock(uuid, boolean) from public, anon;
grant execute on function admin_set_standard_restock(uuid, boolean) to authenticated;

-- 6. Monthly billing, with the Standard restock fee folded into the invoice.
--    Based on the version in 0038; only the Standard branch changes.
create or replace function run_monthly_billing(p_period date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s billing_settings;
  p partners;
  sales numeric;
  storage numeric;
  fee numeric;
  restock numeric;
  inv invoices;
  invoiced int := 0;
  pending int := 0;
  start_ts timestamptz;
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
  start_ts := (p_period::timestamp at time zone 'Africa/Lagos');
  month_end := ((p_period + interval '1 month')::timestamp at time zone 'Africa/Lagos');

  for p in select * from partners where role = 'merchant' and status = 'active' loop
    if p.plan_type = 'standard' then
      if exists (select 1 from invoices where partner_id = p.id and period = p_period) then continue; end if;
      storage := round(p.storage_sqm * s.storage_rate, 2);
      select coalesce(sum(line_goods_value(o)), 0) into sales
      from orders o
      where o.partner_id = p.id
        and o.delivered_at >= start_ts
        and o.delivered_at < month_end
        and not exists (select 1 from billing_charges c where c.order_line_id = o.id);
      fee := round(sales * s.standard_rate, 2);

      -- Restock: each received shipment this month that is not the first-ever
      -- intake and clears the unit threshold, only when the add-on is on.
      restock := 0;
      if p.standard_restock_enabled then
        select coalesce(sum(standard_restock_fee(shipment.units)), 0) into restock
        from (
          select coalesce(sum(idl.received_qty), 0)::integer as units
          from inbound_deliveries d
          left join inbound_delivery_lines idl on idl.delivery_id = d.id
          where d.partner_id = p.id and d.status = 'received'
            and d.received_at >= start_ts and d.received_at < month_end
            and exists (
              select 1 from inbound_deliveries e
              where e.partner_id = p.id and e.status = 'received' and e.received_at < d.received_at
            )
          group by d.id
        ) shipment;
      end if;

      if storage + fee + restock <= 0 then continue; end if;
      insert into invoices (partner_id, period, storage_sqm, storage_amount, sales_value,
                            fulfillment_rate, fulfillment_amount, restock_amount, total, due_at)
      values (p.id, p_period, p.storage_sqm, storage, sales, s.standard_rate, fee, restock,
              storage + fee + restock, now() + make_interval(days => s.grace_days))
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

commit;
