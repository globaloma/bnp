"use server";

import { applicationSchema, type ApplicationResult } from "@/lib/schemas/application";
import { getResend } from "@/lib/resend";
import { company } from "@/lib/site-content";
import { escapeHtml, guardSubmission } from "@/lib/spam-guard";

const FROM =
  process.env.APPLICATION_FROM_EMAIL ??
  "BNP Fulfillment <onboarding@resend.dev>";
const TO =
  process.env.APPLICATION_TO_EMAIL?.split(",")
    .map((email) => email.trim())
    .filter(Boolean) ?? [company.email];

function row(label: string, value?: string) {
  if (!value) return "";
  return `<tr><td style="padding:6px 12px 6px 0;color:#8a97a8;font-size:13px;">${label}</td><td style="padding:6px 0;color:#0f2a44;font-size:13px;font-weight:600;">${escapeHtml(value)}</td></tr>`;
}

export async function submitApplication(
  _prev: ApplicationResult | null,
  formData: FormData,
): Promise<ApplicationResult> {
  const guard = await guardSubmission("apply", formData);
  if (!guard.ok) {
    return guard.reason === "bot" ? { ok: true } : { ok: false, error: guard.message };
  }

  const parsed = applicationSchema.safeParse({
    businessName: formData.get("businessName"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    category: formData.get("category") || undefined,
    location: formData.get("location"),
    volume: formData.get("volume") || undefined,
    note: formData.get("note") || undefined,
    kind: formData.get("kind") || undefined,
    quote: formData.get("quote") || undefined,
    website: formData.get("website") || undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Please check the highlighted fields and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  // Honeypot tripped. Pretend success, do nothing.
  if (parsed.data.website) return { ok: true };

  const d = parsed.data;
  const isQuote = d.kind === "quote";
  const resend = getResend();

  if (!resend) {
    console.warn(
      "[apply] RESEND_API_KEY not set. Application received but not emailed:",
      d,
    );
    return { ok: true };
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: TO,
      replyTo: d.email,
      subject: `${isQuote ? "Quote request" : "Merchant enquiry"}: ${d.businessName.replace(/[\r\n]+/g, " ")}`,
      html: `
        <div style="font-family:system-ui,Segoe UI,sans-serif;max-width:560px;">
          <h2 style="color:#0f2a44;font-size:18px;margin:0 0 4px;">${isQuote ? "New quote request" : "New merchant enquiry"}</h2>
          <p style="color:#455568;font-size:13px;margin:0 0 16px;">Submitted through bnpfulfillment.com</p>
          <table style="border-collapse:collapse;width:100%;">
            ${row("Business", d.businessName)}
            ${row("Contact", d.fullName)}
            ${row("Email", d.email)}
            ${row("Phone", d.phone)}
            ${row("Category", d.category)}
            ${row("Preferred location", d.location)}
            ${row("Monthly volume", d.volume)}
          </table>
          ${
            d.quote
              ? `<p style="color:#0f2a44;font-size:13px;margin:16px 0 0;"><strong>Their estimate from the quote calculator</strong><br/>${escapeHtml(d.quote).replace(/\n/g, "<br/>")}</p>`
              : ""
          }
          ${
            d.note
              ? `<p style="color:#0f2a44;font-size:13px;margin:16px 0 0;"><strong>Notes</strong><br/>${escapeHtml(d.note).replace(/\n/g, "<br/>")}</p>`
              : ""
          }
        </div>
      `,
    });

    if (error) {
      console.error("[apply] Resend error:", error);
      return {
        ok: false,
        error: "We could not send your application. Please try again shortly.",
      };
    }

    return { ok: true };
  } catch (err) {
    console.error("[apply] Unexpected error:", err);
    return {
      ok: false,
      error: "Something went wrong. Please try again or email us directly.",
    };
  }
}
