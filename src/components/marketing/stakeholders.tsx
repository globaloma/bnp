import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { stakeholders } from "@/lib/site-content";
import { SectionHeading } from "./section-heading";
import { Reveal } from "./reveal";
import { Icon } from "./icon";
import { accentTileClass } from "./accent";
import { cn } from "@/lib/utils";

export function Stakeholders() {
  return (
    <section className="bg-cream py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          label={stakeholders.label}
          title={stakeholders.title}
          description={stakeholders.description}
        />

        <div className="mt-14 grid gap-5 sm:grid-cols-3">
          {stakeholders.items.map((item, i) => (
            <Reveal
              key={item.title}
              delay={i * 0.06}
              className="flex flex-col rounded-2xl border border-stone bg-card p-7 shadow-sm"
            >
              <span
                className={cn(
                  "flex size-12 items-center justify-center rounded-xl",
                  accentTileClass(i),
                )}
              >
                <Icon name={item.icon} className="size-6" />
              </span>
              <h3 className="mt-5 text-lg font-semibold text-navy">{item.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-graphite">
                {item.body}
              </p>

              {item.cta ? (
                <Link
                  href={item.cta.href}
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-teal transition-colors hover:text-teal-700"
                >
                  {item.cta.label}
                  <ArrowRight className="size-4" />
                </Link>
              ) : (
                <span className="mt-6 inline-flex w-fit items-center rounded-full bg-stone px-3 py-1 text-xs font-semibold text-graphite">
                  {item.badge}
                </span>
              )}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
