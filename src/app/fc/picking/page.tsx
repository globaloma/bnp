import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthedFulfillmentCenter } from "@/lib/data/fulfillment-center";
import { PageHeader } from "@/components/dashboard/ui";
import { PickListClient } from "./pick-list-client";

export const metadata: Metadata = { title: "Picking" };

export default async function PickingPage() {
  const auth = await getAuthedFulfillmentCenter();
  if (!auth?.fc) redirect("/login");

  return (
    <>
      <PageHeader
        title="Picking"
        description="Paid orders waiting to be picked, oldest first. Open one order at a time, scan each bin and item, and the package label prints when the order is complete."
      />
      <PickListClient />
    </>
  );
}
