import { cn } from "@/lib/utils";
import { pricing } from "@/lib/site-content";
import { SectionHeading } from "./section-heading";
import { Reveal } from "./reveal";

export function Pricing() {
  return (
    <section id="pricing" className="bg-navy py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          label={pricing.label}
          title={pricing.title}
          description={pricing.description}
          tone="dark"
        />

        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          {pricing.tiers.map((tier, i) => (
            <Reveal
              key={tier.name}
              delay={i * 0.06}
              className={cn(
                "flex flex-col rounded-xl border p-7",
                tier.highlighted
                  ? "border-teal bg-teal/10"
                  : "border-white/10 bg-white/[0.04]",
              )}
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-300">
                {tier.label}
              </span>
              <h3 className="mt-2 text-lg font-semibold text-white">
                {tier.name}
              </h3>
              <div className="mt-4 text-3xl font-semibold tracking-tight text-gold">
                {tier.amount}
              </div>
              <p className="mt-1 text-sm text-mist">{tier.qualifier}</p>
              <p className="mt-4 text-sm leading-relaxed text-mist">
                {tier.detail}
              </p>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-8 max-w-2xl rounded-lg border border-white/10 bg-white/[0.04] px-6 py-5 text-sm leading-relaxed text-mist">
          {pricing.note}
        </Reveal>
      </div>
    </section>
  );
}
