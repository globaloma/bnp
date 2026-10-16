import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAlertEmail } from "@/lib/notifications";
import { alertOpsOfIssue, escapeHtml, feedbackUrl, opsEmails } from "@/lib/delivery-feedback";
import { toE164, verifyTwilioSignature } from "@/lib/whatsapp";
import { withinLimit } from "@/lib/spam-guard";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bnpfulfillment.com";

// Twilio "A message comes in" webhook for the WhatsApp sender. Set it in the
// Twilio console (Messaging -> WhatsApp senders, or the Sandbox settings) to
// POST https://www.bnpfulfillment.com/api/twilio/whatsapp
//
// Every reply is logged and forwarded to Ops. If the customer still hasn't
// used their feedback link, the auto-reply hands it back to them.

function twiml(message?: string) {
  const body = message
    ? `<Response><Message>${escapeHtml(message)}</Message></Response>`
    : "<Response/>";
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>${body}`, {
    headers: { "Content-Type": "text/xml" },
  });
}

export async function POST(req: Request) {
  const raw = await req.text();
  const params = Object.fromEntries(new URLSearchParams(raw));

  // Twilio signs the exact public URL it called. Behind Vercel req.url can
  // differ (host or protocol), so also accept the configured public URL.
  const signature = req.headers.get("x-twilio-signature");
  const candidates = [
    process.env.TWILIO_WEBHOOK_URL,
    req.url,
    `${SITE_URL}/api/twilio/whatsapp`,
  ].filter((u): u is string => Boolean(u));
  if (!candidates.some((url) => verifyTwilioSignature(url, params, signature))) {
    return new Response("Invalid signature", { status: 401 });
  }

  const from = toE164((params.From ?? "").replace(/^whatsapp:/, ""));
  const text = (params.Body ?? "").trim();
  if (!from) return twiml();

  const admin = createAdminClient();
  const { data: feedback } = await admin
    .from("order_feedback")
    .select("id, partner_id, order_ref, token, customer_name, customer_phone, responded_at")
    .eq("customer_phone", from)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error: insertError } = await admin.from("whatsapp_inbound").insert({
    from_phone: from,
    body: text,
    feedback_id: feedback?.id ?? null,
    twilio_sid: params.MessageSid ?? null,
  });
  // Unique twilio_sid: Twilio retried a message we already handled.
  if (insertError?.code === "23505") return twiml();

  // Every alert emails Ops and the merchant and costs a WhatsApp message, so
  // cap how many one phone number can trigger. Messages are still logged.
  const canAlert = text ? await withinLimit("whatsapp-alert", from, 5, 60 * 60) : false;

  if (text && canAlert) {
    after(async () => {
      if (feedback) {
        await alertOpsOfIssue({ feedback, issue: text, source: "WhatsApp reply" });
      } else {
        await sendAlertEmail({
          to: opsEmails(),
          subject: `WhatsApp message from ${from}`,
          html: `
            <div style="font-family:system-ui,Segoe UI,sans-serif;max-width:560px;">
              <h2 style="color:#0f2a44;font-size:18px;margin:0 0 4px;">New WhatsApp message</h2>
              <p style="color:#455568;font-size:13px;margin:0 0 16px;">From ${escapeHtml(from)}, not matched to a delivered order.</p>
              <p style="color:#0f2a44;font-size:14px;background:#f8f5f0;border-radius:8px;padding:12px;white-space:pre-wrap;">${escapeHtml(text)}</p>
            </div>
          `,
        });
      }
    });
  }

  if (feedback && !feedback.responded_at) {
    return twiml(
      `Thanks for your message, our team has been notified and will get back to you. ` +
        `You can also confirm your order or report a problem here: ${feedbackUrl(feedback.token)}`,
    );
  }
  return twiml("Thanks for your message, our team has been notified and will get back to you.");
}
