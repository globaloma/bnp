import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthedFulfillmentCenter, getFcNetworkData } from "@/lib/data/fulfillment-center";
import { PageHeader } from "@/components/dashboard/ui";
import { FcInventoryClient } from "./inventory-client";

export const metadata: Metadata = { title: "Inventory" };

export default async function FcInventoryPage() {
  const auth = await getAuthedFulfillmentCenter();
  if (!auth?.fc) redirect("/login");

  const { products } = await getFcNetworkData();

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Stock levels across every merchant, in one place."
      />
      <FcInventoryClient products={products} />
    </div>
  );
}
