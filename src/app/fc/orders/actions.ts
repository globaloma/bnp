"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requestDeliveryConfirmation } from "@/lib/delivery-feedback";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/schemas/order";
import type { OrderStatus } from "@/types/db";
import { ORDER_STATUSES } from "@/types/db";

export async function updateOrderStatusAsFc(
  orderId: string,
  status: OrderStatus,
): Promise<ActionResult> {
  // The warehouse moves orders through Picking, Packed and Dispatched, and
  // handles cancellations once picking has started. Created only comes from a
  // storefront checkout waiting for payment.
  if (!ORDER_STATUSES.includes(status) || status === "Created") {
    return { ok: false, error: "Invalid status" };
  }
  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId)
    .select("partner_id, order_ref")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };

  if (status === "Delivered" && updated) {
    after(() => requestDeliveryConfirmation(updated.partner_id, updated.order_ref));
  }

  revalidatePath("/fc/orders");
  revalidatePath("/fc");
  return { ok: true };
}
