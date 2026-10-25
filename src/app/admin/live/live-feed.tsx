"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { naira } from "@/lib/format";
import { methodLabel } from "@/lib/delivery-methods";
import { cn } from "@/lib/utils";
import { OrderStatusBadge, StatCard } from "@/components/dashboard/ui";
import { DeliveryProgressTag } from "@/components/dashboard/delivery-progress";
import { buildReceiptPdf } from "@/lib/receipt-pdf";
import type { Order } from "@/types/db";

export type FeedLine = Pick<
  Order,
  | "id"
  | "partner_id"
  | "order_ref"
  | "customer_name"
  | "product_id"
  | "quantity"
  | "total"
  | "status"
  | "channel"
  | "location"
  | "delivery_method"
  | "delivery_progress"
  | "delivery_failed_attempts"
  | "placed_at"
  | "updated_at"
>;

type Feed = {
  key: string;
  ref: string;
  partnerId: string;
  customer: string;
  items: number;
  total: number;
  status: Order["status"];
  channel: Order["channel"];
  location: Order["location"];
  method: Order["delivery_method"];
  progress: Order["delivery_progress"];
  attempts: number;
  placedAt: string;
  updatedAt: string;
};

type Connection = "connecting" | "live" | "offline";

/** One row per order: the lines that share a merchant and order ref. */
function group(lines: FeedLine[]): Feed[] {
  const map = new Map<string, Feed>();
  for (const l of lines) {
    const key = `${l.partner_id}:${l.order_ref}`;
    // The delivery-fee line of a store order isn't an item.
    const goods = l.product_id ? l.quantity : 0;
    const f = map.get(key);
    if (!f) {
      map.set(key, {
        key,
        ref: l.order_ref,
        partnerId: l.partner_id,
        customer: l.customer_name,
        items: goods,
        total: l.total,
        status: l.status,
        channel: l.channel,
        location: l.location,
        method: l.delivery_method,
        progress: l.delivery_progress,
        attempts: l.delivery_failed_attempts ?? 0,
        placedAt: l.placed_at,
        updatedAt: l.updated_at,
      });
      continue;
    }
    f.items += goods;
    f.total += l.total;
    if (l.updated_at > f.updatedAt) {
      f.updatedAt = l.updated_at;
      f.status = l.status;
      f.progress = l.delivery_progress;
      f.attempts = l.delivery_failed_attempts ?? 0;
    }
    if (l.placed_at < f.placedAt) f.placedAt = l.placed_at;
    if (!f.method && l.delivery_method) f.method = l.delivery_method;
  }
  return [...map.values()].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

function when(iso: string) {
  const d = new Date(iso);
  const t = d.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
  return d.toDateString() === new Date().toDateString()
    ? t
    : `${d.toLocaleDateString("en-NG", { day: "numeric", month: "short" })}, ${t}`;
}

/** Every line of the order, fresh from the database, as the receipt PDF. */
function ReceiptButton({ partnerId, orderRef, merchantName }: { partnerId: string; orderRef: string; merchantName: string }) {
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    try {
      const { data, error } = await createClient()
        .from("orders")
        .select("*")
        .eq("partner_id", partnerId)
        .eq("order_ref", orderRef)
        .order("placed_at");
      if (error || !data?.length) throw new Error("Could not load this order.");
      const lines = (data as Order[]).map((l) => ({
        ...l,
        subtotal: Number(l.subtotal),
        discount_amount: Number(l.discount_amount),
        vat_amount: Number(l.vat_amount),
        delivery_fee: Number(l.delivery_fee),
        unit_price: Number(l.unit_price),
        total: Number(l.total),
      }));
      buildReceiptPdf({ orderRef, lines, merchantName }).save(`${orderRef}.pdf`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the receipt");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={download}
      disabled={busy}
      title="Download receipt (PDF)"
      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-stone bg-card px-2.5 text-[11px] font-semibold whitespace-nowrap text-graphite transition-colors hover:border-teal/40 hover:text-teal-700 disabled:opacity-50"
    >
      <Download className="size-3.5" />
      {busy ? "Creating" : "Receipt"}
    </button>
  );
}

export function LiveFeed({
  initial,
  since,
  merchants,
}: {
  initial: FeedLine[];
  since: string;
  merchants: Record<string, string>;
}) {
  const [lines, setLines] = useState(() => new Map(initial.map((l) => [l.id, l])));
  const [flash, setFlash] = useState<Record<string, number>>({});
  const [connection, setConnection] = useState<Connection>("connecting");

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin-live-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const id = (payload.old as { id?: string }).id;
          if (id) {
            setLines((prev) => {
              const next = new Map(prev);
              next.delete(id);
              return next;
            });
          }
          return;
        }
        const row = payload.new as FeedLine;
        setLines((prev) => new Map(prev).set(row.id, { ...row, total: Number(row.total) }));
        setFlash((prev) => ({ ...prev, [`${row.partner_id}:${row.order_ref}`]: Date.now() }));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setConnection("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setConnection("offline");
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Fade the highlight on changed orders after a few seconds.
  useEffect(() => {
    if (Object.keys(flash).length === 0) return;
    const t = setTimeout(() => {
      const cutoff = Date.now() - 4000;
      setFlash((prev) => Object.fromEntries(Object.entries(prev).filter(([, at]) => at > cutoff)));
    }, 4100);
    return () => clearTimeout(t);
  }, [flash]);

  const feed = useMemo(() => group([...lines.values()]), [lines]);
  const stats = useMemo(() => {
    const placedToday = feed.filter((f) => f.placedAt >= since);
    const touchedToday = feed.filter((f) => f.updatedAt >= since);
    return {
      placed: placedToday.length,
      value: placedToday.filter((f) => f.status !== "Cancelled").reduce((s, f) => s + f.total, 0),
      waiting: feed.filter((f) => f.status === "Created" || f.status === "Reserved" || f.status === "Picking").length,
      dispatched: touchedToday.filter((f) => f.status === "Dispatched").length,
      delivered: touchedToday.filter((f) => f.status === "Delivered").length,
    };
  }, [feed, since]);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-xs font-semibold">
        <span
          className={cn(
            "size-2 rounded-full",
            connection === "live" ? "animate-pulse bg-success" : connection === "connecting" ? "bg-gold" : "bg-destructive",
          )}
        />
        <span className={connection === "offline" ? "text-destructive" : "text-graphite"}>
          {connection === "live"
            ? "Live: new orders and changes appear here by themselves"
            : connection === "connecting"
              ? "Connecting..."
              : "Not connected. Refresh the page to reconnect."}
        </span>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <StatCard label="Orders today" value={String(stats.placed)} sub={naira(stats.value)} accent="teal" />
        <StatCard label="Waiting to pack" value={String(stats.waiting)} sub="Created, reserved or picking" accent="gold" />
        <StatCard label="Dispatched today" value={String(stats.dispatched)} accent="success" />
        <StatCard label="Delivered today" value={String(stats.delivered)} accent="success" />
      </div>

      {feed.length === 0 ? (
        <p className="rounded-lg border border-stone bg-card px-4 py-5 text-sm text-mist">
          No orders yet. They&apos;ll appear here the moment one is placed.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-stone bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone text-left text-[11px] uppercase tracking-[0.08em] text-mist">
                <th className="px-4 py-2.5 font-semibold">Updated</th>
                <th className="px-4 py-2.5 font-semibold">Order</th>
                <th className="px-4 py-2.5 font-semibold">Merchant</th>
                <th className="px-4 py-2.5 font-semibold">Customer</th>
                <th className="px-4 py-2.5 font-semibold">Delivery</th>
                <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">
                  <span className="sr-only">Receipt</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone">
              {feed.slice(0, 200).map((f) => (
                <tr key={f.key} className={cn("transition-colors duration-700", flash[f.key] && "bg-gold/15")}>
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap text-graphite">{when(f.updatedAt)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <div className="font-mono text-xs font-semibold text-navy">{f.ref}</div>
                    <div className="text-[11px] text-mist">
                      {f.channel === "storefront" ? "Store" : "Dashboard"} · {f.items} item{f.items === 1 ? "" : "s"}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-navy">{merchants[f.partnerId] ?? "Merchant"}</td>
                  <td className="px-4 py-2.5 text-graphite">{f.customer}</td>
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap text-graphite">
                    {f.method ? methodLabel(f.method) : "Not set"} · {f.location}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold whitespace-nowrap text-navy tabular-nums">
                    {naira(f.total)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <OrderStatusBadge status={f.status} />
                      <DeliveryProgressTag
                        order={{ status: f.status, delivery_progress: f.progress, delivery_failed_attempts: f.attempts }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <ReceiptButton
                      partnerId={f.partnerId}
                      orderRef={f.ref}
                      merchantName={merchants[f.partnerId] ?? "Merchant"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
