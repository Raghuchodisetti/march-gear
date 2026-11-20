import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Check, ChevronRight, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge, type BadgeTone } from "@/components/portal/ui";

/* Server-safe building blocks for the dealer dashboard. */

/** "4 min ago", "Yesterday", "12 Nov" — computed on the server only. */
export function relTime(d: Date, now: Date) {
  const s = Math.max(0, Math.round((now.getTime() - d.getTime()) / 1000));
  if (s < 60) return "Just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
}

export function Delta({ now, before, label }: { now: number; before: number; label: string }) {
  if (!before && !now) return <span className="text-muted">No change {label}</span>;
  if (!before) return <span className="text-muted">New activity {label}</span>;
  const pct = Math.round(((now - before) / before) * 100);
  const up = pct >= 0;
  return (
    <span>
      <span className={cn("whitespace-nowrap font-medium num", up ? "text-ink" : "text-red")}>
        {up ? <ArrowUpRight aria-hidden className="mr-0.5 inline size-3.5 align-[-2px]" /> : <ArrowDownRight aria-hidden className="mr-0.5 inline size-3.5 align-[-2px]" />}
        {Math.abs(pct)}%
      </span>{" "}
      <span className="text-muted">{label}</span>
    </span>
  );
}

/** One figure in the headline metric band. */
export function Metric({ label, value, note, href, accent }: { label: string; value: ReactNode; note?: ReactNode; href?: string; accent?: ReactNode }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12.5px] font-medium text-muted">{label}</p>
        {accent}
      </div>
      <p className="mt-3 font-display text-[28px] font-semibold leading-none tracking-[-0.035em] text-ink num sm:text-[34px] md:text-[38px]">{value}</p>
      {note && <p className="mt-3 text-[12.5px] text-muted">{note}</p>}
    </>
  );
  const cls = "group relative block min-w-0 flex-[1_1_160px] bg-white p-4 sm:flex-[1_1_240px] sm:p-5 md:p-6";
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors duration-500 hover:bg-[#fcfcfc]")}>
      {body}
      <ArrowRight aria-hidden className="absolute bottom-5 right-5 size-4 text-ink/0 transition-all duration-500 ease-[var(--ease-premium)] group-hover:translate-x-0.5 group-hover:text-ink/40" />
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** A compact figure in the secondary band. */
export function MiniStat({ icon, label, value, href, note, title }: { icon: ReactNode; label: string; value: ReactNode; href?: string; note?: ReactNode; title?: string }) {
  const body = (
    <>
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-mist text-ink/70">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[12px] leading-tight text-muted">{label}</span>
        <span className="mt-0.5 flex items-baseline gap-2">
          <span className="text-[19px] font-semibold leading-tight tracking-[-0.02em] num">{value}</span>
          {note && <span className="truncate text-[11.5px] text-muted">{note}</span>}
        </span>
      </span>
    </>
  );
  const cls = "flex min-w-0 flex-[1_1_160px] items-center gap-3 bg-white px-4 py-4 sm:flex-[1_1_210px]";
  return href ? (
    <Link href={href} title={title} className={cn(cls, "transition-colors duration-500 hover:bg-[#fcfcfc]")}>
      {body}
    </Link>
  ) : (
    <div className={cls} title={title}>
      {body}
    </div>
  );
}

/** A dashboard card with a quiet header. */
export function Card({ title, subtitle, action, children, className, bodyClass }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cn("min-w-0 border border-line bg-white", className)}>
      <header className="flex items-start justify-between gap-4 px-5 pb-1 pt-5 md:px-6">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[12.5px] text-muted">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className={cn("px-5 pb-5 pt-4 md:px-6", bodyClass)}>{children}</div>
    </section>
  );
}

export function CardLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-muted transition-colors hover:text-ink">
      {children} <ChevronRight aria-hidden className="size-3.5" />
    </Link>
  );
}

export function Quiet({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-4 py-8 text-center">
      {icon && <span className="mb-3 inline-flex size-10 items-center justify-center rounded-full bg-mist text-ink/60">{icon}</span>}
      <p className="text-[13.5px] font-medium text-ink">{title}</p>
      {children && <p className="mt-1 max-w-xs text-[12.5px] leading-relaxed text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const DOT: Record<string, string> = { red: "bg-red", amber: "bg-[#d48a00]", blue: "bg-[#2456a6]" };

export function PendingList({ items }: { items: { key: string; tone: "red" | "amber" | "blue"; title: string; detail: string; href: string; count: number }[] }) {
  return (
    <ul className="-mx-2">
      {items.map((p) => (
        <li key={p.key}>
          <Link href={p.href} className="group flex items-start gap-3 rounded-[3px] px-2 py-2.5 transition-colors duration-300 hover:bg-mist/70">
            <span aria-hidden className={cn("mt-[7px] size-1.5 shrink-0 rounded-full", DOT[p.tone])} />
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-medium text-ink">{p.title}</span>
              <span className="block text-[12.5px] leading-snug text-muted">{p.detail}</span>
            </span>
            <span className="mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-ink px-2 text-[11px] font-semibold text-white num">{p.count}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function SetupSteps({ steps }: { steps: { key: string; label: string; done: boolean; href: string }[] }) {
  const done = steps.filter((s) => s.done).length;
  return (
    <section className="border border-line bg-white">
      <div className="grid grid-cols-1 gap-6 p-5 md:p-7 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-10">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-red">Get started</p>
          <h2 className="mt-2 font-display text-[22px] font-semibold leading-tight tracking-[-0.02em]">Set up your dealership</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">A complete profile, accurate locations and live stock are what bring customer enquiries in.</p>
          <div className="mt-5 flex items-center gap-3">
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-mist">
              <span className="block h-full rounded-full bg-red transition-[width] duration-1000" style={{ width: `${(done / Math.max(1, steps.length)) * 100}%` }} />
            </span>
            <span className="text-[12px] font-medium text-muted num">
              {done} of {steps.length}
            </span>
          </div>
        </div>
        <ol className="grid grid-cols-1 gap-px self-start border border-line bg-line sm:grid-cols-2 xl:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.key} className="bg-white">
              <Link href={s.href} className={cn("group flex h-full items-center gap-3 px-4 py-3.5 transition-colors duration-300 hover:bg-mist/60", s.done && "text-muted")}>
                <span className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-[11.5px] font-semibold num", s.done ? "border-ink bg-ink text-white" : "border-line text-ink")}>
                  {s.done ? <Check aria-label="Done" className="size-3.5" strokeWidth={3} /> : i + 1}
                </span>
                <span className={cn("min-w-0 flex-1 text-[13px] font-medium", s.done && "line-through decoration-ink/20")}>{s.label}</span>
                {!s.done && <ChevronRight aria-hidden className="size-4 text-muted transition-transform duration-300 group-hover:translate-x-0.5" />}
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function StatusBadge({ label, tone }: { label: string; tone: BadgeTone }) {
  return <Badge tone={tone}>{label}</Badge>;
}

export function Dot({ unread }: { unread: boolean }) {
  return unread ? <span aria-label="Unread" className="mt-[7px] size-1.5 shrink-0 rounded-full bg-red" /> : <Circle aria-hidden className="mt-[5px] size-2 shrink-0 text-line" />;
}
