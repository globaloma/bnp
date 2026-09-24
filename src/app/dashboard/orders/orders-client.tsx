"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, PackageSearch, Search } from "lucide-react";
import { toast } from "sonner";
import type { Order, OrderPaymentStatus, OrderStatus, Product } from "@/types/db";
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
import { groupOrdersByRef } from "@/lib/orders";
import { createOrder } from "./actions";
import type { ActionResult } from "@/lib/schemas/order";
import { OrderDetail } from "./order-detail";

const fieldClass =
  "h-10 w-full rounded-md border border-stone bg-white px-3 text-sm text-navy outline-none transition-colors focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/25";
const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-graphite";

const PAYMENT_STATUSES: OrderPaymentStatus[] = ["paid", "pending", "failed"];

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
  const [paymentFilter, setPaymentFilter] = useState<"All" | OrderPaymentStatus>("All");
  const [locFilter, setLocFilter] = useState<"All" | (typeof LOCATIONS)[number]>(
    "All",
  );
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = orders.filter(
      (o) =>
        (statusFilter === "All" || o.status === statusFilter) &&
        (paymentFilter === "All" || o.payment_status === paymentFilter) &&
        (locFilter === "All" || o.location === locFilter) &&
        (q === "" ||
          o.customer_name.toLowerCase().includes(q) ||
          o.order_ref.toLowerCase().includes(q)),
    );
    return Array.from(groupOrdersByRef(filtered).entries()).sort(
      (a, b) =>
        new Date(b[1][0].placed_at).getTime() - new Date(a[1][0].placed_at).getTime(),
    );
  }, [orders, statusFilter, paymentFilter, locFilter, search]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
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

      <div className="mb-5 flex flex-wrap gap-2">
        {(["All", ...PAYMENT_STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setPaymentFilter(s)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
              paymentFilter === s
                ? "border-teal bg-teal text-white"
                : "border-stone bg-card text-graphite hover:border-teal/40",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-mist" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer or order ref"
              className="h-9 w-56 rounded-md border border-stone bg-card pl-8 pr-2.5 text-xs text-navy placeholder:text-mist"
            />
          </div>
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
        </div>

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

      {groups.length === 0 ? (
        <EmptyState
          icon={<PackageSearch className="size-8" />}
          title="No orders match"
          body="Try a different filter, or create your first order."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map(([orderRef, lines]) => (
            <OrderGroupRow key={orderRef} orderRef={orderRef} lines={lines} />
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

function OrderGroupRow({ orderRef, lines }: { orderRef: string; lines: Order[] }) {
  const [open, setOpen] = useState(false);
  const first = lines[0];
  const total = lines.reduce((sum, l) => sum + l.total, 0);
  const allSameStatus = lines.every((l) => l.status === first.status);
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);
  const summary =
    lines.length === 1
      ? `${first.product_name} × ${first.quantity}`
      : `${lines.length} items · ${itemCount} units`;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block w-full text-left">
        <Panel accent={allSameStatus ? ACCENT[first.status] : "none"}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-mono text-xs font-semibold text-teal">
                {orderRef} · {formatDate(first.placed_at)}
              </div>
              <div className="mt-0.5 text-sm font-semibold text-navy">
                {first.customer_name}
              </div>
              <div className="text-xs text-graphite">
                {summary}, {naira(total)}
              </div>
              <div className="mt-1 text-[11px] text-mist">
                {first.location} · {first.rider} · {first.payment_status}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              {allSameStatus ? (
                <OrderStatusBadge status={first.status} />
              ) : (
                <span className="inline-flex items-center rounded-full bg-mist/20 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-graphite uppercase">
                  Mixed status
                </span>
              )}
            </div>
          </div>
        </Panel>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Order {orderRef}</DialogTitle>
          </DialogHeader>
          <OrderDetail orderRef={orderRef} lines={lines} onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function CreateOrderForm({
  products,
  onDone,
}: {
  products: Product[];
  onDone: () => void;
}) {
  const [discountType, setDiscountType] = useState<"" | "fixed" | "percentage">("");
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
    <form action={formAction} className="flex max-h-[70vh] flex-col gap-3.5 overflow-y-auto pr-1">
      <div>
        <label className={labelClass}>Customer name *</label>
        <input name="customerName" required className={fieldClass} />
        {errors?.customerName ? (
          <p className="mt-1 text-xs text-destructive">{errors.customerName[0]}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Phone</label>
          <input name="customerPhone" placeholder="0801 234 5678" className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>Address</label>
          <input name="deliveryAddress" className={fieldClass} />
        </div>
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
          <label className={labelClass}>Rider / delivery</label>
          <select name="rider" defaultValue="BNP Fleet" className={cn(fieldClass, "appearance-none")}>
            <option>BNP Fleet</option>
            <option>Own Rider</option>
            <option>Pickup</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Discount</label>
          <select
            name="discountType"
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as typeof discountType)}
            className={cn(fieldClass, "appearance-none")}
          >
            <option value="">No discount</option>
            <option value="fixed">Fixed amount (₦)</option>
            <option value="percentage">Percentage (%)</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>
            {discountType === "percentage" ? "Discount (%)" : "Discount (₦)"}
          </label>
          <input
            name="discountValue"
            type="number"
            min="0"
            step="0.01"
            defaultValue="0"
            disabled={!discountType}
            className={cn(fieldClass, !discountType && "opacity-50")}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Notes</label>
        <textarea name="notes" rows={2} className={cn(fieldClass, "h-auto py-2")} />
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
