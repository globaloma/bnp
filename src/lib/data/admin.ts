import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Partner, PartnerStatusLog, RewardEvent, StockEvent } from "@/types/db";

export async function getAuthedAdmin(): Promise<{
  userId: string;
  admin: Partner | null;
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

  return { userId: user.id, admin: partner as Partner | null };
}

export async function getAdminData() {
  const supabase = await createClient();

  const [partners, rewards, statusLogs, stockEvents] = await Promise.all([
    supabase.from("partners").select("*").order("created_at", { ascending: false }),
    supabase
      .from("reward_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("partner_status_log")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("stock_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const statusLogByPartner: Record<string, PartnerStatusLog> = {};
  for (const log of (statusLogs.data ?? []) as PartnerStatusLog[]) {
    // Already ordered newest-first, so the first hit per partner is latest.
    if (!statusLogByPartner[log.partner_id]) {
      statusLogByPartner[log.partner_id] = log;
    }
  }

  return {
    partners: (partners.data ?? []) as Partner[],
    rewards: (rewards.data ?? []) as RewardEvent[],
    statusLogByPartner,
    stockEvents: (stockEvents.data ?? []) as StockEvent[],
  };
}
