-- Wires the wallet up to real Paystack payments: top-up becomes a real
-- charge instead of a free instant credit, and withdraw (new) becomes a
-- real Paystack Transfer to the merchant's bank account.

alter table partners
  add column if not exists bank_code text,
  add column if not exists bank_account_number text,
  add column if not exists bank_account_name text,
  add column if not exists paystack_recipient_code text;

do $$ begin
  create type wallet_topup_status as enum ('pending', 'paid', 'failed');
exception when duplicate_object then null; end $$;

create table if not exists wallet_topups (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  amount numeric(14, 2) not null,
  reference text not null unique,
  status wallet_topup_status not null default 'pending',
  created_at timestamptz not null default now()
);
create index if not exists wallet_topups_partner_idx on wallet_topups (partner_id, created_at desc);

alter table wallet_topups enable row level security;

drop policy if exists "wallet topups read own" on wallet_topups;
create policy "wallet topups read own" on wallet_topups
  for select using (owns_partner(partner_id));

-- No client insert/update policy - only the service-role client writes
-- here (startWalletTopup / confirmWalletTopup), same trust model as
-- orders.payment_ref handling for storefront checkout.

do $$ begin
  create type wallet_withdrawal_status as enum ('pending', 'processing', 'success', 'failed');
exception when duplicate_object then null; end $$;

create table if not exists wallet_withdrawals (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  amount numeric(14, 2) not null,
  bank_account_name text,
  bank_account_number text,
  bank_code text,
  status wallet_withdrawal_status not null default 'pending',
  paystack_transfer_code text,
  paystack_reference text unique,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists wallet_withdrawals_partner_idx
  on wallet_withdrawals (partner_id, created_at desc);

alter table wallet_withdrawals enable row level security;

drop policy if exists "wallet withdrawals read own" on wallet_withdrawals;
create policy "wallet withdrawals read own" on wallet_withdrawals
  for select using (owns_partner(partner_id));

-- ---------------------------------------------------------------------------
-- wallet_credit: service-role only, explicit partner id. Called only from
-- webhook context (confirming a top-up, refunding a failed/reversed
-- withdrawal) where there's no authenticated session to derive auth.uid()
-- from at all - mirrors decrement_stock's service_role grant pattern.
-- ---------------------------------------------------------------------------
create or replace function wallet_credit(
  p_partner_id uuid,
  p_amount numeric,
  p_type wallet_txn_type,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Credit amount must be greater than zero';
  end if;

  update partners
  set wallet_balance = wallet_balance + p_amount
  where id = p_partner_id;

  if not found then
    raise exception 'No partner found for that id';
  end if;

  insert into wallet_transactions (partner_id, type, amount, note)
  values (p_partner_id, p_type, p_amount, p_note);
end;
$$;

revoke all on function wallet_credit(uuid, numeric, wallet_txn_type, text) from public;
grant execute on function wallet_credit(uuid, numeric, wallet_txn_type, text) to service_role;

-- ---------------------------------------------------------------------------
-- wallet_debit: mirrors wallet_top_up exactly - acts on auth.uid(), granted
-- to authenticated, since a withdrawal is always requested by the merchant
-- themselves in a normal session, not from webhook context. Rejects if it
-- would dip the balance below the reserved buffer.
-- ---------------------------------------------------------------------------
create or replace function wallet_debit(p_amount numeric, p_note text default 'Withdrawal')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric;
  v_buffer numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Withdrawal amount must be greater than zero';
  end if;

  select wallet_balance, wallet_buffer into v_balance, v_buffer
  from partners where id = auth.uid();

  if not found then
    raise exception 'No partner profile found for the current user';
  end if;

  if v_balance - p_amount < v_buffer then
    raise exception 'Withdrawal would drop the wallet below its reserved buffer';
  end if;

  update partners
  set wallet_balance = wallet_balance - p_amount
  where id = auth.uid();

  insert into wallet_transactions (partner_id, type, amount, note)
  values (auth.uid(), 'Deduction', -p_amount, coalesce(p_note, 'Withdrawal'));
end;
$$;

revoke all on function wallet_debit(numeric, text) from public;
grant execute on function wallet_debit(numeric, text) to authenticated;
