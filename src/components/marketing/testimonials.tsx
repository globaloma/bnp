import { Quote } from "lucide-react";
import { testimonials } from "@/lib/site-content";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

export function Testimonials() {
  return (
    <section className="py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading align="center" label={testimonials.label} title={testimonials.title} />

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {testimonials.items.map((t, i) => {
            const featured = i === 1;
            return (
              <Reveal
                key={t.name}
                delay={i * 0.08}
                className={cn(
                  "relative flex flex-col rounded-2xl p-8",
                  featured
                    ? "bg-navy text-white shadow-[0_30px_80px_-30px_rgba(15,42,68,0.6)] lg:-translate-y-4"
                    : "border border-stone bg-white",
                )}
              >
                <Quote
                  className={cn("size-10", featured ? "text-gold" : "text-gold/70")}
                  fill="currentColor"
                  strokeWidth={0}
                />
                <blockquote
                  className={cn(
                    "mt-5 flex-1 text-base leading-relaxed",
                    featured ? "text-white/85" : "text-graphite",
                  )}
                >
                  {t.quote}
                </blockquote>
                <div
                  className={cn(
                    "mt-7 flex items-center gap-3.5 border-t pt-6",
                    featured ? "border-white/10" : "border-stone",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-12 items-center justify-center rounded-full font-display text-sm font-bold",
                      featured ? "bg-gold text-navy" : "bg-navy text-gold",
                    )}
                    aria-hidden
                  >
                    {initials(t.name)}
                  </span>
                  <span>
                    <span className={cn("block font-display font-bold", featured ? "text-white" : "text-navy")}>
                      {t.name}
                    </span>
                    <span className={cn("block text-sm", featured ? "text-mist" : "text-graphite")}>
                      {t.business}, {t.detail}
                    </span>
                  </span>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
