"use client";

import Link from "next/link";
import { Boxes, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { naira } from "@/lib/format";
import { cn } from "@/lib/utils";
import { displayName } from "@/lib/variants";
import { cartItem, discountPercent } from "@/lib/marketplace/pricing";
import { useCart } from "@/components/store/cart-context";
import { Stars } from "./stars";
import { useShopHref } from "./shop-base";
import type { MarketProduct } from "@/lib/marketplace/data";

export function ProductTile({ product, className }: { product: MarketProduct; className?: string }) {
  const href = useShopHref();
  const { addItem, items } = useCart();
  const off = discountPercent(product);
  const soldOut = product.stock <= 0;
  const inCart = items.some((i) => i.productId === product.id);
  const url = href(`/p/${product.id}`);

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg bg-white transition-shadow hover:shadow-lg",
        className,
      )}
    >
      <Link href={url} className="relative block aspect-square bg-stone/60">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt={product.name} loading="lazy" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center">
            <Boxes className="size-10 text-mist" />
          </span>
        )}
        {off > 0 ? (
          <span className="absolute top-2 left-2 rounded bg-gold px-1.5 py-0.5 text-[11px] font-bold text-navy">-{off}%</span>
        ) : null}
        {soldOut ? (
          <span className="absolute inset-x-0 bottom-0 bg-navy/80 py-1 text-center text-[11px] font-semibold text-white">
            Sold out
          </span>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col p-2.5">
        <Link href={url} className="line-clamp-2 min-h-[2.5rem] text-[13px] leading-5 text-navy hover:text-teal-700">
          {displayName(product)}
        </Link>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-base font-semibold text-navy">{naira(product.price)}</span>
          {off > 0 ? <span className="text-xs text-mist line-through">{naira(product.sale_price)}</span> : null}
        </div>
        {product.rating_count > 0 ? <Stars rating={product.rating_avg} count={product.rating_count} className="mt-1" /> : null}
        <span className="mt-1 truncate text-[11px] text-mist">{product.merchant_name}</span>
        <button
          type="button"
          disabled={soldOut}
          onClick={() => {
            addItem(cartItem(product), 1);
            toast.success(`${displayName(product)} added to cart`);
          }}
          className={cn(
            "mt-2 inline-flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition-colors",
            soldOut
              ? "bg-stone text-mist"
              : inCart
                ? "border border-teal text-teal-700 hover:bg-teal/5"
                : "bg-gold text-navy hover:bg-gold-300",
            "sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100",
            inCart && "sm:opacity-100",
          )}
        >
          <ShoppingCart className="size-3.5" />
          {soldOut ? "Sold out" : inCart ? "Add another" : "Add to cart"}
        </button>
      </div>
    </div>
  );
}
