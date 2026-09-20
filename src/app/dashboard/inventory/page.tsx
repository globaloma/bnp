import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthedPartner, getDashboardData } from "@/lib/data/partner";
import { PageHeader } from "@/components/dashboard/ui";
import { StorefrontLink } from "@/components/dashboard/storefront-link";
import { InventoryClient } from "./inventory-client";

export const metadata: Metadata = { title: "Inventory" };

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bnpfulfillment.com";

export default async function InventoryPage() {
  const auth = await getAuthedPartner();
  if (!auth?.partner) redirect("/login");

  const { products } = await getDashboardData(auth.partner.id);

  return (
    <div>
      <PageHeader
        title="Inventory"
        description='Products stored across your warehouses. Only products marked "Show on your public storefront" are visible to customers.'
        action={<StorefrontLink slug={auth.partner.slug} siteUrl={SITE_URL} />}
      />
      <InventoryClient products={products} />
    </div>
  );
}
