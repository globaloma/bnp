import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { steps } from "@/lib/site-content";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Icon } from "./icon";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

/** Numbered steps. `layout="grid"` for the homepage, `"timeline"` for /how-it-works. */
export function Steps({ layout = "grid" }: { layout?: "grid" | "timeline" }) {
  if (layout === "timeline") {
    return (
      <ol className="relative mx-auto flex max-w-3xl flex-col gap-10 before:absolute before:top-2 before:bottom-2 before:left-7 before:w-0.5 before:bg-stone">
        {steps.items.map((step, i) => (
          <Reveal as="li" key={step.title} delay={i * 0.05} className="relative flex gap-6">
            <span className="relative z-10 flex size-14 shrink-0 items-center justify-center rounded-full border-4 border-cream bg-navy text-gold shadow-md">
              <Icon name={step.icon} className="size-6" />
            </span>
            <div className="flex-1 rounded-2xl border border-stone bg-white p-6 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">
                Step {i + 1}
              </span>
              <h3 className="mt-1 font-display text-xl font-bold text-navy">{step.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-graphite">{step.body}</p>
            </div>
          </Reveal>
        ))}
      </ol>
    );
  }

  return (
    <section className="bg-cream bg-dots py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          align="center"
          label={steps.label}
          title={steps.title}
          description={steps.description}
        />
        <ol className="mt-16 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {steps.items.map((step, i) => (
            <Reveal
              as="li"
              key={step.title}
              delay={(i % 3) * 0.08}
              className="group relative rounded-2xl border border-stone bg-white p-7 pt-10 transition-shadow hover:shadow-[0_24px_60px_-28px_rgba(15,42,68,0.4)]"
            >
              <span
                className={cn(
                  "absolute -top-6 left-7 flex size-12 items-center justify-center rounded-full font-display text-lg font-extrabold shadow-md transition-colors",
                  "bg-navy text-gold group-hover:bg-gold group-hover:text-navy",
                )}
              >
                {i + 1}
              </span>
              <Icon
                name={step.icon}
                className="absolute top-7 right-7 size-9 text-stone transition-colors group-hover:text-gold/40"
              />
              <h3 className="font-display text-lg font-bold text-navy">{step.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-graphite">{step.body}</p>
            </Reveal>
          ))}
        </ol>
        <div className="mt-12 flex justify-center">
          <Button render={<Link href="/how-it-works" />} size="xl" variant="outline" className="border-navy/20 bg-white">
            See the full process
            <ArrowRight />
          </Button>
        </div>
      </div>
    </section>
  );
}
