"use client";

import { useCallback, useEffect, useState } from "react";
import { Archive, PackageCheck, X } from "lucide-react";
import type { ScanResult } from "@/types/db";
import { cn } from "@/lib/utils";
import { ScanStation } from "@/components/warehouse/scan-station";
import { useWarehouseLocation, WarehousePicker } from "@/components/warehouse/warehouse-picker";
import { findBin, getPutawayQueue, putawayScan, type BinInfo, type QueueItem } from "./actions";

export function PutawayStation() {
  const [location, setLocation] = useWarehouseLocation();
  const [bin, setBin] = useState<BinInfo | null>(null);
  const [queue, setQueue] = useState<QueueItem[] | null>(null);

  const loadQueue = useCallback(async () => {
    setQueue(await getPutawayQueue(location));
  }, [location]);

  useEffect(() => {
    let cancelled = false;
    getPutawayQueue(location).then((rows) => {
      if (!cancelled) setQueue(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [location]);

  function changeLocation(next: typeof location) {
    setBin(null);
    setQueue(null);
    setLocation(next);
  }

  async function handleScan(code: string, qty: number): Promise<ScanResult> {
    // Bin labels switch the current bin; anything else is an item.
    if (code.trim().toUpperCase().startsWith("BIN-")) {
      const found = await findBin(code, location);
      if (!found.ok) return { ok: false, tone: "error", message: found.message };
      setBin(found.bin);
      return {
        ok: true,
        tone: "success",
        message: found.bin.holds
          ? `Bin ${found.bin.code}: holds ${found.bin.holds.quantity} × ${found.bin.holds.label}. Scan items.`
          : `Bin ${found.bin.code} is empty. Scan items to put in it.`,
      };
    }
    if (!bin) return { ok: false, tone: "error", message: "Scan a bin label first." };

    const result = await putawayScan(bin.id, code, qty);
    if (result.ok) {
      void loadQueue();
      setBin((b) =>
        b ? { ...b, holds: { label: result.label ?? "Item", quantity: result.in_bin ?? 0 } } : b,
      );
    }
    return result;
  }

  const waiting = queue?.reduce((s, q) => s + q.unplaced, 0) ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <WarehousePicker value={location} onChange={changeLocation} />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <ScanStation
          onScan={handleScan}
          prompt={bin ? `Scan items for bin ${bin.code}, or another bin label` : "Scan a bin label to start"}
          idleTitle="Scan a bin"
          idleBody={`Bin labels start with BIN-. You're working in the ${location} warehouse.`}
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

        <div className="overflow-hidden rounded-lg border border-stone bg-card xl:self-start">
          <div className="flex items-center justify-between gap-2 border-b border-stone px-4 py-3">
            <h2 className="text-sm font-semibold text-navy">Waiting to be put away</h2>
            <span className="text-sm text-graphite">
              <span className="font-semibold text-navy">{waiting}</span> units
            </span>
          </div>
          {queue === null ? (
            <p className="px-4 py-6 text-sm text-mist">Loading…</p>
          ) : queue.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <PackageCheck className="size-8 text-success" />
              <p className="text-sm font-semibold text-navy">Everything in {location} is in a bin</p>
            </div>
          ) : (
            <ul className="max-h-[32rem] divide-y divide-stone overflow-y-auto">
              {queue.map((q) => (
                <li key={q.product_id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-navy">
                      {q.name}
                      {q.variant ? <span className="font-normal text-graphite"> · {q.variant}</span> : null}
                    </div>
                    <div className="truncate text-[11px] text-mist">
                      {q.merchant} · <span className="font-mono">{q.barcode}</span>
                    </div>
                    {q.bins.length > 0 ? (
                      <div className="mt-0.5 text-[11px] font-semibold text-teal-700">
                        Already in {q.bins.join(", ")}
                      </div>
                    ) : null}
                  </div>
                  <span className="font-mono text-lg font-semibold text-navy tabular-nums">{q.unplaced}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
