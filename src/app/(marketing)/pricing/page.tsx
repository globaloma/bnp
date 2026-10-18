import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calculator, Info } from "lucide-react";
import { company, nav, pricing } from "@/lib/site-content";
import { naira } from "@/lib/format";
import { estimateQuote, exampleMerchants } from "@/lib/quote";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/marketing/page-hero";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/marketing/reveal";
import { FaqList, pickFaqs } from "@/components/marketing/faq-list";

export const metadata: Metadata = {
  title: "Pricing",
  description: `${company.name} pricing: ₦50,000 a year, ₦10,000 per square metre of storage a month and 7% of sales. No hidden fees, no long contracts.`,
};

export default function PricingPage() {
  return (
    <>
      <PageHero
        crumb="Pricing"
        title="Simple pricing that grows with your sales."
        description={pricing.description}
        image="/images/marketing/warehouse-aisle.jpg"
      />

      <PricingCards />

      <section className="py-20 sm:py-28">
        <div className="container-page">
          <SectionHeading
            align="center"
            label="Worked examples"
            title="What merchants like you might pay."
            description="Three typical brands, using our standard prices. Your own numbers will differ, so try the calculator for yours."
          />
          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            {exampleMerchants.map((m, i) => {
              const est = estimateQuote(m);
              return (
                <Reveal
                  key={m.name}
                  delay={i * 0.08}
                  className={cn(
                    "flex flex-col rounded-2xl border bg-white p-7",
                    i === 1 ? "border-gold shadow-[0_24px_60px_-28px_rgba(232,160,32,0.6)]" : "border-stone",
                  )}
                >
                  <h3 className="font-display text-xl font-bold text-navy">{m.name}</h3>
                  <p className="mt-1 text-sm text-graphite">{m.detail}</p>
                  <dl className="mt-6 flex flex-col gap-3 border-t border-stone pt-5 text-[15px]">
                    <div className="flex justify-between gap-4">
                      <dt className="text-graphite">Storage ({est.sqm} m²)</dt>
                      <dd className="font-semibold text-navy">{naira(est.storagePerMonth)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-graphite">Fulfillment (7%)</dt>
                      <dd className="font-semibold text-navy">{naira(est.fulfillmentPerMonth)}</dd>
                    </div>
                  </dl>
                  <div className="mt-5 flex items-end justify-between gap-4 rounded-xl bg-cream p-4">
                    <span className="text-sm font-semibold text-graphite">Per month</span>
                    <span className="font-display text-3xl font-extrabold text-navy">{naira(est.monthly)}</span>
                  </div>
                  <p className="mt-3 text-xs text-mist">
                    Plus the {naira(est.subscriptionPerYear)} yearly subscription.
                  </p>
                </Reveal>
              );
            })}
          </div>

          <Reveal className="mt-12 flex flex-col items-center gap-4 rounded-2xl bg-navy p-8 text-center sm:p-10">
            <Calculator className="size-10 text-gold" strokeWidth={1.5} />
            <h3 className="font-display text-2xl font-extrabold text-white sm:text-3xl">
              Work out your own number in under a minute.
            </h3>
            <p className="max-w-xl text-mist">
              Tell us roughly how much stock you have and what you sell in a month. We&apos;ll show your monthly and first year cost.
            </p>
            <Button render={<Link href={nav.quote.href} />} size="xl" className="mt-2 px-7">
              Open the quote calculator
              <ArrowRight />
            </Button>
          </Reveal>
        </div>
      </section>

      <section className="bg-white py-20 sm:py-28">
        <div className="container-page grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <div>
            <SectionHeading label="Good to know" title="Pricing questions." />
            <Reveal delay={0.1} className="mt-8 flex gap-3 rounded-xl border border-stone bg-cream/60 p-5 text-[15px] leading-relaxed text-graphite">
              <Info className="mt-0.5 size-5 shrink-0 text-teal" />
              {pricing.note}
            </Reveal>
          </div>
          <FaqList items={pickFaqs(["Pricing and payments"], 6)} />
        </div>
      </section>
    </>
  );
}
