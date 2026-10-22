import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CalendarClock, ShieldCheck, UserRound } from "lucide-react";
import { getAuthedPartner } from "@/lib/data/partner";
import { createClient } from "@/lib/supabase/server";
import { naira } from "@/lib/format";
import { PageHeader, Panel, StatCard } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/button";
import type { BillingCharge, Invoice } from "@/types/db";
import { DeclaredValues, InvoiceList, type DeclaredRow } from "./billing-client";

export const metadata: Metadata = { title: "Billing" };

/** The 1st of the month after billing starts, when the first run happens. */
function firstRunDate(startMonth: string) {
  const d = new Date(startMonth + "T00:00:00+01:00");
  d.setMonth(d.getMonth() + 1);
  return d;
}

function beforeFirstRun(startMonth: string) {
  return Date.now() < firstRunDate(startMonth).getTime();
}

function monthName(date: string) {
  return new Date(date + "T12:00:00Z").toLocaleDateString("en-NG", { month: "long", year: "numeric" });
}

export default async function BillingPage() {
  const auth = await getAuthedPartner();
  if (!auth?.partner) redirect("/login");
  const { partner } = auth;
  const enterprise = partner.plan_type === "enterprise";

  const supabase = await createClient();
  const [{ data: settings }, { data: invoices }, { data: charges }, { data: products }, { data: requests }] =
    await Promise.all([
      supabase.from("billing_settings").select("*").single(),
      supabase.from("invoices").select("*").eq("partner_id", partner.id).order("period", { ascending: false }),
      supabase
        .from("billing_charges")
        .select("*")
        .eq("partner_id", partner.id)
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("products")
        .select("id, name, variant, sku, on_hand, declared_value")
        .eq("partner_id", partner.id)
        .order("name"),
      supabase
        .from("declared_value_requests")
        .select("product_id, requested_value, status")
        .eq("partner_id", partner.id)
        .eq("status", "pending"),
    ]);

  const startMonth = settings?.start_month as string | undefined;
  const pendingByProduct = new Map((requests ?? []).map((r) => [r.product_id as string, Number(r.requested_value)]));
  const declared: DeclaredRow[] = (products ?? []).map((p) => ({
    id: p.id,
    label: p.variant ? `${p.name} (${p.variant})` : p.name,
    sku: p.sku,
    onHand: p.on_hand,
    value: p.declared_value === null ? null : Number(p.declared_value),
    pending: pendingByProduct.get(p.id) ?? null,
  }));
  const stockValue = declared.reduce((s, d) => s + d.onHand * (d.value ?? 0), 0);
  const missing = declared.filter((d) => d.value === null && d.onHand > 0).length;
  const storageMonthly = Number(partner.storage_sqm) * Number(settings?.storage_rate ?? 10000);
  const insuranceMonthly = Math.round(stockValue * Number(settings?.insurance_rate ?? 0.0025) * 100) / 100;
  const unpaid = ((invoices ?? []) as Invoice[]).filter((i) => i.status === "unpaid");

  return (
    <>
      <PageHeader
        title="Billing"
        description={
          enterprise
            ? "Your Enterprise plan: charges come out of your wallet as they happen."
            : "Your Standard plan: one invoice at the start of each month."
        }
        action={
          <Button render={<Link href="/dashboard/settings" />} variant="outline" size="lg">
            {enterprise ? "Enterprise plan" : "Standard plan"} · change
          </Button>
        }
      />

      {startMonth && beforeFirstRun(startMonth) ? (
        <Panel accent="teal" className="mb-5">
          <div className="flex gap-3 text-sm text-graphite">
            <CalendarClock className="mt-0.5 size-5 shrink-0 text-teal" />
            <p>
              Automatic billing starts with <strong className="text-navy">{monthName(startMonth)}</strong>. Your first{" "}
              {enterprise ? "monthly deductions happen" : "invoice arrives"} at the start of the following month.
            </p>
          </div>
        </Panel>
      ) : null}

      {partner.billing_locked ? (
        <Panel accent="destructive" className="mb-5 bg-destructive/5">
          <div className="flex gap-3 text-sm">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <p className="text-navy">
              <strong>Your account is paused.</strong> An invoice is overdue, so new orders and new stock deliveries
              are on hold. Pay it below and everything resumes straight away.
            </p>
          </div>
        </Panel>
      ) : null}
      {partner.orders_paused ? (
        <Panel accent="destructive" className="mb-5 bg-destructive/5">
          <div className="flex gap-3 text-sm">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <p className="text-navy">
              <strong>Your orders are paused.</strong> Your wallet has reached its agreed minimum, so the warehouse is
              holding your orders.{" "}
              <Link href="/dashboard/wallet" className="font-semibold text-teal-700 hover:underline">
                Top up your wallet
              </Link>{" "}
              and they&apos;ll go out again automatically.
            </p>
          </div>
        </Panel>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-3">
        {enterprise ? (
          <>
            <StatCard label="Wallet balance" value={naira(partner.wallet_balance)} accent="teal" />
            <StatCard
              label="Agreed minimum"
              value={naira(partner.wallet_buffer)}
              sub="Orders pause if the wallet falls to this"
              accent="gold"
            />
            <StatCard
              label="Next month's fixed charges"
              value={naira(storageMonthly + insuranceMonthly)}
              sub={`Storage ${naira(storageMonthly)} + insurance ${naira(insuranceMonthly)}`}
              accent="success"
            />
          </>
        ) : (
          <>
            <StatCard
              label="To pay now"
              value={naira(unpaid.reduce((s, i) => s + Number(i.total), 0))}
              sub={unpaid.length ? `${unpaid.length} unpaid invoice${unpaid.length === 1 ? "" : "s"}` : "All paid"}
              accent={unpaid.length ? "destructive" : "success"}
            />
            <StatCard label="Storage" value={`${partner.storage_sqm} m²`} sub={`${naira(storageMonthly)} a month`} accent="teal" />
            <StatCard label="Wallet balance" value={naira(partner.wallet_balance)} sub="Can pay invoices" accent="gold" />
          </>
        )}
      </div>

      {enterprise ? (
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <Panel accent="teal">
            <div className="flex items-center gap-2 text-sm font-semibold text-navy">
              <UserRound className="size-4 text-teal" />
              Your account manager
            </div>
            <p className="mt-2 text-sm text-graphite">
              {partner.account_manager ?? "Being assigned. Our team will introduce themselves shortly."}
            </p>
          </Panel>
          <Panel accent="gold">
            <div className="flex items-center gap-2 text-sm font-semibold text-navy">
              <ShieldCheck className="size-4 text-gold" />
              Insurance
            </div>
            <p className="mt-2 text-sm text-graphite">
              Your stock with us is worth <strong className="text-navy">{naira(stockValue)}</strong> at your declared
              values. Insurance is 0.25% of the value at month end, about{" "}
              <strong className="text-navy">{naira(insuranceMonthly)}</strong> a month at today&apos;s stock.
            </p>
            {missing > 0 ? (
              <p className="mt-2 text-xs font-semibold text-destructive">
                {missing} product{missing === 1 ? " has" : "s have"} no declared value, so {missing === 1 ? "it isn't" : "they aren't"} insured yet.
              </p>
            ) : null}
          </Panel>
        </div>
      ) : null}

      {!enterprise ? (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-graphite">Invoices</h2>
          <InvoiceList invoices={(invoices ?? []) as Invoice[]} walletBalance={partner.wallet_balance} />
        </section>
      ) : (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-graphite">Charges</h2>
          <ChargesTable charges={(charges ?? []) as BillingCharge[]} />
        </section>
      )}

      <section>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-[0.08em] text-graphite">Declared stock values</h2>
        <p className="mb-3 text-sm text-graphite">
          The value of one unit of each product, used to insure your stock{enterprise ? "" : " and value your inventory"}.
          Set it once when you add a product; after that, changes go to our team to approve.
        </p>
        <DeclaredValues rows={declared} />
      </section>
    </>
  );
}

function ChargesTable({ charges }: { charges: BillingCharge[] }) {
  if (charges.length === 0) {
    return <p className="rounded-lg border border-stone bg-card px-4 py-5 text-sm text-mist">No charges yet.</p>;
  }
  const label: Record<BillingCharge["kind"], string> = {
    storage: "Storage",
    insurance: "Insurance",
    fulfillment: "Fulfillment (9%)",
    adjustment: "Adjustment",
  };
  return (
    <div className="overflow-x-auto rounded-lg border border-stone bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone text-left text-[11px] uppercase tracking-[0.08em] text-mist">
            <th className="px-4 py-2.5 font-semibold">Date</th>
            <th className="px-4 py-2.5 font-semibold">Charge</th>
            <th className="px-4 py-2.5 font-semibold">Details</th>
            <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone">
          {charges.map((c) => (
            <tr key={c.id}>
              <td className="px-4 py-2.5 text-xs whitespace-nowrap text-graphite">
                {new Date(c.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
              </td>
              <td className="px-4 py-2.5 font-semibold text-navy">{label[c.kind]}</td>
              <td className="px-4 py-2.5 text-xs text-graphite">{c.note}</td>
              <td className="px-4 py-2.5 text-right font-semibold whitespace-nowrap text-navy tabular-nums">
                {c.amount < 0 ? "+" : ""}
                {naira(Math.abs(Number(c.amount)))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
