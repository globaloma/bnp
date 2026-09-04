"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { orderSchema, type ActionResult } from "@/lib/schemas/order";
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
    productId: formData.get("productId"),
    quantity: formData.get("quantity") || 1,
    rider: formData.get("rider") || "BNP Fleet",
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
    .select("id, name, sale_price, stock, location")
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

  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", user.id);

  const orderRef = `ORD-${String((count ?? 0) + 41).padStart(4, "0")}`;
  const total = product.sale_price * d.quantity;

  const { error: insertError } = await supabase.from("orders").insert({
    partner_id: user.id,
    order_ref: orderRef,
    customer_name: d.customerName,
    product_id: product.id,
    product_name: product.name,
    quantity: d.quantity,
    unit_price: product.sale_price,
    total,
    location: product.location,
    rider: d.rider,
    status: "Packaging",
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
