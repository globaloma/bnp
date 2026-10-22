import "server-only";
import { sendAlertEmail } from "@/lib/notifications";
import { escapeHtml } from "@/lib/spam-guard";
import { company } from "@/lib/site-content";

// Merchant plans. Enterprise needs our team: a wallet minimum (1.5x the
// projected monthly bill) and an account manager are set at onboarding
// (Technical Specification v2, section 2.3), so the team is emailed whenever
// a merchant picks it.

const TO =
  process.env.APPLICATION_TO_EMAIL?.split(",")
    .map((email) => email.trim())
    .filter(Boolean) ?? [company.email];

export async function notifyEnterpriseChoice(params: {
  businessName: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  source: "sign-up" | "settings";
}) {
  await sendAlertEmail({
    to: TO,
    subject: `Enterprise plan chosen: ${params.businessName.replace(/[\r\n]+/g, " ")}`,
    html: `
      <div style="font-family:system-ui,Segoe UI,sans-serif;max-width:560px;">
        <h2 style="color:#0f2a44;font-size:18px;margin:0 0 4px;">A merchant chose Enterprise</h2>
        <p style="color:#455568;font-size:13px;margin:0 0 12px;">
          ${escapeHtml(params.businessName)} picked the Enterprise plan ${
            params.source === "sign-up" ? "when signing up" : "in their settings"
          }. Agree their wallet minimum and assign an account manager.
        </p>
        <p style="color:#0f2a44;font-size:13px;margin:0;">
          ${params.contactName ? `${escapeHtml(params.contactName)}<br/>` : ""}
          ${params.email ? `${escapeHtml(params.email)}<br/>` : ""}
          ${params.phone ? escapeHtml(params.phone) : ""}
        </p>
      </div>
    `,
  });
}
