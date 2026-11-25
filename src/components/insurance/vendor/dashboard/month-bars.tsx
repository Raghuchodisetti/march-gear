"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { compact } from "@/components/portal/analytics/charts";

/* ──────────────────────────────────────────────────────────────
   Monthly bars for the vendor dashboard (12 IST months). One series
   → ink bars, red on hover (as the dealer dashboard). Two series →
   grouped bars in the validated categorical pair (red, blue) with a
   legend; 2px gap between a month's bars. Hover/focus tooltip per
   month and a screen-reader table.
   ────────────────────────────────────────────────────────────── */

const PAIR = ["#E31E24", "#2A78D6"] as const;

export interface MonthPoint {
  key: string;
  label: string;
  year: number;
  values: number[];
}

function niceMax(n: number) {
  if (n <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(n));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= n / 2)! * pow;
  return Math.ceil(n / step) * step;
}

export function MonthBars({ points, names, money = false, empty, caption }: { points: MonthPoint[]; names: string[]; money?: boolean; empty: string; caption: string }) {
  const [shown, setShown] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(t);
  }, []);
  const multi = names.length > 1;
  const max = niceMax(Math.max(0, ...points.flatMap((p) => p.values)));
  const total = points.reduce((s, p) => s + p.values.reduce((a, b) => a + b, 0), 0);
  const fmt = (n: number) => (money ? `₹${Math.round(n).toLocaleString("en-IN")}` : n.toLocaleString("en-IN"));
  const tick = (n: number) => (money ? `₹${compact(n)}` : compact(n));
  const ticks = [max, max / 2, 0];

  return (
    <div>
      {multi && (
        <div className="mb-4 flex flex-wrap items-center gap-4 text-[12px] text-muted">
          {names.map((n, i) => (
            <span key={n} className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-[2px]" style={{ background: PAIR[i] }} /> {n}
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-0 bottom-7 flex flex-col justify-between">
          {ticks.map((t) => (
            <div key={t} className="flex h-0 items-center gap-3">
              <span className="w-10 shrink-0 text-right text-[11px] text-muted num">{tick(t)}</span>
              <span className={cn("h-px flex-1", t === 0 ? "bg-ink/20" : "bg-line")} />
            </div>
          ))}
        </div>
        <div className="relative ml-[3.25rem] flex h-[220px] items-end gap-1 pb-7 sm:gap-2" onMouseLeave={() => setActive(null)}>
          {points.map((p, i) => {
            const on = active === i;
            const label = `${p.label} ${p.year}: ${names.map((n, j) => `${n} ${fmt(p.values[j] ?? 0)}`).join(", ")}`;
            return (
              <div
                key={p.key}
                className="relative flex h-full min-w-0 flex-1 cursor-default items-end justify-center gap-[2px]"
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                tabIndex={0}
                role="img"
                aria-label={label}
              >
                {p.values.map((v, j) => {
                  const h = max ? (v / max) * 100 : 0;
                  return (
                    <span
                      key={j}
                      className={cn("block w-full origin-bottom rounded-t-[4px] transition-[transform,background-color,opacity] duration-[900ms] ease-[var(--ease-premium)]", multi ? "max-w-[14px]" : "max-w-[24px]")}
                      style={{
                        height: `${Math.max(h, v ? 2 : 0)}%`,
                        background: v === 0 ? "transparent" : multi ? PAIR[j] : on ? "#E31E24" : "rgba(17,17,17,0.85)",
                        opacity: multi && active !== null && !on ? 0.45 : 1,
                        transform: shown ? "scaleY(1)" : "scaleY(0)",
                        transitionDelay: shown ? `${i * 30}ms` : "0ms",
                      }}
                    />
                  );
                })}
                {on && (
                  <span
                    className={cn("pointer-events-none absolute bottom-[calc(100%-1.25rem)] z-10 min-w-[150px] whitespace-nowrap rounded-[3px] bg-ink px-2.5 py-1.5 text-[11.5px] text-white shadow-lift", i < 2 ? "left-0" : i > points.length - 3 ? "right-0" : "left-1/2 -translate-x-1/2")}
                  >
                    <span className="block text-white/60">
                      {p.label} {p.year}
                    </span>
                    {names.map((n, j) => (
                      <span key={n} className="flex items-center justify-between gap-3">
                        {multi && (
                          <span className="inline-flex items-center gap-1.5 text-white/75">
                            <span aria-hidden className="size-2 rounded-[2px]" style={{ background: PAIR[j] }} /> {n}
                          </span>
                        )}
                        <span className="font-semibold num">
                          {fmt(p.values[j] ?? 0)}
                          {!multi && !money ? ` ${n.toLowerCase()}` : ""}
                        </span>
                      </span>
                    ))}
                  </span>
                )}
                <span aria-hidden className={cn("absolute top-full mt-2 whitespace-nowrap text-[10.5px]", on ? "font-medium text-ink" : "text-muted", i % 2 === 1 && i !== points.length - 1 && "max-sm:hidden")}>
                  {p.label}
                </span>
              </div>
            );
          })}
          {total === 0 && (
            <div className="absolute inset-0 bottom-7 flex items-center justify-center">
              <p className="max-w-xs bg-white/90 px-4 py-3 text-center text-[13px] leading-relaxed text-muted">{empty}</p>
            </div>
          )}
        </div>
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th>Month</th>
            {names.map((n) => (
              <th key={n}>{n}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.key}>
              <td>
                {p.label} {p.year}
              </td>
              {names.map((n, j) => (
                <td key={n}>{fmt(p.values[j] ?? 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
