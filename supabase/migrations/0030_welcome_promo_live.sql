-- Welcome email, promo prices and the admin live order feed.
--
-- 1. partners.welcomed_at: when the welcome email went out, so a merchant is
--    welcomed once, on first approval, and not again after a suspension.
--    Merchants already approved before this migration count as welcomed.
-- 2. products.promo_price: an optional lower price customers pay while it's
--    set (spec 3.4). BNP's percentage fee is on what the order actually
--    charged, as before, so a promo doesn't change how BNP bills.
-- 3. Admins can read every order and product (live feed, insurance view).
-- 4. orders joins the supabase_realtime publication so the admin live feed
--    hears inserts and updates. Realtime still applies row-level security,
--    so merchants only ever hear about their own orders.

begin;

alter table partners add column if not exists welcomed_at timestamptz;
update partners set welcomed_at = coalesce(welcomed_at, now())
  where role = 'merchant' and status = 'active' and welcomed_at is null;

alter table products add column if not exists promo_price numeric(14,2);
alter table products drop constraint if exists products_promo_price_check;
alter table products add constraint products_promo_price_check
  check (promo_price is null or (promo_price >= 0 and promo_price < sale_price));

-- Same columns as 0022, promo_price added at the end.
create or replace view storefront_products as
  select p.id, p.partner_id, p.name, p.sku, p.category, p.sale_price,
         p.stock, p.location, p.shipping_fee, p.pickup_enabled, p.image_url,
         p.vat, p.description, p.variant, p.group_id, p.promo_price
  from products p
  join partners pa on pa.id = p.partner_id
  where p.published = true and pa.status = 'active';

drop policy if exists "orders read all for admin" on orders;
create policy "orders read all for admin" on orders for select using (is_admin());

drop policy if exists "products read all for admin" on products;
create policy "products read all for admin" on products for select using (is_admin());

commit;

-- Outside the transaction: adding a table twice errors, so check first.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
     ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
