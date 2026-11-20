"use client";

import { useEffect, useRef, useState } from "react";
import { compact } from "@/components/portal/analytics/charts";
import { rupees } from "@/components/portal/billing/shared";

/* ──────────────────────────────────────────────────────────────
   Monthly invoiced vs collected (12 months). Paired bars ≤ 22px
   with a 2px gap, 4px rounded data-ends on the baseline, hairline
   grid, per-month hover/focus readout. A table sits beside it on
   the page. Collected = verified payments − refunds (cash basis).
   ────────────────────────────────────────────────────────────── */

const INVOICED = "#2A78D6";
const COLLECTED = "#E31E24";
const GRID = "#EFEFEF";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const label = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;
const longLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

function niceMax(v: number) {
  if (v <= 0) return { max: 1000, step: 250 };
  const p = 10 ** Math.floor(Math.log10(v));
  const r = v / p;
  const m = r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10;
  const max = m * p;
  return { max, step: max / (m === 2.5 ? 5 : m === 2 ? 4 : 5) };
}

export function RevenueChart({ months }: { months: { month: string; invoiced: number; collected: number }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 240;
  const pad = { l: 48, r: 8, t: 12, b: 28 };
  const w = Math.max(0, width - pad.l - pad.r);
  const h = H - pad.t - pad.b;
  const n = months.length;
  const peak = Math.max(0, ...months.map((m) => Math.max(m.invoiced, m.collected)));
  const { max, step } = niceMax(peak);
  const col = n ? w / n : 0;
  const bar = Math.max(3, Math.min(22, (col - 10) / 2));
  const y = (v: number) => pad.t + h - (Math.max(0, v) / max) * h;
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const every = col < 34 ? 2 : 1;
  const hp = hover !== null ? months[hover] : null;
  const totals = months.reduce((s, m) => ({ invoiced: s.invoiced + m.invoiced, collected: s.collected + m.collected }), { invoiced: 0, collected: 0 });

  // A bar with 4px rounded top corners, anchored to the baseline.
  const path = (x: number, v: number) => {
    const top = y(v);
    const base = y(0);
    const hgt = base - top;
    if (hgt <= 0) return "";
    const r = Math.min(4, hgt, bar / 2);
    return `M${x},${base}V${top + r}Q${x},${top} ${x + r},${top}H${x + bar - r}Q${x + bar},${top} ${x + bar},${top + r}V${base}Z`;
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-[12px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-[2px]" style={{ background: INVOICED }} /> Invoiced
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-[2px]" style={{ background: COLLECTED }} /> Collected (net of refunds)
          </span>
        </div>
        <p className="text-[12px] text-muted num">
          12 months: {rupees(totals.invoiced)} invoiced · {rupees(totals.collected)} collected
        </p>
      </div>
      <div ref={ref} className="relative mt-4 select-none">
        {width > 0 ? (
          <svg width="100%" height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label="Monthly revenue, invoiced and collected, last 12 months" className="block overflow-visible">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
                <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] num">
                  ₹{compact(t)}
                </text>
              </g>
            ))}
            {months.map((m, i) => {
              const cx = pad.l + i * col + col / 2;
              const x1 = cx - bar - 1;
              const x2 = cx + 1;
              const dim = hover !== null && hover !== i;
              return (
                <g key={m.month} opacity={dim ? 0.45 : 1} className="transition-opacity duration-200">
                  <path d={path(x1, m.invoiced)} fill={INVOICED} />
                  <path d={path(x2, m.collected)} fill={COLLECTED} />
                  {(i % every === 0 || i === n - 1) && (
                    <text x={cx} y={H - 8} textAnchor="middle" className="fill-muted text-[11px]">
                      {label(m.month)}
                    </text>
                  )}
                  <rect
                    x={pad.l + i * col}
                    y={pad.t}
                    width={col}
                    height={h}
                    fill="transparent"
                    tabIndex={0}
                    role="button"
                    aria-label={`${longLabel(m.month)}: ${rupees(m.invoiced)} invoiced, ${rupees(m.collected)} collected`}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    onTouchStart={() => setHover(i)}
                    className="cursor-default outline-none"
                  />
                </g>
              );
            })}
            <line x1={pad.l} x2={width - pad.r} y1={y(0)} y2={y(0)} stroke="#D8D8D8" strokeWidth={1} />
          </svg>
        ) : (
          <div style={{ height: H }} />
        )}
        {hp && hover !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 min-w-[200px] border border-line bg-white px-3.5 py-2.5 text-[12.5px] shadow-soft"
            style={{ left: Math.min(Math.max(0, pad.l + hover * col + col / 2 - 100), Math.max(0, width - 205)) }}
          >
            <p className="font-medium">{longLabel(hp.month)}</p>
            <p className="mt-1 flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-1.5 text-muted">
                <span aria-hidden className="size-2 rounded-full" style={{ background: INVOICED }} /> Invoiced
              </span>
              <span className="font-semibold num">{rupees(hp.invoiced)}</span>
            </p>
            <p className="mt-0.5 flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-1.5 text-muted">
                <span aria-hidden className="size-2 rounded-full" style={{ background: COLLECTED }} /> Collected
              </span>
              <span className="font-semibold num">{rupees(hp.collected)}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
