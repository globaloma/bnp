import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { aboutTeaser } from "@/lib/site-content";
import { Button } from "@/components/ui/button";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

export function AboutTeaser() {
  return (
    <section className="py-20 sm:py-28">
      <div className="container-page grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <Reveal className="relative pb-16 sm:pr-16">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
            <Image
              src="/images/marketing/merchant-laptop.jpg"
              alt="A merchant managing her store from a laptop"
              fill
              sizes="(min-width: 1024px) 36rem, 100vw"
              className="object-cover"
            />
          </div>
          <div className="absolute right-0 bottom-0 aspect-square w-1/2 overflow-hidden rounded-2xl border-[6px] border-cream shadow-xl">
            <Image
              src="/images/marketing/packing-tape.jpg"
              alt="Sealing a customer order for dispatch"
              fill
              sizes="18rem"
              className="object-cover"
            />
          </div>
          <div className="absolute top-6 -left-3 rounded-xl bg-gold px-5 py-4 shadow-lg sm:-left-6">
            <div className="font-display text-4xl leading-none font-extrabold text-navy">
              {aboutTeaser.badge.value}
            </div>
            <div className="mt-1 text-xs font-bold uppercase tracking-[0.08em] text-navy/80">
              {aboutTeaser.badge.label}
            </div>
          </div>
        </Reveal>

        <div>
          <SectionHeading label={aboutTeaser.label} title={aboutTeaser.title} />
          <Reveal delay={0.1} className="mt-6 flex flex-col gap-4 text-base leading-relaxed text-graphite">
            {aboutTeaser.body.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </Reveal>
          <Reveal delay={0.15}>
            <ul className="mt-7 grid gap-3 sm:grid-cols-2">
              {aboutTeaser.points.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-[15px] font-semibold text-navy">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-teal" />
                  {point}
                </li>
              ))}
            </ul>
            <Button render={<Link href={aboutTeaser.cta.href} />} size="xl" className="mt-9 bg-navy text-white hover:bg-navy-600">
              {aboutTeaser.cta.label}
              <ArrowRight />
            </Button>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
