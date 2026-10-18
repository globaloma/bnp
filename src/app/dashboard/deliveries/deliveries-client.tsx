"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronDown, Search, Truck, X } from "lucide-react";
import { toast } from "sonner";
import { LOCATIONS, type InboundDelivery, type InboundStatus, type WarehouseLocation } from "@/types/db";
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
import { announceDelivery, cancelDelivery } from "./actions";

export type DeliveryWithLines = InboundDelivery & {
  lines: {
    product_id: string;
    name: string;
    variant: string | null;
    sku: string | null;
    expected: number;
    received: number;
  }[];
};

export type PickableProduct = {
  id: string;
  name: string;
  variant: string | null;
  sku: string | null;
  location: WarehouseLocation;
  on_hand: number;
};

const fieldClass =
  "h-10 w-full rounded-md border border-stone bg-white px-3 text-sm text-navy outline-none focus-visible:border-teal focus-visible:ring-2 focus-visible:ring-teal/25";
const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-graphite";

const STATUS: Record<InboundStatus, { label: string; className: string }> = {
  announced: { label: "On the way", className: "bg-gold/15 text-gold-300" },
  receiving: { label: "Being counted", className: "bg-teal/10 text-teal-700" },
  received: { label: "Received", className: "bg-success/10 text-success" },
  cancelled: { label: "Cancelled", className: "bg-stone text-graphite" },
};

export function DeliveriesClient({
  deliveries,
  products,
}: {
  deliveries: DeliveryWithLines[];
  products: PickableProduct[];
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-graphite">
          Label your boxes with the delivery number so the warehouse can match them quickly.
        </p>
        <AnnounceDialog products={products} />
      </div>

      {deliveries.length === 0 ? (
        <EmptyState
          icon={<Truck className="size-8" />}
          title="No deliveries yet"
          body="When you send stock to the warehouse, announce it here first. You'll see exactly what was counted in when it arrives."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {deliveries.map((d) => (
            <DeliveryRow key={d.id} delivery={d} />
          ))}
        </div>
      )}
    </div>
  );
}

