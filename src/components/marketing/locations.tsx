import Image from "next/image";
import { CheckCircle2, MapPin } from "lucide-react";
import { hub } from "@/lib/site-content";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

export function Locations() {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading align="center" label={hub.label} title={hub.title} description={hub.description} />
        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {hub.locations.map((loc, i) => (
            <Reveal
              key={loc.city}
              delay={i * 0.08}
              className="group overflow-hidden rounded-2xl border border-stone bg-cream/40"
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                <Image
                  src={loc.image}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 24rem, 100vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-navy/85 via-navy/20 to-transparent" />
                <span
                  className={cn(
                    "absolute top-4 left-4 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em]",
                    i === 0 ? "bg-gold text-navy" : "bg-white/90 text-navy",
                  )}
                >
                  {loc.status}
                </span>
                <div className="absolute bottom-4 left-5 text-white">
                  <div className="font-display text-3xl font-extrabold">{loc.city}</div>
                  <div className="flex items-center gap-1.5 text-sm text-white/80">
                    <MapPin className="size-3.5" />
                    {loc.area}
                  </div>
                </div>
              </div>
              <ul className="flex flex-col gap-3 p-6">
                {loc.points.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-[15px] text-graphite">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-teal" />
                    {p}
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
