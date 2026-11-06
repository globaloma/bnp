import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, MessageCircle } from "lucide-react";
import { company, nav, training } from "@/lib/site-content";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/marketing/page-hero";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/marketing/reveal";
import { Icon } from "@/components/marketing/icon";

export const metadata: Metadata = {
  title: "Training",
  description: `${company.name} now trains merchants and their teams to run fulfillment with confidence, from receiving to returns. We set it up, train your people and support you. Book a consultation.`,
};

export default function TrainingPage() {
  return (
    <>
      <PageHero
        crumb="Training"
        title={training.title}
        description={training.description}
        image="/images/marketing/support-team.jpg"
      />

      {/* Why training: image and the promise */}
      <section className="bg-white py-20 sm:py-28">
        <div className="container-page grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal className="relative aspect-[4/3] overflow-hidden rounded-2xl lg:order-2">
            <Image
              src={training.intro.image}
              alt="A merchant learning the BNP dashboard"
              fill
              sizes="(min-width: 1024px) 36rem, 100vw"
              className="object-cover"
            />
            <span className="absolute -bottom-6 -left-3 flex size-20 items-center justify-center rounded-2xl bg-gold text-navy shadow-xl sm:-left-6">
              <Icon name="Rocket" className="size-9" />
            </span>
          </Reveal>
          <div>
            <SectionHeading
              label={training.intro.label}
              title={training.intro.title}
              description={training.intro.description}
            />
            <ul className="mt-8 flex flex-col gap-3">
              {training.intro.points.map((point, i) => (
                <Reveal
                  as="li"
                  key={point}
                  delay={i * 0.06}
                  className="flex items-center gap-3 rounded-xl border border-stone bg-cream/50 p-4 text-[15px] font-semibold text-navy"
                >
                  <CheckCircle2 className="size-5 shrink-0 text-teal" />
                  {point}
                </Reveal>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* What you'll learn: the full curriculum */}
      <section className="bg-cream bg-dots py-20 sm:py-28">
        <div className="container-page">
          <SectionHeading
            align="center"
            label={training.modules.label}
            title={training.modules.title}
            description={training.modules.description}
          />
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {training.modules.items.map((m, i) => (
              <Reveal key={m.title} delay={(i % 4) * 0.06}>
                <div className="group flex h-full flex-col rounded-2xl border border-stone bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-[0_24px_60px_-24px_rgba(15,42,68,0.35)]">
                  <span className="flex size-12 items-center justify-center rounded-xl bg-gold text-navy shadow-sm transition-colors group-hover:bg-navy group-hover:text-gold">
                    <Icon name={m.icon} className="size-6" />
                  </span>
                  <h3 className="mt-5 font-display text-lg font-bold text-navy">{m.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-graphite">{m.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How the training works: numbered path, split with a photo */}
      <section className="relative overflow-hidden bg-navy">
        <div className="grid lg:grid-cols-2">
          <div className="bg-dots-light">
            <div className="mx-auto max-w-[38rem] px-6 py-20 sm:py-28 lg:mr-0 lg:pr-16">
              <SectionHeading
                tone="dark"
                label={training.process.label}
                title={training.process.title}
                description={training.process.description}
              />
              <ol className="mt-12 flex flex-col gap-8">
                {training.process.steps.map((step, i) => (
                  <Reveal as="li" key={step.title} delay={i * 0.08} className="flex gap-5">
                    <span className="font-display text-3xl leading-none font-extrabold text-gold/80 tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="border-l border-white/15 pl-5">
                      <h3 className="font-display text-lg font-bold text-white">{step.title}</h3>
                      <p className="mt-1.5 text-[15px] leading-relaxed text-mist">{step.body}</p>
                    </div>
                  </Reveal>
                ))}
              </ol>
            </div>
          </div>
          <div className="relative min-h-80 lg:min-h-full">
            <Image
              src={training.process.image}
              alt="BNP warehouse staff during a hands-on session"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-navy/60 to-transparent" />
          </div>
        </div>
      </section>

      {/* Who it is for, and how it can be delivered */}
      <section className="bg-white py-20 sm:py-28">
        <div className="container-page">
          <SectionHeading align="center" label={training.audiences.label} title={training.audiences.title} />
          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            {training.audiences.items.map((a, i) => (
              <Reveal
                key={a.title}
                delay={i * 0.08}
                className="flex h-full flex-col rounded-2xl border border-stone bg-cream/40 p-7"
              >
                <span className="flex size-12 items-center justify-center rounded-xl bg-navy text-gold">
                  <Icon name={a.icon} className="size-6" />
                </span>
                <h3 className="mt-5 font-display text-xl font-bold text-navy">{a.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-graphite">{a.body}</p>
              </Reveal>
            ))}
          </div>
          <div className="mt-12 flex flex-col items-center gap-3">
            <p className="text-sm font-semibold text-graphite">Training comes to you, your way</p>
            <div className="flex flex-wrap justify-center gap-2.5">
              {training.formats.map((f) => (
                <span
                  key={f}
                  className="rounded-full border border-stone bg-white px-4 py-2 text-sm font-semibold text-navy"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Book a consultation */}
      <section className="bg-navy bg-dots-light py-20 sm:py-28">
        <div className="container-page flex flex-col items-center text-center">
          <SectionHeading
            tone="dark"
            align="center"
            label={training.label}
            title={training.cta.title}
            description={training.cta.description}
          />
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button render={<Link href={training.cta.primary.href} />} size="xl">
              {training.cta.primary.label}
              <ArrowRight />
            </Button>
            <Button
              render={<a href={company.whatsapp} target="_blank" rel="noopener noreferrer" />}
              size="xl"
              variant="outline"
              className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              <MessageCircle /> Chat on WhatsApp
            </Button>
          </div>
          <p className="mt-6 text-sm text-mist">
            Prefer to talk first? Reach us on {company.phoneDisplay} or visit the{" "}
            <Link href={nav.quote.href} className="font-semibold text-gold-300 hover:underline">
              quote page
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
