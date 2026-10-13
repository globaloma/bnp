-- Optional product description for the storefront product page.

alter table products add column if not exists description text
  check (description is null or length(description) <= 2000);

-- Appended at the end, since CREATE OR REPLACE VIEW can't reorder columns.
create or replace view storefront_products as
  select p.id, p.partner_id, p.name, p.sku, p.category, p.sale_price,
         p.stock, p.location, p.shipping_fee, p.pickup_enabled, p.image_url,
         p.vat, p.description
  from products p
  join partners pa on pa.id = p.partner_id
  where p.published = true and pa.status = 'active';
