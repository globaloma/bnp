import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getAuthedFulfillmentCenter } from "@/lib/data/fulfillment-center";
import { createClient } from "@/lib/supabase/server";
import type { Order } from "@/types/db";
import { PickStation, type PickLine } from "./pick-station";

export const metadata: Metadata = { title: "Pick order" };

export default async function PickOrderPage({ params }: PageProps<"/fc/picking/[id]">) {
  const { id } = await params;
  const auth = await getAuthedFulfillmentCenter();
  if (!auth?.fc) redirect("/login");

  const supabase = await createClient();
  const { data: first } = await supabase
    .from("orders")
    .select("partner_id, order_ref")
    .eq("id", id)
    .maybeSingle();
  if (!first) notFound();

  const [{ data: lines }, { data: merchant }] = await Promise.all([
    supabase
      .from("orders")
      .select("*, product:products(name, variant, barcode)")
      .eq("partner_id", first.partner_id)
      .eq("order_ref", first.order_ref)
      .neq("status", "Cancelled")
      .order("created_at"),
    supabase.from("partners").select("business_name, code").eq("id", first.partner_id).single(),
  ]);

  type Row = Order & { product: { name: string; variant: string | null; barcode: string | null } | null };
  const rows = (lines ?? []) as Row[];
  if (rows.length === 0) notFound();

  const productIds = [...new Set(rows.map((r) => r.product_id).filter((p): p is string => Boolean(p)))];
  const { data: binRows } = productIds.length
    ? await supabase
        .from("bin_stock")
        .select("product_id, quantity, bin:bins(code, location)")
        .in("product_id", productIds)
        .gt("quantity", 0)
    : { data: [] };

  type BinRow = { product_id: string; quantity: number; bin: { code: string; location: string } | null };
  const binsByProduct = new Map<string, { code: string; quantity: number }[]>();
  for (const b of (binRows ?? []) as unknown as BinRow[]) {
    if (!b.bin || b.bin.location !== rows[0].location) continue;
    binsByProduct.set(b.product_id, [...(binsByProduct.get(b.product_id) ?? []), { code: b.bin.code, quantity: b.quantity }]);
  }

  const pickLines: PickLine[] = rows.map((r) => ({
    id: r.id,
    product_id: r.product_id,
    name: r.product ? (r.product.variant ? `${r.product.name} (${r.product.variant})` : r.product.name) : r.product_name,
    barcode: r.product?.barcode ?? null,
    quantity: r.quantity,
    picked: r.picked_qty,
    bins: (r.product_id ? binsByProduct.get(r.product_id) ?? [] : []).sort((a, b) => a.code.localeCompare(b.code)),
  }));

  const order = rows[0];
  return (
    <PickStation
      order={{
        partnerId: order.partner_id,
        orderRef: order.order_ref,
        status: rows.some((r) => r.status === "Picking")
          ? "Picking"
          : rows.every((r) => r.status === "Reserved")
            ? "Reserved"
            : order.status,
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        deliveryAddress: order.delivery_address,
        rider: order.rider,
        location: order.location,
        placedAt: order.placed_at,
        merchantName: merchant?.business_name ?? "Merchant",
        merchantCode: merchant?.code ?? "",
      }}
      initialLines={pickLines}
    />
  );
}
