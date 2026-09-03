import { MapPin, Mail, Phone, Globe } from "lucide-react";
import { company, hub } from "@/lib/site-content";
import { SectionHeading } from "./section-heading";
import { Reveal } from "./reveal";
import { Icon } from "./icon";

export function Hub() {
  return (
    <section id="hub" className="bg-card py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          label={hub.label}
          title={hub.title}
          description={hub.description}
        />

        <div className="mt-14 grid gap-10 lg:grid-cols-2 lg:items-start">
          <Reveal>
            <ul className="flex flex-col">
              {hub.points.map((point) => (
                <li
                  key={point.title}
                  className="flex gap-4 border-b border-stone py-4 last:border-b-0"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-teal/10 text-teal">
                    <Icon name={point.icon} className="size-5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-navy">
                      {point.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-graphite">
                      {point.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.08} className="rounded-2xl bg-navy p-8">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-300">
              {hub.card.eyebrow}
            </span>
            <h3 className="mt-2 flex items-center gap-2 text-2xl font-semibold text-white">
              <MapPin className="size-5 text-gold" />
              {hub.card.city}
            </h3>
            <p className="mt-1 text-sm font-medium text-gold">{hub.card.area}</p>

            <ul className="mt-6 flex flex-col">
              {hub.card.items.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-2.5 border-b border-white/10 py-2.5 text-sm text-mist last:border-b-0"
                >
                  <span className="size-1.5 rounded-full bg-teal-300" />
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-6 border-t border-white/10 pt-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mist">
                Contact us
              </p>
              <div className="mt-3 flex flex-col gap-2 text-sm">
                <a
                  href={`tel:${company.phone}`}
                  className="flex items-center gap-2 text-teal-300 transition-colors hover:text-gold"
                >
                  <Phone className="size-4" />
                  {company.phoneDisplay}
                </a>
                <a
                  href={`mailto:${company.email}`}
                  className="flex items-center gap-2 text-teal-300 transition-colors hover:text-gold"
                >
                  <Mail className="size-4" />
                  {company.email}
                </a>
                <a
                  href={`https://${company.website}`}
                  className="flex items-center gap-2 text-teal-300 transition-colors hover:text-gold"
                >
                  <Globe className="size-4" />
                  {company.website}
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
