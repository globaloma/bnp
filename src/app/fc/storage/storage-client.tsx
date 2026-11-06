"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { naira } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { setStorageSpace } from "./actions";

export type StorageRow = {
  id: string;
  name: string;
  plan: "standard" | "enterprise";
  active: boolean;
  sqm: number;
  crates: number;
  pallets: number;
  palletHeight: number;
  units: number;
  bins: number;
};

export type StorageRates = {
  storageRate: number;
  crateM2: number;
  palletM2: number;
  palletRefHeightM: number;
};

/** Mirror of set_storage_space() in SQL, so the FC sees the m² before saving. */
function deriveSqm(crates: number, pallets: number, height: number, r: StorageRates): number {
  const mult = height <= 0 ? 1 : Math.max(1, Math.round((height / r.palletRefHeightM) * 100) / 100);
  return Math.round((crates * r.crateM2 + pallets * r.palletM2 * mult) * 100) / 100;
}

const numClass =
  "h-9 w-16 rounded-md border border-stone bg-white px-2 text-right text-sm font-semibold text-navy outline-none focus-visible:border-teal";

export function StorageClient({ rows, rates }: { rows: StorageRow[]; rates: StorageRates }) {
  const totalSqm = rows.reduce((s, r) => s + r.sqm, 0);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-graphite">
        <span className="font-semibold text-navy">{Math.round(totalSqm * 100) / 100} m²</span> in use across{" "}
        {rows.length} merchant{rows.length === 1 ? "" : "s"}, {naira(totalSqm * rates.storageRate)} a month in storage.
      </p>
      <p className="text-xs text-mist">
        A crate counts as {rates.crateM2} m². A pallet counts as {rates.palletM2} m² per {rates.palletRefHeightM} m of
        stack height (taller stacks count for more).
      </p>
      <div className="overflow-x-auto rounded-lg border border-stone bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone text-left text-[11px] uppercase tracking-[0.08em] text-mist">
              <th className="px-4 py-2.5 font-semibold">Merchant</th>
              <th className="px-3 py-2.5 text-right font-semibold">Units</th>
              <th className="px-3 py-2.5 text-right font-semibold">Bins</th>
              <th className="px-3 py-2.5 text-center font-semibold">Crates</th>
              <th className="px-3 py-2.5 text-center font-semibold">Pallets</th>
              <th className="px-3 py-2.5 text-center font-semibold">Stack m</th>
              <th className="px-3 py-2.5 text-right font-semibold">Space (m²)</th>
              <th className="px-4 py-2.5 text-right font-semibold">Storage a month</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone">
            {rows.map((r) => (
              <Row key={r.id} row={r} rates={rates} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ row, rates }: { row: StorageRow; rates: StorageRates }) {
  const [crates, setCrates] = useState(String(row.crates));
  const [pallets, setPallets] = useState(String(row.pallets));
  const [height, setHeight] = useState(String(row.palletHeight));
  const [saved, setSaved] = useState({ crates: row.crates, pallets: row.pallets, height: row.palletHeight });
  const [pending, startTransition] = useTransition();

  const c = Math.max(0, Math.floor(Number(crates) || 0));
  const p = Math.max(0, Math.floor(Number(pallets) || 0));
  const h = Math.max(0, Number(height) || 0);
  const sqm = deriveSqm(c, p, h, rates);
  const dirty = c !== saved.crates || p !== saved.pallets || h !== saved.height;

  function save() {
    startTransition(async () => {
      const result = await setStorageSpace(row.id, c, p, h);
      if (result.ok) {
        setSaved({ crates: c, pallets: p, height: h });
        toast.success(`${row.name}: ${result.sqm} m²`);
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
      <td className="px-3 py-2.5 text-right tabular-nums">{row.units}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{row.bins}</td>
      <td className="px-3 py-2.5 text-center">
        <input
          value={crates}
          onChange={(e) => setCrates(e.target.value.replace(/[^0-9]/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && dirty && save()}
          inputMode="numeric"
          aria-label={`Crates for ${row.name}`}
          className={numClass}
        />
      </td>
      <td className="px-3 py-2.5 text-center">
        <input
          value={pallets}
          onChange={(e) => setPallets(e.target.value.replace(/[^0-9]/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && dirty && save()}
          inputMode="numeric"
          aria-label={`Pallets for ${row.name}`}
          className={numClass}
        />
      </td>
      <td className="px-3 py-2.5 text-center">
        <input
          value={height}
          onChange={(e) => setHeight(e.target.value.replace(/[^0-9.]/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && dirty && save()}
          inputMode="decimal"
          aria-label={`Pallet stack height in metres for ${row.name}`}
          className={numClass}
        />
      </td>
      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-navy">{sqm}</td>
      <td className="px-4 py-2.5 text-right">
        <div className="flex items-center justify-end gap-2">
          <span className="font-semibold tabular-nums text-navy">{naira(sqm * rates.storageRate)}</span>
          {dirty ? (
            <Button size="sm" onClick={save} disabled={pending}>
              {pending ? "Saving" : "Save"}
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
