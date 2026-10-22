-- Plan-based billing (Technical Specification v2, sections 2 to 5 and 9).
--
--  Standard:   on the 1st, one invoice for last month: storage (m² set by the
--              warehouse x ₦10,000) + 7% of goods delivered. 3 days to pay
--              (wallet or Paystack); after that new orders and new stock
--              deliveries pause until it's paid.
--  Enterprise: a pre-funded wallet. Storage and 0.25% insurance (on declared
--              stock value) are deducted on the 1st; 9% of each order is
--              deducted when it's delivered. If the wallet falls to the
--              agreed minimum, the warehouse stops picking and dispatching
--              that merchant's orders until it's topped up.
--
-- Billing starts with November 2026 (first run on 1 December).
-- "Goods value" of an order line = subtotal - discount (no VAT, no delivery).
-- Emails go out from the app, which reads billing_notices.
--
-- Run without a single wrapping transaction: the new wallet entry type has
-- to be committed before it can be used.

alter type wallet_txn_type add value if not exists 'Adjustment';

begin;

-- ---------------------------------------------------------------------------
-- 1. Settings and account fields
-- ---------------------------------------------------------------------------
create table if not exists billing_settings (
  id                     boolean primary key default true check (id),
  start_month            date not null default '2026-11-01',
  storage_rate           numeric(12,2) not null default 10000,
  standard_rate          numeric(6,4) not null default 0.07,
  enterprise_rate        numeric(6,4) not null default 0.09,
  insurance_rate         numeric(6,4) not null default 0.0025,
  grace_days             integer not null default 3,
  -- Warn Enterprise merchants when the wallet is within this share above the minimum.
  low_balance_margin     numeric(4,2) not null default 0.20
);
insert into billing_settings (id) values (true) on conflict (id) do nothing;
alter table billing_settings enable row level security;
drop policy if exists "billing_settings read" on billing_settings;
create policy "billing_settings read" on billing_settings for select using (auth.uid() is not null);

alter table partners add column if not exists storage_sqm numeric(10,2) not null default 0
  check (storage_sqm >= 0);
alter table partners add column if not exists account_manager text
  check (account_manager is null or length(account_manager) <= 200);
-- Standard: an invoice is overdue. Enterprise: wallet at or below the minimum.
alter table partners add column if not exists billing_locked boolean not null default false;
alter table partners add column if not exists orders_paused boolean not null default false;
-- Last Enterprise balance alert sent, so each level only emails once.
alter table partners add column if not exists wallet_alert text not null default 'ok'
  check (wallet_alert in ('ok', 'low', 'floor'));

-- Declared value per unit, for insurance and stock valuation. Merchants set
-- it once; after that only an admin-approved request changes it.
alter table products add column if not exists declared_value numeric(14,2)
  check (declared_value is null or declared_value >= 0);
alter table products add column if not exists declared_value_locked_at timestamptz;

alter table orders add column if not exists delivered_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. Records
-- ---------------------------------------------------------------------------
create sequence if not exists invoice_number_seq;

create table if not exists invoices (
  id                uuid primary key default gen_random_uuid(),
  number            text not null unique default 'INV-' || lpad(nextval('invoice_number_seq')::text, 5, '0'),
  partner_id        uuid not null references partners (id) on delete cascade,
  period            date not null,
  storage_sqm       numeric(10,2) not null,
  storage_amount    numeric(14,2) not null,
  sales_value       numeric(14,2) not null,
  fulfillment_rate  numeric(6,4) not null,
  fulfillment_amount numeric(14,2) not null,
  total             numeric(14,2) not null,
  status            text not null default 'unpaid' check (status in ('unpaid', 'paid', 'void')),
  issued_at         timestamptz not null default now(),
  due_at            timestamptz not null,
  paid_at           timestamptz,
  paid_via          text check (paid_via in ('wallet', 'paystack', 'admin')),
  payment_ref       text,
  note              text,
  unique (partner_id, period)
);
create index if not exists invoices_unpaid_idx on invoices (due_at) where status = 'unpaid';

