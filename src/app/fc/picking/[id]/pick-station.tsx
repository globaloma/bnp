"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArrowLeft, ArrowRight, CheckCircle2, Minus, PlayCircle, Printer, X } from "lucide-react";
import { toast } from "sonner";
import type { OrderRider, OrderStatus, ScanResult, WarehouseLocation } from "@/types/db";
import { formatDate } from "@/lib/format";
import { printPackageLabel } from "@/lib/package-label";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { OrderStatusBadge } from "@/components/dashboard/ui";
import { ScanStation } from "@/components/warehouse/scan-station";
import { findBin, type BinInfo } from "../../putaway/actions";
import { pickScan, pickUndo, startPicking } from "../actions";

export type PickLine = {
  id: string;
  product_id: string | null;
  name: string;
  barcode: string | null;
  quantity: number;
  picked: number;
  bins: { code: string; quantity: number }[];
};

type OrderInfo = {
  partnerId: string;
  orderRef: string;
  status: OrderStatus;
  customerName: string;
  customerPhone: string | null;
  deliveryAddress: string | null;
  rider: OrderRider;
  location: WarehouseLocation;
  placedAt: string;
  merchantName: string;
  merchantCode: string;
};

export function PickStation({ order, initialLines }: { order: OrderInfo; initialLines: PickLine[] }) {
  const router = useRouter();
  const [lines, setLines] = useState(initialLines);
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [bin, setBin] = useState<BinInfo | null>(null);
  const [starting, startTransition] = useTransition();

  const units = lines.reduce((s, l) => s + l.quantity, 0);
  const picked = lines.reduce((s, l) => s + l.picked, 0);
  const packageCode = `${order.merchantCode}-${order.orderRef}`;

  function printLabel() {
    printPackageLabel({
      packageCode,
      orderRef: order.orderRef,
      merchantName: order.merchantName,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      deliveryAddress: order.deliveryAddress,
      rider: order.rider,
      location: order.location,
      placedAt: order.placedAt,
      items: lines.map((l) => ({ name: l.name, quantity: l.quantity })),
    });
  }

  function start() {
    startTransition(async () => {
      const result = await startPicking(order.partnerId, order.orderRef);
      if (result.ok) setStatus("Picking");
      else toast.error(result.message);
    });
  }

  function applyPicked(result: ScanResult) {
    if (!result.product_id || result.picked === undefined) return;
    // The database fills the first unfinished line for this product, in order.
    setLines((prev) => {
      const index = prev.findIndex((l) => l.product_id === result.product_id && l.picked < l.quantity);
      if (index === -1) return prev;
      return prev.map((l, i) => (i === index ? { ...l, picked: result.picked ?? l.picked } : l));
    });
  }

  async function handleScan(code: string, qty: number): Promise<ScanResult> {
    if (code.trim().toUpperCase().startsWith("BIN-")) {
      const found = await findBin(code, order.location);
      if (!found.ok) return { ok: false, tone: "error", message: found.message };
      setBin(found.bin);
      return {
        ok: true,
        tone: "success",
        message: found.bin.holds
          ? `Bin ${found.bin.code}: ${found.bin.holds.quantity} × ${found.bin.holds.label}. Scan the items.`
          : `Bin ${found.bin.code} is empty.`,
      };
    }
    if (!bin) return { ok: false, tone: "error", message: "Scan the bin first." };

    const result = await pickScan(order.partnerId, order.orderRef, bin.id, code, qty);
    if (result.ok) {
      applyPicked(result);
      setBin((b) =>
        b && b.holds ? { ...b, holds: { ...b.holds, quantity: Math.max(0, b.holds.quantity - qty) } } : b,
      );
      if (result.complete) {
        setStatus("Packed");
        // Scanner input counts as a key press, but after the server round trip
        // the browser may block the pop-up; the button below always works.
        printLabel();
      }
    }
    return result;
  }

  async function undo(productId: string) {
    const result = await pickUndo(order.partnerId, order.orderRef, productId);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    setLines((prev) => {
      let done = false;
      return [...prev].reverse().map((l) => {
        if (done || l.product_id !== productId || l.picked === 0) return l;
        done = true;
        return { ...l, picked: l.picked - 1 };
      }).reverse();
    });
  }

  const nextLine = lines.find((l) => l.picked < l.quantity);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/fc/picking"
            className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline"
          >
            <ArrowLeft className="size-3.5" />
            Pick list
          </Link>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold text-navy">
            Pick <span className="font-mono">{order.orderRef}</span>
            <OrderStatusBadge status={status} />
          </h1>
          <p className="mt-1 text-sm text-graphite">
            {order.customerName} · {order.merchantName} · {order.rider} · {order.location} ·{" "}
            {formatDate(order.placedAt)}
          </p>
        </div>
        <div className="text-right">
          <div className="font-mono text-3xl font-bold text-navy tabular-nums">
            {picked}/{units}
          </div>
          <div className="text-xs text-graphite">items picked</div>
        </div>
      </div>

      {status === "Reserved" ? (
        <div className="flex flex-col items-start gap-4 rounded-2xl bg-navy p-6 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xl font-bold">Ready to pick</p>
            <p className="mt-1 text-sm text-white/75">
              Starting locks the order: the merchant can no longer edit or cancel it.
            </p>
          </div>
          <Button size="xl" onClick={start} disabled={starting}>
            <PlayCircle />
            {starting ? "Starting" : "Start picking"}
          </Button>
        </div>
      ) : null}

      {status === "Picking" ? (
        <ScanStation
          onScan={handleScan}
          prompt={bin ? `Scan items from bin ${bin.code}, or another bin` : "Scan the bin to pick from"}
          idleTitle={nextLine ? `Go to ${nextLine.bins[0]?.code ?? "a bin"}` : "Scan a bin"}
          idleBody={nextLine ? `First up: ${nextLine.quantity - nextLine.picked} × ${nextLine.name}.` : undefined}
        >
          <div
            className={cn(
              "flex items-center gap-4 rounded-xl border-2 p-4",
              bin ? "border-teal bg-teal/5" : "border-dashed border-stone bg-white",
            )}
          >
            <Archive className={cn("size-8 shrink-0", bin ? "text-teal" : "text-mist")} />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-[0.1em] text-graphite">Current bin</div>
              {bin ? (
                <>
                  <div className="font-mono text-2xl font-bold text-navy">{bin.code}</div>
                  <div className="truncate text-sm text-graphite">
                    {bin.holds ? `${bin.holds.quantity} × ${bin.holds.label}` : "Empty"}
                  </div>
                </>
              ) : (
                <div className="text-sm text-mist">None yet</div>
              )}
            </div>
            {bin ? (
              <button
                type="button"
                onClick={() => setBin(null)}
                aria-label="Clear current bin"
                className="flex size-9 items-center justify-center rounded-md text-graphite hover:bg-stone"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        </ScanStation>
      ) : null}

      {status === "Packed" || status === "Dispatched" ? (
        <div className="flex flex-col gap-4 rounded-2xl bg-success p-6 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <CheckCircle2 className="size-12 shrink-0" />
            <div>
              <p className="text-xl font-bold">{status === "Packed" ? "Picked. Pack it and stick the label on." : "Already dispatched."}</p>
              <p className="mt-1 font-mono text-sm text-white/85">{packageCode}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button size="xl" onClick={printLabel} className="bg-white text-navy hover:bg-white/90">
              <Printer />
              Print package label
            </Button>
            <Button
              size="xl"
              variant="outline"
              onClick={() => router.push("/fc/picking")}
              className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              Next order
              <ArrowRight />
            </Button>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-stone bg-card">
        <div className="border-b border-stone px-4 py-3 text-sm font-semibold text-navy">Pick list</div>
        <ul className="divide-y divide-stone">
          {lines.map((l) => {
            const done = l.picked >= l.quantity;
            return (
              <li key={l.id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3", done && "bg-success/5")}>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-navy">{l.name}</div>
                  <div className="font-mono text-[11px] text-mist">{l.barcode}</div>
                </div>
                <div className="text-xs text-graphite">
                  {l.bins.length === 0 ? (
                    <span className="font-semibold text-destructive">Not in any bin. Put it away first.</span>
                  ) : (
                    <>
                      From{" "}
                      {l.bins.map((b, i) => (
                        <span key={b.code}>
                          {i > 0 ? ", " : ""}
                          <span className="font-mono font-semibold text-navy">{b.code}</span> ({b.quantity})
                        </span>
                      ))}
                    </>
                  )}
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 font-mono text-sm font-semibold tabular-nums",
                    done ? "bg-success/15 text-success" : "bg-stone text-navy",
                  )}
                >
                  {l.picked}/{l.quantity}
                </span>
                {status === "Picking" && l.picked > 0 && l.product_id ? (
                  <button
                    type="button"
                    onClick={() => void undo(l.product_id as string)}
                    title="Take back one picked by mistake"
                    aria-label={`Take back one ${l.name}`}
                    className="flex size-8 items-center justify-center rounded-md border border-stone text-graphite hover:border-destructive hover:text-destructive"
                  >
                    <Minus className="size-4" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
