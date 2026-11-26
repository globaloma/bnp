"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Boxes, Info, MessageCircle } from "lucide-react";
import { quote, whatsappLink, whatsappMessages } from "@/lib/site-content";
import { naira } from "@/lib/format";
import { estimateQuote } from "@/lib/quote";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ContactForm } from "./contact-form";
import { guarantee } from "@/lib/site-content";

// Monthly sales slider stops: finer steps at the low end where most new
// merchants are, wider ones above.
const SALES_STOPS = [
  0, 50_000, 100_000, 250_000, 500_000, 750_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000,
  5_000_000, 7_500_000, 10_000_000, 15_000_000, 20_000_000, 30_000_000, 50_000_000,
];
const SALES_PRESETS = [250_000, 500_000, 1_000_000, 3_000_000];
const BOX_PRESETS = [2, 4, 10, 20];

function nearestStop(value: number): number {
  let best = 0;
  for (let i = 0; i < SALES_STOPS.length; i++) {
    if (Math.abs(SALES_STOPS[i] - value) < Math.abs(SALES_STOPS[best] - value)) best = i;
  }
  return best;
}

function clampInt(raw: string, min: number, max: number): number {
  const n = Math.floor(Number(raw.replace(/[^0-9]/g, "")) || 0);
  return Math.min(max, Math.max(min, n));
}

const sliderClass =
  "h-2 w-full cursor-pointer appearance-none rounded-full bg-stone accent-[#e8a020]";

