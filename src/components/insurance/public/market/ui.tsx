"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Info, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { inr } from "./money";
import { INDICATIVE_NOTE } from "@/insurance/labels";
import type { AddOnStatus, MarketCompany } from "./engine";

/* Small building blocks shared by the marketplace pages. */

export { inr, fileSize } from "./money";

/** The insurer's logo on white, or its initials when there's no logo. */
export function CompanyLogo({ company, size = "md", className }: { company: Pick<MarketCompany, "name" | "shortName" | "logo">; size?: "sm" | "md" | "lg"; className?: string }) {
  const box = size === "sm" ? "size-9" : size === "lg" ? "size-20" : "size-12";
  const px = size === "sm" ? 36 : size === "lg" ? 80 : 48;
  const letters = (company.shortName || company.name)
    .replace(/\(demo\)/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[3px] border border-line bg-white", box, className)}>
      {company.logo ? (
        <Image src={company.logo} alt="" width={px} height={px} className="size-full object-contain p-1.5" />
      ) : (
        <span aria-hidden className={cn("font-display font-semibold tracking-[-0.04em] text-ink [font-stretch:112%]", size === "lg" ? "text-2xl" : size === "sm" ? "text-[12px]" : "text-[15px]")}>
          {letters}
        </span>
      )}
    </span>
  );
}

/** An (i) button that explains a figure. Hover/focus on desktop, tap on touch screens. */
export function InfoTip({ children, label = "What does this mean?", className, align = "right" }: { children: ReactNode; label?: string; className?: string; align?: "left" | "right" | "center" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <span ref={ref} className={cn("relative inline-flex align-middle", className)} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        // A mouse has already opened it on hover, so a click keeps it open; keyboard and touch toggle it.
        onClick={(e) => setOpen((v) => ((e.nativeEvent as PointerEvent).pointerType === "mouse" ? true : !v))}
        className="inline-flex size-5 items-center justify-center rounded-full text-muted transition-colors hover:text-ink focus-visible:text-ink"
      >
        <Info className="size-3.5" aria-hidden />
      </button>
      <AnimatePresence>
        {open && (
          <motion.span
            id={id}
            role="tooltip"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.2, ease: EASE }}
            className={cn(
              "absolute top-full z-30 mt-2 w-[min(18rem,calc(100vw-3rem))] rounded-[3px] bg-ink px-3.5 py-3 text-left text-[12px] font-normal normal-case leading-relaxed tracking-normal text-white/85 shadow-lift",
              align === "right" && "right-0",
              align === "left" && "left-0",
              align === "center" && "left-1/2 -translate-x-1/2",
            )}
          >
            {children}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/** "Indicative premium" with the INDICATIVE_NOTE explanation. */
export function IndicativeLabel({ className, align, tone = "dark" }: { className?: string; align?: "left" | "right" | "center"; tone?: "dark" | "light" }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11.5px] font-medium", tone === "dark" ? "text-muted" : "text-white/60", className)}>
      Indicative premium
      <InfoTip label="About indicative premiums" align={align}>
        {INDICATIVE_NOTE}
      </InfoTip>
    </span>
  );
}

/** On/off switch. */
export function Switch({ checked, onChange, label, disabled, className, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; disabled?: boolean; className?: string; hint?: ReactNode }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("group/sw flex w-full items-center justify-between gap-3 text-left text-[13.5px] text-ink disabled:cursor-not-allowed disabled:opacity-40", className)}
    >
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-[11.5px] text-muted">{hint}</span>}
      </span>
      <span aria-hidden className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors duration-[250ms]", checked ? "bg-red" : "bg-ink/15 group-hover/sw:bg-ink/25")}>
        <span className={cn("absolute top-0.5 size-4 rounded-full bg-white transition-transform duration-[250ms] ease-[var(--ease-premium)]", checked ? "translate-x-[18px]" : "translate-x-0.5")} />
      </span>
    </button>
  );
}

/** A checkbox row. */
export function CheckRow({ checked, onChange, children, count, disabled }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; count?: number; disabled?: boolean }) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-3 py-1.5 text-[13.5px] text-ink", disabled && "cursor-not-allowed opacity-40")}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="size-4 shrink-0 accent-[var(--color-ink)]" />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {count !== undefined && <span className="text-[12px] text-muted num">{count}</span>}
    </label>
  );
}

const THUMB =
  "pointer-events-none absolute inset-0 h-5 w-full appearance-none bg-transparent outline-none [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-[10px] [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[5px] [&::-moz-range-thumb]:border-red [&::-moz-range-thumb]:bg-white [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-[18px] [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[5px] [&::-webkit-slider-thumb]:border-red [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_1px_4px_rgb(17_17_17/0.2)] focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-ink/30";

