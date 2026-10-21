"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ClipboardCheck, X } from "lucide-react";
import type { ScanResult } from "@/types/db";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScanStation } from "@/components/warehouse/scan-station";
import { useWarehouseLocation, WarehousePicker } from "@/components/warehouse/warehouse-picker";
import { checkCountItem, findCountBin, submitCount, type CountBin } from "../stock/actions";

export type RecentCount = {
  id: string;
  bin: string;
  location: string;
  product: string;
  expected: number;
  counted: number;
  at: string;
  by: string;
  status: string;
};

const STATUS_STYLE: Record<string, string> = {
  matched: "bg-success/10 text-success",
  approved: "bg-teal/10 text-teal-700",
  pending: "bg-gold/15 text-gold-300",
  rejected: "bg-stone text-graphite",
};

export function CountStation({ recent }: { recent: RecentCount[] }) {
  const router = useRouter();
  const [location, setLocation] = useWarehouseLocation();
  const [bin, setBin] = useState<CountBin | null>(null);
  const [counted, setCounted] = useState(0);
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState<ScanResult | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setBin(null);
    setCounted(0);
    setNote("");
  }

  async function handleScan(code: string, qty: number): Promise<ScanResult> {
    if (code.trim().toUpperCase().startsWith("BIN-")) {
      const found = await findCountBin(code, location);
      if (!found.ok) return { ok: false, tone: "error", message: found.message };
      if (found.bin.pending) {
        return { ok: false, tone: "error", message: `Bin ${found.bin.code} already has a count waiting for a supervisor.` };
      }
      setBin(found.bin);
      setCounted(0);
      setOutcome(null);
      return {
        ok: true,
        tone: "success",
        message: found.bin.product
          ? `Counting ${found.bin.code}: ${found.bin.product.label}. Scan each one.`
          : `Bin ${found.bin.code} should be empty. Finish with 0 if it is.`,
      };
    }
    if (!bin) return { ok: false, tone: "error", message: "Scan a bin label first." };
    if (!bin.product) {
      return { ok: false, tone: "error", message: `Bin ${bin.code} should be empty. Take that item to Putaway.` };
    }
    const matches = await checkCountItem(code, bin.product.id);
    if (!matches) {
      return {
        ok: false,
        tone: "error",
        message: `Wrong item: ${bin.code} should only hold ${bin.product.label}. Set it aside.`,
      };
    }
    const next = counted + qty;
    setCounted(next);
    return { ok: true, tone: "success", message: `${next} counted.` };
  }

  function finish() {
    if (!bin) return;
    startTransition(async () => {
      const result = await submitCount(bin.id, counted, note);
      setOutcome(result);
      if (result.ok) {
        reset();
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <WarehousePicker
        value={location}
        onChange={(l) => {
          reset();
          setLocation(l);
        }}
      />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          {outcome ? (
            <div
              role="status"
              className={cn(
                "rounded-xl p-4 text-base font-semibold",
                outcome.tone === "success" && "bg-success/10 text-success",
                outcome.tone === "warning" && "bg-gold/15 text-navy",
                outcome.tone === "error" && "bg-destructive/10 text-destructive",
              )}
            >
              {outcome.message}
            </div>
          ) : null}

          <ScanStation
            onScan={handleScan}
            prompt={bin ? `Scan each item in ${bin.code}` : "Scan the bin you are counting"}
            idleTitle="Scan a bin to count"
            idleBody="You won't see the expected number, so the count stays honest."
          >
            <div
              className={cn(
                "flex flex-col gap-4 rounded-xl border-2 p-4",
                bin ? "border-teal bg-teal/5" : "border-dashed border-stone bg-white",
              )}
            >
              <div className="flex items-center gap-4">
                <Archive className={cn("size-8 shrink-0", bin ? "text-teal" : "text-mist")} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.1em] text-graphite">Counting</div>
                  {bin ? (
                    <>
                      <div className="font-mono text-2xl font-bold text-navy">{bin.code}</div>
                      <div className="truncate text-sm text-graphite">{bin.product?.label ?? "Should be empty"}</div>
                    </>
                  ) : (
                    <div className="text-sm text-mist">No bin yet</div>
                  )}
                </div>
                {bin ? (
                  <button
                    type="button"
                    onClick={reset}
                    aria-label="Stop counting this bin"
                    className="flex size-9 items-center justify-center rounded-md text-graphite hover:bg-stone"
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>

              {bin ? (
                <div className="flex flex-wrap items-end gap-3 border-t border-teal/20 pt-4">
                  <label className="text-sm font-semibold text-navy">
                    Counted
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={counted}
                      onChange={(e) => setCounted(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                      className="mt-1 block h-12 w-32 rounded-lg border-2 border-navy/20 bg-white text-center font-mono text-2xl text-navy"
                    />
                  </label>
                  <label className="min-w-48 flex-1 text-sm font-semibold text-navy">
                    Note (optional)
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={500}
                      placeholder="e.g. 2 found on the floor below"
                      className="mt-1 block h-12 w-full rounded-lg border border-stone bg-white px-3 text-sm text-navy"
                    />
                  </label>
                  <Button size="xl" onClick={finish} disabled={pending}>
                    <ClipboardCheck />
                    {pending ? "Saving" : "Finish count"}
                  </Button>
                </div>
              ) : null}
            </div>
          </ScanStation>
        </div>

        <div className="overflow-hidden rounded-lg border border-stone bg-card xl:self-start">
          <div className="border-b border-stone px-4 py-3 text-sm font-semibold text-navy">Recent counts</div>
          {recent.length === 0 ? (
            <p className="px-4 py-5 text-sm text-mist">No counts yet.</p>
          ) : (
            <ul className="max-h-[32rem] divide-y divide-stone overflow-y-auto">
              {recent.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">
                      <span className="font-mono font-semibold text-navy">{r.bin}</span>
                      <span className="text-graphite"> · {r.product}</span>
                    </div>
                    <div className="text-[11px] text-mist">
                      {r.by} · {formatDate(r.at)} · expected {r.expected}, counted {r.counted}
                    </div>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize", STATUS_STYLE[r.status] ?? STATUS_STYLE.pending)}>
                    {r.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