/** The Standard-plan quote calculator. Enterprise is custom-quoted and has its own tool. */
export function QuoteCalculator() {
  const [boxes, setBoxes] = useState(4);
  const [sales, setSales] = useState(1_000_000);
  const [restockOn, setRestockOn] = useState(false);

  const est = estimateQuote({ boxes, monthlySales: sales });
  const restock = restockOn ? quote.restockFee : 0;
  const monthly = est.monthly + restock;
  const firstYear = est.subscriptionPerYear + monthly * 12;
  const ratePct = `${Math.round(est.fulfillmentRate * 100)}%`;
  const share = (n: number) => (monthly > 0 ? (n / monthly) * 100 : 0);

  const summary = [
    `Plan: Standard`,
    `Storage: ${est.boxes} box${est.boxes === 1 ? "" : "es"} (${quote.boxDimensions}) = ${naira(est.storagePerMonth)} a month`,
    `Monthly sales: ${naira(sales)}`,
    `Fulfillment (${ratePct}): ${naira(est.fulfillmentPerMonth)} a month`,
    ...(restockOn ? [`Restock fee (shipments over ${quote.restockThreshold} units): ${naira(restock)}`] : []),
    `Estimated monthly cost: ${naira(monthly)}`,
    `Yearly registration fee: ${naira(est.subscriptionPerYear)}`,
    `Estimated first year: ${naira(firstYear)}`,
  ].join("\n");

  const whatsappHref = whatsappLink(`${whatsappMessages.quote}\n\nMy estimate:\n${summary}`);

  return (
    <div className="flex flex-col gap-16">
      <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:items-start">
        {/* Inputs */}
        <div className="flex flex-col gap-6">
          <fieldset className="rounded-2xl border border-stone bg-white p-6 sm:p-8">
            <legend className="sr-only">How much stock</legend>
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-navy font-display text-sm font-extrabold text-gold">
                1
              </span>
              <h2 className="font-display text-xl font-bold text-navy">How many boxes will you store?</h2>
            </div>

            <div className="mt-6 flex items-center gap-2.5 rounded-xl bg-cream px-4 py-3 text-sm text-graphite">
              <Boxes className="size-5 shrink-0 text-teal" />
              <span>
                Storage is counted by the box. A standard box is{" "}
                <span className="font-semibold text-navy">{quote.boxDimensions}</span>, billed at{" "}
                <span className="font-semibold text-navy">₦10,000 per 2 boxes</span> a month.
              </span>
            </div>

            <div className="mt-7">
              <div className="flex items-end justify-between gap-4">
                <label htmlFor="q-boxes" className="text-[15px] font-semibold text-navy">
                  Number of boxes
                </label>
                <input
                  aria-label="Number of boxes"
                  inputMode="numeric"
                  value={boxes}
                  onChange={(e) => setBoxes(clampInt(e.target.value, quote.minBoxes, quote.maxBoxes))}
                  className="h-11 w-24 rounded-lg border border-stone bg-cream/50 text-center font-display text-lg font-bold text-navy outline-none focus-visible:border-teal"
                />
              </div>
              <input
                id="q-boxes"
                type="range"
                min={quote.minBoxes}
                max={100}
                value={Math.min(boxes, 100)}
                onChange={(e) => setBoxes(Number(e.target.value))}
                className={cn(sliderClass, "mt-5")}
              />
              <p className="mt-3 text-sm text-graphite">
                {est.boxes} box{est.boxes === 1 ? "" : "es"} works out to{" "}
                <span className="font-semibold text-navy">{naira(est.storagePerMonth)}</span> a month in storage.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {BOX_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setBoxes(p)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors",
                      boxes === p ? "border-navy bg-navy text-white" : "border-stone text-graphite hover:border-gold",
                    )}
                  >
                    {p} boxes
                  </button>
                ))}
              </div>
            </div>
          </fieldset>

          <fieldset className="rounded-2xl border border-stone bg-white p-6 sm:p-8">
            <legend className="sr-only">Monthly sales</legend>
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-navy font-display text-sm font-extrabold text-gold">
                2
              </span>
              <h2 className="font-display text-xl font-bold text-navy">How much do you sell in a month?</h2>
            </div>
            <p className="mt-2 text-sm text-graphite">
              The value of goods you expect to sell through BNP. A rough figure is fine.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <span className="font-display text-lg font-bold text-graphite">₦</span>
              <input
                aria-label="Monthly sales in naira"
                inputMode="numeric"
                value={sales.toLocaleString("en-NG")}
                onChange={(e) => setSales(clampInt(e.target.value, 0, quote.maxMonthlySales))}
                className="h-12 w-full rounded-lg border border-stone bg-cream/50 px-4 font-display text-xl font-bold text-navy outline-none focus-visible:border-teal"
              />
            </div>
            <input
              type="range"
              aria-label="Monthly sales"
              min={0}
              max={SALES_STOPS.length - 1}
              value={nearestStop(sales)}
              onChange={(e) => setSales(SALES_STOPS[Number(e.target.value)])}
              className={cn(sliderClass, "mt-5")}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              {SALES_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSales(p)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors",
                    sales === p ? "border-navy bg-navy text-white" : "border-stone text-graphite hover:border-gold",
                  )}
                >
                  {naira(p)}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="rounded-2xl border border-stone bg-white p-6 sm:p-8">
            <legend className="sr-only">Add-ons</legend>
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-navy font-display text-sm font-extrabold text-gold">
                3
              </span>
              <h2 className="font-display text-xl font-bold text-navy">Any add-ons?</h2>
            </div>
            <label className="mt-6 flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-stone p-4 transition-colors hover:border-gold">
              <span>
                <span className="text-[15px] font-semibold text-navy">Restock fee</span>
                <span className="mt-0.5 block text-sm text-graphite">
                  A flat {naira(quote.restockFee)} on each restock shipment over {quote.restockThreshold} units. Optional,
                  switched on only if you want it.
                </span>
              </span>
              <input
                type="checkbox"
                checked={restockOn}
                onChange={(e) => setRestockOn(e.target.checked)}
                className="mt-1 size-5 shrink-0 cursor-pointer accent-[#e8a020]"
              />
            </label>
          </fieldset>
        </div>

        {/* Result */}
        <aside className="rounded-2xl bg-navy p-6 text-white shadow-[0_30px_80px_-30px_rgba(15,42,68,0.6)] sm:p-8 lg:sticky lg:top-28">
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-gold-300">Your Standard estimate</span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-5xl font-extrabold tracking-tight tabular-nums" aria-live="polite">
              {naira(monthly)}
            </span>
            <span className="text-mist">/ month</span>
          </div>

          <div className="mt-6 flex h-3 overflow-hidden rounded-full bg-white/10" aria-hidden>
            <span className="bg-gold transition-all duration-300" style={{ width: `${share(est.storagePerMonth)}%` }} />
            <span className="bg-teal-300 transition-all duration-300" style={{ width: `${share(est.fulfillmentPerMonth)}%` }} />
          </div>
          <dl className="mt-5 flex flex-col gap-3 text-[15px]">
            <div className="flex items-center justify-between gap-4">
              <dt className="flex items-center gap-2 text-white/80">
                <span className="size-2.5 rounded-full bg-gold" />
                Storage, {est.boxes} box{est.boxes === 1 ? "" : "es"}
              </dt>
              <dd className="font-semibold tabular-nums">{naira(est.storagePerMonth)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="flex items-center gap-2 text-white/80">
                <span className="size-2.5 rounded-full bg-teal-300" />
                Fulfillment, {ratePct} of sales
              </dt>
              <dd className="font-semibold tabular-nums">{naira(est.fulfillmentPerMonth)}</dd>
            </div>
            {restockOn ? (
              <div className="flex items-center justify-between gap-4">
                <dt className="flex items-center gap-2 text-white/80">
                  <span className="size-2.5 rounded-full bg-white/40" />
                  Restock fee
                </dt>
                <dd className="font-semibold tabular-nums">{naira(restock)}</dd>
              </div>
            ) : null}
          </dl>

          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/10 pt-6">
            <div className="rounded-xl bg-white/5 p-4">
              <div className="text-xs text-mist">Yearly registration fee</div>
              <div className="mt-1 font-display text-lg font-bold tabular-nums">{naira(est.subscriptionPerYear)}</div>
            </div>
            <div className="rounded-xl bg-white/5 p-4">
              <div className="text-xs text-mist">First year total</div>
              <div className="mt-1 font-display text-lg font-bold tabular-nums">{naira(firstYear)}</div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <Button
              render={<a href={whatsappHref} target="_blank" rel="noopener noreferrer" />}
              size="xl"
              className="w-full"
            >
              <MessageCircle />
              Get my real quote on WhatsApp
            </Button>
            <a
              href="#quote-request"
              className="text-center text-sm font-semibold text-gold-300 hover:underline"
            >
              Or send it through the form instead
            </a>
            <Button
              render={<Link href={`/signup?plan=standard`} />}
              size="xl"
              variant="outline"
              className="w-full border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              Create my account
              <ArrowRight />
            </Button>
          </div>

          <p className="mt-5 rounded-lg bg-gold/10 p-3 text-xs leading-relaxed text-gold-300">
            {guarantee.short}
          </p>
          <p className="mt-3 flex gap-2 text-xs leading-relaxed text-mist">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            An estimate at our standard prices. Final storage depends on the number of boxes your stock actually uses.
            Delivery fees are separate and charged per order. Selling at high volume or from abroad?{" "}
            <Link href="/enterprise-calculator" className="font-semibold text-gold-300 underline">
              Try the Enterprise calculator
            </Link>
            .
          </p>
        </aside>
      </div>

      <div id="quote-request" className="scroll-mt-28">
        <ContactForm
          variant="quote"
          title="Get this quote confirmed by our team"
          subtitle="We'll check your numbers and reply within 48 hours. No payment needed."
          quoteSummary={summary}
        />
      </div>
    </div>
  );
}
