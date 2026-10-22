import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WarehouseLocation } from "@/types/db";
import { methodLabel, riderFor, type DeliveryMethod, type DeliveryOptions } from "@/lib/delivery-methods";
import { createAdminClient } from "@/lib/supabase/admin";
import { gigConfigured, gigPrice, gigStations } from "@/lib/gig";

// Server side of delivery options: what's on offer for a warehouse, and the
// authoritative price for a choice. Prices come from the database
// (delivery_quote, migration 0029), never from the browser.

export async function loadDeliveryOptions(
  supabase: SupabaseClient,
  hub: WarehouseLocation,
  partnerId: string,
): Promise<DeliveryOptions> {
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: zones }, { data: rates }, { data: own }] = await Promise.all([
    supabase
      .from("dispatch_zones")
      .select("name, coverage, rate, note")
      .eq("hub", hub)
      .eq("active", true)
      .order("sort"),
    supabase
      .from("delivery_rate_cards")
      .select("carrier, destination_zone, weight_min_kg, weight_max_kg, rate, effective_from, effective_to")
      .eq("origin_hub", hub)
      .eq("is_active", true)
      .lte("effective_from", today),
    supabase.from("delivery_zones").select("id, name, fee").eq("partner_id", partnerId).order("created_at"),
  ]);
  // Live GIG destinations; if GIG can't be reached, GIG falls back to any
  // uploaded rate card rather than breaking the order form.
  let gigLive: string[] | null = null;
  if (gigConfigured() && hub !== "USA") {
    try {
      gigLive = (await gigStations()).map((s) => s.name);
    } catch (err) {
      console.error("[gig] stations", err);
    }
  }
  return {
    hub,
    dispatchZones: (zones ?? []).map((z) => ({ ...z, rate: Number(z.rate) })),
    rates: (rates ?? [])
      .filter((r) => !r.effective_to || r.effective_to >= today)
      .map((r) => ({
        carrier: r.carrier as "UPS" | "GIG",
        zone: r.destination_zone as string,
        min: Number(r.weight_min_kg),
        max: Number(r.weight_max_kg),
        rate: Number(r.rate),
      })),
    ownZones: (own ?? []).map((z) => ({ id: z.id, name: z.name, fee: Number(z.fee) })),
    walkIn: hub === "Abuja",
    gigLive,
  };
}

/** GIG weighs in half-kilo steps; anything under that is priced as 0.5 kg. */
function gigWeight(kg: number): number {
  return Math.max(0.5, Math.ceil(kg * 2) / 2);
}

/**
 * BNP's price for a GIG parcel: GIG's live price plus BNP's markup, rounded
 * up to the next ₦50. Null when GIG isn't connected or can't price it.
 */
export async function liveGigFee(hub: WarehouseLocation, zone: string, weightKg: number): Promise<number | null> {
  if (!gigConfigured() || hub === "USA") return null;
  const admin = createAdminClient();
  const { data: settings } = await admin.from("delivery_settings").select("*").single();
  if (!settings) return null;
  const from =
    hub === "Lagos"
      ? { lat: Number(settings.lagos_lat), lng: Number(settings.lagos_lng) }
      : { lat: Number(settings.abuja_lat), lng: Number(settings.abuja_lng) };
  try {
    const base = await gigPrice({ from, fromStation: hub, to: zone, weightKg: gigWeight(weightKg) });
    return Math.ceil((base * (1 + Number(settings.gig_markup))) / 50) * 50;
  } catch (err) {
    console.error("[gig] price", err);
    return null;
  }
}

export type PricedDelivery = {
  method: DeliveryMethod;
  fee: number;
  zone: string | null;
  rider: "BNP Fleet" | "Own Rider" | "Pickup";
  /** e.g. "BNP Dispatch (Abuja Zone 2)", for the order line. */
  label: string;
};

/**
 * Prices a delivery choice. `ownFee` is what a merchant types for their own
 * rider on orders they create; store customers pick one of the merchant's
 * own areas (`zone` is then that area's id).
 */
export async function priceDelivery(
  supabase: SupabaseClient,
  input: {
    method: DeliveryMethod;
    hub: WarehouseLocation;
    zone?: string | null;
    weightKg?: number;
    partnerId: string;
    ownFee?: number;
    mode: "merchant" | "store";
  },
): Promise<{ ok: true; delivery: PricedDelivery } | { ok: false; error: string }> {
  const { method, hub, partnerId } = input;
  const zone = (input.zone ?? "").trim();
  const base = { method, rider: riderFor(method) } as const;

  if (method === "own_rider") {
    if (input.mode === "merchant") {
      const fee = Math.max(0, Number(input.ownFee ?? 0));
      return { ok: true, delivery: { ...base, fee, zone: null, label: "Own rider" } };
    }
    const { data: own } = await supabase
      .from("delivery_zones")
      .select("name, fee")
      .eq("partner_id", partnerId)
      .eq("id", zone)
      .maybeSingle();
    if (!own) return { ok: false, error: "Choose your delivery area." };
    return { ok: true, delivery: { ...base, fee: Number(own.fee), zone: own.name, label: `Delivery (${own.name})` } };
  }

  if (method !== "walk_in" && !zone) return { ok: false, error: "Choose the delivery area." };

  if (method === "gig" && gigConfigured() && hub !== "USA") {
    const weightKg = Math.round((input.weightKg ?? 0) * 100) / 100;
    const fee = await liveGigFee(hub, zone, weightKg);
    if (fee === null) return { ok: false, error: "GIG couldn't price this delivery right now. Choose another option." };
    // Recorded so the database accepts this price on a merchant's order.
    await createAdminClient()
      .from("delivery_quotes")
      .insert({ partner_id: partnerId, method: "gig", hub, zone, weight_kg: weightKg, amount: fee });
    return { ok: true, delivery: { ...base, fee, zone, label: `${methodLabel(method)} (${zone})` } };
  }

  const { data, error } = await supabase.rpc("delivery_quote", {
    p_method: method,
    p_hub: hub,
    p_zone: zone || null,
    p_weight: input.weightKg ?? 0,
  });
  if (error) return { ok: false, error: "Couldn't price this delivery. Try again." };
  if (data === null || data === undefined) {
    if (method === "walk_in") return { ok: false, error: "Walk-in collection is only at our Abuja hub." };
    if (method === "gig" || method === "ups") {
      return { ok: false, error: `${methodLabel(method)} has no rate for this area and weight. Choose another option.` };
    }
    return { ok: false, error: "That delivery area isn't available." };
  }
  const fee = Number(data);
  return {
    ok: true,
    delivery: {
      ...base,
      fee,
      zone: zone || null,
      label: method === "walk_in" ? "Walk-in collection" : `${methodLabel(method)} (${zone})`,
    },
  };
}
