"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeMultiLineTotals, generateOrderRef } from "@/lib/orders";
import { getFulfillmentCenterEmails, sendAlertEmail } from "@/lib/notifications";
import { escapeHtml } from "@/lib/spam-guard";
import type { WarehouseLocation } from "@/types/db";
import { checkImportRows, clean, type ImportRow } from "@/lib/order-import";

// CSV order upload (pick-and-pack brief, part 5): every row is checked on
// the server, good orders are created and bad rows come back with a reason,
// instead of the whole file failing. Rows that share an order_group become
// one order; if any of its rows is bad, the whole order is held back so a
// customer never gets half an order.

export type RowResult = {
  line: number;
  group: string;
  customer: string;
  product: string;
  quantity: number | null;
  ok: boolean;
  /** Why the row can't be imported, in plain words. */
  reason?: string;
  /** Set once created. */
  orderRef?: string;
};

export type ImportResult =
  | { ok: true; rows: RowResult[]; orders: number; created: string[] }
  | { ok: false; error: string };

const MAX_ROWS = 500;


export async function importOrders(rows: ImportRow[], options: { create: boolean }): Promise<ImportResult> {
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: "The file has no order rows." };
  if (rows.length > MAX_ROWS) return { ok: false, error: `Upload at most ${MAX_ROWS} rows at a time.` };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired, sign in again." };

  const [{ data: partner }, { data: products }] = await Promise.all([
    supabase.from("partners").select("business_name, charges_vat").eq("id", user.id).single(),
    supabase
      .from("products")
      .select("id, name, variant, sku, barcode, sale_price, vat, stock, location")
      .eq("partner_id", user.id),
  ]);
  type P = NonNullable<typeof products>[number];

  const result = checkImportRows(rows, products ?? []);
  if (!result) {
    return { ok: false, error: "No orders found. Fill in the customer and quantity on the rows you want." };
  }
  const { checked, goodGroups } = result;
  const created: string[] = [];

  if (options.create && goodGroups.length > 0) {
    for (const list of goodGroups) {
      const first = list[0];
      const rider = first.rider;
      const deliveryFee = rider === "Own Rider" ? first.fee : 0;
      // The same product twice in one order becomes one line.
      const qtyByProduct = new Map<string, { product: P; quantity: number }>();
      for (const c of list) {
        const p = c.item as P;
        const existing = qtyByProduct.get(p.id);
        qtyByProduct.set(p.id, { product: p, quantity: (existing?.quantity ?? 0) + (c.quantity ?? 0) });
      }
      const lines = [...qtyByProduct.values()];
      const vatRates = lines.map(({ product }) => (partner?.charges_vat ? product.vat : 0));
      const totals = computeMultiLineTotals({
        lines: lines.map(({ product, quantity }, i) => ({
          unitPrice: product.sale_price,
          quantity,
          vatRate: vatRates[i],
        })),
        deliveryFee,
      });

      let orderRef: string;
      try {
        orderRef = await generateOrderRef(supabase, user.id);
      } catch {
        for (const c of list) {
          c.ok = false;
          c.reason = "Couldn't create an order number. Try uploading this row again.";
        }
        continue;
      }

      const { error } = await supabase.from("orders").insert(
        lines.map(({ product, quantity }, i) => {
          const t = totals.perLine[i];
          return {
            partner_id: user.id,
            order_ref: orderRef,
            customer_name: clean(first.row.customer_name, 140),
            customer_phone: clean(first.row.customer_phone, 20) || null,
            customer_email: clean(first.row.customer_email, 160) || null,
            delivery_address: clean(first.row.delivery_address) || null,
            notes: list.map((c) => clean(c.row.notes)).filter(Boolean).join(" / ").slice(0, 500) || null,
            product_id: product.id,
            product_name: product.name,
            quantity,
            unit_price: product.sale_price,
            subtotal: t.subtotal,
            discount_type: null,
            discount_value: 0,
            discount_amount: 0,
            vat_rate: vatRates[i],
            vat_amount: t.vatAmount,
            delivery_fee: t.deliveryFee,
            total: t.total,
            location: product.location as WarehouseLocation,
            rider,
            status: "Reserved" as const,
            channel: "dashboard" as const,
            payment_status: "paid" as const,
          };
        }),
      );
      if (error) {
        for (const c of list) {
          c.ok = false;
          c.reason = "This order couldn't be saved. Try uploading this row again.";
        }
        continue;
      }
      created.push(orderRef);
      for (const c of list) c.orderRef = orderRef;
    }

    if (created.length > 0) {
      const merchantName = partner?.business_name ?? "A merchant";
      const units = goodGroups.flat().filter((c) => c.orderRef).reduce((s, c) => s + (c.quantity ?? 0), 0);
      after(async () => {
        const fcEmails = await getFulfillmentCenterEmails();
        await sendAlertEmail({
          to: fcEmails,
          subject: `${merchantName} uploaded ${created.length} order${created.length === 1 ? "" : "s"}`,
          html: `
            <div style="font-family:system-ui,Segoe UI,sans-serif;max-width:560px;">
              <h2 style="color:#0f2a44;font-size:18px;margin:0 0 4px;">New orders to pick</h2>
              <p style="color:#455568;font-size:13px;margin:0;">
                ${escapeHtml(merchantName)} uploaded ${created.length} order${created.length === 1 ? "" : "s"} (${units} item${units === 1 ? "" : "s"}) by CSV. They are on the pick list now.
              </p>
            </div>
          `,
        });
      });
      revalidatePath("/dashboard/orders");
      revalidatePath("/dashboard/inventory");
      revalidatePath("/dashboard");
    }
  }

  return {
    ok: true,
    orders: goodGroups.length,
    created,
    rows: checked.map(({ line, group, customer, product, quantity, ok, reason, orderRef }) => ({
      line,
      group: group.startsWith("row-") ? "" : group,
      customer,
      product,
      quantity,
      ok,
      reason,
      orderRef,
    })),
  };
}
