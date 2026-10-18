"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  AlertTriangle,
  Check,
  ClipboardCheck,
  Clock,
  Package,
  Truck,
  Home,
  Store,
} from "lucide-react";
import { trackOrder, type TrackResult } from "@/app/store/[slug]/track/actions";
import type { TrackedOrder } from "@/lib/order-tracking";
import { naira } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const fieldClass =
  "h-11 w-full rounded-md border border-stone bg-white px-3 text-sm text-navy outline-none transition-colors placeholder:text-mist focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/25";
const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-graphite";

type SavedLookup = { orderRef: string; phone: string };

export function TrackOrderForm({ slug, initialRef }: { slug: string; initialRef: string }) {
  const [state, formAction, pending] = useActionState<TrackResult | null, FormData>(
    trackOrder,
    null,
  );
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  // The order number and phone are kept in this browser (per store), so a
  // refresh or coming back later doesn't make the customer type them again.
  const storageKey = `bnp-track:${slug}`;
  const [orderRef, setOrderRef] = useState(initialRef);
  const [phone, setPhone] = useState("");
  const [loaded, setLoaded] = useState(false);
  const autoLookedUp = useRef(false);

  function lookup(ref: string, tel: string) {
    const formData = new FormData();
    formData.set("slug", slug);
    formData.set("orderRef", ref);
    formData.set("phone", tel);
    startTransition(() => formAction(formData));
  }

  useEffect(() => {
    let saved: SavedLookup | null = null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) saved = JSON.parse(raw) as SavedLookup;
    } catch {
      // Private browsing or storage blocked: just start empty.
    }
    // A link with ?ref= (from the confirmation email) wins over a saved
    // number; the saved phone still fills in, since it's the same customer.
    const ref = initialRef || saved?.orderRef || "";
    const tel = saved?.phone ?? "";
    // Restoring saved input once on mount, after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrderRef(ref);
    setPhone(tel);
    setLoaded(true);

    // Show the order straight away if we already have both details.
    if (ref && tel && !autoLookedUp.current) {
      autoLookedUp.current = true;
      lookup(ref, tel);
    }
    // Runs once per store; lookup only depends on slug and formAction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, initialRef]);

  useEffect(() => {
    if (!loaded) return;
    try {
      if (orderRef || phone) {
        localStorage.setItem(storageKey, JSON.stringify({ orderRef, phone }));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch {
      // Storage unavailable: the form still works, it just won't remember.
    }
  }, [loaded, orderRef, phone, storageKey]);

  function clearSaved() {
    setOrderRef("");
    setPhone("");
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    lookup(orderRef, phone);
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="mt-6 grid gap-4 rounded-xl border border-stone bg-white p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <input type="hidden" name="slug" value={slug} />
        <div>
          <label className={labelClass} htmlFor="orderRef">
            Order number
          </label>
          <input
            id="orderRef"
            name="orderRef"
            required
            value={orderRef}
            onChange={(e) => setOrderRef(e.target.value)}
            placeholder="ORD-7K3M9P"
            autoCapitalize="characters"
            className={fieldClass}
          />
          {errors?.orderRef ? (
            <p className="mt-1 text-xs text-destructive">{errors.orderRef[0]}</p>
          ) : null}
        </div>
        <div>
          <label className={labelClass} htmlFor="phone">
            Phone number
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0801 234 5678"
            className={fieldClass}
          />
          {errors?.phone ? (
            <p className="mt-1 text-xs text-destructive">{errors.phone[0]}</p>
          ) : null}
        </div>
        <Button type="submit" size="xl" disabled={pending}>
          {pending ? "Checking" : "Track"}
        </Button>
      </form>

      {orderRef || phone ? (
        <p className="mt-2 text-xs text-mist">
          Saved on this device so you don&apos;t have to type them again.{" "}
          <button
            type="button"
            onClick={clearSaved}
            className="font-semibold text-teal-700 hover:underline"
          >
            Clear
          </button>
        </p>
      ) : null}

      {state && !state.ok && !state.fieldErrors ? (
        <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      {state?.ok ? <OrderStatusCard order={state.order} /> : null}
    </>
  );
}

function OrderStatusCard({ order }: { order: TrackedOrder }) {
  const isPickup = order.rider === "Pickup";
  const placed = new Date(order.placedAt).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="mt-6 rounded-xl border border-stone bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-lg font-semibold text-navy">{order.orderRef}</p>
        <p className="text-xs text-mist">Placed {placed}</p>
      </div>

      {order.paymentStatus !== "paid" ? (
        <Notice tone={order.paymentStatus === "failed" ? "bad" : "wait"}>
          {order.paymentStatus === "failed"
            ? "Payment for this order didn't go through, so it hasn't been sent for fulfillment."
            : "We're still waiting for payment confirmation for this order."}
        </Notice>
      ) : order.stage === "Cancelled" ? (
        <Notice tone="bad">This order was cancelled. The seller will contact you about a refund.</Notice>
      ) : order.stage === "Returned" || order.stage === "Damaged" ? (
        <Notice tone="bad">
          {order.stage === "Returned"
            ? "This order has been returned. The seller will be in touch about next steps."
            : "There was a problem with this order. The seller will contact you to sort it out."}
        </Notice>
      ) : (
        <Timeline stage={order.stage} isPickup={isPickup} />
      )}

      <div className="mt-6 border-t border-stone pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-graphite">
          {isPickup ? "Pickup" : "Delivering to"}
        </p>
        <p className="mt-1 text-sm text-navy">
          {isPickup
            ? `From the ${order.location ?? "BNP"} warehouse`
            : (order.deliveryAddress ?? "Address on file")}
        </p>
      </div>

      <ul className="mt-4 divide-y divide-stone border-t border-stone">
        {order.items.map((item, i) => (
          <li key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <span className="text-graphite">
              {item.name} × {item.quantity}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-right text-sm font-semibold text-navy">
        Total {naira(order.total)}
      </p>
    </div>
  );
}

function Timeline({ stage, isPickup }: { stage: TrackedOrder["stage"]; isPickup: boolean }) {
  // Customers see four steps; the warehouse's Reserved and Picking both
  // read as "Confirmed" to them.
  const steps = [
    { label: "Confirmed", icon: ClipboardCheck },
    { label: "Packed", icon: Package },
    isPickup
      ? { label: "Ready for pickup", icon: Store }
      : { label: "Dispatched", icon: Truck },
    isPickup ? { label: "Collected", icon: Check } : { label: "Delivered", icon: Home },
  ];
  const current =
    stage === "Delivered" ? 3 : stage === "Dispatched" ? 2 : stage === "Packed" ? 1 : 0;

  return (
    <ol className="mt-5 grid grid-cols-4 gap-1">
      {steps.map((step, i) => {
        const done = i <= current;
        const Icon = step.icon;
        return (
          <li key={step.label} className="flex flex-col items-center text-center">
            <div className="flex w-full items-center">
              <span
                className={cn(
                  "h-0.5 flex-1",
                  i === 0 ? "bg-transparent" : done ? "bg-teal" : "bg-stone",
                )}
              />
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-full",
                  done ? "bg-teal text-white" : "bg-stone text-mist",
                  i === current && "ring-4 ring-teal/20",
                )}
              >
                <Icon className="size-5" />
              </span>
              <span
                className={cn(
                  "h-0.5 flex-1",
                  i === steps.length - 1 ? "bg-transparent" : i < current ? "bg-teal" : "bg-stone",
                )}
              />
            </div>
            <span
              className={cn(
                "mt-2 text-xs",
                done ? "font-semibold text-navy" : "text-mist",
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Notice({ tone, children }: { tone: "bad" | "wait"; children: React.ReactNode }) {
  const Icon = tone === "bad" ? AlertTriangle : Clock;
  return (
    <div
      className={cn(
        "mt-5 flex items-start gap-3 rounded-lg p-4 text-sm",
        tone === "bad"
          ? "border border-destructive/30 bg-destructive/5 text-destructive"
          : "border border-gold/40 bg-gold/10 text-navy",
      )}
    >
      <Icon className="mt-0.5 size-5 shrink-0" />
      <p>{children}</p>
    </div>
  );
}
