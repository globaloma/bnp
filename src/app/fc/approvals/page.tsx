import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthedFulfillmentCenter } from "@/lib/data/fulfillment-center";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/ui";
import { ApprovalsClient, type AdjustmentRow, type ProductOption } from "./approvals-client";

export const metadata: Metadata = { title: "Approvals" };

export default async function ApprovalsPage() {
  const auth = await getAuthedFulfillmentCenter();
  if (!auth?.fc) redirect("/login");

  const supabase = await createClient();
  const [{ data: isSupervisor }, { data: rows }, { data: products }] = await Promise.all([
    supabase.rpc("is_supervisor"),
    supabase
      .from("stock_adjustments")
      .select(
        "*, product:products(name, variant, barcode, on_hand, allocated, quarantined, merchant:partners(business_name)), bin:bins(code)",
      )
      .order("requested_at", { ascending: false })
      .limit(60),
    supabase
      .from("products")
      .select("id, name, variant, barcode, location, on_hand, merchant:partners(business_name)")
      .order("name"),
  ]);

  type Row = {
    id: string;
    kind: "count" | "manual" | "quarantine";
    expected_qty: number | null;
    counted_qty: number | null;
    change: number;
    to_stock: boolean;
    reason: string;
    status: "pending" | "approved" | "rejected";
    requested_by: string;
    requested_at: string;
    decided_by: string | null;
    decided_at: string | null;
    decision_note: string | null;
    product: {
      name: string;
      variant: string | null;
      barcode: string | null;
      on_hand: number;
      allocated: number;
      quarantined: number;
      merchant: { business_name: string } | null;
    } | null;
    bin: { code: string } | null;
  };
  const list = (rows ?? []) as unknown as Row[];
  const peopleIds = [...new Set(list.flatMap((r) => [r.requested_by, r.decided_by]).filter((x): x is string => Boolean(x)))];
  const { data: people } = peopleIds.length
    ? await supabase.from("partners").select("id, contact_name, business_name").in("id", peopleIds)
    : { data: [] };
  const nameOf = new Map((people ?? []).map((p) => [p.id, p.contact_name || p.business_name]));

  const adjustments: AdjustmentRow[] = list.map((r) => ({
    id: r.id,
    kind: r.kind,
    product: r.product ? (r.product.variant ? `${r.product.name} (${r.product.variant})` : r.product.name) : "Product",
    barcode: r.product?.barcode ?? null,
    merchant: r.product?.merchant?.business_name ?? "",
    bin: r.bin?.code ?? null,
    expected: r.expected_qty,
    counted: r.counted_qty,
    change: r.change,
    toStock: r.to_stock,
    reason: r.reason,
    status: r.status,
    onHand: r.product?.on_hand ?? 0,
    allocated: r.product?.allocated ?? 0,
    requestedBy: nameOf.get(r.requested_by) ?? "Staff",
    requestedAt: r.requested_at,
    decidedBy: r.decided_by ? (nameOf.get(r.decided_by) ?? "Supervisor") : null,
    decidedAt: r.decided_at,
    note: r.decision_note,
  }));

  type ProductRow = {
    id: string;
    name: string;
    variant: string | null;
    barcode: string | null;
    location: string;
    on_hand: number;
    merchant: { business_name: string } | null;
  };
  const options: ProductOption[] = ((products ?? []) as unknown as ProductRow[]).map((p) => ({
    id: p.id,
    label: p.variant ? `${p.name} (${p.variant})` : p.name,
    detail: `${p.merchant?.business_name ?? ""} · ${p.location} · ${p.barcode ?? ""} · ${p.on_hand} on hand`,
  }));

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Stock only changes outside a scan when a supervisor approves it: count gaps, manual corrections and quarantine decisions. Every decision is logged with who made it."
      />
      <ApprovalsClient adjustments={adjustments} isSupervisor={Boolean(isSupervisor)} products={options} />
    </>
  );
}
