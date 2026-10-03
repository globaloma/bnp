"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Plus, PackageSearch, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Order, OrderPaymentStatus, OrderStatus, Product } from "@/types/db";
import { ORDER_STATUSES, LOCATIONS } from "@/types/db";
import { naira, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { computeMultiLineTotals } from "@/lib/orders";
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
import { createOrder, deleteOrderGroups } from "./actions";
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
  chargesVat,
}: {
  orders: Order[];
  products: Product[];
  restricted: boolean;
  chargesVat: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState<"All" | OrderStatus>("All");
  const [paymentFilter, setPaymentFilter] = useState<"All" | OrderPaymentStatus>("All");
  const [locFilter, setLocFilter] = useState<"All" | (typeof LOCATIONS)[number]>(
    "All",
  );
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkPending, startBulkTransition] = useTransition();

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = orders.filter(
      (o) =>
        (statusFilter === "All" || o.status === statusFilter) &&
        (paymentFilter === "All" || o.payment_status === paymentFilter) &&
        (locFilter === "All" || o.location === locFilter),
    );
    // Search matches per order, not per line: if any product in a multi-item
    // order matches, the whole order shows, with all of its items.
    const grouped = Array.from(groupOrdersByRef(filtered).entries()).filter(
      ([orderRef, lines]) =>
        q === "" ||
        orderRef.toLowerCase().includes(q) ||
        lines[0].customer_name.toLowerCase().includes(q) ||
        lines.some((l) => l.product_name.toLowerCase().includes(q)),
    );
    return grouped.sort(
      (a, b) =>
        new Date(b[1][0].placed_at).getTime() - new Date(a[1][0].placed_at).getTime(),
    );
  }, [orders, statusFilter, paymentFilter, locFilter, search]);

  const allSelected = groups.length > 0 && selected.size === groups.length;

  function toggleSelect(orderRef: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orderRef)) next.delete(orderRef);
      else next.add(orderRef);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(groups.map(([ref]) => ref)));
  }

  function handleBulkDelete() {
    startBulkTransition(async () => {
      const result = await deleteOrderGroups(Array.from(selected));
      if (result.ok) {
        toast.success(`${selected.size} order(s) deleted`);
        setSelected(new Set());
        setConfirmBulkDelete(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
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

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone bg-card p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-mist" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer, product or order ref"
              className="h-9 w-56 rounded-md border border-stone bg-white pl-8 pr-2.5 text-xs text-navy placeholder:text-mist"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-[0.06em] text-mist">
              Payment
            </label>
            <select
              value={paymentFilter}
              onChange={(e) =>
                setPaymentFilter(e.target.value as "All" | OrderPaymentStatus)
              }
              className="h-9 rounded-md border border-stone bg-white px-2.5 text-xs font-medium text-graphite capitalize"
            >
              {(["All", ...PAYMENT_STATUSES] as const).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-[0.06em] text-mist">
              Location
            </label>
            <select
              value={locFilter}
              onChange={(e) =>
                setLocFilter(e.target.value as "All" | (typeof LOCATIONS)[number])
              }
              className="h-9 rounded-md border border-stone bg-white px-2.5 text-xs font-medium text-graphite"
            >
              {(["All", ...LOCATIONS] as const).map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
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
            <CreateOrderForm
              products={products}
              chargesVat={chargesVat}
              onDone={() => setOpen(false)}
            />
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
        <>
          <div className="mb-2.5 flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-medium text-graphite">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="size-4 rounded border-stone"
              />
              Select all
            </label>
            {selected.size > 0 ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setConfirmBulkDelete(true)}
              >
                <Trash2 className="size-3.5" />
                Delete {selected.size} selected
              </Button>
            ) : null}
          </div>

          <div className="flex flex-col gap-3">
            {groups.map(([orderRef, lines]) => (
              <OrderGroupRow
                key={orderRef}
                orderRef={orderRef}
                lines={lines}
                chargesVat={chargesVat}
                selected={selected.has(orderRef)}
                onToggleSelect={() => toggleSelect(orderRef)}
              />
            ))}
          </div>
        </>
      )}

      <Dialog open={confirmBulkDelete} onOpenChange={setConfirmBulkDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {selected.size} order(s)?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-graphite">
            This deletes every selected order and restocks their items. This can&apos;t be
            undone.
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmBulkDelete(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={bulkPending}
              onClick={handleBulkDelete}
            >
              Delete selected
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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

function OrderGroupRow({
  orderRef,
  lines,
  chargesVat,
  selected,
  onToggleSelect,
}: {
  orderRef: string;
  lines: Order[];
  chargesVat: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}) {
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
      <div className="relative">
        <input
          type="checkbox"
          checked={selected}
          onClick={(e) => e.stopPropagation()}
          onChange={onToggleSelect}
          className="absolute top-4 left-3 z-10 size-4 rounded border-stone"
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="block w-full pl-7 text-left"
        >
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
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Order {orderRef}</DialogTitle>
          </DialogHeader>
          <OrderDetail
            orderRef={orderRef}
            lines={lines}
            chargesVat={chargesVat}
            onClose={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function CreateOrderForm({
  products,
  chargesVat,
  onDone,
}: {
  products: Product[];
  chargesVat: boolean;
  onDone: () => void;
}) {
  const [lines, setLines] = useState<{ key: string; productId: string; quantity: number }[]>(
    () => [{ key: crypto.randomUUID(), productId: "", quantity: 1 }],
  );
  const [rider, setRider] = useState("BNP Fleet");
  const [discountType, setDiscountType] = useState<"" | "fixed" | "percentage">("");
  const [discountValue, setDiscountValue] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);

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
  const isOwnRider = rider === "Own Rider";

  const chosen = lines.flatMap((l) => {
    const product = products.find((p) => p.id === l.productId);
    return product ? [{ product, quantity: l.quantity }] : [];
  });

  const totals = chosen.length
    ? computeMultiLineTotals({
        lines: chosen.map(({ product, quantity }) => ({
          unitPrice: product.sale_price,
          quantity,
          vatRate: chargesVat ? product.vat : 0,
        })),
        discountType: discountType || undefined,
        discountValue,
        deliveryFee: isOwnRider ? deliveryFee : 0,
      })
    : null;

  function updateLine(key: string, patch: Partial<{ productId: string; quantity: number }>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

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

      <input
        type="hidden"
        name="items"
        value={JSON.stringify(
          lines
            .filter((l) => l.productId)
            .map((l) => ({ productId: l.productId, quantity: l.quantity })),
        )}
      />

      <div>
        <div className="grid grid-cols-[1fr_5rem_2.25rem] gap-2">
          <label className={labelClass}>Products *</label>
          <label className={labelClass}>Qty</label>
        </div>
        <div className="flex flex-col gap-2">
          {lines.map((line) => (
            <div key={line.key} className="grid grid-cols-[1fr_5rem_2.25rem] items-center gap-2">
              <select
                required
                value={line.productId}
                onChange={(e) => updateLine(line.key, { productId: e.target.value })}
                className={cn(fieldClass, "appearance-none")}
              >
                <option value="">Select a product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}, {naira(p.sale_price)} ({p.location})
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                value={line.quantity}
                onChange={(e) =>
                  updateLine(line.key, {
                    quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                  })
                }
                aria-label="Quantity"
                className={fieldClass}
              />
              <button
                type="button"
                onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                disabled={lines.length === 1}
                aria-label="Remove product"
                className="flex size-9 items-center justify-center rounded-md text-mist transition-colors hover:bg-stone hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setLines((prev) => [...prev, { key: crypto.randomUUID(), productId: "", quantity: 1 }])
          }
          className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:underline"
        >
          <Plus className="size-3.5" />
          Add another product
        </button>
        {errors?.items ? (
          <p className="mt-1 text-xs text-destructive">{errors.items[0]}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Rider / delivery</label>
          <select
            name="rider"
            value={rider}
            onChange={(e) => setRider(e.target.value)}
            className={cn(fieldClass, "appearance-none")}
          >
            <option>BNP Fleet</option>
            <option>Own Rider</option>
            <option>Pickup</option>
          </select>
        </div>

        {isOwnRider ? (
          <div>
            <label className={labelClass}>Delivery price (₦)</label>
            <input
              name="deliveryFee"
              type="number"
              min="0"
              step="0.01"
              value={deliveryFee}
              onChange={(e) => setDeliveryFee(Math.max(0, Number(e.target.value) || 0))}
              className={fieldClass}
              placeholder="What you're charging for the rider"
            />
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Discount (whole order)</label>
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
            value={discountValue}
            onChange={(e) => setDiscountValue(Math.max(0, Number(e.target.value) || 0))}
            disabled={!discountType}
            className={cn(fieldClass, !discountType && "opacity-50")}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Notes</label>
        <textarea name="notes" rows={2} className={cn(fieldClass, "h-auto py-2")} />
      </div>

      {totals ? (
        <div className="rounded-lg border border-stone bg-white p-3 text-sm">
          <div className="flex justify-between text-graphite">
            <span>Subtotal</span>
            <span>{naira(totals.subtotal)}</span>
          </div>
          {totals.discountAmount > 0 ? (
            <div className="flex justify-between text-graphite">
              <span>Discount</span>
              <span>-{naira(totals.discountAmount)}</span>
            </div>
          ) : null}
          {totals.vatAmount > 0 ? (
            <div className="flex justify-between text-graphite">
              <span>VAT</span>
              <span>{naira(totals.vatAmount)}</span>
            </div>
          ) : null}
          {totals.deliveryFee > 0 ? (
            <div className="flex justify-between text-graphite">
              <span>Delivery</span>
              <span>{naira(totals.deliveryFee)}</span>
            </div>
          ) : null}
          <div className="mt-1.5 flex justify-between border-t border-stone pt-1.5 font-semibold text-navy">
            <span>Total</span>
            <span>{naira(totals.total)}</span>
          </div>
        </div>
      ) : (
        <p className="rounded-md bg-teal/10 px-3 py-2 text-xs text-teal-700">
          Select a product to see the order total.
        </p>
      )}

      {state && !state.ok && !state.fieldErrors ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Submitting" : "Submit order"}
      </Button>
    </form>
  );
}
