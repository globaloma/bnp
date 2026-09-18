import type { SupabaseClient } from "@supabase/supabase-js";

export async function generateOrderRef(
  supabase: SupabaseClient,
  partnerId: string,
): Promise<string> {
  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partnerId);

  return `ORD-${String((count ?? 0) + 41).padStart(4, "0")}`;
}
