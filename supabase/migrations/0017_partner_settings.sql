-- Account settings for partners, plus closing a privilege gap on `partners`.
--
-- The gap: "partners update own" (0002) is row-level, and its WITH CHECK
-- only pins wallet_balance, wallet_buffer and status. Every other column
-- was writable by the signed-in partner straight through the REST API,
-- including is_admin (self-promotion to admin), role, slug and
-- paystack_recipient_code (redirecting withdrawals). Postgres column
-- privileges fix this at the source: partners can now only UPDATE the
-- profile fields the settings page edits. Everything else goes through
-- security-definer functions or the service-role client.

alter table partners add column if not exists logo_url text;

revoke update on partners from anon, authenticated;
grant update (business_name, contact_name, phone, category, charges_vat, logo_url)
  on partners to authenticated;

-- Business logos, same per-partner folder layout as product-images
-- (partner-logos/<partner_id>/<file>). Public read so the storefront can
-- show them without signed URLs.
insert into storage.buckets (id, name, public)
values ('partner-logos', 'partner-logos', true)
on conflict (id) do nothing;

drop policy if exists "partner logos public read" on storage.objects;
create policy "partner logos public read" on storage.objects
  for select using (bucket_id = 'partner-logos');

drop policy if exists "partner logos partner write" on storage.objects;
create policy "partner logos partner write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'partner-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "partner logos partner delete" on storage.objects;
create policy "partner logos partner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'partner-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Expose the logo on the public storefront view. Appended at the end of the
-- select list, since CREATE OR REPLACE VIEW can't reorder existing columns.
create or replace view storefront_partners as
  select id, slug, business_name, category, charges_vat, logo_url
  from partners
  where status = 'active';
