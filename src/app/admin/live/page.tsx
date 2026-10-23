import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/ui";
import { LiveFeed, type FeedLine } from "./live-feed";

export const metadata: Metadata = { title: "Live orders" };

const LINE_FIELDS =
  "id, partner_id, order_ref, customer_name, product_id, quantity, total, status, channel, location, delivery_method, placed_at, updated_at";

/** Start of today in Lagos time (UTC+1), as an ISO string. */
function startOfToday() {
  const lagos = new Date(Date.now() + 60 * 60 * 1000);
  return new Date(
    Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate()) - 60 * 60 * 1000,
  ).toISOString();
}

export default async function AdminLivePage() {
  const supabase = await createClient();
  const since = startOfToday();
  const [{ data: recent }, { data: today }, { data: merchants }] = await Promise.all([
    supabase.from("orders").select(LINE_FIELDS).order("updated_at", { ascending: false }).limit(300),
    supabase.from("orders").select(LINE_FIELDS).or(`placed_at.gte.${since},updated_at.gte.${since}`).limit(2000),
    supabase.from("partners").select("id, business_name").eq("role", "merchant"),
  ]);

  const byId = new Map<string, FeedLine>();
  for (const row of [...(recent ?? []), ...(today ?? [])] as FeedLine[]) {
    byId.set(row.id, { ...row, total: Number(row.total) });
  }

  return (
    <>
      <PageHeader
        title="Live orders"
        description="Every order across all merchants, updating by itself as orders are placed, picked, packed, dispatched and delivered."
      />
      <LiveFeed
        initial={[...byId.values()]}
        since={since}
        merchants={Object.fromEntries((merchants ?? []).map((m) => [m.id, m.business_name]))}
      />
    </>
  );
}
