-- Adds the fulfillment center role: partners are either a 'merchant' (lists
-- products, receives customer orders) or a 'fulfillment_center' (dispatches
-- and tracks stock across every merchant). Existing rows default to
-- 'merchant' so nothing already in the table changes behavior.

do $$ begin
  create type partner_role as enum ('merchant', 'fulfillment_center');
exception when duplicate_object then null; end $$;

alter table partners
  add column if not exists role partner_role not null default 'merchant';

-- ---------------------------------------------------------------------------
-- New auth user -> pending partner row (adds role from signup metadata)
-- ---------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into partners (id, business_name, contact_name, email, phone, category, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'business_name', 'New partner'),
    coalesce(new.raw_user_meta_data ->> 'contact_name', ''),
    new.email,
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'category',
    coalesce((new.raw_user_meta_data ->> 'role')::partner_role, 'merchant')
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Role helper. security definer so it can read the caller's own partners
-- row without re-triggering the policies that call it (avoids recursion).
-- ---------------------------------------------------------------------------
create or replace function is_fulfillment_center()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from partners p where p.id = auth.uid() and p.role = 'fulfillment_center'
  );
$$;

-- ---------------------------------------------------------------------------
-- Fulfillment centers can see every merchant's name, products, and orders,
-- and move orders through the fulfillment pipeline. Merchants keep seeing
-- only their own rows via the existing "own" policies.
-- ---------------------------------------------------------------------------
drop policy if exists "partners read all for fc" on partners;
create policy "partners read all for fc" on partners
  for select using (is_fulfillment_center());

drop policy if exists "products read all for fc" on products;
create policy "products read all for fc" on products
  for select using (is_fulfillment_center());

drop policy if exists "orders read all for fc" on orders;
create policy "orders read all for fc" on orders
  for select using (is_fulfillment_center());

drop policy if exists "orders update all for fc" on orders;
create policy "orders update all for fc" on orders
  for update using (is_fulfillment_center()) with check (is_fulfillment_center());
