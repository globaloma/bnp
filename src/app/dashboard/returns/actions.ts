"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { returnSchema, type ActionResult } from "@/lib/schemas/return";

export async function fileReturn(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired, sign in again." };

  const parsed = returnSchema.safeParse({
    orderId: formData.get("orderId"),
    reason: formData.get("reason"),
    imageUrl: formData.get("imageUrl") || undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const d = parsed.data;

  const { data: order } = await supabase
    .from("orders")
    .select("id, order_ref, product_name")
    .eq("id", d.orderId)
    .single();

  if (!order) return { ok: false, error: "That order could not be found." };

  const { count } = await supabase
    .from("returns")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", user.id);

  const returnRef = `RET-${String((count ?? 0) + 1).padStart(3, "0")}`;

  const { error } = await supabase.from("returns").insert({
    partner_id: user.id,
    return_ref: returnRef,
    order_id: order.id,
    order_ref: order.order_ref,
    product_name: order.product_name,
    reason: d.reason,
    image_url: d.imageUrl || null,
    status: "Under Review",
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/returns");
  return { ok: true };
}
