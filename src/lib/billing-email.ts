import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAlertEmail } from "@/lib/notifications";
import { escapeHtml } from "@/lib/spam-guard";
import { company } from "@/lib/site-content";
import { naira } from "@/lib/format";

// Sends the billing emails the database has queued (billing_notices,
// migration 0028). Notices are claimed before sending so two runs at once
// can't email twice.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bnpfulfillment.com";
const TEAM =
  process.env.APPLICATION_TO_EMAIL?.split(",")
    .map((email) => email.trim())
    .filter(Boolean) ?? [company.email];

type Notice = { partner_id: string; kind: string; payload: Record<string, unknown> };

const money = (v: unknown) => naira(Number(v ?? 0));
const month = (v: unknown) =>
  new Date(String(v) + "T12:00:00Z").toLocaleDateString("en-NG", { month: "long", year: "numeric" });
const day = (v: unknown) => new Date(String(v)).toLocaleDateString("en-NG", { day: "numeric", month: "long" });

function wrap(title: string, body: string, cta?: { label: string; href: string }) {
  return `
    <div style="font-family:system-ui,Segoe UI,sans-serif;max-width:560px;">
      <h2 style="color:#0f2a44;font-size:18px;margin:0 0 8px;">${title}</h2>
      <div style="color:#455568;font-size:13px;line-height:1.6;">${body}</div>
      ${
        cta
          ? `<p style="margin:16px 0 0;"><a href="${SITE_URL}${cta.href}" style="display:inline-block;background:#e8a020;color:#0f2a44;font-weight:600;font-size:13px;padding:10px 16px;border-radius:6px;text-decoration:none;">${cta.label}</a></p>`
          : ""
      }
    </div>`;
}

function render(n: Notice, name: string): { subject: string; html: string } | null {
  const p = n.payload;
  const hi = `Hi ${escapeHtml(name)},`;
  switch (n.kind) {
    case "invoice_issued":
      return {
        subject: `Invoice ${p.number} for ${month(p.period)}: ${money(p.total)}`,
        html: wrap(
          `Your invoice for ${month(p.period)}`,
          `${hi} your BNP invoice <strong>${escapeHtml(String(p.number))}</strong> for ${month(p.period)} is <strong>${money(p.total)}</strong>, covering storage and fulfillment. Please pay by <strong>${day(p.due_at)}</strong> to keep your orders moving. You can pay by card, bank transfer or from your wallet.`,
          { label: "View and pay", href: "/dashboard/billing" },
        ),
      };
    case "account_locked":
      return {
        subject: "Your BNP account is paused: invoice overdue",
        html: wrap(
          "Your account is paused",
          `${hi} an invoice of ${money(p.total)} is past its due date, so new orders and new stock deliveries are paused. Everything resumes automatically as soon as it's paid.`,
          { label: "Pay now", href: "/dashboard/billing" },
        ),
      };
    case "invoice_paid":
      return {
        subject: `Payment received: ${p.number}`,
        html: wrap("Thank you, payment received", `${hi} we've received ${money(p.total)} for invoice ${escapeHtml(String(p.number))}.`),
      };
    case "wallet_low":
      return {
        subject: "Your BNP wallet is running low",
        html: wrap(
          "Top up soon",
          `${hi} your wallet balance is ${money(p.balance)}, close to your minimum of ${money(p.minimum)}. Please top up to avoid any interruption to your orders.`,
          { label: "Top up wallet", href: "/dashboard/wallet" },
        ),
      };
    case "orders_paused":
      return {
        subject: "Your BNP orders are paused: wallet at minimum",
        html: wrap(
          "Orders paused",
          `${hi} your wallet balance (${money(p.balance)}) has reached your agreed minimum of ${money(p.minimum)}, so we've paused sending out your orders. Top up and they'll resume automatically.`,
          { label: "Top up wallet", href: "/dashboard/wallet" },
        ),
      };
    case "wallet_locked":
      return {
        subject: "New orders are on hold: please top up your BNP wallet",
        html: wrap(
          "New orders on hold",
          `${hi} at the end of ${month(p.period)} your wallet balance was ${money(p.balance)}, which isn't above your agreed minimum of ${money(p.minimum)}. New orders are on hold until you top up. Orders already placed are not affected, and new orders open again as soon as your balance is above the minimum.`,
          { label: "Top up wallet", href: "/dashboard/wallet" },
        ),
      };
    case "wallet_unlocked":
      return {
        subject: "You can create orders again",
        html: wrap("Orders open again", `${hi} thank you for topping up. Your wallet is above your minimum, so you can create new orders again.`),
      };
    case "orders_resumed":
      return {
        subject: "Your BNP orders have resumed",
        html: wrap("Orders resumed", `${hi} your wallet has been topped up and we're sending your orders out again.`),
      };
    case "enterprise_monthly":
      return {
        subject: `Your BNP charges for ${month(p.period)}`,
        html: wrap(
          `Charges for ${month(p.period)}`,
          `${hi} we've deducted the following from your wallet:<br/>Storage: <strong>${money(p.storage)}</strong><br/>Insurance (0.25% of ${money(p.stock_value)} of stock): <strong>${money(p.insurance)}</strong><br/>Fulfillment fees are deducted as each order is delivered. Every charge is on your dashboard.`,
          { label: "See your billing", href: "/dashboard/billing" },
        ),
      };
    case "declared_value_decided":
      return {
        subject: p.approved ? "Declared value change approved" : "Declared value change not approved",
        html: wrap(
          p.approved ? "Change approved" : "Change not approved",
          `${hi} your request to change the declared value of <strong>${escapeHtml(String(p.product ?? "a product"))}</strong> to ${money(p.value)} was ${p.approved ? "approved" : "not approved"}.${p.notes ? ` Note from our team: ${escapeHtml(String(p.notes))}` : ""}`,
        ),
      };
    default:
      return null;
  }
}

