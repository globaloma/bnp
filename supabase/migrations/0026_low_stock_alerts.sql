-- Low-stock alerts: each product can have its own alert level, and merchants
-- get an email when available stock falls to it.
--
-- The database spots the drop, whatever caused it (an order reserving
-- stock, a dispatch, an approved count), and queues one alert. The product
-- is then marked as alerted until stock rises above the level again, so a
-- merchant gets one email per drop rather than one per order. The app sends
-- the queued emails (src/lib/low-stock.ts).

begin;

alter table products add column if not exists low_stock_threshold integer
  check (low_stock_threshold is null or low_stock_threshold between 0 and 100000);
alter table products add column if not exists low_stock_alerted boolean not null default false;

create table if not exists low_stock_alerts (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products (id) on delete cascade,
  partner_id  uuid not null references partners (id) on delete cascade,
  available   integer not null,
  threshold   integer not null,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
create index if not exists low_stock_alerts_unsent_idx on low_stock_alerts (created_at) where sent_at is null;

alter table low_stock_alerts enable row level security;
drop policy if exists "low_stock_alerts read own" on low_stock_alerts;
create policy "low_stock_alerts read own" on low_stock_alerts
  for select using (partner_id = auth.uid() or is_admin());
-- No write policies: the trigger queues alerts and the server sends them.

-- Matches LOW_STOCK_THRESHOLD in src/types/db.ts.
create or replace function default_low_stock_threshold() returns integer
language sql immutable as $$ select 3 $$;

create or replace function products_low_stock() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  t int := coalesce(new.low_stock_threshold, default_low_stock_threshold());
begin
  if tg_op = 'INSERT' then
    -- A new product starts with nothing; don't alert until it has had stock.
    new.low_stock_alerted := new.stock <= t;
    return new;
  end if;

  if new.stock > t then
    new.low_stock_alerted := false;
  elsif not old.low_stock_alerted then
    new.low_stock_alerted := true;
    insert into low_stock_alerts (product_id, partner_id, available, threshold)
    values (new.id, new.partner_id, new.stock, t);
  end if;
  return new;
end $$;

-- Products that are already low when this goes live shouldn't all email at
-- once; they alert next time they restock and fall again. Done before the
-- trigger exists, so it doesn't queue alerts itself.
update products set low_stock_alerted = true
where stock <= coalesce(low_stock_threshold, default_low_stock_threshold());

-- Named to run after products_stock_sync, which works out `stock`
-- (triggers on the same event run in name order).
drop trigger if exists products_zz_low_stock on products;
create trigger products_zz_low_stock before insert or update on products
  for each row execute function products_low_stock();


commit;
