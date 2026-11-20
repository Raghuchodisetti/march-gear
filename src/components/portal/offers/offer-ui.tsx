import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { OFFER_STATUS_LABEL, type OfferDisplayStatus } from "@/partner/labels";

/* Small presentational pieces shared by the offers list, campaigns and the editor. Server-safe. */

const PILL: Record<OfferDisplayStatus, { cls: string; dot: string }> = {
  draft: { cls: "bg-white text-ink/75 ring-1 ring-inset ring-line", dot: "bg-ink/30" },
  submitted: { cls: "bg-[#eef3fc] text-[#2456a6]", dot: "bg-[#2456a6]" },
  pending_approval: { cls: "bg-[#eef3fc] text-[#2456a6]", dot: "bg-[#2456a6]" },
  changes_requested: { cls: "bg-[#fdf3e1] text-[#9a5b00]", dot: "bg-[#d08a16]" },
  approved: { cls: "bg-[#e8f5ec] text-[#1e7a3c]", dot: "bg-[#1e7a3c]" },
  scheduled: { cls: "bg-[#eef3fc] text-[#2456a6]", dot: "bg-[#2456a6]" },
  active: { cls: "bg-[#e8f5ec] text-[#1e7a3c]", dot: "bg-[#22a04b]" },
  paused: { cls: "bg-[#fdf3e1] text-[#9a5b00]", dot: "bg-[#d08a16]" },
  expired: { cls: "bg-mist text-ink/60", dot: "bg-ink/25" },
  rejected: { cls: "bg-red-50 text-red", dot: "bg-red" },
  cancelled: { cls: "bg-mist text-ink/60", dot: "bg-ink/25" },
};

/** Premium status badge with a tone dot (the dot breathes while an offer is live). */
export function StatusPill({ status, className, solid }: { status: OfferDisplayStatus; className?: string; solid?: boolean }) {
  const p = PILL[status];
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[11.5px] font-semibold", solid ? "bg-white/95 text-ink shadow-soft" : p.cls, className)}>
      <span className="relative inline-flex size-1.5">
        {status === "active" && <span className={cn("absolute inset-0 animate-ping rounded-full opacity-60 [animation-duration:2.4s]", p.dot)} />}
        <span className={cn("relative inline-flex size-1.5 rounded-full", p.dot)} />
      </span>
      {OFFER_STATUS_LABEL[status]}
    </span>
  );
}

/** Tone for calendar bars and meters. */
export const BAR_TONE: Record<OfferDisplayStatus, string> = {
  draft: "border border-dashed border-ink/25 bg-white text-ink/70",
  submitted: "border border-dashed border-[#2456a6]/50 bg-[#eef3fc] text-[#2456a6]",
  pending_approval: "border border-dashed border-[#2456a6]/50 bg-[#eef3fc] text-[#2456a6]",
  changes_requested: "border border-dashed border-[#d08a16]/60 bg-[#fdf3e1] text-[#9a5b00]",
  approved: "bg-[#1e7a3c] text-white",
  scheduled: "bg-[#2456a6] text-white",
  active: "bg-[#1e7a3c] text-white",
  paused: "bg-[#d08a16] text-white",
  expired: "bg-ink/15 text-ink/60",
  rejected: "bg-red-50 text-red",
  cancelled: "bg-mist text-ink/50 line-through",
};

/** How far through its window an offer is (0–1). */
export function windowProgress(startsAt: string, endsAt: string, now: number) {
  const s = new Date(startsAt).getTime();
  const e = new Date(endsAt).getTime();
  if (e <= s) return 0;
  return Math.min(1, Math.max(0, (now - s) / (e - s)));
}

export function Meter({ value, tone = "ink", className }: { value: number; tone?: "ink" | "red" | "green"; className?: string }) {
  return (
    <span className={cn("block h-1 w-full overflow-hidden rounded-full bg-mist", className)}>
      <span
        className={cn("block h-full rounded-full transition-[width] duration-[900ms] ease-[var(--ease-premium)]", tone === "red" ? "bg-red" : tone === "green" ? "bg-[#1e7a3c]" : "bg-ink")}
        style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }}
      />
    </span>
  );
}

export function Metric({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] text-muted">{label}</dt>
      <dd className="mt-0.5 font-display text-[18px] font-semibold leading-tight tracking-[-0.02em] num">{value}</dd>
      {note && <dd className="text-[11px] text-muted">{note}</dd>}
    </div>
  );
}

/** Callout used for admin remarks and warnings. */
export function Callout({ tone = "amber", title, children, icon, className }: { tone?: "amber" | "red" | "blue" | "neutral"; title?: ReactNode; children?: ReactNode; icon?: ReactNode; className?: string }) {
  const cls = {
    amber: "border-[#f0d9ad] bg-[#fdf8ee] text-[#7a4a00]",
    red: "border-red/20 bg-red-50 text-[#8f1418]",
    blue: "border-[#cfdcf3] bg-[#f3f7fd] text-[#1f4c94]",
    neutral: "border-line bg-[#F6F6F6] text-ink/80",
  }[tone];
  return (
    <div className={cn("flex gap-3 rounded-[4px] border px-4 py-3 text-[13px] leading-relaxed", cls, className)}>
      {icon && <span className="mt-0.5 shrink-0 [&>svg]:size-4">{icon}</span>}
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "break-words")}>{children}</div>}
      </div>
    </div>
  );
}
