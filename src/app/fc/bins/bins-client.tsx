"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Archive, Printer } from "lucide-react";
import { toast } from "sonner";
import { LOCATIONS, type WarehouseLocation } from "@/types/db";
import type { ActionResult } from "@/lib/schemas/order";
import { cn } from "@/lib/utils";
import { submitWithoutReset } from "@/lib/submit-without-reset";
import { Button } from "@/components/ui/button";
import { EmptyState, Panel } from "@/components/dashboard/ui";
import { PrintLabelsDialog, type PrintableLabel } from "@/components/dashboard/print-labels-dialog";
import { createBin, setBinActive } from "./actions";

export type BinRow = {
  id: string;
  location: WarehouseLocation;
  code: string;
  barcode: string;
  active: boolean;
  created_at: string;
  contents: { label: string; sku: string | null; quantity: number } | null;
};

const fieldClass =
  "h-10 w-full rounded-md border border-stone bg-white px-3 text-sm text-navy outline-none focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/25";
const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-graphite";

function binLabel(bin: BinRow): PrintableLabel {
  return { barcode: bin.barcode, heading: bin.code, details: [`${bin.location} warehouse`] };
}

export function BinsClient({ bins }: { bins: BinRow[] }) {
  const [location, setLocation] = useState<"All" | WarehouseLocation>("All");
  const visible = useMemo(
    () => bins.filter((b) => location === "All" || b.location === location),
    [bins, location],
  );
  const printable = visible.filter((b) => b.active);

  return (
    <div className="flex flex-col gap-6">
      <AddBinForm />

      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {(["All", ...LOCATIONS] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLocation(l)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                location === l
                  ? "border-navy bg-navy text-white"
                  : "border-stone bg-card text-graphite hover:border-teal/40",
              )}
            >
              {l}
              {l === "All" ? ` (${bins.length})` : ` (${bins.filter((b) => b.location === l).length})`}
            </button>
          ))}
          {printable.length > 0 ? (
            <PrintLabelsDialog
              title={`Print ${printable.length} bin label${printable.length === 1 ? "" : "s"}`}
              labels={printable.map(binLabel)}
              fileName="bin-labels.pdf"
              trigger={<Button variant="outline" size="lg" className="ml-auto" />}
            >
              <Printer className="size-4" />
              Print {location === "All" ? "all" : location} labels
            </PrintLabelsDialog>
          ) : null}
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={<Archive className="size-8" />}
            title="No bins yet"
            body="Add the shelf spots in your warehouse, e.g. B-02-03 for aisle B, rack 02, shelf 03."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((b) => (
              <BinCard key={b.id} bin={b} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AddBinForm() {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (prev, formData) => {
      const result = await createBin(prev, formData);
      if (result.ok) toast.success(`Bin ${String(formData.get("code")).toUpperCase()} added`);
      else if (!result.fieldErrors) toast.error(result.error);
      return result;
    },
    null,
  );
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <Panel accent="teal">
      <h2 className="text-base font-semibold text-navy">Add a bin</h2>
      <form
        onSubmit={submitWithoutReset(formAction)}
        className="mt-4 grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end"
      >
        <div>
          <label className={labelClass} htmlFor="bin-location">
            Warehouse
          </label>
          <select id="bin-location" name="location" defaultValue="Abuja" className={cn(fieldClass, "appearance-none")}>
            {LOCATIONS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="bin-code">
            Bin code
          </label>
          <input
            id="bin-code"
            name="code"
            required
            maxLength={20}
            placeholder="B-02-03"
            autoCapitalize="characters"
            className={cn(fieldClass, "font-mono uppercase")}
          />
          {errors?.code ? <p className="mt-1 text-xs text-destructive">{errors.code[0]}</p> : null}
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding" : "Add bin"}
        </Button>
      </form>
    </Panel>
  );
}

function BinCard({ bin }: { bin: BinRow }) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const result = await setBinActive(bin.id, !bin.active);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-stone bg-card p-4 shadow-sm",
        !bin.active && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-mono text-lg font-semibold text-navy">{bin.code}</div>
          <div className="text-[11px] text-mist">{bin.location}</div>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
            bin.active ? "bg-success/10 text-success" : "bg-stone text-graphite",
          )}
        >
          {bin.active ? "Active" : "Inactive"}
        </span>
      </div>
      <div className="mt-2 font-mono text-[11px] text-graphite">Barcode {bin.barcode}</div>
      <div className="mt-2 text-xs text-graphite">
        {bin.contents ? (
          <>
            <span className="font-semibold text-navy">{bin.contents.quantity}</span> ×{" "}
            {bin.contents.label}
          </>
        ) : (
          <span className="text-mist">Empty</span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-4">
        <PrintLabelsDialog
          title={`Print label for ${bin.code}`}
          labels={[binLabel(bin)]}
          fileName={`bin-${bin.code}.pdf`}
          trigger={
            <button
              type="button"
              className="flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:underline"
            />
          }
        >
          <Printer className="size-3" />
          Print label
        </PrintLabelsDialog>
        <button
          type="button"
          onClick={toggle}
          disabled={pending || (bin.active && bin.contents !== null && bin.contents.quantity > 0)}
          title={
            bin.active && bin.contents && bin.contents.quantity > 0
              ? "Empty the bin before switching it off"
              : undefined
          }
          className="text-[11px] font-semibold text-teal-700 hover:underline disabled:cursor-not-allowed disabled:text-mist disabled:no-underline"
        >
          {bin.active ? "Switch off" : "Switch on"}
        </button>
      </div>
    </div>
  );
}
