"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fromAs, sendAlertEmail } from "@/lib/notifications";
import { getResend } from "@/lib/resend";
import { escapeHtml, withinLimit } from "@/lib/spam-guard";
import { naira } from "@/lib/format";

const schema = z.object({
  partnerId: z.string().uuid(),
  orderRef: z.string().trim().min(3).max(40),
  to: z.string().trim().email("Enter a valid email address").max(160),
  // The receipt PDF, base64. Receipts are ~40KB; 3MB leaves lots of room.
  pdfBase64: z.string().min(100).max(3_000_000),
});

export type ReceiptEmailResult = { ok: true; to: string } | { ok: false; error: string };

/**
 * Emails the receipt PDF itself, as an attachment, to the customer. The PDF
 * is drawn in the browser (same file as Download PDF) and sent here. Used by
 * merchants for their own orders and by fulfillment centers for any order
 * they can see; who can see an order is enforced by the database rules.
 */
export async function emailReceipt(input: {
  partnerId: string;
  orderRef: string;
  to: string;
  pdfBase64: string;
}): Promise<ReceiptEmailResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the email address." };
  }
  const { partnerId, orderRef, to, pdfBase64 } = parsed.data;

  if (!getResend()) {
    return { ok: false, error: "Email sending isn't set up on this site yet." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired, sign in again." };

  // Read with the signed-in user's own access: a merchant only sees their
  // orders, a fulfillment center sees the network's. No rows, no email.
  const { data: lines } = await supabase
    .from("orders")
    .select("id, customer_name, customer_email, total")
    .eq("partner_id", partnerId)
    .eq("order_ref", orderRef);
  if (!lines || lines.length === 0) return { ok: false, error: "Order not found." };

  if (!(await withinLimit("receipt-email", user.id, 30, 60 * 60))) {
    return { ok: false, error: "Too many receipts sent in the last hour. Please try again later." };
  }

  const admin = createAdminClient();
  const { data: merchant } = await admin
    .from("partners")
    .select("business_name, email")
    .eq("id", partnerId)
    .maybeSingle();
  const shop = merchant?.business_name ?? "Your seller";
  const total = lines.reduce((sum, l) => sum + Number(l.total), 0);
  const firstName = lines[0].customer_name.split(/\s+/)[0] || lines[0].customer_name;

  const sent = await sendAlertEmail({
    to: [to],
    from: fromAs(shop),
    replyTo: merchant?.email ?? undefined,
    subject: `Your receipt for order ${orderRef} from ${shop}`,
    html: `
      <div style="font-family:system-ui,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;">
        <p style="color:#0f2a44;font-size:15px;margin:0 0 12px;">Hi ${escapeHtml(firstName)},</p>
        <p style="color:#455568;font-size:14px;margin:0 0 12px;">Your receipt for order <b>${escapeHtml(orderRef)}</b> from ${escapeHtml(shop)} is attached (total ${naira(total)}).</p>
        <p style="color:#455568;font-size:14px;margin:0;">Thank you for your order.</p>
      </div>
    `,
    attachments: [{ filename: `${orderRef}.pdf`, content: pdfBase64 }],
  });
  if (!sent) return { ok: false, error: "The email couldn't be sent. Please try again." };

  // Remember the address on the order if it didn't have one, so it's
  // filled in next time. Same access rules as the read above.
  if (!lines[0].customer_email) {
    await supabase
      .from("orders")
      .update({ customer_email: to })
      .eq("partner_id", partnerId)
      .eq("order_ref", orderRef);
  }

  return { ok: true, to };
}
