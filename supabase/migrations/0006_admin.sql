-- Adds an admin role so approving/suspending partners and issuing rewards
-- can happen from the app instead of the business owner hand-editing rows
-- in the Supabase dashboard. There is no signup path to this role - the
-- Zod schema and this enum both only ever accept merchant/fulfillment_center
-- at signup - it's provisioned by hand, once, on an existing partner row.

alter type partner_role add value if not exists 'admin';
commit;

-- ---------------------------------------------------------------------------
-- Role helper, mirroring is_fulfillment_center().
-- ---------------------------------------------------------------------------
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from partners p where p.id = auth.uid() and p.role = 'admin'
  );
$$;

drop policy if exists "partners read all for admin" on partners;
create policy "partners read all for admin" on partners
  for select using (is_admin());

drop policy if exists "reward events read all for admin" on reward_events;
create policy "reward events read all for admin" on reward_events
  for select using (is_admin());

-- ---------------------------------------------------------------------------
-- Approve / suspend / reactivate a partner. The existing "partners update
-- own" policy (0002) explicitly locks `status` against any plain client
-- update, so this has to go through a security-definer function, same
-- pattern as wallet_top_up.
-- ---------------------------------------------------------------------------
create or replace function admin_set_partner_status(p_partner_id uuid, p_status partner_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Only an admin can change partner status';
  end if;

  update partners set status = p_status where id = p_partner_id;

  if not found then
    raise exception 'No partner found for that id';
  end if;
end;
$$;

revoke all on function admin_set_partner_status(uuid, partner_status) from public;
grant execute on function admin_set_partner_status(uuid, partner_status) to authenticated;

-- ---------------------------------------------------------------------------
-- Issue a reward. Always logs to reward_events; a monetary amount also
-- credits wallet_balance and logs a wallet_transactions row - wiring up the
-- 'Reward' wallet_txn_type that's existed since 0001 but nothing has ever
-- written, and matching what the Rewards page copy already promises
-- ("the BNP team will credit your wallet... or apply a perk here").
-- ---------------------------------------------------------------------------
create or replace function admin_issue_reward(
  p_partner_id uuid,
  p_amount numeric default 0,
  p_type text default 'Reward',
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Only an admin can issue rewards';
  end if;

  insert into reward_events (partner_id, type, amount, reason)
  values (p_partner_id, coalesce(p_type, 'Reward'), coalesce(p_amount, 0), p_reason);

  if p_amount is not null and p_amount > 0 then
    update partners set wallet_balance = wallet_balance + p_amount where id = p_partner_id;

    if not found then
      raise exception 'No partner found for that id';
    end if;

    insert into wallet_transactions (partner_id, type, amount, note)
    values (p_partner_id, 'Reward', p_amount, coalesce(p_reason, 'Reward'));
  end if;
end;
$$;

revoke all on function admin_issue_reward(uuid, numeric, text, text) from public;
grant execute on function admin_issue_reward(uuid, numeric, text, text) to authenticated;
