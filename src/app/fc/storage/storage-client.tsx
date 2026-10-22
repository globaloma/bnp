"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { naira } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { setStorageSqm } from "./actions";

export type StorageRow = {
  id: string;
  name: string;
  plan: "standard" | "enterprise";
  active: boolean;
  sqm: number;
  units: number;
  bins: number;
};

export function StorageClient({ rows }: { rows: StorageRow[] }) {
  const total = rows.reduce((s, r) => s + r.sqm, 0);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-graphite">
        <span className="font-semibold text-navy">{total} m²</span> in use across {rows.length} merchant
        {rows.length === 1 ? "" : "s"}, {naira(total * 10000)} a month in storage.
      </p>
      <div className="overflow-x-auto rounded-lg border border-stone bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone text-left text-[11px] uppercase tracking-[0.08em] text-mist">
              <th className="px-4 py-2.5 font-semibold">Merchant</th>
              <th className="px-4 py-2.5 text-right font-semibold">Units in stock</th>
              <th className="px-4 py-2.5 text-right font-semibold">Bins used</th>
              <th className="px-4 py-2.5 font-semibold">Floor space</th>
              <th className="px-4 py-2.5 text-right font-semibold">Storage a month</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone">
            {rows.map((r) => (
              <Row key={r.id} row={r} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ row }: { row: StorageRow }) {
  const [value, setValue] = useState(String(row.sqm));
  const [saved, setSaved] = useState(row.sqm);
  const [pending, startTransition] = useTransition();
  const dirty = Number(value) !== saved;

  function save() {
    startTransition(async () => {
      const result = await setStorageSqm(row.id, Number(value));
      if (result.ok) {
        setSaved(Number(value));
        toast.success(`${row.name}: ${value} m²`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <tr className={cn(!row.active && "opacity-60")}>
      <td className="px-4 py-2.5">
        <div className="font-semibold text-navy">{row.name}</div>
        <div className="text-[11px] text-mist">
          {row.plan === "enterprise" ? "Enterprise" : "Standard"}
          {row.active ? "" : " · not active"}
        </div>
      </td>
      <td className="px-4 py-2.5 text-right tabular-nums">{row.units}</td>
      <td className="px-4 py-2.5 text-right tabular-nums">{row.bins}</td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && dirty) save();
            }}
            inputMode="decimal"
            aria-label={`Floor space for ${row.name} in square metres`}
            className="h-9 w-20 rounded-md border border-stone bg-white px-2 text-right text-sm font-semibold text-navy"
          />
          <span className="text-xs text-graphite">m²</span>
          {dirty ? (
            <Button size="sm" onClick={save} disabled={pending}>
              {pending ? "Saving" : "Save"}
            </Button>
          ) : null}
        </div>
      </td>
      <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-navy">{naira(saved * 10000)}</td>
    </tr>
  );
}
