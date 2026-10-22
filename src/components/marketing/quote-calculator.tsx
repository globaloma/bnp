"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Boxes, Info, Ruler, Send } from "lucide-react";
import { quote } from "@/lib/site-content";
import { naira } from "@/lib/format";
import { estimateQuote, sqmForCartons, type Plan } from "@/lib/quote";
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

export function QuoteCalculator() {
  const [mode, setMode] = useState<"cartons" | "sqm">("cartons");
  const [cartons, setCartons] = useState(40);
  const [sqmInput, setSqmInput] = useState(5);
  const [sales, setSales] = useState(1_000_000);
  const [plan, setPlan] = useState<Plan>("standard");
  const [stockValue, setStockValue] = useState(5_000_000);

  const sqm = mode === "cartons" ? sqmForCartons(cartons) : sqmInput;
  const est = estimateQuote({ sqm, monthlySales: sales, plan, stockValue });
  const ratePct = `${Math.round(est.fulfillmentRate * 100)}%`;
  const share = (n: number) => (est.monthly > 0 ? (n / est.monthly) * 100 : 0);

  const summary = [
    `Stock: ${mode === "cartons" ? `about ${cartons} medium cartons (${est.sqm} m²)` : `${est.sqm} m² of shelf space`}`,
    `Plan: ${plan === "enterprise" ? "Enterprise" : "Standard"}`,
    `Monthly sales: ${naira(sales)}`,
    `Storage: ${naira(est.storagePerMonth)} a month`,
    `Fulfillment (${ratePct}): ${naira(est.fulfillmentPerMonth)} a month`,
    ...(plan === "enterprise"
      ? [`Stock value: ${naira(stockValue)}`, `Insurance (0.25%): ${naira(est.insurancePerMonth)} a month`]
      : []),
    `Estimated monthly cost: ${naira(est.monthly)}`,
    `Yearly registration fee: ${naira(est.subscriptionPerYear)}`,
    `Estimated first year: ${naira(est.firstYear)}`,
  ].join("\n");

  return (
    <div className="flex flex-col gap-16">
      <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:items-start">
        {/* Inputs */}
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-stone bg-white p-2" role="group" aria-label="Plan">
            {(
              [
                ["standard", "Standard", "7% of sales"],
                ["enterprise", "Enterprise", "9% of sales, insured"],
              ] as const
            ).map(([value, label, sub]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPlan(value)}
                aria-pressed={plan === value}
                className={cn(
                  "rounded-xl px-4 py-3 text-left transition-colors",
                  plan === value ? "bg-navy text-white" : "text-graphite hover:bg-cream",
                )}
              >
                <span className="block font-display text-base font-bold">{label}</span>
                <span className={cn("block text-xs", plan === value ? "text-white/70" : "text-mist")}>{sub}</span>
              </button>
            ))}
          </div>
          <fieldset className="rounded-2xl border border-stone bg-white p-6 sm:p-8">
            <legend className="sr-only">How much stock</legend>
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-navy font-display text-sm font-extrabold text-gold">
                1
              </span>
              <h2 className="font-display text-xl font-bold text-navy">How much stock will you store?</h2>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-1.5 rounded-xl bg-cream p-1.5">
              {(
                [
                  ["cartons", "Number of cartons", Boxes],
                  ["sqm", "Floor space (m²)", Ruler],
                ] as const
              ).map(([value, label, IconCmp]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  aria-pressed={mode === value}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors",
                    mode === value ? "bg-navy text-white shadow" : "text-graphite hover:text-navy",
                  )}
                >
                  <IconCmp className="size-4" />
                  {label}
                </button>
              ))}
            </div>

            {mode === "cartons" ? (
              <div className="mt-7">
                <div className="flex items-end justify-between gap-4">
                  <label htmlFor="q-cartons" className="text-[15px] font-semibold text-navy">
                    Medium cartons (about 60 × 40 × 40 cm)
                  </label>
                  <input
                    aria-label="Number of cartons"
                    inputMode="numeric"
                    value={cartons}
                    onChange={(e) => setCartons(clampInt(e.target.value, 1, quote.maxCartons))}
                    className="h-11 w-24 rounded-lg border border-stone bg-cream/50 text-center font-display text-lg font-bold text-navy outline-none focus-visible:border-teal"
                  />
                </div>
                <input
                  id="q-cartons"
                  type="range"
                  min={1}
                  max={300}
                  value={Math.min(cartons, 300)}
                  onChange={(e) => setCartons(Number(e.target.value))}
                  className={cn(sliderClass, "mt-5")}
                />
                <p className="mt-3 text-sm text-graphite">
                  About <span className="font-semibold text-navy">{est.sqm} m²</span> of shelf space.
                  Roughly {quote.cartonsPerSqm} medium cartons fit in one square metre.
                </p>
              </div>
            ) : (
              <div className="mt-7">
                <div className="flex items-end justify-between gap-4">
                  <label htmlFor="q-sqm" className="text-[15px] font-semibold text-navy">
                    Square metres of shelf space
                  </label>
                  <input
                    aria-label="Square metres"
                    inputMode="numeric"
                    value={sqmInput}
                    onChange={(e) => setSqmInput(clampInt(e.target.value, quote.minSqm, quote.maxSqm))}
                    className="h-11 w-24 rounded-lg border border-stone bg-cream/50 text-center font-display text-lg font-bold text-navy outline-none focus-visible:border-teal"
                  />
                </div>
                <input
                  id="q-sqm"
                  type="range"
                  min={quote.minSqm}
                  max={50}
                  value={Math.min(sqmInput, 50)}
                  onChange={(e) => setSqmInput(Number(e.target.value))}
                  className={cn(sliderClass, "mt-5")}
                />
                <p className="mt-3 text-sm text-graphite">
                  One square metre holds about {quote.cartonsPerSqm} medium cartons.
                </p>
              </div>
            )}
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

          {plan === "enterprise" ? (
            <fieldset className="rounded-2xl border border-stone bg-white p-6 sm:p-8">
              <legend className="sr-only">Stock value</legend>
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-navy font-display text-sm font-extrabold text-gold">
                  3
                </span>
                <h2 className="font-display text-xl font-bold text-navy">What is your stock worth?</h2>
              </div>
              <p className="mt-2 text-sm text-graphite">
                The value of the goods you keep with us at a time. Enterprise stock is insured at 0.25% of this a month.
              </p>
              <div className="mt-5 flex items-center gap-3">
                <span className="font-display text-lg font-bold text-graphite">₦</span>
                <input
                  aria-label="Value of stock kept with us, in naira"
                  inputMode="numeric"
                  value={stockValue.toLocaleString("en-NG")}
                  onChange={(e) => setStockValue(clampInt(e.target.value, 0, quote.maxStockValue))}
                  className="h-12 w-full rounded-lg border border-stone bg-cream/50 px-4 font-display text-xl font-bold text-navy outline-none focus-visible:border-teal"
                />
              </div>
            </fieldset>
          ) : null}
        </div>

        {/* Result */}
        <aside className="rounded-2xl bg-navy p-6 text-white shadow-[0_30px_80px_-30px_rgba(15,42,68,0.6)] sm:p-8 lg:sticky lg:top-28">
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-gold-300">Your estimate</span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-5xl font-extrabold tracking-tight tabular-nums" aria-live="polite">
              {naira(est.monthly)}
            </span>
            <span className="text-mist">/ month</span>
          </div>

          <div className="mt-6 flex h-3 overflow-hidden rounded-full bg-white/10" aria-hidden>
            <span className="bg-gold transition-all duration-300" style={{ width: `${share(est.storagePerMonth)}%` }} />
            <span className="bg-teal-300 transition-all duration-300" style={{ width: `${share(est.fulfillmentPerMonth)}%` }} />
            <span className="bg-white/60 transition-all duration-300" style={{ width: `${share(est.insurancePerMonth)}%` }} />
          </div>
          <dl className="mt-5 flex flex-col gap-3 text-[15px]">
            <div className="flex items-center justify-between gap-4">
              <dt className="flex items-center gap-2 text-white/80">
                <span className="size-2.5 rounded-full bg-gold" />
                Storage, {est.sqm} m²
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
            {plan === "enterprise" ? (
              <div className="flex items-center justify-between gap-4">
                <dt className="flex items-center gap-2 text-white/80">
                  <span className="size-2.5 rounded-full bg-white/60" />
                  Insurance, 0.25% of stock value
                </dt>
                <dd className="font-semibold tabular-nums">{naira(est.insurancePerMonth)}</dd>
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
              <div className="mt-1 font-display text-lg font-bold tabular-nums">{naira(est.firstYear)}</div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <Button render={<a href="#quote-request" />} size="xl" className="w-full">
              <Send />
              Send me this quote
            </Button>
            <Button
              render={<Link href={`/signup?plan=${plan}`} />}
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
            An estimate at our standard Abuja prices. Final storage depends on the space your stock actually uses.
            Delivery fees are separate and charged per order.
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
