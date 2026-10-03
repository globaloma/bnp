"use client";

import { useState, useTransition } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { saveDeliveryZones } from "@/app/dashboard/inventory/actions";
import type { DeliveryZone } from "@/types/db";

const fieldClass =
  "h-10 w-full rounded-md border border-stone bg-white px-3 text-sm text-navy outline-none transition-colors placeholder:text-mist focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/25";

type DraftZone = { key: string; id?: string; name: string; fee: string };

function toDrafts(zones: DeliveryZone[]): DraftZone[] {
  return zones.map((z) => ({ key: z.id, id: z.id, name: z.name, fee: String(z.fee) }));
}

export function DeliveryZonesButton({ zones }: { zones: DeliveryZone[] }) {
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<DraftZone[]>(() => toDrafts(zones));
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    // Start from the saved list every time, so cancelled edits don't linger.
    if (next) setDrafts(toDrafts(zones));
    setOpen(next);
  }

  function update(key: string, patch: Partial<DraftZone>) {
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  function addZone() {
    setDrafts((prev) => [...prev, { key: crypto.randomUUID(), name: "", fee: "" }]);
  }

  function removeZone(key: string) {
    setDrafts((prev) => prev.filter((d) => d.key !== key));
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveDeliveryZones(
        drafts.map((d) => ({ id: d.id, name: d.name, fee: d.fee || 0 })),
      );
      if (result.ok) {
        toast.success("Delivery zones saved");
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="flex items-center gap-2 rounded-md border border-stone bg-white px-3 py-1.5 text-xs font-semibold text-graphite transition-colors hover:border-teal/40"
          />
        }
      >
        <MapPin className="size-3.5" />
        Delivery zones{zones.length ? ` (${zones.length})` : ""}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Delivery zones</DialogTitle>
          <DialogDescription>
            Customers pick their area at checkout and pay that zone&apos;s delivery fee. Products
            with pickup enabled also get a free &quot;Pick up&quot; option. If you have no zones,
            each product&apos;s own shipping fee is used instead.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {drafts.length === 0 ? (
            <p className="rounded-md border border-dashed border-stone p-4 text-center text-xs text-mist">
              No zones yet. Add one per area you deliver to, e.g. Abuja, Lagos, Other states.
            </p>
          ) : (
            <div className="grid grid-cols-[1fr_8rem_auto] gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-graphite">
              <span>Area</span>
              <span>Fee (₦)</span>
              <span className="w-9" />
            </div>
          )}
          {drafts.map((d) => (
            <div key={d.key} className="grid grid-cols-[1fr_8rem_auto] items-center gap-2">
              <input
                value={d.name}
                onChange={(e) => update(d.key, { name: e.target.value })}
                placeholder="e.g. Lagos Island"
                maxLength={80}
                className={fieldClass}
              />
              <input
                value={d.fee}
                onChange={(e) => update(d.key, { fee: e.target.value.replace(/[^0-9.]/g, "") })}
                inputMode="decimal"
                placeholder="0"
                className={fieldClass}
              />
              <button
                type="button"
                onClick={() => removeZone(d.key)}
                aria-label={`Remove ${d.name || "zone"}`}
                className="flex size-9 items-center justify-center rounded-md text-mist transition-colors hover:bg-stone hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addZone}
            className="mt-1 flex items-center gap-1.5 self-start text-xs font-semibold text-teal-700 hover:underline"
          >
            <Plus className="size-3.5" />
            Add zone
          </button>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending ? "Saving" : "Save zones"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
