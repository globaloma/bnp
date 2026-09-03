"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, MapPin } from "lucide-react";
import { hero } from "@/lib/site-content";
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
      <div className="container-page relative">
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
          className="mt-6 max-w-3xl font-heading text-4xl font-semibold leading-[1.05] tracking-tight text-white text-balance sm:text-6xl"
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
    </section>
  );
}
