-- Customer marketplace (shop.bnpfulfillment.com): every active merchant's
-- published products in one shop, one cart and one payment across merchants.
--
--   * partners.marketplace_enabled: on by default; merchants can switch it off.
--   * marketplace_products: what the shop lists. Hidden: merchants who
--     switched off, aren't active, or are blocked from taking orders
--     (billing_locked, Enterprise wallet_locked), and stock held in the USA.
--   * customers (+ addresses, wishlist, reviews): shoppers with an account.
--     Signing up with account_type = 'customer' creates a customers row,
--     never a partners row, so a shopper can't reach any dashboard.
--   * Checkout: one Paystack payment (reference MKT-<checkout_ref>) becomes
--     one order per merchant, each with its own BNP- number, sharing
--     payment_ref and checkout_ref. channel = 'marketplace'.
--   * Payout: when a marketplace line is Delivered, its total (goods + VAT)
--     is credited to the merchant's wallet as a Sale. Delivery lines stay
--     with BNP. If a delivered line is later Returned, the credit is taken
--     back. Usual fulfillment fees and storage still apply as for any order.
--
-- Run WITHOUT a wrapping transaction: the enum values must be committed
-- before the functions and views below use them.

alter type order_channel add value if not exists 'marketplace';
alter type wallet_txn_type add value if not exists 'Sale';

-- ---------------------------------------------------------------------------
-- Merchant switch
-- ---------------------------------------------------------------------------
alter table partners add column if not exists marketplace_enabled boolean not null default true;
grant update (marketplace_enabled) on partners to authenticated;

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------
create table if not exists customers (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null default '' check (char_length(full_name) <= 120),
  phone      text check (char_length(phone) <= 30),
  email      text,
  created_at timestamptz not null default now()
);
alter table customers enable row level security;
drop policy if exists "customers read own" on customers;
create policy "customers read own" on customers for select to authenticated using (id = auth.uid());
drop policy if exists "customers update own" on customers;
create policy "customers update own" on customers for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "customers read all for admin" on customers;
create policy "customers read all for admin" on customers for select to authenticated using (is_admin());
revoke update on customers from authenticated;
grant update (full_name, phone) on customers to authenticated;

