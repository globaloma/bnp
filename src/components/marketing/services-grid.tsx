import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { services } from "@/lib/site-content";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

/** Photo cards linking into /services. `limit` trims the list for the homepage. */
export function ServicesGrid({
  limit,
  heading = true,
  className,
}: {
  limit?: number;
  heading?: boolean;
  className?: string;
}) {
  const items = limit ? services.items.slice(0, limit) : services.items;

  return (
    <section className={cn("bg-white py-20 sm:py-28", className)}>
      <div className="container-page">
        {heading ? (
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <SectionHeading
              label={services.label}
              title={services.title}
              description={services.description}
            />
            <Link
              href="/services"
              className="inline-flex shrink-0 items-center gap-2 text-[15px] font-bold text-teal-700 hover:text-navy"
            >
              All services
              <ArrowRight className="size-4" />
            </Link>
          </div>
        ) : null}

        <div className={cn("grid gap-6 sm:grid-cols-2 lg:grid-cols-3", heading && "mt-14")}>
          {items.map((item, i) => (
            <Reveal key={item.slug} delay={(i % 3) * 0.08}>
              <Link
                href={`/services#${item.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-stone bg-cream/40 transition-all duration-300 hover:-translate-y-1 hover:border-transparent hover:bg-white hover:shadow-[0_24px_60px_-24px_rgba(15,42,68,0.35)]"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <Image
                    src={item.image}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 24rem, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-navy/50 to-transparent" />
                </div>
                <div className="relative flex flex-1 flex-col px-6 pt-10 pb-6">
                  <span className="absolute -top-7 left-6 flex size-14 items-center justify-center rounded-xl bg-gold text-navy shadow-lg transition-colors group-hover:bg-navy group-hover:text-gold">
                    <Icon name={item.icon} className="size-7" />
                  </span>
                  <h3 className="font-display text-xl font-bold text-navy">{item.title}</h3>
                  <p className="mt-2 flex-1 text-[15px] leading-relaxed text-graphite">{item.body}</p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-teal-700 group-hover:text-navy">
                    Learn more
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
