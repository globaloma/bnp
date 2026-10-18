import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthedFulfillmentCenter } from "@/lib/data/fulfillment-center";
import { PageHeader } from "@/components/dashboard/ui";
import { PutawayStation } from "./putaway-station";

export const metadata: Metadata = { title: "Putaway" };

export default async function PutawayPage() {
  const auth = await getAuthedFulfillmentCenter();
  if (!auth?.fc) redirect("/login");

  return (
    <>
      <PageHeader
        title="Putaway"
        description="Place received stock into bins. Scan a bin label, then scan each item that goes into it."
      />
      <PutawayStation />
    </>
  );
}
