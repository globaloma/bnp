import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CalendarClock, ShieldCheck, UserRound } from "lucide-react";
import { getAuthedPartner } from "@/lib/data/partner";
import { createClient } from "@/lib/supabase/server";
import { naira } from "@/lib/format";
import { PageHeader, Panel, StatCard } from "@/components/dashboard/ui";
import { Button } from "@/components/ui/button";
import type { EnterpriseRates, Invoice } from "@/types/db";
import { buildInvoiceStatement, currentPeriod } from "@/lib/invoice-statement";
import { DeclaredValues, InvoiceList, RateCardView, type DeclaredRow, type RateCardLine } from "./billing-client";

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

/** When the next monthly deduction runs: the 1st of next month, 00:05 WAT. */
function nextDeduction(startMonth: string | undefined) {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 12));
  const first = startMonth ? firstRunDate(startMonth) : next;
  return (first > next ? first : next).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
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
  const [
    { data: settings },
    { data: invoices },
    { data: products },
    { data: requests },
    { data: rateCard },
  ] = await Promise.all([
      supabase.from("billing_settings").select("*").single(),
      supabase.from("invoices").select("*").eq("partner_id", partner.id).order("period", { ascending: false }),
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
      enterprise
        ? supabase.from("enterprise_rates").select("*").eq("partner_id", partner.id).maybeSingle()
        : Promise.resolve({ data: null }),
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
  const storageBreakdown = [
    partner.storage_crates > 0 ? `${partner.storage_crates} crate${partner.storage_crates === 1 ? "" : "s"}` : null,
    partner.storage_pallets > 0
      ? `${partner.storage_pallets} pallet${partner.storage_pallets === 1 ? "" : "s"}${
          partner.storage_pallet_height_m > 0 ? ` at ${partner.storage_pallet_height_m} m` : ""
        }`
      : null,
  ]
    .filter(Boolean)
    .join(", ");
  const unpaid = ((invoices ?? []) as Invoice[]).filter((i) => i.status === "unpaid");
  const toPayNow = unpaid.reduce((s, i) => s + Number(i.total), 0);
  // Standard: a live running total for the month in progress, so the invoice
  // is never a surprise at month-end.
  const draft = !enterprise
    ? await buildInvoiceStatement(supabase, { partnerId: partner.id, period: currentPeriod() })
    : null;

  // Enterprise: the merchant's agreed rate card (set by us after consultation).
  const rc = (rateCard as EnterpriseRates | null) ?? null;
  const rcLine = (label: string, v: number | null | undefined, suffix = ""): RateCardLine =>
    v === null || v === undefined
      ? { label, value: "To be confirmed", muted: true }
      : { label, value: `${naira(Number(v))}${suffix}` };
  const coreRates: RateCardLine[] = rc
    ? [
        rcLine("Annual subscription", rc.annual_subscription, " / year"),
        rcLine(`Storage (per ${rc.storage_basis === "m3" ? "m³" : "pallet"})`, rc.storage_rate, " / month"),
        rcLine("Pick & pack — first item", rc.pickpack_first, " / order"),
        rcLine("Pick & pack — additional item", rc.pickpack_additional, " / item"),
        {
          label: "Insurance",
          value: `${(Number(rc.insurance_rate ?? 0.0025) * 100).toFixed(2)}% of stock value / month`,
        },
      ]
    : [];
  const addOnRates: RateCardLine[] = rc
    ? [
        ...(rc.kitting_enabled ? [rcLine("Kitting", rc.kitting_standard, " / kit")] : []),
        ...(rc.returns_enabled ? [rcLine("Returns processing", rc.returns_processing, " / return")] : []),
        ...(rc.cod_enabled ? [rcLine("Cash on delivery", rc.cod_rate, " / order")] : []),
        ...(rc.special_projects_enabled ? [rcLine("Special projects", rc.special_projects_hr, " / hour")] : []),
      ]
    : [];
  const entInsuranceMonthly =
    Math.round(stockValue * Number(rc?.insurance_rate ?? settings?.insurance_rate ?? 0.0025) * 100) / 100;

  return (
    <>
      <PageHeader
        title="Billing"
        description={
          enterprise
            ? "Your Enterprise plan: a custom rate card we agreed at consultation. Each month we prepare an itemised invoice for you to review and pay — no automatic deductions."
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
              Billing starts with <strong className="text-navy">{monthName(startMonth)}</strong>. Your first invoice
              {enterprise ? " is prepared for your review" : " arrives"} at the start of the following month.
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
            <StatCard
              label="To pay now"
              value={naira(toPayNow)}
              sub={unpaid.length ? `${unpaid.length} invoice${unpaid.length === 1 ? "" : "s"} to pay` : "All paid"}
              accent={unpaid.length ? "destructive" : "success"}
            />
            <StatCard label="Wallet balance" value={naira(partner.wallet_balance)} sub="Can pay invoices" accent="teal" />
            <StatCard
              label="Stock value"
              value={naira(stockValue)}
              sub={missing ? `${missing} product${missing === 1 ? "" : "s"} with no value yet` : "At your declared values"}
              accent="gold"
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
            <StatCard
              label="Storage"
              value={`${partner.storage_sqm} m²`}
              sub={`${naira(storageMonthly)} a month${storageBreakdown ? ` · ${storageBreakdown}` : ""}`}
              accent="teal"
            />
            <StatCard label="Wallet balance" value={naira(partner.wallet_balance)} sub="Can pay invoices" accent="gold" />
            <StatCard
              label="Stock value"
              value={naira(stockValue)}
              sub={missing ? `${missing} product${missing === 1 ? "" : "s"} with no value yet` : "At your declared values"}
              accent="success"
            />
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
              values. Insurance is {(Number(rc?.insurance_rate ?? 0.0025) * 100).toFixed(2)}% of the value at month end,
              about <strong className="text-navy">{naira(entInsuranceMonthly)}</strong> a month at today&apos;s stock.
            </p>
            <p className="mt-2 text-xs text-graphite">
              This appears as a line on your <strong className="text-navy">{nextDeduction(startMonth)}</strong> invoice,
              based on your stock at the end of this month — no automatic wallet deduction.
            </p>
            {missing > 0 ? (
              <p className="mt-2 text-xs font-semibold text-destructive">
                {missing} product{missing === 1 ? " has" : "s have"} no declared value, so {missing === 1 ? "it isn't" : "they aren't"} insured yet.
              </p>
            ) : null}
          </Panel>
        </div>
      ) : null}

      {enterprise ? (
        <section className="mb-8">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-[0.08em] text-graphite">Your rate card</h2>
          <p className="mb-3 text-sm text-graphite">
            The prices we agreed at your consultation. Each item is billed only when it happens, on your monthly invoice.
          </p>
          {rc && (coreRates.length > 0 || addOnRates.length > 0) ? (
            <RateCardView core={coreRates} addOns={addOnRates} />
          ) : (
            <p className="rounded-lg border border-stone bg-card px-4 py-5 text-sm text-mist">
              Your rate card is being set up after your consultation. Your account manager will confirm it shortly.
            </p>
          )}
        </section>
      ) : null}

      {!enterprise && draft ? (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-graphite">This month so far</h2>
          <Panel accent="teal">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1 text-sm text-graphite">
                <div className="text-xs font-semibold uppercase tracking-[0.1em] text-teal-700">
                  {new Date(draft.period + "T12:00:00Z").toLocaleDateString("en-NG", { month: "long", year: "numeric" })} · running total
                </div>
                <div>Storage: <strong className="text-navy">{naira(draft.storage.amount)}</strong></div>
                <div>
                  Fulfillment ({Math.round(draft.fulfillment.rate * 100)}% of {naira(draft.fulfillment.salesValue)}):{" "}
                  <strong className="text-navy">{naira(draft.fulfillment.amount)}</strong>
                </div>
                <div>
                  Delivery BNP handled for you ({draft.delivery.lines.length}):{" "}
                  <strong className="text-navy">{naira(draft.delivery.amount)}</strong>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-mist">Projected total</div>
                <div className="font-display text-2xl font-bold tabular-nums text-navy">{naira(draft.total)}</div>
                <Button size="sm" variant="outline" className="mt-2" render={<Link href="/dashboard/billing/invoices/current" />}>
                  View / download
                </Button>
              </div>
            </div>
            <p className="mt-3 border-t border-stone pt-3 text-xs text-graphite">
              This updates as your orders are delivered and dispatched. It becomes your invoice at the start of next month.
            </p>
          </Panel>
        </section>
      ) : null}

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-graphite">Invoices</h2>
        <InvoiceList invoices={(invoices ?? []) as Invoice[]} walletBalance={partner.wallet_balance} />
      </section>

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
