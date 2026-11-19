"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { Counter } from "@/components/ui/reveal";

/** Thin horizontal bar that fills once it scrolls into view and re-animates on value change. */
export function Bar({
  value,
  max,
  className,
  barClassName = "bg-ink",
  trackClassName = "bg-line",
  delay = 0,
  label,
}: {
  value: number;
  max: number;
  className?: string;
  barClassName?: string;
  trackClassName?: string;
  delay?: number;
  /** Accessible description, e.g. "158 bhp" */
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div
      ref={ref}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("relative h-[5px] w-full overflow-hidden", trackClassName, className)}
    >
      <motion.div
        className={cn("absolute inset-0 origin-left", barClassName)}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: inView ? ratio : 0 }}
        transition={{ duration: 1.1, ease: EASE, delay: inView ? delay : 0 }}
      />
    </div>
  );
}

/** Semicircular gauge for headline performance figures. */
export function ArcGauge({
  value,
  ratio,
  label,
  unit,
  decimals = 0,
  caption,
  tone = "dark",
}: {
  value: number;
  /** 0–1 fill of the arc */
  ratio: number;
  label: string;
  unit: string;
  decimals?: number;
  caption?: string;
  tone?: "dark" | "light";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const fill = Math.max(0.02, Math.min(1, ratio));
  const onDark = tone === "dark";
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <figure ref={ref} className="flex flex-col">
      <div className="relative">
        <svg viewBox="0 0 200 116" className="w-full" aria-hidden>
          <path
            d="M 18 104 A 82 82 0 0 1 182 104"
            fill="none"
            strokeWidth="3"
            className={onDark ? "stroke-white/12" : "stroke-line"}
          />
          <motion.path
            d="M 18 104 A 82 82 0 0 1 182 104"
            fill="none"
            strokeWidth="3"
            strokeLinecap="butt"
            className="stroke-red"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: inView ? fill : 0 }}
            transition={{ duration: 1.4, ease: EASE }}
          />
          {ticks.map((t) => {
            const angle = Math.PI * (1 - t);
            const x1 = 100 + Math.cos(angle) * 92;
            const y1 = 104 - Math.sin(angle) * 92;
            const x2 = 100 + Math.cos(angle) * 98;
            const y2 = 104 - Math.sin(angle) * 98;
            return (
              <line
                key={t}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                strokeWidth="1"
                className={onDark ? "stroke-white/30" : "stroke-ink/25"}
              />
            );
          })}
        </svg>
        <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
          <Counter to={value} decimals={decimals} className="font-display text-[clamp(1.75rem,1.3rem+1.6vw,2.75rem)] font-semibold leading-none tracking-[-0.03em] num" />
          <span className={cn("mt-1.5 text-[12px]", onDark ? "text-white/50" : "text-muted")}>{unit}</span>
        </div>
      </div>
      <figcaption className="mt-5 text-center">
        <span className={cn("type-eyebrow", onDark ? "text-white" : "text-ink")}>{label}</span>
        {caption && <span className={cn("mt-2 block text-[12.5px]", onDark ? "text-white/45" : "text-muted")}>{caption}</span>}
      </figcaption>
    </figure>
  );
}

/** Two concentric rings: claimed range (outer, red) and real-world estimate (inner). */
export function RangeRing({
  range,
  realWorld,
  tone = "light",
  className,
}: {
  range: number;
  realWorld: number;
  tone?: "light" | "dark";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const onDark = tone === "dark";
  return (
    <div ref={ref} className={cn("relative aspect-square w-full", className)}>
      <svg viewBox="0 0 200 200" className="size-full -rotate-90" aria-hidden>
        <circle cx="100" cy="100" r="92" fill="none" strokeWidth="2" className={onDark ? "stroke-white/10" : "stroke-line"} />
        <motion.circle
          cx="100"
          cy="100"
          r="92"
          fill="none"
          strokeWidth="4"
          className="stroke-red"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: inView ? 1 : 0 }}
          transition={{ duration: 1.6, ease: EASE }}
        />
        <circle cx="100" cy="100" r="78" fill="none" strokeWidth="2" className={onDark ? "stroke-white/10" : "stroke-line"} />
        <motion.circle
          cx="100"
          cy="100"
          r="78"
          fill="none"
          strokeWidth="4"
          className={onDark ? "stroke-white" : "stroke-ink"}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: inView ? realWorld / range : 0 }}
          transition={{ duration: 1.6, ease: EASE, delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className={cn("type-eyebrow", onDark ? "text-white/50" : "text-muted")}>Claimed range</span>
        <span className="mt-3 font-display text-[clamp(2.5rem,1.8rem+2.4vw,4rem)] font-semibold leading-none tracking-[-0.035em] num">
          <Counter to={range} />
        </span>
        <span className={cn("mt-1 text-[13px]", onDark ? "text-white/60" : "text-muted")}>kilometres</span>
        <span className={cn("mt-4 text-[12.5px] num", onDark ? "text-white/70" : "text-ink")}>
          ≈ {realWorld.toLocaleString("en-IN")} km real-world
        </span>
      </div>
    </div>
  );
}
