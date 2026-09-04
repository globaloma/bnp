"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, Boxes } from "lucide-react";
import { toast } from "sonner";
import { LOCATIONS, type Product, type WarehouseLocation } from "@/types/db";
import { daysSince, naira } from "@/lib/format";
import { STALE_DAYS_THRESHOLD, LOW_STOCK_THRESHOLD } from "@/types/db";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/dashboard/ui";
import { ImageUploadField } from "@/components/dashboard/image-upload";
import { addProduct } from "./actions";
import type { ActionResult } from "@/lib/schemas/product";

const fieldClass =
  "h-10 w-full rounded-md border border-stone bg-white px-3 text-sm text-navy outline-none transition-colors placeholder:text-mist focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/25";
const labelClass = "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-graphite";

export function InventoryClient({ products }: { products: Product[] }) {
  const [filter, setFilter] = useState<"All" | WarehouseLocation>("All");
  const [open, setOpen] = useState(false);

  const visible = useMemo(
    () => (filter === "All" ? products : products.filter((p) => p.location === filter)),
    [products, filter],
  );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(["All", ...LOCATIONS] as const).map((loc) => (
            <button
              key={loc}
              onClick={() => setFilter(loc)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                filter === loc
                  ? "border-gold bg-gold text-navy"
                  : "border-stone bg-card text-graphite hover:border-teal/40",
              )}
            >
              {loc}
            </button>
          ))}
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="lg" />}>
            <Plus className="size-4" />
            Add product
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add product to inventory</DialogTitle>
            </DialogHeader>
            <AddProductForm onDone={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Boxes className="size-8" />}
          title="No products yet"
          body="Add your first product to start tracking stock and creating orders against it."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((item) => (
            <ProductCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({ item }: { item: Product }) {
  const isLow = item.stock <= LOW_STOCK_THRESHOLD;
  const isStale = daysSince(item.last_moved_at) > STALE_DAYS_THRESHOLD;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border-t-[3px] border-stone bg-card shadow-sm",
        isLow ? "border-t-destructive" : isStale ? "border-t-gold" : "border-t-teal",
      )}
    >
      <div className="flex h-24 items-center justify-center bg-stone">
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image_url}
            alt={item.name}
            className="size-full object-cover"
          />
        ) : (
          <Boxes className="size-8 text-mist" />
        )}
      </div>
      <div className="p-3.5">
        <div className="text-sm font-semibold text-navy">{item.name}</div>
        <div className="mb-1.5 text-[11px] text-mist">
          {item.sku || "No SKU"} · {item.location}
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-success">
            {naira(item.sale_price)}
          </span>
          <span className="text-mist">Cost {naira(item.cost_price)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px]">
          <span className="text-graphite">VAT {item.vat}%</span>
          <span className={cn(isLow && "font-bold text-destructive")}>
            {item.stock} in stock{isLow ? " !" : ""}
          </span>
        </div>
        {item.pickup_enabled ? (
          <div className="mt-1.5 text-[10px] font-semibold text-success">
            Pickup enabled
          </div>
        ) : null}
        {isStale ? (
          <div className="mt-1 text-[10px] font-semibold text-gold">
            Stale, 30+ days
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AddProductForm({ onDone }: { onDone: () => void }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (prev, formData) => {
      const result = await addProduct(prev, formData);
      if (result.ok) {
        toast.success("Product added");
        onDone();
      }
      return result;
    },
    null,
  );

  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      <ImageUploadField bucket="product-images" name="imageUrl" />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Product name *</label>
          <input name="name" required className={fieldClass} placeholder="e.g. Ankara Tote" />
          {errors?.name ? <p className="mt-1 text-xs text-destructive">{errors.name[0]}</p> : null}
        </div>
        <div>
          <label className={labelClass}>SKU</label>
          <input name="sku" className={fieldClass} placeholder="ATB-001" />
        </div>
      </div>

      <div>
        <label className={labelClass}>Category</label>
        <input name="category" className={fieldClass} placeholder="e.g. Bags" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Cost price (₦)</label>
          <input name="costPrice" type="number" min="0" step="0.01" className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>Sale price (₦) *</label>
          <input name="salePrice" type="number" min="0" step="0.01" required className={fieldClass} />
          {errors?.salePrice ? (
            <p className="mt-1 text-xs text-destructive">{errors.salePrice[0]}</p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>VAT (%)</label>
          <input name="vat" type="number" min="0" step="0.1" defaultValue="7.5" className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>Stock quantity *</label>
          <input name="stock" type="number" min="0" required className={fieldClass} />
          {errors?.stock ? <p className="mt-1 text-xs text-destructive">{errors.stock[0]}</p> : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Warehouse location</label>
          <select name="location" defaultValue="Abuja" className={cn(fieldClass, "appearance-none")}>
            {LOCATIONS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Shipping fee (₦)</label>
          <input name="shippingFee" type="number" min="0" step="0.01" defaultValue="1200" className={fieldClass} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs font-medium text-graphite">
        <input type="checkbox" name="pickupEnabled" className="size-4 rounded border-stone" />
        Enable customer pickup option
      </label>

      {state && !state.ok && !state.fieldErrors ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
        {pending ? "Saving" : "Save product"}
      </Button>
    </form>
  );
}