function DeliveryRow({ delivery: d }: { delivery: DeliveryWithLines }) {
  const [open, setOpen] = useState(d.status !== "received" && d.status !== "cancelled");
  const [pending, startTransition] = useTransition();
  const expected = d.lines.reduce((s, l) => s + l.expected, 0);
  const received = d.lines.reduce((s, l) => s + l.received, 0);
  const gaps = d.lines.filter((l) => l.expected !== l.received).length;
  const counted = d.status === "receiving" || d.status === "received";
  const status = STATUS[d.status];

  function cancel() {
    startTransition(async () => {
      const result = await cancelDelivery(d.id);
      if (result.ok) toast.success(`${d.ref} cancelled`);
      else toast.error(result.error);
    });
  }

  return (
    <div className="overflow-hidden rounded-lg border border-stone bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3.5 text-left"
      >
        <span className="font-mono text-base font-semibold text-navy">{d.ref}</span>
        <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", status.className)}>
          {status.label}
        </span>
        <span className="text-sm text-graphite">
          {d.location} · {d.lines.length} product{d.lines.length === 1 ? "" : "s"}
          {counted ? ` · ${received}${expected ? ` of ${expected}` : ""} counted` : ` · ${expected} units`}
        </span>
        {d.status === "received" && gaps > 0 ? (
          <span className="rounded-full bg-gold/15 px-2.5 py-0.5 text-[11px] font-semibold text-gold-300">
            {gaps} didn&apos;t match
          </span>
        ) : null}
        {!d.announced ? (
          <span className="text-[11px] font-semibold text-mist">Logged by the warehouse</span>
        ) : null}
        <span className="ml-auto flex items-center gap-2 text-xs text-mist">
          {d.received_at
            ? `Received ${formatDate(d.received_at)}`
            : d.expected_on
              ? `Due ${formatDate(d.expected_on)}`
              : `Sent ${formatDate(d.created_at)}`}
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {open ? (
        <div className="border-t border-stone">
          {d.note ? <p className="px-4 pt-3 text-sm text-graphite">&ldquo;{d.note}&rdquo;</p> : null}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-mist">
                <th className="px-4 py-2 font-semibold">Product</th>
                <th className="px-4 py-2 text-right font-semibold">Sent</th>
                <th className="px-4 py-2 text-right font-semibold">Counted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone">
              {d.lines.map((l) => {
                const diff = l.received - l.expected;
                const flag =
                  !counted || (d.status === "receiving" && diff < 0)
                    ? null
                    : l.expected === 0
                      ? "not on your list"
                      : diff < 0
                        ? `${-diff} short`
                        : diff > 0
                          ? `${diff} extra`
                          : null;
                return (
                  <tr key={l.product_id}>
                    <td className="px-4 py-2.5">
                      <span className="font-semibold text-navy">{l.name}</span>
                      {l.variant ? <span className="text-graphite"> · {l.variant}</span> : null}
                      {l.sku ? <span className="ml-2 font-mono text-[11px] text-mist">{l.sku}</span> : null}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-graphite">{l.expected}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {counted ? <span className="font-semibold text-navy">{l.received}</span> : <span className="text-xs text-mist">Not yet</span>}
                      {flag ? <span className="ml-2 text-[11px] font-semibold text-gold-300">{flag}</span> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {d.status === "announced" ? (
            <div className="flex justify-end border-t border-stone px-4 py-3">
              <Button variant="outline" size="sm" onClick={cancel} disabled={pending}>
                {pending ? "Cancelling" : "Cancel delivery"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AnnounceDialog({ products }: { products: PickableProduct[] }) {
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useState<WarehouseLocation>(() => products[0]?.location ?? "Abuja");
  const [expectedOn, setExpectedOn] = useState("");
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [pending, startTransition] = useTransition();

  const here = useMemo(() => products.filter((p) => p.location === location), [products, location]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return here;
    return here.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.variant ?? "").toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q),
    );
  }, [here, query]);
  const chosen = here.filter((p) => (qty[p.id] ?? 0) > 0);
  const totalUnits = chosen.reduce((s, p) => s + (qty[p.id] ?? 0), 0);

  function reset() {
    setQty({});
    setNote("");
    setExpectedOn("");
    setQuery("");
  }

  function submit() {
    startTransition(async () => {
      const result = await announceDelivery({
        location,
        expectedOn,
        note,
        lines: chosen.map((p) => ({ productId: p.id, qty: qty[p.id] })),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Delivery ${result.refs.join(", ")} announced. Write it on your boxes.`);
      reset();
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="lg" />}>
        <Truck className="size-4" />
        Announce a delivery
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Announce a delivery</DialogTitle>
        </DialogHeader>
        <p className="-mt-1 text-xs text-graphite">
          List what you&apos;re sending. The warehouse checks each item against this list when it arrives.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="an-location">
              Sending to
            </label>
            <select
              id="an-location"
              value={location}
              onChange={(e) => {
                setLocation(e.target.value as WarehouseLocation);
                setQty({});
              }}
              className={cn(fieldClass, "appearance-none")}
            >
              {LOCATIONS.map((l) => (
                <option key={l} value={l}>
                  {l} warehouse
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="an-date">
              Expected arrival (optional)
            </label>
            <input
              id="an-date"
              type="date"
              value={expectedOn}
              onChange={(e) => setExpectedOn(e.target.value)}
              className={fieldClass}
            />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className={cn(labelClass, "mb-0")}>Products</span>
            <span className="text-xs text-graphite">
              {chosen.length} product{chosen.length === 1 ? "" : "s"}, {totalUnits} units
            </span>
          </div>
          {here.length === 0 ? (
            <p className="rounded-md border border-dashed border-stone p-4 text-sm text-graphite">
              You have no products set up for the {location} warehouse yet. Add them on your Inventory page first.
            </p>
          ) : (
            <>
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-mist" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search your products"
                  className={cn(fieldClass, "pl-9")}
                />
              </div>
              <ul className="max-h-72 divide-y divide-stone overflow-y-auto rounded-md border border-stone">
                {visible.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-navy">
                        {p.name}
                        {p.variant ? <span className="font-normal text-graphite"> · {p.variant}</span> : null}
                      </div>
                      <div className="text-[11px] text-mist">
                        {p.sku ? <span className="font-mono">{p.sku}</span> : null} · {p.on_hand} in the warehouse
                      </div>
                    </div>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={100000}
                      aria-label={`Units of ${p.name}${p.variant ? ` ${p.variant}` : ""}`}
                      value={qty[p.id] ?? ""}
                      placeholder="0"
                      onChange={(e) => {
                        const n = Math.max(0, Math.min(100000, Math.floor(Number(e.target.value) || 0)));
                        setQty((q) => ({ ...q, [p.id]: n }));
                      }}
                      className={cn(
                        "h-9 w-24 rounded-md border bg-white px-2 text-right text-sm font-semibold text-navy outline-none focus-visible:border-teal",
                        (qty[p.id] ?? 0) > 0 ? "border-teal" : "border-stone",
                      )}
                    />
                    {(qty[p.id] ?? 0) > 0 ? (
                      <button
                        type="button"
                        onClick={() => setQty((q) => ({ ...q, [p.id]: 0 }))}
                        aria-label="Remove"
                        className="text-mist hover:text-destructive"
                      >
                        <X className="size-4" />
                      </button>
                    ) : (
                      <span className="w-4" />
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div>
          <label className={labelClass} htmlFor="an-note">
            Note for the warehouse (optional)
          </label>
          <input
            id="an-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            placeholder="e.g. 3 cartons, coming with our rider"
            className={fieldClass}
          />
        </div>

        <Button size="lg" onClick={submit} disabled={pending || chosen.length === 0}>
          {pending ? "Announcing" : `Announce ${totalUnits} units`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
