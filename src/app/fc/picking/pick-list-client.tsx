"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, PackageCheck } from "lucide-react";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useWarehouseLocation, WarehousePicker } from "@/components/warehouse/warehouse-picker";
import { getPickList, type PickListRow } from "./actions";

export function PickListClient() {
  const [location, setLocation] = useWarehouseLocation();
  const [rows, setRows] = useState<{ location: string; list: PickListRow[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPickList(location).then((list) => {
      if (!cancelled) setRows({ location, list });
    });
    return () => {
      cancelled = true;
    };
  }, [location]);

  const list = rows && rows.location === location ? rows.list : null;
  const inProgress = list?.filter((r) => r.status === "Picking") ?? [];
  const waiting = list?.filter((r) => r.status === "Reserved") ?? [];

  return (
    <div className="flex flex-col gap-6">
      <WarehousePicker value={location} onChange={setLocation} />

      {list === null ? (
        <p className="text-sm text-mist">Loading…</p>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-stone bg-card px-4 py-12 text-center">
          <PackageCheck className="size-9 text-success" />
          <p className="font-semibold text-navy">Nothing to pick in {location}</p>
          <p className="text-sm text-graphite">Paid orders appear here as soon as they come in.</p>
        </div>
      ) : (
        <>
          {inProgress.length > 0 ? <PickGroup title="Being picked" rows={inProgress} /> : null}
          {waiting.length > 0 ? <PickGroup title="Waiting to be picked" rows={waiting} /> : null}
        </>
      )}
    </div>
  );
}

function PickGroup({ title, rows }: { title: string; rows: PickListRow[] }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-graphite">
        {title} ({rows.length})
      </h2>
      <div className="overflow-hidden rounded-lg border border-stone bg-card">
        <ul className="divide-y divide-stone">
          {rows.map((r) => {
            const started = r.status === "Picking";
            return (
              <li key={r.order_id}>
                <Link
                  href={`/fc/picking/${r.order_id}`}
                  className="group flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3.5 hover:bg-cream/60"
                >
                  <span className="font-mono text-sm font-semibold text-navy">{r.order_ref}</span>
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="font-semibold text-navy">{r.customer}</span>
                    <span className="text-graphite"> · {r.merchant}</span>
                  </span>
                  <span className="text-xs text-graphite">
                    {r.units} item{r.units === 1 ? "" : "s"} · {r.rider} · {formatDate(r.placed_at)}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                      started ? "bg-gold text-navy" : "bg-gold/15 text-gold-300",
                    )}
                  >
                    {started ? `${r.picked}/${r.units} picked` : "Ready"}
                  </span>
                  <ArrowRight className="size-4 text-teal-700 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
