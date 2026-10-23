"use client";

import { onPromo, unitPrice } from "@/lib/product-price";
import { useState } from "react";
import Link from "next/link";
import { Boxes } from "lucide-react";
import { naira } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AddToCart } from "./add-to-cart";
import type { StorefrontProduct } from "@/types/db";

/**
 * One product on the store page. A product with colours or sizes is several
 * SKUs (variants); the card shows one at a time with a chooser, and each
 * variant keeps its own price, photo and stock.
 */
export function ProductCard({
  variants,
  slug,
}: {
  variants: StorefrontProduct[];
  slug: string;
}) {
  // Start on the first variant that's in stock.
  const [selectedId, setSelectedId] = useState(
    () => (variants.find((v) => v.stock > 0) ?? variants[0]).id,
  );
  const product = variants.find((v) => v.id === selectedId) ?? variants[0];
  const href = `/store/${slug}/p/${product.id}`;
  const outOfStock = product.stock <= 0;
  const hasVariants = variants.length > 1;

  return (
    <div className="overflow-hidden rounded-xl border border-stone bg-white shadow-sm">
      <Link href={href} className="flex h-40 items-center justify-center bg-stone">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            className="size-full object-cover"
          />
        ) : (
          <Boxes className="size-10 text-mist" />
        )}
      </Link>
      <div className="p-4">
        <Link href={href} className="text-sm font-semibold text-navy hover:text-teal-700">
          {product.name}
        </Link>
        {product.category ? (
          <div className="text-[11px] text-mist">{product.category}</div>
        ) : null}

        {hasVariants ? (
          <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Options">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={v.id === product.id}
                onClick={() => setSelectedId(v.id)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors",
                  v.id === product.id
                    ? "border-navy bg-navy text-white"
                    : "border-stone text-graphite hover:border-teal/40",
                  v.stock <= 0 && v.id !== product.id && "text-mist line-through",
                )}
              >
                {v.variant ?? v.name}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-2 flex items-center justify-between">
          <span className="text-base font-semibold text-success">
            {naira(unitPrice(product))}
            {onPromo(product) ? (
              <span className="ml-1.5 text-xs font-normal text-mist line-through">{naira(product.sale_price)}</span>
            ) : null}
          </span>
          {outOfStock ? (
            <span className="text-xs font-semibold text-destructive">Out of stock</span>
          ) : null}
        </div>

        <AddToCart product={product} className="mt-3" />
      </div>
    </div>
  );
}
