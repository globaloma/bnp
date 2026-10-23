"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requestDeliveryConfirmation } from "@/lib/delivery-feedback";
import { emailDeliveryFailed } from "@/lib/delivery-failure-email";
import type { DeliveryProgress } from "@/lib/delivery-progress";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/schemas/order";
import type { OrderStatus } from "@/types/db";
import { ORDER_STATUSES } from "@/types/db";
import { fcStatusOptions } from "@/lib/order-status";

export async function updateOrderStatusAsFc(
  orderId: string,
  status: OrderStatus,
): Promise<ActionResult> {
  if (!ORDER_STATUSES.includes(status)) return { ok: false, error: "Invalid status" };
  const supabase = await createClient();
  // Picking, Packed and Dispatched come from the scan screens; by hand,
  // staff can only cancel before dispatch and record what happened after.
  const { data: current } = await supabase.from("orders").select("status").eq("id", orderId).maybeSingle();
  if (!current) return { ok: false, error: "Order not found." };
  if (!fcStatusOptions(current.status as OrderStatus).includes(status)) {
    return {
      ok: false,
      error:
        status === "Picking" || status === "Packed" || status === "Dispatched"
          ? "Use the Picking and Dispatch screens to move orders forward."
          : `A ${current.status} order can't be set to ${status}.`,
    };
  }
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
  revalidatePath("/fc/picking");
  revalidatePath("/fc/putaway");
  revalidatePath("/fc");
  return { ok: true };
}

/** On the way, or a failed delivery attempt (with the reason). Emails the merchant on a failure. */
export async function setDeliveryProgressAsFc(
  partnerId: string,
  orderRef: string,
  progress: DeliveryProgress,
  note?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_delivery_progress", {
    p_partner: partnerId,
    p_order_ref: orderRef,
    p_progress: progress,
    p_note: note ?? null,
  });
  if (error) return { ok: false, error: error.message };
  if (progress === "failed") after(() => emailDeliveryFailed(partnerId, orderRef));
  revalidatePath("/fc/orders");
  return { ok: true };
}
