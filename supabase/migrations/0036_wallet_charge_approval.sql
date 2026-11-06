-- Merchant approval for wallet deductions.
--
--  Until now the Enterprise wallet was debited automatically. The big periodic
--  charges (monthly STORAGE and INSURANCE) now land as PENDING and only leave
--  the wallet once the merchant APPROVES them, or after a grace window, when
--  they auto-apply. Per-order delivery and fulfillment fees are unchanged: they
--  are tied to live dispatch/delivery and stay automatic.

begin;

-- ---------------------------------------------------------------------------
-- 1. Settings and charge status
-- ---------------------------------------------------------------------------
alter table billing_settings add column if not exists approval_grace_days integer not null default 7
  check (approval_grace_days >= 0);

alter table billing_charges add column if not exists status text not null default 'applied'
  check (status in ('pending', 'applied', 'auto_applied', 'cancelled'));
alter table billing_charges add column if not exists approved_at timestamptz;
alter table billing_charges add column if not exists auto_apply_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. Monthly billing: Enterprise storage + insurance become pending
-- ---------------------------------------------------------------------------
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
  v_auto timestamptz;
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
  v_auto := now() + make_interval(days => s.approval_grace_days);

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
      -- Storage: created as pending; the merchant approves it (or it auto-applies).
      if storage > 0 and not exists (select 1 from billing_charges where partner_id = p.id
                                      and kind = 'storage' and period = p_period) then
        insert into billing_charges (partner_id, kind, period, basis, rate, amount, note, status, auto_apply_at)
        values (p.id, 'storage', p_period, p.storage_sqm, s.storage_rate, storage,
                'Storage, ' || p.storage_sqm || ' m², ' || to_char(p_period, 'FMMonth YYYY'), 'pending', v_auto);
        storage_done := storage;
        charged := charged + 1;
      end if;

      -- Stock value now, at the start of the month, stands for month-end.
      select coalesce(sum(pr.on_hand * coalesce(pr.declared_value, 0)), 0) into stock_value
      from products pr where pr.partner_id = p.id;
      insurance := round(stock_value * s.insurance_rate, 2);
      if insurance > 0 and not exists (select 1 from billing_charges where partner_id = p.id
                                       and kind = 'insurance' and period = p_period) then
        insert into billing_charges (partner_id, kind, period, basis, rate, amount, note, status, auto_apply_at)
        values (p.id, 'insurance', p_period, stock_value, s.insurance_rate, insurance,
                'Insurance on ₦' || to_char(stock_value, 'FM999,999,999,990') || ' of stock', 'pending', v_auto);
        insurance_done := insurance;
        charged := charged + 1;
      end if;
      -- Only when this run created charges, so a re-run doesn't email again.
      if storage_done > 0 or insurance_done > 0 then
        insert into billing_notices (partner_id, kind, payload)
        values (p.id, 'charges_pending', jsonb_build_object('period', p_period, 'storage', storage_done,
                'insurance', insurance_done, 'stock_value', stock_value, 'auto_apply_at', v_auto));
      end if;
    end if;
  end loop;

  return jsonb_build_object('period', p_period, 'invoices', invoiced, 'charges', charged);
end $$;
revoke all on function run_monthly_billing(date) from public, anon, authenticated;
grant execute on function run_monthly_billing(date) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Approve a pending charge (the merchant), or auto-apply overdue ones (cron)
-- ---------------------------------------------------------------------------
create or replace function approve_charge(p_charge uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  c billing_charges;
begin
  select * into c from billing_charges where id = p_charge for update;
  if c.id is null then raise exception 'Charge not found.'; end if;
  if c.partner_id <> auth.uid() and not is_admin() then raise exception 'That is not your charge.'; end if;
  if c.status <> 'pending' then raise exception 'This charge is not awaiting approval.'; end if;
  update billing_charges set status = 'applied', approved_at = now() where id = p_charge;
  perform charge_wallet(c.partner_id, c.amount, coalesce(c.note, 'Charge'));
  perform check_wallet_floor(c.partner_id);
end $$;
grant execute on function approve_charge(uuid) to authenticated;

create or replace function apply_due_charges()
returns integer language plpgsql security definer set search_path = public as $$
declare
  c billing_charges;
  n int := 0;
begin
  for c in select * from billing_charges
           where status = 'pending' and auto_apply_at is not null and auto_apply_at <= now()
           for update loop
    update billing_charges set status = 'auto_applied', approved_at = now() where id = c.id;
    perform charge_wallet(c.partner_id, c.amount, coalesce(c.note, 'Charge'));
    perform check_wallet_floor(c.partner_id);
    insert into billing_notices (partner_id, kind, payload)
    values (c.partner_id, 'charge_auto_applied',
            jsonb_build_object('charge_id', c.id, 'amount', c.amount, 'note', c.note, 'kind', c.kind));
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function apply_due_charges() from public, anon, authenticated;
grant execute on function apply_due_charges() to service_role;

-- The daily cron also applies any pending charges past their grace window.
create or replace function billing_daily()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  result jsonb := '{}'::jsonb;
  last_month date := (lagos_month() - interval '1 month')::date;
begin
  if billing_started(last_month) then
    result := run_monthly_billing(last_month);
    result := result || jsonb_build_object('wallet_locked', lock_unfunded_wallets(last_month));
  end if;
  result := result || jsonb_build_object('auto_applied', apply_due_charges());
  return result || jsonb_build_object('locked', lock_overdue_accounts());
end $$;
revoke all on function billing_daily() from public, anon, authenticated;
grant execute on function billing_daily() to service_role;

commit;
