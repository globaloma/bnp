import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthedPartner, getDashboardData } from "@/lib/data/partner";
import { PageHeader } from "@/components/dashboard/ui";
import { StorefrontLink } from "@/components/dashboard/storefront-link";
import { VatToggle } from "@/components/dashboard/vat-toggle";
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
        action={
          <div className="flex flex-wrap items-center gap-2">
            <VatToggle initialChargesVat={auth.partner.charges_vat} />
            <StorefrontLink slug={auth.partner.slug} siteUrl={SITE_URL} />
          </div>
        }
      />
      <InventoryClient products={products} />
    </div>
  );
}