create table if not exists customer_addresses (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  label       text not null default 'Home' check (char_length(label) <= 40),
  full_name   text not null check (char_length(full_name) between 2 and 120),
  phone       text not null check (char_length(phone) between 7 and 30),
  address     text not null check (char_length(address) between 5 and 300),
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists customer_addresses_customer_idx on customer_addresses (customer_id);
alter table customer_addresses enable row level security;
drop policy if exists "addresses own" on customer_addresses;
create policy "addresses own" on customer_addresses for all to authenticated
  using (customer_id = auth.uid()) with check (customer_id = auth.uid());

create table if not exists wishlist_items (
  customer_id uuid not null references customers(id) on delete cascade,
  product_id  uuid not null references products(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (customer_id, product_id)
);
alter table wishlist_items enable row level security;
drop policy if exists "wishlist own" on wishlist_items;
create policy "wishlist own" on wishlist_items for all to authenticated
  using (customer_id = auth.uid()) with check (customer_id = auth.uid());

-- Reviews: anyone can read; only a customer who received the product can
-- write one (submit_review), one per product per customer.
create table if not exists product_reviews (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references products(id) on delete cascade,
  partner_id    uuid not null references partners(id) on delete cascade,
  customer_id   uuid not null references customers(id) on delete cascade,
  reviewer_name text not null,
  rating        smallint not null check (rating between 1 and 5),
  body          text check (char_length(body) <= 1000),
  created_at    timestamptz not null default now(),
  unique (product_id, customer_id)
);
create index if not exists product_reviews_product_idx on product_reviews (product_id, created_at desc);
alter table product_reviews enable row level security;
drop policy if exists "reviews public read" on product_reviews;
create policy "reviews public read" on product_reviews for select to anon, authenticated using (true);
drop policy if exists "reviews delete for admin" on product_reviews;
create policy "reviews delete for admin" on product_reviews for delete to authenticated using (is_admin());

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
alter table orders add column if not exists customer_id uuid references customers(id) on delete set null;
alter table orders add column if not exists checkout_ref text;
alter table orders add column if not exists payout_at timestamptz;
alter table orders add column if not exists payout_amount numeric(14,2);
alter table orders add column if not exists payout_reversed_at timestamptz;
create index if not exists orders_customer_idx on orders (customer_id, placed_at desc) where customer_id is not null;
create index if not exists orders_checkout_idx on orders (checkout_ref) where checkout_ref is not null;

drop policy if exists "orders read own customer" on orders;
create policy "orders read own customer" on orders for select to authenticated using (customer_id = auth.uid());

-- Merchant is paid for a marketplace line when it's delivered.
create or replace function orders_marketplace_payout() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.channel <> 'marketplace' or new.product_id is null or new.payment_status <> 'paid' then
    return new;
  end if;
  if new.status = 'Delivered' and old.status is distinct from 'Delivered' and new.payout_at is null and new.total > 0 then
    perform wallet_credit(new.partner_id, new.total, 'Sale',
      'Marketplace sale ' || new.order_ref || ': ' || new.product_name || ' x ' || new.quantity);
    new.payout_at := now();
    new.payout_amount := new.total;
  elsif new.status = 'Returned' and old.status = 'Delivered' and new.payout_at is not null
        and new.payout_reversed_at is null then
    perform charge_wallet(new.partner_id, new.payout_amount,
      'Marketplace sale returned ' || new.order_ref || ': ' || new.product_name);
    perform check_wallet_floor(new.partner_id);
    new.payout_reversed_at := now();
  end if;
  return new;
end $$;
drop trigger if exists orders_marketplace_payout on orders;
create trigger orders_marketplace_payout before update of status on orders
  for each row execute function orders_marketplace_payout();

-- BNP Shop orders are paid by the customer to BNP and the merchant is paid
-- from them on delivery, so only BNP may create or change them: the
-- checkout and payment confirmation (service role), the warehouse and
-- admins. A merchant can't create one, edit its prices or quantities,
-- change its status (e.g. mark it Delivered to trigger a payout) or delete it.
create or replace function orders_marketplace_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or is_admin() or is_fulfillment_center() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'INSERT' then
    if new.channel = 'marketplace' then
      raise exception 'BNP Shop orders are created at checkout.' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if old.channel = 'marketplace' then
    raise exception 'BNP Shop orders are handled by BNP. Contact us if something needs changing.' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and new.channel = 'marketplace' then
    raise exception 'BNP Shop orders are created at checkout.' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
drop trigger if exists orders_marketplace_guard on orders;
create trigger orders_marketplace_guard before insert or update or delete on orders
  for each row execute function orders_marketplace_guard();

-- ---------------------------------------------------------------------------
-- What the shop lists
-- ---------------------------------------------------------------------------
create or replace view marketplace_products as
select
  p.id, p.partner_id, p.name, p.category, p.sale_price, p.promo_price,
  case when pa.charges_vat then p.vat else 0 end as vat,
  p.stock, p.location, p.image_url, p.description, p.variant, p.group_id,
  coalesce(p.weight_kg, 0) as weight_kg, p.created_at,
  pa.slug as merchant_slug, pa.business_name as merchant_name, pa.logo_url as merchant_logo,
  coalesce(r.rating_avg, 0)::numeric(3,2) as rating_avg,
  coalesce(r.rating_count, 0)::int as rating_count,
  coalesce(s.sold, 0)::int as sold_90d,
  coalesce(p.promo_price, p.sale_price) as price
from products p
join partners pa on pa.id = p.partner_id
left join (
  select product_id, avg(rating) as rating_avg, count(*) as rating_count
  from product_reviews group by product_id
) r on r.product_id = p.id
left join (
  select product_id, sum(quantity) as sold
  from orders
  where payment_status = 'paid' and status <> 'Cancelled' and product_id is not null
    and placed_at > now() - interval '90 days'
  group by product_id
) s on s.product_id = p.id
where p.published
  and p.location <> 'USA'
  and pa.role = 'merchant' and pa.status = 'active' and pa.marketplace_enabled
  and not pa.billing_locked
  and not (pa.wallet_locked and pa.plan_type = 'enterprise');

revoke all on marketplace_products from anon, authenticated;
grant select on marketplace_products to anon, authenticated;

-- Merchants that have something in the shop, for seller pages.
create or replace view marketplace_merchants as
select pa.id, pa.slug, pa.business_name, pa.logo_url, pa.store_description, pa.category,
       pa.created_at, count(mp.id)::int as product_count
from partners pa
join marketplace_products mp on mp.partner_id = pa.id
group by pa.id;
revoke all on marketplace_merchants from anon, authenticated;
grant select on marketplace_merchants to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Sign up: customers get a customers row, everyone else a partners row
-- ---------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  chosen text := lower(coalesce(new.raw_user_meta_data ->> 'plan_type', 'standard'));
begin
  if new.raw_user_meta_data ->> 'account_type' = 'customer' then
    insert into customers (id, full_name, phone, email)
    values (
      new.id,
      left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
      left(new.raw_user_meta_data ->> 'phone', 30),
      new.email
    )
    on conflict (id) do nothing;
    return new;
  end if;

  insert into partners (id, business_name, contact_name, email, phone, category, role, slug, plan_type)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'business_name', 'New partner'),
    coalesce(new.raw_user_meta_data ->> 'contact_name', ''),
    new.email,
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'category',
    coalesce((new.raw_user_meta_data ->> 'role')::partner_role, 'merchant'),
    unique_partner_slug(coalesce(new.raw_user_meta_data ->> 'business_name', 'New partner')),
    case when chosen in ('standard', 'enterprise') then chosen else 'standard' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------
create or replace function submit_review(p_product uuid, p_rating int, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare
  c customers;
  merchant uuid;
begin
  select * into c from customers where id = auth.uid();
  if c.id is null then raise exception 'Sign in to your shop account to leave a review.'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'Choose 1 to 5 stars.'; end if;
  select partner_id into merchant from orders
  where customer_id = c.id and product_id = p_product and status = 'Delivered' limit 1;
  if merchant is null then raise exception 'You can review a product once it has been delivered to you.'; end if;
  insert into product_reviews (product_id, partner_id, customer_id, reviewer_name, rating, body)
  values (
    p_product, merchant, c.id,
    coalesce(nullif(split_part(btrim(c.full_name), ' ', 1), ''), 'Customer'),
    p_rating, nullif(btrim(left(coalesce(p_body, ''), 1000)), '')
  )
  on conflict (product_id, customer_id)
  do update set rating = excluded.rating, body = excluded.body, created_at = now();
end $$;
revoke all on function submit_review(uuid, int, text) from public, anon;
grant execute on function submit_review(uuid, int, text) to authenticated;

-- Public order tracking across merchants: ref + phone, like the stores.
-- (Done in the app with the service role; nothing to grant here.)
