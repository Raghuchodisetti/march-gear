import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stars({ value, size = 14, className, tone = "dark" }: { value: number; size?: number; className?: string; tone?: "dark" | "light" | "red" }) {
  const fill = tone === "light" ? "#ffffff" : tone === "red" ? "var(--color-red)" : "var(--color-ink)";
  const empty = tone === "light" ? "rgb(255 255 255 / 0.25)" : "var(--color-line)";
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`${value.toFixed(1)} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => {
        const pct = Math.max(0, Math.min(1, value - i)) * 100;
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star aria-hidden style={{ width: size, height: size, color: empty, fill: empty }} strokeWidth={0} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${pct}%` }}>
              <Star aria-hidden style={{ width: size, height: size, color: fill, fill }} strokeWidth={0} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** "4.6 ★ (2,841)" compact rating. */
export function RatingInline({ value, count, className, tone = "dark" }: { value: number; count?: number; className?: string; tone?: "dark" | "light" }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px]", className)}>
      <Star aria-hidden className={cn("size-3.5", tone === "dark" ? "fill-ink text-ink" : "fill-white text-white")} strokeWidth={0} />
      <span className="font-semibold num">{value.toFixed(1)}</span>
      {count !== undefined && (
        <span className={cn("num", tone === "dark" ? "text-muted" : "text-white/60")}>({count.toLocaleString("en-IN")})</span>
      )}
    </span>
  );
}

/** Ten-point score as a thin bar. */
export function ScoreBar({ label, value, max = 10, tone = "dark" }: { label: string; value: number; max?: number; tone?: "dark" | "light" }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between text-[13px]">
        <span className={tone === "dark" ? "text-muted" : "text-white/60"}>{label}</span>
        <span className="font-semibold num">{max === 10 ? value.toFixed(1) : Math.round(value)}</span>
      </div>
      <div className={cn("h-[3px] w-full", tone === "dark" ? "bg-line" : "bg-white/15")}>
        <div className="h-full bg-red" style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  );
}
