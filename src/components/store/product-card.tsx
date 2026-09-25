"use client";

import { Boxes } from "lucide-react";
import { toast } from "sonner";
import { naira } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { useCart } from "./cart-context";
import type { StorefrontProduct } from "@/types/db";

export function ProductCard({ product }: { product: StorefrontProduct }) {
  const { addItem, items } = useCart();
  const outOfStock = product.stock <= 0;
  const inCart = items.find((i) => i.productId === product.id)?.quantity ?? 0;

  function handleAdd() {
    addItem(
      {
        productId: product.id,
        name: product.name,
        price: product.sale_price,
        vat: product.vat,
        shippingFee: product.shipping_fee,
        imageUrl: product.image_url,
        stock: product.stock,
      },
      1,
    );
    toast.success(`${product.name} added to cart`);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-stone bg-white shadow-sm">
      <div className="relative flex h-40 items-center justify-center bg-stone">
        {inCart > 0 ? (
          <span className="absolute top-2 right-2 z-10 flex min-w-5 items-center justify-center rounded-full bg-gold px-1.5 py-0.5 text-[11px] font-bold text-navy shadow">
            {inCart} in cart
          </span>
        ) : null}
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
      </div>
      <div className="p-4">
        <div className="text-sm font-semibold text-navy">{product.name}</div>
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
        <Button
          type="button"
          onClick={handleAdd}
          disabled={outOfStock}
          className="mt-3 w-full"
        >
          {outOfStock ? "Unavailable" : "Add to cart"}
        </Button>
      </div>
    </div>
  );
}
