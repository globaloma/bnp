"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { naira } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCart } from "./cart-context";

export function CartSheet({ slug }: { slug: string }) {
  const { items, removeItem, setQuantity, count, subtotal, vatTotal } = useCart();

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="secondary" className="relative gap-2" />
        }
      >
        <ShoppingCart className="size-4" />
        Cart
        {count > 0 ? (
          <Badge className="absolute -top-2 -right-2 bg-gold text-navy">{count}</Badge>
        ) : null}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Your cart</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4">
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-mist">Your cart is empty.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map((item) => (
                <li
                  key={item.productId}
                  className="flex items-center gap-3 rounded-lg border border-stone p-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-navy">{item.name}</div>
                    <div className="text-xs text-mist">{naira(item.price)}</div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setQuantity(item.productId, item.quantity - 1)}
                        className="flex size-6 items-center justify-center rounded border border-stone text-graphite hover:border-teal/40"
                      >
                        <Minus className="size-3" />
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={item.stock}
                        value={item.quantity}
                        onChange={(e) => {
                          const next = parseInt(e.target.value, 10);
                          if (!Number.isNaN(next)) setQuantity(item.productId, next);
                        }}
                        className="w-10 rounded border border-stone text-center text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        onClick={() => setQuantity(item.productId, item.quantity + 1)}
                        disabled={item.quantity >= item.stock}
                        className="flex size-6 items-center justify-center rounded border border-stone text-graphite hover:border-teal/40 disabled:opacity-40"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.productId)}
                    aria-label={`Remove ${item.name}`}
                    className="text-mist hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <SheetFooter>
          <div className="flex items-center justify-between text-sm text-graphite">
            <span>Subtotal</span>
            <span>{naira(subtotal)}</span>
          </div>
          {vatTotal > 0 ? (
            <div className="flex items-center justify-between text-sm text-graphite">
              <span>VAT</span>
              <span>{naira(vatTotal)}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between text-sm font-semibold text-navy">
            <span>Total</span>
            <span>{naira(subtotal + vatTotal)}</span>
          </div>
          <Button
            render={<Link href={`/store/${slug}/checkout`} />}
            disabled={items.length === 0}
            className="w-full"
          >
            Checkout
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
