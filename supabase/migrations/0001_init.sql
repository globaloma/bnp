-- BNP Fulfillment partner portal schema
-- Run in the Supabase SQL editor, or with the Supabase CLI.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type warehouse_location as enum ('Abuja', 'Lagos', 'USA');
exception when duplicate_object then null; end $$;

do $$ begin
  create type partner_status as enum ('pending', 'active', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum ('Packaging', 'Shipping', 'Delivered', 'Returned', 'Damaged');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_rider as enum ('BNP Fleet', 'Own Rider', 'Pickup');
exception when duplicate_object then null; end $$;

do $$ begin
  create type wallet_txn_type as enum ('Top-up', 'Deduction', 'Reward');
exception when duplicate_object then null; end $$;

do $$ begin
  create type return_status as enum ('Under Review', 'Approved', 'Rejected', 'Resolved');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Partners (one row per authenticated partner account)
-- ---------------------------------------------------------------------------
create table if not exists partners (
  id              uuid primary key references auth.users (id) on delete cascade,
  business_name   text not null,
  contact_name    text not null,
  email           text not null,
  phone           text,
  category        text,
  status          partner_status not null default 'pending',
  wallet_balance  numeric(14, 2) not null default 0,
  wallet_buffer   numeric(14, 2) not null default 30000,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------
create table if not exists products (
  id             uuid primary key default gen_random_uuid(),
  partner_id     uuid not null references partners (id) on delete cascade,
  name           text not null,
  sku            text,
  category       text,
  cost_price     numeric(14, 2) not null default 0,
  sale_price     numeric(14, 2) not null default 0,
  vat            numeric(5, 2) not null default 7.5,
  stock          integer not null default 0,
  location       warehouse_location not null default 'Abuja',
  shipping_fee   numeric(14, 2) not null default 0,
  pickup_enabled boolean not null default false,
  image_url      text,
  last_moved_at  timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists products_partner_idx on products (partner_id);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create table if not exists orders (
  id            uuid primary key default gen_random_uuid(),
  partner_id    uuid not null references partners (id) on delete cascade,
  order_ref     text not null,
  customer_name text not null,
  product_id    uuid references products (id) on delete set null,
  product_name  text not null,
  quantity      integer not null default 1,
  unit_price    numeric(14, 2) not null default 0,
  total         numeric(14, 2) not null default 0,
  status        order_status not null default 'Packaging',
  location      warehouse_location not null default 'Abuja',
  rider         order_rider not null default 'BNP Fleet',
  placed_at     timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (partner_id, order_ref)
);
create index if not exists orders_partner_idx on orders (partner_id);

-- ---------------------------------------------------------------------------
-- Wallet transactions
-- ---------------------------------------------------------------------------
create table if not exists wallet_transactions (
  id         uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners (id) on delete cascade,
  type       wallet_txn_type not null,
  amount     numeric(14, 2) not null,
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists wallet_txn_partner_idx on wallet_transactions (partner_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Returns and claims
-- ---------------------------------------------------------------------------
create table if not exists returns (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references partners (id) on delete cascade,
  return_ref   text not null,
  order_id     uuid references orders (id) on delete set null,
  order_ref    text,
  product_name text,
  reason       text not null,
  status       return_status not null default 'Under Review',
  image_url    text,
  filed_at     timestamptz not null default now(),
  unique (partner_id, return_ref)
);
create index if not exists returns_partner_idx on returns (partner_id);

-- ---------------------------------------------------------------------------
-- Reward events
-- ---------------------------------------------------------------------------
create table if not exists reward_events (
  id         uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners (id) on delete cascade,
  type       text not null,
  amount     numeric(14, 2) not null default 0,
  reason     text,
  created_at timestamptz not null default now()
);
create index if not exists reward_events_partner_idx on reward_events (partner_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['partners', 'products', 'orders']
  loop
    execute format('drop trigger if exists %I_set_updated_at on %I', t, t);
    execute format(
      'create trigger %I_set_updated_at before update on %I
       for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- New auth user -> pending partner row
-- ---------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into partners (id, business_name, contact_name, email, phone, category)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'business_name', 'New partner'),
    coalesce(new.raw_user_meta_data ->> 'contact_name', ''),
    new.email,
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'category'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table partners enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table wallet_transactions enable row level security;
alter table returns enable row level security;
alter table reward_events enable row level security;

-- partners: a partner sees and edits only their own profile
drop policy if exists "partners read own" on partners;
create policy "partners read own" on partners
  for select using (id = auth.uid());

drop policy if exists "partners update own" on partners;
create policy "partners update own" on partners
  for update using (id = auth.uid()) with check (id = auth.uid());

-- helper: owns a partner_id
create or replace function owns_partner(pid uuid)
returns boolean language sql stable as $$
  select pid = auth.uid();
$$;

-- products
drop policy if exists "products all own" on products;
create policy "products all own" on products
  for all using (owns_partner(partner_id)) with check (owns_partner(partner_id));

-- orders
drop policy if exists "orders all own" on orders;
create policy "orders all own" on orders
  for all using (owns_partner(partner_id)) with check (owns_partner(partner_id));

-- wallet transactions: partner can read and top up (insert), no update or delete
drop policy if exists "wallet read own" on wallet_transactions;
create policy "wallet read own" on wallet_transactions
  for select using (owns_partner(partner_id));

drop policy if exists "wallet insert own" on wallet_transactions;
create policy "wallet insert own" on wallet_transactions
  for insert with check (owns_partner(partner_id));

-- returns
drop policy if exists "returns read own" on returns;
create policy "returns read own" on returns
  for select using (owns_partner(partner_id));

drop policy if exists "returns insert own" on returns;
create policy "returns insert own" on returns
  for insert with check (owns_partner(partner_id));

-- reward events: read only for partners, writes come from service role
drop policy if exists "rewards read own" on reward_events;
create policy "rewards read own" on reward_events
  for select using (owns_partner(partner_id));
