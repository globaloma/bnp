"use server";

import { unitPrice } from "@/lib/product-price";
import { redirect } from "next/navigation";
import { checkoutSchema, type ActionResult } from "@/lib/schemas/checkout";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeOrderTotals, generateOrderRef } from "@/lib/orders";
import { initializeTransaction } from "@/lib/paystack";
import { flatShippingFee, pickupAvailable } from "@/lib/delivery";
import { withinRateLimit } from "@/lib/spam-guard";
import { displayName } from "@/lib/variants";
import { loadDeliveryOptions, priceDelivery } from "@/lib/delivery-pricing";
import { availableMethods, type DeliveryMethod } from "@/lib/delivery-methods";
import type { WarehouseLocation } from "@/types/db";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bnpfulfillment.com";

export async function startCheckout(
  slug: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  // Each checkout creates pending orders and a Paystack transaction.
  if (!(await withinRateLimit("checkout"))) {
    return { ok: false, error: "Too many checkout attempts. Please wait a few minutes and try again." };
  }

  let itemsInput: unknown;
  try {
    itemsInput = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { ok: false, error: "Your cart could not be read. Please try again." };
  }

  const parsed = checkoutSchema.safeParse({
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone"),
    customerEmail: formData.get("customerEmail") || undefined,
    fulfillment: formData.get("fulfillment") || undefined,
    deliveryMethod: formData.get("deliveryMethod") || undefined,
    deliveryZone: formData.get("deliveryZone") || undefined,
    deliveryAddress: formData.get("deliveryAddress") || undefined,
    items: itemsInput,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const d = parsed.data;
  const admin = createAdminClient();

  const { data: partner } = await admin
    .from("partners")
    .select("id, status, charges_vat, billing_locked, wallet_locked, plan_type")
    .eq("slug", slug)
    .maybeSingle();

  if (!partner || partner.status !== "active") {
    return { ok: false, error: "This store is not available right now." };
  }
  if (partner.billing_locked || (partner.wallet_locked && partner.plan_type === "enterprise")) {
    return { ok: false, error: "This store isn't taking orders right now. Please try again later." };
  }

  const productIds = d.items.map((i) => i.productId);
  const { data: products } = await admin
    .from("products")
    .select(
      "id, partner_id, name, variant, sale_price, promo_price, vat, stock, shipping_fee, pickup_enabled, published, location, weight_kg",
    )
    .in("id", productIds);

  const byId = new Map((products ?? []).map((p) => [p.id, p]));

  const lineItems: {
    productId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    vatRate: number;
    subtotal: number;
    vatAmount: number;
    total: number;
    location: WarehouseLocation;
    shippingFee: number;
    pickupEnabled: boolean;
    weightKg: number;
  }[] = [];

  for (const item of d.items) {
    const product = byId.get(item.productId);
    if (!product || product.partner_id !== partner.id || !product.published) {
      return { ok: false, error: "One of the items in your cart is no longer available." };
    }
    if (product.stock < item.quantity) {
      return { ok: false, error: `Only ${product.stock} of ${displayName(product)} available.` };
    }
    const vatRate = partner.charges_vat ? product.vat : 0;
    const totals = computeOrderTotals({
      unitPrice: unitPrice(product),
      quantity: item.quantity,
      vatRate,
    });
    lineItems.push({
      productId: product.id,
      name: displayName(product),
      quantity: item.quantity,
      unitPrice: unitPrice(product),
      vatRate,
      subtotal: totals.subtotal,
      vatAmount: totals.vatAmount,
      total: totals.total,
      location: product.location,
      shippingFee: product.shipping_fee,
      pickupEnabled: product.pickup_enabled,
      weightKg: (Number(product.weight_kg) || 0) * item.quantity,
    });
  }

  // Delivery price, worked out here from our own rates (never the browser's
  // numbers): free for pickup; BNP Dispatch, GIG or UPS from the warehouse's
  // rates, paid by the customer; or the merchant's own delivery areas. With
  // none of those set up, the merchant's flat shipping fee.
  const isPickup = d.fulfillment === "pickup";
  const hub = lineItems[0].location;
  let shippingFee = 0;
  let shippingLabel = "Shipping";
  let deliveryMethod: DeliveryMethod | null = null;
  let deliveryZone: string | null = null;
  const weightKg = Math.round(lineItems.reduce((sum, i) => sum + i.weightKg, 0) * 100) / 100;

  if (isPickup) {
    if (!pickupAvailable(lineItems)) {
      return {
        ok: false,
        error: "Pickup isn't available for everything in your cart. Choose delivery instead.",
      };
    }
    deliveryMethod = "walk_in";
  } else {
    const options = await loadDeliveryOptions(admin, hub, partner.id);
    const offered = availableMethods(options, "store").filter((m) => m !== "walk_in");
    if (offered.length > 0) {
      if (!d.deliveryMethod || !offered.includes(d.deliveryMethod)) {
        return {
          ok: false,
          error: "Choose how you want it delivered.",
          fieldErrors: { deliveryZone: ["Choose a delivery option"] },
        };
      }
      const priced = await priceDelivery(admin, {
        method: d.deliveryMethod,
        hub,
        zone: d.deliveryZone,
        weightKg,
        partnerId: partner.id,
        mode: "store",
      });
      if (!priced.ok) {
        return { ok: false, error: priced.error, fieldErrors: { deliveryZone: [priced.error] } };
      }
      shippingFee = priced.delivery.fee;
      shippingLabel = priced.delivery.label;
      deliveryMethod = priced.delivery.method;
      deliveryZone = priced.delivery.zone;
    } else {
      shippingFee = flatShippingFee(lineItems);
    }
  }
  const rider = isPickup ? ("Pickup" as const) : deliveryMethod === "own_rider" ? ("Own Rider" as const) : ("BNP Fleet" as const);
  // The customer pays for BNP's delivery at checkout; nothing goes on the
  // merchant's bill. Their own rider is theirs to settle.
  const deliveryFields = {
    delivery_method: deliveryMethod,
    delivery_zone: deliveryZone,
    delivery_weight_kg: weightKg || null,
    delivery_billed_to:
      deliveryMethod && deliveryMethod !== "own_rider" && deliveryMethod !== "walk_in" && shippingFee > 0
        ? ("customer" as const)
        : ("none" as const),
  };

  const itemsTotal = lineItems.reduce((sum, i) => sum + i.total, 0);
  const grandTotal = itemsTotal + shippingFee;

  let orderRef: string;
  try {
    orderRef = await generateOrderRef(admin, partner.id);
  } catch {
    return { ok: false, error: "Could not start your order. Please try again." };
  }
  const reference = `${partner.id.slice(0, 8)}-${orderRef}`;
  const email = d.customerEmail || `guest+${orderRef.toLowerCase()}@bnpfulfillment.com`;

  const rows: {
    partner_id: string;
    order_ref: string;
    customer_name: string;
    customer_phone: string;
    customer_email: string | null;
    delivery_address: string | null;
    product_id: string | null;
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    vat_rate: number;
    vat_amount: number;
    total: number;
    status: "Created";
    location: WarehouseLocation;
    rider: "BNP Fleet" | "Own Rider" | "Pickup";
    channel: "storefront";
    payment_status: "pending";
    payment_ref: string;
  }[] = lineItems.map((item) => ({
    ...deliveryFields,
    partner_id: partner.id,
    order_ref: orderRef,
    customer_name: d.customerName,
    customer_phone: d.customerPhone,
    customer_email: d.customerEmail || null,
    delivery_address: isPickup ? null : d.deliveryAddress,
    product_id: item.productId,
    product_name: item.name,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    subtotal: item.subtotal,
    vat_rate: item.vatRate,
    vat_amount: item.vatAmount,
    total: item.total,
    status: "Created" as const,
    location: item.location,
    rider,
    channel: "storefront" as const,
    payment_status: "pending" as const,
    payment_ref: reference,
  }));

  if (shippingFee > 0) {
    rows.push({
      ...deliveryFields,
      partner_id: partner.id,
      order_ref: orderRef,
      customer_name: d.customerName,
      customer_phone: d.customerPhone,
      customer_email: d.customerEmail || null,
      delivery_address: isPickup ? null : d.deliveryAddress,
      product_id: null,
      product_name: shippingLabel,
      quantity: 1,
      unit_price: shippingFee,
      subtotal: shippingFee,
      vat_rate: 0,
      vat_amount: 0,
      total: shippingFee,
      status: "Created" as const,
      location: lineItems[0].location,
      rider,
      channel: "storefront" as const,
      payment_status: "pending" as const,
      payment_ref: reference,
    });
  }

  const { error: insertError } = await admin.from("orders").insert(rows);
  if (insertError) {
    return { ok: false, error: "Could not start your order. Please try again." };
  }

  let authorizationUrl: string;
  try {
    const result = await initializeTransaction({
      email,
      amountKobo: Math.round(grandTotal * 100),
      reference,
      callbackUrl: `${SITE_URL}/store/${slug}/confirm`,
      metadata: { partnerId: partner.id, orderRef },
    });
    authorizationUrl = result.authorizationUrl;
  } catch (err) {
    await admin.from("orders").update({ payment_status: "failed" }).eq("payment_ref", reference);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not start payment. Please try again.",
    };
  }

  redirect(authorizationUrl);
}
