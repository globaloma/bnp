"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { Download, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import type { WarehouseLocation } from "@/types/db";
import { naira } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { saveDispatchZone, switchOffCarrier, uploadRateCard } from "./actions";

export type ZoneRow = {
  id: string;
  hub: WarehouseLocation;
  name: string;
  coverage: string | null;
  rate: number;
  note: string | null;
  active: boolean;
};

export type RateCardRow = {
  id: string;
  carrier: string;
  origin_hub: string;
  destination_zone: string;
  weight_min_kg: number;
  weight_max_kg: number;
  rate: number;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
};

const fieldClass =
  "h-9 w-full rounded-md border border-stone bg-white px-2.5 text-sm text-navy outline-none focus:border-teal focus:ring-2 focus:ring-teal/20";

export function DispatchZones({ zones }: { zones: ZoneRow[] }) {
  const [adding, setAdding] = useState<WarehouseLocation | null>(null);
  const hubs: WarehouseLocation[] = ["Abuja", "Lagos"];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {hubs.map((hub) => (
        <div key={hub} className="rounded-lg border border-stone bg-card">
          <div className="flex items-center justify-between border-b border-stone px-4 py-2.5">
            <span className="font-semibold text-navy">{hub}</span>
            <button
              type="button"
              onClick={() => setAdding(hub)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline"
            >
              <Plus className="size-3.5" /> Add zone
            </button>
          </div>
          <div className="divide-y divide-stone">
            {zones
              .filter((z) => z.hub === hub)
              .map((z) => (
                <ZoneEditor key={z.id} zone={z} />
              ))}
            {adding === hub ? (
              <ZoneEditor
                zone={{ id: "", hub, name: "", coverage: "", rate: 0, note: "", active: true }}
                startOpen
                onClose={() => setAdding(null)}
              />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function ZoneEditor({ zone, startOpen = false, onClose }: { zone: ZoneRow; startOpen?: boolean; onClose?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(startOpen);
  const [draft, setDraft] = useState({
    name: zone.name,
    coverage: zone.coverage ?? "",
    rate: String(zone.rate),
    note: zone.note ?? "",
    active: zone.active,
  });
  const [pending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    onClose?.();
  }

  function save(active = draft.active) {
    startTransition(async () => {
      const result = await saveDispatchZone({
        id: zone.id || undefined,
        hub: zone.hub,
        name: draft.name,
        coverage: draft.coverage,
        rate: draft.rate,
        note: draft.note,
        active,
      });
      if (result.ok) {
        toast.success(zone.id ? "Zone saved." : "Zone added.");
        close();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  if (!open) {
    return (
      <div className={cn("flex items-start justify-between gap-3 px-4 py-3", !zone.active && "opacity-50")}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-navy">{zone.name}</span>
            {!zone.active ? (
              <span className="rounded-full bg-stone px-2 py-0.5 text-[10px] font-semibold text-graphite">Off</span>
            ) : null}
          </div>
          <div className="text-xs text-graphite">{zone.coverage}</div>
          {zone.note ? <div className="text-[11px] text-mist">{zone.note}</div> : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="font-semibold tabular-nums text-navy">{naira(zone.rate)}</span>
          <button type="button" onClick={() => setOpen(true)} className="text-xs font-semibold text-teal-700 hover:underline">
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-2 bg-stone/20 px-4 py-3 sm:grid-cols-[1fr_8rem]">
      <input
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        placeholder="Zone name, e.g. Abuja Zone 4"
        className={fieldClass}
      />
      <input
        value={draft.rate}
        onChange={(e) => setDraft({ ...draft, rate: e.target.value.replace(/[^0-9.]/g, "") })}
        inputMode="decimal"
        placeholder="Rate (₦)"
        className={fieldClass}
      />
      <input
        value={draft.coverage}
        onChange={(e) => setDraft({ ...draft, coverage: e.target.value })}
        placeholder="Areas covered"
        className={cn(fieldClass, "sm:col-span-2")}
      />
      <input
        value={draft.note}
        onChange={(e) => setDraft({ ...draft, note: e.target.value })}
        placeholder="Note shown to merchants (optional), e.g. Next day"
        className={cn(fieldClass, "sm:col-span-2")}
      />
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        <Button size="sm" onClick={() => save()} disabled={pending || !draft.name.trim() || draft.rate === ""}>
          Save
        </Button>
        <Button size="sm" variant="outline" onClick={close} disabled={pending}>
          Cancel
        </Button>
        {zone.id ? (
          <button
            type="button"
            onClick={() => save(!zone.active)}
            disabled={pending}
            className="ml-auto text-xs font-semibold text-graphite hover:underline"
          >
            {zone.active ? "Switch this zone off" : "Switch this zone on"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

const TEMPLATE =
  "origin_hub,destination_zone,weight_min_kg,weight_max_kg,rate_ngn,effective_from,effective_to\n" +
  "Abuja,South-West Nigeria,0,5,8500,2026-11-01,\n" +
  "Abuja,South-West Nigeria,5,10,12500,2026-11-01,\n";

export function CarrierRates({ carrier, rows }: { carrier: "UPS" | "GIG"; rows: RateCardRow[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const zones = new Set(rows.map((r) => `${r.origin_hub}|${r.destination_zone}`));

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([TEMPLATE], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${carrier.toLowerCase()}-rate-card-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onFile(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (parsed) => {
        startTransition(async () => {
          const result = await uploadRateCard(carrier, parsed.data);
          if (result.ok) {
            toast.success(result.message ?? "Rates uploaded.");
            router.refresh();
          } else {
            toast.error(result.error);
          }
          if (fileRef.current) fileRef.current.value = "";
        });
      },
    });
  }

  function switchOff() {
    startTransition(async () => {
      const result = await switchOffCarrier(carrier);
      if (result.ok) {
        toast.success(result.message ?? "Done.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="rounded-lg border border-stone bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone px-4 py-3">
        <div>
          <div className="font-semibold text-navy">{carrier === "GIG" ? "GIG Logistics" : "UPS"} rate card</div>
          <div className="text-xs text-graphite">
            {rows.length === 0
              ? "No live rates, so merchants and customers don't see this option."
              : `${rows.length} rates across ${zones.size} destination${zones.size === 1 ? "" : "s"}`}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={downloadTemplate}>
            <Download className="size-4" /> Template
          </Button>
          <Button size="sm" onClick={() => fileRef.current?.click()} disabled={pending}>
            <Upload className="size-4" /> {pending ? "Uploading" : "Upload CSV"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
        </div>
      </div>
      <p className="border-b border-stone px-4 py-2 text-[11px] text-mist">
        Uploading replaces all live {carrier} rates. Put BNP&apos;s final price (with the buffer already added) in rate_ngn.
        Weight bands include the minimum and stop just before the maximum.
      </p>
      {rows.length > 0 ? (
        <>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-stone text-left text-[11px] uppercase tracking-[0.08em] text-mist">
                  <th className="px-4 py-2 font-semibold">From</th>
                  <th className="px-4 py-2 font-semibold">To</th>
                  <th className="px-4 py-2 text-right font-semibold">Weight (kg)</th>
                  <th className="px-4 py-2 text-right font-semibold">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-1.5 text-graphite">{r.origin_hub}</td>
                    <td className="px-4 py-1.5 text-navy">{r.destination_zone}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums text-graphite">
                      {r.weight_min_kg} to {r.weight_max_kg}
                    </td>
                    <td className="px-4 py-1.5 text-right font-semibold tabular-nums text-navy">{naira(r.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-stone px-4 py-2 text-right">
            <button type="button" onClick={switchOff} disabled={pending} className="text-xs font-semibold text-destructive hover:underline">
              Stop offering {carrier}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
