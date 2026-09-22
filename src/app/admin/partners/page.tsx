import type { Metadata } from "next";
import { getAdminData } from "@/lib/data/admin";
import { PageHeader } from "@/components/dashboard/ui";
import { AdminPartnersClient } from "@/components/admin/partners-client";

export const metadata: Metadata = { title: "Partners" };

export default async function AdminPartnersPage() {
  const { partners } = await getAdminData();

  return (
    <div>
      <PageHeader
        title="Partners"
        description="Approve new signups, suspend or reactivate accounts."
      />
      <AdminPartnersClient partners={partners} />
    </div>
  );
}
