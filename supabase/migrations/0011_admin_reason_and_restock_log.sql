-- Two audit logs: why a partner's status was changed (specifically for
-- suspend, so it's accountable rather than a silent flip), and when a
-- merchant restocks a product (so an admin can see it happen, with the
-- quantity added).

create table if not exists partner_status_log (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  status partner_status not null,
  reason text,
  changed_by uuid references partners(id),
  created_at timestamptz not null default now()
);
create index if not exists partner_status_log_partner_idx
  on partner_status_log (partner_id, created_at desc);

alter table partner_status_log enable row level security;

drop policy if exists "partner status log read all for admin" on partner_status_log;
create policy "partner status log read all for admin" on partner_status_log
  for select using (is_admin());

-- No client insert policy - this table is only ever written from inside
-- admin_set_partner_status below, the same service-role/RPC-only pattern
-- already used for reward_events.

create table if not exists stock_events (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null,
  quantity_added integer not null,
  created_at timestamptz not null default now()
);
create index if not exists stock_events_partner_idx
  on stock_events (partner_id, created_at desc);

alter table stock_events enable row level security;

drop policy if exists "stock events insert own" on stock_events;
create policy "stock events insert own" on stock_events
  for insert with check (owns_partner(partner_id));

drop policy if exists "stock events read own" on stock_events;
create policy "stock events read own" on stock_events
  for select using (owns_partner(partner_id));

drop policy if exists "stock events read all for admin" on stock_events;
create policy "stock events read all for admin" on stock_events
  for select using (is_admin());

-- ---------------------------------------------------------------------------
-- Extend admin_set_partner_status with an optional reason, logged alongside
-- the status change. Adding a parameter creates a new overload rather than
-- replacing the old one - drop the old 2-arg signature explicitly so it
-- can't still be called without logging a reason.
-- ---------------------------------------------------------------------------
drop function if exists admin_set_partner_status(uuid, partner_status);

create or replace function admin_set_partner_status(
  p_partner_id uuid,
  p_status partner_status,
  p_reason text default null
)
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

  insert into partner_status_log (partner_id, status, reason, changed_by)
  values (p_partner_id, p_status, p_reason, auth.uid());
end;
$$;

revoke all on function admin_set_partner_status(uuid, partner_status, text) from public;
grant execute on function admin_set_partner_status(uuid, partner_status, text) to authenticated;
