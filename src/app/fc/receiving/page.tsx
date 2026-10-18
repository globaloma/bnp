import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthedFulfillmentCenter } from "@/lib/data/fulfillment-center";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/ui";
import type { InboundDelivery } from "@/types/db";
import { ReceivingClient, type DeliverySummary } from "./receiving-client";

export const metadata: Metadata = { title: "Receiving" };

export default async function ReceivingPage() {
  const auth = await getAuthedFulfillmentCenter();
  if (!auth?.fc) redirect("/login");

  const supabase = await createClient();
  const [{ data: open }, { data: recent }, { data: merchants }] = await Promise.all([
    supabase
      .from("inbound_deliveries")
      .select("*, merchant:partners(business_name), lines:inbound_delivery_lines(expected_qty, received_qty)")
      .in("status", ["announced", "receiving"])
      .order("created_at", { ascending: true }),
    supabase
      .from("inbound_deliveries")
      .select("*, merchant:partners(business_name), lines:inbound_delivery_lines(expected_qty, received_qty)")
      .eq("status", "received")
      .order("received_at", { ascending: false })
      .limit(15),
    supabase
      .from("partners")
      .select("id, business_name")
      .eq("role", "merchant")
      .eq("status", "active")
      .order("business_name"),
  ]);

  type Row = InboundDelivery & {
    merchant: { business_name: string } | null;
    lines: { expected_qty: number; received_qty: number }[];
  };
  const summarize = (rows: unknown[] | null): DeliverySummary[] =>
    ((rows ?? []) as Row[]).map(({ merchant, lines, ...d }) => ({
      ...d,
      merchant_name: merchant?.business_name ?? "Unknown merchant",
      expected: lines.reduce((s, l) => s + l.expected_qty, 0),
      received: lines.reduce((s, l) => s + l.received_qty, 0),
      products: lines.length,
      gaps: lines.filter((l) => l.expected_qty !== l.received_qty).length,
    }));

  return (
    <>
      <PageHeader
        title="Receiving"
        description="Deliveries merchants have told us are on the way. Open one to scan the items in as they arrive; each scan adds to on-hand stock."
      />
      <ReceivingClient
        open={summarize(open)}
        recent={summarize(recent)}
        merchants={merchants ?? []}
      />
    </>
  );
}
