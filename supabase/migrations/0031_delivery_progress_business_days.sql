-- Delivery progress on dispatched orders, and invoice grace in business days.
--
-- 1. Delivery progress (spec 3.7 delivery statuses IN_TRANSIT and FAILED).
--    The order status stays Dispatched, so stock and billing rules are
--    untouched; delivery_progress records where the parcel is on the road:
--      null        dispatched, nothing reported yet
--      in_transit  on the way to the customer
--      failed      a delivery attempt failed (reason in delivery_failure_note)
--    A failed order is tried again (back to in_transit) or marked Returned or
--    Delivered as before. delivery_failed_attempts counts the failures.
--    Set through set_delivery_progress() by warehouse staff, admins or the
--    order's merchant.
--
-- 2. Standard invoices are due at the end of the third business day
--    (Monday to Friday, Lagos time) after the day they're issued, instead of
--    3 calendar days. billing_settings.grace_days is now a count of business
--    days. Public holidays aren't skipped.

begin;

alter table orders add column if not exists delivery_progress text
  check (delivery_progress is null or delivery_progress in ('in_transit', 'failed'));
alter table orders add column if not exists delivery_progress_at timestamptz;
alter table orders add column if not exists delivery_failed_attempts integer not null default 0
  check (delivery_failed_attempts >= 0);
alter table orders add column if not exists delivery_failure_note text
  check (delivery_failure_note is null or length(delivery_failure_note) <= 200);

create or replace function set_delivery_progress(
  p_partner uuid,
  p_order_ref text,
  p_progress text,
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
  note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if auth.uid() is null
     or not (auth.uid() = p_partner or is_fulfillment_center() or is_admin()) then
    raise exception 'You can''t update this order.' using errcode = '42501';
  end if;
  if p_progress not in ('in_transit', 'failed') then
    raise exception 'Unknown delivery progress.' using errcode = '22023';
  end if;
  if p_progress = 'failed' and (note is null or length(note) < 3) then
    raise exception 'Say why the delivery failed.' using errcode = '22023';
  end if;

  update orders set
    delivery_progress = p_progress,
    delivery_progress_at = now(),
    delivery_failed_attempts = delivery_failed_attempts + case when p_progress = 'failed' then 1 else 0 end,
    delivery_failure_note = case when p_progress = 'failed' then left(note, 200) else delivery_failure_note end
  where partner_id = p_partner and order_ref = p_order_ref and status = 'Dispatched';
  get diagnostics n = row_count;

  if n = 0 then
    raise exception 'Only dispatched orders can be marked in transit or failed.' using errcode = 'P0001';
  end if;
  return n;
end $$;

revoke all on function set_delivery_progress(uuid, text, text, text) from public;
grant execute on function set_delivery_progress(uuid, text, text, text) to authenticated;

-- End of the nth Monday-to-Friday after the issue day, Lagos time.
create or replace function add_business_days(p_from timestamptz, p_days integer)
returns timestamptz
language plpgsql
immutable
as $$
declare
  d date := (p_from at time zone 'Africa/Lagos')::date;
  left_to_count integer := greatest(p_days, 0);
begin
  while left_to_count > 0 loop
    d := d + 1;
    if extract(isodow from d) < 6 then
      left_to_count := left_to_count - 1;
    end if;
  end loop;
  return ((d + 1)::timestamp at time zone 'Africa/Lagos') - interval '1 second';
end $$;

create or replace function invoices_due_business_days()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.due_at := add_business_days(
    coalesce(new.issued_at, now()),
    (select grace_days from billing_settings where id)
  );
  return new;
end $$;

drop trigger if exists invoices_due_business_days on invoices;
create trigger invoices_due_business_days
  before insert on invoices
  for each row execute function invoices_due_business_days();

comment on column billing_settings.grace_days is
  'Business days (Monday to Friday) a Standard invoice has before it is overdue.';

commit;
