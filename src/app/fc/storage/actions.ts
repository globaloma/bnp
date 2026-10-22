"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function setStorageSqm(
  partnerId: string,
  sqm: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!z.string().uuid().safeParse(partnerId).success) return { ok: false, error: "Merchant not found." };
  if (!Number.isFinite(sqm) || sqm < 0) return { ok: false, error: "Enter the floor space in m²." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_storage_sqm", { p_partner: partnerId, p_sqm: sqm });
  if (error) return { ok: false, error: error.message.replace(/^.*?ERROR:\s*/, "") };
  revalidatePath("/fc/storage");
  revalidatePath("/admin/billing");
  return { ok: true };
}
