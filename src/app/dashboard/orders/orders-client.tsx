"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Plus, PackageSearch } from "lucide-react";
import { toast } from "sonner";
import type { Order, OrderStatus, Product } from "@/types/db";
import { ORDER_STATUSES, LOCATIONS } from "@/types/db";
import { naira, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState, OrderStatusBadge, Panel } from "@/components/dashboard/ui";
import { createOrder, updateOrderStatus } from "./actions";
import type { ActionResult } from "@/lib/schemas/order";

const fieldClass =
  "h-10 w-full rounded-md border border-stone bg-white px-3 text-sm text-navy outline-none transition-colors focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/25";
const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-graphite";

export function OrdersClient({
  orders,
  products,
  restricted,
}: {
  orders: Order[];
  products: Product[];
  restricted: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState<"All" | OrderStatus>("All");
  const [locFilter, setLocFilter] = useState<"All" | (typeof LOCATIONS)[number]>(
    "All",
  );
  const [open, setOpen] = useState(false);

  const visible = useMemo(() => {
    return orders.filter(
      (o) =>
        (statusFilter === "All" || o.status === statusFilter) &&
        (locFilter === "All" || o.location === locFilter),
    );
  }, [orders, statusFilter, locFilter]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(["All", ...ORDER_STATUSES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                statusFilter === s
                  ? "border-navy bg-navy text-white"
                  : "border-stone bg-card text-graphite hover:border-teal/40",
              )}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={locFilter}
            onChange={(e) =>
              setLocFilter(e.target.value as "All" | (typeof LOCATIONS)[number])
            }
            className="h-9 rounded-md border border-stone bg-card px-2.5 text-xs font-medium text-graphite"
          >
            {(["All", ...LOCATIONS] as const).map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button size="lg" disabled={restricted} />}>
              <Plus className="size-4" />
              New order
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create new order</DialogTitle>
              </DialogHeader>
              <CreateOrderForm products={products} onDone={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<PackageSearch className="size-8" />}
          title="No orders match"
          body="Try a different filter, or create your first order."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((order) => (
            <OrderRow key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}

const ACCENT: Record<OrderStatus, "gold" | "teal" | "none" | "destructive"> = {
  Packaging: "gold",
  Shipping: "teal",
  Delivered: "none",
  Returned: "destructive",
  Damaged: "destructive",
};

function OrderRow({ order }: { order: Order }) {
  const [isPending, startTransition] = useTransition();

  function onStatusChange(status: OrderStatus) {
    startTransition(async () => {
      const result = await updateOrderStatus(order.id, status);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <Panel accent={ACCENT[order.status]}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-xs font-semibold text-teal">
            {order.order_ref} · {formatDate(order.placed_at)}
          </div>
          <div className="mt-0.5 text-sm font-semibold text-navy">
            {order.customer_name}
          </div>
          <div className="text-xs text-graphite">
            {order.product_name} × {order.quantity}, {naira(order.total)}
          </div>
          <div className="mt-1 text-[11px] text-mist">
            {order.location} · {order.rider}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <OrderStatusBadge status={order.status} />
          <select
            value={order.status}
            disabled={isPending}
            onChange={(e) => onStatusChange(e.target.value as OrderStatus)}
            className="h-8 rounded-md border border-stone bg-card px-2 text-xs"
          >
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Panel>
  );
}

function CreateOrderForm({
  products,
  onDone,
}: {
  products: Product[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (prev, formData) => {
      const result = await createOrder(prev, formData);
      if (result.ok) {
        toast.success("Order created");
        onDone();
      }
      return result;
    },
    null,
  );

  const errors = state && !state.ok ? state.fieldErrors : undefined;

  if (products.length === 0) {
    return (
      <p className="text-sm text-graphite">
        Add a product to your inventory before creating an order.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      <div>
        <label className={labelClass}>Customer name *</label>
        <input name="customerName" required className={fieldClass} />
        {errors?.customerName ? (
          <p className="mt-1 text-xs text-destructive">{errors.customerName[0]}</p>
        ) : null}
      </div>

      <div>
        <label className={labelClass}>Product *</label>
        <select name="productId" required className={cn(fieldClass, "appearance-none")}>
          <option value="">Select a product</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}, {naira(p.sale_price)} ({p.location})
            </option>
          ))}
        </select>
        {errors?.productId ? (
          <p className="mt-1 text-xs text-destructive">{errors.productId[0]}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Quantity</label>
          <input
            name="quantity"
            type="number"
            min="1"
            defaultValue="1"
            className={fieldClass}
          />
        </div>
        <div>
          <label className={labelClass}>Rider</label>
          <select name="rider" defaultValue="BNP Fleet" className={cn(fieldClass, "appearance-none")}>
            <option>BNP Fleet</option>
            <option>Own Rider</option>
            <option>Pickup</option>
          </select>
        </div>
      </div>

      <p className="rounded-md bg-teal/10 px-3 py-2 text-xs text-teal-700">
        This order routes automatically to the warehouse holding the product.
      </p>

      {state && !state.ok && !state.fieldErrors ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Submitting" : "Submit order"}
      </Button>
    </form>
  );
}
