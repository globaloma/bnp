import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResend } from "@/lib/resend";
import { naira } from "@/lib/format";
import { escapeHtml } from "@/lib/spam-guard";

export const ALERT_FROM =
  process.env.APPLICATION_FROM_EMAIL || "BNP Fulfillment <onboarding@resend.dev>";

export async function getFulfillmentCenterEmails(): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("partners")
    .select("email")
    .eq("role", "fulfillment_center")
    .eq("status", "active");

  return (data ?? []).map((p) => p.email).filter((email): email is string => Boolean(email));
}

/** Sends an email through Resend. Resolves to whether it was accepted. */
export async function sendAlertEmail(params: {
  to: string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  /** Files to attach, content base64-encoded. */
  attachments?: { filename: string; content: string }[];
}): Promise<boolean> {
  if (params.to.length === 0) return false;

  const resend = getResend();
  if (!resend) return false;

  try {
    const { error } = await resend.emails.send({
      from: params.from ?? ALERT_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      ...(params.replyTo ? { replyTo: params.replyTo } : {}),
      ...(params.attachments?.length ? { attachments: params.attachments } : {}),
    });
    if (error) {
      console.error("[alert-email] Resend error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[alert-email] Unexpected error:", err);
    return false;
  }
}

/** "Ada's Shop via BNP Fulfillment <contact@...>", using ALERT_FROM's address. */
export function fromAs(businessName: string): string {
  const address = ALERT_FROM.match(/<([^>]+)>/)?.[1] ?? ALERT_FROM;
  const name = businessName.replace(/[<>",]/g, "").trim() || "Your order";
  return `${name} via BNP Fulfillment <${address}>`;
}

export function orderItemRowsHtml(
  lines: { product_name: string; quantity: number; total: number }[],
): string {
  return lines
    .map(
      (r) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#455568;font-size:13px;">${escapeHtml(r.product_name)} × ${r.quantity}</td><td style="padding:6px 0;color:#0f2a44;font-size:13px;font-weight:600;text-align:right;">${naira(r.total)}</td></tr>`,
    )
    .join("");
}

/**
 * Tells every active fulfillment center about an order to fulfill, whether
 * it came in through a storefront payment or a merchant created it in their
 * dashboard.
 */
export async function alertFulfillmentCenters(params: {
  merchantName: string;
  orderRef: string;
  customerName: string;
  lines: { product_name: string; quantity: number; total: number }[];
  source: "storefront" | "dashboard";
  /** e.g. "Walk-in collection, Tue 4 Nov, 2:00 pm" or "GIG Logistics (Lagos)". */
  delivery?: string;
}) {
  const fcEmails = await getFulfillmentCenterEmails();
  if (fcEmails.length === 0) return;

  const total = params.lines.reduce((sum, l) => sum + l.total, 0);
  const how =
    params.source === "storefront"
      ? `has a new paid storefront order (${escapeHtml(params.orderRef)})`
      : `created a new order (${escapeHtml(params.orderRef)}) in their dashboard`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bnpfulfillment.com";

  await sendAlertEmail({
    to: fcEmails,
    subject: `New order to fulfill: ${params.orderRef} - ${naira(total)}`,
    html: `
      <div style="font-family:system-ui,Segoe UI,sans-serif;max-width:560px;">
        <h2 style="color:#0f2a44;font-size:18px;margin:0 0 4px;">New order ready for fulfillment</h2>
        <p style="color:#455568;font-size:13px;margin:0 0 16px;">${escapeHtml(params.merchantName)} ${how} for ${escapeHtml(params.customerName)}.</p>
        ${params.delivery ? `<p style="color:#0f2a44;font-size:13px;margin:0 0 12px;"><strong>Delivery:</strong> ${escapeHtml(params.delivery)}</p>` : ""}
        <table style="border-collapse:collapse;width:100%;">${orderItemRowsHtml(params.lines)}</table>
        <p style="color:#0f2a44;font-size:14px;font-weight:700;margin:12px 0 0;">Total: ${naira(total)}</p>
        <p style="font-size:13px;margin:16px 0 0;"><a href="${siteUrl}/fc/orders" style="color:#2e8b9a;">Open your orders</a></p>
      </div>
    `,
  });
}
