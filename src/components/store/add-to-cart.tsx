"use client";

import { unitPrice } from "@/lib/product-price";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useCart } from "./cart-context";
import type { StorefrontProduct } from "@/types/db";
import { displayName } from "@/lib/variants";

/**
 * "Add to cart", switching to a quantity stepper once the product is in the
 * cart. Shared by the product card and the product page.
 */
export function AddToCart({
  product,
  size = "default",
  className,
}: {
  product: StorefrontProduct;
  size?: "default" | "lg";
  className?: string;
}) {
  const { addItem, setQuantity, items } = useCart();
  const outOfStock = product.stock <= 0;
  const inCartQty = items.find((i) => i.productId === product.id)?.quantity ?? 0;
  const large = size === "lg";

  function handleAdd() {
    addItem(
      {
        productId: product.id,
        name: displayName(product),
        price: unitPrice(product),
        vat: product.vat,
        shippingFee: product.shipping_fee,
        pickupEnabled: product.pickup_enabled,
        location: product.location,
        imageUrl: product.image_url,
        stock: product.stock,
      },
      1,
    );
    toast.success(`${displayName(product)} added to cart`);
  }

  if (inCartQty > 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-between rounded-md border border-stone p-1",
          large && "h-12 px-2",
          className,
        )}
      >
        <button
          type="button"
          onClick={() => setQuantity(product.id, inCartQty - 1)}
          className={cn(
            "flex items-center justify-center rounded text-graphite hover:bg-stone",
            large ? "size-9" : "size-7",
          )}
          aria-label="Decrease quantity"
        >
          <Minus className="size-3.5" />
        </button>
        <input
          type="number"
          min="1"
          max={product.stock}
          value={inCartQty}
          aria-label="Quantity in cart"
          onChange={(e) => {
            const next = parseInt(e.target.value, 10);
            if (!Number.isNaN(next)) setQuantity(product.id, next);
          }}
          className="w-12 border-0 bg-transparent text-center text-sm font-semibold text-navy outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          onClick={() => setQuantity(product.id, inCartQty + 1)}
          disabled={inCartQty >= product.stock}
          className={cn(
            "flex items-center justify-center rounded text-graphite hover:bg-stone disabled:opacity-40",
            large ? "size-9" : "size-7",
          )}
          aria-label="Increase quantity"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      onClick={handleAdd}
      disabled={outOfStock}
      size={large ? "xl" : "default"}
      className={cn("w-full", className)}
    >
      {outOfStock ? "Out of stock" : "Add to cart"}
    </Button>
  );
}
