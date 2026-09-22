import type { Metadata } from "next";
import { getAdminData } from "@/lib/data/admin";
import { PageHeader } from "@/components/dashboard/ui";
import { AdminRewardsClient } from "@/components/admin/rewards-client";

export const metadata: Metadata = { title: "Rewards" };

export default async function AdminRewardsPage() {
  const { partners, rewards } = await getAdminData();

  return (
    <div>
      <PageHeader
        title="Rewards"
        description="Credit a partner's wallet or log a non-monetary perk when they hit a milestone."
      />
      <AdminRewardsClient partners={partners} rewards={rewards} />
    </div>
  );
}
