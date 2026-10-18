"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCheck, Minus } from "lucide-react";
import { toast } from "sonner";
import type { InboundDelivery, ScanResult } from "@/types/db";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScanStation } from "@/components/warehouse/scan-station";
import { completeDelivery, receiveScan, receiveUndo } from "../actions";

export type ReceiveLine = {
  product_id: string;
  name: string;
  variant: string | null;
  barcode: string | null;
  expected: number;
  received: number;
};

function lineState(l: ReceiveLine): { label: string; className: string } {
  if (l.expected === 0) return { label: "Not on list", className: "bg-gold/15 text-gold-300" };
  if (l.received === 0) return { label: "Waiting", className: "bg-stone text-graphite" };
  if (l.received < l.expected) return { label: `${l.expected - l.received} to go`, className: "bg-teal/10 text-teal-700" };
  if (l.received === l.expected) return { label: "Complete", className: "bg-success/10 text-success" };
  return { label: `${l.received - l.expected} extra`, className: "bg-gold/15 text-gold-300" };
}

export function ReceiveStation({
  delivery,
  merchantName,
  initialLines,
}: {
  delivery: InboundDelivery;
  merchantName: string;
  initialLines: ReceiveLine[];
}) {
  const router = useRouter();
  const [lines, setLines] = useState(initialLines);
  const [, startTransition] = useTransition();
  const closed = delivery.status === "received" || delivery.status === "cancelled";

  function applyResult(result: ScanResult) {
    if (!result.ok || !result.product_id) return;
    const known = lines.some((l) => l.product_id === result.product_id);
    if (!known) {
      // A product that wasn't on the list: fetch its details from the server.
      startTransition(() => router.refresh());
      return;
    }
    setLines((prev) =>
      prev
        .map((l) =>
          l.product_id === result.product_id
            ? { ...l, received: result.received ?? l.received, expected: result.expected ?? l.expected }
            : l,
        )
        // Taking a not-on-the-list item back to zero removes its line.
        .filter((l) => l.expected > 0 || l.received > 0),
    );
  }

  async function handleScan(code: string, qty: number) {
    const result = await receiveScan(delivery.id, code, qty);
    applyResult(result);
    return result;
  }

  async function undo(productId: string) {
    const result = await receiveUndo(delivery.id, productId);
    if (result.ok) applyResult(result);
    else toast.error(result.message);
  }

  const expected = lines.reduce((s, l) => s + l.expected, 0);
  const received = lines.reduce((s, l) => s + l.received, 0);
  const gaps = lines.filter((l) => l.expected !== l.received);

  // Keep server-provided lines in sync when the page refreshes.
  const [seen, setSeen] = useState(initialLines);
  if (seen !== initialLines) {
    setSeen(initialLines);
    setLines(initialLines);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/fc/receiving"
            className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline"
          >
            <ArrowLeft className="size-3.5" />
            All deliveries
          </Link>
          <h1 className="text-2xl font-semibold text-navy">
            Receiving <span className="font-mono">{delivery.ref}</span>
          </h1>
          <p className="mt-1 text-sm text-graphite">
            {merchantName}, {delivery.location} warehouse
            {delivery.expected_on ? `, due ${formatDate(delivery.expected_on)}` : ""}
            {!delivery.announced ? ", arrived without notice" : ""}
          </p>
          {delivery.note ? <p className="mt-1 text-sm text-mist">&ldquo;{delivery.note}&rdquo;</p> : null}
        </div>
        {!closed ? (
          <FinishDialog
            deliveryId={delivery.id}
            gaps={gaps}
            received={received}
            onDone={() => router.push("/fc/receiving")}
          />
        ) : null}
      </div>

      {closed ? (
        <div className="rounded-lg border border-stone bg-card p-5 text-sm text-graphite">
          This delivery is {delivery.status}
          {delivery.received_at ? ` (${formatDate(delivery.received_at)})` : ""}. No more scans can be added.
        </div>
      ) : (
        <ScanStation
          onScan={handleScan}
          prompt="Scan each item as you unpack it"
          idleTitle="Ready to receive"
          idleBody={`Scan items from ${merchantName}. Use the quantity box to count several identical items at once.`}
        />
      )}

      <div className="overflow-hidden rounded-lg border border-stone bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone px-4 py-3">
          <h2 className="text-sm font-semibold text-navy">What&apos;s in this delivery</h2>
          <span className="text-sm text-graphite">
            <span className="font-semibold text-navy">{received}</span>
            {expected > 0 ? ` of ${expected}` : ""} units counted
          </span>
        </div>
        {lines.length === 0 ? (
          <p className="px-4 py-6 text-sm text-mist">Nothing scanned yet.</p>
        ) : (
          <ul className="divide-y divide-stone">
            {lines.map((l) => {
              const state = lineState(l);
              return (
                <li key={l.product_id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-navy">
                      {l.name}
                      {l.variant ? <span className="font-normal text-graphite"> · {l.variant}</span> : null}
                    </div>
                    <div className="font-mono text-[11px] text-mist">{l.barcode}</div>
                  </div>
                  <span className="font-mono text-lg font-semibold text-navy tabular-nums">
                    {l.received}
                    {l.expected > 0 ? <span className="text-sm text-mist"> / {l.expected}</span> : null}
                  </span>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", state.className)}>
                    {state.label}
                  </span>
                  {!closed && l.received > 0 ? (
                    <button
                      type="button"
                      onClick={() => void undo(l.product_id)}
                      title="Take back one (for a double scan)"
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
        )}
      </div>
    </div>
  );
}

function FinishDialog({
  deliveryId,
  gaps,
  received,
  onDone,
}: {
  deliveryId: string;
  gaps: ReceiveLine[];
  received: number;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function finish() {
    startTransition(async () => {
      const result = await completeDelivery(deliveryId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.gaps > 0
          ? `${result.ref} received. The merchant has been told about ${result.gaps} item${result.gaps === 1 ? "" : "s"} that didn't match.`
          : `${result.ref} received in full. The merchant has been told.`,
      );
      setOpen(false);
      onDone();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="lg" disabled={received === 0} />}>
        <CheckCheck className="size-4" />
        Finish receiving
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Finish receiving?</DialogTitle>
        </DialogHeader>
        {gaps.length === 0 ? (
          <p className="text-sm text-graphite">Everything matches what the merchant announced.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-graphite">
              {gaps.length} item{gaps.length === 1 ? "" : "s"} didn&apos;t match. The merchant will be emailed the
              difference.
            </p>
            <ul className="max-h-60 divide-y divide-stone overflow-y-auto rounded-md border border-stone text-sm">
              {gaps.map((g) => {
                const diff = g.received - g.expected;
                return (
                  <li key={g.product_id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="min-w-0 truncate text-navy">
                      {g.name}
                      {g.variant ? ` (${g.variant})` : ""}
                    </span>
                    <span className="shrink-0 font-semibold text-gold-300">
                      {g.expected === 0 ? "not on list" : diff < 0 ? `${-diff} short` : `${diff} extra`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <p className="text-xs text-mist">
          After this the delivery is closed and the stock is ready to put away.
        </p>
        <Button size="lg" onClick={finish} disabled={pending}>
          {pending ? "Finishing" : "Finish and tell the merchant"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
