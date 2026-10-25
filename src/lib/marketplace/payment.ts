import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTransaction } from "@/lib/paystack";
import { alertFulfillmentCenters, orderItemRowsHtml, sendAlertEmail } from "@/lib/notifications";
import { sendQueuedLowStockAlerts } from "@/lib/low-stock-email";
import { escapeHtml } from "@/lib/spam-guard";
import { naira } from "@/lib/format";
import { company } from "@/lib/site-content";

// Confirms a BNP Shop payment (reference MKT-<checkout_ref>). One payment
// covers one order per seller; each seller and the warehouse hear about
// their own order, and the customer gets one email listing them all.

type Row = {
  id: string;
  partner_id: string;
  order_ref: string;
  checkout_ref: string | null;
  customer_name: string;
  customer_email: string | null;
  delivery_address: string | null;
  rider: string | null;
  location: string | null;
  product_name: string;
  product_id: string | null;
  quantity: number;
  total: number;
  payment_status: "pending" | "paid" | "failed";
};

export type MarketOrderSummary = {
  orderRef: string;
  seller: string;
  items: { name: string; quantity: number; total: number }[];
  total: number;
};

/** Orders under one payment, one entry per seller's order. */
async function summarise(rows: Row[]): Promise<MarketOrderSummary[]> {
  const admin = createAdminClient();
  const ids = [...new Set(rows.map((r) => r.partner_id))];
  const { data: partners } = await admin.from("partners").select("id, business_name").in("id", ids);
  const names = new Map((partners ?? []).map((p) => [p.id as string, p.business_name as string]));
  const orders = new Map<string, MarketOrderSummary>();
  for (const r of rows) {
    const key = `${r.partner_id}:${r.order_ref}`;
    const o = orders.get(key) ?? { orderRef: r.order_ref, seller: names.get(r.partner_id) ?? "Seller", items: [], total: 0 };
    o.items.push({ name: r.product_name, quantity: r.quantity, total: Number(r.total) });
    o.total += Number(r.total);
    orders.set(key, o);
  }
  return [...orders.values()];
}

export async function marketplaceOrders(reference: string): Promise<MarketOrderSummary[]> {
  const { data } = await createAdminClient()
    .from("orders")
    .select("id, partner_id, order_ref, checkout_ref, customer_name, customer_email, delivery_address, rider, location, product_name, product_id, quantity, total, payment_status")
    .eq("payment_ref", reference)
    .eq("channel", "marketplace");
  return summarise((data ?? []) as Row[]);
}

