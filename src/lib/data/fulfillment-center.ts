import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Order, Partner, Product } from "@/types/db";

export type OrderWithMerchant = Order & { merchant_name: string };
export type ProductWithMerchant = Product & { merchant_name: string };

export async function getAuthedFulfillmentCenter(): Promise<{
  userId: string;
  fc: Partner | null;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: partner } = await supabase
    .from("partners")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return { userId: user.id, fc: partner as Partner | null };
}

type MerchantJoin = { business_name: string } | null;

export async function getFcNetworkData() {
  const supabase = await createClient();

  const [products, orders] = await Promise.all([
    supabase
      .from("products")
      .select("*, merchant:partners(business_name)")
      .order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select("*, merchant:partners(business_name)")
      .order("placed_at", { ascending: false }),
  ]);

  return {
    products: (products.data ?? []).map((row) => {
      const { merchant, ...rest } = row as Product & { merchant: MerchantJoin };
      return { ...rest, merchant_name: merchant?.business_name ?? "Unknown merchant" };
    }) as ProductWithMerchant[],
    orders: (orders.data ?? []).map((row) => {
      const { merchant, ...rest } = row as Order & { merchant: MerchantJoin };
      return { ...rest, merchant_name: merchant?.business_name ?? "Unknown merchant" };
    }) as OrderWithMerchant[],
  };
}
