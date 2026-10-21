import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthedFulfillmentCenter } from "@/lib/data/fulfillment-center";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/ui";
import { CountStation, type RecentCount } from "./count-station";

export const metadata: Metadata = { title: "Cycle counts" };

export default async function CountsPage() {
  const auth = await getAuthedFulfillmentCenter();
  if (!auth?.fc) redirect("/login");

  const supabase = await createClient();
  const { data } = await supabase
    .from("bin_counts")
    .select(
      "id, expected_qty, counted_qty, counted_at, counted_by, bin:bins(code, location), product:products(name, variant), adjustment:stock_adjustments(status)",
    )
    .order("counted_at", { ascending: false })
    .limit(25);

  type Row = {
    id: string;
    expected_qty: number;
    counted_qty: number;
    counted_at: string;
    counted_by: string;
    bin: { code: string; location: string } | null;
    product: { name: string; variant: string | null } | null;
    adjustment: { status: string } | null;
  };
  const rows = (data ?? []) as unknown as Row[];
  const ids = [...new Set(rows.map((r) => r.counted_by))];
  const { data: people } = ids.length
    ? await supabase.from("partners").select("id, contact_name, business_name").in("id", ids)
    : { data: [] };
  const nameOf = new Map((people ?? []).map((p) => [p.id, p.contact_name || p.business_name]));

  const recent: RecentCount[] = rows.map((r) => ({
    id: r.id,
    bin: r.bin?.code ?? "Bin",
    location: r.bin?.location ?? "",
    product: r.product ? (r.product.variant ? `${r.product.name} (${r.product.variant})` : r.product.name) : "Empty",
    expected: r.expected_qty,
    counted: r.counted_qty,
    at: r.counted_at,
    by: nameOf.get(r.counted_by) ?? "Staff",
    status: r.adjustment?.status ?? (r.expected_qty === r.counted_qty ? "matched" : "pending"),
  }));

  return (
    <>
      <PageHeader
        title="Cycle counts"
        description="Scan a bin and count what's in it. Matching counts are recorded; a gap goes to a supervisor, and stock only changes once they approve it."
      />
      <CountStation recent={recent} />
    </>
  );
}
