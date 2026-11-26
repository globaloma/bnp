import { naira } from "@/lib/format";
import { methodLabel } from "@/lib/delivery-methods";
import type { InvoiceStatement } from "@/lib/invoice-statement";

// A self-contained, print-optimized invoice/statement. The print CSS hides
// the surrounding dashboard chrome so "Download / Print" yields a clean page.
// Presentational only (no hooks) so it can render on the server.

function monthName(period: string) {
  const [y, m] = period.slice(0, 7).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-NG", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function shortDate(value: string) {
  return new Date(value).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Lagos",
  });
}

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-teal/10 text-teal-700",
  pending: "bg-teal/10 text-teal-700",
  unpaid: "bg-gold/15 text-gold-300",
  paid: "bg-success/10 text-success",
  void: "bg-stone text-graphite",
};

export function InvoiceDocument({ statement }: { statement: InvoiceStatement }) {
  const s = statement;
  const title = s.draft ? "Statement (this month so far)" : "Invoice";
  const label =
    s.status === "draft"
      ? "Running draft"
      : s.status === "pending"
        ? "Being prepared"
        : s.status === "void"
          ? "Cancelled"
          : s.status === "paid"
            ? "Paid"
            : "Due";

  return (
    <div id="invoice-doc" className="mx-auto max-w-3xl rounded-xl border border-stone bg-white p-6 text-navy sm:p-10">
      {/* Print rules: show only this document, hide dashboard chrome. */}
      <style>{`@media print{body *{visibility:hidden!important}#invoice-doc,#invoice-doc *{visibility:visible!important}#invoice-doc{position:absolute;left:0;top:0;width:100%;border:0;padding:0;margin:0}.no-print{display:none!important}}`}</style>

      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-stone pb-5">
        <div>
          <div className="font-display text-xl font-bold tracking-tight text-navy">BNP Fulfillment</div>
          <div className="mt-0.5 text-xs text-graphite">Warehousing, fulfillment &amp; delivery</div>
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite">{title}</div>
          {s.number ? <div className="font-mono text-lg font-bold text-navy">{s.number}</div> : null}
          <span
            className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[s.status] ?? ""}`}
          >
            {label}
          </span>
        </div>
      </header>

      <section className="grid gap-4 py-5 text-sm sm:grid-cols-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-graphite">Bill to</div>
          <div className="mt-1 font-semibold text-navy">{s.partner.businessName}</div>
          {s.partner.email ? <div className="text-graphite">{s.partner.email}</div> : null}
          {s.partner.phone ? <div className="text-graphite">{s.partner.phone}</div> : null}
        </div>
        <div className="sm:text-right">
          <dl className="space-y-0.5 text-graphite">
            <div className="sm:flex sm:justify-end sm:gap-2">
              <dt>Billing period:</dt>
              <dd className="font-semibold text-navy">{monthName(s.period)}</dd>
            </div>
            {s.dueAt ? (
              <div className="sm:flex sm:justify-end sm:gap-2">
                <dt>Due:</dt>
                <dd className="font-semibold text-navy">{shortDate(s.dueAt)}</dd>
              </div>
            ) : null}
            {s.paidAt ? (
              <div className="sm:flex sm:justify-end sm:gap-2">
                <dt>Paid:</dt>
                <dd className="font-semibold text-navy">{shortDate(s.paidAt)}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </section>

      {s.draft ? (
        <p className="mb-4 rounded-md bg-teal/5 px-3 py-2 text-xs text-graphite">
          This is a running total for the current month. It updates as orders are delivered and dispatched, and is
          finalized into an invoice at the start of next month.
        </p>
      ) : null}

      {s.itemized ? (
        <>
          {s.status === "pending" ? (
            <p className="mb-4 rounded-md bg-teal/5 px-3 py-2 text-xs text-graphite">
              We&apos;re still preparing this invoice from your rate card. The lines below may change before it&apos;s
              finalised and sent to you.
            </p>
          ) : null}
          <Section title="Charges this month">
            {s.lines.length === 0 ? (
              <Empty>No charges this period.</Empty>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-[0.08em] text-mist">
                    <th className="py-1 font-semibold">Service</th>
                    <th className="py-1 text-right font-semibold">Qty</th>
                    <th className="py-1 text-right font-semibold">Rate</th>
                    <th className="py-1 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {s.lines.map((l, i) => (
                    <tr key={i} className="border-t border-stone/70">
                      <td className="py-1.5 text-navy">{l.label}</td>
                      <td className="py-1.5 text-right tabular-nums text-graphite">
                        {l.quantity === null ? "—" : l.quantity}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-graphite">
                        {l.unitRate === null ? "—" : naira(l.unitRate)}
                      </td>
                      <td className="py-1.5 text-right font-semibold tabular-nums text-navy">{naira(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        </>
      ) : (
        <>
      {/* Storage */}
      <Section title="Storage">
        <Row
          left={
            <>
              Storage space
              <span className="text-graphite">
                {" "}
                ·{" "}
                {[
                  s.storage.crates ? `${s.storage.crates} crate${s.storage.crates === 1 ? "" : "s"}` : null,
                  s.storage.pallets ? `${s.storage.pallets} pallet${s.storage.pallets === 1 ? "" : "s"}` : null,
                ]
                  .filter(Boolean)
                  .join(", ") || `${s.storage.sqm} m²`}
              </span>
            </>
          }
          sub={
            s.storage.pallets
              ? `${naira(s.storage.crateRate)} per crate + ${naira(s.storage.rate)} per m² for pallets / month`
              : `${naira(s.storage.crateRate)} per crate / month`
          }
          amount={s.storage.amount}
        />
      </Section>

      {/* Fulfillment */}
      <Section title={`Fulfillment — ${Math.round(s.fulfillment.rate * 100)}% of goods delivered`}>
        {s.fulfillment.lines.length === 0 ? (
          <Empty>No deliveries this period.</Empty>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.08em] text-mist">
                <th className="py-1 font-semibold">Order</th>
                <th className="py-1 font-semibold">Delivered</th>
                <th className="py-1 font-semibold">Item</th>
                <th className="py-1 text-right font-semibold">Goods value</th>
              </tr>
            </thead>
            <tbody>
              {s.fulfillment.lines.map((l, i) => (
                <tr key={i} className="border-t border-stone/70">
                  <td className="py-1.5 font-mono text-[11px]">{l.orderRef}</td>
                  <td className="py-1.5 text-graphite">{shortDate(l.date)}</td>
                  <td className="py-1.5">
                    {l.quantity}× {l.product} <span className="text-mist">· {l.customer}</span>
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{naira(l.goodsValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Subtotal label={`${Math.round(s.fulfillment.rate * 100)}% of ${naira(s.fulfillment.salesValue)}`} amount={s.fulfillment.amount} />
      </Section>

      {/* Restock (Standard add-on, only when it applied this period) */}
      {s.restock.amount > 0 ? (
        <Section title="Restock fee">
          <Row
            left={
              <>
                Restock shipments
                {s.restock.shipments ? (
                  <span className="text-graphite">
                    {" "}
                    · {s.restock.shipments} shipment{s.restock.shipments === 1 ? "" : "s"} over {s.restock.threshold} units
                  </span>
                ) : null}
              </>
            }
            sub={`${naira(s.restock.fee)} per restock shipment over ${s.restock.threshold} units`}
            amount={s.restock.amount}
          />
        </Section>
      ) : null}

      {/* Delivery */}
      <Section title="Delivery fees BNP handled for you">
        {s.delivery.lines.length === 0 ? (
          <Empty>No BNP-handled deliveries this period.</Empty>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.08em] text-mist">
                <th className="py-1 font-semibold">Order</th>
                <th className="py-1 font-semibold">Dispatched</th>
                <th className="py-1 font-semibold">Mode</th>
                <th className="py-1 text-right font-semibold">Fee</th>
              </tr>
            </thead>
            <tbody>
              {s.delivery.lines.map((l, i) => (
                <tr key={i} className="border-t border-stone/70">
                  <td className="py-1.5 font-mono text-[11px]">{l.orderRef}</td>
                  <td className="py-1.5 text-graphite">{shortDate(l.date)}</td>
                  <td className="py-1.5">
                    {methodLabel(l.method)}
                    {l.zone ? <span className="text-mist"> · {l.zone}</span> : null}
                    <span className="ml-1 rounded bg-gold/15 px-1 text-[9px] font-semibold text-gold-300">BNP paid</span>
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{naira(l.fee)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Subtotal label="Delivery subtotal" amount={s.delivery.amount} />
      </Section>
        </>
      )}

      {/* Total */}
      <div className="mt-6 flex items-center justify-between border-t-2 border-navy pt-4">
        <div className="text-sm font-semibold text-navy">
          {s.draft ? "Projected total" : s.status === "pending" ? "Total (in preparation)" : "Total due"}
        </div>
        <div className="font-display text-2xl font-bold tabular-nums text-navy">{naira(s.total)}</div>
      </div>

      <footer className="mt-6 border-t border-stone pt-4 text-[11px] text-graphite">
        <p>
          Payable from your BNP wallet (balance {naira(s.walletBalance)}) or by card/transfer. Invoices are due within
          3 days of issue; unpaid invoices pause new orders and stock deliveries until settled.
        </p>
        <p className="mt-1">Thank you for fulfilling with BNP.</p>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-teal-700">{title}</h3>
      {children}
    </section>
  );
}

function Row({ left, sub, amount }: { left: React.ReactNode; sub?: string; amount: number }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-stone/70 py-1.5 text-sm">
      <div>
        <div className="text-navy">{left}</div>
        {sub ? <div className="text-[11px] text-mist">{sub}</div> : null}
      </div>
      <div className="tabular-nums text-navy">{naira(amount)}</div>
    </div>
  );
}

function Subtotal({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="mt-1 flex items-center justify-between border-t border-stone pt-1.5 text-xs">
      <span className="text-graphite">{label}</span>
      <span className="font-semibold tabular-nums text-navy">{naira(amount)}</span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-xs text-mist">{children}</p>;
}
