-- ---------------------------------------------------------------------------
-- Receiving: the quantity you enter is the TOTAL for that item on this
-- delivery, not an amount to add on top of what was already counted.
--
-- Before: every scan did `received_qty = received_qty + p_qty`, so scanning a
-- box of 698 twice left 1,396 on the line, and any count left over from an
-- earlier attempt stacked underneath the new one ("5 extra", then 703, then
-- 1,401...). Staff had no way to say "this delivery holds exactly 698".
--
-- After: the quantity is authoritative. Scanning 698 sets the line to 698;
-- scanning it again keeps it at 698. Each delivery's line is still keyed by
-- (delivery_id, product_id), so one delivery never touches another's count.
-- Staged stock moves by the *difference* only, so on-hand stays correct, and
-- lowering a count below what has already been put away is refused (use the
-- take-back button, which moves staged units one at a time).
-- ---------------------------------------------------------------------------

create or replace function receive_scan(p_delivery uuid, p_code text, p_qty int default 1)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d inbound_deliveries;
  found_product record;
  prod products;
  owner_name text;
  ln inbound_delivery_lines;
  old_received int;
  delta int;
  tone text := 'success';
  msg text;
begin
  perform require_warehouse();
  if p_qty is null or p_qty < 1 or p_qty > 10000 then
    return scan_result(false, 'error', 'Quantity must be between 1 and 10,000.');
  end if;

  select * into d from inbound_deliveries where id = p_delivery for update;
  if d.id is null then return scan_result(false, 'error', 'Delivery not found.'); end if;
  if d.status in ('received', 'cancelled') then
    return scan_result(false, 'error', 'This delivery is already ' || d.status || '.');
  end if;
  if upper(btrim(coalesce(p_code, ''))) like 'BIN-%' then
    return scan_result(false, 'error', 'That is a bin label. Scan the item instead.');
  end if;

  select * into found_product from find_scanned_product(p_code, d.partner_id);
  if found_product.ambiguous then
    return scan_result(false, 'error', 'Several products share this barcode. Scan the BNP label instead.');
  end if;
  if found_product.product_id is null then
    return scan_result(false, 'error', 'Unknown barcode: ' || btrim(p_code));
  end if;

  select * into prod from products where id = found_product.product_id;
  if prod.partner_id <> d.partner_id then
    select business_name into owner_name from partners where id = prod.partner_id;
    return scan_result(false, 'error',
      'Wrong merchant: ' || product_label(prod) || ' belongs to ' || coalesce(owner_name, 'another merchant') || '.');
  end if;
  if prod.location <> d.location then
    return scan_result(false, 'error',
      product_label(prod) || ' is set up for the ' || prod.location || ' warehouse, not ' || d.location || '.');
  end if;

  -- What this product's count on THIS delivery was before the scan.
  select received_qty into old_received
    from inbound_delivery_lines where delivery_id = d.id and product_id = prod.id;
  old_received := coalesce(old_received, 0);
  delta := p_qty - old_received;

  -- Lowering a count only works while the units are still waiting to be put
  -- away; once binned they have to be taken back one at a time.
  if delta < 0 and prod.staged < -delta then
    return scan_result(false, 'error',
      'Can''t lower ' || product_label(prod) || ' to ' || p_qty ||
      ': some of those units have already been put away. Use the take-back button instead.');
  end if;

  -- The quantity is the total for this line, not an amount to add.
  insert into inbound_delivery_lines (delivery_id, product_id, expected_qty, received_qty)
  values (d.id, prod.id, 0, p_qty)
  on conflict (delivery_id, product_id)
    do update set received_qty = excluded.received_qty, updated_at = now()
  returning * into ln;

  if d.status = 'announced' then
    update inbound_deliveries set status = 'receiving', started_at = now() where id = d.id;
  end if;

  -- Move only the difference, so the same box scanned twice doesn't stage twice.
  if delta <> 0 then
    perform apply_staged(prod.id, delta, d.ref, null);
  end if;

  if ln.expected_qty = 0 then
    tone := 'warning';
    msg := 'Not on the delivery list: ' || product_label(prod) || '. Counted ' || ln.received_qty || '.';
  elsif ln.received_qty > ln.expected_qty then
    tone := 'warning';
    msg := 'More than expected: ' || product_label(prod) || ' ' || ln.received_qty || ' of ' || ln.expected_qty || '.';
  elsif ln.received_qty = ln.expected_qty then
    msg := product_label(prod) || ' complete: ' || ln.received_qty || ' of ' || ln.expected_qty || '.';
  else
    msg := product_label(prod) || ': ' || ln.received_qty || ' of ' || ln.expected_qty || '.';
  end if;

  return scan_result(true, tone, msg, jsonb_build_object(
    'product_id', prod.id, 'received', ln.received_qty, 'expected', ln.expected_qty));
end $$;
