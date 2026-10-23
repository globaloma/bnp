import type { Order } from "@/types/db";

// Delivery progress on a dispatched order (migration 0031). The order status
// stays Dispatched; this records where the parcel is on the road.

export type DeliveryProgress = NonNullable<Order["delivery_progress"]>;

export const FAILURE_REASONS = [
  "Customer not reachable",
  "Customer not available",
  "Wrong or incomplete address",
  "Customer refused the order",
] as const;

type ProgressFields = Pick<Order, "status" | "delivery_progress" | "delivery_failed_attempts">;

/** "In transit", "Delivery failed (2)", or null when there's nothing to add. */
export function progressLabel(o: ProgressFields): string | null {
  if (o.status !== "Dispatched" || !o.delivery_progress) return null;
  if (o.delivery_progress === "in_transit") {
    return o.delivery_failed_attempts > 0 ? `In transit, attempt ${o.delivery_failed_attempts + 1}` : "In transit";
  }
  return o.delivery_failed_attempts > 1 ? `Delivery failed (${o.delivery_failed_attempts})` : "Delivery failed";
}
