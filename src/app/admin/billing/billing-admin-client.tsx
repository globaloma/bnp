"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Invoice } from "@/types/db";
import { naira } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/dashboard/ui";
import type { EnterpriseDefaults } from "@/types/db";
import {
  adjustWallet,
  decideDeclaredValue,
  finalizeInvoice,
  invoiceAction,
  removeInvoiceLine,
  runBilling,
  setEnterpriseDefaults,
  setEnterpriseRates,
  setEnterpriseTerms,
  setWalletLock,
  upsertInvoiceLine,
} from "./actions";

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
  walletLocked: boolean;
  active: boolean;
};

export function EnterpriseTable({ rows }: { rows: MerchantRow[]; rates?: { storage: number } }) {
  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-[0.08em] text-graphite">Merchants</h2>
      <p className="mb-3 text-sm text-graphite">
        Storage space is set by the warehouse on Storage space. For Enterprise, the wallet is used to pay invoices and
        top-ups; set an optional minimum balance and the account manager below.
      </p>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <MerchantCard key={r.id} row={r} />
        ))}
      </div>
    </section>
  );
}

function MerchantCard({ row }: { row: MerchantRow }) {
  const { pending, run } = useAction();
  const [minimum, setMinimum] = useState(String(row.minimum));
  const [manager, setManager] = useState(row.manager ?? "");

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
        {row.walletLocked && row.plan === "enterprise" ? (
          <span className="flex items-center gap-2">
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
              New orders blocked: wallet not funded at month end
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setWalletLock(row.id, false))}
              className="text-xs font-semibold text-teal-700 hover:underline disabled:opacity-50"
            >
              Lift block
            </button>
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

// ---------------------------------------------------------------------------
// Enterprise Plan v2 (migration 0038)
// ---------------------------------------------------------------------------

const toNull = (s: string): number | null => (s.trim() === "" ? null : Number(s.replace(/[^0-9.]/g, "")) || 0);
const money = (v: number | null | undefined): string => (v === null || v === undefined ? "" : String(v));

function RateField({
  label,
  value,
  onChange,
  prefix = "₦",
  suffix,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("text-xs font-semibold text-graphite", disabled && "opacity-50")}>
      {label}
      <span className="mt-1 flex items-center gap-1.5">
        {prefix ? <span className="text-graphite">{prefix}</span> : null}
        <input
          value={value}
          disabled={disabled}
          placeholder="TBC"
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
          className={cn(field, "w-28")}
        />
        {suffix ? <span className="whitespace-nowrap text-[11px] text-mist">{suffix}</span> : null}
      </span>
    </label>
  );
}

function AddOnToggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
        on ? "bg-success/15 text-success" : "bg-stone text-graphite",
      )}
    >
      <span className={cn("size-2 rounded-full", on ? "bg-success" : "bg-mist")} />
      {label}: {on ? "On" : "Off"}
    </button>
  );
}

export type EnterpriseRateCardMerchant = {
  id: string;
  name: string;
  rates: import("@/types/db").EnterpriseRates | null;
};

export function EnterpriseRateCards({
  merchants,
  defaults,
}: {
  merchants: EnterpriseRateCardMerchant[];
  defaults: EnterpriseDefaults;
}) {
  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-[0.08em] text-graphite">Enterprise rate cards</h2>
      <p className="mb-3 text-sm text-graphite">
        Set each Enterprise merchant&apos;s prices after their consultation. Leave a field blank to keep it &ldquo;quoted
        on consultation&rdquo;. Add-ons only bill when switched on.
      </p>
      {merchants.length === 0 ? (
        <p className="rounded-lg border border-stone bg-card px-4 py-5 text-sm text-mist">No Enterprise merchants yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {merchants.map((m) => (
            <EnterpriseRateCard key={m.id} merchant={m} defaults={defaults} />
          ))}
        </div>
      )}
    </section>
  );
}

