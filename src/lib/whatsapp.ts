import "server-only";
import crypto from "node:crypto";

// WhatsApp messaging through Twilio's REST API. Plain fetch rather than the
// twilio npm package - we only need "send a message" and "check a webhook
// signature", and the SDK is a heavy dependency for two calls.
//
// Env:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN  - from the Twilio console
//   TWILIO_WHATSAPP_FROM                   - e.g. +14155238886 (sandbox) or
//                                            BNP's approved WhatsApp sender
//   TWILIO_DELIVERY_TEMPLATE_SID           - optional, an approved Content
//                                            template (HX...). Required in
//                                            production: WhatsApp only allows
//                                            free-form text inside the 24h
//                                            window after a customer messages
//                                            you, so a "your order arrived"
//                                            message must be a template.

const TWILIO_BASE = "https://api.twilio.com/2010-04-01";

export function isWhatsAppConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_WHATSAPP_FROM,
  );
}

// Turns the formats merchants and customers actually type (0803 123 4567,
// 2348031234567, +234 803 123 4567, 803-123-4567) into E.164. Nigerian
// numbers are assumed when there's no country code, since that's every
// customer today. Returns null for anything that can't be a real number.
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  let e164: string;
  if (trimmed.startsWith("+")) e164 = `+${digits}`;
  else if (digits.startsWith("234")) e164 = `+${digits}`;
  else if (digits.startsWith("0") && digits.length === 11) e164 = `+234${digits.slice(1)}`;
  else if (digits.length === 10) e164 = `+234${digits}`;
  else return null;

  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

type SendResult = { ok: true; sid: string } | { ok: false; error: string };

export async function sendWhatsApp(params: {
  to: string;
  body?: string;
  contentSid?: string;
  contentVariables?: Record<string, string>;
}): Promise<SendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!sid || !token || !from) {
    return { ok: false, error: "Twilio WhatsApp is not configured" };
  }

  const to = toE164(params.to);
  if (!to) return { ok: false, error: `Not a valid phone number: ${params.to}` };

  const form = new URLSearchParams({
    From: `whatsapp:${toE164(from) ?? from}`,
    To: `whatsapp:${to}`,
  });
  if (params.contentSid) {
    form.set("ContentSid", params.contentSid);
    if (params.contentVariables) {
      form.set("ContentVariables", JSON.stringify(params.contentVariables));
    }
  } else if (params.body) {
    form.set("Body", params.body);
  } else {
    return { ok: false, error: "Message needs a body or a template" };
  }

  try {
    const res = await fetch(`${TWILIO_BASE}/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });
    const json = await res.json();
    if (!res.ok) {
      return { ok: false, error: `${json.code ?? res.status}: ${json.message ?? "Twilio error"}` };
    }
    return { ok: true, sid: json.sid };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not reach Twilio" };
  }
}

// Twilio signs webhooks as base64(HMAC-SHA1(authToken, url + each POST
// param name+value, sorted by name)).
// https://www.twilio.com/docs/usage/webhooks/webhooks-security
export function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signatureHeader: string | null,
): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token || !signatureHeader) return false;

  const payload =
    url +
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join("");
  const expected = crypto.createHmac("sha1", token).update(payload).digest("base64");

  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