/** A two-thumb range slider (min and max). `value` null = the full range. */
export function DualRange({
  label,
  min,
  max,
  step,
  value,
  onChange,
  format,
  disabled,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: [number, number] | null;
  onChange: (v: [number, number] | null) => void;
  format: (n: number) => string;
  disabled?: boolean;
}) {
  const span = Math.max(1, max - min);
  const lo = Math.min(max, Math.max(min, value?.[0] ?? min));
  const hi = Math.max(lo, Math.min(max, value?.[1] ?? max));
  const set = (a: number, b: number) => onChange(a <= min && b >= max ? null : [a, b]);
  const flat = max <= min;
  return (
    <div className={cn(disabled || flat ? "opacity-50" : "")}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[12.5px] font-medium text-ink">{label}</p>
        <p className="text-[12px] text-muted num">
          {format(lo)} – {format(hi)}
        </p>
      </div>
      <div className="relative mt-3 h-5">
        <span aria-hidden className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-line" />
        <span aria-hidden className="absolute top-1/2 h-[2px] -translate-y-1/2 bg-red" style={{ left: `${((lo - min) / span) * 100}%`, right: `${100 - ((hi - min) / span) * 100}%` }} />
        <input
          type="range"
          aria-label={`Minimum ${label.toLowerCase()}`}
          min={min}
          max={max}
          step={step}
          value={lo}
          disabled={disabled || flat}
          onChange={(e) => set(Math.min(Number(e.target.value), hi), hi)}
          className={THUMB}
        />
        <input
          type="range"
          aria-label={`Maximum ${label.toLowerCase()}`}
          min={min}
          max={max}
          step={step}
          value={hi}
          disabled={disabled || flat}
          onChange={(e) => set(lo, Math.max(Number(e.target.value), lo))}
          className={THUMB}
        />
      </div>
    </div>
  );
}

/** Included / optional / not offered marker for an add-on. */
export function AddOnMark({ status, premium, compact }: { status: AddOnStatus | "none"; premium?: number; compact?: boolean }) {
  if (status === "included")
    return (
      <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
        <span className="flex size-4 items-center justify-center rounded-full bg-ink text-white">
          <Check className="size-2.5" strokeWidth={3} aria-hidden />
        </span>
        Included
      </span>
    );
  if (status === "selected")
    return (
      <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
        <span className="flex size-4 items-center justify-center rounded-full bg-red text-white">
          <Check className="size-2.5" strokeWidth={3} aria-hidden />
        </span>
        Added{premium ? <span className="font-normal text-muted num">+{inr(premium)}</span> : null}
      </span>
    );
  if (status === "optional")
    return (
      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink">
        <span className="flex size-4 items-center justify-center rounded-full border border-ink/30 text-ink">
          <span className="text-[10px] leading-none">+</span>
        </span>
        {compact ? <span className="num">+{inr(premium ?? 0)}</span> : <span>Optional · <span className="num">+{inr(premium ?? 0)}</span></span>}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted">
      <span className="flex size-4 items-center justify-center rounded-full border border-line">
        {status === "unavailable" ? <X className="size-2.5" aria-hidden /> : <Minus className="size-2.5" aria-hidden />}
      </span>
      {status === "unavailable" ? "Not for this car" : "Not offered"}
    </span>
  );
}

/** A thin labelled figure. */
export function Figure({ label, children, hint, className }: { label: ReactNode; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[11.5px] text-muted">{label}</p>
      <p className="mt-1 truncate text-[14px] font-medium text-ink num">{children}</p>
      {hint && <p className="mt-0.5 truncate text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

/** Uppercase tag in the site's badge style. */
export function Tag({ children, tone = "mist", className }: { children: ReactNode; tone?: "mist" | "ink" | "red" | "outline"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1 whitespace-nowrap rounded-[2px] px-2 text-[10px] font-semibold uppercase tracking-[0.12em]",
        tone === "mist" && "bg-mist text-ink",
        tone === "ink" && "bg-ink text-white",
        tone === "red" && "bg-red text-white",
        tone === "outline" && "border border-line bg-white text-ink",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Skeleton block for loading states. */
export function Shimmer({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block animate-shimmer rounded-[3px] bg-[linear-gradient(90deg,#f1f1f1_0%,#fafafa_50%,#f1f1f1_100%)] bg-[length:200%_100%]", className)} />;
}
