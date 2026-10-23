"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Invoice } from "@/types/db";
import { naira } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/dashboard/ui";
import { adjustWallet, decideDeclaredValue, invoiceAction, runBilling, setEnterpriseTerms } from "./actions";

const field = "h-9 rounded-md border border-stone bg-white px-2.5 text-sm text-navy";

/** Unpaid and past its due date. */
function isOverdue(inv: Invoice) {
  return inv.status === "unpaid" && new Date(inv.due_at).getTime() < Date.now();
}

function monthName(date: string) {
  return new Date(date + "T12:00:00Z").toLocaleDateString("en-NG", { month: "long", year: "numeric" });
}

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  function run(fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>, success?: string) {
    start(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(result.message ?? success ?? "Saved");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }
  return { pending, run };
}

// ---------------------------------------------------------------------------

export function RunBilling({ startMonth }: { startMonth: string }) {
  const { pending, run } = useAction();
  // Months that have finished, newest first, back to a year ago.
  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1 - i, 1));
      return d.toISOString().slice(0, 10);
    });
  }, []);
  const [period, setPeriod] = useState(months[0]);

  return (
    <Panel accent="teal">
      <h2 className="text-base font-semibold text-navy">Run billing for a month</h2>
      <p className="mt-1 text-sm text-graphite">
        Billing starts with {monthName(startMonth)}. The daily job bills the month just ended on the 1st; running it
        again is safe and never charges twice.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className={field}>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthName(m)}
            </option>
          ))}
        </select>
        <Button size="lg" onClick={() => run(() => runBilling(period))} disabled={pending}>
          {pending ? "Running" : "Run billing"}
        </Button>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------

export type MerchantRow = {
  id: string;
  name: string;
  plan: "standard" | "enterprise";
  sqm: number;
  balance: number;
  minimum: number;
  manager: string | null;
  locked: boolean;
  paused: boolean;
  active: boolean;
};

export function EnterpriseTable({ rows, rates }: { rows: MerchantRow[]; rates: { storage: number; enterprise: number } }) {
  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-[0.08em] text-graphite">Merchants</h2>
      <p className="mb-3 text-sm text-graphite">
        Storage space is set by the warehouse on Storage space. For Enterprise, set the minimum wallet balance: the spec
        suggests 1.5 x the projected monthly bill.
      </p>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <MerchantCard key={r.id} row={r} rates={rates} />
        ))}
      </div>
    </section>
  );
}

