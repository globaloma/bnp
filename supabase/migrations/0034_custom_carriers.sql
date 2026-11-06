-- Custom carriers: any logistics company, not just UPS and GIG.
--
--  Until now the only external carriers were UPS and GIG, hardcoded in a check
--  constraint on delivery_rate_cards.carrier, in the delivery_method check on
--  orders, and in the delivery_quote() function. This adds a carriers registry
--  so admins can add any logistics company by name on /admin/delivery, upload
--  its CSV rate card (exactly like UPS), and have it priced and offered to
--  merchants and store customers straight away.
--
--  A delivery method is now either a reserved method (bnp_dispatch, walk_in,
--  own_rider) or a carrier code (gig, ups, or any new slug). Rate cards key by
--  the carrier code, which is identical to the delivery_method, so the old
--  method->carrier mapping is just identity. GIG keeps its live pricing; UPS
--  and every new carrier are pure rate-card (admin puts the final price in
--  rate_ngn).

begin;

-- ---------------------------------------------------------------------------
-- 1. Carriers registry
-- ---------------------------------------------------------------------------
create table if not exists carriers (
  code       text primary key check (code ~ '^[a-z0-9_]{2,20}$'),
  label      text not null check (length(label) between 1 and 60),
  active     boolean not null default true,
  sort       integer not null default 100,
  created_at timestamptz not null default now()
);

insert into carriers (code, label, sort) values
  ('gig', 'GIG Logistics', 10),
  ('ups', 'UPS', 20)
on conflict (code) do nothing;

alter table carriers enable row level security;
-- Customers see carrier options at checkout, so the registry is public to read.
drop policy if exists "carriers read" on carriers;
create policy "carriers read" on carriers for select using (true);
drop policy if exists "carriers admin" on carriers;
create policy "carriers admin" on carriers for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- 2. Rate cards now key by carrier code (lowercase), with a foreign key
-- ---------------------------------------------------------------------------
-- Existing rows hold 'UPS'/'GIG'; bring them to the code the registry uses.
update delivery_rate_cards set carrier = lower(carrier)
  where carrier <> lower(carrier);

alter table delivery_rate_cards drop constraint if exists delivery_rate_cards_carrier_check;
alter table delivery_rate_cards drop constraint if exists delivery_rate_cards_carrier_fkey;
alter table delivery_rate_cards
  add constraint delivery_rate_cards_carrier_fkey
  foreign key (carrier) references carriers (code);

-- ---------------------------------------------------------------------------
-- 3. Orders: allow any carrier code as a delivery method
-- ---------------------------------------------------------------------------
-- A check can't reference another table, so this is a shape check only; the
-- real guards are delivery_quote() (no rates -> not bookable) and the checkout,
-- which only offer carriers that have live rates.
alter table orders drop constraint if exists orders_delivery_method_check;
alter table orders add constraint orders_delivery_method_check
  check (
    delivery_method is null
    or delivery_method in ('bnp_dispatch', 'walk_in', 'own_rider')
    or delivery_method ~ '^[a-z0-9_]{2,20}$'
  );

-- ---------------------------------------------------------------------------
-- 4. Price for a delivery, generalised to any carrier code
-- ---------------------------------------------------------------------------
create or replace function delivery_quote(p_method text, p_hub warehouse_location, p_zone text,
                                          p_weight numeric default 0)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare
  v numeric;
begin
  if p_method is null or p_method = 'own_rider' then
    return null;
  elsif p_method = 'walk_in' then
    return case when p_hub = 'Abuja' then 0 else null end;
  elsif p_method = 'bnp_dispatch' then
    select rate into v from dispatch_zones where hub = p_hub and name = p_zone and active;
    return v;
  else
    -- Any carrier code (gig, ups, or a custom logistics company).
    select rate into v from delivery_rate_cards
    where carrier = p_method and origin_hub = p_hub and destination_zone = p_zone
      and is_active and weight_min_kg <= coalesce(p_weight, 0) and weight_max_kg > coalesce(p_weight, 0)
      and effective_from <= current_date and (effective_to is null or effective_to >= current_date)
    order by effective_from desc limit 1;
    return v;
  end if;
end $$;
grant execute on function delivery_quote(text, warehouse_location, text, numeric) to anon, authenticated;

commit;
