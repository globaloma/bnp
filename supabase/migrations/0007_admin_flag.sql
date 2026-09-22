-- 0006 modeled admin as a third partner_role, but that makes admin and
-- fulfillment_center/merchant mutually exclusive - promoting an FC account
-- to admin would strip its FC dashboard access. Admin is really an overlay
-- capability (BNP staff who are often also running an FC or merchant
-- account day to day), not a replacement identity. Switch to a separate
-- boolean flag instead. `role` should never actually be set to 'admin'
-- going forward; the enum value added in 0006 is harmless but unused
-- (Postgres doesn't support dropping enum values, so it just stays dormant
-- rather than being removed).

alter table partners add column if not exists is_admin boolean not null default false;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from partners p where p.id = auth.uid() and p.is_admin = true
  );
$$;
