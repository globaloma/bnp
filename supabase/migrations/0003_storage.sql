-- Storage buckets for product photos and return/claim photos.
-- Files are stored under a path prefixed with the partner's own user id,
-- e.g. product-images/<partner_id>/<filename>, and policies check that
-- prefix so a partner can only write into their own folder. Both buckets
-- are public for read since product photos need to render on the storefront
-- and in the dashboard without a signed URL round trip.

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('claim-images', 'claim-images', true)
on conflict (id) do nothing;

drop policy if exists "product images public read" on storage.objects;
create policy "product images public read" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "product images partner write" on storage.objects;
create policy "product images partner write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "product images partner delete" on storage.objects;
create policy "product images partner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "claim images public read" on storage.objects;
create policy "claim images public read" on storage.objects
  for select using (bucket_id = 'claim-images');

drop policy if exists "claim images partner write" on storage.objects;
create policy "claim images partner write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'claim-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
