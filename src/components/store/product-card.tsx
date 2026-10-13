import Link from "next/link";
import { Boxes } from "lucide-react";
import { naira } from "@/lib/format";
import { AddToCart } from "./add-to-cart";
import type { StorefrontProduct } from "@/types/db";

export function ProductCard({
  product,
  href,
}: {
  product: StorefrontProduct;
  /** The product's own page; the image and name link to it. */
  href: string;
}) {
  const outOfStock = product.stock <= 0;

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
        <div className="mt-2 flex items-center justify-between">
          <span className="text-base font-semibold text-success">
            {naira(product.sale_price)}
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
