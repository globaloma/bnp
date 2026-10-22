"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

/** Carrier tracking number for a GIG or UPS parcel (migration 0029). */
export async function saveTrackingNumber(partnerId: string, orderRef: string, tracking: string): Promise<Result> {
  if (!z.string().uuid().safeParse(partnerId).success) return { ok: false, error: "Order not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_tracking_number", {
    p_partner: partnerId,
    p_order_ref: orderRef,
    p_tracking: tracking.slice(0, 100),
  });
  if (error) return { ok: false, error: error.message.replace(/^.*?ERROR:\s*/, "") };
  revalidatePath("/fc/dispatch");
  return { ok: true };
}
