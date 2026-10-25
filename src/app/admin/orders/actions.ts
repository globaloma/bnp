"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAuthedAdmin } from "@/lib/data/admin";
import { createDashboardOrder } from "@/lib/create-dashboard-order";
import type { ActionResult } from "@/lib/schemas/order";

/**
 * An admin creates an order for a merchant. It goes through the same checks
 * as the merchant's own New order form, runs with the admin's session (so the
 * database records them as the creator) and is accepted even while the
 * merchant is blocked for an unpaid invoice or an unfunded wallet.
 */
export async function createOrderForMerchant(
  merchantId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await getAuthedAdmin();
  if (!auth?.admin?.is_admin) return { ok: false, error: "Only an admin can do this." };
  if (!z.string().uuid().safeParse(merchantId).success) return { ok: false, error: "Choose a merchant." };

  const supabase = await createClient();
  const { data: merchant } = await supabase
    .from("partners")
    .select("id, role, status")
    .eq("id", merchantId)
    .maybeSingle();
  if (!merchant || merchant.role !== "merchant") return { ok: false, error: "Merchant not found." };
  if (merchant.status !== "active") return { ok: false, error: "This merchant's account isn't active." };

  const result = await createDashboardOrder(supabase, merchantId, formData);
  if (!result.ok) return result;

  revalidatePath("/admin/orders");
  revalidatePath("/admin/live");
  revalidatePath("/dashboard/orders");
  return { ok: true };
}
