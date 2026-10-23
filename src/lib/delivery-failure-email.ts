import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAlertEmail } from "@/lib/notifications";
import { escapeHtml } from "@/lib/spam-guard";
import { company } from "@/lib/site-content";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bnpfulfillment.com";

/** Tells the merchant the warehouse couldn't deliver an order, and why. */
export async function emailDeliveryFailed(partnerId: string, orderRef: string): Promise<void> {
  const admin = createAdminClient();
  const [{ data: partner }, { data: line }] = await Promise.all([
    admin.from("partners").select("email, business_name").eq("id", partnerId).maybeSingle(),
    admin
      .from("orders")
      .select("customer_name, customer_phone, delivery_address, delivery_failure_note, delivery_failed_attempts")
      .eq("partner_id", partnerId)
      .eq("order_ref", orderRef)
      .eq("delivery_progress", "failed")
      .limit(1)
      .maybeSingle(),
  ]);
  if (!partner?.email || !line) return;

  const attempts = Number(line.delivery_failed_attempts) || 1;
  await sendAlertEmail({
    to: [partner.email],
    replyTo: company.email,
    subject: `Delivery failed: ${orderRef} for ${line.customer_name}`,
    html: `
      <div style="font-family:system-ui,Segoe UI,sans-serif;max-width:560px;">
        <h2 style="color:#0f2a44;font-size:18px;margin:0 0 4px;">We couldn't deliver ${escapeHtml(orderRef)}</h2>
        <p style="color:#455568;font-size:13px;line-height:1.5;margin:0 0 12px;">
          Hi ${escapeHtml(partner.business_name)}, our rider couldn't complete this delivery${attempts > 1 ? ` (attempt ${attempts})` : ""}.
        </p>
        <table style="font-size:13px;color:#0f2a44;border-collapse:collapse;">
          <tr><td style="padding:2px 12px 2px 0;color:#8a97a8;">Reason</td><td><strong>${escapeHtml(line.delivery_failure_note ?? "Not given")}</strong></td></tr>
          <tr><td style="padding:2px 12px 2px 0;color:#8a97a8;">Customer</td><td>${escapeHtml(line.customer_name)}${line.customer_phone ? `, ${escapeHtml(line.customer_phone)}` : ""}</td></tr>
          ${line.delivery_address ? `<tr><td style="padding:2px 12px 2px 0;color:#8a97a8;">Address</td><td>${escapeHtml(line.delivery_address)}</td></tr>` : ""}
        </table>
        <p style="color:#455568;font-size:13px;line-height:1.5;margin:12px 0 0;">
          If you can reach the customer, confirm their address or a good time and reply to this email. We'll try again,
          or bring the parcel back to the warehouse and put the stock back on your shelf.
        </p>
        <p style="margin:16px 0 0;">
          <a href="${SITE_URL}/dashboard/orders" style="display:inline-block;background:#e8a020;color:#0f2a44;font-weight:600;font-size:13px;padding:10px 16px;border-radius:6px;text-decoration:none;">See the order</a>
        </p>
      </div>
    `,
  });
}
