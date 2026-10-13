-- Public storefront details a merchant chooses to show customers: a short
-- "about" blurb and how to reach them. Separate from the account phone and
-- email on `partners`, which are private to BNP and never shown publicly.

alter table partners add column if not exists store_description text
  check (store_description is null or length(store_description) <= 500);
alter table partners add column if not exists store_whatsapp text
  check (store_whatsapp is null or length(store_whatsapp) <= 20);
alter table partners add column if not exists store_instagram text
  check (store_instagram is null or store_instagram ~ '^[A-Za-z0-9._]{1,30}$');

-- Partners edit these themselves from Settings (see 0017 for why UPDATE is
-- granted per column).
grant update (store_description, store_whatsapp, store_instagram)
  on partners to authenticated;

-- Appended at the end, since CREATE OR REPLACE VIEW can't reorder columns.
create or replace view storefront_partners as
  select id, slug, business_name, category, charges_vat, logo_url,
         store_description, store_whatsapp, store_instagram
  from partners
  where status = 'active';
