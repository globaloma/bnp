"use server";

import { z } from "zod";
import { findTrackedOrder, type TrackedOrder } from "@/lib/order-tracking";

const trackSchema = z.object({
  slug: z.string().min(1).max(120),
  orderRef: z.string().trim().min(3, "Enter your order number").max(40),
  phone: z.string().trim().min(7, "Enter the phone number you ordered with").max(20),
});

export type TrackResult =
  | { ok: true; order: TrackedOrder }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function trackOrder(
  _prev: TrackResult | null,
  formData: FormData,
): Promise<TrackResult> {
  const parsed = trackSchema.safeParse({
    slug: formData.get("slug"),
    orderRef: formData.get("orderRef"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { slug, orderRef, phone } = parsed.data;
  const order = await findTrackedOrder(slug, orderRef, phone);

  if (!order) {
    return {
      ok: false,
      error:
        "We couldn't find an order with those details. Check the order number in your confirmation email and use the phone number you gave at checkout.",
    };
  }

  return { ok: true, order };
}
