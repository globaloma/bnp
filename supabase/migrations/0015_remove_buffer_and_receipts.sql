-- 1. Remove the wallet buffer. Merchants used to have 30,000 locked in their
-- wallet, with fulfillment suspended whenever the balance dipped below it.
-- The whole balance is now usable and withdrawable; the column stays (at 0)
-- so wallet_debit and the existing integrity policy keep working unchanged.

alter table partners alter column wallet_buffer set default 0;
update partners set wallet_buffer = 0 where wallet_buffer <> 0;

-- 2. Receipt PDFs shared over WhatsApp/email. Private bucket: receipts carry
-- customer names, phones and addresses, so they're only reachable through
-- a time-limited signed URL the merchant generates when sharing. Files live
-- under receipts/<partner_id>/<order_ref>-<random>.pdf.

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists "receipts partner read" on storage.objects;
create policy "receipts partner read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "receipts partner write" on storage.objects;
create policy "receipts partner write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
