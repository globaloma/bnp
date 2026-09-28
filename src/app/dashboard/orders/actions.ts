"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeOrderTotals, generateOrderRef } from "@/lib/orders";
import { orderSchema, orderEditSchema, type ActionResult } from "@/lib/schemas/order";
import type { OrderStatus } from "@/types/db";
import { ORDER_STATUSES } from "@/types/db";
import { initializeTransaction } from "@/lib/paystack";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bnpfulfillment.com";

export async function getOrderPaymentLink(
  orderRef: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired, sign in again." };

  const { data: rows } = await supabase
    .from("orders")
    .select("total, customer_email, payment_status, channel")
    .eq("partner_id", user.id)
    .eq("order_ref", orderRef);

  if (!rows || rows.length === 0) {
    return { ok: false, error: "Order not found." };
  }

  const first = rows[0];
  if (first.channel !== "storefront" || first.payment_status !== "pending") {
    return { ok: false, error: "This order isn't awaiting online payment." };
  }

  const { data: partner } = await supabase
    .from("partners")
    .select("slug")
    .eq("id", user.id)
    .maybeSingle();
  if (!partner) return { ok: false, error: "Could not find your store." };

  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);
  const reference = `${user.id.slice(0, 8)}-${orderRef}-R${Date.now()}`;
  const email = first.customer_email || `guest+${orderRef.toLowerCase()}@bnpfulfillment.com`;

  let authorizationUrl: string;
  try {
    const result = await initializeTransaction({
      email,
      amountKobo: Math.round(grandTotal * 100),
      reference,
      callbackUrl: `${SITE_URL}/store/${partner.slug}/confirm`,
      metadata: { partnerId: user.id, orderRef },
    });
    authorizationUrl = result.authorizationUrl;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not start payment. Please try again.",
    };
  }

  // Reusing the old payment_ref would collide with Paystack's duplicate-
  // reference check on an abandoned first attempt, so retries get a fresh
  // one and the order rows are repointed at it.
  await supabase
    .from("orders")
    .update({ payment_ref: reference })
    .eq("partner_id", user.id)
    .eq("order_ref", orderRef);

  return { ok: true, url: authorizationUrl };
}

