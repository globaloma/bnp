-- Close a gap in 0001: the blanket "partners update own" policy let a partner
-- write wallet_balance, wallet_buffer or status directly from the client,
-- since Postgres RLS is row-level, not column-level. Wallet changes now only
-- happen through a security-definer function that also writes the ledger row
-- in the same transaction.

drop policy if exists "partners update own" on partners;
create policy "partners update own" on partners
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and wallet_balance = (select p.wallet_balance from partners p where p.id = auth.uid())
    and wallet_buffer = (select p.wallet_buffer from partners p where p.id = auth.uid())
    and status = (select p.status from partners p where p.id = auth.uid())
  );

create or replace function wallet_top_up(p_amount numeric, p_note text default 'Manual top-up')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Top up amount must be greater than zero';
  end if;

  update partners
  set wallet_balance = wallet_balance + p_amount
  where id = auth.uid();

  if not found then
    raise exception 'No partner profile found for the current user';
  end if;

  insert into wallet_transactions (partner_id, type, amount, note)
  values (auth.uid(), 'Top-up', p_amount, coalesce(p_note, 'Manual top-up'));
end;
$$;

revoke all on function wallet_top_up(numeric, text) from public;
grant execute on function wallet_top_up(numeric, text) to authenticated;
