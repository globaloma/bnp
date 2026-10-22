import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthedFulfillmentCenter } from "@/lib/data/fulfillment-center";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/ui";
import { StorageClient, type StorageRow } from "./storage-client";

export const metadata: Metadata = { title: "Storage space" };

export default async function StoragePage() {
  const auth = await getAuthedFulfillmentCenter();
  if (!auth?.fc) redirect("/login");

  const supabase = await createClient();
  const [{ data: merchants }, { data: products }, { data: bins }] = await Promise.all([
    supabase
      .from("partners")
      .select("id, business_name, plan_type, storage_sqm, status")
      .eq("role", "merchant")
      .order("business_name"),
    supabase.from("products").select("partner_id, on_hand"),
    supabase.from("bin_stock").select("quantity, product:products(partner_id)").gt("quantity", 0),
  ]);

  const units = new Map<string, number>();
  for (const p of products ?? []) units.set(p.partner_id, (units.get(p.partner_id) ?? 0) + p.on_hand);
  const binCount = new Map<string, number>();
  for (const b of (bins ?? []) as unknown as { product: { partner_id: string } | null }[]) {
    if (b.product) binCount.set(b.product.partner_id, (binCount.get(b.product.partner_id) ?? 0) + 1);
  }

  const rows: StorageRow[] = (merchants ?? []).map((m) => ({
    id: m.id,
    name: m.business_name,
    plan: m.plan_type,
    active: m.status === "active",
    sqm: Number(m.storage_sqm),
    units: units.get(m.id) ?? 0,
    bins: binCount.get(m.id) ?? 0,
  }));

  return (
    <>
      <PageHeader
        title="Storage space"
        description="The floor space each merchant's stock takes up. Storage is billed at ₦10,000 per m² each month, so keep this up to date when stock grows or shrinks."
      />
      <StorageClient rows={rows} />
    </>
  );
}
