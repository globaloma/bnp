import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthedFulfillmentCenter } from "@/lib/data/fulfillment-center";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/ui";
import { BinsClient, type BinRow } from "./bins-client";

export const metadata: Metadata = { title: "Bins" };

export default async function BinsPage() {
  const auth = await getAuthedFulfillmentCenter();
  if (!auth?.fc) redirect("/login");

  const supabase = await createClient();
  const [{ data: bins }, { data: stock }] = await Promise.all([
    supabase
      .from("bins")
      .select("id, location, code, barcode, active, created_at")
      .order("location")
      .order("code"),
    supabase
      .from("bin_stock")
      .select("bin_id, quantity, product:products(name, variant, sku)"),
  ]);

  type StockRow = {
    bin_id: string;
    quantity: number;
    product: { name: string; variant: string | null; sku: string | null } | null;
  };
  const stockByBin = new Map(
    ((stock ?? []) as unknown as StockRow[]).map((s) => [s.bin_id, s]),
  );

  const rows: BinRow[] = (bins ?? []).map((b) => {
    const s = stockByBin.get(b.id);
    return {
      ...b,
      contents: s?.product
        ? {
            label: `${s.product.name}${s.product.variant ? ` (${s.product.variant})` : ""}`,
            sku: s.product.sku,
            quantity: s.quantity,
          }
        : null,
    };
  });

  return (
    <>
      <PageHeader
        title="Bins"
        description="Labelled shelf spots in each warehouse. Each bin holds one SKU; a SKU can use several bins. Stock lands in bins when it's put away."
      />
      <BinsClient bins={rows} />
    </>
  );
}
