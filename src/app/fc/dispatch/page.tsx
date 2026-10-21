import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthedFulfillmentCenter } from "@/lib/data/fulfillment-center";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/ui";
import type { Order } from "@/types/db";
import { DispatchStation, type Parcel } from "./dispatch-station";

export const metadata: Metadata = { title: "Dispatch" };

function groupParcels(rows: (Order & { merchant: { business_name: string; code: string } | null })[]): Parcel[] {
  const map = new Map<string, Parcel>();
  for (const r of rows) {
    const key = `${r.partner_id}:${r.order_ref}`;
    const existing = map.get(key);
    if (existing) {
      existing.units += r.quantity;
      continue;
    }
    map.set(key, {
      key,
      packageCode: `${r.merchant?.code ?? ""}-${r.order_ref}`,
      orderRef: r.order_ref,
      merchant: r.merchant?.business_name ?? "Merchant",
      customer: r.customer_name,
      rider: r.rider,
      location: r.location,
      units: r.quantity,
      updatedAt: r.updated_at,
    });
  }
  return [...map.values()];
}

export default async function DispatchPage() {
  const auth = await getAuthedFulfillmentCenter();
  if (!auth?.fc) redirect("/login");

  const supabase = await createClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [{ data: packed }, { data: sent }] = await Promise.all([
    supabase
      .from("orders")
      .select("*, merchant:partners(business_name, code)")
      .eq("status", "Packed")
      .order("updated_at"),
    supabase
      .from("orders")
      .select("*, merchant:partners(business_name, code)")
      .eq("status", "Dispatched")
      .gte("updated_at", startOfDay.toISOString())
      .order("updated_at", { ascending: false }),
  ]);

  type Row = Order & { merchant: { business_name: string; code: string } | null };
  return (
    <>
      <PageHeader
        title="Dispatch"
        description="Scan each package label as the rider collects it. The order becomes Dispatched and the stock leaves the warehouse."
      />
      <DispatchStation
        packed={groupParcels((packed ?? []) as Row[])}
        sentToday={groupParcels((sent ?? []) as Row[])}
      />
    </>
  );
}
