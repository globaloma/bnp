import Image from "next/image";
import { Check } from "lucide-react";
import { audience } from "@/lib/site-content";
import { SectionHeading } from "./section-heading";
import { Reveal } from "./reveal";

export function Audience() {
  return (
    <section id="audience" className="bg-cream py-20 sm:py-28">
      <div className="container-page grid gap-10 lg:grid-cols-[1fr_0.8fr] lg:items-center">
        <SectionHeading
          label={audience.label}
          title={audience.title}
          description={audience.description}
        />

        <Reveal delay={0.08} className="relative hidden h-64 sm:block lg:h-72">
          <div className="absolute top-0 left-0 h-[78%] w-[62%] overflow-hidden rounded-2xl shadow-lg">
            <Image
              src="/images/marketing/fashion.jpg"
              alt="A fashion brand's product, the kind of business BNP fulfills for"
              fill
              sizes="320px"
              className="object-cover"
            />
          </div>
          <div className="absolute right-0 bottom-0 h-[62%] w-[52%] overflow-hidden rounded-2xl border-4 border-cream shadow-lg">
            <Image
              src="/images/marketing/cosmetics.jpg"
              alt="A skincare and beauty product range, another category BNP fulfills for"
              fill
              sizes="260px"
              className="object-cover"
            />
          </div>
        </Reveal>
      </div>

      <div className="container-page">
        <div className="mt-14 grid gap-10 lg:grid-cols-2">
          <Reveal>
            <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-navy">
              Your business looks like this
            </h3>
            <ul className="mt-4">
              {audience.fitList.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 border-b border-stone py-3 text-sm text-graphite"
                >
                  <Check className="mt-0.5 size-4 shrink-0 text-teal" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.08}>
            <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-navy">
              Industries that work well with BNP
            </h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {audience.industries.map((industry) => (
                <span
                  key={industry}
                  className="rounded-full bg-teal/10 px-3.5 py-1.5 text-[13px] font-medium text-teal-700"
                >
                  {industry}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
