"use client";

import { useActionState, useState } from "react";
import { Store, Truck } from "lucide-react";
import { naira } from "@/lib/format";
import { cn } from "@/lib/utils";
import { flatShippingFee, pickupAvailable, pickupLocations } from "@/lib/delivery";
import type { WarehouseLocation } from "@/types/db";
import {
  DELIVERY_METHODS,
  availableMethods,
  carrierZones,
  previewFee,
  type DeliveryMethod,
  type DeliveryOptions,
} from "@/lib/delivery-methods";
import { Button } from "@/components/ui/button";
import { startCheckout } from "@/app/store/[slug]/actions";
import type { ActionResult } from "@/lib/schemas/checkout";
import { useCart } from "./cart-context";

const fieldClass =
  "h-11 w-full rounded-md border border-stone bg-white px-3 text-sm text-navy outline-none transition-colors placeholder:text-mist focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/25";
const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-graphite";

type StoreMethod = Exclude<DeliveryMethod, "walk_in">;

export function CheckoutForm({
  slug,
  options: optionsByHub,
  weights,
}: {
  slug: string;
  options: Partial<Record<WarehouseLocation, DeliveryOptions>>;
  weights: Record<string, number>;
}) {
  const { items, subtotal, vatTotal } = useCart();
  const boundAction = startCheckout.bind(null, slug);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    boundAction,
    null,
  );

  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">("delivery");
  const [picked, setPicked] = useState<StoreMethod | null>(null);
  const [zone, setZone] = useState("");

  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const canPickup = pickupAvailable(items);
  const isPickup = canPickup && fulfillment === "pickup";

  // Delivery comes from the warehouse of the first item, as on the server.
  const hub = (items[0]?.location ?? "Abuja") as WarehouseLocation;
  const options = optionsByHub[hub];
  const methods = options
    ? (availableMethods(options, "store").filter((m) => m !== "walk_in") as StoreMethod[])
    : [];
  const method: StoreMethod | null = picked && methods.includes(picked) ? picked : (methods[0] ?? null);
  const weightKg = items.reduce((sum, i) => sum + (weights[i.productId] ?? 0) * i.quantity, 0);
  // null = an area still needs choosing, so there's no fee to show yet.
  const shippingFee: number | null = isPickup
    ? 0
    : method && options
      ? previewFee(options, method, zone, Math.round(weightKg * 100) / 100)
      : flatShippingFee(items);
  const zoneChoices: { value: string; label: string }[] =
    !options || !method
      ? []
      : method === "bnp_dispatch"
        ? options.dispatchZones.map((z) => ({ value: z.name, label: `${z.name}: ${z.coverage ?? ""}`.trim() }))
        : method === "own_rider"
          ? options.ownZones.map((z) => ({ value: z.id, label: `${z.name}, ${z.fee > 0 ? naira(z.fee) : "Free"}` }))
          : carrierZones(options, method === "gig" ? "GIG" : "UPS").map((z) => ({ value: z, label: z }));

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
          <label className={labelClass}>Email (for your order confirmation)</label>
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

      {!isPickup && method ? (
        <div>
          <input type="hidden" name="deliveryMethod" value={method} />
          {methods.length > 1 ? (
            <>
              <label className={labelClass}>Delivery *</label>
              <div className="mb-3 grid grid-cols-2 gap-2">
                {methods.map((id) => {
                  const m = DELIVERY_METHODS.find((x) => x.id === id)!;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={method === id}
                      onClick={() => {
                        setPicked(id);
                        setZone("");
                      }}
                      className={cn(
                        "rounded-md border bg-white p-2.5 text-left transition-colors",
                        method === id ? "border-teal ring-2 ring-teal/25" : "border-stone hover:border-teal/40",
                      )}
                    >
                      <span className="block text-sm font-semibold text-navy">
                        {id === "own_rider" ? "Store delivery" : m.label}
                      </span>
                      <span className="block text-xs text-mist">
                        {id === "own_rider" ? "Delivered by the store" : m.blurb}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
          <label className={labelClass}>{method === "gig" || method === "ups" ? "Destination *" : "Delivery area *"}</label>
          <select
            name="deliveryZone"
            required
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            className={fieldClass}
          >
            <option value="" disabled>
              Choose your area
            </option>
            {zoneChoices.map((z) => (
              <option key={z.value} value={z.value}>
                {z.label}
              </option>
            ))}
          </select>
          {zone && shippingFee === null ? (
            <p className="mt-1 text-xs text-destructive">No price for this order here. Choose another option.</p>
          ) : null}
          {errors?.deliveryZone ? (
            <p className="mt-1 text-xs text-destructive">{errors.deliveryZone[0]}</p>
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

      {state && !state.ok && (!state.fieldErrors || state.fieldErrors.deliveryZone) ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Redirecting to payment" : "Pay now"}
      </Button>
      <p className="text-center text-xs text-mist">
        By paying you agree to the{" "}
        <a href="/terms" target="_blank" className="text-teal-700 hover:underline">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="/privacy" target="_blank" className="text-teal-700 hover:underline">
          Privacy Policy
        </a>
        .
      </p>
    </form>
  );
}
