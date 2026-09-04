"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { topUpSchema, type ActionResult } from "@/lib/schemas/wallet";

export async function topUpWallet(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = topUpSchema.safeParse({ amount: formData.get("amount") });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Enter a valid amount.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("wallet_top_up", {
    p_amount: parsed.data.amount,
    p_note: "Manual top-up",
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/wallet");
  revalidatePath("/dashboard");
  return { ok: true };
}
