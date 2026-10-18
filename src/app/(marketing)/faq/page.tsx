import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MessageCircle, Phone } from "lucide-react";
import { company, faq } from "@/lib/site-content";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/marketing/page-hero";
import { Reveal } from "@/components/marketing/reveal";
import { FaqList } from "@/components/marketing/faq-list";

export const metadata: Metadata = {
  title: "FAQ",
  description: `Answers to the questions merchants ask ${company.name} about getting started, pricing, orders, delivery and stock.`,
};

function slug(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export default function FaqPage() {
  return (
    <>
      <PageHero
        crumb="FAQ"
        title="Questions merchants ask us."
        description="Everything you might want to know before sending us your stock. Can't find your answer? Talk to us."
        image="/images/marketing/support-team.jpg"
      />

      <section className="py-16 sm:py-24">
        <div className="container-page grid gap-12 lg:grid-cols-[16rem_1fr] lg:gap-16">
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <nav
              aria-label="FAQ topics"
              className="flex gap-2 overflow-x-auto [scrollbar-width:none] lg:flex-col"
            >
              {faq.groups.map((g) => (
                <a
                  key={g.title}
                  href={`#${slug(g.title)}`}
                  className="shrink-0 rounded-lg border border-stone bg-white px-4 py-3 text-sm font-semibold whitespace-nowrap text-navy transition-colors hover:border-gold"
                >
                  {g.title}
                </a>
              ))}
            </nav>
            <Reveal className="mt-6 hidden rounded-2xl bg-navy p-6 text-white lg:block">
              <h2 className="font-display text-lg font-bold">Still unsure?</h2>
              <p className="mt-2 text-sm text-mist">A real person on our team will answer.</p>
              <div className="mt-5 flex flex-col gap-3 text-sm font-semibold">
                <a href={company.whatsapp} className="flex items-center gap-2 hover:text-gold-300">
                  <MessageCircle className="size-4 text-gold" />
                  WhatsApp us
                </a>
                <a href={`tel:${company.phone}`} className="flex items-center gap-2 hover:text-gold-300">
                  <Phone className="size-4 text-gold" />
                  {company.phoneDisplay}
                </a>
              </div>
            </Reveal>
          </aside>

          <div className="flex flex-col gap-14">
            {faq.groups.map((g) => (
              <section key={g.title} id={slug(g.title)} className="scroll-mt-28">
                <h2 className="mb-5 font-display text-2xl font-extrabold tracking-tight text-navy">
                  {g.title}
                </h2>
                <FaqList items={g.items} />
              </section>
            ))}
            <div className="flex flex-col gap-3 rounded-2xl border border-stone bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-display text-lg font-bold text-navy">Didn&apos;t find what you need?</p>
              <Button render={<Link href="/contact" />} size="xl">
                Contact us
                <ArrowRight />
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