function EnterpriseRateCard({ merchant, defaults }: { merchant: EnterpriseRateCardMerchant; defaults: EnterpriseDefaults }) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const r = merchant.rates;

  const [annualSub, setAnnualSub] = useState(money(r?.annual_subscription));
  const [storageBasis, setStorageBasis] = useState<"pallet" | "m3">(r?.storage_basis ?? "pallet");
  const [storageRate, setStorageRate] = useState(money(r?.storage_rate));
  const [month1Pct, setMonth1Pct] = useState(r?.month1_discount_pct != null ? String(r.month1_discount_pct) : "50");
  const [ppFirst, setPpFirst] = useState(money(r?.pickpack_first));
  const [ppAdditional, setPpAdditional] = useState(money(r?.pickpack_additional));
  const [intakeOverride, setIntakeOverride] = useState(r?.intake_tier_override ?? false);
  const [intakeFlat, setIntakeFlat] = useState(money(r?.intake_flat));
  const [kittingEnabled, setKittingEnabled] = useState(r?.kitting_enabled ?? false);
  const [kittingSimple, setKittingSimple] = useState(money(r?.kitting_simple));
  const [kittingStandard, setKittingStandard] = useState(money(r?.kitting_standard));
  const [kittingComplex, setKittingComplex] = useState(money(r?.kitting_complex));
  const [returnsEnabled, setReturnsEnabled] = useState(r?.returns_enabled ?? false);
  const [returnsProcessing, setReturnsProcessing] = useState(money(r?.returns_processing));
  const [returnsDisposal, setReturnsDisposal] = useState(money(r?.returns_disposal));
  const [codEnabled, setCodEnabled] = useState(r?.cod_enabled ?? false);
  const [codRate, setCodRate] = useState(money(r?.cod_rate));
  const [specialEnabled, setSpecialEnabled] = useState(r?.special_projects_enabled ?? false);
  const [specialHr, setSpecialHr] = useState(money(r?.special_projects_hr));
  const [insurancePct, setInsurancePct] = useState(String(((r?.insurance_rate ?? defaults.ent_insurance_rate) || 0.0025) * 100));

  function save() {
    const payload = {
      annual_subscription: toNull(annualSub),
      storage_basis: storageBasis,
      storage_rate: toNull(storageRate),
      month1_discount_pct: Number(month1Pct) || 0,
      pickpack_first: toNull(ppFirst),
      pickpack_additional: toNull(ppAdditional),
      intake_tier_override: intakeOverride,
      intake_flat: toNull(intakeFlat),
      kitting_enabled: kittingEnabled,
      kitting_simple: toNull(kittingSimple),
      kitting_standard: toNull(kittingStandard),
      kitting_complex: toNull(kittingComplex),
      returns_enabled: returnsEnabled,
      returns_processing: toNull(returnsProcessing),
      returns_disposal: toNull(returnsDisposal),
      cod_enabled: codEnabled,
      cod_rate: toNull(codRate),
      special_projects_enabled: specialEnabled,
      special_projects_hr: toNull(specialHr),
      insurance_rate: insurancePct.trim() === "" ? null : (Number(insurancePct) || 0) / 100,
    };
    run(() => setEnterpriseRates(merchant.id, payload));
  }

  return (
    <div className="rounded-lg border border-stone bg-card p-4">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 text-left">
        <span className="font-semibold text-navy">{merchant.name}</span>
        <span className="text-xs font-semibold text-teal-700">{open ? "Hide rate card" : r ? "Edit rate card" : "Set rate card"}</span>
      </button>
      {open ? (
        <div className="mt-4 flex flex-col gap-5 border-t border-stone pt-4">
          <div>
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-mist">Core</h3>
            <div className="flex flex-wrap gap-3">
              <RateField label="Annual subscription" value={annualSub} onChange={setAnnualSub} suffix="/ year" />
              <label className="text-xs font-semibold text-graphite">
                Storage basis
                <select
                  value={storageBasis}
                  onChange={(e) => setStorageBasis(e.target.value as "pallet" | "m3")}
                  className={cn(field, "mt-1 block w-36")}
                >
                  <option value="pallet">Per pallet</option>
                  <option value="m3">Per m³</option>
                </select>
              </label>
              <RateField label="Storage rate" value={storageRate} onChange={setStorageRate} suffix={storageBasis === "m3" ? "/ m³ / mo" : "/ pallet / mo"} />
              <RateField label="Month-1 discount" value={month1Pct} onChange={setMonth1Pct} prefix="" suffix="%" />
              <RateField label="Pick & pack — first" value={ppFirst} onChange={setPpFirst} suffix="/ order" />
              <RateField label="Pick & pack — additional" value={ppAdditional} onChange={setPpAdditional} suffix="/ item" />
              <RateField label="Insurance" value={insurancePct} onChange={setInsurancePct} prefix="" suffix="% of stock value" />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-3">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-mist">Intake / restock</h3>
              <AddOnToggle on={intakeOverride} onToggle={() => setIntakeOverride((v) => !v)} label="Flat-rate override" />
            </div>
            {intakeOverride ? (
              <RateField label="Flat intake / restock fee" value={intakeFlat} onChange={setIntakeFlat} suffix="/ shipment" />
            ) : (
              <p className="text-xs text-graphite">Using the standard tiers (set in Enterprise defaults).</p>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-mist">Add-ons</h3>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-end gap-3">
                <AddOnToggle on={kittingEnabled} onToggle={() => setKittingEnabled((v) => !v)} label="Kitting" />
                <RateField label="Simple" value={kittingSimple} onChange={setKittingSimple} suffix="/ kit" disabled={!kittingEnabled} />
                <RateField label="Standard" value={kittingStandard} onChange={setKittingStandard} suffix="/ kit" disabled={!kittingEnabled} />
                <RateField label="Complex" value={kittingComplex} onChange={setKittingComplex} suffix="/ kit" disabled={!kittingEnabled} />
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <AddOnToggle on={returnsEnabled} onToggle={() => setReturnsEnabled((v) => !v)} label="Returns" />
                <RateField label="Processing" value={returnsProcessing} onChange={setReturnsProcessing} suffix="/ return" disabled={!returnsEnabled} />
                <RateField label="Disposal" value={returnsDisposal} onChange={setReturnsDisposal} suffix="/ unit" disabled={!returnsEnabled} />
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <AddOnToggle on={codEnabled} onToggle={() => setCodEnabled((v) => !v)} label="COD" />
                <RateField label="COD handling" value={codRate} onChange={setCodRate} suffix="/ COD order" disabled={!codEnabled} />
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <AddOnToggle on={specialEnabled} onToggle={() => setSpecialEnabled((v) => !v)} label="Special projects" />
                <RateField label="Rate" value={specialHr} onChange={setSpecialHr} suffix="/ hr" disabled={!specialEnabled} />
              </div>
            </div>
          </div>

          <div>
            <Button size="sm" disabled={pending} onClick={save}>
              Save rate card
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// --- Global Enterprise defaults -----------------------------------------------

export function EnterpriseDefaultsPanel({ defaults }: { defaults: EnterpriseDefaults }) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({
    ent_annual_subscription: money(defaults.ent_annual_subscription),
    ent_storage_pallet_rate: money(defaults.ent_storage_pallet_rate),
    ent_storage_m3_rate: money(defaults.ent_storage_m3_rate),
    ent_pickpack_first: money(defaults.ent_pickpack_first),
    ent_pickpack_additional: money(defaults.ent_pickpack_additional),
    ent_kitting_simple: money(defaults.ent_kitting_simple),
    ent_kitting_standard: money(defaults.ent_kitting_standard),
    ent_kitting_complex: money(defaults.ent_kitting_complex),
    ent_returns_processing: money(defaults.ent_returns_processing),
    ent_returns_disposal: money(defaults.ent_returns_disposal),
    ent_cod_rate: money(defaults.ent_cod_rate),
    ent_special_projects_hr: money(defaults.ent_special_projects_hr),
    ent_insurance_rate: String((defaults.ent_insurance_rate || 0.0025) * 100),
    ent_intake_free_max: String(defaults.ent_intake_free_max ?? 300),
    ent_intake_tier2: money(defaults.ent_intake_tier2),
    ent_intake_tier3: money(defaults.ent_intake_tier3),
    ent_intake_tier4: money(defaults.ent_intake_tier4),
  });
  const set = (k: keyof typeof v) => (val: string) => setV((p) => ({ ...p, [k]: val }));

  function save() {
    run(() =>
      setEnterpriseDefaults({
        ent_annual_subscription: toNull(v.ent_annual_subscription),
        ent_storage_pallet_rate: toNull(v.ent_storage_pallet_rate),
        ent_storage_m3_rate: toNull(v.ent_storage_m3_rate),
        ent_pickpack_first: toNull(v.ent_pickpack_first),
        ent_pickpack_additional: toNull(v.ent_pickpack_additional),
        ent_kitting_simple: toNull(v.ent_kitting_simple),
        ent_kitting_standard: toNull(v.ent_kitting_standard),
        ent_kitting_complex: toNull(v.ent_kitting_complex),
        ent_returns_processing: toNull(v.ent_returns_processing),
        ent_returns_disposal: toNull(v.ent_returns_disposal),
        ent_cod_rate: toNull(v.ent_cod_rate),
        ent_special_projects_hr: toNull(v.ent_special_projects_hr),
        ent_insurance_rate: v.ent_insurance_rate.trim() === "" ? null : (Number(v.ent_insurance_rate) || 0) / 100,
        ent_intake_free_max: Number(v.ent_intake_free_max) || 0,
        ent_intake_tier2: toNull(v.ent_intake_tier2),
        ent_intake_tier3: toNull(v.ent_intake_tier3),
        ent_intake_tier4: toNull(v.ent_intake_tier4),
      }),
    );
  }

  return (
    <Panel accent="teal">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-2 text-left">
        <span>
          <h2 className="text-base font-semibold text-navy">Enterprise default rates</h2>
          <p className="mt-1 text-sm text-graphite">
            Seed new rate cards and prefill the public Enterprise calculator. One place — no code change when the CEO
            confirms amounts.
          </p>
        </span>
        <span className="text-xs font-semibold text-teal-700">{open ? "Hide" : "Edit"}</span>
      </button>
      {open ? (
        <div className="mt-4 flex flex-col gap-4 border-t border-stone pt-4">
          <div className="flex flex-wrap gap-3">
            <RateField label="Annual subscription" value={v.ent_annual_subscription} onChange={set("ent_annual_subscription")} suffix="/ year" />
            <RateField label="Storage — per pallet" value={v.ent_storage_pallet_rate} onChange={set("ent_storage_pallet_rate")} suffix="/ mo" />
            <RateField label="Storage — per m³" value={v.ent_storage_m3_rate} onChange={set("ent_storage_m3_rate")} suffix="/ mo" />
            <RateField label="Pick & pack — first" value={v.ent_pickpack_first} onChange={set("ent_pickpack_first")} suffix="/ order" />
            <RateField label="Pick & pack — additional" value={v.ent_pickpack_additional} onChange={set("ent_pickpack_additional")} suffix="/ item" />
            <RateField label="Insurance" value={v.ent_insurance_rate} onChange={set("ent_insurance_rate")} prefix="" suffix="%" />
          </div>
          <div className="flex flex-wrap gap-3">
            <RateField label="Kitting — simple" value={v.ent_kitting_simple} onChange={set("ent_kitting_simple")} suffix="/ kit" />
            <RateField label="Kitting — standard" value={v.ent_kitting_standard} onChange={set("ent_kitting_standard")} suffix="/ kit" />
            <RateField label="Kitting — complex" value={v.ent_kitting_complex} onChange={set("ent_kitting_complex")} suffix="/ kit" />
            <RateField label="Returns processing" value={v.ent_returns_processing} onChange={set("ent_returns_processing")} suffix="/ return" />
            <RateField label="Returns disposal" value={v.ent_returns_disposal} onChange={set("ent_returns_disposal")} suffix="/ unit" />
            <RateField label="COD handling" value={v.ent_cod_rate} onChange={set("ent_cod_rate")} suffix="/ order" />
            <RateField label="Special projects" value={v.ent_special_projects_hr} onChange={set("ent_special_projects_hr")} suffix="/ hr" />
          </div>
          <div className="flex flex-wrap gap-3">
            <RateField label="Intake free up to" value={v.ent_intake_free_max} onChange={set("ent_intake_free_max")} prefix="" suffix="units" />
            <RateField label="Intake tier (–500)" value={v.ent_intake_tier2} onChange={set("ent_intake_tier2")} suffix="/ shipment" />
            <RateField label="Intake tier (501–1,000)" value={v.ent_intake_tier3} onChange={set("ent_intake_tier3")} suffix="/ shipment" />
            <RateField label="Intake tier (1,001+)" value={v.ent_intake_tier4} onChange={set("ent_intake_tier4")} suffix="/ shipment" />
          </div>
          <div>
            <Button size="sm" disabled={pending} onClick={save}>
              Save defaults
            </Button>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

// --- Pending Enterprise invoices (admin review before sending) ----------------

export type PendingInvoiceRow = {
  id: string;
  number: string;
  merchant: string;
  period: string;
  total: number;
  lines: {
    id: string;
    kind: string;
    label: string;
    quantity: number | null;
    unitRate: number | null;
    amount: number;
    source: "auto" | "manual";
  }[];
};

export function PendingInvoices({ rows }: { rows: PendingInvoiceRow[] }) {
  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-[0.08em] text-graphite">
        Enterprise invoices to review{rows.length ? ` (${rows.length})` : ""}
      </h2>
      <p className="mb-3 text-sm text-graphite">
        Draft invoices built from each merchant&apos;s rate card. Add, edit or remove lines (kitting, COD and special
        projects are added here), then finalise to send it to the merchant.
      </p>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-stone bg-card px-4 py-5 text-sm text-mist">
          No pending invoices. Run billing for a finished month to build them.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((inv) => (
            <PendingInvoiceCard key={inv.id} invoice={inv} />
          ))}
        </div>
      )}
    </section>
  );
}

function PendingInvoiceCard({ invoice }: { invoice: PendingInvoiceRow }) {
  const { pending, run } = useAction();
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="rounded-lg border border-stone bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-mono text-xs font-semibold text-navy">{invoice.number}</span>
          <span className="text-graphite"> · {invoice.merchant}</span>
          <span className="text-xs text-mist"> · {monthName(invoice.period)}</span>
        </div>
        <span className="font-semibold tabular-nums text-navy">{naira(invoice.total)}</span>
      </div>

      <table className="mt-3 w-full border-t border-stone text-sm">
        <tbody className="divide-y divide-stone">
          {invoice.lines.map((l) => (
            <tr key={l.id}>
              <td className="py-1.5 text-navy">
                {l.label}
                {l.source === "manual" ? <span className="ml-2 text-[10px] font-semibold uppercase text-teal-700">added</span> : null}
              </td>
              <td className="py-1.5 text-right font-semibold tabular-nums text-navy">{naira(l.amount)}</td>
              <td className="py-1.5 pl-3 text-right">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => removeInvoiceLine(l.id))}
                  className="text-xs font-semibold text-destructive hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-stone pt-3">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Add a line (e.g. Kitting — 20 kits)"
          className={cn(field, "min-w-48 flex-1")}
        />
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="₦ amount"
          className={cn(field, "w-32")}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={pending || !label.trim() || amount === ""}
          onClick={() =>
            run(async () => {
              const res = await upsertInvoiceLine({
                lineId: null,
                invoiceId: invoice.id,
                kind: "manual",
                label,
                quantity: null,
                unitRate: null,
                amount: Number(amount) || 0,
              });
              if (res.ok) {
                setLabel("");
                setAmount("");
              }
              return res;
            })
          }
        >
          Add line
        </Button>
        {confirming ? (
          <>
            <Button size="sm" disabled={pending} onClick={() => run(() => finalizeInvoice(invoice.id))}>
              Confirm & send
            </Button>
            <button type="button" onClick={() => setConfirming(false)} className="text-xs font-semibold text-graphite hover:underline">
              Cancel
            </button>
          </>
        ) : (
          <Button size="sm" disabled={pending} onClick={() => setConfirming(true)}>
            Finalise & send
          </Button>
        )}
      </div>
    </div>
  );
}
