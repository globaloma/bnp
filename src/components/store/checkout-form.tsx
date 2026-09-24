"use client";

import { useActionState } from "react";
import { naira } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { startCheckout } from "@/app/store/[slug]/actions";
import type { ActionResult } from "@/lib/schemas/checkout";
import { useCart } from "./cart-context";

const fieldClass =
  "h-11 w-full rounded-md border border-stone bg-white px-3 text-sm text-navy outline-none transition-colors placeholder:text-mist focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/25";
const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-graphite";

export function CheckoutForm({ slug }: { slug: string }) {
  const { items, subtotal, vatTotal } = useCart();
  const boundAction = startCheckout.bind(null, slug);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    boundAction,
    null,
  );

  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const shippingFee = items.length ? Math.max(0, ...items.map((i) => i.shippingFee)) : 0;

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
          <span>Delivery</span>
          <span>{naira(shippingFee)}</span>
        </div>
        <div className="mt-1.5 flex justify-between border-t border-stone pt-1.5 font-semibold text-navy">
          <span>Total</span>
          <span>{naira(subtotal + vatTotal + shippingFee)}</span>
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