function MerchantCard({ row, rates }: { row: MerchantRow; rates: { storage: number; enterprise: number } }) {
  const { pending, run } = useAction();
  const [minimum, setMinimum] = useState(String(row.minimum));
  const [manager, setManager] = useState(row.manager ?? "");
  const [sales, setSales] = useState("");
  const projected = row.sqm * rates.storage + (Number(sales) || 0) * rates.enterprise;
  const suggested = Math.round(projected * 1.5);

  return (
    <div className={cn("rounded-lg border border-stone bg-card p-4", !row.active && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-semibold text-navy">{row.name}</span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
            row.plan === "enterprise" ? "bg-gold text-navy" : "bg-stone text-graphite",
          )}
        >
          {row.plan}
        </span>
        <span className="text-xs text-graphite">
          {row.sqm} m² · wallet {naira(row.balance)}
        </span>
        {row.locked ? (
          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
            Paused: invoice overdue
          </span>
        ) : null}
        {row.paused ? (
          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
            Orders paused: wallet at minimum
          </span>
        ) : null}
      </div>
      {row.plan === "enterprise" ? (
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-stone pt-3">
          <label className="text-xs font-semibold text-graphite">
            Minimum balance (₦)
            <input
              value={minimum}
              onChange={(e) => setMinimum(e.target.value.replace(/[^0-9.]/g, ""))}
              className={cn(field, "mt-1 block w-36")}
            />
          </label>
          <label className="text-xs font-semibold text-graphite">
            Projected monthly sales (₦)
            <input
              value={sales}
              onChange={(e) => setSales(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="for the suggestion"
              className={cn(field, "mt-1 block w-40")}
            />
          </label>
          {sales ? (
            <button
              type="button"
              onClick={() => setMinimum(String(suggested))}
              className="mb-2 text-xs font-semibold text-teal-700 hover:underline"
            >
              Use {naira(suggested)}
            </button>
          ) : null}
          <label className="min-w-48 flex-1 text-xs font-semibold text-graphite">
            Account manager
            <input
              value={manager}
              onChange={(e) => setManager(e.target.value)}
              placeholder="Name, phone or email"
              className={cn(field, "mt-1 block w-full")}
            />
          </label>
          <Button
            size="sm"
            disabled={pending}
            onClick={() => run(() => setEnterpriseTerms(row.id, Number(minimum) || 0, manager), "Terms saved")}
          >
            Save
          </Button>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function InvoicesTable({ invoices, names }: { invoices: Invoice[]; names: Record<string, string> }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-graphite">Invoices</h2>
      {invoices.length === 0 ? (
        <p className="rounded-lg border border-stone bg-card px-4 py-5 text-sm text-mist">No invoices yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-stone bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone text-left text-[11px] uppercase tracking-[0.08em] text-mist">
                <th className="px-4 py-2.5 font-semibold">Invoice</th>
                <th className="px-4 py-2.5 font-semibold">Merchant</th>
                <th className="px-4 py-2.5 font-semibold">Month</th>
                <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone">
              {invoices.map((inv) => (
                <InvoiceRow key={inv.id} invoice={inv} merchant={names[inv.partner_id] ?? "Merchant"} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function InvoiceRow({ invoice: inv, merchant }: { invoice: Invoice; merchant: string }) {
  const { pending, run } = useAction();
  const overdue = isOverdue(inv);
  return (
    <tr>
      <td className="px-4 py-2.5 font-mono text-xs font-semibold text-navy">{inv.number}</td>
      <td className="px-4 py-2.5 text-navy">{merchant}</td>
      <td className="px-4 py-2.5 text-xs text-graphite">{monthName(inv.period)}</td>
      <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-navy">{naira(Number(inv.total))}</td>
      <td className="px-4 py-2.5 text-xs">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-semibold",
            inv.status === "paid"
              ? "bg-success/10 text-success"
              : inv.status === "void"
                ? "bg-stone text-graphite"
                : overdue
                  ? "bg-destructive/10 text-destructive"
                  : "bg-gold/15 text-gold-300",
          )}
        >
          {inv.status === "paid" ? `Paid (${inv.paid_via})` : inv.status === "void" ? "Cancelled" : overdue ? "Overdue" : "Unpaid"}
        </span>
      </td>
      <td className="px-4 py-2.5 text-right whitespace-nowrap">
        {inv.status === "unpaid" ? (
          <div className="flex justify-end gap-2">
            <Button
              size="xs"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => invoiceAction(inv.id, "paid", "Marked paid by admin"), "Marked paid")}
            >
              Mark paid
            </Button>
            <Button
              size="xs"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => invoiceAction(inv.id, "void", "Cancelled by admin"), "Invoice cancelled")}
            >
              Cancel
            </Button>
          </div>
        ) : null}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------

export type DeclaredRequestRow = {
  id: string;
  merchant: string;
  product: string;
  onHand: number;
  oldValue: number | null;
  newValue: number;
  reason: string;
  status: string;
  notes: string | null;
};

export function DeclaredRequests({ rows }: { rows: DeclaredRequestRow[] }) {
  const pending = rows.filter((r) => r.status === "pending");
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-graphite">
        Declared value changes{pending.length ? ` (${pending.length} waiting)` : ""}
      </h2>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-stone bg-card px-4 py-5 text-sm text-mist">No requests yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <DeclaredRow key={r.id} row={r} />
          ))}
        </div>
      )}
    </section>
  );
}

function DeclaredRow({ row }: { row: DeclaredRequestRow }) {
  const { pending, run } = useAction();
  const [notes, setNotes] = useState("");
  return (
    <div className="rounded-lg border border-stone bg-card p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-semibold text-navy">{row.product}</span>
          <span className="text-graphite"> · {row.merchant}</span>
        </div>
        <span className="text-graphite">
          {naira(row.oldValue ?? 0)} → <strong className="text-navy">{naira(row.newValue)}</strong> per unit ·{" "}
          {row.onHand} in stock
        </span>
      </div>
      <p className="mt-1 text-graphite">&ldquo;{row.reason}&rdquo;</p>
      {row.status === "pending" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone pt-3">
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Note to the merchant (optional)"
            className={cn(field, "min-w-48 flex-1")}
          />
          <Button size="sm" disabled={pending} onClick={() => run(() => decideDeclaredValue(row.id, true, notes), "Approved")}>
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => decideDeclaredValue(row.id, false, notes), "Rejected")}
          >
            Reject
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-xs font-semibold capitalize text-mist">
          {row.status}
          {row.notes ? `: ${row.notes}` : ""}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function AdjustWallet({ merchants }: { merchants: { id: string; name: string; balance: number }[] }) {
  const { pending, run } = useAction();
  const [partnerId, setPartnerId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  return (
    <Panel accent="gold">
      <h2 className="text-base font-semibold text-navy">Adjust a wallet</h2>
      <p className="mt-1 text-sm text-graphite">
        For refunds (including the first-month registration refund) and corrections. Use a minus sign to take money
        off. Every adjustment is logged with your reason.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className={field}>
          <option value="">Pick a merchant</option>
          {merchants.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({naira(m.balance)})
            </option>
          ))}
        </select>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.-]/g, ""))}
          placeholder="e.g. 50000 or -2000"
          className={cn(field, "w-40")}
        />
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason"
          className={cn(field, "min-w-48 flex-1")}
        />
        <Button
          size="lg"
          disabled={pending || !partnerId || !amount || reason.trim().length < 3}
          onClick={() =>
            run(async () => {
              const r = await adjustWallet(partnerId, Number(amount), reason);
              if (r.ok) {
                setAmount("");
                setReason("");
              }
              return r;
            }, "Wallet adjusted")
          }
        >
          Apply
        </Button>
      </div>
    </Panel>
  );
}

