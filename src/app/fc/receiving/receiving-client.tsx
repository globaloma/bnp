"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, PackageOpen, PackagePlus, Truck } from "lucide-react";
import { toast } from "sonner";
import { LOCATIONS, type InboundDelivery, type WarehouseLocation } from "@/types/db";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/dashboard/ui";
import { useWarehouseLocation, WarehousePicker } from "@/components/warehouse/warehouse-picker";
import { startUnannounced } from "./actions";

export type DeliverySummary = InboundDelivery & {
  merchant_name: string;
  expected: number;
  received: number;
  products: number;
  gaps: number;
};

const fieldClass =
  "h-10 w-full rounded-md border border-stone bg-white px-3 text-sm text-navy outline-none focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/25";
const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-graphite";

export function ReceivingClient({
  open,
  recent,
  merchants,
}: {
  open: DeliverySummary[];
  recent: DeliverySummary[];
  merchants: { id: string; business_name: string }[];
}) {
  const [location, setLocation] = useWarehouseLocation();
  const visibleOpen = useMemo(() => open.filter((d) => d.location === location), [open, location]);
  const visibleRecent = useMemo(() => recent.filter((d) => d.location === location), [recent, location]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <WarehousePicker value={location} onChange={setLocation} counts={countBy(open)} />
        <UnannouncedDialog merchants={merchants} location={location} />
      </div>

      {visibleOpen.length === 0 ? (
        <EmptyState
          icon={<Truck className="size-8" />}
          title={`No deliveries expected in ${location}`}
          body="When a merchant announces a delivery it shows up here. Stock that arrives without notice can still be received with the button above."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleOpen.map((d) => (
            <DeliveryCard key={d.id} delivery={d} />
          ))}
        </div>
      )}

      {visibleRecent.length > 0 ? (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-graphite">
            Recently received
          </h2>
          <div className="overflow-hidden rounded-lg border border-stone bg-card">
            <ul className="divide-y divide-stone">
              {visibleRecent.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                  <span className="font-mono font-semibold text-navy">{d.ref}</span>
                  <span className="text-navy">{d.merchant_name}</span>
                  <span className="text-graphite">
                    {d.received} units{d.received_at ? `, ${formatDate(d.received_at)}` : ""}
                  </span>
                  {d.gaps > 0 ? (
                    <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-semibold text-gold-300">
                      {d.gaps} didn&apos;t match
                    </span>
                  ) : (
                    <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
                      Matched
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function countBy(rows: DeliverySummary[]): Record<WarehouseLocation, number> {
  const counts = { Abuja: 0, Lagos: 0, USA: 0 } as Record<WarehouseLocation, number>;
  for (const r of rows) counts[r.location] += 1;
  return counts;
}

function DeliveryCard({ delivery: d }: { delivery: DeliverySummary }) {
  const started = d.status === "receiving";
  const pct = d.expected > 0 ? Math.min(100, Math.round((d.received / d.expected) * 100)) : 0;
  return (
    <Link
      href={`/fc/receiving/${d.id}`}
      className="group flex flex-col rounded-lg border border-stone bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-mono text-base font-semibold text-navy">{d.ref}</div>
          <div className="text-sm text-navy">{d.merchant_name}</div>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
            started ? "bg-teal/10 text-teal-700" : "bg-gold/15 text-gold-300",
          )}
        >
          {started ? "Receiving" : d.announced ? "Expected" : "Unannounced"}
        </span>
      </div>
      <div className="mt-3 text-xs text-graphite">
        {d.products} product{d.products === 1 ? "" : "s"}
        {d.expected > 0 ? `, ${d.expected} units announced` : ""}
        {d.expected_on ? `, due ${formatDate(d.expected_on)}` : ""}
      </div>
      {d.note ? <p className="mt-1 line-clamp-2 text-xs text-mist">&ldquo;{d.note}&rdquo;</p> : null}
      {started ? (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-stone">
            <div className="h-full rounded-full bg-teal" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 text-[11px] text-graphite">
            {d.received} counted{d.expected > 0 ? ` of ${d.expected}` : ""}
          </div>
        </div>
      ) : null}
      <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-teal-700">
        {started ? "Continue receiving" : "Start receiving"}
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function UnannouncedDialog({
  merchants,
  location,
}: {
  merchants: { id: string; business_name: string }[];
  location: WarehouseLocation;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [partnerId, setPartnerId] = useState("");
  const [where, setWhere] = useState<WarehouseLocation>(location);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function start() {
    startTransition(async () => {
      const result = await startUnannounced({ partnerId, location: where, note });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      router.push(`/fc/receiving/${result.id}`);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setWhere(location);
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="lg" />}>
        <PackagePlus className="size-4" />
        Stock arrived without notice
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Receive unannounced stock</DialogTitle>
        </DialogHeader>
        <p className="-mt-1 text-xs text-graphite">
          For deliveries the merchant didn&apos;t announce. Pick whose stock it is, then scan it in.
        </p>
        <div className="flex flex-col gap-3">
          <div>
            <label className={labelClass} htmlFor="un-merchant">
              Merchant
            </label>
            <select
              id="un-merchant"
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
              className={cn(fieldClass, "appearance-none")}
            >
              <option value="">Select a merchant</option>
              {merchants.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.business_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="un-location">
              Warehouse
            </label>
            <select
              id="un-location"
              value={where}
              onChange={(e) => setWhere(e.target.value as WarehouseLocation)}
              className={cn(fieldClass, "appearance-none")}
            >
              {LOCATIONS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="un-note">
              Note (optional)
            </label>
            <input
              id="un-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="e.g. dropped off by the merchant's rider"
              className={fieldClass}
            />
          </div>
          <Button size="lg" onClick={start} disabled={!partnerId || pending}>
            <PackageOpen className="size-4" />
            {pending ? "Starting" : "Start receiving"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
