import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, PlayCircle } from "lucide-react";
import { hero, highlights } from "@/lib/site-content";
import { Button } from "@/components/ui/button";
import { Icon } from "./icon";
import { Reveal } from "./reveal";
import { StatCounter } from "./stat-counter";

const ORDER_STEPS = ["Reserved", "Packed", "Dispatched", "Delivered"];

/** A small mock of an order moving through the warehouse. */
function OrderCard() {
  return (
    <div className="w-80 rounded-2xl border border-white/15 bg-white/10 p-5 text-white shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-300">
          Live order
        </span>
        <span className="rounded-full bg-success/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
          On the way
        </span>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <div className="relative size-14 overflow-hidden rounded-lg">
          <Image src="/images/marketing/fashion.jpg" alt="" fill sizes="56px" className="object-cover" />
        </div>
        <div>
          <div className="font-semibold">Ankara Tote (Red) x2</div>
          <div className="text-sm text-white/70">To Amara T., Wuse 2</div>
        </div>
      </div>
      <ol className="mt-5 grid grid-cols-4 gap-1.5">
        {ORDER_STEPS.map((step, i) => (
          <li key={step} className="flex flex-col gap-1.5">
            <span className={i <= 2 ? "h-1.5 rounded-full bg-gold" : "h-1.5 rounded-full bg-white/20"} />
            <span className={i <= 2 ? "text-[10px] font-semibold text-white" : "text-[10px] text-white/50"}>
              {step}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function HomeHero() {
  return (
    <section className="relative isolate">
      <div className="relative isolate overflow-hidden bg-navy">
        <Image
          src="/images/marketing/warehouse-aisle.jpg"
          alt="Shelves of stock in a BNP warehouse aisle"
          fill
          preload
          sizes="100vw"
          className="-z-20 object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-navy via-navy/90 to-navy/40" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-navy/80 via-transparent to-transparent" />

        <div className="container-page grid items-center gap-12 pt-20 pb-40 sm:pt-28 lg:grid-cols-[1.35fr_1fr] lg:pb-48">
          <Reveal>
            <h1 className="font-display text-[2.6rem] leading-[1.04] font-extrabold tracking-tight text-balance text-white sm:text-6xl lg:text-[4.2rem]">
              {hero.title}
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
              {hero.subtitle}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button render={<Link href={hero.primaryCta.href} />} size="xl" className="px-7">
                {hero.primaryCta.label}
                <ArrowRight />
              </Button>
              <Link
                href={hero.secondaryCta.href}
                className="inline-flex h-12 items-center gap-2.5 px-2 text-[0.95rem] font-semibold text-white transition-colors hover:text-gold-300"
              >
                <PlayCircle className="size-7 text-gold" strokeWidth={1.5} />
                {hero.secondaryCta.label}
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/70">
              {["No rent", "No packing staff", "No long contracts", "First-month money-back guarantee"].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Check className="size-4 text-gold" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.15} className="hidden justify-end lg:flex">
            <div className="relative">
              <OrderCard />
              <div className="absolute -bottom-16 -left-16 rounded-xl bg-white px-5 py-4 shadow-2xl">
                <div className="font-display text-3xl font-extrabold text-navy">
                  12<span className="text-gold">pm</span>
                </div>
                <div className="text-xs font-medium text-graphite">Same day dispatch cutoff</div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      {/* Highlights overlap the bottom edge of the photo. */}
      <div className="container-page relative -mt-28 lg:-mt-32">
        <div className="grid overflow-hidden rounded-2xl bg-white shadow-[0_30px_80px_-30px_rgba(15,42,68,0.45)] md:grid-cols-3">
          {highlights.map((item, i) => (
            <Reveal
              key={item.title}
              delay={i * 0.08}
              className="group flex gap-4 border-stone p-7 not-last:border-b md:not-last:border-r md:not-last:border-b-0"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold transition-colors group-hover:bg-gold group-hover:text-navy">
                <Icon name={item.icon} className="size-6" />
              </span>
              <div>
                <h3 className="font-display text-lg font-bold text-navy">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-graphite">{item.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      <div className="container-page mt-14 grid grid-cols-3 gap-6 border-b border-stone pb-14 text-center sm:gap-10">
        {hero.stats.map((stat) => (
          <StatCounter key={stat.label} {...stat} tone="light" />
        ))}
      </div>
    </section>
  );
}
