"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Segmented } from "@/components/ui/field";
import { addDays } from "@/components/portal/billing/shared";
import { fmtPct, pct, type SeriesPoint } from "./report";

/* ──────────────────────────────────────────────────────────────
   Lightweight in-house charts (SVG + CSS, no chart library).
   Marks: 2px lines, ≤24px bars with 4px rounded data-ends, a 2px
   surface gap between donut segments, hairline grid. Every chart
   has a hover/focus readout and a table elsewhere on the page.
   ────────────────────────────────────────────────────────────── */

const RED = "#E31E24";
const INK = "#111111";
const PREV = "#9A9A9A";
const GRID = "#EFEFEF";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const dm = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
const dow = (iso: string) => DAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()];
export const compact = (n: number) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}K` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}K` : String(Math.round(n)));
const bucketLabel = (from: string, to: string) => (from === to ? `${dow(from)}, ${dm(from)}` : `${dm(from)} – ${dm(to)}`);

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** A clean axis maximum and its tick step. */
function niceScale(v: number) {
  if (v <= 4) return { max: 4, step: 1 };
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  const [m, steps] = n <= 1 ? [1, 5] : n <= 2 ? [2, 4] : n <= 2.5 ? [2.5, 5] : n <= 5 ? [5, 5] : [10, 5];
  return { max: m * p, step: (m * p) / steps };
}

/* ── Trend: area + line, dashed previous period, crosshair tooltip ── */

export function TrendPanel({ series, compare, prevFrom, bucket }: { series: SeriesPoint[]; compare: boolean; prevFrom: string; bucket: "day" | "week" }) {
  const [metric, setMetric] = useState<"views" | "enquiries">("views");
  const key = metric;
  const prevKey = metric === "views" ? "prevViews" : "prevEnquiries";
  const total = series.reduce((s, p) => s + p[key], 0);
  const prevTotal = series.reduce((s, p) => s + p[prevKey], 0);
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12.5px] font-medium text-muted">{metric === "views" ? "Profile, vehicle & offer views" : "Enquiries received"}</p>
          <p className="mt-1 font-display text-[30px] font-semibold leading-none tracking-[-0.03em] num">{total.toLocaleString("en-IN")}</p>
          {compare && <p className="mt-1.5 text-[12.5px] text-muted num">{prevTotal.toLocaleString("en-IN")} in the previous period</p>}
        </div>
        <div className="flex flex-col items-end gap-3">
          <Segmented
            ariaLabel="Trend metric"
            value={metric}
            onChange={setMetric}
            options={[
              { value: "views", label: "Views" },
              { value: "enquiries", label: "Enquiries" },
            ]}
          />
          <div className="flex items-center gap-4 text-[12px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-[2px] w-4 rounded-full" style={{ background: RED }} /> This period
            </span>
            {compare && (
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="w-4 border-t-2 border-dashed" style={{ borderColor: PREV }} /> Previous period
              </span>
            )}
          </div>
        </div>
      </div>
      <TrendChart
        key={metric}
        points={series.map((p, i) => ({ from: p.date, to: p.end, value: p[key], prev: p[prevKey], prevFrom: addDays(prevFrom, i * (bucket === "day" ? 1 : 7)) }))}
        compare={compare}
        unit={metric === "views" ? "views" : "enquiries"}
      />
    </div>
  );
}

