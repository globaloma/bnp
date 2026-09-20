"use server";

import { redirect } from "next/navigation";
import { checkoutSchema, type ActionResult } from "@/lib/schemas/checkout";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateOrderRef } from "@/lib/orders";
import { initializeTransaction } from "@/lib/paystack";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bnpfulfillment.com";

export async function startCheckout(
  slug: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
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
    deliveryAddress: formData.get("deliveryAddress"),
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
    .select("id, status")
    .eq("slug", slug)
    .maybeSingle();

  if (!partner || partner.status !== "active") {
    return { ok: false, error: "This store is not available right now." };
  }

  const productIds = d.items.map((i) => i.productId);
  const { data: products } = await admin
    .from("products")
    .select("id, partner_id, name, sale_price, stock, shipping_fee, published, location")
    .in("id", productIds);

  const byId = new Map((products ?? []).map((p) => [p.id, p]));

  const lineItems: {
    productId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
    location: string;
    shippingFee: number;
  }[] = [];

  for (const item of d.items) {
    const product = byId.get(item.productId);
    if (!product || product.partner_id !== partner.id || !product.published) {
      return { ok: false, error: "One of the items in your cart is no longer available." };
    }
    if (product.stock < item.quantity) {
      return { ok: false, error: `Only ${product.stock} of ${product.name} left in stock.` };
    }
    lineItems.push({
      productId: product.id,
      name: product.name,
      quantity: item.quantity,
      unitPrice: product.sale_price,
      total: product.sale_price * item.quantity,
      location: product.location,
      shippingFee: product.shipping_fee,
    });
  }

  // One combined delivery for the whole cart, not one shipping charge per item.
  const shippingFee = Math.max(0, ...lineItems.map((i) => i.shippingFee));
  const itemsTotal = lineItems.reduce((sum, i) => sum + i.total, 0);
  const grandTotal = itemsTotal + shippingFee;

  const orderRef = await generateOrderRef(admin, partner.id);
  const reference = `${partner.id.slice(0, 8)}-${orderRef}`;
  const email = d.customerEmail || `guest+${orderRef.toLowerCase()}@bnpfulfillment.com`;

  const rows: {
    partner_id: string;
    order_ref: string;
    customer_name: string;
    customer_phone: string;
    customer_email: string | null;
    delivery_address: string;
    product_id: string | null;
    product_name: string;
    quantity: number;
    unit_price: number;
    total: number;
    status: "Packaging";
    location: string;
    rider: "BNP Fleet";
    channel: "storefront";
    payment_status: "pending";
    payment_ref: string;
  }[] = lineItems.map((item) => ({
    partner_id: partner.id,
    order_ref: orderRef,
    customer_name: d.customerName,
    customer_phone: d.customerPhone,
    customer_email: d.customerEmail || null,
    delivery_address: d.deliveryAddress,
    product_id: item.productId,
    product_name: item.name,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    total: item.total,
    status: "Packaging" as const,
    location: item.location,
    rider: "BNP Fleet" as const,
    channel: "storefront" as const,
    payment_status: "pending" as const,
    payment_ref: reference,
  }));

  if (shippingFee > 0) {
    rows.push({
      partner_id: partner.id,
      order_ref: orderRef,
      customer_name: d.customerName,
      customer_phone: d.customerPhone,
      customer_email: d.customerEmail || null,
      delivery_address: d.deliveryAddress,
      product_id: null,
      product_name: "Shipping",
      quantity: 1,
      unit_price: shippingFee,
      total: shippingFee,
      status: "Packaging" as const,
      location: lineItems[0].location,
      rider: "BNP Fleet" as const,
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
