"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/lib/welcome-email";
import type { PartnerStatus } from "@/types/db";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function setPartnerStatus(
  partnerId: string,
  status: PartnerStatus,
  reason?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_partner_status", {
    p_partner_id: partnerId,
    p_status: status,
    p_reason: reason || null,
  });

  if (error) return { ok: false, error: error.message };

  // First approval only; sendWelcomeEmail skips anyone already welcomed.
  if (status === "active") after(() => sendWelcomeEmail(partnerId));

  revalidatePath("/admin/partners");
  return { ok: true };
}

/** Lets a warehouse account approve stock adjustments (counts, quarantine). */
export async function setSupervisor(partnerId: string, on: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_supervisor", { p_partner: partnerId, p_on: on });
  if (error) return { ok: false, error: error.message.replace(/^.*?ERROR:\s*/, "") };
  revalidatePath("/admin/partners");
  return { ok: true };
}
