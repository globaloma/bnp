import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResend } from "@/lib/resend";

export const ALERT_FROM =
  process.env.APPLICATION_FROM_EMAIL ?? "BNP Fulfillment <onboarding@resend.dev>";

export async function getFulfillmentCenterEmails(): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("partners")
    .select("email")
    .eq("role", "fulfillment_center")
    .eq("status", "active");

  return (data ?? []).map((p) => p.email).filter((email): email is string => Boolean(email));
}

export async function sendAlertEmail(params: {
  to: string[];
  subject: string;
  html: string;
}) {
  if (params.to.length === 0) return;

  const resend = getResend();
  if (!resend) return;

  try {
    const { error } = await resend.emails.send({
      from: ALERT_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    if (error) console.error("[alert-email] Resend error:", error);
  } catch (err) {
    console.error("[alert-email] Unexpected error:", err);
  }
}
