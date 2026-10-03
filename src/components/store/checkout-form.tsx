"use client";

import { useActionState, useState } from "react";
import { Store, Truck } from "lucide-react";
import { naira } from "@/lib/format";
import { cn } from "@/lib/utils";
import { flatShippingFee, pickupAvailable, pickupLocations } from "@/lib/delivery";
import type { DeliveryZone } from "@/types/db";
import { Button } from "@/components/ui/button";
import { startCheckout } from "@/app/store/[slug]/actions";
import type { ActionResult } from "@/lib/schemas/checkout";
import { useCart } from "./cart-context";

const fieldClass =
  "h-11 w-full rounded-md border border-stone bg-white px-3 text-sm text-navy outline-none transition-colors placeholder:text-mist focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/25";
const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-graphite";

export function CheckoutForm({ slug, zones }: { slug: string; zones: DeliveryZone[] }) {
  const { items, subtotal, vatTotal } = useCart();
  const boundAction = startCheckout.bind(null, slug);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    boundAction,
    null,
  );

  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">("delivery");
  const [zoneId, setZoneId] = useState("");

  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const canPickup = pickupAvailable(items);
  const isPickup = canPickup && fulfillment === "pickup";
  const usesZones = zones.length > 0;
  const zone = zones.find((z) => z.id === zoneId);
  // null = a zone still needs choosing, so there's no fee to show yet.
  const shippingFee: number | null = isPickup
    ? 0
    : usesZones
      ? (zone?.fee ?? null)
      : flatShippingFee(items);

  if (items.length === 0) {
    return <p className="text-sm text-mist">Your cart is empty.</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(
          items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        )}
      />

      <div>
        <label className={labelClass}>Your name *</label>
        <input name="customerName" required className={fieldClass} placeholder="Full name" />
        {errors?.customerName ? (
          <p className="mt-1 text-xs text-destructive">{errors.customerName[0]}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Phone *</label>
          <input
            name="customerPhone"
            required
            className={fieldClass}
            placeholder="0801 234 5678"
          />
          {errors?.customerPhone ? (
            <p className="mt-1 text-xs text-destructive">{errors.customerPhone[0]}</p>
          ) : null}
        </div>
        <div>
          <label className={labelClass}>Email (optional)</label>
          <input name="customerEmail" type="email" className={fieldClass} placeholder="you@example.com" />
        </div>
      </div>

      <input type="hidden" name="fulfillment" value={isPickup ? "pickup" : "delivery"} />

      {canPickup ? (
        <div>
          <label className={labelClass}>How do you want it? *</label>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { value: "delivery", label: "Delivery", icon: Truck, hint: "To your address" },
                {
                  value: "pickup",
                  label: "Pick up",
                  icon: Store,
                  hint: `Free, from ${pickupLocations(items).join(" & ")}`,
                },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFulfillment(opt.value)}
                aria-pressed={fulfillment === opt.value}
                className={cn(
                  "flex items-start gap-2.5 rounded-md border bg-white p-3 text-left transition-colors",
                  fulfillment === opt.value
                    ? "border-teal ring-2 ring-teal/25"
                    : "border-stone hover:border-teal/40",
                )}
              >
                <opt.icon className="mt-0.5 size-4 shrink-0 text-teal-700" />
                <span>
                  <span className="block text-sm font-semibold text-navy">{opt.label}</span>
                  <span className="block text-xs text-mist">{opt.hint}</span>
                </span>
              </button>
            ))}
          </div>
          {isPickup ? (
            <p className="mt-2 text-xs text-graphite">
              The store will contact you on your phone number when your order is ready to collect.
            </p>
          ) : null}
        </div>
      ) : null}

      {!isPickup && usesZones ? (
        <div>
          <label className={labelClass}>Delivery area *</label>
          <select
            name="deliveryZoneId"
            required
            value={zoneId}
            onChange={(e) => setZoneId(e.target.value)}
            className={fieldClass}
          >
            <option value="" disabled>
              Choose your area
            </option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}, {z.fee > 0 ? naira(z.fee) : "Free"}
              </option>
            ))}
          </select>
          {errors?.deliveryZoneId ? (
            <p className="mt-1 text-xs text-destructive">{errors.deliveryZoneId[0]}</p>
          ) : null}
        </div>
      ) : null}

      {isPickup ? null : (
        <div>
          <label className={labelClass}>Delivery address *</label>
          <textarea
            name="deliveryAddress"
            required
            rows={3}
            className={fieldClass.replace("h-11", "h-auto py-2")}
            placeholder="Street, city, state"
          />
          {errors?.deliveryAddress ? (
            <p className="mt-1 text-xs text-destructive">{errors.deliveryAddress[0]}</p>
          ) : null}
        </div>
      )}

      <div className="rounded-lg border border-stone bg-white p-3 text-sm">
        <div className="flex justify-between text-graphite">
          <span>Subtotal</span>
          <span>{naira(subtotal)}</span>
        </div>
        {vatTotal > 0 ? (
          <div className="flex justify-between text-graphite">
            <span>VAT</span>
            <span>{naira(vatTotal)}</span>
          </div>
        ) : null}
        <div className="flex justify-between text-graphite">
          <span>{isPickup ? "Pickup" : "Delivery"}</span>
          <span>
            {shippingFee === null
              ? "Choose your area"
              : shippingFee === 0
                ? "Free"
                : naira(shippingFee)}
          </span>
        </div>
        <div className="mt-1.5 flex justify-between border-t border-stone pt-1.5 font-semibold text-navy">
          <span>Total</span>
          <span>{naira(subtotal + vatTotal + (shippingFee ?? 0))}</span>
        </div>
      </div>

      {state && !state.ok && !state.fieldErrors ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Redirecting to payment" : "Pay now"}
      </Button>
    </form>
  );
}
