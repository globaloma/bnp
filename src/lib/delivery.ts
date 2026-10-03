// Storefront delivery rules, shared by the checkout form (to show the right
// options and total) and startCheckout (which re-applies them server-side
// against fresh product data and never trusts the client's numbers).

type PickupItem = { pickupEnabled?: boolean; location?: string };

/**
 * Pickup is a whole-order choice, so it's only offered when every item in
 * the cart allows it. One item that has to be delivered means the order is
 * delivered.
 */
export function pickupAvailable(items: PickupItem[]): boolean {
  return items.length > 0 && items.every((i) => i.pickupEnabled === true);
}

/** Warehouses the customer would collect from, e.g. ["Abuja", "Lagos"]. */
export function pickupLocations(items: PickupItem[]): string[] {
  return [...new Set(items.flatMap((i) => (i.location ? [i.location] : [])))];
}

/**
 * Fallback for merchants with no delivery zones: one combined delivery for
 * the whole cart at the highest per-product shipping fee.
 */
export function flatShippingFee(items: { shippingFee: number }[]): number {
  return Math.max(0, ...items.map((i) => i.shippingFee));
}
