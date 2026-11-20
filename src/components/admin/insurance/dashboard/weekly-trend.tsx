"use client";

import { useEffect, useRef, useState } from "react";
import { Segmented } from "@/components/ui/field";
import { compact } from "@/components/portal/analytics/charts";

/* ──────────────────────────────────────────────────────────────
   Weekly trend for the insurance dashboard, in the house chart
   style (src/components/portal/analytics/charts.tsx): one series
   at a time, 2px red line over a faint area, hairline grid,
   crosshair readout, keyboard support and a table view.
   ────────────────────────────────────────────────────────────── */

const RED = "#E31E24";
const INK = "#111111";
const GRID = "#EFEFEF";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dm = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

function niceScale(v: number) {
  if (v <= 4) return { max: 4, step: 1 };
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  const [m, steps] = n <= 1 ? [1, 5] : n <= 2 ? [2, 4] : n <= 2.5 ? [2.5, 5] : n <= 5 ? [5, 5] : [10, 5];
  return { max: m * p, step: (m * p) / steps };
}

export interface WeeklySeries {
  key: string;
  label: string;
  /** Plural noun for the readout, e.g. "quote requests". */
  unit: string;
  values: number[];
}

export function WeeklyTrend({ weeks, series }: { weeks: { from: string; to: string }[]; series: WeeklySeries[] }) {
  const [key, setKey] = useState(series[0]?.key ?? "");
  const [showTable, setShowTable] = useState(false);
  const s = series.find((x) => x.key === key) ?? series[0];
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
  if (!s) return null;

  const total = s.values.reduce((a, b) => a + b, 0);
  const H = 220;
  const pad = { l: 36, r: 10, t: 14, b: 26 };
  const w = Math.max(0, width - pad.l - pad.r);
  const h = H - pad.t - pad.b;
  const n = weeks.length;
  const { max, step } = niceScale(Math.max(1, ...s.values));
  const x = (i: number) => pad.l + (n <= 1 ? w / 2 : (i / (n - 1)) * w);
  const y = (v: number) => pad.t + h - (v / max) * h;
  const line = s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const area = n ? `${line}L${x(n - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z` : "";
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / 70))));
  const pick = (clientX: number, rect: DOMRect) => {
    const rel = clientX - rect.left - pad.l;
    setHover(Math.min(n - 1, Math.max(0, Math.round((rel / Math.max(1, w)) * (n - 1)))));
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12.5px] font-medium text-muted">{s.label} · last 12 weeks</p>
          <p className="mt-1 font-display text-[28px] font-semibold leading-none tracking-[-0.03em] num">{total.toLocaleString("en-IN")}</p>
        </div>
        <Segmented ariaLabel="Trend metric" value={s.key} onChange={(k) => { setKey(k); setHover(null); }} options={series.map((x) => ({ value: x.key, label: x.label }))} className="max-w-full" />
      </div>
      <div ref={ref} className="relative mt-5 select-none">
        {width > 0 ? (
          <svg width="100%" height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label={`${s.label} per week, last 12 weeks: ${total} in total`} className="block overflow-visible">
            <defs>
              <linearGradient id="ins-trend-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={RED} stopOpacity="0.14" />
                <stop offset="100%" stopColor={RED} stopOpacity="0" />
              </linearGradient>
            </defs>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
                <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] num">
                  {compact(t)}
                </text>
              </g>
            ))}
            {weeks.map((wk, i) =>
              (i % labelEvery === 0 && n - 1 - i >= labelEvery * 0.7) || i === n - 1 ? (
                <text key={wk.from} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="fill-muted text-[11px]">
                  {dm(wk.from)}
                </text>
              ) : null,
            )}
            <path key={`a-${s.key}`} d={area} fill="url(#ins-trend-fill)" className="mg-fade" />
            <path key={`l-${s.key}`} d={line} fill="none" stroke={RED} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="mg-draw" />
            {hover === null && n > 0 && <circle cx={x(n - 1)} cy={y(s.values[n - 1])} r={4} fill={RED} stroke="#fff" strokeWidth={2} />}
            {hover !== null && (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + h} stroke={INK} strokeOpacity={0.25} strokeWidth={1} />
                <circle cx={x(hover)} cy={y(s.values[hover])} r={5} fill={RED} stroke="#fff" strokeWidth={2} />
              </g>
            )}
            <rect
              x={pad.l - 8}
              y={pad.t}
              width={w + 16}
              height={h}
              fill="transparent"
              tabIndex={0}
              aria-label="Move across the chart to read each week"
              onMouseMove={(e) => pick(e.clientX, (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect())}
              onTouchStart={(e) => pick(e.touches[0].clientX, (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect())}
              onTouchMove={(e) => pick(e.touches[0].clientX, (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect())}
              onMouseLeave={() => setHover(null)}
              onBlur={() => setHover(null)}
              onFocus={() => setHover(n - 1)}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") setHover((v) => Math.max(0, (v ?? n - 1) - 1));
                if (e.key === "ArrowRight") setHover((v) => Math.min(n - 1, (v ?? 0) + 1));
              }}
              className="cursor-crosshair outline-none"
            />
          </svg>
        ) : (
          <div style={{ height: H }} />
        )}
        {hover !== null && width > 0 && (
          <div role="status" className="pointer-events-none absolute top-1 z-10 min-w-[170px] border border-line bg-white px-3.5 py-2.5 text-[12.5px] shadow-soft" style={{ left: Math.min(Math.max(0, x(hover) - 85), Math.max(0, width - 180)) }}>
            <p className="font-medium">
              {dm(weeks[hover].from)} – {dm(weeks[hover].to)}
            </p>
            <p className="mt-1 flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-1.5 text-muted">
                <span aria-hidden className="size-2 rounded-full" style={{ background: RED }} /> {s.unit}
              </span>
              <span className="font-semibold num">{s.values[hover].toLocaleString("en-IN")}</span>
            </p>
          </div>
        )}
      </div>
      <button type="button" onClick={() => setShowTable((v) => !v)} aria-expanded={showTable} className="mt-2 text-[12.5px] font-medium text-muted underline-offset-4 hover:text-ink hover:underline">
        {showTable ? "Hide table" : "Show as table"}
      </button>
      {showTable && (
        <div className="relative mt-3 overflow-x-auto border border-line">
          <table className="w-full min-w-[420px] text-left text-[12.5px]">
            <thead>
              <tr className="text-muted">
                <th className="border-b border-line bg-mist/60 px-3 py-2 font-semibold">Week</th>
                {series.map((x) => (
                  <th key={x.key} className="border-b border-line bg-mist/60 px-3 py-2 text-right font-semibold">
                    {x.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((wk, i) => (
                <tr key={wk.from} className="border-b border-line last:border-0">
                  <td className="whitespace-nowrap px-3 py-1.5">
                    {dm(wk.from)} – {dm(wk.to)}
                  </td>
                  {series.map((x) => (
                    <td key={x.key} className="px-3 py-1.5 text-right num">
                      {x.values[i]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
