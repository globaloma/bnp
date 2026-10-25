"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Shows or hides the merchant's published products on BNP Shop. */
export async function setMarketplaceListing(enabled: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired, sign in again." };
  const { error } = await supabase.from("partners").update({ marketplace_enabled: enabled }).eq("id", user.id);
  if (error) return { ok: false, error: "Could not save that. Please try again." };
  revalidatePath("/dashboard/settings");
  return { ok: true };
}
