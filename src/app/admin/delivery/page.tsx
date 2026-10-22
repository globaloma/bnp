import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/ui";
import { CarrierRates, DispatchZones, type RateCardRow, type ZoneRow } from "./delivery-admin-client";

export const metadata: Metadata = { title: "Delivery rates" };

export default async function AdminDeliveryPage() {
  const supabase = await createClient();
  const [{ data: zones }, { data: rates }] = await Promise.all([
    supabase.from("dispatch_zones").select("id, hub, name, coverage, rate, note, active").order("hub").order("sort").order("name"),
    supabase
      .from("delivery_rate_cards")
      .select("id, carrier, origin_hub, destination_zone, weight_min_kg, weight_max_kg, rate, effective_from, effective_to, created_at")
      .eq("is_active", true)
      .order("origin_hub")
      .order("destination_zone")
      .order("weight_min_kg")
      .limit(5000),
  ]);

  const zoneRows: ZoneRow[] = (zones ?? []).map((z) => ({ ...z, rate: Number(z.rate) }));
  const rateRows: RateCardRow[] = (rates ?? []).map((r) => ({
    ...r,
    weight_min_kg: Number(r.weight_min_kg),
    weight_max_kg: Number(r.weight_max_kg),
    rate: Number(r.rate),
  }));

  return (
    <div>
      <PageHeader
        title="Delivery rates"
        description="The prices merchants and store customers see when they choose a delivery."
      />
      <section className="mb-8">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-[0.08em] text-graphite">BNP Dispatch zones</h2>
        <p className="mb-3 text-sm text-graphite">Flat rate per area. Changes apply to new orders straight away.</p>
        <DispatchZones zones={zoneRows} />
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        <CarrierRates carrier="UPS" rows={rateRows.filter((r) => r.carrier === "UPS")} />
        <CarrierRates carrier="GIG" rows={rateRows.filter((r) => r.carrier === "GIG")} />
      </section>
    </div>
  );
}