export type InsuranceRow = {
  id: string;
  name: string;
  stockValue: number;
  /** Products in stock with no declared value, so not insured. */
  missing: number;
  history: { period: string | null; basis: number | null; amount: number }[];
};

export function InsuranceTable({ rows, rate }: { rows: InsuranceRow[]; rate: number }) {
  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-[0.08em] text-graphite">Insurance</h2>
      <p className="mb-3 text-sm text-graphite">
        Enterprise merchants pay {Math.round(rate * 10000) / 100}% of their stock value at month end, taken from the
        wallet on the 1st. The estimate uses today&apos;s stock at declared values.
      </p>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-stone bg-card px-4 py-5 text-sm text-mist">No Enterprise merchants yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <InsuranceCard key={r.id} row={r} rate={rate} />
          ))}
        </div>
      )}
    </section>
  );
}

function InsuranceCard({ row, rate }: { row: InsuranceRow; rate: number }) {
  const [open, setOpen] = useState(false);
  const estimate = Math.round(row.stockValue * rate * 100) / 100;
  const last = row.history[0];
  return (
    <div className="rounded-lg border border-stone bg-card p-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span className="min-w-40 font-semibold text-navy">{row.name}</span>
        <span className="text-graphite">
          Stock value <strong className="text-navy">{naira(row.stockValue)}</strong>
        </span>
        <span className="text-graphite">
          Next charge about <strong className="text-navy">{naira(estimate)}</strong>
        </span>
        <span className="text-graphite">
          Last charge{" "}
          <strong className="text-navy">
            {last ? `${naira(last.amount)} (${last.period ? monthName(last.period) : "-"})` : "none yet"}
          </strong>
        </span>
        {row.missing > 0 ? (
          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
            {row.missing} product{row.missing === 1 ? "" : "s"} with no declared value
          </span>
        ) : null}
        {row.history.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="ml-auto text-xs font-semibold text-teal-700 hover:underline"
          >
            {open ? "Hide history" : `History (${row.history.length})`}
          </button>
        ) : null}
      </div>
      {open ? (
        <table className="mt-3 w-full border-t border-stone text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-mist">
              <th className="py-2 font-semibold">Month</th>
              <th className="py-2 text-right font-semibold">Stock value at month end</th>
              <th className="py-2 text-right font-semibold">Charged</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone">
            {row.history.map((h, i) => (
              <tr key={i}>
                <td className="py-1.5 text-navy">{h.period ? monthName(h.period) : "-"}</td>
                <td className="py-1.5 text-right text-graphite tabular-nums">
                  {h.basis === null ? "-" : naira(h.basis)}
                </td>
                <td className="py-1.5 text-right font-semibold text-navy tabular-nums">{naira(h.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
