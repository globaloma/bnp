"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, CheckCircle2, MapPin, Package } from "lucide-react";
import { hero } from "@/lib/site-content";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StatCounter } from "./stat-counter";

export function Hero() {
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden bg-navy pt-20 pb-0">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-24 size-[480px] rounded-full bg-teal/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-64 size-[360px] rounded-full bg-gold/10 blur-3xl"
      />
      <div className="container-page relative grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="inline-flex items-center gap-2 rounded-full border border-teal/30 bg-teal/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-300"
          >
            <MapPin className="size-3" />
            {hero.eyebrow}
          </motion.div>

          <motion.h1
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 max-w-xl font-heading text-4xl font-semibold leading-[1.05] tracking-tight text-white text-balance sm:text-6xl"
          >
            {hero.titleLines.map((line, i) => (
              <span key={line} className={i === 1 ? "block text-gold" : "block"}>
                {line}
              </span>
            ))}
          </motion.h1>

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-mist"
          >
            {hero.subtitle}
          </motion.p>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="mt-9 flex flex-wrap gap-3"
          >
            <Button render={<Link href={hero.primaryCta.href} />} size="xl">
              {hero.primaryCta.label}
              <ArrowRight />
            </Button>
            <Button
              render={<Link href={hero.secondaryCta.href} />}
              size="xl"
              variant="outline"
              className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              {hero.secondaryCta.label}
            </Button>
          </motion.div>

          <div className="mt-16 grid grid-cols-2 gap-y-8 border-t border-white/10 py-8 sm:grid-cols-4">
            {hero.stats.map((stat) => (
              <StatCounter key={stat.label} {...stat} />
            ))}
          </div>
        </div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto w-full max-w-sm pb-16 lg:pb-0"
        >
          <div
            aria-hidden
            className="absolute -inset-3 -z-10 rounded-3xl bg-gradient-to-br from-teal/20 via-transparent to-gold/20 blur-xl"
          />
          <div className="rounded-2xl border border-white/10 bg-navy-600 p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-teal-300">
                <span className="size-1.5 animate-pulse rounded-full bg-teal-300" />
                {hero.preview.tag}
              </span>
              <span className="font-mono text-[11px] text-mist">
                {hero.preview.orderRef}
              </span>
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/5 p-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gold/15 text-gold">
                <Package className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {hero.preview.item}
                </p>
                <p className="text-xs text-mist">
                  {hero.preview.customer} · {hero.preview.total}
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center">
              {hero.preview.steps.map((step, i) => {
                const done = i < hero.preview.activeStep;
                const active = i === hero.preview.activeStep;
                return (
                  <div key={step} className="flex flex-1 items-center last:flex-none">
                    <div className="flex flex-col items-center gap-1.5">
                      <span
                        className={cn(
                          "flex size-6 items-center justify-center rounded-full text-[10px] font-bold",
                          done && "bg-teal-300 text-navy",
                          active && "bg-gold text-navy",
                          !done && !active && "bg-white/10 text-mist",
                        )}
                      >
                        {done ? <CheckCircle2 className="size-3.5" /> : i + 1}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-medium",
                          active ? "text-gold" : done ? "text-teal-300" : "text-mist",
                        )}
                      >
                        {step}
                      </span>
                    </div>
                    {i < hero.preview.steps.length - 1 ? (
                      <span
                        className={cn(
                          "mx-1.5 mb-4 h-px flex-1",
                          done ? "bg-teal-300" : "bg-white/10",
                        )}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
