"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function setStorageSpace(
  partnerId: string,
  crates: number,
  pallets: number,
  heightM: number,
): Promise<{ ok: true; sqm: number } | { ok: false; error: string }> {
  if (!z.string().uuid().safeParse(partnerId).success) return { ok: false, error: "Merchant not found." };
  if (!Number.isInteger(crates) || crates < 0) return { ok: false, error: "Enter the number of crates." };
  if (!Number.isInteger(pallets) || pallets < 0) return { ok: false, error: "Enter the number of pallets." };
  if (!Number.isFinite(heightM) || heightM < 0) return { ok: false, error: "Enter the pallet stack height in metres." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_storage_space", {
    p_partner: partnerId,
    p_crates: crates,
    p_pallets: pallets,
    p_height: heightM,
  });
  if (error) return { ok: false, error: error.message.replace(/^.*?ERROR:\s*/, "") };
  revalidatePath("/fc/storage");
  revalidatePath("/admin/billing");
  return { ok: true, sqm: Number(data) };
}
