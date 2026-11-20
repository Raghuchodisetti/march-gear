import Link from "next/link";
import { AlarmClock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration } from "./pipeline";
import type { LeadAnalytics } from "./types";

/**
 * Conversion analytics for the current filters: how many enquiries reached each pipeline
 * stage (from status history, so lost leads still count for how far they got), the win rate
 * and the average time to first contact. One series, one hue — bars read as magnitude.
 */
export function FunnelStrip({ a, overdueHref }: { a: LeadAnalytics; overdueHref: string }) {
  const max = Math.max(1, a.total);
  return (
    <section aria-label="Conversion analytics" className="mb-6 grid grid-cols-1 border border-line bg-white xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 p-5 md:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[13px] font-semibold">Pipeline funnel</h2>
          <p className="text-[12px] text-muted num">{a.total.toLocaleString("en-IN")} enquiries</p>
        </div>
        <ol className="mt-5 space-y-2.5 sm:grid sm:grid-cols-6 sm:gap-x-3 sm:space-y-0">
          {a.stages.map((s, i) => {
            const pct = Math.round((s.count / max) * 100);
            const prev = i > 0 ? a.stages[i - 1].count : null;
            const step = prev ? Math.round((s.count / prev) * 100) : null;
            const fill = s.key === "won" ? "bg-red" : "bg-ink group-hover:bg-ink-3";
            return (
              <li
                key={s.key}
                className="group grid min-w-0 grid-cols-[88px_minmax(0,1fr)_76px] items-center gap-3 sm:block"
                title={`${s.label}: ${s.count} of ${a.total} (${pct}%)${step !== null ? ` · ${step}% of the previous stage` : ""}`}
              >
                {/* Phones: horizontal bars */}
                <p className="truncate text-[12px] text-muted sm:hidden">{s.label}</p>
                <div className="h-[6px] rounded-full bg-mist sm:hidden" aria-hidden>
                  <div className={cn("h-full rounded-full transition-[width] duration-700 ease-[var(--ease-premium)]", fill)} style={{ width: `${s.count ? Math.max(2, pct) : 0}%` }} />
                </div>
                <p className="text-right text-[12.5px] font-semibold num sm:hidden">
                  {s.count.toLocaleString("en-IN")} <span className="font-normal text-muted">· {pct}%</span>
                </p>
                {/* Tablets and up: columns */}
                <div className="hidden h-[88px] items-end border-b border-line sm:flex" aria-hidden>
                  <div className={cn("w-9 rounded-t-[4px] transition-[height,background-color] duration-700 ease-[var(--ease-premium)]", fill)} style={{ height: `${s.count ? Math.max(4, pct) : 0}%` }} />
                </div>
                <p className="mt-2.5 hidden truncate text-[12px] text-muted sm:block">{s.label}</p>
                <p className="mt-0.5 hidden font-display text-[20px] font-semibold leading-none tracking-[-0.02em] num sm:block">{s.count.toLocaleString("en-IN")}</p>
                <p className="mt-1 hidden truncate text-[11.5px] text-muted num sm:block">{pct}%</p>
              </li>
            );
          })}
        </ol>
      </div>
      <dl className="grid grid-cols-2 border-t border-line xl:grid-cols-1 xl:border-l xl:border-t-0">
        <div className="border-r border-line p-5 xl:border-b xl:border-r-0">
          <dt className="text-[12px] text-muted">Conversion rate</dt>
          <dd className="mt-1.5 font-display text-[28px] font-semibold leading-none tracking-[-0.03em] num">{a.conversionPct.toLocaleString("en-IN")}%</dd>
          <dd className="mt-1.5 text-[12px] text-muted num">
            {a.won} won · {a.lost} lost
          </dd>
        </div>
        <div className="p-5 xl:border-b xl:border-line">
          <dt className="text-[12px] text-muted">Avg. first response</dt>
          <dd className="mt-1.5 font-display text-[28px] font-semibold leading-none tracking-[-0.03em] num">{a.avgFirstResponseMs === null ? "—" : formatDuration(a.avgFirstResponseMs)}</dd>
          <dd className="mt-1.5 text-[12px] text-muted num">{a.responded ? `Across ${a.responded} contacted enquir${a.responded === 1 ? "y" : "ies"}` : "Log a call or update a status to start"}</dd>
        </div>
        <Link href={overdueHref} className={cn("col-span-2 flex items-center justify-between gap-3 border-t border-line p-5 transition-colors hover:bg-mist/60 xl:col-span-1 xl:border-t-0", a.overdue > 0 && "text-red")}>
          <span className="flex items-center gap-2.5 text-[13px] font-medium">
            <AlarmClock aria-hidden className="size-4" />
            {a.overdue ? `${a.overdue} overdue follow-up${a.overdue === 1 ? "" : "s"}` : "No overdue follow-ups"}
          </span>
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </dl>
    </section>
  );
}
