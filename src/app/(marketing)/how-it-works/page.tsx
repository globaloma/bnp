import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { company, nav, steps } from "@/lib/site-content";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/marketing/page-hero";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/marketing/reveal";
import { Steps } from "@/components/marketing/steps";

export const metadata: Metadata = {
  title: "How it works",
  description: `How to start with ${company.name}: sign up, send your stock and we pick, pack and deliver every order. Most merchants are live in five to seven days.`,
};

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        crumb="How it works"
        title="From sign up to delivered, without the stress."
        description={steps.description}
        image="/images/marketing/delivery-van.jpg"
      />

      <section className="bg-cream bg-dots py-20 sm:py-28">
        <div className="container-page">
          <SectionHeading align="center" label={steps.label} title="Six steps. Most merchants are live within a week." />
          <div className="mt-16">
            <Steps layout="timeline" />
          </div>
        </div>
      </section>

      <section className="bg-white py-20 sm:py-28">
        <div className="container-page grid items-center gap-14 lg:grid-cols-2">
          <Reveal className="relative aspect-[4/3] overflow-hidden rounded-2xl">
            <Image
              src="/images/marketing/stock-check.jpg"
              alt="Checking a delivery of stock as it arrives"
              fill
              sizes="(min-width: 1024px) 36rem, 100vw"
              className="object-cover"
            />
          </Reveal>
          <div>
            <SectionHeading
              label="Before you start"
              title="All you need to get going."
              description="There's no paperwork maze. Have these ready and we'll take it from there."
            />
            <ul className="mt-8 flex flex-col gap-4">
              {steps.needs.map((n, i) => (
                <Reveal
                  as="li"
                  key={n}
                  delay={i * 0.06}
                  className="flex items-center gap-4 rounded-xl border border-stone bg-cream/50 p-4"
                >
                  <CheckCircle2 className="size-6 shrink-0 text-teal" />
                  <span className="text-base font-semibold text-navy">{n}</span>
                </Reveal>
              ))}
            </ul>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button render={<Link href={nav.signUp.href} />} size="xl">
                Create your account
                <ArrowRight />
              </Button>
              <Button render={<Link href={nav.quote.href} />} size="xl" variant="outline" className="border-navy/20">
                Estimate my cost first
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
