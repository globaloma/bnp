-- ---------------------------------------------------------------------------
-- Standard Plan: storage billed per crate, not per m².
--
-- Until now Standard storage was storage_sqm × storage_rate (₦10,000/m²), where
-- a crate rolled up to 0.25 m² (migration 0035), i.e. ₦2,500 a crate. Standard
-- now bills a flat rate PER CRATE: ₦5,000 each, i.e. ₦10,000 per 2 crates of the
-- 530 × 290 × 370mm box. Any pallet space a Standard merchant has keeps billing
-- on the per-m² storage_rate, so bulky goods are unchanged.
--
--   standard storage = crates × std_crate_rate
--                    + (storage_sqm − crates × crate_m2) × storage_rate
--
-- The second term is the pallet share of the recorded space (crates contribute
-- crates × crate_m2 to storage_sqm; the rest is pallets, with stack height
-- already folded in). Enterprise storage (migration 0038) is untouched. The
-- space model (set_storage_space, crate_m2, pallet_m2) is unchanged: storage_sqm
-- still records the physical footprint; only how Standard turns it into money
-- changes. The TS mirror lives in src/lib/storage.ts (standardStorageAmount).
-- ---------------------------------------------------------------------------

begin;

-- 1. Per-crate rate (₦10,000 per 2 crates = ₦5,000 each).
alter table billing_settings add column if not exists std_crate_rate numeric(14,2) not null default 5000
  check (std_crate_rate >= 0);

-- 2. Monthly billing: only the Standard storage line changes (from 0041).
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
      -- Standard storage: ₦5,000 per crate (std_crate_rate; ₦10,000 per 2 crates
      -- of 530×290×370mm), with any pallet space still billed on the m² rate.
      storage := round(
        p.storage_crates * s.std_crate_rate
        + greatest(0, p.storage_sqm - p.storage_crates * s.crate_m2) * s.storage_rate,
        2);
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
