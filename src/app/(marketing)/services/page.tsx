import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { company, nav, services } from "@/lib/site-content";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/marketing/page-hero";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/marketing/reveal";
import { Icon } from "@/components/marketing/icon";

export const metadata: Metadata = {
  title: "Services",
  description: `Warehousing, pick and pack, last mile delivery, an online store and more. Everything ${company.name} handles for your brand after the sale.`,
};

export default function ServicesPage() {
  return (
    <>
      <PageHero
        crumb="Services"
        title="Everything after the sale, handled."
        description={services.description}
        image="/images/marketing/packing-order.jpg"
      />

      {/* Jump links */}
      <div className="sticky top-[72px] z-30 border-b border-stone bg-white/95 backdrop-blur">
        <div className="container-page flex gap-2 overflow-x-auto py-3 [scrollbar-width:none]">
          {services.items.map((s) => (
            <a
              key={s.slug}
              href={`#${s.slug}`}
              className="shrink-0 rounded-full border border-stone px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap text-graphite transition-colors hover:border-gold hover:text-navy"
            >
              {s.title}
            </a>
          ))}
        </div>
      </div>

      {services.items.map((s, i) => {
        const flip = i % 2 === 1;
        return (
          <section
            key={s.slug}
            id={s.slug}
            className={cn("scroll-mt-32 py-16 sm:py-24", flip ? "bg-white" : "bg-cream")}
          >
            <div className="container-page grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
              <Reveal className={cn("relative", flip && "lg:order-2")}>
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                  <Image
                    src={s.image}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 36rem, 100vw"
                    className="object-cover"
                  />
                </div>
                <span
                  className={cn(
                    "absolute -bottom-6 flex size-20 items-center justify-center rounded-2xl bg-gold text-navy shadow-xl",
                    flip ? "-left-3 sm:-left-6" : "-right-3 sm:-right-6",
                  )}
                >
                  <Icon name={s.icon} className="size-9" />
                </span>
              </Reveal>
              <div>
                <span className="font-display text-sm font-extrabold text-gold">
                  {String(i + 1).padStart(2, "0")} / {String(services.items.length).padStart(2, "0")}
                </span>
                <Reveal>
                  <h2 className="mt-2 font-display text-3xl leading-tight font-extrabold tracking-tight text-navy sm:text-4xl">
                    {s.title}
                  </h2>
                  <p className="mt-4 text-base leading-relaxed text-graphite sm:text-lg">{s.body}</p>
                  <ul className="mt-6 flex flex-col gap-3">
                    {s.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2.5 text-[15px] font-semibold text-navy">
                        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-teal" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </Reveal>
              </div>
            </div>
          </section>
        );
      })}

      <section className="bg-navy bg-dots-light py-20 sm:py-28">
        <div className="container-page grid gap-14 lg:grid-cols-2">
          <div>
            <SectionHeading
              tone="dark"
              label="Who it's for"
              title="Built for product brands that are ready to grow."
            />
            <ul className="mt-8 flex flex-col gap-3.5">
              {services.fitList.map((item) => (
                <Reveal as="li" key={item} className="flex items-start gap-3 text-base text-white/85">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-gold" />
                  {item}
                </Reveal>
              ))}
            </ul>
          </div>
          <Reveal className="rounded-2xl border border-white/10 bg-white/[0.04] p-8">
            <h3 className="font-display text-xl font-bold text-white">Industries we serve</h3>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {services.industries.map((ind) => (
                <span
                  key={ind}
                  className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/85"
                >
                  {ind}
                </span>
              ))}
            </div>
            <p className="mt-8 text-[15px] leading-relaxed text-mist">
              Selling something else? If it fits on a shelf, there&apos;s a good chance we can store it. Tell us about it.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button render={<Link href={nav.quote.href} />} size="xl">
                {nav.quote.label}
                <ArrowRight />
              </Button>
              <Button
                render={<Link href="/contact" />}
                size="xl"
                variant="outline"
                className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                Ask us
              </Button>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
