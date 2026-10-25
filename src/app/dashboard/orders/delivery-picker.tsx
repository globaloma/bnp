"use client";

import { MapPin } from "lucide-react";
import {
  DELIVERY_METHODS,
  availableMethods,
  carrierZones,
  previewFee,
  type DeliveryMethod,
  type DeliveryOptions,
} from "@/lib/delivery-methods";
import { naira } from "@/lib/format";
import { company } from "@/lib/site-content";
import { cn } from "@/lib/utils";

export type DeliveryChoice = {
  method: DeliveryMethod;
  zone: string;
  weightKg: number;
  ownFee: number;
  pickupAt: string;
};

const labelClass = "mb-1 block text-xs font-semibold text-graphite";
const fieldClass =
  "h-10 w-full rounded-md border border-stone bg-white px-3 text-sm text-navy outline-none focus:border-teal focus:ring-2 focus:ring-teal/20";

/** Now in Nigeria time as a datetime-local value, the earliest collection time. */
function nowInLagos() {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16);
}

/** What the merchant pays BNP for this choice, or null if it can't be priced. */
export function choiceFee(options: DeliveryOptions, choice: DeliveryChoice): number | null {
  if (choice.method === "own_rider") return choice.ownFee;
  return previewFee(options, choice.method, choice.zone, choice.weightKg);
}

/**
 * Delivery section of the merchant's New order form. Posts deliveryMethod,
 * deliveryZone, weightKg, deliveryFee (own rider) and pickupAt (walk-in).
 */
export function DeliveryPicker({
  options,
  choice,
  onChange,
  errors,
  fee,
  loading = false,
}: {
  options: DeliveryOptions;
  choice: DeliveryChoice;
  onChange: (next: DeliveryChoice) => void;
  errors?: Record<string, string[]>;
  /** The price, worked out by the form (live GIG prices come from the server). */
  fee: number | null;
  loading?: boolean;
}) {
  const methods = availableMethods(options, "merchant");
  const set = (patch: Partial<DeliveryChoice>) => onChange({ ...choice, ...patch });
  const isCarrier = choice.method === "gig" || choice.method === "ups";

  return (
    <fieldset className="rounded-lg border border-stone bg-white p-3">
      <legend className="px-1 text-xs font-semibold text-graphite">Delivery from {options.hub}</legend>
      <input type="hidden" name="deliveryMethod" value={choice.method} />
      <input type="hidden" name="deliveryZone" value={choice.method === "walk_in" || choice.method === "own_rider" ? "" : choice.zone} />
      <input type="hidden" name="weightKg" value={choice.weightKg} />
      <input type="hidden" name="deliveryFee" value={choice.method === "own_rider" ? choice.ownFee : 0} />
      <input type="hidden" name="pickupAt" value={choice.method === "walk_in" ? choice.pickupAt : ""} />

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {methods.map((id) => {
          const m = DELIVERY_METHODS.find((x) => x.id === id)!;
          const active = choice.method === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => set({ method: id, zone: "" })}
              className={cn(
                "rounded-md border px-2.5 py-2 text-left transition-colors",
                active ? "border-teal bg-teal/10" : "border-stone hover:border-teal/50",
              )}
            >
              <span className="block text-xs font-semibold text-navy">{m.label}</span>
              <span className="block text-[10px] leading-tight text-mist">{m.blurb}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        {choice.method === "bnp_dispatch" ? (
          <div className="col-span-2">
            <label className={labelClass}>Area</label>
            <select
              value={choice.zone}
              onChange={(e) => set({ zone: e.target.value })}
              className={cn(fieldClass, "appearance-none")}
            >
              <option value="">Choose an area</option>
              {options.dispatchZones.map((z) => (
                <option key={z.name} value={z.name}>
                  {z.name}: {z.coverage} ({naira(z.rate)})
                </option>
              ))}
            </select>
            {choice.zone ? (
              <p className="mt-1 text-[11px] text-mist">
                {options.dispatchZones.find((z) => z.name === choice.zone)?.note ?? ""}
              </p>
            ) : null}
          </div>
        ) : null}

        {isCarrier ? (
          <>
            <div>
              <label className={labelClass}>Destination</label>
              <select
                value={choice.zone}
                onChange={(e) => set({ zone: e.target.value })}
                className={cn(fieldClass, "appearance-none")}
              >
                <option value="">Choose</option>
                {carrierZones(options, choice.method === "gig" ? "GIG" : "UPS").map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Parcel weight (kg)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={choice.weightKg}
                onChange={(e) => set({ weightKg: Math.max(0, Number(e.target.value) || 0) })}
                className={fieldClass}
              />
            </div>
          </>
        ) : null}

        {choice.method === "walk_in" ? (
          <>
            <p className="col-span-2 flex items-start gap-1.5 text-xs text-graphite">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-teal" />
              Collect from {company.primaryHub.address}. Our team is notified.
            </p>
            <div className="col-span-2">
              <label className={labelClass}>Collection date and time</label>
              <input
                type="datetime-local"
                min={nowInLagos()}
                value={choice.pickupAt}
                onChange={(e) => set({ pickupAt: e.target.value })}
                className={fieldClass}
              />
              {errors?.pickupAt ? <p className="mt-1 text-xs text-destructive">{errors.pickupAt[0]}</p> : null}
            </div>
          </>
        ) : null}

        {choice.method === "own_rider" ? (
          <div className="col-span-2">
            <label className={labelClass}>Delivery price (₦)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={choice.ownFee}
              onChange={(e) => set({ ownFee: Math.max(0, Number(e.target.value) || 0) })}
              placeholder="What you're charging for the rider"
              className={fieldClass}
            />
          </div>
        ) : null}
      </div>

      {errors?.deliveryZone ? <p className="mt-2 text-xs text-destructive">{errors.deliveryZone[0]}</p> : null}

      {choice.method !== "own_rider" ? (
        <p className="mt-2.5 text-xs text-graphite">
          {loading ? (
            "Getting the GIG price..."
          ) : fee === null ? (
            isCarrier && choice.zone ? (
              <span className="text-destructive">No price for this destination and weight. Choose another option.</span>
            ) : (
              "Choose an area to see the price."
            )
          ) : fee === 0 ? (
            <span className="font-semibold text-success">Free</span>
          ) : (
            <>
              BNP delivery: <span className="font-semibold text-navy">{naira(fee)}</span>, added to the order total
              and billed to you.
            </>
          )}
        </p>
      ) : null}
    </fieldset>
  );
}
