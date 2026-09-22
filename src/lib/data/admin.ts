import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Partner, RewardEvent } from "@/types/db";

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

  const [partners, rewards] = await Promise.all([
    supabase.from("partners").select("*").order("created_at", { ascending: false }),
    supabase
      .from("reward_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return {
    partners: (partners.data ?? []) as Partner[],
    rewards: (rewards.data ?? []) as RewardEvent[],
  };
}
