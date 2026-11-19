import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Presentational primitives shared by the calculators. Hook-free, so they
 * render inside client islands and server pages alike.
 */

/** A labelled figure. `hero` is the single headline number of an instrument. */
export function Readout({
  label,
  value,
  unit,
  caption,
  size = "md",
  tone = "dark",
  live = false,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  caption?: ReactNode;
  size?: "hero" | "lg" | "md" | "sm";
  tone?: "dark" | "light";
  live?: boolean;
  className?: string;
}) {
  const light = tone === "light";
  return (
    <div className={cn("min-w-0", className)}>
      <p className={cn("type-eyebrow", light ? "text-white/55" : "text-muted")}>{label}</p>
      <p
        aria-live={live ? "polite" : undefined}
        className={cn(
          "num flex flex-wrap items-baseline gap-x-2",
          size === "hero" && "mt-4 font-display text-[clamp(3rem,2rem+4.4vw,5.75rem)] font-semibold leading-[0.9] tracking-[-0.045em] [font-stretch:108%]",
          size === "lg" && "type-h2 mt-3",
          size === "md" && "type-h3 mt-2.5",
          size === "sm" && "type-h4 mt-2",
          light ? "text-white" : "text-ink",
        )}
      >
        <span className="min-w-0 break-words">{value}</span>
        {unit && (
          <span className={cn("font-sans text-[13px] font-medium tracking-normal", light ? "text-white/55" : "text-muted", size === "hero" && "text-[15px]")}>
            {unit}
          </span>
        )}
      </p>
      {caption && <p className={cn("mt-2 text-[13px] leading-snug", light ? "text-white/55" : "text-muted")}>{caption}</p>}
    </div>
  );
}

/** Legend key — a square swatch for areas/bars, a short stroke for lines. */
export function LegendKey({ label, swatch, line = false, tone = "dark" }: { label: ReactNode; swatch: string; line?: boolean; tone?: "dark" | "light" }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-[12.5px]", tone === "dark" ? "text-ink/80" : "text-white/70")}>
      <span aria-hidden className={cn(line ? "h-[2px] w-4 rounded-full" : "size-2.5 rounded-[1px]", swatch)} />
      {label}
    </span>
  );
}

/** Small uppercase step label used to sequence instrument inputs. */
export function StepLabel({ index, children, tone = "dark" }: { index: string; children: ReactNode; tone?: "dark" | "light" }) {
  return (
    <p className={cn("flex items-center gap-3 text-[12px] font-medium", tone === "dark" ? "text-ink" : "text-white")}>
      <span className={cn("font-mono text-[11px]", tone === "dark" ? "text-muted" : "text-white/45")}>{index}</span>
      <span aria-hidden className={cn("h-px w-5", tone === "dark" ? "bg-line" : "bg-white/20")} />
      {children}
    </p>
  );
}

/** Fine-print disclaimer that sits under every result. */
export function EstimateNote({ children, tone = "dark", className }: { children?: ReactNode; tone?: "dark" | "light"; className?: string }) {
  return (
    <p className={cn("text-[11.5px] leading-relaxed", tone === "dark" ? "text-muted" : "text-white/45", className)}>
      {children ?? "Illustrative estimate based on indicative demo data and simplified assumptions. Not financial advice."}
    </p>
  );
}
