"use client";

import { useActionState, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Lock, MapPin, PackageCheck, Store, Truck } from "lucide-react";
import { naira } from "@/lib/format";
import { cn } from "@/lib/utils";
import { carrierZones, DELIVERY_METHODS, previewFee, type DeliveryMethod, type DeliveryOptions } from "@/lib/delivery-methods";
import { useGigQuote } from "@/lib/use-gig-quote";
import { useCart, type CartItem } from "@/components/store/cart-context";
import { startMarketplaceCheckout, type CheckoutResult } from "@/app/marketplace/checkout/actions";
import { useFreshCart } from "./cart-view";
import { useShopHref } from "./shop-base";

type Hub = "Abuja" | "Lagos";
type Method = Exclude<DeliveryMethod, "own_rider">;
type Choice = { method: Method; zone: string };

export type SavedAddress = { id: string; label: string; full_name: string; phone: string; address: string; is_default: boolean };

const field =
  "h-11 w-full rounded-md border border-stone bg-white px-3 text-sm text-navy outline-none placeholder:text-mist focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/25";
const label = "mb-1.5 block text-[11px] font-semibold tracking-[0.08em] text-graphite uppercase";

function methodsFor(options: DeliveryOptions): Method[] {
  const list: Method[] = [];
  if (options.dispatchZones.length > 0) list.push("bnp_dispatch");
  if (options.gigLive || options.rates.some((r) => r.carrier === "GIG")) list.push("gig");
  if (options.rates.some((r) => r.carrier === "UPS")) list.push("ups");
  if (options.walkIn) list.push("walk_in");
  return list;
}

function zonesFor(options: DeliveryOptions, method: Method) {
  if (method === "bnp_dispatch") {
    return options.dispatchZones.map((z) => ({ value: z.name, label: z.coverage ? `${z.name}: ${z.coverage}` : z.name }));
  }
  if (method === "gig" || method === "ups") {
    return carrierZones(options, method === "gig" ? "GIG" : "UPS").map((z) => ({ value: z, label: z }));
  }
  return [];
}

/** One parcel: a seller's items from one warehouse. Prices itself and reports up. */
function Parcel({
  id,
  seller,
  items,
  options,
  choice,
  onFee,
}: {
  id: string;
  seller: string;
  items: CartItem[];
  options: DeliveryOptions;
  choice: Choice;
  onFee: (id: string, fee: number | null) => void;
}) {
  const weight = Math.round(items.reduce((s, i) => s + (i.weightKg ?? 0) * i.quantity, 0) * 100) / 100;
  const gig = useGigQuote(options, choice.method, choice.zone, weight);
  const fee: number | null =
    choice.method === "walk_in"
      ? 0
      : !choice.zone
        ? null
        : gig.live
          ? gig.fee
          : previewFee(options, choice.method, choice.zone, weight);
  useEffect(() => onFee(id, fee), [id, fee, onFee]);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <li className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="min-w-0">
        <span className="block truncate font-medium text-navy">{seller}</span>
        <span className="text-xs text-mist">
          {count} item{count === 1 ? "" : "s"}
          {weight > 0 ? `, ${weight} kg` : ""}
        </span>
      </span>
      <span className="shrink-0 font-semibold text-navy">
        {choice.method === "walk_in"
          ? "Free"
          : !choice.zone
            ? <span className="text-xs font-normal text-mist">Choose your area</span>
            : gig.loading
              ? <span className="text-xs font-normal text-mist">Pricing...</span>
              : fee === null
                ? <span className="text-xs font-normal text-destructive">Not available</span>
                : naira(fee)}
      </span>
    </li>
  );
}

