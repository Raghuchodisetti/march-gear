"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";

/**
 * Expert score as a thin ring with a red arc that draws in once on view.
 * The number stays legible without JavaScript; only the arc animates.
 */
export function ScoreDial({
  score,
  max = 10,
  size = 72,
  stroke,
  tone = "dark",
  showMax = true,
  className,
}: {
  score: number;
  max?: number;
  size?: number;
  stroke?: number;
  tone?: "dark" | "light";
  showMax?: boolean;
  className?: string;
}) {
  const width = stroke ?? (size >= 96 ? 3 : 2.5);
  const r = (size - width) / 2;
  const c = size / 2;
  const light = tone === "light";

  return (
    <span
      role="img"
      aria-label={`Expert score ${score.toFixed(1)} out of ${max}`}
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={c} cy={c} r={r} fill="none" strokeWidth={width} stroke={light ? "rgb(255 255 255 / 0.16)" : "var(--color-line)"} />
        <motion.circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          strokeWidth={width}
          stroke="var(--color-red)"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: Math.max(0, Math.min(1, score / max)) }}
          viewport={{ once: true, amount: 0.8 }}
          transition={{ duration: 1.2, ease: EASE }}
        />
      </svg>
      <span aria-hidden className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn("font-display font-semibold leading-none tracking-[-0.03em] num [font-stretch:108%]", light ? "text-white" : "text-ink")}
          style={{ fontSize: Math.round(size * 0.3) }}
        >
          {score.toFixed(1)}
        </span>
        {showMax && size >= 56 && (
          <span className={cn("mt-1 text-[10px] font-medium tracking-[0.08em] num", light ? "text-white/45" : "text-muted")}>/ {max}</span>
        )}
      </span>
    </span>
  );
}
