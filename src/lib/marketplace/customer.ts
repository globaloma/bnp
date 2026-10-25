import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Customer = { id: string; full_name: string; phone: string | null; email: string | null };

/**
 * The signed-in shopper, or null. A merchant or staff login isn't a shopper:
 * only accounts made on the shop have a customers row (migration 0033).
 */
export async function getCustomer(): Promise<Customer | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("customers")
    .select("id, full_name, phone, email")
    .eq("id", user.id)
    .maybeSingle();
  return (data as Customer | null) ?? null;
}
