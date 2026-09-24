-- Adds per-line-item discounts, VAT snapshotting, and notes to orders, plus
-- a SKU-based unique index on products so CSV import can safely upsert
-- instead of duplicating a merchant's whole catalog on every re-upload.
--
-- `total` becomes post-discount + post-VAT (subtotal - discount_amount +
-- vat_amount). Every existing reader of orders.total (revenue stats, CSV
-- export, Paystack charge amount) needs zero changes - only the writers
-- (createOrder, startCheckout, the new editOrder) need to compute the
-- extra columns.

do $$ begin
  create type order_discount_type as enum ('fixed', 'percentage');
exception when duplicate_object then null; end $$;

alter table orders
  add column if not exists notes text,
  add column if not exists discount_type order_discount_type,
  add column if not exists discount_value numeric(14, 2) not null default 0,
  add column if not exists discount_amount numeric(14, 2) not null default 0,
  add column if not exists vat_rate numeric(5, 2) not null default 0,
  add column if not exists vat_amount numeric(14, 2) not null default 0,
  add column if not exists subtotal numeric(14, 2) not null default 0;

do $$ begin
  alter table orders add constraint orders_discount_value_check
    check (
      discount_value >= 0
      and (discount_type is distinct from 'percentage' or discount_value <= 100)
    );
exception when duplicate_object then null; end $$;

-- Backfill existing rows so subtotal isn't left at the column default of 0
-- for orders written before this migration.
update orders set subtotal = total where subtotal = 0 and total <> 0;

-- ---------------------------------------------------------------------------
-- SKU-based upsert support for CSV import. Partial index so multiple
-- products with a null/empty sku (still common on the manual add form,
-- where sku stays optional) never collide.
-- ---------------------------------------------------------------------------
create unique index if not exists products_partner_sku_key
  on products (partner_id, sku)
  where sku is not null and sku <> '';

-- ---------------------------------------------------------------------------
-- storefront_products was missing vat entirely - the actual blocker on
-- showing/charging VAT in the storefront cart, not just app code.
-- `vat` must be appended at the end of the select list, not inserted among
-- the existing columns - CREATE OR REPLACE VIEW can only add new trailing
-- columns, it errors if an existing column's position/name would shift.
-- ---------------------------------------------------------------------------
create or replace view storefront_products as
  select p.id, p.partner_id, p.name, p.sku, p.category, p.sale_price,
         p.stock, p.location, p.shipping_fee, p.pickup_enabled, p.image_url,
         p.vat
  from products p
  join partners pa on pa.id = p.partner_id
  where p.published = true and pa.status = 'active';
