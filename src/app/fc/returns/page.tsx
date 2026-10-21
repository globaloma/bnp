import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthedFulfillmentCenter } from "@/lib/data/fulfillment-center";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/ui";
import type { WarehouseLocation } from "@/types/db";
import { ReturnStation, type QuarantineItem } from "./return-station";

export const metadata: Metadata = { title: "Returns" };

export default async function ReturnsPage() {
  const auth = await getAuthedFulfillmentCenter();
  if (!auth?.fc) redirect("/login");

  const supabase = await createClient();
  const [{ data: quarantine }, { data: pending }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, variant, barcode, location, quarantined, merchant:partners(business_name)")
      .gt("quarantined", 0)
      .order("name"),
    supabase
      .from("stock_adjustments")
      .select("product_id, change")
      .eq("kind", "quarantine")
      .eq("status", "pending"),
  ]);

  const pendingByProduct = new Map<string, number>();
  for (const p of pending ?? []) {
    pendingByProduct.set(p.product_id, (pendingByProduct.get(p.product_id) ?? 0) - p.change);
  }

  type Row = {
    id: string;
    name: string;
    variant: string | null;
    barcode: string | null;
    location: WarehouseLocation;
    quarantined: number;
    merchant: { business_name: string } | null;
  };
  const items: QuarantineItem[] = ((quarantine ?? []) as unknown as Row[]).map((p) => ({
    id: p.id,
    label: p.variant ? `${p.name} (${p.variant})` : p.name,
    barcode: p.barcode,
    location: p.location,
    merchant: p.merchant?.business_name ?? "Merchant",
    quarantined: p.quarantined,
    pending: pendingByProduct.get(p.id) ?? 0,
  }));

  return (
    <>
      <PageHeader
        title="Returns"
        description="Scan a returned parcel's label, then inspect and scan each item. Good items wait to go back into a bin; damaged ones go to quarantine until a supervisor decides."
      />
      <ReturnStation quarantine={items} />
    </>
  );
}