async function notify(rows: Row[], shopOrigin: string) {
  const admin = createAdminClient();
  const orders = new Map<string, Row[]>();
  for (const r of rows) orders.set(`${r.partner_id}:${r.order_ref}`, [...(orders.get(`${r.partner_id}:${r.order_ref}`) ?? []), r]);
  const ids = [...new Set(rows.map((r) => r.partner_id))];
  const { data: partners } = await admin.from("partners").select("id, business_name, email").in("id", ids);
  const byId = new Map((partners ?? []).map((p) => [p.id as string, p]));

  for (const lines of orders.values()) {
    const first = lines[0];
    const partner = byId.get(first.partner_id);
    const goods = lines.filter((l) => l.product_id);
    const goodsTotal = goods.reduce((s, l) => s + Number(l.total), 0);
    if (partner?.email) {
      await sendAlertEmail({
        to: [partner.email as string],
        subject: `New BNP Shop order ${first.order_ref} - ${naira(goodsTotal)}`,
        html: `
          <div style="font-family:system-ui,Segoe UI,sans-serif;max-width:560px;">
            <h2 style="color:#0f2a44;font-size:18px;margin:0 0 4px;">You made a sale on BNP Shop</h2>
            <p style="color:#455568;font-size:13px;margin:0 0 16px;">${escapeHtml(first.customer_name)} paid for order ${escapeHtml(first.order_ref)}. We'll pick, pack and deliver it from your stock. The sale amount goes into your BNP wallet once it's delivered.</p>
            <table style="border-collapse:collapse;width:100%;">${orderItemRowsHtml(goods)}</table>
            <p style="color:#0f2a44;font-size:14px;font-weight:700;margin:12px 0 0;">Sale: ${naira(goodsTotal)}</p>
          </div>`,
      });
    }
    await alertFulfillmentCenters({
      merchantName: (partner?.business_name as string) ?? "A merchant",
      orderRef: first.order_ref,
      customerName: first.customer_name,
      lines,
      source: "marketplace",
      delivery: lines.find((l) => !l.product_id)?.product_name ?? (first.rider === "Pickup" ? "Pickup at the hub" : undefined),
    });
  }

  const email = rows.find((r) => r.customer_email)?.customer_email;
  if (email) {
    const summary = await summarise(rows);
    const total = summary.reduce((s, o) => s + o.total, 0);
    const blocks = summary
      .map(
        (o) => `
          <p style="color:#0f2a44;font-size:13px;font-weight:600;margin:16px 0 4px;">Order ${escapeHtml(o.orderRef)} from ${escapeHtml(o.seller)}</p>
          <table style="border-collapse:collapse;width:100%;">${orderItemRowsHtml(o.items.map((i) => ({ product_name: i.name, quantity: i.quantity, total: i.total })))}</table>`,
      )
      .join("");
    await sendAlertEmail({
      to: [email],
      replyTo: company.email,
      subject: `Your BNP Shop order is confirmed (${naira(total)})`,
      html: `
        <div style="font-family:system-ui,Segoe UI,sans-serif;max-width:560px;">
          <h2 style="color:#0f2a44;font-size:18px;margin:0 0 4px;">Thank you, ${escapeHtml(rows[0].customer_name.split(" ")[0])}</h2>
          <p style="color:#455568;font-size:13px;line-height:1.5;margin:0;">We've received your payment. Your items are being picked and packed in our warehouse${summary.length > 1 ? `, as ${summary.length} parcels (one per seller)` : ""}.</p>
          ${blocks}
          <p style="color:#0f2a44;font-size:14px;font-weight:700;margin:16px 0 0;">Total paid: ${naira(total)}</p>
          <p style="margin:16px 0 0;"><a href="${shopOrigin}/track?ref=${encodeURIComponent(summary[0]?.orderRef ?? "")}" style="display:inline-block;background:#e8a020;color:#0f2a44;font-weight:600;font-size:13px;padding:10px 16px;border-radius:6px;text-decoration:none;">Track your order</a></p>
          <p style="color:#8a97a8;font-size:12px;margin:12px 0 0;">Use your order number and the phone number you gave at checkout to track it.</p>
        </div>`,
    });
  }
}

export async function confirmMarketplacePayment(
  reference: string,
  shopOrigin: string,
): Promise<{ ok: true; alreadyProcessed: boolean } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("orders")
    .select("id, partner_id, order_ref, checkout_ref, customer_name, customer_email, delivery_address, rider, location, product_name, product_id, quantity, total, payment_status")
    .eq("payment_ref", reference)
    .eq("channel", "marketplace");
  if (error) return { ok: false, error: error.message };
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return { ok: false, error: "No order found for this payment." };
  if (rows.some((r) => r.payment_status === "paid")) return { ok: true, alreadyProcessed: true };

  let verified;
  try {
    verified = await verifyTransaction(reference);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "We couldn't check the payment. Please refresh." };
  }
  const expectedKobo = Math.round(rows.reduce((s, r) => s + Number(r.total), 0) * 100);
  if (verified.status !== "success") {
    // Only a payment Paystack says failed is final. "abandoned" or "ongoing"
    // means the customer may still pay on the same page, and the webhook
    // will confirm it then.
    if (verified.status === "failed") {
      await admin.from("orders").update({ payment_status: "failed" }).eq("payment_ref", reference).eq("payment_status", "pending");
      return { ok: false, error: "Payment was not successful." };
    }
    return { ok: false, error: "We haven't received this payment yet. If you paid, refresh this page in a minute." };
  }
  if (verified.amountKobo !== expectedKobo) {
    await admin.from("orders").update({ payment_status: "failed" }).eq("payment_ref", reference).eq("payment_status", "pending");
    return { ok: false, error: "The amount paid didn't match the order total. Contact us and we'll sort it out." };
  }

  // Claim before sending anything: the webhook and the customer's return
  // here can arrive together. Created -> Reserved allocates the stock. A
  // payment that succeeds after an earlier check said failed still counts.
  const { data: claimed, error: claimError } = await admin
    .from("orders")
    .update({ payment_status: "paid", status: "Reserved" })
    .eq("payment_ref", reference)
    .in("payment_status", ["pending", "failed"])
    .select("id");
  if (claimError) return { ok: false, error: claimError.message };
  if (!claimed || claimed.length === 0) return { ok: true, alreadyProcessed: true };

  await Promise.all([notify(rows, shopOrigin), sendQueuedLowStockAlerts()]);
  return { ok: true, alreadyProcessed: false };
}