function TrendChart({ points, compare, unit }: { points: { from: string; to: string; value: number; prev: number; prevFrom: string }[]; compare: boolean; unit: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const gid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const H = 260;
  const pad = { l: 40, r: 12, t: 16, b: 28 };
  const w = Math.max(0, width - pad.l - pad.r);
  const h = H - pad.t - pad.b;
  const peak = Math.max(1, ...points.map((p) => Math.max(p.value, compare ? p.prev : 0)));
  const { max, step } = niceScale(peak);
  const n = points.length;
  const x = (i: number) => pad.l + (n <= 1 ? w / 2 : (i / (n - 1)) * w);
  const y = (v: number) => pad.t + h - (v / max) * h;
  const line = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const cur = line(points.map((p) => p.value));
  const area = n ? `${cur}L${x(n - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z` : "";
  const prev = line(points.map((p) => p.prev));
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / 72))));
  const hp = hover !== null ? points[hover] : null;

  const pick = (clientX: number, rect: DOMRect) => {
    const rel = clientX - rect.left - pad.l;
    const i = n <= 1 ? 0 : Math.round((rel / w) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };

  return (
    <div ref={ref} className="relative mt-6 select-none">
      {width > 0 && (
        <svg width={width} height={H} role="img" aria-label={`Trend of ${unit}, ${n} points`} className="block overflow-visible">
          <defs>
            <linearGradient id={`fill-${gid}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={RED} stopOpacity="0.14" />
              <stop offset="100%" stopColor={RED} stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
              <text x={pad.l - 10} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] num">
                {compact(t)}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            (i % labelEvery === 0 && n - 1 - i >= labelEvery * 0.7) || i === n - 1 ? (
              <text key={p.from} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="fill-muted text-[11px]">
                {dm(p.from)}
              </text>
            ) : null,
          )}
          <path d={area} fill={`url(#fill-${gid})`} className="mg-fade" />
          {compare && <path d={prev} fill="none" stroke={PREV} strokeWidth={1.5} strokeDasharray="4 4" strokeLinejoin="round" strokeLinecap="round" className="mg-fade" />}
          <path d={cur} fill="none" stroke={RED} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="mg-draw" />
          {n > 0 && hover === null && <circle cx={x(n - 1)} cy={y(points[n - 1].value)} r={4} fill={RED} stroke="#fff" strokeWidth={2} />}
          {hp && hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + h} stroke={INK} strokeOpacity={0.25} strokeWidth={1} />
              {compare && <circle cx={x(hover)} cy={y(hp.prev)} r={4} fill={PREV} stroke="#fff" strokeWidth={2} />}
              <circle cx={x(hover)} cy={y(hp.value)} r={5} fill={RED} stroke="#fff" strokeWidth={2} />
            </g>
          )}
          <rect
            x={pad.l - 8}
            y={pad.t}
            width={w + 16}
            height={h}
            fill="transparent"
            tabIndex={0}
            aria-label="Move across the chart to read values"
            onMouseMove={(e) => pick(e.clientX, (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect())}
            onTouchMove={(e) => pick(e.touches[0].clientX, (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect())}
            onTouchStart={(e) => pick(e.touches[0].clientX, (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect())}
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
      )}
      {width === 0 && <div style={{ height: H }} />}
      {hp && hover !== null && (
        <div
          role="status"
          className="pointer-events-none absolute top-2 z-10 min-w-[180px] border border-line bg-white px-3.5 py-2.5 text-[12.5px] shadow-soft"
          style={{ left: Math.min(Math.max(0, x(hover) - 90), Math.max(0, width - 190)) }}
        >
          <p className="font-medium">{bucketLabel(hp.from, hp.to)}</p>
          <p className="mt-1 flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-muted">
              <span aria-hidden className="size-2 rounded-full" style={{ background: RED }} /> This period
            </span>
            <span className="font-semibold num">{hp.value.toLocaleString("en-IN")}</span>
          </p>
          {compare && (
            <p className="mt-0.5 flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-1.5 text-muted">
                <span aria-hidden className="size-2 rounded-full" style={{ background: PREV }} /> {dm(hp.prevFrom)}
              </span>
              <span className="font-semibold num">{hp.prev.toLocaleString("en-IN")}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Donut (lead sources) ── */

/** Fixed colour per source (colour follows the entity, never its rank). Validated categorical order. */
export const SOURCE_COLOR: Record<string, string> = {
  website: "#E31E24",
  offer: "#2A78D6",
  listing: "#1BAF7A",
  walk_in: "#EDA100",
  phone: "#4A3AA7",
  referral: "#E87BA4",
};
const OTHER_COLOR = "#B5B5B5";
export const sourceColor = (s: string) => SOURCE_COLOR[s] ?? OTHER_COLOR;

export function Donut({ items }: { items: { source: string; label: string; value: number }[] }) {
  // social / event / other fold into one "Other" slice.
  const data = useMemo(() => {
    const main = items.filter((i) => SOURCE_COLOR[i.source]);
    const rest = items.filter((i) => !SOURCE_COLOR[i.source]);
    const other = rest.reduce((s, i) => s + i.value, 0);
    return [...main, ...(other ? [{ source: "other", label: rest.length === 1 ? rest[0].label : "Social, events & other", value: other }] : [])];
  }, [items]);
  const [active, setActive] = useState<string | null>(null);
  const total = data.reduce((s, i) => s + i.value, 0);
  const R = 70;
  const C = 2 * Math.PI * R;
  const gap = data.length > 1 ? 2 : 0;
  let offset = 0;
  const shown = data.find((d) => d.source === active);

  if (!total) return <p className="py-10 text-center text-[13.5px] text-muted">No enquiries in this period.</p>;
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
      <div className="relative size-[180px] shrink-0">
        <svg viewBox="0 0 180 180" className="size-full -rotate-90" role="img" aria-label="Enquiries by source">
          <circle cx="90" cy="90" r={R} fill="none" stroke="#F3F3F3" strokeWidth="18" />
          {data.map((d) => {
            const len = (d.value / total) * C;
            const seg = (
              <circle
                key={d.source}
                cx="90"
                cy="90"
                r={R}
                fill="none"
                stroke={sourceColor(d.source)}
                strokeWidth={active === d.source ? 22 : 18}
                strokeDasharray={`${Math.max(0, len - gap)} ${C}`}
                strokeDashoffset={-offset}
                className="cursor-pointer transition-[stroke-width,opacity] duration-500"
                opacity={active && active !== d.source ? 0.35 : 1}
                onMouseEnter={() => setActive(d.source)}
                onMouseLeave={() => setActive(null)}
              />
            );
            offset += len;
            return seg;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="font-display text-[26px] font-semibold leading-none tracking-[-0.02em] num">{(shown?.value ?? total).toLocaleString("en-IN")}</p>
          <p className="mt-1 max-w-[100px] text-[11.5px] leading-tight text-muted">{shown ? `${shown.label} · ${fmtPct(pct(shown.value, total))}` : "enquiries"}</p>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-1">
        {data.map((d) => (
          <li key={d.source}>
            <button
              type="button"
              onMouseEnter={() => setActive(d.source)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(d.source)}
              onBlur={() => setActive(null)}
              className={cn("flex w-full items-center gap-2.5 rounded-[3px] px-2 py-1.5 text-left text-[13px] transition-colors", active === d.source && "bg-[#F6F6F6]")}
            >
              <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: sourceColor(d.source) }} />
              <span className="min-w-0 flex-1 truncate">{d.label}</span>
              <span className="font-semibold num">{d.value}</span>
              <span className="w-11 text-right text-muted num">{fmtPct(pct(d.value, total))}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Funnel ── */

export function Funnel({ stages }: { stages: { key: string; label: string; value: number }[] }) {
  const top = Math.max(1, stages[0]?.value ?? 0);
  return (
    <ol className="space-y-4">
      {stages.map((s, i) => {
        const prev = i ? stages[i - 1].value : null;
        const width = (s.value / top) * 100;
        return (
          <li key={s.key}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
              <span className="font-medium">{s.label}</span>
              <span className="shrink-0 text-muted">
                <span className="font-semibold text-ink num">{s.value.toLocaleString("en-IN")}</span>
                {prev !== null && <span className="num"> · {prev ? fmtPct(pct(s.value, prev)) : "—"}</span>}
              </span>
            </div>
            <div className="h-6 overflow-hidden rounded-r-[4px] bg-[#F6F6F6]">
              <div
                className="mg-grow h-full rounded-r-[4px]"
                style={{ width: `${s.value ? Math.max(width, 1.5) : 0}%`, background: i === stages.length - 1 ? RED : INK, opacity: i === stages.length - 1 ? 1 : 1 - i * 0.18, animationDelay: `${i * 120}ms` }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ── Inline bar for tables ── */

export function InlineBar({ value, max, children, tone = "ink" }: { value: number; max: number; children?: ReactNode; tone?: "ink" | "red" }) {
  return (
    <div className="flex min-w-[120px] items-center gap-2.5">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#F1F1F1]">
        <div className="mg-grow h-full rounded-full" style={{ width: `${max ? Math.max((value / max) * 100, value ? 3 : 0) : 0}%`, background: tone === "red" ? RED : INK }} />
      </div>
      <span className="w-10 text-right text-[13px] font-medium num">{children ?? value}</span>
    </div>
  );
}

/** Keyframes for the charts' slow entrance (kept here so the charts are self-contained). */
export function ChartStyles() {
  return (
    <style>{`
      @keyframes mg-draw { from { stroke-dasharray: 1; stroke-dashoffset: 1; } to { stroke-dasharray: 1; stroke-dashoffset: 0; } }
      @keyframes mg-fade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes mg-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
      .mg-draw { animation: mg-draw 1.4s cubic-bezier(0.22, 1, 0.36, 1) both; }
      .mg-fade { animation: mg-fade 1.2s cubic-bezier(0.22, 1, 0.36, 1) both; }
      .mg-grow { transform-origin: left; animation: mg-grow 1.1s cubic-bezier(0.22, 1, 0.36, 1) both; }
      @media (prefers-reduced-motion: reduce) { .mg-draw, .mg-fade, .mg-grow { animation: none; } }
    `}</style>
  );
}
