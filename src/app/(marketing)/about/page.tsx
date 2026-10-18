import type { Metadata } from "next";
import Image from "next/image";
import { Eye, Target } from "lucide-react";
import { about, company, hero } from "@/lib/site-content";
import { PageHero } from "@/components/marketing/page-hero";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/marketing/reveal";
import { Icon } from "@/components/marketing/icon";
import { StatCounter } from "@/components/marketing/stat-counter";
import { Locations } from "@/components/marketing/locations";
import { Testimonials } from "@/components/marketing/testimonials";

export const metadata: Metadata = {
  title: "About us",
  description: `${company.name} is the operations partner behind growing Nigerian brands: storage, packing and delivery from our hub in Jabi, Abuja.`,
};

export default function AboutPage() {
  return (
    <>
      <PageHero
        crumb="About us"
        title="We run the operations. You grow the brand."
        description="Meet the team that stores, packs and delivers for merchants across Abuja, Lagos and the USA."
        image="/images/marketing/warehouse-floor.jpg"
      />

      <section className="py-20 sm:py-28">
        <div className="container-page grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHeading label={about.intro.label} title={about.intro.title} />
            <Reveal delay={0.1} className="mt-6 flex flex-col gap-4 text-base leading-relaxed text-graphite sm:text-lg">
              {about.intro.body.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </Reveal>
            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              <Reveal delay={0.15} className="rounded-2xl bg-navy p-6 text-white">
                <Target className="size-8 text-gold" strokeWidth={1.6} />
                <h3 className="mt-4 font-display text-lg font-bold">Our mission</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-white/75">{about.mission}</p>
              </Reveal>
              <Reveal delay={0.2} className="rounded-2xl bg-gold p-6 text-navy">
                <Eye className="size-8" strokeWidth={1.6} />
                <h3 className="mt-4 font-display text-lg font-bold">Our vision</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-navy/80">{about.vision}</p>
              </Reveal>
            </div>
          </div>

          <Reveal className="relative">
            <div className="grid grid-cols-2 gap-4">
              <div className="relative row-span-2 aspect-[3/4.4] overflow-hidden rounded-2xl">
                <Image
                  src="/images/marketing/boxes-trolley.jpg"
                  alt="Moving customer orders through the warehouse"
                  fill
                  sizes="(min-width: 1024px) 18rem, 50vw"
                  className="object-cover"
                />
              </div>
              <div className="relative aspect-square overflow-hidden rounded-2xl">
                <Image
                  src="/images/marketing/stock-check.jpg"
                  alt="Checking incoming stock against a delivery list"
                  fill
                  sizes="(min-width: 1024px) 18rem, 50vw"
                  className="object-cover"
                />
              </div>
              <div className="relative aspect-square overflow-hidden rounded-2xl">
                <Image
                  src="/images/marketing/packing-order.jpg"
                  alt="Packing a fragile order"
                  fill
                  sizes="(min-width: 1024px) 18rem, 50vw"
                  className="object-cover"
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-navy bg-dots-light py-16">
        <div className="container-page grid grid-cols-1 gap-10 text-center sm:grid-cols-3">
          {hero.stats.map((stat) => (
            <StatCounter key={stat.label} {...stat} />
          ))}
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="container-page">
          <SectionHeading align="center" label="What we stand for" title="How we look after your business." />
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {about.values.map((v, i) => (
              <Reveal
                key={v.title}
                delay={i * 0.08}
                className="group rounded-2xl border border-stone bg-white p-8 transition-all hover:-translate-y-1 hover:shadow-[0_24px_60px_-28px_rgba(15,42,68,0.4)]"
              >
                <span className="flex size-14 items-center justify-center rounded-xl bg-navy text-gold transition-colors group-hover:bg-gold group-hover:text-navy">
                  <Icon name={v.icon} className="size-7" />
                </span>
                <h3 className="mt-6 font-display text-xl font-bold text-navy">{v.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-graphite">{v.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <Locations />
      <Testimonials />
    </>
  );
}
