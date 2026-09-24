"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeOrderTotals, generateOrderRef } from "@/lib/orders";
import { orderSchema, orderEditSchema, type ActionResult } from "@/lib/schemas/order";
import type { OrderStatus } from "@/types/db";
import { ORDER_STATUSES } from "@/types/db";

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
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const d = parsed.data;

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

  const orderRef = await generateOrderRef(supabase, user.id);
  const totals = computeOrderTotals({
    unitPrice: product.sale_price,
    quantity: d.quantity,
    vatRate: product.vat,
    discountType: d.discountType,
    discountValue: d.discountValue,
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
    vat_rate: product.vat,
    vat_amount: totals.vatAmount,
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
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const d = parsed.data;

  // Adjust stock by the delta if quantity changed on a real product line
  // (the synthetic "Shipping" row has no product_id).
  if (order.product_id && d.quantity !== order.quantity) {
    const { data: product } = await supabase
      .from("products")
      .select("id, stock")
      .eq("id", order.product_id)
      .single();

    if (product) {
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

  const totals = computeOrderTotals({
    unitPrice: order.unit_price,
    quantity: d.quantity,
    vatRate: order.vat_rate,
    discountType: d.discountType,
    discountValue: d.discountValue,
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
      vat_amount: totals.vatAmount,
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
