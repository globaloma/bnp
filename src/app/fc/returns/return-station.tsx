"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import type { ScanResult, WarehouseLocation } from "@/types/db";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScanStation } from "@/components/warehouse/scan-station";
import { lookupReturn, requestAdjustment, returnScan, type ReturnLine } from "../stock/actions";

export type QuarantineItem = {
  id: string;
  label: string;
  barcode: string | null;
  location: WarehouseLocation;
  merchant: string;
  quarantined: number;
  /** Units already in a request waiting for a supervisor. */
  pending: number;
};

// Package labels look like BOXN-ORD-7KQ2MX; order numbers like ORD-7KQ2MX.
const PACKAGE = /(^|-)ORD-/i;

export function ReturnStation({ quarantine }: { quarantine: QuarantineItem[] }) {
  const [lines, setLines] = useState<ReturnLine[] | null>(null);
  const [damaged, setDamaged] = useState(false);

  async function handleScan(code: string, qty: number): Promise<ScanResult> {
    if (PACKAGE.test(code.trim())) {
      const found = await lookupReturn(code);
      if (!found.ok) return { ok: false, tone: "error", message: found.message };
      setLines(found.lines);
      setDamaged(false);
      return {
        ok: true,
        tone: "success",
        message: `${found.lines[0].order_ref} from ${found.lines[0].customer}. Inspect and scan each item.`,
      };
    }
    if (!lines) return { ok: false, tone: "error", message: "Scan the package label first." };

    const first = lines[0];
    const result = await returnScan(first.partner_id, first.order_ref, code, damaged, qty);
    if (result.ok) {
      setLines((prev) =>
        prev
          ? prev.map((l) =>
              result.order_id === l.order_id
                ? { ...l, returned: result.returned ?? l.returned, damaged: result.damaged ?? l.damaged }
                : l,
            )
          : prev,
      );
    }
    return result;
  }

  const back = lines?.reduce((s, l) => s + l.returned + l.damaged, 0) ?? 0;
  const total = lines?.reduce((s, l) => s + l.quantity, 0) ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <ScanStation
          onScan={handleScan}
          prompt={lines ? "Scan each item, or another package label" : "Scan the package label"}
          idleTitle="Scan a returned parcel"
          idleBody="Start with the package label on the parcel."
        >
          <div className="grid grid-cols-2 gap-3" role="group" aria-label="Condition of the next item">
            <button
              type="button"
              onClick={() => setDamaged(false)}
              aria-pressed={!damaged}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl border-2 py-4 text-base font-bold transition-colors",
                !damaged ? "border-success bg-success text-white" : "border-stone bg-white text-graphite",
              )}
            >
              <CheckCircle2 className="size-5" />
              Good, back to stock
            </button>
            <button
              type="button"
              onClick={() => setDamaged(true)}
              aria-pressed={damaged}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl border-2 py-4 text-base font-bold transition-colors",
                damaged ? "border-destructive bg-destructive text-white" : "border-stone bg-white text-graphite",
              )}
            >
              <ShieldAlert className="size-5" />
              Damaged, quarantine
            </button>
          </div>
        </ScanStation>

        <div className="overflow-hidden rounded-lg border border-stone bg-card xl:self-start">
          <div className="flex items-center justify-between gap-2 border-b border-stone px-4 py-3">
            <h2 className="text-sm font-semibold text-navy">
              {lines ? `Order ${lines[0].order_ref}` : "Returned parcel"}
            </h2>
            {lines ? (
              <span className="text-sm text-graphite">
                <span className="font-semibold text-navy">{back}</span> of {total} back
              </span>
            ) : null}
          </div>
          {!lines ? (
            <p className="px-4 py-6 text-sm text-mist">Scan a package label to see what should be inside.</p>
          ) : (
            <>
              <p className="border-b border-stone px-4 py-2 text-xs text-graphite">
                {lines[0].customer} · {lines[0].merchant}
              </p>
              <ul className="divide-y divide-stone">
                {lines.map((l) => (
                  <li key={l.order_id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-navy">{l.product}</div>
                      <div className="font-mono text-[11px] text-mist">{l.barcode}</div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-mono text-sm font-semibold text-navy">
                        {l.returned + l.damaged}/{l.quantity}
                      </div>
                      {l.damaged > 0 ? <div className="font-semibold text-destructive">{l.damaged} damaged</div> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <QuarantineList items={quarantine} />
    </div>
  );
}

function QuarantineList({ items }: { items: QuarantineItem[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-stone bg-card">
      <div className="border-b border-stone px-4 py-3">
        <h2 className="text-sm font-semibold text-navy">Quarantine</h2>
        <p className="text-xs text-graphite">
          Damaged returns, kept apart from stock. Ask a supervisor to put them back or write them off.
        </p>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-5 text-sm text-mist">Nothing in quarantine.</p>
      ) : (
        <ul className="divide-y divide-stone">
          {items.map((item) => (
            <QuarantineRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

function QuarantineRow({ item }: { item: QuarantineItem }) {
  const [mode, setMode] = useState<"stock" | "writeoff" | null>(null);
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const free = item.quarantined - item.pending;

  function send() {
    startTransition(async () => {
      const result = await requestAdjustment({
        productId: item.id,
        change: -qty,
        reason: reason || (mode === "stock" ? "Inspected, fit to sell" : "Damaged beyond sale"),
        kind: "quarantine",
        toStock: mode === "stock",
      });
      if (result.ok) {
        toast.success(result.message);
        setMode(null);
        setReason("");
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-navy">{item.label}</div>
          <div className="text-[11px] text-mist">
            {item.merchant} · {item.location} · <span className="font-mono">{item.barcode}</span>
          </div>
        </div>
        <span className="font-mono text-lg font-semibold text-destructive tabular-nums">{item.quarantined}</span>
        {item.pending > 0 ? (
          <span className="rounded-full bg-gold/15 px-2.5 py-0.5 text-[11px] font-semibold text-gold-300">
            {item.pending} waiting for a supervisor
          </span>
        ) : null}
        {free > 0 && mode === null ? (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setMode("stock")}>
              Back to stock
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMode("writeoff")}>
              Write off
            </Button>
          </div>
        ) : null}
      </div>
      {mode ? (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md bg-cream/60 p-3">
          <label className="text-xs font-semibold text-graphite">
            Units
            <input
              type="number"
              min={1}
              max={free}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Math.min(free, Math.floor(Number(e.target.value) || 1))))}
              className="mt-1 block h-9 w-20 rounded-md border border-stone bg-white px-2 text-sm text-navy"
            />
          </label>
          <label className="min-w-48 flex-1 text-xs font-semibold text-graphite">
            Reason
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              placeholder={mode === "stock" ? "e.g. packaging only, item is fine" : "e.g. screen cracked"}
              className="mt-1 block h-9 w-full rounded-md border border-stone bg-white px-2 text-sm text-navy"
            />
          </label>
          <Button size="sm" onClick={send} disabled={pending}>
            {mode === "stock" ? "Ask to restock" : "Ask to write off"}
          </Button>
          <button
            type="button"
            onClick={() => setMode(null)}
            aria-label="Cancel"
            className="flex size-8 items-center justify-center rounded-md text-graphite hover:bg-stone"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}
    </li>
  );
}