export function MarketCheckoutForm({
  options,
  customer,
  addresses,
}: {
  options: Record<Hub, DeliveryOptions>;
  customer: { name: string; phone: string | null; email: string | null } | null;
  addresses: SavedAddress[];
}) {
  const href = useShopHref();
  const { items, hydrated, subtotal, vatTotal } = useCart();
  useFreshCart();
  const [state, formAction, pending] = useActionState<CheckoutResult | null, FormData>(startMarketplaceCheckout, null);
  const errors = state?.fieldErrors;

  const firstAddress = addresses.find((a) => a.is_default) ?? addresses[0];
  const [addressId, setAddressId] = useState<string>(firstAddress?.id ?? "new");
  const picked = addresses.find((a) => a.id === addressId);
  const [name, setName] = useState(picked?.full_name ?? customer?.name ?? "");
  const [phone, setPhone] = useState(picked?.phone ?? customer?.phone ?? "");
  const [address, setAddress] = useState(picked?.address ?? "");

  function chooseAddress(id: string) {
    setAddressId(id);
    const a = addresses.find((x) => x.id === id);
    if (a) {
      setName(a.full_name);
      setPhone(a.phone);
      setAddress(a.address);
    } else {
      setAddress("");
    }
  }

  const hubs = useMemo(
    () => [...new Set(items.map((i) => (i.location === "Lagos" ? "Lagos" : "Abuja") as Hub))],
    [items],
  );
  const [choices, setChoices] = useState<Partial<Record<Hub, Choice>>>({});
  const choiceFor = (hub: Hub): Choice => {
    const methods = methodsFor(options[hub]);
    const c = choices[hub];
    return c && methods.includes(c.method) ? c : { method: methods[0] ?? "bnp_dispatch", zone: "" };
  };

  const parcels = useMemo(() => {
    const map = new Map<string, { seller: string; hub: Hub; items: CartItem[] }>();
    for (const i of items) {
      const hub: Hub = i.location === "Lagos" ? "Lagos" : "Abuja";
      const key = `${i.partnerId ?? "x"}|${hub}`;
      const p = map.get(key) ?? { seller: i.merchantName ?? "Seller", hub, items: [] };
      p.items.push(i);
      map.set(key, p);
    }
    return [...map.entries()];
  }, [items]);

  const [fees, setFees] = useState<Record<string, number | null>>({});
  const onFee = useCallback((id: string, fee: number | null) => {
    setFees((prev) => (prev[id] === fee ? prev : { ...prev, [id]: fee }));
  }, []);
  const parcelFees = parcels.map(([id]) => fees[id]);
  const deliveryKnown = parcelFees.every((f) => f !== null && f !== undefined);
  const delivery = parcelFees.reduce<number>((s, f) => s + (f ?? 0), 0);
  const allPickup = hubs.length > 0 && hubs.every((h) => choiceFor(h).method === "walk_in");

  if (!hydrated) return <div className="h-96 animate-pulse rounded-lg bg-white" />;
  if (items.length === 0) {
    return (
      <div className="rounded-lg bg-white px-6 py-12 text-center">
        <p className="text-base font-semibold text-navy">Your cart is empty</p>
        <Link href={href("/")} className="mt-3 inline-block text-sm font-semibold text-teal-700 hover:underline">
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-4 lg:grid-cols-[1fr_21rem]">
      <input type="hidden" name="items" value={JSON.stringify(items.map((i) => ({ productId: i.productId, quantity: i.quantity })))} />
      <input type="hidden" name="delivery" value={JSON.stringify(Object.fromEntries(hubs.map((h) => [h, choiceFor(h)])))} />

      <div className="flex flex-col gap-4">
        <section className="rounded-lg bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-navy">1. Your details</h2>
            {!customer ? (
              <Link href={href("/account/login?next=/checkout")} className="text-xs font-semibold text-teal-700 hover:underline">
                Have an account? Sign in
              </Link>
            ) : null}
          </div>

          {addresses.length > 0 ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {addresses.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => chooseAddress(a.id)}
                  aria-pressed={addressId === a.id}
                  className={cn(
                    "rounded-md border p-3 text-left text-xs transition-colors",
                    addressId === a.id ? "border-teal ring-2 ring-teal/25" : "border-stone hover:border-teal/40",
                  )}
                >
                  <span className="block text-sm font-semibold text-navy">{a.label}</span>
                  <span className="block text-graphite">
                    {a.full_name}, {a.phone}
                  </span>
                  <span className="line-clamp-2 block text-mist">{a.address}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => chooseAddress("new")}
                aria-pressed={addressId === "new"}
                className={cn(
                  "rounded-md border border-dashed p-3 text-left text-sm font-semibold text-teal-700",
                  addressId === "new" ? "border-teal ring-2 ring-teal/25" : "border-stone",
                )}
              >
                + New address
              </button>
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="co-name">
                Full name *
              </label>
              <input id="co-name" name="customerName" required value={name} onChange={(e) => setName(e.target.value)} className={field} />
              {errors?.customerName ? <p className="mt-1 text-xs text-destructive">{errors.customerName[0]}</p> : null}
            </div>
            <div>
              <label className={label} htmlFor="co-phone">
                Phone *
              </label>
              <input
                id="co-phone"
                name="customerPhone"
                required
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0801 234 5678"
                className={field}
              />
              {errors?.customerPhone ? <p className="mt-1 text-xs text-destructive">{errors.customerPhone[0]}</p> : null}
            </div>
            <div className="sm:col-span-2">
              <label className={label} htmlFor="co-email">
                Email {customer?.email ? "" : "(for your receipt and updates)"}
              </label>
              <input
                id="co-email"
                name="customerEmail"
                type="email"
                defaultValue={customer?.email ?? ""}
                placeholder="you@example.com"
                className={field}
              />
              {errors?.customerEmail ? <p className="mt-1 text-xs text-destructive">{errors.customerEmail[0]}</p> : null}
            </div>
            {!allPickup ? (
              <div className="sm:col-span-2">
                <label className={label} htmlFor="co-address">
                  Delivery address *
                </label>
                <textarea
                  id="co-address"
                  name="deliveryAddress"
                  rows={3}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="House number, street, area, city, state, and a landmark"
                  className={cn(field, "h-auto py-2")}
                />
                {errors?.deliveryAddress ? <p className="mt-1 text-xs text-destructive">{errors.deliveryAddress[0]}</p> : null}
                {customer && addressId === "new" ? (
                  <label className="mt-2 flex items-center gap-2 text-xs text-graphite">
                    <input type="checkbox" name="saveAddress" value="1" defaultChecked className="accent-teal" />
                    Save this address for next time
                  </label>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-lg bg-white p-4 sm:p-5">
          <h2 className="text-base font-semibold text-navy">2. Delivery</h2>
          {hubs.map((hub) => {
            const opts = options[hub];
            const methods = methodsFor(opts);
            const choice = choiceFor(hub);
            const zones = zonesFor(opts, choice.method);
            return (
              <div key={hub} className="mt-4">
                {hubs.length > 1 ? (
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-graphite">
                    <MapPin className="size-3.5 text-teal" /> Items from our {hub} warehouse
                  </p>
                ) : null}
                {methods.length === 0 ? (
                  <p className="text-sm text-destructive">Delivery from {hub} isn&apos;t available right now.</p>
                ) : (
                  <>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {methods.map((m) => {
                        const info = DELIVERY_METHODS.find((x) => x.id === m)!;
                        const Icon = m === "walk_in" ? Store : Truck;
                        return (
                          <button
                            key={m}
                            type="button"
                            aria-pressed={choice.method === m}
                            onClick={() => setChoices((c) => ({ ...c, [hub]: { method: m, zone: "" } }))}
                            className={cn(
                              "flex items-start gap-2.5 rounded-md border p-3 text-left transition-colors",
                              choice.method === m ? "border-teal ring-2 ring-teal/25" : "border-stone hover:border-teal/40",
                            )}
                          >
                            <Icon className="mt-0.5 size-4 shrink-0 text-teal-700" />
                            <span>
                              <span className="block text-sm font-semibold text-navy">
                                {m === "walk_in" ? "Pick up at our hub" : m === "bnp_dispatch" ? "Door delivery by BNP" : info.label}
                              </span>
                              <span className="block text-xs text-mist">
                                {m === "walk_in" ? "Free, Suite 207, Alba Plaza, Jabi, Abuja" : info.blurb}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {choice.method !== "walk_in" ? (
                      <div className="mt-3">
                        <label className={label} htmlFor={`zone-${hub}`}>
                          {choice.method === "bnp_dispatch" ? "Your area *" : "Destination *"}
                        </label>
                        <select
                          id={`zone-${hub}`}
                          value={choice.zone}
                          onChange={(e) => setChoices((c) => ({ ...c, [hub]: { method: choice.method, zone: e.target.value } }))}
                          className={field}
                        >
                          <option value="" disabled>
                            Choose your area
                          </option>
                          {zones.map((z) => (
                            <option key={z.value} value={z.value}>
                              {z.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            );
          })}

          <div className="mt-5 border-t border-stone pt-3">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-mist uppercase">
              {parcels.length} parcel{parcels.length === 1 ? "" : "s"}, packed by BNP
            </p>
            <ul className="divide-y divide-stone">
              {parcels.map(([id, p]) => (
                <Parcel key={id} id={id} seller={p.seller} items={p.items} options={options[p.hub]} choice={choiceFor(p.hub)} onFee={onFee} />
              ))}
            </ul>
          </div>
          {errors?.delivery ? <p className="mt-2 text-xs text-destructive">{state?.error}</p> : null}
        </section>
      </div>

      <aside className="h-fit rounded-lg bg-white p-4 lg:sticky lg:top-32">
        <h2 className="text-[11px] font-semibold tracking-[0.08em] text-mist uppercase">Order summary</h2>
        <ul className="mt-3 flex max-h-56 flex-col gap-2 overflow-y-auto">
          {items.map((i) => (
            <li key={i.productId} className="flex justify-between gap-3 text-xs">
              <span className="line-clamp-2 text-graphite">
                {i.name} <span className="text-mist">x {i.quantity}</span>
              </span>
              <span className="shrink-0 font-semibold text-navy">{naira(i.price * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-col gap-1 border-t border-stone pt-3 text-sm text-graphite">
          <div className="flex justify-between">
            <span>Items</span>
            <span>{naira(subtotal)}</span>
          </div>
          {vatTotal > 0 ? (
            <div className="flex justify-between">
              <span>VAT</span>
              <span>{naira(vatTotal)}</span>
            </div>
          ) : null}
          <div className="flex justify-between">
            <span>Delivery</span>
            <span>{deliveryKnown ? (delivery === 0 ? "Free" : naira(delivery)) : "Choose your area"}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-stone pt-2 text-base font-bold text-navy">
            <span>Total</span>
            <span>{naira(subtotal + vatTotal + delivery)}</span>
          </div>
        </div>
        {state && !state.ok && !errors?.delivery ? <p className="mt-3 text-xs text-destructive">{state.error}</p> : null}
        <button
          type="submit"
          disabled={pending || !deliveryKnown}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-gold text-sm font-bold text-navy hover:bg-gold-300 disabled:opacity-50"
        >
          <Lock className="size-4" />
          {pending ? "Taking you to payment" : `Pay ${naira(subtotal + vatTotal + delivery)}`}
        </button>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-mist">
          <PackageCheck className="size-3.5" /> Secure payment by Paystack
        </p>
        <p className="mt-2 text-center text-[11px] text-mist">
          By paying you agree to the{" "}
          <a href="https://bnpfulfillment.com/terms" target="_blank" rel="noreferrer" className="text-teal-700 hover:underline">
            Terms
          </a>{" "}
          and{" "}
          <a href="https://bnpfulfillment.com/privacy" target="_blank" rel="noreferrer" className="text-teal-700 hover:underline">
            Privacy Policy
          </a>
          .
        </p>
      </aside>
    </form>
  );
}
