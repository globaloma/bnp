"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type MovementRow = {
  id: number;
  movement: string;
  change: number;
  allocatedChange: number;
  after: number;
  ref: string | null;
  note: string | null;
  bins: string | null;
  by: string;
  at: string;
  product: string;
  barcode: string | null;
  location: string;
  merchant: string;
};

const TYPES = ["All", "receive", "putaway", "reserve", "release", "pick", "dispatch", "return", "adjustment"] as const;

const LABEL: Record<string, string> = {
  receive: "Received",
  putaway: "Put away",
  reserve: "Reserved",
  release: "Released",
  pick: "Picked",
  dispatch: "Dispatched",
  return: "Returned",
  adjustment: "Adjusted",
};

function when(at: string) {
  return new Date(at).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function StockLogClient({ movements }: { movements: MovementRow[] }) {
  const [type, setType] = useState<(typeof TYPES)[number]>("All");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return movements.filter(
      (m) =>
        (type === "All" || m.movement === type) &&
        (!q ||
          `${m.product} ${m.barcode ?? ""} ${m.merchant} ${m.ref ?? ""} ${m.by} ${m.bins ?? ""}`.toLowerCase().includes(q)),
    );
  }, [movements, type, query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                type === t ? "border-navy bg-navy text-white" : "border-stone bg-card text-graphite hover:border-teal/40",
              )}
            >
              {t === "All" ? "All" : LABEL[t]}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-mist" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Product, order, bin or person"
            className="h-9 w-64 rounded-md border border-stone bg-card pr-2.5 pl-8 text-xs text-navy outline-none focus-visible:border-teal"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-stone bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone text-left text-[11px] uppercase tracking-[0.08em] text-mist">
              <th className="px-4 py-2.5 font-semibold">When</th>
              <th className="px-4 py-2.5 font-semibold">What</th>
              <th className="px-4 py-2.5 font-semibold">Product</th>
              <th className="px-4 py-2.5 text-right font-semibold">On hand</th>
              <th className="px-4 py-2.5 font-semibold">Details</th>
              <th className="px-4 py-2.5 font-semibold">By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-mist">
                  No movements match.
                </td>
              </tr>
            ) : (
              visible.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-xs text-graphite">{when(m.at)}</td>
                  <td className="px-4 py-2.5 text-xs font-semibold whitespace-nowrap text-navy">
                    {LABEL[m.movement] ?? m.movement}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-navy">{m.product}</div>
                    <div className="text-[11px] text-mist">
                      {m.merchant} · {m.location}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums">
                    {m.change !== 0 ? (
                      <span className={cn("font-semibold", m.change > 0 ? "text-success" : "text-destructive")}>
                        {m.change > 0 ? "+" : ""}
                        {m.change}
                      </span>
                    ) : (
                      <span className="text-mist">0</span>
                    )}
                    <span className="text-xs text-mist"> → {m.after}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-graphite">
                    {[m.ref, m.bins, m.note].filter(Boolean).join(" · ")}
                  </td>
                  <td className="px-4 py-2.5 text-xs whitespace-nowrap text-graphite">{m.by}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-mist">Showing the latest {movements.length} movements.</p>
    </div>
  );
}
