import Link from "next/link";
import { ArrowRight, Calculator, CheckCircle2 } from "lucide-react";
import { nav, pricing } from "@/lib/site-content";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { GuaranteeBanner } from "./guarantee";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

/** The Standard and Enterprise plans on a navy band, each with a way in. */
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
                  ? "bg-gold text-navy shadow-[0_30px_80px_-30px_rgba(232,160,32,0.6)]"
                  : "border border-white/12 bg-white/[0.04] text-white",
              )}
            >
              {plan.highlighted ? (
                <span className="absolute top-0 right-8 -translate-y-1/2 rounded-full bg-navy px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-gold-300">
                  Dedicated account manager
                </span>
              ) : null}
              <h3 className="font-display text-3xl font-extrabold">{plan.name}</h3>
              <p className={cn("mt-1 text-[15px] font-semibold", plan.highlighted ? "text-navy/80" : "text-gold-300")}>
                {plan.tagline}
              </p>
              <p className={cn("mt-2 text-sm", plan.highlighted ? "text-navy/70" : "text-mist")}>{plan.audience}</p>

              <div className="mt-6 flex items-baseline gap-2">
                <span className="font-display text-6xl font-extrabold tracking-tight">{plan.fee}</span>
                <span className={cn("text-sm", plan.highlighted ? "text-navy/75" : "text-mist")}>{plan.feeUnit}</span>
              </div>

              <ul
                className={cn(
                  "mt-7 flex flex-1 flex-col gap-3 border-t pt-7",
                  plan.highlighted ? "border-navy/15" : "border-white/10",
                )}
              >
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[15px]">
                    <CheckCircle2
                      className={cn("mt-0.5 size-5 shrink-0", plan.highlighted ? "text-navy" : "text-gold")}
                    />
                    {f}
                  </li>
                ))}
              </ul>

              <Button
                render={<Link href={plan.cta.href} />}
                size="xl"
                className={cn(
                  "mt-8 w-full",
                  plan.highlighted ? "bg-navy text-white hover:bg-navy-600" : "",
                )}
              >
                {plan.cta.label}
                <ArrowRight />
              </Button>
            </Reveal>
          ))}
        </div>

        <Reveal className="mx-auto mt-8 flex max-w-5xl flex-col items-start justify-between gap-3 rounded-2xl border border-white/12 bg-white/[0.04] px-6 py-5 text-white sm:flex-row sm:items-center sm:px-8">
          <div>
            <span className="font-display text-2xl font-extrabold">{pricing.registration.amount}</span>{" "}
            <span className="text-mist">{pricing.registration.label}</span>
            <p className="mt-1 text-sm text-white/70">{pricing.registration.detail}</p>
          </div>
        </Reveal>

        <Reveal className="mx-auto mt-6 max-w-5xl">
          <GuaranteeBanner tone="dark" />
        </Reveal>

        <Reveal className="mt-12 flex flex-col items-center gap-5 text-center">
          <p className="max-w-2xl text-[15px] leading-relaxed text-mist">{pricing.example}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              render={<Link href={nav.quote.href} />}
              size="xl"
              variant="outline"
              className="border-white/25 bg-transparent px-7 text-white hover:bg-white/10 hover:text-white"
            >
              <Calculator />
              Estimate my monthly cost
            </Button>
            {compareLink ? (
              <Button
                render={<Link href="/pricing" />}
                size="xl"
                variant="outline"
                className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                Compare plans in detail
                <ArrowRight />
              </Button>
            ) : null}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
