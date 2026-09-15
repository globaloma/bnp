"use client";

import { useMemo, useState, useTransition } from "react";
import { PackageSearch } from "lucide-react";
import { toast } from "sonner";
import type { OrderStatus } from "@/types/db";
import { ORDER_STATUSES, LOCATIONS } from "@/types/db";
import { naira, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState, OrderStatusBadge, Panel } from "@/components/dashboard/ui";
import { updateOrderStatusAsFc } from "./actions";
import type { OrderWithMerchant } from "@/lib/data/fulfillment-center";

export function FcOrdersClient({ orders }: { orders: OrderWithMerchant[] }) {
  const [statusFilter, setStatusFilter] = useState<"All" | OrderStatus>("All");
  const [locFilter, setLocFilter] = useState<"All" | (typeof LOCATIONS)[number]>(
    "All",
  );

  const merchants = useMemo(
    () => Array.from(new Set(orders.map((o) => o.merchant_name))).sort(),
    [orders],
  );
  const [merchantFilter, setMerchantFilter] = useState<"All" | string>("All");

  const visible = useMemo(() => {
    return orders.filter(
      (o) =>
        (statusFilter === "All" || o.status === statusFilter) &&
        (locFilter === "All" || o.location === locFilter) &&
        (merchantFilter === "All" || o.merchant_name === merchantFilter),
    );
  }, [orders, statusFilter, locFilter, merchantFilter]);

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
            value={merchantFilter}
            onChange={(e) => setMerchantFilter(e.target.value)}
            className="h-9 rounded-md border border-stone bg-card px-2.5 text-xs font-medium text-graphite"
          >
            <option value="All">All merchants</option>
            {merchants.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
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
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<PackageSearch className="size-8" />}
          title="No orders match"
          body="Try a different filter, or check back once merchants start receiving orders."
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

function OrderRow({ order }: { order: OrderWithMerchant }) {
  const [isPending, startTransition] = useTransition();

  function onStatusChange(status: OrderStatus) {
    startTransition(async () => {
      const result = await updateOrderStatusAsFc(order.id, status);
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
            {order.merchant_name} · {order.location} · {order.rider}
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
