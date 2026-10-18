import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { InboundDeliveryLine, WarehouseLocation } from "@/types/db";
import { getFulfillmentCenterEmails, sendAlertEmail } from "@/lib/notifications";
import { escapeHtml } from "@/lib/spam-guard";

// Inbound deliveries: merchants announce what they're sending, the warehouse
// receives it by scanning (migration 0023). These helpers wrap the database
// functions and send the emails around them.

export type AnnounceLine = { productId: string; qty: number };

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bnpfulfillment.com";

function friendlyError(message: string): string {
  // Messages raised by our database functions are written for people;
  // anything technical (schema, permissions, connection) is not.
  if (/schema cache|permission denied|violates|syntax|relation|column|JWT|fetch failed/i.test(message)) {
    return "Something went wrong on our side. Try again, or tell your supervisor if it keeps happening.";
  }
  return message.replace(/^.*?ERROR:\s*/, "");
}

/**
 * Announces one delivery per warehouse location and emails the fulfillment
 * centers. Runs as the signed-in merchant.
 */
export async function announceDeliveries(
  supabase: SupabaseClient,
  merchant: { id: string; business_name: string },
  lines: (AnnounceLine & { location: WarehouseLocation; label: string })[],
  options: { expectedOn?: string | null; note?: string | null } = {},
): Promise<{ ok: true; refs: string[] } | { ok: false; error: string }> {
  const byLocation = new Map<WarehouseLocation, typeof lines>();
  for (const line of lines) {
    if (line.qty <= 0) continue;
    byLocation.set(line.location, [...(byLocation.get(line.location) ?? []), line]);
  }
  if (byLocation.size === 0) return { ok: false, error: "Add at least one product with a quantity." };

  const refs: string[] = [];
  const fcEmails = await getFulfillmentCenterEmails();
  for (const [location, group] of byLocation) {
    const { data: deliveryId, error } = await supabase.rpc("announce_delivery", {
      p_location: location,
      p_expected_on: options.expectedOn || null,
      p_note: options.note || null,
      p_lines: group.map((l) => ({ product_id: l.productId, qty: l.qty })),
    });
    if (error) return { ok: false, error: friendlyError(error.message) };

    const { data: delivery } = await supabase
      .from("inbound_deliveries")
      .select("ref")
      .eq("id", deliveryId as string)
      .single();
    const ref = delivery?.ref ?? "";
    refs.push(ref);

    const total = group.reduce((sum, l) => sum + l.qty, 0);
    const items = group
      .map(
        (l) =>
          `<li style="color:#0f2a44;font-size:13px;margin:2px 0;"><strong>${escapeHtml(l.label)}</strong> x${l.qty}</li>`,
      )
      .join("");
    await sendAlertEmail({
      to: fcEmails,
      subject: `Delivery ${ref} on the way: ${merchant.business_name} (${total} units)`,
      html: `
        <div style="font-family:system-ui,Segoe UI,sans-serif;max-width:560px;">
          <h2 style="color:#0f2a44;font-size:18px;margin:0 0 4px;">A merchant is sending stock</h2>
          <p style="color:#455568;font-size:13px;margin:0 0 12px;">
            ${escapeHtml(merchant.business_name)} announced delivery <strong>${escapeHtml(ref)}</strong> to the ${location} warehouse${
              options.expectedOn ? `, expected ${escapeHtml(options.expectedOn)}` : ""
            }.
          </p>
          <ul style="margin:0;padding-left:18px;">${items}</ul>
          ${options.note ? `<p style="color:#455568;font-size:13px;margin:12px 0 0;">Note: ${escapeHtml(options.note)}</p>` : ""}
          <p style="margin:16px 0 0;"><a href="${SITE_URL}/fc/receiving" style="color:#1a6475;font-size:13px;">Open receiving</a></p>
        </div>
      `,
    });
  }
  return { ok: true, refs };
}

/** Emails the merchant what was counted in, flagging anything that didn't match. */
export async function emailReceivingSummary(params: {
  to: string;
  merchantName: string;
  ref: string;
  location: WarehouseLocation;
  lines: (Pick<InboundDeliveryLine, "expected_qty" | "received_qty"> & { label: string })[];
}) {
  const gaps = params.lines.filter((l) => l.expected_qty !== l.received_qty);
  const rows = params.lines
    .map((l) => {
      const diff = l.received_qty - l.expected_qty;
      const flag =
        diff === 0
          ? ""
          : l.expected_qty === 0
            ? " (not on your list)"
            : diff < 0
              ? ` (${-diff} short)`
              : ` (${diff} extra)`;
      const colour = diff === 0 ? "#0f2a44" : "#b45309";
      return `<tr><td style="padding:4px 12px 4px 0;font-size:13px;color:${colour};">${escapeHtml(l.label)}</td><td style="padding:4px 12px 4px 0;font-size:13px;color:#455568;">${l.expected_qty}</td><td style="padding:4px 0;font-size:13px;color:${colour};font-weight:600;">${l.received_qty}${flag}</td></tr>`;
    })
    .join("");

  await sendAlertEmail({
    to: [params.to],
    subject: gaps.length
      ? `Delivery ${params.ref} received, ${gaps.length} item${gaps.length === 1 ? "" : "s"} didn't match`
      : `Delivery ${params.ref} received in full`,
    html: `
      <div style="font-family:system-ui,Segoe UI,sans-serif;max-width:560px;">
        <h2 style="color:#0f2a44;font-size:18px;margin:0 0 4px;">Your stock has arrived</h2>
        <p style="color:#455568;font-size:13px;margin:0 0 12px;">
          Hi ${escapeHtml(params.merchantName)}, we counted delivery <strong>${escapeHtml(params.ref)}</strong> into the ${params.location} warehouse.
          ${gaps.length ? "Some items didn't match what you announced, marked below." : "Everything matched what you announced."}
        </p>
        <table style="border-collapse:collapse;">
          <tr><th style="text-align:left;padding:4px 12px 4px 0;font-size:12px;color:#8a97a8;">Product</th><th style="text-align:left;padding:4px 12px 4px 0;font-size:12px;color:#8a97a8;">Announced</th><th style="text-align:left;padding:4px 0;font-size:12px;color:#8a97a8;">Received</th></tr>
          ${rows}
        </table>
        <p style="margin:16px 0 0;"><a href="${SITE_URL}/dashboard/deliveries" style="color:#1a6475;font-size:13px;">See your deliveries</a></p>
      </div>
    `,
  });
}

export { friendlyError };
