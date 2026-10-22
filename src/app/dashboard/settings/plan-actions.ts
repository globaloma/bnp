"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyEnterpriseChoice } from "@/lib/plans";

export async function changePlan(
  plan: "standard" | "enterprise",
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (plan !== "standard" && plan !== "enterprise") return { ok: false, error: "Choose Standard or Enterprise." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session expired, sign in again." };

  const { error } = await supabase.rpc("set_my_plan", { p_plan: plan });
  if (error) return { ok: false, error: error.message.replace(/^.*?ERROR:\s*/, "") };

  if (plan === "enterprise") {
    const { data: partner } = await supabase
      .from("partners")
      .select("business_name, contact_name, email, phone")
      .eq("id", user.id)
      .single();
    if (partner) {
      after(() =>
        notifyEnterpriseChoice({
          businessName: partner.business_name,
          contactName: partner.contact_name,
          email: partner.email,
          phone: partner.phone,
          source: "settings",
        }),
      );
    }
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}
