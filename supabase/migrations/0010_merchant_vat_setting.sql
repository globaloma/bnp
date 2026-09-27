-- VAT is a per-merchant business decision (some merchants charge it, some
-- don't), not something that varies order to order. Replaces the earlier
-- per-order "Apply VAT" toggle with one setting on the partner's account
-- that governs both dashboard-created orders and storefront checkout.

alter table partners add column if not exists charges_vat boolean not null default true;

-- Expose it on the public storefront view too, so the storefront can hide
-- VAT entirely for merchants who don't charge it. Appended at the end of
-- the select list - CREATE OR REPLACE VIEW errors if an existing column's
-- position/name would shift (learned this the hard way in 0008).
create or replace view storefront_partners as
  select id, slug, business_name, category, charges_vat
  from partners
  where status = 'active';
