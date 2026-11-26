import Link from "next/link";
import { ArrowRight, Calculator, CheckCircle2, ChevronDown } from "lucide-react";
import { pricing } from "@/lib/site-content";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { GuaranteeBanner } from "./guarantee";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

type ServiceItem = { name: string; desc: string };

function ServiceList({ items }: { items: readonly ServiceItem[] }) {
  return (
    <ul className="mt-3 flex flex-col gap-3">
      {items.map((s) => (
        <li key={s.name} className="flex items-start gap-2.5">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-gold" />
          <span className="text-[15px]">
            <span className="font-semibold text-white">{s.name}</span>
            <span className="block text-sm text-mist">{s.desc}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Core / Add-On service group on the Enterprise card: names and descriptions, no amounts. */
function ServiceGroup({ title, items }: { title: string; items: readonly ServiceItem[] }) {
  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-[0.12em] text-gold-300">{title}</h4>
      <ServiceList items={items} />
    </div>
  );
}

/**
 * Collapsible service group, so the long add-on list does not stretch the
 * Enterprise card far past the Standard one. Pure HTML details, no client JS.
 */
function CollapsibleServiceGroup({ title, items }: { title: string; items: readonly ServiceItem[] }) {
  return (
    <details className="group/svc">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-bold uppercase tracking-[0.12em] text-gold-300 [&::-webkit-details-marker]:hidden">
        <span>
          {title}
          <span className="ml-2 font-normal normal-case tracking-normal text-mist">
            ({items.length})
          </span>
        </span>
        <span className="flex items-center gap-1 text-[11px] font-semibold normal-case tracking-normal text-mist">
          <span className="group-open/svc:hidden">See more</span>
          <span className="hidden group-open/svc:inline">See less</span>
          <ChevronDown className="size-4 transition-transform group-open/svc:rotate-180" />
        </span>
      </summary>
      <ServiceList items={items} />
    </details>
  );
}

/** The Standard and Enterprise plans on a navy band, each with its own calculator. */
export function PricingCards({
  heading = true,
  compareLink = true,
}: {
  heading?: boolean;
  /** Off on the pricing page itself, where the comparison is just below. */
  compareLink?: boolean;
}) {
  return (
    <section className="relative overflow-hidden bg-navy bg-dots-light py-20 sm:py-28">
      <div className="container-page">
        {heading ? (
          <SectionHeading
            tone="dark"
            align="center"
            label={pricing.label}
            title={pricing.title}
            description={pricing.description}
          />
        ) : null}

        <div className={cn("mx-auto grid max-w-5xl gap-6 lg:grid-cols-2 lg:items-stretch", heading && "mt-14")}>
          {pricing.plans.map((plan, i) => (
            <Reveal
              key={plan.id}
              delay={i * 0.08}
              className={cn(
                "relative flex flex-col rounded-2xl p-8 sm:p-10",
                plan.highlighted
                  ? "border border-gold/40 bg-white/[0.04] text-white shadow-[0_30px_80px_-30px_rgba(232,160,32,0.35)]"
                  : "border border-white/12 bg-white/[0.04] text-white",
              )}
            >
              {plan.highlighted ? (
                <span className="absolute top-0 right-8 -translate-y-1/2 rounded-full bg-gold px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-navy">
                  Dedicated account manager
                </span>
              ) : null}
              <h3 className="font-display text-3xl font-extrabold">{plan.name}</h3>
              <p className="mt-1 text-[15px] font-semibold text-gold-300">{plan.tagline}</p>
              <p className="mt-2 text-sm text-mist">{plan.audience}</p>

              {plan.customPricing ? (
                <p className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-[15px] font-medium text-white/90">
                  {plan.pricingLine}
                </p>
              ) : (
                <div className="mt-6 flex items-baseline gap-2">
                  <span className="font-display text-6xl font-extrabold tracking-tight">{plan.fee}</span>
                  <span className="text-sm text-mist">{plan.feeUnit}</span>
                </div>
              )}

              {plan.customPricing ? (
                <div className="mt-7 flex flex-1 flex-col gap-6 border-t border-white/10 pt-7">
                  <ServiceGroup title="Core Services" items={plan.coreServices} />
                  {plan.addOnServices.length ? (
                    <CollapsibleServiceGroup title="Add-On Services" items={plan.addOnServices} />
                  ) : null}
                </div>
              ) : (
                <div className="mt-7 flex flex-1 flex-col border-t border-white/10 pt-7">
                  <ul className="flex flex-col gap-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-[15px]">
                        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-gold" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {plan.addOnServices.length ? (
                    <div className="mt-6">
                      <CollapsibleServiceGroup title="Optional add-ons" items={plan.addOnServices} />
                    </div>
                  ) : null}
                </div>
              )}

              <div className="mt-8 flex flex-col gap-3">
                <Button
                  render={<Link href={plan.cta.href} />}
                  size="xl"
                  className={cn("w-full", plan.highlighted ? "bg-gold text-navy hover:bg-gold-300" : "")}
                >
                  {plan.cta.label}
                  <ArrowRight />
                </Button>
                <Button
                  render={<Link href={plan.calculator.href} />}
                  size="xl"
                  variant="outline"
                  className="w-full border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
                >
                  <Calculator />
                  {plan.calculator.label}
                </Button>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mx-auto mt-8 flex max-w-5xl flex-col items-start justify-between gap-3 rounded-2xl border border-white/12 bg-white/[0.04] px-6 py-5 text-white sm:flex-row sm:items-center sm:px-8">
          <div>
            <span className="font-display text-2xl font-extrabold">{pricing.registration.standardAmount}</span>{" "}
            <span className="text-mist">on Standard,</span>{" "}
            <span className="font-display text-2xl font-extrabold">{pricing.registration.enterpriseAmount}</span>{" "}
            <span className="text-mist">on Enterprise {pricing.registration.label}</span>
            <p className="mt-1 text-sm text-white/70">{pricing.registration.detail}</p>
          </div>
        </Reveal>

        <Reveal className="mx-auto mt-6 max-w-5xl">
          <GuaranteeBanner tone="dark" />
        </Reveal>

        {compareLink ? (
          <Reveal className="mt-12 flex flex-col items-center gap-5 text-center">
            <p className="max-w-2xl text-[15px] leading-relaxed text-mist">{pricing.example}</p>
            <Button
              render={<Link href="/pricing" />}
              size="xl"
              variant="outline"
              className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              Compare plans in detail
              <ArrowRight />
            </Button>
          </Reveal>
        ) : (
          <Reveal className="mt-12 flex flex-col items-center gap-3 text-center">
            <p className="max-w-2xl text-[15px] leading-relaxed text-mist">{pricing.example}</p>
          </Reveal>
        )}
      </div>
    </section>
  );
}
