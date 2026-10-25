-- Admins can create orders for a merchant, and Enterprise merchants whose
-- wallet isn't funded at month end can't create new orders.
--
-- 1. Month-end wallet block (Enterprise). When the monthly billing runs for
--    the month just ended, every Enterprise merchant whose wallet is at or
--    below their agreed minimum gets wallet_locked: no new orders from the
--    dashboard, CSV upload or their online store. Topping up above the
--    minimum lifts it straight away (check_wallet_floor runs on every
--    credit). Each merchant is checked once per month (wallet_checked_period),
--    so a top-up on the 2nd isn't undone by the next daily run.
--    Standard merchants are unchanged: an invoice not paid by card, wallet or
--    bank transfer (admin marks it paid) within 3 business days locks the
--    account (billing_locked, migration 0028).
-- 2. Admin orders. Admins may insert orders for any merchant, and an admin's
--    order goes through even when the merchant is blocked. orders.created_by
--    records the admin; the database sets it, so nobody can fake it.

alter table partners add column if not exists wallet_locked boolean not null default false;
alter table partners add column if not exists wallet_locked_at timestamptz;
alter table partners add column if not exists wallet_checked_period date;

alter table orders add column if not exists created_by uuid references partners(id) on delete set null;

drop policy if exists "orders insert for admin" on orders;
create policy "orders insert for admin" on orders for insert to authenticated with check (is_admin());

-- ---------------------------------------------------------------------------
-- New orders: blocks, admin override, who created it
-- ---------------------------------------------------------------------------
create or replace function orders_billing_lock() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p partners;
  admin boolean := is_admin();
begin
  new.created_by := case when admin and auth.uid() is distinct from new.partner_id then auth.uid() end;
  if admin then return new; end if;

  select * into p from partners where id = new.partner_id;
  if p.billing_locked then
    raise exception 'This account is paused until an overdue invoice is paid.' using errcode = 'P0001';
  end if;
  if p.wallet_locked and p.plan_type = 'enterprise' then
    raise exception 'New orders are on hold until the wallet is topped up above the agreed minimum.' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Month-end check
-- ---------------------------------------------------------------------------
create or replace function lock_unfunded_wallets(p_period date)
returns integer language plpgsql security definer set search_path = public as $$
declare
  r partners;
  n int := 0;
begin
  for r in
    select * from partners
    where role = 'merchant' and status = 'active' and plan_type = 'enterprise'
      and (wallet_checked_period is null or wallet_checked_period < p_period)
    for update
  loop
    update partners set wallet_checked_period = p_period where id = r.id;
    if r.wallet_balance <= r.wallet_buffer and not r.wallet_locked then
      update partners set wallet_locked = true, wallet_locked_at = now() where id = r.id;
      insert into billing_notices (partner_id, kind, payload)
      values (r.id, 'wallet_locked', jsonb_build_object('balance', r.wallet_balance, 'minimum', r.wallet_buffer, 'period', p_period));
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- Runs after the month's charges, so the balance checked is what's left.
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
  return result || jsonb_build_object('locked', lock_overdue_accounts());
end $$;

revoke all on function lock_unfunded_wallets(date) from public, anon, authenticated;
revoke all on function billing_daily() from public, anon, authenticated;
grant execute on function billing_daily() to service_role;

-- ---------------------------------------------------------------------------
-- Lifting the block: any credit that takes the wallet above the minimum
-- ---------------------------------------------------------------------------
create or replace function check_wallet_floor(p_partner uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  p partners;
  margin numeric := (select low_balance_margin from billing_settings);
  level text;
begin
  select * into p from partners where id = p_partner for update;
  if p.id is null then return; end if;

  if p.wallet_locked and (p.plan_type <> 'enterprise' or p.wallet_balance > p.wallet_buffer) then
    update partners set wallet_locked = false, wallet_locked_at = null where id = p_partner;
    insert into billing_notices (partner_id, kind, payload)
    values (p_partner, 'wallet_unlocked', jsonb_build_object('balance', p.wallet_balance));
  end if;

  if p.plan_type <> 'enterprise' then
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

-- Admins can lift (or put back) the block by hand, e.g. while a transfer clears.
create or replace function admin_set_wallet_lock(p_partner uuid, p_locked boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin can change this.'; end if;
  update partners
  set wallet_locked = p_locked, wallet_locked_at = case when p_locked then now() end
  where id = p_partner and role = 'merchant';
end $$;
revoke all on function admin_set_wallet_lock(uuid, boolean) from public, anon;
grant execute on function admin_set_wallet_lock(uuid, boolean) to authenticated;
