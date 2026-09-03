"use client";

import { useEffect, useRef, useState } from "react";
import {
  animate,
  useInView,
  useReducedMotion,
} from "motion/react";

type StatCounterProps = {
  value: number;
  suffix?: string;
  label: string;
};

export function StatCounter({ value, suffix = "", label }: StatCounterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);

  useEffect(() => {
    if (!inView || reduce) {
      setDisplay(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 1.4,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    });
    return () => controls.stop();
  }, [inView, reduce, value]);

  return (
    <div ref={ref} className="relative pl-5">
      <span className="absolute left-0 top-1/4 h-1/2 w-[3px] rounded-full bg-gold" />
      <div className="text-3xl font-semibold tabular-nums tracking-tight text-gold sm:text-4xl">
        {display.toLocaleString("en-NG")}
        {suffix}
      </div>
      <div className="mt-1 text-xs font-medium uppercase tracking-[0.1em] text-mist">
        {label}
      </div>
    </div>
  );
}
