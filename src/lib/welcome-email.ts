import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAlertEmail } from "@/lib/notifications";
import { escapeHtml } from "@/lib/spam-guard";
import { company, guarantee } from "@/lib/site-content";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bnpfulfillment.com";

/**
 * Emails a merchant once, the first time their account is approved
 * (partners.welcomed_at, migration 0030). The row is claimed before sending
 * so two approvals at once can't email twice; if the email fails, the claim
 * is released so the next approval tries again.
 */
export async function sendWelcomeEmail(partnerId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: partner } = await admin
    .from("partners")
    .update({ welcomed_at: new Date().toISOString() })
    .eq("id", partnerId)
    .eq("role", "merchant")
    .eq("status", "active")
    .is("welcomed_at", null)
    .select("email, business_name, contact_name, plan_type, slug")
    .maybeSingle();
  if (!partner?.email) return;

  const enterprise = partner.plan_type === "enterprise";
  const greeting = partner.contact_name?.trim().split(/\s+/)[0] || partner.business_name;
  const storeUrl = partner.slug ? `${SITE_URL}/store/${partner.slug}` : null;

  const step = (n: number, title: string, body: string) => `
    <tr>
      <td style="vertical-align:top;padding:0 12px 14px 0;">
        <div style="width:24px;height:24px;border-radius:12px;background:#0f2a44;color:#e8a020;font-weight:700;font-size:12px;line-height:24px;text-align:center;">${n}</div>
      </td>
      <td style="vertical-align:top;padding:0 0 14px;">
        <div style="color:#0f2a44;font-size:14px;font-weight:600;">${title}</div>
        <div style="color:#455568;font-size:13px;line-height:1.5;margin-top:2px;">${body}</div>
      </td>
    </tr>`;

  const plan = enterprise
    ? `You're on the <strong>Enterprise plan</strong>. Storage, the 9% fee and insurance come out of your wallet as they happen, so top up before your first orders. Your account manager will be in touch to agree your wallet minimum.`
    : `You're on the <strong>Standard plan</strong>. You get one invoice at the start of each month for storage and 7% of the month's sales, with 3 days to pay.`;

  const sent = await sendAlertEmail({
    to: [partner.email],
    replyTo: company.email,
    subject: `Welcome to BNP Fulfillment, ${partner.business_name}`,
    html: `
      <div style="font-family:system-ui,Segoe UI,sans-serif;max-width:560px;">
        <h2 style="color:#0f2a44;font-size:20px;margin:0 0 6px;">Your account is approved</h2>
        <p style="color:#455568;font-size:14px;line-height:1.5;margin:0 0 18px;">
          Hi ${escapeHtml(greeting)}, welcome to BNP Fulfillment. Here's how to get your first orders out:
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          ${step(1, "Add your products", "List what you sell on your Inventory page, with each item's value and weight. You can add them one by one or upload a CSV.")}
          ${step(2, "Send us your stock", "Tell us what's coming on the Deliveries page. We count it, label every unit and put it on the shelf.")}
          ${step(
            3,
            "Start selling",
            storeUrl
              ? `Share your store link, <a href="${storeUrl}" style="color:#1f6f7c;">${escapeHtml(storeUrl.replace(/^https?:\/\//, ""))}</a>, or create orders from your dashboard. We pack and deliver them.`
              : "Create orders from your dashboard and we pack and deliver them.",
          )}
        </table>
        <p style="color:#455568;font-size:13px;line-height:1.5;margin:4px 0 0;">${plan}</p>
        <p style="margin:20px 0 0;">
          <a href="${SITE_URL}/dashboard" style="display:inline-block;background:#e8a020;color:#0f2a44;font-weight:600;font-size:14px;padding:11px 18px;border-radius:6px;text-decoration:none;">Go to your dashboard</a>
        </p>
        <p style="color:#455568;font-size:13px;line-height:1.5;margin:20px 0 0;">${escapeHtml(guarantee.short)}</p>
        <p style="color:#8a97a8;font-size:12px;line-height:1.5;margin:16px 0 0;">
          Questions? Reply to this email or message us on WhatsApp at ${escapeHtml(company.phone)}.<br />
          The BNP Fulfillment team
        </p>
      </div>
    `,
  });

  if (!sent) {
    await admin.from("partners").update({ welcomed_at: null }).eq("id", partnerId);
  }
}
