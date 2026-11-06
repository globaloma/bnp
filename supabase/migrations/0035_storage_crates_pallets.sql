-- Storage measured as crates and pallets.
--
--  Until now the warehouse set one m² number per merchant (storage_sqm), billed
--  at ₦10,000/m². The FC now records space as CRATES (small items) and PALLETS
--  (bulky items stacked, e.g. cartons of bottled water). A pallet's charge grows
--  with how high it is stacked. Crates and pallets roll up into the billable m²,
--  which stays the charged unit, so monthly billing is unchanged: a taller pallet
--  stack simply produces a larger m²-equivalent.
--
--  billable_sqm = crates*crate_m2
--               + pallets*pallet_m2*pallet_mult
--  where pallet_mult = 1 for a stack up to the reference height, and more in
--  proportion above it (a 2 m stack at a 1 m reference counts as 2 footprints).

begin;

-- ---------------------------------------------------------------------------
-- 1. Settings: how a crate / pallet converts to billable m²
-- ---------------------------------------------------------------------------
alter table billing_settings add column if not exists crate_m2 numeric(8,3) not null default 0.25
  check (crate_m2 >= 0);
alter table billing_settings add column if not exists pallet_m2 numeric(8,3) not null default 1.20
  check (pallet_m2 >= 0);
alter table billing_settings add column if not exists pallet_ref_height_m numeric(6,2) not null default 1.00
  check (pallet_ref_height_m > 0);

-- ---------------------------------------------------------------------------
-- 2. Per-merchant crate / pallet counts (storage_sqm stays, now derived)
-- ---------------------------------------------------------------------------
alter table partners add column if not exists storage_crates integer not null default 0
  check (storage_crates >= 0);
alter table partners add column if not exists storage_pallets integer not null default 0
  check (storage_pallets >= 0);
alter table partners add column if not exists storage_pallet_height_m numeric(6,2) not null default 0
  check (storage_pallet_height_m >= 0);

-- ---------------------------------------------------------------------------
-- 3. Set a merchant's storage from crates + pallets, deriving storage_sqm
-- ---------------------------------------------------------------------------
create or replace function set_storage_space(
  p_partner uuid,
  p_crates integer,
  p_pallets integer,
  p_height numeric
) returns numeric language plpgsql security definer set search_path = public as $$
declare
  s billing_settings;
  mult numeric;
  sqm numeric;
begin
  perform require_warehouse();
  if p_crates is null or p_crates < 0 or p_crates > 100000 then raise exception 'Enter the number of crates.'; end if;
  if p_pallets is null or p_pallets < 0 or p_pallets > 100000 then raise exception 'Enter the number of pallets.'; end if;
  if p_height is null or p_height < 0 or p_height > 100 then raise exception 'Enter the pallet stack height in metres.'; end if;

  select * into s from billing_settings;
  mult := case when p_height <= 0 then 1 else greatest(1, round(p_height / s.pallet_ref_height_m, 2)) end;
  sqm := round(p_crates * s.crate_m2 + p_pallets * s.pallet_m2 * mult, 2);

  update partners
    set storage_crates = p_crates,
        storage_pallets = p_pallets,
        storage_pallet_height_m = round(p_height, 2),
        storage_sqm = sqm
  where id = p_partner and role = 'merchant';
  if not found then raise exception 'Merchant not found.'; end if;
  return sqm;
end $$;
grant execute on function set_storage_space(uuid, integer, integer, numeric) to authenticated;

commit;
