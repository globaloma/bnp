"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ClipboardList, Lock, Plus, X } from "lucide-react";
import { toast } from "sonner";
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
import { decideAdjustment, requestAdjustment } from "../stock/actions";

export type AdjustmentRow = {
  id: string;
  kind: "count" | "manual" | "quarantine";
  product: string;
  barcode: string | null;
  merchant: string;
  bin: string | null;
  expected: number | null;
  counted: number | null;
  change: number;
  toStock: boolean;
  reason: string;
  status: "pending" | "approved" | "rejected";
  onHand: number;
  allocated: number;
  requestedBy: string;
  requestedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  note: string | null;
};

export type ProductOption = { id: string; label: string; detail: string };

function describe(a: AdjustmentRow): string {
  if (a.kind === "count") {
    return `Count of ${a.bin ?? "a bin"}: system ${a.expected}, counted ${a.counted} (${a.change > 0 ? "+" : ""}${a.change})`;
  }
  if (a.kind === "quarantine") {
    return `${-a.change} from quarantine ${a.toStock ? "back to stock" : "written off"}`;
  }
  return `Manual change: ${a.change > 0 ? "+" : ""}${a.change} on hand`;
}

export function ApprovalsClient({
  adjustments,
  isSupervisor,
  products,
}: {
  adjustments: AdjustmentRow[];
  isSupervisor: boolean;
  products: ProductOption[];
}) {
  const pending = adjustments.filter((a) => a.status === "pending");
  const decided = adjustments.filter((a) => a.status !== "pending");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {isSupervisor ? (
          <p className="text-sm text-graphite">You can approve these as a supervisor.</p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-graphite">
            <Lock className="size-4" />
            Only a supervisor can approve. An admin can make an account a supervisor.
          </p>
        )}
        <RequestDialog products={products} />
      </div>

      {pending.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-8" />}
          title="Nothing waiting"
          body="Count gaps, manual corrections and quarantine decisions show up here for a supervisor."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {pending.map((a) => (
            <PendingCard key={a.id} adjustment={a} canDecide={isSupervisor} />
          ))}
        </div>
      )}

      {decided.length > 0 ? (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-graphite">Decided</h2>
          <div className="overflow-hidden rounded-lg border border-stone bg-card">
            <ul className="divide-y divide-stone">
              {decided.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                      a.status === "approved" ? "bg-success/10 text-success" : "bg-stone text-graphite",
                    )}
                  >
                    {a.status}
                  </span>
                  <span className="font-semibold text-navy">{a.product}</span>
                  <span className="text-graphite">{describe(a)}</span>
                  <span className="ml-auto text-xs text-mist">
                    Asked by {a.requestedBy}, {a.status} by {a.decidedBy}
                    {a.decidedAt ? ` · ${formatDate(a.decidedAt)}` : ""}
                    {a.note ? ` · "${a.note}"` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PendingCard({ adjustment: a, canDecide }: { adjustment: AdjustmentRow; canDecide: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, startTransition] = useTransition();
  const onHandAfter = a.kind === "quarantine" ? (a.toStock ? a.onHand - a.change : a.onHand) : a.onHand + a.change;

  function decide(approve: boolean) {
    startTransition(async () => {
      const result = await decideAdjustment(a.id, approve, note);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="rounded-lg border border-l-4 border-stone border-l-gold bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-navy">{a.product}</div>
          <div className="text-[11px] text-mist">
            {a.merchant} · <span className="font-mono">{a.barcode}</span>
          </div>
          <div className="mt-2 text-sm font-semibold text-navy">{describe(a)}</div>
          <div className="mt-1 text-sm text-graphite">&ldquo;{a.reason}&rdquo;</div>
          <div className="mt-1 text-xs text-mist">
            Asked by {a.requestedBy} · {formatDate(a.requestedAt)}
          </div>
        </div>
        <div className="text-right text-xs text-graphite">
          On hand {a.onHand} → <span className="font-semibold text-navy">{onHandAfter}</span>
          {onHandAfter < a.allocated ? (
            <div className="mt-1 font-semibold text-destructive">Below the {a.allocated} reserved for orders</div>
          ) : null}
        </div>
      </div>
      {canDecide ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone pt-3">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="Note (optional)"
            className="h-9 min-w-48 flex-1 rounded-md border border-stone bg-white px-3 text-sm text-navy"
          />
          <Button size="sm" onClick={() => decide(true)} disabled={busy}>
            <Check className="size-4" />
            Approve
          </Button>
          <Button size="sm" variant="outline" onClick={() => decide(false)} disabled={busy}>
            <X className="size-4" />
            Reject
          </Button>
        </div>
      ) : (
        <p className="mt-3 border-t border-stone pt-3 text-xs font-semibold text-gold-300">Waiting for a supervisor</p>
      )}
    </div>
  );
}

function RequestDialog({ products }: { products: ProductOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [productId, setProductId] = useState("");
  const [change, setChange] = useState("");
  const [reason, setReason] = useState("");
  const [busy, startTransition] = useTransition();

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (q ? products.filter((p) => `${p.label} ${p.detail}`.toLowerCase().includes(q)) : products).slice(0, 30);
  }, [products, query]);
  const chosen = products.find((p) => p.id === productId);

  function send() {
    startTransition(async () => {
      const result = await requestAdjustment({ productId, change, reason, kind: "manual", toStock: false });
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        setProductId("");
        setChange("");
        setReason("");
        setQuery("");
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="lg" />}>
        <Plus className="size-4" />
        Request a stock change
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request a stock change</DialogTitle>
        </DialogHeader>
        <p className="-mt-1 text-xs text-graphite">
          For units found, lost or damaged in the warehouse. A supervisor approves it before stock changes. To fix a
          bin, count it from Cycle counts instead.
        </p>
        <div className="flex flex-col gap-3">
          {chosen ? (
            <div className="flex items-center justify-between gap-2 rounded-md border border-teal bg-teal/5 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-navy">{chosen.label}</div>
                <div className="truncate text-[11px] text-mist">{chosen.detail}</div>
              </div>
              <button type="button" onClick={() => setProductId("")} aria-label="Choose another product">
                <X className="size-4 text-graphite" />
              </button>
            </div>
          ) : (
            <div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by product, merchant or barcode"
                className="h-10 w-full rounded-md border border-stone bg-white px-3 text-sm text-navy"
              />
              <ul className="mt-2 max-h-56 divide-y divide-stone overflow-y-auto rounded-md border border-stone">
                {matches.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setProductId(p.id)}
                      className="w-full px-3 py-2 text-left hover:bg-cream/60"
                    >
                      <div className="text-sm font-semibold text-navy">{p.label}</div>
                      <div className="truncate text-[11px] text-mist">{p.detail}</div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <label className="text-xs font-semibold text-graphite">
            Change to on-hand (use a minus sign to remove, e.g. -2)
            <input
              value={change}
              onChange={(e) => setChange(e.target.value.replace(/[^0-9-]/g, ""))}
              inputMode="numeric"
              placeholder="e.g. 3 or -2"
              className="mt-1 block h-10 w-full rounded-md border border-stone bg-white px-3 text-sm text-navy"
            />
          </label>
          <label className="text-xs font-semibold text-graphite">
            Reason
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              placeholder="e.g. 2 crushed by a falling carton"
              className="mt-1 block h-10 w-full rounded-md border border-stone bg-white px-3 text-sm text-navy"
            />
          </label>
          <Button size="lg" onClick={send} disabled={busy || !productId || !change || !reason}>
            {busy ? "Sending" : "Send for approval"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