export async function createOrder(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired, sign in again." };

  const parsed = orderSchema.safeParse({
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone") || undefined,
    deliveryAddress: formData.get("deliveryAddress") || undefined,
    notes: formData.get("notes") || undefined,
    productId: formData.get("productId"),
    quantity: formData.get("quantity") || 1,
    rider: formData.get("rider") || "BNP Fleet",
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

  const { data: partner } = await supabase
    .from("partners")
    .select("charges_vat")
    .eq("id", user.id)
    .single();

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, name, sale_price, vat, stock, location")
    .eq("id", d.productId)
    .single();

  if (productError || !product) {
    return { ok: false, error: "That product could not be found." };
  }

  if (product.stock < d.quantity) {
    return {
      ok: false,
      error: `Only ${product.stock} units of ${product.name} are in stock.`,
    };
  }

  const deliveryFee = d.rider === "Own Rider" ? d.deliveryFee : 0;
  const vatRate = partner?.charges_vat ? product.vat : 0;
  const orderRef = await generateOrderRef(supabase, user.id);
  const totals = computeOrderTotals({
    unitPrice: product.sale_price,
    quantity: d.quantity,
    vatRate,
    discountType: d.discountType,
    discountValue: d.discountValue,
    deliveryFee,
  });

  const { error: insertError } = await supabase.from("orders").insert({
    partner_id: user.id,
    order_ref: orderRef,
    customer_name: d.customerName,
    customer_phone: d.customerPhone || null,
    delivery_address: d.deliveryAddress || null,
    notes: d.notes || null,
    product_id: product.id,
    product_name: product.name,
    quantity: d.quantity,
    unit_price: product.sale_price,
    subtotal: totals.subtotal,
    discount_type: d.discountType ?? null,
    discount_value: d.discountValue,
    discount_amount: totals.discountAmount,
    vat_rate: vatRate,
    vat_amount: totals.vatAmount,
    delivery_fee: deliveryFee,
    total: totals.total,
    location: product.location,
    rider: d.rider,
    status: "Packaging",
    channel: "dashboard",
    payment_status: "paid",
  });

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  await supabase
    .from("products")
    .update({ stock: product.stock - d.quantity, last_moved_at: new Date().toISOString() })
    .eq("id", product.id);

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<ActionResult> {
  if (!ORDER_STATUSES.includes(status)) {
    return { ok: false, error: "Invalid status" };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function editOrder(
  orderId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired, sign in again." };

  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("id, product_id, quantity, unit_price, vat_rate")
    .eq("id", orderId)
    .single();

  if (fetchError || !order) {
    return { ok: false, error: "That order could not be found." };
  }

  const parsed = orderEditSchema.safeParse({
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone") || undefined,
    customerEmail: formData.get("customerEmail") || undefined,
    deliveryAddress: formData.get("deliveryAddress") || undefined,
    notes: formData.get("notes") || undefined,
    quantity: formData.get("quantity"),
    rider: formData.get("rider"),
    status: formData.get("status"),
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

  const { data: partner } = await supabase
    .from("partners")
    .select("charges_vat")
    .eq("id", user.id)
    .single();

  // The product's own VAT rate is looked up fresh here (not the order's
  // frozen vat_rate), so edits always reflect the merchant's current
  // charges_vat setting rather than whatever was true at creation time.
  // The synthetic "Shipping" row has no product_id, so it just keeps
  // whatever rate was already on the order (never VAT-bearing in practice).
  let productVatRate = order.vat_rate;
  if (order.product_id) {
    const { data: product } = await supabase
      .from("products")
      .select("id, stock, vat")
      .eq("id", order.product_id)
      .single();

    if (product) {
      productVatRate = product.vat;

      if (d.quantity !== order.quantity) {
        const delta = d.quantity - order.quantity;
        const newStock = product.stock - delta;
        if (newStock < 0) {
          return { ok: false, error: "Not enough stock to increase this order's quantity." };
        }
        await supabase
          .from("products")
          .update({ stock: newStock, last_moved_at: new Date().toISOString() })
          .eq("id", product.id);
      }
    }
  }

  const deliveryFee = d.rider === "Own Rider" ? d.deliveryFee : 0;
  const vatRate = partner?.charges_vat ? productVatRate : 0;
  const totals = computeOrderTotals({
    unitPrice: order.unit_price,
    quantity: d.quantity,
    vatRate,
    discountType: d.discountType,
    discountValue: d.discountValue,
    deliveryFee,
  });

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      customer_name: d.customerName,
      customer_phone: d.customerPhone || null,
      customer_email: d.customerEmail || null,
      delivery_address: d.deliveryAddress || null,
      notes: d.notes || null,
      quantity: d.quantity,
      rider: d.rider,
      status: d.status,
      subtotal: totals.subtotal,
      discount_type: d.discountType ?? null,
      discount_value: d.discountValue,
      discount_amount: totals.discountAmount,
      vat_rate: vatRate,
      vat_amount: totals.vatAmount,
      delivery_fee: deliveryFee,
      total: totals.total,
    })
    .eq("id", orderId);

  if (updateError) return { ok: false, error: updateError.message };

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteOrderLine(orderId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("id, product_id, quantity")
    .eq("id", orderId)
    .single();

  if (fetchError || !order) {
    return { ok: false, error: "That order could not be found." };
  }

  const { error: deleteError } = await supabase.from("orders").delete().eq("id", orderId);
  if (deleteError) return { ok: false, error: deleteError.message };

  if (order.product_id) {
    const { data: product } = await supabase
      .from("products")
      .select("id, stock")
      .eq("id", order.product_id)
      .single();
    if (product) {
      await supabase
        .from("products")
        .update({ stock: product.stock + order.quantity })
        .eq("id", product.id);
    }
  }

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteOrderGroups(orderRefs: string[]): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired, sign in again." };

  if (orderRefs.length === 0) return { ok: false, error: "No orders selected." };

  const { data: lines, error: fetchError } = await supabase
    .from("orders")
    .select("id, product_id, quantity")
    .in("order_ref", orderRefs)
    .eq("partner_id", user.id);

  if (fetchError) return { ok: false, error: fetchError.message };
  if (!lines || lines.length === 0) {
    return { ok: false, error: "Those orders could not be found." };
  }

  const { error: deleteError } = await supabase
    .from("orders")
    .delete()
    .in("order_ref", orderRefs)
    .eq("partner_id", user.id);

  if (deleteError) return { ok: false, error: deleteError.message };

  const restockByProduct = new Map<string, number>();
  for (const line of lines) {
    if (!line.product_id) continue;
    restockByProduct.set(
      line.product_id,
      (restockByProduct.get(line.product_id) ?? 0) + line.quantity,
    );
  }

  for (const [productId, qty] of restockByProduct) {
    const { data: product } = await supabase
      .from("products")
      .select("id, stock")
      .eq("id", productId)
      .single();
    if (product) {
      await supabase
        .from("products")
        .update({ stock: product.stock + qty })
        .eq("id", product.id);
    }
  }

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteOrderGroup(orderRef: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired, sign in again." };

  const { data: lines, error: fetchError } = await supabase
    .from("orders")
    .select("id, product_id, quantity")
    .eq("order_ref", orderRef)
    .eq("partner_id", user.id);

  if (fetchError) return { ok: false, error: fetchError.message };
  if (!lines || lines.length === 0) {
    return { ok: false, error: "That order could not be found." };
  }

  const { error: deleteError } = await supabase
    .from("orders")
    .delete()
    .eq("order_ref", orderRef)
    .eq("partner_id", user.id);

  if (deleteError) return { ok: false, error: deleteError.message };

  for (const line of lines) {
    if (!line.product_id) continue;
    const { data: product } = await supabase
      .from("products")
      .select("id, stock")
      .eq("id", line.product_id)
      .single();
    if (product) {
      await supabase
        .from("products")
        .update({ stock: product.stock + line.quantity })
        .eq("id", product.id);
    }
  }

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  return { ok: true };
}
