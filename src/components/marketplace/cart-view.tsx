"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { Boxes, Minus, PackageCheck, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { naira } from "@/lib/format";
import { useCart, type CartItem } from "@/components/store/cart-context";
import { cartSnapshot } from "@/app/marketplace/actions";
import { useShopHref } from "./shop-base";

/** Cart items grouped by seller, in the order they were added. */
export function bySeller(items: CartItem[]) {
  const groups = new Map<string, { name: string; items: CartItem[] }>();
  for (const item of items) {
    const key = item.partnerId ?? "unknown";
    const group = groups.get(key) ?? { name: item.merchantName ?? "Seller", items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.entries()];
}

/** Keeps a saved cart honest: today's prices, stock limits, and nothing that's left the shop. */
export function useFreshCart() {
  const { items, hydrated, refreshPrices, syncStock } = useCart();
  const key = items.map((i) => i.productId).sort().join(",");
  useEffect(() => {
    if (!hydrated || !key) return;
    let cancelled = false;
    cartSnapshot(key.split(",")).then((snap) => {
      if (cancelled) return;
      refreshPrices(Object.fromEntries(Object.entries(snap).map(([id, v]) => [id, v.price])));
      syncStock(Object.fromEntries(key.split(",").map((id) => [id, snap[id]?.stock ?? 0])));
    });
    return () => {
      cancelled = true;
    };
    // Only when the set of products changes, not on every quantity tweak.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, key]);
}

export function CartView() {
  const href = useShopHref();
  const { items, hydrated, setQuantity, removeItem, subtotal, vatTotal, count } = useCart();
  useFreshCart();
  const groups = useMemo(() => bySeller(items), [items]);

  if (!hydrated) return <div className="h-64 animate-pulse rounded-lg bg-white" />;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-lg bg-white px-6 py-16 text-center">
        <ShoppingCart className="size-12 text-mist" />
        <h1 className="mt-3 text-lg font-semibold text-navy">Your cart is empty</h1>
        <p className="mt-1 text-sm text-graphite">Browse our categories and discover our best deals.</p>
        <Link href={href("/")} className="mt-5 rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-navy hover:bg-gold-300">
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-3">
        <h1 className="rounded-lg bg-white px-4 py-3 text-lg font-semibold text-navy">
          Cart ({count} item{count === 1 ? "" : "s"})
        </h1>
        {groups.map(([sellerId, group]) => (
          <section key={sellerId} className="rounded-lg bg-white">
            <p className="flex items-center gap-2 border-b border-stone px-4 py-2.5 text-xs text-graphite">
              <span className="font-semibold text-navy">Sold by {group.name}</span>
              <span className="flex items-center gap-1 text-teal-700">
                <PackageCheck className="size-3.5" /> Fulfilled by BNP
              </span>
            </p>
            <ul className="divide-y divide-stone">
              {group.items.map((item) => (
                <li key={item.productId} className="flex gap-3 p-4">
                  <Link href={href(`/p/${item.productId}`)} className="size-20 shrink-0 overflow-hidden rounded-md bg-stone/60">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <span className="flex size-full items-center justify-center">
                        <Boxes className="size-6 text-mist" />
                      </span>
                    )}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link href={href(`/p/${item.productId}`)} className="line-clamp-2 text-sm text-navy hover:text-teal-700">
                      {item.name}
                    </Link>
                    <span className="mt-0.5 text-[11px] text-mist">
                      {item.stock <= 5 ? `Only ${item.stock} left` : "In stock"} · ships from {item.location}
                    </span>
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => removeItem(item.productId)}
                        className="flex items-center gap-1 text-xs font-semibold text-destructive hover:underline"
                      >
                        <Trash2 className="size-3.5" /> Remove
                      </button>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 items-center rounded-md border border-stone">
                          <button
                            type="button"
                            onClick={() => setQuantity(item.productId, item.quantity - 1)}
                            className="flex size-8 items-center justify-center text-graphite hover:bg-stone/60"
                            aria-label={`Fewer ${item.name}`}
                          >
                            <Minus className="size-3.5" />
                          </button>
                          <span className="w-8 text-center text-sm font-semibold text-navy">{item.quantity}</span>
                          <button
                            type="button"
                            disabled={item.quantity >= item.stock}
                            onClick={() => setQuantity(item.productId, item.quantity + 1)}
                            className="flex size-8 items-center justify-center text-graphite hover:bg-stone/60 disabled:opacity-30"
                            aria-label={`More ${item.name}`}
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                        <span className="w-24 text-right text-sm font-semibold text-navy">{naira(item.price * item.quantity)}</span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <aside className="h-fit rounded-lg bg-white p-4 lg:sticky lg:top-32">
        <h2 className="text-[11px] font-semibold tracking-[0.08em] text-mist uppercase">Cart summary</h2>
        <div className="mt-3 flex justify-between text-sm text-graphite">
          <span>Subtotal</span>
          <span className="font-semibold text-navy">{naira(subtotal)}</span>
        </div>
        {vatTotal > 0 ? (
          <div className="mt-1 flex justify-between text-sm text-graphite">
            <span>VAT</span>
            <span>{naira(vatTotal)}</span>
          </div>
        ) : null}
        <p className="mt-2 text-xs text-mist">Delivery is added at checkout, based on your area.</p>
        <Link
          href={href("/checkout")}
          className="mt-4 flex h-11 items-center justify-center rounded-md bg-gold text-sm font-bold text-navy hover:bg-gold-300"
        >
          Checkout ({naira(subtotal + vatTotal)})
        </Link>
        {groups.length > 1 ? (
          <p className="mt-3 text-xs text-graphite">
            Your cart has items from {groups.length} sellers. You pay once; each seller&apos;s items are packed as a separate
            parcel.
          </p>
        ) : null}
      </aside>
    </div>
  );
}
