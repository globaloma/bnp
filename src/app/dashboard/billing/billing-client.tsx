"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Lock, Wallet } from "lucide-react";
import { toast } from "sonner";
import type { Invoice } from "@/types/db";
import { naira } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { payInvoiceFromWallet, payInvoiceOnline, requestDeclaredValueChange } from "./actions";

/** Unpaid and past its due date. */
function isOverdue(inv: Invoice) {
  return inv.status === "unpaid" && new Date(inv.due_at).getTime() < Date.now();
}

function monthName(date: string) {
  return new Date(date + "T12:00:00Z").toLocaleDateString("en-NG", { month: "long", year: "numeric" });
}
function shortDate(date: string) {
  return new Date(date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

export function InvoiceList({ invoices, walletBalance }: { invoices: Invoice[]; walletBalance: number }) {
  if (invoices.length === 0) {
    return (
      <p className="rounded-lg border border-stone bg-card px-4 py-5 text-sm text-mist">
        No invoices yet. Your first one arrives at the start of the month after billing begins.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {invoices.map((inv) => (
        <InvoiceRow key={inv.id} invoice={inv} walletBalance={walletBalance} />
      ))}
    </div>
  );
}

function InvoiceRow({ invoice: inv, walletBalance }: { invoice: Invoice; walletBalance: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const overdue = isOverdue(inv);
  const canUseWallet = walletBalance >= Number(inv.total);

  function payWallet() {
    startTransition(async () => {
      const result = await payInvoiceFromWallet(inv.id);
      if (result.ok) {
        toast.success(`${result.number} paid from your wallet.`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function payOnline() {
    startTransition(async () => {
      // Redirects to Paystack on success; only failures come back.
      const result = await payInvoiceOnline(inv.id);
      toast.error(result.error);
    });
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-l-4 border-stone bg-card p-4 shadow-sm",
        inv.status === "paid" ? "border-l-success" : overdue ? "border-l-destructive" : "border-l-gold",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold text-navy">{inv.number}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                inv.status === "paid"
                  ? "bg-success/10 text-success"
                  : inv.status === "void"
                    ? "bg-stone text-graphite"
                    : overdue
                      ? "bg-destructive/10 text-destructive"
                      : "bg-gold/15 text-gold-300",
              )}
            >
              {inv.status === "paid" ? "Paid" : inv.status === "void" ? "Cancelled" : overdue ? "Overdue" : "Due"}
            </span>
          </div>
          <div className="mt-0.5 text-sm text-graphite">{monthName(inv.period)}</div>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl font-bold text-navy tabular-nums">{naira(Number(inv.total))}</div>
          <div className="text-xs text-mist">
            {inv.status === "paid" && inv.paid_at
              ? `Paid ${shortDate(inv.paid_at)}`
              : inv.status === "unpaid"
                ? `Due ${shortDate(inv.due_at)}`
                : ""}
          </div>
        </div>
      </div>
      <dl className="mt-3 grid gap-1 border-t border-stone pt-3 text-xs text-graphite sm:grid-cols-2">
        <div className="flex justify-between gap-3 sm:block">
          <dt className="inline">Storage, {Number(inv.storage_sqm)} m²: </dt>
          <dd className="inline font-semibold text-navy">{naira(Number(inv.storage_amount))}</dd>
        </div>
        <div className="flex justify-between gap-3 sm:block">
          <dt className="inline">
            Fulfillment, {Math.round(Number(inv.fulfillment_rate) * 100)}% of {naira(Number(inv.sales_value))} delivered:{" "}
          </dt>
          <dd className="inline font-semibold text-navy">{naira(Number(inv.fulfillment_amount))}</dd>
        </div>
      </dl>
      {inv.status === "unpaid" ? (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-stone pt-3">
          <Button size="sm" onClick={payOnline} disabled={pending}>
            <CreditCard className="size-4" />
            Pay by card or transfer
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={payWallet}
            disabled={pending || !canUseWallet}
            title={canUseWallet ? undefined : `Your wallet has ${naira(walletBalance)}`}
          >
            <Wallet className="size-4" />
            Pay from wallet
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export type DeclaredRow = {
  id: string;
  label: string;
  sku: string | null;
  onHand: number;
  value: number | null;
  /** Value waiting for approval, if a change was requested. */
  pending: number | null;
};

export function DeclaredValues({ rows }: { rows: DeclaredRow[] }) {
  if (rows.length === 0) {
    return <p className="rounded-lg border border-stone bg-card px-4 py-5 text-sm text-mist">No products yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-stone bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone text-left text-[11px] uppercase tracking-[0.08em] text-mist">
            <th className="px-4 py-2.5 font-semibold">Product</th>
            <th className="px-4 py-2.5 text-right font-semibold">In warehouse</th>
            <th className="px-4 py-2.5 text-right font-semibold">Value per unit</th>
            <th className="px-4 py-2.5 text-right font-semibold">Total</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-stone">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-2.5">
                <div className="font-semibold text-navy">{r.label}</div>
                {r.sku ? <div className="font-mono text-[11px] text-mist">{r.sku}</div> : null}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">{r.onHand}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {r.value === null ? (
                  <span className="text-xs font-semibold text-destructive">Not set</span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-semibold text-navy">
                    <Lock className="size-3 text-mist" />
                    {naira(r.value)}
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-navy">
                {r.value === null ? "" : naira(r.value * r.onHand)}
              </td>
              <td className="px-4 py-2.5 text-right">
                {r.pending !== null ? (
                  <span className="text-[11px] font-semibold text-gold-300">{naira(r.pending)} waiting for review</span>
                ) : r.value === null ? (
                  <span className="text-[11px] text-mist">Set it on the product form</span>
                ) : (
                  <RequestChange row={r} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RequestChange({ row }: { row: DeclaredRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(row.value ?? ""));
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function send() {
    startTransition(async () => {
      const result = await requestDeclaredValueChange({ productId: row.id, value, reason });
      if (result.ok) {
        toast.success("Sent to our team to review.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<button type="button" className="text-[11px] font-semibold text-teal-700 hover:underline" />}
      >
        Request a change
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Change the declared value</DialogTitle>
        </DialogHeader>
        <p className="-mt-1 text-xs text-graphite">
          {row.label} is declared at {naira(row.value ?? 0)} per unit. Our team reviews every change.
        </p>
        <label className="text-xs font-semibold text-graphite">
          New value per unit (₦)
          <input
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            className="mt-1 block h-10 w-full rounded-md border border-stone bg-white px-3 text-sm text-navy"
          />
        </label>
        <label className="text-xs font-semibold text-graphite">
          Why is it changing?
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder="e.g. new supplier price"
            className="mt-1 block h-10 w-full rounded-md border border-stone bg-white px-3 text-sm text-navy"
          />
        </label>
        <Button size="lg" onClick={send} disabled={pending || !value || reason.trim().length < 3}>
          {pending ? "Sending" : "Send for review"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
