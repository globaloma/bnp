"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Calculator, Check, ChevronDown, Copy, Info, RotateCcw } from "lucide-react";
import type { EnterpriseDefaults } from "@/types/db";
import { naira } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Public Enterprise cost calculator — spec Part 4. Client-side only, no data
// stored or sent. Section B is prefilled from admin-set defaults and every
// field is overridable with a quoted rate.

type Basis = "pallet" | "m3";

/** Parse a user-typed number: digits and a single dot, never negative. */
function num(s: string): number {
  const n = Number(String(s).replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
const str = (v: number | null, fallback = ""): string => (v === null || v === undefined ? fallback : String(v));

/** Introductory discount on the first month's storage (fee schedule §4). */
const FIRST_MONTH_STORAGE_DISCOUNT = 0.2;

/** Intake fee for the FIRST shipment of `units` (fee schedule §3a): free up to the
 *  intake threshold, then four fixed unit bands. Used in "first month" mode. */
function intakeFee(units: number, d: EnterpriseDefaults): number {
  if (units <= (d.ent_intake_free_max ?? 0)) return 0;
  if (units <= 300) return d.ent_intake_b1 ?? 0;
  if (units <= 500) return d.ent_intake_b2 ?? 0;
  if (units <= 1000) return d.ent_intake_b3 ?? 0;
  return d.ent_intake_b4 ?? 0;
}

/** Restock fee for a subsequent inbound shipment of `units` (fee schedule §3b):
 *  a separate, cheaper schedule with no free band. Used in "ongoing month" mode. */
function restockFee(units: number, d: EnterpriseDefaults): number {
  if (units <= 0) return 0;
  if (units <= 200) return d.ent_restock_b0 ?? 0;
  if (units <= 300) return d.ent_restock_b1 ?? 0;
  if (units <= 500) return d.ent_restock_b2 ?? 0;
  if (units <= 1000) return d.ent_restock_b3 ?? 0;
  return d.ent_restock_b4 ?? 0;
}

const inputClass =
  "h-11 w-full rounded-lg border border-stone bg-white px-3 font-display text-base font-semibold text-navy outline-none focus-visible:border-teal";

function NumberField({
  label,
  help,
  value,
  onChange,
  prefix,
  suffix,
  placeholder = "0",
}: {
  label: string;
  help?: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[13px] font-semibold text-navy">{label}</span>
      {help ? <span className="mt-0.5 block text-xs text-graphite">{help}</span> : null}
      <span className="mt-1.5 flex items-center gap-2">
        {prefix ? <span className="font-display text-sm font-bold text-graphite">{prefix}</span> : null}
        <input
          inputMode="decimal"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
          className={inputClass}
        />
        {suffix ? <span className="whitespace-nowrap text-xs text-graphite">{suffix}</span> : null}
      </span>
    </label>
  );
}

function SectionCard({
  step,
  title,
  description,
  children,
}: {
  step: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded-2xl border border-stone bg-white p-6 sm:p-7">
      <div className="flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-navy font-display text-sm font-extrabold text-gold">
          {step}
        </span>
        <h2 className="font-display text-lg font-bold text-navy">{title}</h2>
      </div>
      {description ? <p className="mt-2 text-sm text-graphite">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </fieldset>
  );
}

export function EnterpriseCostCalculator({ defaults }: { defaults: EnterpriseDefaults }) {
  // First month (intake + month-1 storage discount) vs a typical ongoing month (restock).
  const [period, setPeriod] = useState<"first" | "ongoing">("ongoing");

  // Section A — volume
  const [orders, setOrders] = useState("100");
  const [unitsPerOrder, setUnitsPerOrder] = useState("1.5");
  const [basis, setBasis] = useState<Basis>("pallet");
  const [pallets, setPallets] = useState("4");
  const [cbm, setCbm] = useState("6");
  const [unitsReceived, setUnitsReceived] = useState("250");
  const [containerUnload, setContainerUnload] = useState(false);
  const [returnRate, setReturnRate] = useState("2");
  const [declaredValue, setDeclaredValue] = useState("");

  // Section B — rate card (prefilled from admin defaults, all overridable)
  const [storagePallet, setStoragePallet] = useState(str(defaults.ent_storage_pallet_rate));
  const [storageM3, setStorageM3] = useState(str(defaults.ent_storage_m3_rate));
  const [ppFirst, setPpFirst] = useState(str(defaults.ent_pickpack_first));
  const [ppAdditional, setPpAdditional] = useState(str(defaults.ent_pickpack_additional));
  const [kitting, setKitting] = useState(str(defaults.ent_kitting_standard));
  const [returnsRate, setReturnsRate] = useState(str(defaults.ent_returns_processing));
  const [insurancePct, setInsurancePct] = useState(str(defaults.ent_insurance_rate * 100, "0.25"));
  const [annualSub, setAnnualSub] = useState(str(defaults.ent_annual_subscription));

  // Section C — delivery
  const [includeDelivery, setIncludeDelivery] = useState(false);
  const [deliveryPerOrder, setDeliveryPerOrder] = useState("");

  const [calculated, setCalculated] = useState(false);
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => {
    const o = Math.floor(num(orders));
    const upo = num(unitsPerOrder);
    const rr = Math.min(100, num(returnRate));
    const storageQty = basis === "pallet" ? num(pallets) : num(cbm);
    const storageRate = basis === "pallet" ? num(storagePallet) : num(storageM3);

    const firstMonth = period === "first";
    const unitsIn = num(unitsReceived);
    const handling = containerUnload ? defaults.ent_handling_container ?? 0 : 0;
    const inboundFee = firstMonth ? intakeFee(unitsIn, defaults) : restockFee(unitsIn, defaults);
    const intakeLine = inboundFee + handling;
    const storageGross = storageQty * storageRate;
    const storageLine = firstMonth ? storageGross * (1 - FIRST_MONTH_STORAGE_DISCOUNT) : storageGross;
    const pickFirstLine = o * num(ppFirst);
    const pickAddlLine = o * Math.max(0, upo - 1) * num(ppAdditional);
    const pickpackLine = pickFirstLine + pickAddlLine;
    const kittingLine = o * num(kitting);
    const returnsLine = o * (rr / 100) * num(returnsRate);
    const insuranceLine = num(declaredValue) * (num(insurancePct) / 100);
    const subscriptionLine = num(annualSub) / 12;
    const deliveryLine = includeDelivery ? o * num(deliveryPerOrder) : 0;

    const monthly =
      intakeLine + storageLine + pickpackLine + kittingLine + returnsLine + insuranceLine + subscriptionLine + deliveryLine;
    const perOrderEx = o > 0 ? (monthly - deliveryLine) / o : 0;
    const perOrderInc = o > 0 ? monthly / o : 0;

    const lines = [
      {
        label: firstMonth ? "Intake (first shipment)" : "Restock",
        detail: `${unitsIn} units in${firstMonth ? ` · free ≤ ${defaults.ent_intake_free_max}` : ""}${handling > 0 ? " + container unload" : ""}`,
        amount: intakeLine,
      },
      {
        label: `Storage (${basis === "pallet" ? "pallet" : "m³"})`,
        detail: `${storageQty} ${basis === "pallet" ? "pallet(s)" : "m³"} × ${naira(storageRate)}${firstMonth ? " − 20% month-1" : ""}`,
        amount: storageLine,
      },
      { label: "Pick & pack — first item", detail: `${o} orders`, amount: pickFirstLine },
      {
        label: "Pick & pack — additional items",
        detail: `${o} × ${Math.max(0, upo - 1).toFixed(1)} items`,
        amount: pickAddlLine,
      },
      { label: "Kitting", detail: kittingLine > 0 ? `${o} kits` : "Not included", amount: kittingLine },
      { label: "Returns processing", detail: `${rr}% of ${o} orders`, amount: returnsLine },
      { label: "Insurance", detail: `${num(insurancePct)}% of ${naira(num(declaredValue))}`, amount: insuranceLine },
      { label: "Annual subscription (÷ 12)", detail: "Monthly portion", amount: subscriptionLine },
      {
        label: "Delivery",
        detail: includeDelivery ? `${o} orders × ${naira(num(deliveryPerOrder))}` : "Excluded",
        amount: deliveryLine,
      },
    ];

    return { monthly, perOrderEx, perOrderInc, lines };
  }, [
    period, orders, unitsPerOrder, returnRate, basis, pallets, cbm, storagePallet, storageM3, unitsReceived, containerUnload,
    ppFirst, ppAdditional, kitting, returnsRate, declaredValue, insurancePct, annualSub, includeDelivery, deliveryPerOrder,
    defaults,
  ]);

  function reset() {
    setPeriod("ongoing");
    setOrders("100"); setUnitsPerOrder("1.5"); setBasis("pallet"); setPallets("4"); setCbm("6");
    setUnitsReceived("250"); setContainerUnload(false); setReturnRate("2"); setDeclaredValue("");
    setStoragePallet(str(defaults.ent_storage_pallet_rate));
    setStorageM3(str(defaults.ent_storage_m3_rate)); setPpFirst(str(defaults.ent_pickpack_first));
    setPpAdditional(str(defaults.ent_pickpack_additional)); setKitting(str(defaults.ent_kitting_standard));
    setReturnsRate(str(defaults.ent_returns_processing)); setInsurancePct(str(defaults.ent_insurance_rate * 100, "0.25"));
    setAnnualSub(str(defaults.ent_annual_subscription)); setIncludeDelivery(false); setDeliveryPerOrder("");
    setCalculated(false);
  }

  async function copyResults() {
    const text = [
      `BNP Enterprise — estimated monthly cost (${period === "first" ? "first month" : "ongoing month"})`,
      `Monthly total: ${naira(result.monthly)}`,
      `Cost per order (ex delivery): ${naira(result.perOrderEx)}`,
      `Cost per order (inc delivery): ${naira(result.perOrderInc)}`,
      "",
      ...result.lines.map((l) => `${l.label}: ${naira(l.amount)}`),
      "",
      "Estimate only. Final rates confirmed at consultation.",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-start">
      {/* Inputs */}
      <div className="flex flex-col gap-6">
        {/* Period toggle */}
        <div className="rounded-2xl border border-stone bg-white p-5 sm:p-6">
          <span className="text-[13px] font-semibold text-navy">Which month are you estimating?</span>
          <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-xl bg-cream p-1.5">
            {(
              [
                ["ongoing", "Ongoing month"],
                ["first", "First month"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPeriod(value)}
                aria-pressed={period === value}
                className={cn(
                  "rounded-lg py-2.5 text-sm font-semibold transition-colors",
                  period === value ? "bg-navy text-white shadow" : "text-graphite hover:text-navy",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 flex gap-2 text-xs text-graphite">
            <Info className="mt-0.5 size-3.5 shrink-0 text-teal" />
            {period === "first"
              ? `First month: inbound is charged on the intake schedule (free up to ${defaults.ent_intake_free_max} units), and storage gets the 20% first-month discount.`
              : "A typical ongoing month: inbound is charged on the cheaper restock schedule, and storage bills in full."}
          </p>
        </div>

        {/* Section A */}
        <SectionCard step="A" title="Your volume" description="What you ship and store in a typical month.">
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField label="Orders per month" help="Customer orders you ship each month" value={orders} onChange={setOrders} />
            <NumberField label="Units per order (average)" help="Average items in each order" value={unitsPerOrder} onChange={setUnitsPerOrder} />
          </div>

          <div className="mt-4">
            <span className="text-[13px] font-semibold text-navy">How would you like storage billed?</span>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5 rounded-xl bg-cream p-1.5">
              {(
                [
                  ["pallet", "Per pallet"],
                  ["m3", "Per cubic metre (m³)"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setBasis(value)}
                  aria-pressed={basis === value}
                  className={cn(
                    "rounded-lg py-2.5 text-sm font-semibold transition-colors",
                    basis === value ? "bg-navy text-white shadow" : "text-graphite hover:text-navy",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-2 flex gap-2 text-xs text-graphite">
              <Info className="mt-0.5 size-3.5 shrink-0 text-teal" />
              Not sure? A standard pallet (48″×40″×48″ loaded) is about 1.5 m³. If your 3PL quotes per pallet, choose
              Pallet; if per square or cubic metre, choose m³.
            </p>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {basis === "pallet" ? (
              <NumberField label="Pallets in storage" help="Pallets of stock you hold on average" value={pallets} onChange={setPallets} />
            ) : (
              <NumberField label="Cubic metres in storage (m³)" help="Total m³ of stock held on average" value={cbm} onChange={setCbm} />
            )}
            <NumberField label="Units received per month" help="Units in a typical inbound shipment" value={unitsReceived} onChange={setUnitsReceived} />
            <NumberField label="Return rate (%)" help="Share of orders returned (0 if none)" value={returnRate} onChange={(v) => setReturnRate(v)} suffix="%" />
            <NumberField label="Declared value in storage (₦)" help="For insurance (0.25% of this)" value={declaredValue} onChange={setDeclaredValue} prefix="₦" />
          </div>

          <label className="mt-4 flex items-start gap-3 rounded-xl border border-stone bg-cream/60 p-3">
            <input
              type="checkbox"
              checked={containerUnload}
              onChange={(e) => setContainerUnload(e.target.checked)}
              className="mt-0.5 size-4 accent-navy"
            />
            <span className="text-[13px] text-navy">
              <span className="font-semibold">Shipment arrives in a container</span>
              <span className="block text-xs text-graphite">
                Adds a one-off unload &amp; floor-setup fee
                {defaults.ent_handling_container ? ` (${naira(defaults.ent_handling_container)})` : ""}.
              </span>
            </span>
          </label>
          <p className="mt-3 flex gap-2 text-xs text-graphite">
            <Info className="mt-0.5 size-3.5 shrink-0 text-teal" />
            {period === "first"
              ? `Priced on the intake schedule — free up to ${defaults.ent_intake_free_max} units, then tiered by shipment size.`
              : "Priced on the restock schedule, tiered by shipment size. Switch to First month for the intake schedule."}
          </p>
        </SectionCard>

        {/* Section B */}
        <SectionCard
          step="B"
          title="Rate card"
          description="Prefilled with BNP's standard ranges. Already have a quote? Overwrite any field."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {basis === "pallet" ? (
              <NumberField label="Storage" value={storagePallet} onChange={setStoragePallet} prefix="₦" suffix="per pallet / mo" />
            ) : (
              <NumberField label="Storage" value={storageM3} onChange={setStorageM3} prefix="₦" suffix="per m³ / mo" />
            )}
            <NumberField label="Pick & pack — first item" value={ppFirst} onChange={setPpFirst} prefix="₦" suffix="per order" />
            <NumberField label="Pick & pack — additional item" value={ppAdditional} onChange={setPpAdditional} prefix="₦" suffix="per item" />
            <NumberField label="Kitting (optional)" value={kitting} onChange={setKitting} prefix="₦" suffix="per kit" />
            <NumberField label="Returns processing (optional)" value={returnsRate} onChange={setReturnsRate} prefix="₦" suffix="per return" />
            <NumberField label="Insurance" value={insurancePct} onChange={setInsurancePct} suffix="% of declared value" />
            <NumberField label="Annual subscription" value={annualSub} onChange={setAnnualSub} prefix="₦" suffix="per year" />
          </div>
        </SectionCard>

        {/* Section C */}
        <fieldset className="rounded-2xl border border-stone bg-white p-6 sm:p-7">
          <button
            type="button"
            onClick={() => setIncludeDelivery((v) => !v)}
            aria-expanded={includeDelivery}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <span className="flex items-center gap-3">
              <span className="flex size-8 items-center justify-center rounded-full bg-navy font-display text-sm font-extrabold text-gold">
                C
              </span>
              <span>
                <span className="block font-display text-lg font-bold text-navy">Delivery (optional)</span>
                <span className="block text-sm text-graphite">Add average carrier cost for a fully-landed figure.</span>
              </span>
            </span>
            <ChevronDown className={cn("size-5 shrink-0 text-graphite transition-transform", includeDelivery && "rotate-180")} />
          </button>
          {includeDelivery ? (
            <div className="mt-5">
              <NumberField
                label="Average delivery cost per order (₦)"
                help="Average carrier cost per order"
                value={deliveryPerOrder}
                onChange={setDeliveryPerOrder}
                prefix="₦"
              />
            </div>
          ) : null}
        </fieldset>

        <div className="flex flex-wrap gap-3">
          <Button size="xl" onClick={() => setCalculated(true)}>
            <Calculator />
            Calculate
          </Button>
          <Button size="xl" variant="outline" onClick={reset}>
            <RotateCcw />
            Reset
          </Button>
        </div>
      </div>

      {/* Results */}
      <aside className="rounded-2xl bg-navy p-6 text-white shadow-[0_30px_80px_-30px_rgba(15,42,68,0.6)] sm:p-8 lg:sticky lg:top-28">
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-gold-300">
          Estimated monthly cost · {period === "first" ? "First month" : "Ongoing month"}
        </span>
        {calculated ? (
          <>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-5xl font-extrabold tracking-tight tabular-nums" aria-live="polite">
                {naira(result.monthly)}
              </span>
              <span className="text-mist">/ month</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/5 p-4">
                <div className="text-xs text-mist">Cost / order (ex delivery)</div>
                <div className="mt-1 font-display text-lg font-bold tabular-nums">{naira(result.perOrderEx)}</div>
              </div>
              <div className="rounded-xl bg-white/5 p-4">
                <div className="text-xs text-mist">Cost / order (inc delivery)</div>
                <div className="mt-1 font-display text-lg font-bold tabular-nums">{naira(result.perOrderInc)}</div>
              </div>
            </div>

            <dl className="mt-6 flex flex-col gap-2.5 border-t border-white/10 pt-5 text-sm">
              {result.lines.map((l) => (
                <div key={l.label} className={cn("flex items-center justify-between gap-4", l.amount <= 0 && "opacity-45")}>
                  <dt className="text-white/80">
                    {l.label}
                    <span className="block text-xs text-mist">{l.detail}</span>
                  </dt>
                  <dd className="shrink-0 font-semibold tabular-nums">{naira(l.amount)}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 flex flex-col gap-3">
              <Button render={<Link href="/get-a-quote" />} size="xl" className="w-full bg-gold text-navy hover:bg-gold-300">
                Ready for your exact rate? Book a consultation
                <ArrowRight />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={copyResults}
                className="w-full border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                {copied ? <Check /> : <Copy />}
                {copied ? "Copied" : "Copy results"}
              </Button>
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm leading-relaxed text-mist">
            Fill in your volume and rate card, then press <strong className="text-white">Calculate</strong> to see your
            estimated monthly cost broken down line by line.
          </p>
        )}

        <p className="mt-5 flex gap-2 text-xs leading-relaxed text-mist">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          These figures are estimates for planning only. Final rates are confirmed at consultation and may vary with
          product type, volume and storage profile.
        </p>
      </aside>
    </div>
  );
}
