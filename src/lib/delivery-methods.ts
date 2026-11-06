import type { OrderRider, WarehouseLocation } from "@/types/db";

// Delivery options (migration 0029, carriers in 0034). Shared by the browser
// and the server: no secrets here, just the menu and how to price it from
// public rates.
//
// A delivery method is either a reserved method (bnp_dispatch, walk_in,
// own_rider) or a carrier code (gig, ups, or any custom logistics company the
// admin added). Carrier codes are identical to the rate-card `carrier` value,
// so a method maps to its carrier by identity.

export type Carrier = { code: string; label: string };

/** Reserved methods plus gig keep literal hints; any carrier code is allowed. */
export type DeliveryMethod = "bnp_dispatch" | "walk_in" | "own_rider" | "gig" | (string & {});

const RESERVED_INFO: Record<string, { label: string; blurb: string }> = {
  bnp_dispatch: { label: "BNP Dispatch", blurb: "Our riders, flat rate by area" },
  walk_in: { label: "Walk-in collection", blurb: "Free, collect from our Abuja hub" },
  own_rider: { label: "Own rider", blurb: "The merchant's own delivery" },
};

/** Set once a method is known to be a reserved (non-carrier) method. */
const RESERVED = new Set(Object.keys(RESERVED_INFO));

/** A short description for known carriers; others fall back to a generic line. */
const CARRIER_BLURB: Record<string, string> = {
  gig: "Nationwide, priced by weight",
  ups: "International and express, priced by weight",
};

/** Titlecase a carrier code for displays that don't have the registry handy. */
function titlecase(code: string): string {
  return code.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

/** Human label for a delivery method. Pass `carriers` to name custom carriers. */
export function methodLabel(method: string | null | undefined, carriers?: Carrier[]): string {
  if (!method) return "Delivery";
  if (RESERVED_INFO[method]) return RESERVED_INFO[method].label;
  const found = carriers?.find((c) => c.code === method);
  if (found) return found.label;
  if (method === "gig") return "GIG Logistics";
  if (method === "ups") return "UPS";
  return titlecase(method);
}

/** Label and blurb for a method tile in the pickers. */
export function methodInfo(options: DeliveryOptions, id: DeliveryMethod): { label: string; blurb: string } {
  if (RESERVED_INFO[id]) return RESERVED_INFO[id];
  const label = methodLabel(id, options.carriers);
  return { label, blurb: CARRIER_BLURB[id] ?? "Priced by weight" };
}

/** The older rider field, kept in step so existing screens keep working. */
export function riderFor(method: DeliveryMethod): OrderRider {
  if (method === "own_rider") return "Own Rider";
  if (method === "walk_in") return "Pickup";
  return "BNP Fleet";
}

export type DispatchZoneOption = { name: string; coverage: string | null; rate: number; note: string | null };
export type RateRow = { carrier: string; zone: string; min: number; max: number; rate: number };
export type OwnZoneOption = { id: string; name: string; fee: number };

/** Everything a picker needs for one warehouse. */
export type DeliveryOptions = {
  hub: WarehouseLocation;
  dispatchZones: DispatchZoneOption[];
  rates: RateRow[];
  /** Carriers that have live rates for this hub (gig, ups, and any custom one). */
  carriers: Carrier[];
  ownZones: OwnZoneOption[];
  walkIn: boolean;
  /** GIG destinations when live GIG prices are connected; the price then comes from the server. */
  gigLive: string[] | null;
};

/** True when `method` is a carrier (external logistics company), not a reserved method. */
export function isCarrierMethod(
  method: string | null | undefined,
  carriers?: Carrier[],
): boolean {
  if (!method || RESERVED.has(method)) return false;
  if (!carriers) return true; // caller already knows it isn't reserved
  return carriers.some((c) => c.code === method);
}

/** True when this method's price has to be fetched from the server (live GIG). */
export function needsLiveQuote(options: DeliveryOptions, method: DeliveryMethod): boolean {
  return method === "gig" && options.gigLive !== null;
}

export function carrierZones(options: DeliveryOptions, code: string): string[] {
  if (code === "gig" && options.gigLive) return options.gigLive;
  return [...new Set(options.rates.filter((r) => r.carrier === code).map((r) => r.zone))].sort();
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
  if (method === "own_rider") return options.ownZones.find((z) => z.id === zone)?.fee ?? null;
  if (needsLiveQuote(options, method)) return null;
  if (isCarrierMethod(method, options.carriers)) {
    const row = options.rates.find(
      (r) => r.carrier === method && r.zone === zone && r.min <= weightKg && r.max > weightKg,
    );
    return row ? row.rate : null;
  }
  return null;
}

export function availableMethods(options: DeliveryOptions, mode: "merchant" | "store"): DeliveryMethod[] {
  const list: DeliveryMethod[] = [];
  if (options.dispatchZones.length > 0) list.push("bnp_dispatch");
  // Each carrier that has live rates (GIG also when its live prices are on).
  for (const carrier of options.carriers) {
    if (carrier.code === "gig" && options.gigLive) list.push("gig");
    else if (options.rates.some((r) => r.carrier === carrier.code)) list.push(carrier.code);
  }
  if (options.walkIn) list.push("walk_in");
  // Merchants can always use their own rider; store customers only when the
  // merchant has set up their own delivery areas.
  if (mode === "merchant" || options.ownZones.length > 0) list.push("own_rider");
  return list;
}