-- Enterprise deductions, one row each.
create table if not exists billing_charges (
  id             uuid primary key default gen_random_uuid(),
  partner_id     uuid not null references partners (id) on delete cascade,
  kind           text not null check (kind in ('storage', 'insurance', 'fulfillment', 'adjustment')),
  period         date,
  order_line_id  uuid unique references orders (id) on delete set null,
  order_ref      text,
  basis          numeric(16,2),
  rate           numeric(14,4),
  amount         numeric(14,2) not null,
  note           text,
  created_by     uuid,
  created_at     timestamptz not null default now()
);
alter table billing_charges alter column rate type numeric(14,4);
create unique index if not exists billing_charges_monthly_key
  on billing_charges (partner_id, kind, period) where kind in ('storage', 'insurance');

create table if not exists declared_value_requests (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references products (id) on delete cascade,
  partner_id      uuid not null references partners (id) on delete cascade,
  old_value       numeric(14,2),
  requested_value numeric(14,2) not null check (requested_value >= 0),
  reason          text not null check (length(reason) between 3 and 500),
  status          text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at    timestamptz not null default now(),
  reviewed_by     uuid,
  reviewed_at     timestamptz,
  admin_notes     text check (admin_notes is null or length(admin_notes) <= 500)
);

-- Emails waiting to be sent by the app.
create table if not exists billing_notices (
  id          uuid primary key default gen_random_uuid(),
  partner_id  uuid not null references partners (id) on delete cascade,
  kind        text not null,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
create index if not exists billing_notices_unsent_idx on billing_notices (created_at) where sent_at is null;

alter table invoices enable row level security;
alter table billing_charges enable row level security;
alter table declared_value_requests enable row level security;
alter table billing_notices enable row level security;

drop policy if exists "invoices read" on invoices;
create policy "invoices read" on invoices for select using (partner_id = auth.uid() or is_admin());
drop policy if exists "billing_charges read" on billing_charges;
create policy "billing_charges read" on billing_charges for select using (partner_id = auth.uid() or is_admin());
drop policy if exists "declared_value_requests read" on declared_value_requests;
create policy "declared_value_requests read" on declared_value_requests
  for select using (partner_id = auth.uid() or is_admin());
-- billing_notices: no policies; only the server (service role) reads them.

-- ---------------------------------------------------------------------------
-- 3. Helpers
-- ---------------------------------------------------------------------------
create or replace function lagos_month(p_at timestamptz default now()) returns date
language sql stable as $$
  select date_trunc('month', p_at at time zone 'Africa/Lagos')::date;
$$;

create or replace function billing_started(p_period date) returns boolean
language sql stable security definer set search_path = public as $$
  select p_period >= (select start_month from billing_settings);
$$;

create or replace function line_goods_value(o orders) returns numeric
language sql immutable as $$
  select greatest(0, coalesce(o.subtotal, 0) - coalesce(o.discount_amount, 0));
$$;

-- Debits a wallet for a charge the merchant owes. Unlike a withdrawal it
-- may take the balance below the minimum (or below zero): the charge is
-- owed either way, and the minimum check pauses orders.
create or replace function charge_wallet(p_partner uuid, p_amount numeric, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_amount is null or p_amount <= 0 then return; end if;
  update partners set wallet_balance = wallet_balance - p_amount where id = p_partner;
  insert into wallet_transactions (partner_id, type, amount, note)
  values (p_partner, 'Deduction', -p_amount, p_note);
end $$;

-- Enterprise minimum balance: pause or resume orders and queue alerts.
create or replace function check_wallet_floor(p_partner uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  p partners;
  margin numeric := (select low_balance_margin from billing_settings);
  level text;
begin
  select * into p from partners where id = p_partner for update;
  if p.id is null or p.plan_type <> 'enterprise' then
    if p.orders_paused then update partners set orders_paused = false, wallet_alert = 'ok' where id = p_partner; end if;
    return;
  end if;

  level := case
    when p.wallet_balance <= p.wallet_buffer and p.wallet_buffer > 0 then 'floor'
    when p.wallet_buffer > 0 and p.wallet_balance <= p.wallet_buffer * (1 + margin) then 'low'
    else 'ok' end;

  if level = 'floor' and not p.orders_paused then
    update partners set orders_paused = true, wallet_alert = 'floor' where id = p_partner;
    insert into billing_notices (partner_id, kind, payload)
    values (p_partner, 'orders_paused', jsonb_build_object('balance', p.wallet_balance, 'minimum', p.wallet_buffer));
  elsif level <> 'floor' and p.orders_paused then
    update partners set orders_paused = false, wallet_alert = level where id = p_partner;
    insert into billing_notices (partner_id, kind, payload)
    values (p_partner, 'orders_resumed', jsonb_build_object('balance', p.wallet_balance, 'minimum', p.wallet_buffer));
  elsif level = 'low' and p.wallet_alert = 'ok' then
    update partners set wallet_alert = 'low' where id = p_partner;
    insert into billing_notices (partner_id, kind, payload)
    values (p_partner, 'wallet_low', jsonb_build_object('balance', p.wallet_balance, 'minimum', p.wallet_buffer));
  elsif level = 'ok' and p.wallet_alert <> 'ok' then
    update partners set wallet_alert = 'ok' where id = p_partner;
  end if;
end $$;

revoke all on function charge_wallet(uuid, numeric, text) from public, anon, authenticated;
revoke all on function check_wallet_floor(uuid) from public, anon, authenticated;

-- Top-ups (and any other credit) re-check the minimum so orders resume.
create or replace function wallet_credit(
  p_partner_id uuid,
  p_amount numeric,
  p_type wallet_txn_type,
  p_note text default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Credit amount must be greater than zero';
  end if;
  update partners set wallet_balance = wallet_balance + p_amount where id = p_partner_id;
  if not found then raise exception 'No partner found for that id'; end if;
  insert into wallet_transactions (partner_id, type, amount, note)
  values (p_partner_id, p_type, p_amount, p_note);
  perform check_wallet_floor(p_partner_id);
end $$;

-- ---------------------------------------------------------------------------
-- 4. Enterprise: 9% when an order is delivered
-- ---------------------------------------------------------------------------
create or replace function orders_billing() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'Delivered' and (tg_op = 'INSERT' or old.status is distinct from 'Delivered') then
    new.delivered_at := coalesce(new.delivered_at, now());
  end if;
  return new;
end $$;

drop trigger if exists orders_billing on orders;
create trigger orders_billing before insert or update of status on orders
  for each row execute function orders_billing();

create or replace function orders_fulfillment_fee() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p partners;
  s billing_settings;
  fee numeric;
begin
  if new.status <> 'Delivered' or (tg_op = 'UPDATE' and old.status = 'Delivered') then return null; end if;
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

drop trigger if exists orders_fulfillment_fee on orders;
create trigger orders_fulfillment_fee after insert or update of status on orders
  for each row execute function orders_fulfillment_fee();

-- ---------------------------------------------------------------------------
-- 5. Monthly run (1st of the month) and the daily overdue check
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

-- Locks Standard accounts whose invoice is past due.
create or replace function lock_overdue_accounts()
returns integer language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select distinct i.partner_id from invoices i join partners p on p.id = i.partner_id
    where i.status = 'unpaid' and i.due_at < now() and not p.billing_locked
  loop
    update partners set billing_locked = true where id = r.partner_id;
    insert into billing_notices (partner_id, kind, payload)
    select r.partner_id, 'account_locked',
           jsonb_build_object('total', sum(total), 'count', count(*))
    from invoices where partner_id = r.partner_id and status = 'unpaid';
    n := n + 1;
  end loop;
  return n;
end $$;

-- What the daily job calls. Safe to run more than once a day.
create or replace function billing_daily()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  result jsonb := '{}'::jsonb;
  last_month date := (lagos_month() - interval '1 month')::date;
begin
  if billing_started(last_month) then
    result := run_monthly_billing(last_month);
  end if;
  return result || jsonb_build_object('locked', lock_overdue_accounts());
end $$;

revoke all on function run_monthly_billing(date) from public, anon, authenticated;
revoke all on function lock_overdue_accounts() from public, anon, authenticated;
revoke all on function billing_daily() from public, anon, authenticated;
grant execute on function billing_daily() to service_role;
grant execute on function run_monthly_billing(date) to service_role;

-- ---------------------------------------------------------------------------
-- 6. Paying invoices
-- ---------------------------------------------------------------------------
create or replace function mark_invoice_paid(p_invoice uuid, p_via text, p_ref text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  inv invoices;
begin
  select * into inv from invoices where id = p_invoice for update;
  if inv.id is null or inv.status <> 'unpaid' then return; end if;
  update invoices set status = 'paid', paid_at = now(), paid_via = p_via, payment_ref = p_ref where id = inv.id;
  insert into billing_notices (partner_id, kind, payload)
  values (inv.partner_id, 'invoice_paid', jsonb_build_object('number', inv.number, 'total', inv.total));
  -- Unlock once nothing overdue is left.
  if not exists (select 1 from invoices where partner_id = inv.partner_id and status = 'unpaid' and due_at < now()) then
    update partners set billing_locked = false where id = inv.partner_id and billing_locked;
  end if;
end $$;
revoke all on function mark_invoice_paid(uuid, text, text) from public, anon, authenticated;
grant execute on function mark_invoice_paid(uuid, text, text) to service_role;

create or replace function pay_invoice_from_wallet(p_invoice uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  inv invoices;
  bal numeric;
begin
  select * into inv from invoices where id = p_invoice and partner_id = auth.uid() for update;
  if inv.id is null then raise exception 'Invoice not found.'; end if;
  if inv.status <> 'unpaid' then raise exception 'This invoice is already %.', inv.status; end if;
  select wallet_balance into bal from partners where id = auth.uid() for update;
  if bal < inv.total then
    raise exception 'Your wallet has ₦% but this invoice is ₦%. Top up or pay by card.',
      to_char(bal, 'FM999,999,990'), to_char(inv.total, 'FM999,999,990');
  end if;
  perform charge_wallet(auth.uid(), inv.total, 'Invoice ' || inv.number);
  perform mark_invoice_paid(inv.id, 'wallet', null);
  return jsonb_build_object('number', inv.number);
end $$;
grant execute on function pay_invoice_from_wallet(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Admin and warehouse controls
-- ---------------------------------------------------------------------------
create or replace function set_storage_sqm(p_partner uuid, p_sqm numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform require_warehouse();
  if p_sqm is null or p_sqm < 0 or p_sqm > 100000 then raise exception 'Enter the floor space in m².'; end if;
  update partners set storage_sqm = round(p_sqm, 2) where id = p_partner and role = 'merchant';
  if not found then raise exception 'Merchant not found.'; end if;
end $$;
grant execute on function set_storage_sqm(uuid, numeric) to authenticated;

create or replace function admin_set_enterprise_terms(p_partner uuid, p_minimum numeric, p_manager text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin can change this.'; end if;
  if p_minimum is null or p_minimum < 0 then raise exception 'Enter the minimum balance.'; end if;
  update partners set wallet_buffer = round(p_minimum, 2),
                      account_manager = nullif(btrim(coalesce(p_manager, '')), '')
  where id = p_partner and role = 'merchant';
  if not found then raise exception 'Merchant not found.'; end if;
  perform check_wallet_floor(p_partner);
end $$;
grant execute on function admin_set_enterprise_terms(uuid, numeric, text) to authenticated;

-- Manual credit (positive) or debit (negative), always with a reason.
create or replace function admin_wallet_adjust(p_partner uuid, p_amount numeric, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin can adjust wallets.'; end if;
  if p_amount is null or p_amount = 0 then raise exception 'Enter an amount.'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'Give a reason.'; end if;
  if p_amount > 0 then
    perform wallet_credit(p_partner, p_amount, 'Adjustment', btrim(p_reason));
  else
    update partners set wallet_balance = wallet_balance + p_amount where id = p_partner;
    insert into wallet_transactions (partner_id, type, amount, note)
    values (p_partner, 'Adjustment', p_amount, btrim(p_reason));
    perform check_wallet_floor(p_partner);
  end if;
  insert into billing_charges (partner_id, kind, amount, note, created_by)
  values (p_partner, 'adjustment', -p_amount, btrim(p_reason), auth.uid());
end $$;
grant execute on function admin_wallet_adjust(uuid, numeric, text) to authenticated;

create or replace function admin_invoice_action(p_invoice uuid, p_action text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  inv invoices;
begin
  if not is_admin() then raise exception 'Only an admin can change invoices.'; end if;
  select * into inv from invoices where id = p_invoice for update;
  if inv.id is null then raise exception 'Invoice not found.'; end if;
  if p_action = 'paid' then
    perform mark_invoice_paid(inv.id, 'admin', nullif(btrim(coalesce(p_note, '')), ''));
  elsif p_action = 'void' then
    if inv.status <> 'unpaid' then raise exception 'Only unpaid invoices can be voided.'; end if;
    update invoices set status = 'void', note = nullif(btrim(coalesce(p_note, '')), '') where id = inv.id;
    if not exists (select 1 from invoices where partner_id = inv.partner_id and status = 'unpaid' and due_at < now()) then
      update partners set billing_locked = false where id = inv.partner_id and billing_locked;
    end if;
  else
    raise exception 'Unknown action.';
  end if;
end $$;
grant execute on function admin_invoice_action(uuid, text, text) to authenticated;

-- Runs the monthly billing for a given month from the admin console.
create or replace function admin_run_billing(p_period date)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin can run billing.'; end if;
  return run_monthly_billing(p_period) || jsonb_build_object('locked', lock_overdue_accounts());
end $$;
grant execute on function admin_run_billing(date) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Declared values: set once, then change only by approved request
-- ---------------------------------------------------------------------------
create or replace function products_declared_value_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.declared_value is not null then new.declared_value_locked_at := now(); end if;
    return new;
  end if;
  if new.declared_value is distinct from old.declared_value then
    if old.declared_value is not null
       and coalesce(current_setting('bnp.declared_value', true), '') <> 'approved' then
      raise exception 'The declared value is locked. Ask for a change instead.' using errcode = 'P0001';
    end if;
    new.declared_value_locked_at := now();
  end if;
  return new;
end $$;

drop trigger if exists products_declared_value_guard on products;
create trigger products_declared_value_guard before insert or update of declared_value on products
  for each row execute function products_declared_value_guard();

create or replace function request_declared_value(p_product uuid, p_value numeric, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  prod products;
begin
  select * into prod from products where id = p_product and partner_id = auth.uid();
  if prod.id is null then raise exception 'Product not found.'; end if;
  if p_value is null or p_value < 0 then raise exception 'Enter the value per unit.'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'Give a reason for the change.'; end if;
  if prod.declared_value is null then raise exception 'Set the value on the product form; it isn''t locked yet.'; end if;
  if exists (select 1 from declared_value_requests where product_id = p_product and status = 'pending') then
    raise exception 'There is already a change waiting for review.';
  end if;
  insert into declared_value_requests (product_id, partner_id, old_value, requested_value, reason)
  values (p_product, auth.uid(), prod.declared_value, round(p_value, 2), btrim(p_reason));
end $$;
grant execute on function request_declared_value(uuid, numeric, text) to authenticated;

create or replace function admin_decide_declared_value(p_request uuid, p_approve boolean, p_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  r declared_value_requests;
begin
  if not is_admin() then raise exception 'Only an admin can review this.'; end if;
  select * into r from declared_value_requests where id = p_request for update;
  if r.id is null or r.status <> 'pending' then raise exception 'Request not found or already decided.'; end if;
  if p_approve then
    perform set_config('bnp.declared_value', 'approved', true);
    update products set declared_value = r.requested_value where id = r.product_id;
    perform set_config('bnp.declared_value', '', true);
  end if;
  update declared_value_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      reviewed_by = auth.uid(), reviewed_at = now(),
      admin_notes = nullif(btrim(coalesce(p_notes, '')), '')
  where id = r.id;
  insert into billing_notices (partner_id, kind, payload)
  values (r.partner_id, 'declared_value_decided', jsonb_build_object(
    'approved', p_approve, 'value', r.requested_value, 'notes', p_notes,
    'product', (select name || coalesce(' (' || variant || ')', '') from products where id = r.product_id)));
end $$;
grant execute on function admin_decide_declared_value(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Locks and pauses take effect
-- ---------------------------------------------------------------------------
-- Standard, overdue invoice: no new orders (any channel) and no new stock.
create or replace function orders_billing_lock() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from partners where id = new.partner_id and billing_locked) then
    raise exception 'This account is paused until an overdue invoice is paid.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists orders_billing_lock on orders;
create trigger orders_billing_lock before insert on orders
  for each row execute function orders_billing_lock();

create or replace function inbound_billing_lock() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.announced and exists (select 1 from partners where id = new.partner_id and billing_locked) then
    raise exception 'This account is paused until an overdue invoice is paid.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists inbound_billing_lock on inbound_deliveries;
create trigger inbound_billing_lock before insert on inbound_deliveries
  for each row execute function inbound_billing_lock();

-- Enterprise at the minimum balance: the warehouse can't pick or dispatch.
create or replace function orders_pause_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('Picking', 'Packed', 'Dispatched')
     and exists (select 1 from partners where id = new.partner_id and orders_paused) then
    raise exception 'Orders for this merchant are paused until their wallet is topped up.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists orders_pause_guard on orders;
create trigger orders_pause_guard before update of status on orders
  for each row execute function orders_pause_guard();

grant execute on function lagos_month(timestamptz) to authenticated;

commit;
