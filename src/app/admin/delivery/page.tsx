import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/dashboard/ui";
import { gigConfigured } from "@/lib/gig";
import type { Carrier } from "@/lib/delivery-methods";
import { AddCarrier, CarrierRates, DispatchZones, GigPanel, type RateCardRow, type ZoneRow } from "./delivery-admin-client";

export const metadata: Metadata = { title: "Delivery rates" };

export default async function AdminDeliveryPage() {
  const supabase = await createClient();
  const [{ data: zones }, { data: rates }, { data: settings }, { data: carriers }] = await Promise.all([
    supabase.from("dispatch_zones").select("id, hub, name, coverage, rate, note, active").order("hub").order("sort").order("name"),
    supabase
      .from("delivery_rate_cards")
      .select("id, carrier, origin_hub, destination_zone, weight_min_kg, weight_max_kg, rate, effective_from, effective_to, created_at")
      .eq("is_active", true)
      .order("origin_hub")
      .order("destination_zone")
      .order("weight_min_kg")
      .limit(5000),
    supabase.from("delivery_settings").select("*").single(),
    supabase.from("carriers").select("code, label").eq("active", true).order("sort").order("label"),
  ]);

  const zoneRows: ZoneRow[] = (zones ?? []).map((z) => ({ ...z, rate: Number(z.rate) }));
  const carrierList: Carrier[] = (carriers ?? []).map((c) => ({ code: c.code as string, label: c.label as string }));
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
      <section className="mb-6">
        <GigPanel
          connected={gigConfigured()}
          settings={{
            markupPercent: Math.round(Number(settings?.gig_markup ?? 0.1) * 10000) / 100,
            abujaLat: Number(settings?.abuja_lat ?? 9.0679),
            abujaLng: Number(settings?.abuja_lng ?? 7.4255),
            lagosLat: Number(settings?.lagos_lat ?? 6.6018),
            lagosLng: Number(settings?.lagos_lng ?? 3.3515),
          }}
        />
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        {carrierList.map((c) => (
          <CarrierRates key={c.code} carrier={c} rows={rateRows.filter((r) => r.carrier === c.code)} />
        ))}
        <AddCarrier />
      </section>
    </div>
  );
}
