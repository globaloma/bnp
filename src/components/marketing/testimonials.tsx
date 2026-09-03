import { Star } from "lucide-react";
import { testimonials } from "@/lib/site-content";
import { SectionHeading } from "./section-heading";
import { Reveal } from "./reveal";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

export function Testimonials() {
  return (
    <section id="stories" className="bg-cream py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading label={testimonials.label} title={testimonials.title} />

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {testimonials.items.map((item, i) => (
            <Reveal
              key={item.name}
              delay={i * 0.06}
              className="flex flex-col rounded-xl border border-stone bg-card p-6"
            >
              <div className="flex gap-0.5 text-gold">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star key={s} className="size-3.5 fill-current" />
                ))}
              </div>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-navy">
                {item.quote}
              </p>
              <div className="mt-5 flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-teal text-sm font-semibold text-white">
                  {initials(item.name)}
                </span>
                <div>
                  <div className="text-sm font-semibold text-navy">
                    {item.name}
                  </div>
                  <div className="text-xs text-mist">{item.business}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
