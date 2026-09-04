import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthedPartner, getDashboardData } from "@/lib/data/partner";
import { PageHeader } from "@/components/dashboard/ui";
import { InventoryClient } from "./inventory-client";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage() {
  const auth = await getAuthedPartner();
  if (!auth?.partner) redirect("/login");

  const { products } = await getDashboardData(auth.partner.id);

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Products stored across your warehouses."
      />
      <InventoryClient products={products} />
    </div>
  );
}
