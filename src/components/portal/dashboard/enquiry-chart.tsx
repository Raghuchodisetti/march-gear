"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/* Daily enquiries as quiet bars: one series (no legend), hover tooltip per bar, a screen-reader table. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Wed, 18 Nov" from "2026-11-18" — string maths, so server and browser agree. */
function dayLabel(iso: string, withWeekday = true) {
  const [y, m, d] = iso.split("-").map(Number);
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${withWeekday ? `${wd}, ` : ""}${d} ${MONTHS[m - 1]}`;
}

function niceMax(n: number) {
  if (n <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(n));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= n / 2)! * pow;
  return Math.ceil(n / step) * step;
}

export function EnquiryChart({ series }: { series: { day: string; count: number }[] }) {
  const [shown, setShown] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const max = niceMax(Math.max(0, ...series.map((s) => s.count)));
  const total = series.reduce((s, d) => s + d.count, 0);
  const every = series.length > 20 ? 5 : series.length > 10 ? 3 : 1;
  const ticks = [max, max / 2, 0];

  return (
    <div>
      <div className="relative">
        {/* Y gridlines + labels */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bottom-7 flex flex-col justify-between">
          {ticks.map((t) => (
            <div key={t} className="flex h-0 items-center gap-3">
              <span className="w-6 shrink-0 text-right text-[11px] text-muted num">{Number.isInteger(t) ? t : t.toFixed(1)}</span>
              <span className={cn("h-px flex-1", t === 0 ? "bg-ink/20" : "bg-line")} />
            </div>
          ))}
        </div>

        <div className="relative ml-9 flex h-[220px] items-end gap-[2px] pb-7 sm:gap-1" onMouseLeave={() => setActive(null)}>
          {series.map((d, i) => {
            const h = max ? (d.count / max) * 100 : 0;
            const on = active === i;
            return (
              <div
                key={d.day}
                className="group relative flex h-full min-w-0 flex-1 cursor-default items-end justify-center"
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                tabIndex={0}
                aria-label={`${dayLabel(d.day)}: ${d.count} ${d.count === 1 ? "enquiry" : "enquiries"}`}
              >
                <span
                  className={cn(
                    "block w-full max-w-[22px] origin-bottom rounded-t-[4px] transition-[transform,background-color] duration-[900ms] ease-[var(--ease-premium)]",
                    d.count === 0 ? "bg-transparent" : on ? "bg-red" : "bg-ink/85",
                  )}
                  style={{ height: `${Math.max(h, d.count ? 2 : 0)}%`, transform: shown ? "scaleY(1)" : "scaleY(0)", transitionDelay: shown ? `${i * 18}ms` : "0ms" }}
                />
                {on && (
                  <span className={cn("pointer-events-none absolute z-10 whitespace-nowrap", i < 3 ? "left-0" : i > series.length - 4 ? "right-0" : "left-1/2 -translate-x-1/2", " rounded-[3px] bg-ink px-2.5 py-1.5 text-[11.5px] text-white shadow-lift")} style={{ bottom: `calc(${h}% + 8px)` }}>
                    <span className="block text-white/60">{dayLabel(d.day)}</span>
                    <span className="font-semibold num">
                      {d.count} {d.count === 1 ? "enquiry" : "enquiries"}
                    </span>
                  </span>
                )}
                {((i % every === 0 && i < series.length - Math.max(2, Math.ceil(every * 0.8))) || i === series.length - 1) && (
                  <span aria-hidden className={cn("absolute top-full mt-2 whitespace-nowrap text-[10.5px] text-muted", i === series.length - 1 ? "right-0" : i === 0 ? "left-0" : "")}>
                    {i === series.length - 1 ? "Today" : dayLabel(d.day, false)}
                  </span>
                )}
              </div>
            );
          })}
          {total === 0 && (
            <div className="absolute inset-0 bottom-7 flex items-center justify-center">
              <p className="max-w-xs bg-white/90 px-4 py-3 text-center text-[13px] leading-relaxed text-muted">
                No enquiries in this period yet. They appear here as customers contact you from your listings, offers and dealer page.
              </p>
            </div>
          )}
        </div>
      </div>

      <table className="sr-only">
        <caption>Enquiries per day</caption>
        <thead>
          <tr>
            <th>Day</th>
            <th>Enquiries</th>
          </tr>
        </thead>
        <tbody>
          {series.map((d) => (
            <tr key={d.day}>
              <td>{dayLabel(d.day)}</td>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
