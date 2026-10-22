import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAlertEmail } from "@/lib/notifications";
import { escapeHtml } from "@/lib/spam-guard";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bnpfulfillment.com";

/**
 * Sends the low-stock alerts the database has queued (migration 0026), one
 * email per merchant listing every product that just went low. Alerts are
 * claimed before sending so two calls at once can't email twice.
 *
 * Called after anything that commonly lowers stock (orders, uploads,
 * payments, approved counts) and when a merchant opens their dashboard, so
 * queued alerts go out promptly without a scheduled job.
 */
export async function sendQueuedLowStockAlerts(): Promise<void> {
  const admin = createAdminClient();
  const { data: claimed } = await admin
    .from("low_stock_alerts")
    .update({ sent_at: new Date().toISOString() })
    .is("sent_at", null)
    .select("partner_id, available, threshold, product:products(name, variant, sku, location)");
  if (!claimed || claimed.length === 0) return;

  type Row = {
    partner_id: string;
    available: number;
    threshold: number;
    product: { name: string; variant: string | null; sku: string | null; location: string } | null;
  };
  const byPartner = new Map<string, Row[]>();
  for (const row of claimed as unknown as Row[]) {
    byPartner.set(row.partner_id, [...(byPartner.get(row.partner_id) ?? []), row]);
  }

  const { data: partners } = await admin
    .from("partners")
    .select("id, email, business_name, status")
    .in("id", [...byPartner.keys()]);

  for (const partner of partners ?? []) {
    if (!partner.email || partner.status !== "active") continue;
    const rows = byPartner.get(partner.id) ?? [];
    const items = rows
      .map((r) => {
        const name = r.product ? (r.product.variant ? `${r.product.name} (${r.product.variant})` : r.product.name) : "A product";
        const state = r.available <= 0 ? "out of stock" : `${r.available} left (your alert level is ${r.threshold})`;
        return `<li style="color:#0f2a44;font-size:13px;margin:4px 0;"><strong>${escapeHtml(name)}</strong>${
          r.product?.sku ? ` <span style="color:#8a97a8;">${escapeHtml(r.product.sku)}</span>` : ""
        }: ${state}</li>`;
      })
      .join("");
    const out = rows.filter((r) => r.available <= 0).length;
    await sendAlertEmail({
      to: [partner.email],
      subject:
        rows.length === 1
          ? `Low stock: ${rows[0].product?.name ?? "a product"}${out ? " is out of stock" : " is running low"}`
          : `Low stock: ${rows.length} products are running low`,
      html: `
        <div style="font-family:system-ui,Segoe UI,sans-serif;max-width:560px;">
          <h2 style="color:#0f2a44;font-size:18px;margin:0 0 4px;">Time to restock</h2>
          <p style="color:#455568;font-size:13px;margin:0 0 12px;">
            Hi ${escapeHtml(partner.business_name)}, ${rows.length === 1 ? "this product has" : "these products have"} reached the alert level you set:
          </p>
          <ul style="margin:0;padding-left:18px;">${items}</ul>
          <p style="margin:16px 0 0;">
            <a href="${SITE_URL}/dashboard/deliveries" style="display:inline-block;background:#e8a020;color:#0f2a44;font-weight:600;font-size:13px;padding:10px 16px;border-radius:6px;text-decoration:none;">Send us more stock</a>
          </p>
          <p style="color:#8a97a8;font-size:12px;margin:16px 0 0;">
            You can change each product's alert level when you edit it on your Inventory page.
          </p>
        </div>
      `,
    });
  }
}
