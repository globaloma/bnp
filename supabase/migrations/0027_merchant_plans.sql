-- Merchant plans: Standard and Enterprise (Technical Specification v2,
-- section 2). Merchants pick one at sign-up and can switch in Settings.
-- This records the choice; plan-specific billing (Standard invoices,
-- Enterprise wallet buffer and insurance) is built separately.

begin;

alter table partners add column if not exists plan_type text not null default 'standard'
  check (plan_type in ('standard', 'enterprise'));
alter table partners add column if not exists plan_changed_at timestamptz;

-- New sign-ups carry their chosen plan in the auth metadata.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  chosen text := lower(coalesce(new.raw_user_meta_data ->> 'plan_type', 'standard'));
begin
  insert into partners (id, business_name, contact_name, email, phone, category, role, slug, plan_type)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'business_name', 'New partner'),
    coalesce(new.raw_user_meta_data ->> 'contact_name', ''),
    new.email,
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'category',
    coalesce((new.raw_user_meta_data ->> 'role')::partner_role, 'merchant'),
    unique_partner_slug(coalesce(new.raw_user_meta_data ->> 'business_name', 'New partner')),
    case when chosen in ('standard', 'enterprise') then chosen else 'standard' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- Merchants change their own plan through this, not a column grant, so
-- only plan_type moves and only for merchant accounts.
create or replace function set_my_plan(p_plan text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_plan not in ('standard', 'enterprise') then raise exception 'Choose Standard or Enterprise.'; end if;
  update partners set plan_type = p_plan, plan_changed_at = now()
  where id = auth.uid() and role = 'merchant' and plan_type <> p_plan;
end $$;

grant execute on function set_my_plan(text) to authenticated;

commit;
