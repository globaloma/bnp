import { steps } from "@/lib/site-content";
import { SectionHeading } from "./section-heading";
import { Reveal } from "./reveal";
import { Icon } from "./icon";

export function HowItWorks() {
  return (
    <section id="how" className="bg-navy py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          label={steps.label}
          title={steps.title}
          description={steps.description}
          tone="dark"
        />

        <ol className="mt-14 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
          {steps.items.map((step, i) => (
            <Reveal
              as="li"
              key={step.title}
              delay={(i % 4) * 0.05}
              className="flex flex-col gap-3 bg-navy p-6"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-full bg-gold text-sm font-semibold text-navy">
                  {i + 1}
                </span>
                <Icon name={step.icon} className="size-5 text-teal-300" />
              </div>
              <h3 className="text-sm font-semibold text-white">{step.title}</h3>
              <p className="text-sm leading-relaxed text-mist">{step.body}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
