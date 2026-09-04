import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  Order,
  Partner,
  Product,
  ReturnClaim,
  RewardEvent,
  WalletTransaction,
} from "@/types/db";

export async function getAuthedPartner(): Promise<{
  userId: string;
  partner: Partner | null;
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

  return { userId: user.id, partner: partner as Partner | null };
}

export async function getDashboardData(partnerId: string) {
  const supabase = await createClient();

  const [products, orders, walletTxns, returns, rewards] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select("*")
      .eq("partner_id", partnerId)
      .order("placed_at", { ascending: false }),
    supabase
      .from("wallet_transactions")
      .select("*")
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false }),
    supabase
      .from("returns")
      .select("*")
      .eq("partner_id", partnerId)
      .order("filed_at", { ascending: false }),
    supabase
      .from("reward_events")
      .select("*")
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false }),
  ]);

  return {
    products: (products.data ?? []) as Product[],
    orders: (orders.data ?? []) as Order[],
    walletTransactions: (walletTxns.data ?? []) as WalletTransaction[],
    returns: (returns.data ?? []) as ReturnClaim[],
    rewards: (rewards.data ?? []) as RewardEvent[],
  };
}
