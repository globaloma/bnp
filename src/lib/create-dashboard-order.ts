import "server-only";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { unitPrice } from "@/lib/product-price";
import { computeMultiLineTotals, generateOrderRef } from "@/lib/orders";
import { orderSchema, type ActionResult } from "@/lib/schemas/order";
import { alertFulfillmentCenters } from "@/lib/notifications";
import { sendQueuedLowStockAlerts } from "@/lib/low-stock-email";
import { priceDelivery } from "@/lib/delivery-pricing";
import type { DeliveryMethod } from "@/lib/delivery-methods";

/**
 * Creates a dashboard order for a merchant from the New order form. Used by
 * the merchant themselves and by admins creating an order for them; the
 * caller checks who is allowed. The database decides whether the merchant is
 * blocked (orders_billing_lock, migrations 0028 and 0032) and lets an admin's
 * order through.
 */
export async function createDashboardOrder(
  supabase: SupabaseClient,
  partnerId: string,
  formData: FormData,
): Promise<ActionResult> {
  let itemsInput: unknown;
  try {
    itemsInput = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { ok: false, error: "The product list could not be read. Please try again." };
  }

  const parsed = orderSchema.safeParse({
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone") || undefined,
    deliveryAddress: formData.get("deliveryAddress") || undefined,
    notes: formData.get("notes") || undefined,
    items: itemsInput,
    deliveryMethod: formData.get("deliveryMethod") || undefined,
    deliveryZone: formData.get("deliveryZone") || undefined,
    weightKg: formData.get("weightKg") || 0,
    pickupAt: formData.get("pickupAt") || undefined,
    discountType: formData.get("discountType") || undefined,
    discountValue: formData.get("discountValue") || 0,
    deliveryFee: formData.get("deliveryFee") || 0,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const d = parsed.data;

  // The same product picked twice becomes one line with the combined quantity.
  const quantities = new Map<string, number>();
  for (const item of d.items) {
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }

  const { data: partner } = await supabase
    .from("partners")
    .select("charges_vat, business_name")
    .eq("id", partnerId)
    .single();

  const { data: products, error: productError } = await supabase
    .from("products")
    .select("id, name, sale_price, promo_price, vat, stock, location, weight_kg")
    .eq("partner_id", partnerId)
    .in("id", [...quantities.keys()]);

  if (productError || !products || products.length !== quantities.size) {
    return { ok: false, error: "One of those products could not be found." };
  }

  const byId = new Map(products.map((p) => [p.id, p]));
  const lines = [...quantities].map(([productId, quantity]) => ({
    product: byId.get(productId)!,
    quantity,
  }));

  for (const { product, quantity } of lines) {
    if (product.stock < quantity) {
      return {
        ok: false,
        error: `Only ${product.stock} units of ${product.name} are available.`,
      };
    }
  }

  // BNP delivery is priced from our rates and billed to the merchant; their
  // own rider costs BNP nothing and the fee is what they charge the customer.
  const method = d.deliveryMethod as DeliveryMethod;
  const priced = await priceDelivery(supabase, {
    method,
    hub: lines[0].product.location,
    zone: d.deliveryZone,
    weightKg: d.weightKg,
    partnerId: partnerId,
    ownFee: d.deliveryFee,
    mode: "merchant",
  });
  if (!priced.ok) {
    return { ok: false, error: priced.error, fieldErrors: { deliveryZone: [priced.error] } };
  }
  const delivery = priced.delivery;
  let pickupAt: string | null = null;
  if (method === "walk_in") {
    const when = d.pickupAt ? new Date(`${d.pickupAt}:00+01:00`) : null;
    if (!when || Number.isNaN(when.getTime()) || when.getTime() < Date.now()) {
      return { ok: false, error: "Choose when the customer will collect.", fieldErrors: { pickupAt: ["Choose a time"] } };
    }
    pickupAt = when.toISOString();
  }
  const deliveryFee = delivery.fee;
  const vatRates = lines.map(({ product }) => (partner?.charges_vat ? product.vat : 0));
  let orderRef: string;
  try {
    orderRef = await generateOrderRef(supabase, partnerId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not create the order." };
  }
  const totals = computeMultiLineTotals({
    lines: lines.map(({ product, quantity }, i) => ({
      unitPrice: unitPrice(product),
      quantity,
      vatRate: vatRates[i],
    })),
    discountType: d.discountType,
    discountValue: d.discountValue,
    deliveryFee,
  });

  const { error: insertError } = await supabase.from("orders").insert(
    lines.map(({ product, quantity }, i) => {
      const t = totals.perLine[i];
      return {
        partner_id: partnerId,
        order_ref: orderRef,
        customer_name: d.customerName,
        customer_phone: d.customerPhone || null,
        delivery_address: d.deliveryAddress || null,
        notes: d.notes || null,
        product_id: product.id,
        product_name: product.name,
        quantity,
        unit_price: unitPrice(product),
        subtotal: t.subtotal,
        discount_type: d.discountType ?? null,
        discount_value: t.discountValue,
        discount_amount: t.discountAmount,
        vat_rate: vatRates[i],
        vat_amount: t.vatAmount,
        delivery_fee: t.deliveryFee,
        total: t.total,
        location: product.location,
        rider: delivery.rider,
        delivery_method: method,
        delivery_zone: delivery.zone,
        delivery_weight_kg: d.weightKg || null,
        delivery_billed_to: method === "own_rider" || deliveryFee === 0 ? ("none" as const) : ("merchant" as const),
        pickup_at: pickupAt,
        status: "Reserved" as const,
        channel: "dashboard" as const,
        payment_status: "paid" as const,
      };
    }),
  );

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  // No stock edit here: inserting Reserved lines makes the database allocate
  // the stock (orders_apply_stock, migration 0022). On-hand only drops when
  // the warehouse dispatches the order.

  // Fulfillment centers hear about dashboard orders too, not just storefront
  // sales, so they can start packing. Sent after the response.
  after(() => sendQueuedLowStockAlerts());
  after(() =>
    alertFulfillmentCenters({
      merchantName: partner?.business_name ?? "A merchant",
      orderRef,
      customerName: d.customerName,
      lines: lines.map(({ product, quantity }, i) => ({
        product_name: product.name,
        quantity,
        total: totals.perLine[i].total,
      })),
      source: "dashboard",
      delivery: pickupAt
        ? `Walk-in collection, ${new Date(pickupAt).toLocaleString("en-NG", {
            timeZone: "Africa/Lagos",
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "numeric",
            minute: "2-digit",
          })}`
        : delivery.label,
    }),
  );

  return { ok: true };
}
