import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthedPartner, getDashboardData } from "@/lib/data/partner";
import { PageHeader } from "@/components/dashboard/ui";
import { ReturnsClient } from "./returns-client";

export const metadata: Metadata = { title: "Returns & claims" };

export default async function ReturnsPage() {
  const auth = await getAuthedPartner();
  if (!auth?.partner) redirect("/login");

  const { returns, orders } = await getDashboardData(auth.partner.id);

  return (
    <div>
      <PageHeader
        title="Returns & claims"
        description="File a claim and track its outcome."
      />
      <ReturnsClient returns={returns} orders={orders} />
    </div>
  );
}