export async function sendQueuedBillingNotices(): Promise<number> {
  const admin = createAdminClient();
  const { data: claimed } = await admin
    .from("billing_notices")
    .update({ sent_at: new Date().toISOString() })
    .is("sent_at", null)
    .select("partner_id, kind, payload");
  if (!claimed || claimed.length === 0) return 0;

  const ids = [...new Set(claimed.map((n) => n.partner_id as string))];
  const { data: partners } = await admin.from("partners").select("id, email, business_name").in("id", ids);
  const byId = new Map((partners ?? []).map((p) => [p.id as string, p]));

  let sent = 0;
  for (const n of claimed as Notice[]) {
    const partner = byId.get(n.partner_id);
    if (!partner?.email) continue;
    const message = render(n, partner.business_name);
    if (!message) continue;
    await sendAlertEmail({ to: [partner.email], ...message });
    sent++;
    // The team hears about Enterprise pauses too, so someone can follow up.
    if (n.kind === "wallet_locked") {
      await sendAlertEmail({
        to: TEAM,
        subject: `New orders blocked for ${partner.business_name}`,
        html: wrap(
          "Enterprise wallet not funded at month end",
          `${escapeHtml(partner.business_name)}'s wallet (${money(n.payload.balance)}) wasn't above its minimum of ${money(n.payload.minimum)} at month end, so they can't create new orders until they top up. Admins can still create orders for them, or lift the block on the Billing page.`,
          { label: "Open billing", href: "/admin/billing" },
        ),
      });
    }
    if (n.kind === "orders_paused") {
      await sendAlertEmail({
        to: TEAM,
        subject: `Orders paused for ${partner.business_name}`,
        html: wrap(
          "Enterprise orders paused",
          `${escapeHtml(partner.business_name)}'s wallet (${money(n.payload.balance)}) is at its minimum of ${money(n.payload.minimum)}. Their orders won't be picked or dispatched until they top up.`,
          { label: "Open billing", href: "/admin/billing" },
        ),
      });
    }
  }
  return sent;
}
