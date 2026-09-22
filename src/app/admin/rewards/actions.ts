"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { rewardSchema, type ActionResult } from "@/lib/schemas/admin";

export async function issueReward(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = rewardSchema.safeParse({
    partnerId: formData.get("partnerId"),
    amount: formData.get("amount") || 0,
    type: formData.get("type") || "Reward",
    reason: formData.get("reason") || undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_issue_reward", {
    p_partner_id: d.partnerId,
    p_amount: d.amount,
    p_type: d.type,
    p_reason: d.reason || null,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/rewards");
  return { ok: true };
}
