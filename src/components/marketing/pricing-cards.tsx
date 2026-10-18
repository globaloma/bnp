import Link from "next/link";
import { ArrowRight, Calculator, CheckCircle2 } from "lucide-react";
import { nav, pricing } from "@/lib/site-content";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

/** The three fees on a navy band, with a link to the quote calculator. */
export function PricingCards({ heading = true }: { heading?: boolean }) {
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

        <div className={cn("grid gap-6 lg:grid-cols-3 lg:items-stretch", heading && "mt-14")}>
          {pricing.tiers.map((tier, i) => (
            <Reveal
              key={tier.name}
              delay={i * 0.08}
              className={cn(
                "relative flex flex-col rounded-2xl p-8",
                tier.highlighted
                  ? "bg-gold text-navy shadow-[0_30px_80px_-30px_rgba(232,160,32,0.6)] lg:-my-4 lg:py-12"
                  : "border border-white/12 bg-white/[0.04] text-white",
              )}
            >
              {tier.highlighted ? (
                <span className="absolute top-0 right-8 -translate-y-1/2 rounded-full bg-navy px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-gold-300">
                  Pay for what you use
                </span>
              ) : null}
              <span
                className={cn(
                  "text-xs font-bold uppercase tracking-[0.16em]",
                  tier.highlighted ? "text-navy/70" : "text-gold-300",
                )}
              >
                {tier.label}
              </span>
              <h3 className="mt-2 font-display text-2xl font-bold">{tier.name}</h3>
              <div className="mt-5 flex items-baseline gap-2">
                <span className="font-display text-5xl font-extrabold tracking-tight">{tier.amount}</span>
              </div>
              <span className={cn("mt-1 text-sm", tier.highlighted ? "text-navy/75" : "text-mist")}>
                {tier.unit}
              </span>
              <p className={cn("mt-5 text-[15px] leading-relaxed", tier.highlighted ? "text-navy/85" : "text-white/75")}>
                {tier.detail}
              </p>
              <ul
                className={cn(
                  "mt-6 flex flex-1 flex-col gap-3 border-t pt-6",
                  tier.highlighted ? "border-navy/15" : "border-white/10",
                )}
              >
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[15px]">
                    <CheckCircle2
                      className={cn("mt-0.5 size-5 shrink-0", tier.highlighted ? "text-navy" : "text-gold")}
                    />
                    {f}
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-14 flex flex-col items-center gap-5 text-center">
          <p className="max-w-2xl text-[15px] leading-relaxed text-mist">{pricing.example}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button render={<Link href={nav.quote.href} />} size="xl" className="px-7">
              <Calculator />
              Estimate my monthly cost
            </Button>
            {heading ? (
              <Button
                render={<Link href="/pricing" />}
                size="xl"
                variant="outline"
                className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                Pricing details
                <ArrowRight />
              </Button>
            ) : null}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
