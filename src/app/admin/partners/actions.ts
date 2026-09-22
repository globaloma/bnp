"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PartnerStatus } from "@/types/db";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function setPartnerStatus(
  partnerId: string,
  status: PartnerStatus,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_partner_status", {
    p_partner_id: partnerId,
    p_status: status,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/partners");
  return { ok: true };
}
