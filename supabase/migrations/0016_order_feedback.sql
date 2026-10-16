-- Delivery confirmation + issue escalation (roadmap tasks 9-10).
--
-- When an order is marked Delivered, the customer gets a WhatsApp message
-- (via Twilio) with a private link to /feedback/[token]. On that page they
-- either confirm the order arrived well and leave a rating/review, or report
-- a problem, which alerts Ops immediately. One row per order (order_ref),
-- not per order line, so a multi-product order only messages the customer
-- once - the unique key below is what makes that idempotent.

create table if not exists order_feedback (
  id                 uuid primary key default gen_random_uuid(),
  partner_id         uuid not null references partners (id) on delete cascade,
  order_ref          text not null,
  token              text not null unique,
  customer_name      text not null,
  customer_phone     text,
  whatsapp_status    text not null default 'pending', -- pending | sent | failed | skipped
  whatsapp_sid       text,
  whatsapp_error     text,
  sent_at            timestamptz,
  received_ok        boolean,
  rating             integer check (rating between 1 and 5),
  review             text,
  issue              text,
  responded_at       timestamptz,
  ops_notified_at    timestamptz,
  issue_resolved_at  timestamptz,
  created_at         timestamptz not null default now(),
  unique (partner_id, order_ref)
);
create index if not exists order_feedback_partner_idx on order_feedback (partner_id, created_at desc);
create index if not exists order_feedback_phone_idx on order_feedback (customer_phone, created_at desc);

alter table order_feedback enable row level security;

drop policy if exists "order_feedback partner read" on order_feedback;
create policy "order_feedback partner read" on order_feedback
  for select using (partner_id = auth.uid() or is_admin());

drop policy if exists "order_feedback admin update" on order_feedback;
create policy "order_feedback admin update" on order_feedback
  for update using (is_admin()) with check (is_admin());

-- Free-text WhatsApp replies customers send back to the Twilio number.
-- Matched to their most recent order_feedback row by phone when possible,
-- and forwarded to Ops either way.
create table if not exists whatsapp_inbound (
  id           uuid primary key default gen_random_uuid(),
  from_phone   text not null,
  body         text not null default '',
  feedback_id  uuid references order_feedback (id) on delete set null,
  twilio_sid   text unique,
  created_at   timestamptz not null default now()
);
create index if not exists whatsapp_inbound_created_idx on whatsapp_inbound (created_at desc);

alter table whatsapp_inbound enable row level security;

drop policy if exists "whatsapp_inbound admin read" on whatsapp_inbound;
create policy "whatsapp_inbound admin read" on whatsapp_inbound
  for select using (is_admin());
