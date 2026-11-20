"use client";

import { useEffect, useRef, useState } from "react";
import { compact } from "@/components/portal/analytics/charts";
import { rupees } from "@/components/portal/billing/shared";

/* ──────────────────────────────────────────────────────────────
   A single-series column chart in the portal's chart language:
   ≤24px bars with 4px rounded data-ends on the baseline, hairline
   grid, muted axis text, and a hover/focus readout per column.
   ────────────────────────────────────────────────────────────── */

const GRID = "#EFEFEF";
const COLORS = { red: "#E31E24", ink: "#111111" } as const;

function niceScale(v: number) {
  if (v <= 4) return { max: 4, step: 1 };
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  const [m, steps] = n <= 1 ? [1, 5] : n <= 2 ? [2, 4] : n <= 2.5 ? [2.5, 5] : n <= 5 ? [5, 5] : [10, 5];
  return { max: m * p, step: (m * p) / steps };
}

export interface ColumnPoint {
  key: string;
  /** Axis label. */
  label: string;
  /** Tooltip heading (defaults to the label). */
  title?: string;
  value: number;
  /** Extra tooltip lines. */
  extra?: [string, string][];
}

export function ColumnChart({ points, unit, tone = "red", height = 240, money = false }: { points: ColumnPoint[]; unit: string; tone?: keyof typeof COLORS; height?: number; money?: boolean }) {
  const format = (v: number) => (money ? rupees(v) : v.toLocaleString("en-IN"));
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

  const pad = { l: 40, r: 8, t: 12, b: 26 };
  const w = Math.max(0, width - pad.l - pad.r);
  const h = height - pad.t - pad.b;
  const n = points.length;
  const peak = Math.max(1, ...points.map((p) => p.value));
  const { max, step } = niceScale(peak);
  const slot = n ? w / n : 0;
  const bar = Math.max(2, Math.min(24, slot - 2));
  const x = (i: number) => pad.l + i * slot + (slot - bar) / 2;
  const y = (v: number) => pad.t + h - (v / max) * h;
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / 64))));
  const hp = hover !== null ? points[hover] : null;
  const fill = COLORS[tone];

  return (
    <div ref={ref} className="relative select-none">
      {width > 0 ? (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${unit} by period, ${n} columns`} className="block overflow-visible">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
              <text x={pad.l - 10} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] num">
                {compact(t)}
              </text>
            </g>
          ))}
          {points.map((p, i) => {
            const top = y(p.value);
            const hgt = Math.max(0, pad.t + h - top);
            const r = Math.min(4, bar / 2, hgt);
            const bx = x(i);
            // Rounded data-end (top), square on the baseline.
            const d = hgt > 0 ? `M${bx},${pad.t + h}V${top + r}Q${bx},${top} ${bx + r},${top}H${bx + bar - r}Q${bx + bar},${top} ${bx + bar},${top + r}V${pad.t + h}Z` : "";
            return (
              <g key={p.key}>
                {d && <path d={d} fill={fill} opacity={hover === null || hover === i ? 1 : 0.35} className="mg-fade transition-opacity duration-300" />}
                <rect
                  x={pad.l + i * slot}
                  y={pad.t}
                  width={slot}
                  height={h}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${p.title ?? p.label}: ${format(p.value)} ${unit}`}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  onTouchStart={() => setHover(i)}
                  className="cursor-default outline-none"
                />
                {(i % every === 0 || i === n - 1) && (n - 1 - i >= every * 0.6 || i === n - 1) && (
                  <text x={pad.l + i * slot + slot / 2} y={height - 8} textAnchor="middle" className="pointer-events-none fill-muted text-[11px]">
                    {p.label}
                  </text>
                )}
              </g>
            );
          })}
          <line x1={pad.l} x2={width - pad.r} y1={pad.t + h} y2={pad.t + h} stroke="#DADADA" strokeWidth={1} />
        </svg>
      ) : (
        <div style={{ height }} />
      )}
      {hp && hover !== null && (
        <div
          role="status"
          className="pointer-events-none absolute top-0 z-10 min-w-[170px] border border-line bg-white px-3.5 py-2.5 text-[12.5px] shadow-soft"
          style={{ left: Math.min(Math.max(0, x(hover) + bar / 2 - 85), Math.max(0, width - 180)) }}
        >
          <p className="font-medium">{hp.title ?? hp.label}</p>
          <p className="mt-1 flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-muted">
              <span aria-hidden className="size-2 rounded-full" style={{ background: fill }} /> {unit}
            </span>
            <span className="font-semibold num">{format(hp.value)}</span>
          </p>
          {hp.extra?.map(([k, v]) => (
            <p key={k} className="mt-0.5 flex items-center justify-between gap-4 text-muted">
              <span>{k}</span>
              <span className="font-medium text-ink num">{v}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
