import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthedFulfillmentCenter, getFcNetworkData } from "@/lib/data/fulfillment-center";
import { PageHeader } from "@/components/dashboard/ui";
import { FcOrdersClient } from "./orders-client";

export const metadata: Metadata = { title: "Orders" };

export default async function FcOrdersPage() {
  const auth = await getAuthedFulfillmentCenter();
  if (!auth?.fc) redirect("/login");

  const { orders } = await getFcNetworkData();

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Every order across every merchant, ready to move through fulfillment."
      />
      <FcOrdersClient orders={orders} />
    </div>
  );
}
