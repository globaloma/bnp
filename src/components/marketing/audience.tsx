import { Check } from "lucide-react";
import { audience } from "@/lib/site-content";
import { SectionHeading } from "./section-heading";
import { Reveal } from "./reveal";

export function Audience() {
  return (
    <section id="audience" className="bg-cream py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          label={audience.label}
          title={audience.title}
          description={audience.description}
        />

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
