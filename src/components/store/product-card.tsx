"use client";

import { Boxes } from "lucide-react";
import { toast } from "sonner";
import { naira } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { useCart } from "./cart-context";
import type { StorefrontProduct } from "@/types/db";

export function ProductCard({ product }: { product: StorefrontProduct }) {
  const { addItem } = useCart();
  const outOfStock = product.stock <= 0;

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
      <div className="flex h-40 items-center justify-center bg-stone">
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
