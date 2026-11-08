-- Make CSV import's upsert on (partner_id, sku) actually work.
--
-- The inventory CSV import upserts with ON CONFLICT (partner_id, sku), but the
-- uniqueness was a PARTIAL unique index (0008):
--     create unique index products_partner_sku_key on products (partner_id, sku)
--       where sku is not null and sku <> '';
-- Postgres can only use a partial index as an ON CONFLICT arbiter when the
-- statement repeats the same WHERE predicate, which the PostgREST/supabase-js
-- upsert does not emit. So every import failed with:
--     "there is no unique or exclusion constraint matching the ON CONFLICT
--      specification".
--
-- Replace the partial index with a plain unique constraint on (partner_id, sku)
-- that the upsert can target. Empty strings are normalised to null first; null
-- skus stay allowed and never collide (a unique constraint treats nulls as
-- distinct), so the manual add form — where sku is optional — is unaffected.

begin;

-- Any legacy empty-string skus become null so they don't collide under the
-- non-partial constraint (the import already stores a real sku on every row).
update products set sku = null where sku = '';

drop index if exists products_partner_sku_key;

alter table products
  add constraint products_partner_sku_key unique (partner_id, sku);

commit;
