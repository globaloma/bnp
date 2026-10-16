import "server-only";
import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAlertEmail } from "@/lib/notifications";
import { company } from "@/lib/site-content";
import { isWhatsAppConfigured, sendWhatsApp, toE164 } from "@/lib/whatsapp";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bnpfulfillment.com";

export type OrderFeedback = {
  id: string;
  partner_id: string;
  order_ref: string;
  token: string;
  customer_name: string;
  customer_phone: string | null;
  whatsapp_status: "pending" | "sent" | "failed" | "skipped";
  whatsapp_sid: string | null;
  whatsapp_error: string | null;
  sent_at: string | null;
  received_ok: boolean | null;
  rating: number | null;
  review: string | null;
  issue: string | null;
  responded_at: string | null;
  ops_notified_at: string | null;
  issue_resolved_at: string | null;
  created_at: string;
};

export function feedbackUrl(token: string) {
  return `${SITE_URL}/feedback/${token}`;
}

export function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function opsEmails(): string[] {
  const raw = process.env.OPS_ALERT_EMAIL ?? process.env.APPLICATION_TO_EMAIL ?? company.email;
  return raw
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

// Called whenever an order line is set to Delivered (merchant status change,
// merchant edit, or FC status change). Safe to call repeatedly: the unique
// (partner_id, order_ref) key means only the first call for an order creates
// a feedback row and sends the WhatsApp message; later calls (other lines of
// the same order, or toggling status back and forth) do nothing.
export async function requestDeliveryConfirmation(partnerId: string, orderRef: string) {
  const admin = createAdminClient();

  const { data: rows } = await admin
    .from("orders")
    .select("customer_name, customer_phone, status")
    .eq("partner_id", partnerId)
    .eq("order_ref", orderRef);

  if (!rows || !rows.some((r) => r.status === "Delivered")) return;

  const customerName = rows[0].customer_name;
  const rawPhone = rows.find((r) => r.customer_phone)?.customer_phone ?? null;
  // Stored as E.164 so inbound WhatsApp replies (which arrive as
  // whatsapp:+234...) can be matched back to this order.
  const customerPhone = toE164(rawPhone) ?? rawPhone;

  const { data: inserted, error } = await admin
    .from("order_feedback")
    .upsert(
      {
        partner_id: partnerId,
        order_ref: orderRef,
        token: crypto.randomBytes(18).toString("base64url"),
        customer_name: customerName,
        customer_phone: customerPhone,
      },
      { onConflict: "partner_id,order_ref", ignoreDuplicates: true },
    )
    .select("id, token")
    .maybeSingle();

  if (error) {
    console.error("[delivery-feedback] could not create feedback row:", error.message);
    return;
  }
  if (!inserted) return; // Already requested for this order.

  if (!customerPhone || !isWhatsAppConfigured()) {
    await admin
      .from("order_feedback")
      .update({
        whatsapp_status: "skipped",
        whatsapp_error: customerPhone ? "Twilio not configured" : "No customer phone on the order",
      })
      .eq("id", inserted.id);
    return;
  }

  const { data: partner } = await admin
    .from("partners")
    .select("business_name")
    .eq("id", partnerId)
    .maybeSingle();
  const businessName = partner?.business_name ?? "your seller";
  const firstName = customerName.split(/\s+/)[0] || customerName;
  const link = feedbackUrl(inserted.token);

  const templateSid = process.env.TWILIO_DELIVERY_TEMPLATE_SID;
  const result = templateSid
    ? await sendWhatsApp({
        to: customerPhone,
        contentSid: templateSid,
        // Template placeholders: {{1}} name, {{2}} store, {{3}} order ref,
        // {{4}} the feedback token (for a URL button ending in /feedback/{{4}}).
        contentVariables: { "1": firstName, "2": businessName, "3": orderRef, "4": inserted.token },
      })
    : await sendWhatsApp({
        to: customerPhone,
        body:
          `Hi ${firstName}, your order ${orderRef} from ${businessName} has been delivered.\n\n` +
          `Please tap the link to confirm it arrived well and leave a quick review, ` +
          `or let us know if anything is wrong:\n${link}\n\n` +
          `Thank you,\n${company.name}`,
      });

  await admin
    .from("order_feedback")
    .update(
      result.ok
        ? { whatsapp_status: "sent", whatsapp_sid: result.sid, sent_at: new Date().toISOString() }
        : { whatsapp_status: "failed", whatsapp_error: result.error },
    )
    .eq("id", inserted.id);

  if (!result.ok) console.error("[delivery-feedback] WhatsApp send failed:", result.error);
}

// Emails Ops (and the merchant), and pings the Ops WhatsApp number, the
// moment a customer reports a problem - either through the feedback page or
// by replying to the WhatsApp message directly.
export async function alertOpsOfIssue(params: {
  feedback: Pick<OrderFeedback, "id" | "partner_id" | "order_ref" | "customer_name" | "customer_phone">;
  issue: string;
  source: "feedback page" | "WhatsApp reply";
}) {
  const { feedback, issue, source } = params;
  const admin = createAdminClient();

  const { data: partner } = await admin
    .from("partners")
    .select("business_name, email")
    .eq("id", feedback.partner_id)
    .maybeSingle();
  const businessName = partner?.business_name ?? "Unknown merchant";
  const heading =
    source === "feedback page" ? "Customer reported a problem" : "Customer replied on WhatsApp";

  const html = `
    <div style="font-family:system-ui,Segoe UI,sans-serif;max-width:560px;">
      <h2 style="color:#b42318;font-size:18px;margin:0 0 4px;">${heading}</h2>
      <p style="color:#455568;font-size:13px;margin:0 0 16px;">Via ${source}. Please follow up as soon as possible.</p>
      <table style="border-collapse:collapse;font-size:13px;color:#0f2a44;">
        <tr><td style="padding:4px 16px 4px 0;color:#455568;">Order</td><td><b>${escapeHtml(feedback.order_ref)}</b></td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#455568;">Merchant</td><td>${escapeHtml(businessName)}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#455568;">Customer</td><td>${escapeHtml(feedback.customer_name)}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#455568;">Phone</td><td>${escapeHtml(feedback.customer_phone ?? "Not on file")}</td></tr>
      </table>
      <p style="color:#0f2a44;font-size:14px;background:#fef3f2;border-radius:8px;padding:12px;margin:16px 0 0;white-space:pre-wrap;">${escapeHtml(issue)}</p>
      <p style="font-size:13px;margin:16px 0 0;"><a href="${SITE_URL}/admin/feedback" style="color:#2e8b9a;">Open in the admin console</a></p>
    </div>
  `;
  const subject = `${heading}: order ${feedback.order_ref} (${businessName})`;

  await sendAlertEmail({ to: opsEmails(), subject, html });
  if (partner?.email) await sendAlertEmail({ to: [partner.email], subject, html });

  const opsWhatsApp = process.env.OPS_WHATSAPP_TO ?? company.phone;
  if (isWhatsAppConfigured() && opsWhatsApp) {
    const result = await sendWhatsApp({
      to: opsWhatsApp,
      body:
        `${heading}: order ${feedback.order_ref} (${businessName}).\n` +
        `Customer: ${feedback.customer_name}, ${feedback.customer_phone ?? "no phone"}\n\n` +
        `"${issue.slice(0, 900)}"`,
    });
    if (!result.ok) console.error("[delivery-feedback] Ops WhatsApp alert failed:", result.error);
  }

  await admin
    .from("order_feedback")
    .update({ ops_notified_at: new Date().toISOString() })
    .eq("id", feedback.id);
}
