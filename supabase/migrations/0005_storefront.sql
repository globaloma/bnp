-- Adds a public merchant storefront and guest checkout. Merchants get a
-- slug-addressed storefront listing their published products; customers
-- check out as a guest (no account) and pay via Paystack. Orders placed
-- this way land in the same `orders` table merchants already use, tagged
-- with channel = 'storefront' and payment_status = 'pending' until Paystack
-- confirms the charge.

-- ---------------------------------------------------------------------------
-- Slugs for partners (storefront URLs)
-- ---------------------------------------------------------------------------
create or replace function slugify(input text)
returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function unique_partner_slug(base text)
returns text language plpgsql as $$
declare
  base_slug text;
  candidate text;
  suffix int := 1;
begin
  base_slug := coalesce(nullif(slugify(base), ''), 'partner');
  candidate := base_slug;
  while exists (select 1 from partners where slug = candidate) loop
    suffix := suffix + 1;
    candidate := base_slug || '-' || suffix;
  end loop;
  return candidate;
end $$;

alter table partners add column if not exists slug text;

do $$
declare r record;
begin
  for r in select id, business_name from partners where slug is null order by created_at loop
    update partners set slug = unique_partner_slug(r.business_name) where id = r.id;
  end loop;
end $$;

alter table partners alter column slug set not null;

do $$ begin
  alter table partners add constraint partners_slug_key unique (slug);
exception when duplicate_object then null; end $$;

-- New signups get a slug too (merchant and FC alike - unused by FC accounts
-- today, but harmless to have).
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into partners (id, business_name, contact_name, email, phone, category, role, slug)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'business_name', 'New partner'),
    coalesce(new.raw_user_meta_data ->> 'contact_name', ''),
    new.email,
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'category',
    coalesce((new.raw_user_meta_data ->> 'role')::partner_role, 'merchant'),
    unique_partner_slug(coalesce(new.raw_user_meta_data ->> 'business_name', 'New partner'))
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Product visibility on the storefront
-- ---------------------------------------------------------------------------
alter table products add column if not exists published boolean not null default true;

-- ---------------------------------------------------------------------------
-- Orders: channel, payment tracking, guest contact info
-- ---------------------------------------------------------------------------
do $$ begin
  create type order_channel as enum ('dashboard', 'storefront');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_payment_status as enum ('pending', 'paid', 'failed');
exception when duplicate_object then null; end $$;

alter table orders
  add column if not exists channel order_channel not null default 'dashboard',
  add column if not exists payment_status order_payment_status not null default 'paid',
  add column if not exists payment_ref text,
  add column if not exists customer_phone text,
  add column if not exists customer_email text,
  add column if not exists delivery_address text;

create index if not exists orders_payment_ref_idx on orders (payment_ref) where payment_ref is not null;

-- Atomic conditional decrement, so a confirmed payment never oversells
-- stock via a stale read-then-write from the app. Called only from the
-- service-role client when a Paystack payment is confirmed.
create or replace function decrement_stock(p_product_id uuid, p_qty integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare affected int;
begin
  update products
    set stock = stock - p_qty, last_moved_at = now()
    where id = p_product_id and stock >= p_qty;
  get diagnostics affected = row_count;
  return affected > 0;
end $$;

revoke all on function decrement_stock(uuid, integer) from public;
grant execute on function decrement_stock(uuid, integer) to service_role;

-- A guest checkout inserts one row per cart line item, all sharing one
-- order_ref - so uniqueness now needs product_id in the mix.
do $$
declare c text;
begin
  select conname into c
  from pg_constraint
  where conrelid = 'orders'::regclass and contype = 'u';
  if c is not null then
    execute format('alter table orders drop constraint %I', c);
  end if;
end $$;

alter table orders add constraint orders_partner_ref_product_key unique (partner_id, order_ref, product_id);

-- ---------------------------------------------------------------------------
-- Public storefront views. Owned by the migration role, so they read past
-- RLS on the base tables while only re-exposing a narrow, safe column set -
-- avoids ever granting anon a row-level policy on `partners` (which would
-- leak email/phone/wallet columns) or `products` (cost_price/vat).
-- ---------------------------------------------------------------------------
create or replace view storefront_partners as
  select id, slug, business_name, category
  from partners
  where status = 'active';

create or replace view storefront_products as
  select p.id, p.partner_id, p.name, p.sku, p.category, p.sale_price,
         p.stock, p.location, p.shipping_fee, p.pickup_enabled, p.image_url
  from products p
  join partners pa on pa.id = p.partner_id
  where p.published = true and pa.status = 'active';

grant select on storefront_partners to anon, authenticated;
grant select on storefront_products to anon, authenticated;
