import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthedFulfillmentCenter } from "@/lib/data/fulfillment-center";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/ui";
import { StockLogClient, type MovementRow } from "./stock-log-client";

export const metadata: Metadata = { title: "Stock log" };

export default async function StockLogPage() {
  const auth = await getAuthedFulfillmentCenter();
  if (!auth?.fc) redirect("/login");

  const supabase = await createClient();
  const { data } = await supabase
    .from("stock_movements")
    .select(
      "id, movement, on_hand_change, allocated_change, on_hand_after, order_ref, note, actor_id, created_at, product:products(name, variant, barcode, location), merchant:partners!stock_movements_partner_id_fkey(business_name), from:bins!stock_movements_from_bin_fkey(code), to:bins!stock_movements_to_bin_fkey(code)",
    )
    .order("created_at", { ascending: false })
    .limit(300);

  type Row = {
    id: number;
    movement: string;
    on_hand_change: number;
    allocated_change: number;
    on_hand_after: number;
    order_ref: string | null;
    note: string | null;
    actor_id: string | null;
    created_at: string;
    product: { name: string; variant: string | null; barcode: string | null; location: string } | null;
    merchant: { business_name: string } | null;
    from: { code: string } | null;
    to: { code: string } | null;
  };
  const rows = (data ?? []) as unknown as Row[];
  const ids = [...new Set(rows.map((r) => r.actor_id).filter((x): x is string => Boolean(x)))];
  const { data: people } = ids.length
    ? await supabase.from("partners").select("id, contact_name, business_name, role").in("id", ids)
    : { data: [] };
  const nameOf = new Map(
    (people ?? []).map((p) => [p.id, `${p.contact_name || p.business_name}${p.role === "merchant" ? " (merchant)" : ""}`]),
  );

  const movements: MovementRow[] = rows.map((r) => ({
    id: r.id,
    movement: r.movement,
    change: r.on_hand_change,
    allocatedChange: r.allocated_change,
    after: r.on_hand_after,
    ref: r.order_ref,
    note: r.note,
    bins: [r.from?.code, r.to?.code].filter(Boolean).join(" → ") || null,
    by: r.actor_id ? (nameOf.get(r.actor_id) ?? "Staff") : "System",
    at: r.created_at,
    product: r.product ? (r.product.variant ? `${r.product.name} (${r.product.variant})` : r.product.name) : "Product",
    barcode: r.product?.barcode ?? null,
    location: r.product?.location ?? "",
    merchant: r.merchant?.business_name ?? "",
  }));

  return (
    <>
      <PageHeader
        title="Stock log"
        description="Every stock movement, newest first: what moved, by how much, and who did it."
      />
      <StockLogClient movements={movements} />
    </>
  );
}
