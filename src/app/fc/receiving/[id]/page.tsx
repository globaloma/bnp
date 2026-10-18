import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getAuthedFulfillmentCenter } from "@/lib/data/fulfillment-center";
import { createClient } from "@/lib/supabase/server";
import type { InboundDelivery } from "@/types/db";
import { ReceiveStation, type ReceiveLine } from "./receive-station";

export const metadata: Metadata = { title: "Receive delivery" };

export default async function ReceiveDeliveryPage({ params }: PageProps<"/fc/receiving/[id]">) {
  const { id } = await params;
  const auth = await getAuthedFulfillmentCenter();
  if (!auth?.fc) redirect("/login");

  const supabase = await createClient();
  const { data } = await supabase
    .from("inbound_deliveries")
    .select(
      "*, merchant:partners(business_name), lines:inbound_delivery_lines(product_id, expected_qty, received_qty, product:products(name, variant, barcode, sku))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  type Row = InboundDelivery & {
    merchant: { business_name: string } | null;
    lines: {
      product_id: string;
      expected_qty: number;
      received_qty: number;
      product: { name: string; variant: string | null; barcode: string | null; sku: string | null } | null;
    }[];
  };
  const { merchant, lines, ...delivery } = data as unknown as Row;

  const rows: ReceiveLine[] = lines
    .map((l) => ({
      product_id: l.product_id,
      name: l.product?.name ?? "Product",
      variant: l.product?.variant ?? null,
      barcode: l.product?.barcode ?? l.product?.sku ?? null,
      expected: l.expected_qty,
      received: l.received_qty,
    }))
    .sort((a, b) => a.name.localeCompare(b.name) || (a.variant ?? "").localeCompare(b.variant ?? ""));

  return (
    <ReceiveStation
      delivery={delivery}
      merchantName={merchant?.business_name ?? "Unknown merchant"}
      initialLines={rows}
    />
  );
}
