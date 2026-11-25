import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * March Gear mark: an H-pattern gear gate. The red dot sits in fifth —
 * a quiet nod to momentum.
 */
export function LogoMark({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  const stroke = tone === "dark" ? "#111111" : "#ffffff";
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <rect x="1" y="1" width="30" height="30" rx="3" fill="none" stroke={stroke} strokeWidth="2" />
      <path d="M9 8v16M16 8v16M23 8v8M9 16h14" stroke={stroke} strokeWidth="2.25" strokeLinecap="round" fill="none" />
      <circle cx="23" cy="23" r="2.75" fill="#E31E24" />
    </svg>
  );
}

export function Logo({ tone = "dark", className, compact = false }: { tone?: "dark" | "light"; className?: string; compact?: boolean }) {
  return (
    <Link href="/" aria-label="MarchGear — home" className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark tone={tone} />
      {!compact && (
        <span
          className={cn(
            "font-display text-[19px] font-semibold leading-none tracking-[-0.03em] [font-stretch:115%]",
            tone === "dark" ? "text-ink" : "text-white",
          )}
        >
          March<span className="font-normal opacity-80">Gear</span>
        </span>
      )}
    </Link>
  );
}
