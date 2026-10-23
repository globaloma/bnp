import Image from "next/image";
import { whyUs } from "@/lib/site-content";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

export function WhyUs() {
  return (
    <section className="relative overflow-hidden bg-navy">
      <div className="grid lg:grid-cols-2">
        <div className="bg-dots-light">
          <div className="mx-auto max-w-[38rem] px-6 py-20 sm:py-28 lg:mr-0 lg:pr-16">
            <SectionHeading
              tone="dark"
              label={whyUs.label}
              title={whyUs.title}
              description={whyUs.description}
            />
            <ol className="mt-12 flex flex-col gap-8">
              {whyUs.points.map((point, i) => (
                <Reveal as="li" key={point.title} delay={i * 0.08} className="flex gap-5">
                  <span className="font-display text-3xl leading-none font-extrabold text-gold/80 tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="border-l border-white/15 pl-5">
                    <h3 className="font-display text-lg font-bold text-white">{point.title}</h3>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-mist">{point.body}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
          </div>
        </div>

        <div className="relative min-h-80 lg:min-h-full">
          <Image
            src="/images/marketing/bnp-team-full.jpg"
            alt="The BNP Fulfillment team"
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover object-[center_70%] lg:object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-navy/40 to-transparent lg:from-navy/60" />
          <div className="absolute right-6 bottom-6 left-6 rounded-xl bg-white/95 p-5 shadow-xl backdrop-blur sm:right-auto sm:max-w-xs">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-teal-700">
              On arrival
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-graphite">
              Every unit is counted, labelled with its own barcode and shown on your dashboard.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
