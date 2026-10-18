import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthedPartner } from "@/lib/data/partner";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/ui";
import type { InboundDelivery, WarehouseLocation } from "@/types/db";
import { DeliveriesClient, type DeliveryWithLines, type PickableProduct } from "./deliveries-client";

export const metadata: Metadata = { title: "Deliveries" };

export default async function DeliveriesPage() {
  const auth = await getAuthedPartner();
  if (!auth?.partner) redirect("/login");

  const supabase = await createClient();
  const [{ data: deliveries }, { data: products }] = await Promise.all([
    supabase
      .from("inbound_deliveries")
      .select(
        "*, lines:inbound_delivery_lines(product_id, expected_qty, received_qty, product:products(name, variant, sku))",
      )
      .eq("partner_id", auth.partner.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("products")
      .select("id, name, variant, sku, location, on_hand")
      .eq("partner_id", auth.partner.id)
      .order("name"),
  ]);

  type Row = InboundDelivery & {
    lines: {
      product_id: string;
      expected_qty: number;
      received_qty: number;
      product: { name: string; variant: string | null; sku: string | null } | null;
    }[];
  };

  const rows: DeliveryWithLines[] = ((deliveries ?? []) as unknown as Row[]).map(({ lines, ...d }) => ({
    ...d,
    lines: lines
      .map((l) => ({
        product_id: l.product_id,
        name: l.product?.name ?? "Product",
        variant: l.product?.variant ?? null,
        sku: l.product?.sku ?? null,
        expected: l.expected_qty,
        received: l.received_qty,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }));

  return (
    <>
      <PageHeader
        title="Deliveries"
        description="Tell the warehouse what stock you're sending. We scan it in when it arrives, and your stock updates as it's counted."
      />
      <DeliveriesClient
        deliveries={rows}
        products={(products ?? []) as (PickableProduct & { location: WarehouseLocation })[]}
      />
    </>
  );
}
