import type { OrderRider, WarehouseLocation } from "@/types/db";

// Delivery options (migration 0029). Shared by the browser and the server:
// no secrets here, just the menu and how to price it from public rates.

export type DeliveryMethod = "bnp_dispatch" | "gig" | "ups" | "walk_in" | "own_rider";

export const DELIVERY_METHODS: { id: DeliveryMethod; label: string; blurb: string }[] = [
  { id: "bnp_dispatch", label: "BNP Dispatch", blurb: "Our riders, flat rate by area" },
  { id: "gig", label: "GIG Logistics", blurb: "Nationwide, priced by weight" },
  { id: "ups", label: "UPS", blurb: "International and express, priced by weight" },
  { id: "walk_in", label: "Walk-in collection", blurb: "Free, collect from our Abuja hub" },
  { id: "own_rider", label: "Own rider", blurb: "The merchant's own delivery" },
];

export function methodLabel(method: string | null | undefined): string {
  return DELIVERY_METHODS.find((m) => m.id === method)?.label ?? "Delivery";
}

/** The older rider field, kept in step so existing screens keep working. */
export function riderFor(method: DeliveryMethod): OrderRider {
  if (method === "own_rider") return "Own Rider";
  if (method === "walk_in") return "Pickup";
  return "BNP Fleet";
}

export type DispatchZoneOption = { name: string; coverage: string | null; rate: number; note: string | null };
export type RateRow = { carrier: "UPS" | "GIG"; zone: string; min: number; max: number; rate: number };
export type OwnZoneOption = { id: string; name: string; fee: number };

/** Everything a picker needs for one warehouse. */
export type DeliveryOptions = {
  hub: WarehouseLocation;
  dispatchZones: DispatchZoneOption[];
  rates: RateRow[];
  ownZones: OwnZoneOption[];
  walkIn: boolean;
};

export function carrierZones(options: DeliveryOptions, carrier: "UPS" | "GIG"): string[] {
  return [...new Set(options.rates.filter((r) => r.carrier === carrier).map((r) => r.zone))].sort();
}

/** Price shown in the browser; the server prices it again before saving. */
export function previewFee(
  options: DeliveryOptions,
  method: DeliveryMethod,
  zone: string,
  weightKg: number,
): number | null {
  if (method === "walk_in") return options.walkIn ? 0 : null;
  if (method === "bnp_dispatch") return options.dispatchZones.find((z) => z.name === zone)?.rate ?? null;
  if (method === "gig" || method === "ups") {
    const carrier = method === "gig" ? "GIG" : "UPS";
    const row = options.rates.find(
      (r) => r.carrier === carrier && r.zone === zone && r.min <= weightKg && r.max > weightKg,
    );
    return row ? row.rate : null;
  }
  if (method === "own_rider") return options.ownZones.find((z) => z.id === zone)?.fee ?? null;
  return null;
}

export function availableMethods(options: DeliveryOptions, mode: "merchant" | "store"): DeliveryMethod[] {
  const list: DeliveryMethod[] = [];
  if (options.dispatchZones.length > 0) list.push("bnp_dispatch");
  if (options.rates.some((r) => r.carrier === "GIG")) list.push("gig");
  if (options.rates.some((r) => r.carrier === "UPS")) list.push("ups");
  if (options.walkIn) list.push("walk_in");
  // Merchants can always use their own rider; store customers only when the
  // merchant has set up their own delivery areas.
  if (mode === "merchant" || options.ownZones.length > 0) list.push("own_rider");
  return list;
}
