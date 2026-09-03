import { services } from "@/lib/site-content";
import { SectionHeading } from "./section-heading";
import { Reveal } from "./reveal";
import { Icon } from "./icon";

export function Services() {
  return (
    <section id="services" className="bg-card py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          label={services.label}
          title={services.title}
          description={services.description}
        />

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {services.items.map((item, i) => (
            <Reveal
              key={item.title}
              delay={(i % 4) * 0.05}
              className="group flex flex-col rounded-xl border border-stone bg-cream p-6 transition-shadow hover:shadow-[0_12px_40px_-12px_rgba(46,139,154,0.25)]"
            >
              <span className="flex size-11 items-center justify-center rounded-lg bg-teal/10 text-teal">
                <Icon name={item.icon} className="size-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-navy">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-graphite">
                {item.body}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
