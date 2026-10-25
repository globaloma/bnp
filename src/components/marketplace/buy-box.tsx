"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart, Minus, Plus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { displayName } from "@/lib/variants";
import { useCart } from "@/components/store/cart-context";
import { toggleWishlist } from "@/app/marketplace/actions";
import { cartItem } from "@/lib/marketplace/pricing";
import { useShopHref } from "./shop-base";
import type { MarketProduct } from "@/lib/marketplace/data";

export function BuyBox({ product, wished, signedIn }: { product: MarketProduct; wished: boolean; signedIn: boolean }) {
  const href = useShopHref();
  const router = useRouter();
  const { addItem, items } = useCart();
  const [qty, setQty] = useState(1);
  const [saved, setSaved] = useState(wished);
  const [pending, start] = useTransition();
  const inCart = items.find((i) => i.productId === product.id)?.quantity ?? 0;
  const max = Math.max(0, product.stock - inCart);
  const soldOut = product.stock <= 0;

  function add(goToCart: boolean) {
    if (max <= 0) {
      toast.error(inCart > 0 ? "You already have all the stock in your cart." : "This product is sold out.");
      return;
    }
    addItem(cartItem(product), Math.min(qty, max));
    if (goToCart) router.push(href("/cart"));
    else toast.success(`${displayName(product)} added to cart`);
  }

  function wish() {
    start(async () => {
      const result = await toggleWishlist(product.id, !saved);
      if (result.ok) {
        setSaved(!saved);
        toast.success(result.message ?? "Saved");
      } else toast.error(result.error);
    });
  }

  return (
    <div className="mt-5 flex flex-col gap-3">
      {!soldOut ? (
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold tracking-[0.08em] text-graphite uppercase">Quantity</span>
          <div className="flex h-10 items-center rounded-md border border-stone">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="flex size-10 items-center justify-center text-graphite hover:bg-stone/60"
              aria-label="Fewer"
            >
              <Minus className="size-4" />
            </button>
            <span className="w-10 text-center text-sm font-semibold text-navy" aria-live="polite">
              {qty}
            </span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(Math.max(1, max), q + 1))}
              className="flex size-10 items-center justify-center text-graphite hover:bg-stone/60"
              aria-label="More"
            >
              <Plus className="size-4" />
            </button>
          </div>
          {inCart > 0 ? <span className="text-xs text-mist">{inCart} in your cart</span> : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={soldOut}
          onClick={() => add(false)}
          className="flex h-12 min-w-44 flex-1 items-center justify-center gap-2 rounded-md bg-gold text-sm font-bold text-navy shadow-sm hover:bg-gold-300 disabled:bg-stone disabled:text-mist"
        >
          <ShoppingCart className="size-4" />
          {soldOut ? "Sold out" : "Add to cart"}
        </button>
        {!soldOut ? (
          <button
            type="button"
            onClick={() => add(true)}
            className="flex h-12 min-w-32 flex-1 items-center justify-center rounded-md bg-navy text-sm font-bold text-white hover:bg-navy-600"
          >
            Buy now
          </button>
        ) : null}
        {signedIn ? (
          <button
            type="button"
            onClick={wish}
            disabled={pending}
            aria-pressed={saved}
            aria-label={saved ? "Remove from saved items" : "Save for later"}
            className="flex size-12 items-center justify-center rounded-md border border-stone text-destructive hover:bg-destructive/5"
          >
            <Heart className={cn("size-5", saved && "fill-destructive")} />
          </button>
        ) : (
          <Link
            href={href("/account/login")}
            aria-label="Sign in to save this item"
            className="flex size-12 items-center justify-center rounded-md border border-stone text-graphite hover:text-destructive"
          >
            <Heart className="size-5" />
          </Link>
        )}
      </div>
    </div>
  );
}
