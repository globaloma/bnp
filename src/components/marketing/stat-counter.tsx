"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

type StatCounterProps = {
  value: number;
  suffix?: string;
  label: string;
  tone?: "light" | "dark";
};

export function StatCounter({ value, suffix = "", label, tone = "dark" }: StatCounterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  // Starts at the real number, so it reads correctly before (or without)
  // JavaScript; the count up from zero runs once it scrolls into view.
  const [animated, setAnimated] = useState(value);

  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(0, value, {
      duration: 1.4,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setAnimated(Math.round(latest)),
    });
    return () => controls.stop();
  }, [inView, reduce, value]);

  // With reduced motion the real number shows straight away.
  const display = reduce ? value : animated;

  return (
    <div ref={ref}>
      <div
        className={cn(
          "font-display text-4xl font-extrabold tabular-nums tracking-tight sm:text-5xl",
          tone === "dark" ? "text-white" : "text-navy",
        )}
      >
        {display.toLocaleString("en-NG")}
        <span className="text-gold">{suffix}</span>
      </div>
      <div
        className={cn(
          "mt-1.5 text-sm font-medium",
          tone === "dark" ? "text-mist" : "text-graphite",
        )}
      >
        {label}
      </div>
    </div>
  );
}
