-- Location-based delivery pricing for storefront checkout. Each merchant
-- defines their own delivery zones (e.g. "Abuja" 1200, "Lagos" 3500,
-- "Other states" 5000) and the customer picks one at checkout. Replaces
-- the flat per-product shipping_fee for any merchant that has at least one
-- zone; merchants with no zones keep the old behaviour as a fallback.
--
-- Pickup needs no schema: storefront pickup orders are recorded with the
-- existing order_rider value 'Pickup' and no shipping line.

create table if not exists delivery_zones (
  id          uuid primary key default gen_random_uuid(),
  partner_id  uuid not null references partners(id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 80),
  fee         numeric(14, 2) not null default 0 check (fee >= 0),
  created_at  timestamptz not null default now()
);

create index if not exists delivery_zones_partner_idx on delivery_zones (partner_id);

alter table delivery_zones enable row level security;

drop policy if exists "delivery zones all own" on delivery_zones;
create policy "delivery zones all own" on delivery_zones
  for all using (owns_partner(partner_id)) with check (owns_partner(partner_id));

-- Public read for the storefront, same pattern as storefront_products:
-- a view over active merchants only, so anon never gets a policy on the
-- base table.
create or replace view storefront_delivery_zones as
  select z.id, z.partner_id, z.name, z.fee
  from delivery_zones z
  join partners p on p.id = z.partner_id
  where p.status = 'active';

grant select on storefront_delivery_zones to anon, authenticated;
