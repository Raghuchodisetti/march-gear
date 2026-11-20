"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Segmented } from "@/components/ui/field";
import { ChartStyles, compact } from "@/components/portal/analytics/charts";
import { ctr, dayLabel, n } from "./shared";

/* ──────────────────────────────────────────────────────────────
   Daily ad performance: impressions / clicks / enquiries as an
   area + line, with a crosshair readout of all three for the day.
   Same marks and palette as the portal analytics charts.
   ────────────────────────────────────────────────────────────── */

const RED = "#E31E24";
const INK = "#111111";
const GRID = "#EFEFEF";

export interface TrendDay {
  day: string;
  impressions: number;
  clicks: number;
  enquiries: number;
}

type Metric = "impressions" | "clicks" | "enquiries";
const LABEL: Record<Metric, string> = { impressions: "Impressions", clicks: "Clicks", enquiries: "Enquiries" };

function niceScale(v: number) {
  if (v <= 4) return { max: 4, step: 1 };
  const p = 10 ** Math.floor(Math.log10(v));
  const r = v / p;
  const [m, steps] = r <= 1 ? [1, 5] : r <= 2 ? [2, 4] : r <= 2.5 ? [2.5, 5] : r <= 5 ? [5, 5] : [10, 5];
  return { max: m * p, step: (m * p) / steps };
}

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

export function AdTrendChart({ series, height = 240, title = "Daily performance" }: { series: TrendDay[]; height?: number; title?: string }) {
  const [metric, setMetric] = useState<Metric>("impressions");
  const [ref, width] = useWidth<HTMLDivElement>();
  const gid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const total = series.reduce((s, p) => s + p[metric], 0);
  const H = height;
  const pad = { l: 40, r: 12, t: 16, b: 28 };
  const w = Math.max(0, width - pad.l - pad.r);
  const h = H - pad.t - pad.b;
  const count = series.length;
  const { max, step } = niceScale(Math.max(1, ...series.map((p) => p[metric])));
  const x = (i: number) => pad.l + (count <= 1 ? w / 2 : (i / (count - 1)) * w);
  const y = (v: number) => pad.t + h - (v / max) * h;
  const line = series.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[metric]).toFixed(1)}`).join("");
  const area = count ? `${line}L${x(count - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z` : "";
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const every = Math.max(1, Math.ceil(count / Math.max(2, Math.floor(w / 72))));
  const hp = hover !== null ? series[hover] : null;
  const pick = (clientX: number, rect: DOMRect) => {
    const i = count <= 1 ? 0 : Math.round(((clientX - rect.left - pad.l) / w) * (count - 1));
    setHover(Math.min(count - 1, Math.max(0, i)));
  };

  return (
    <div>
      <ChartStyles />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12.5px] font-medium text-muted">
            {title} · {LABEL[metric].toLowerCase()}
          </p>
          <p className="mt-1 font-display text-[28px] font-semibold leading-none tracking-[-0.03em] num">{n(total)}</p>
        </div>
        <Segmented
          ariaLabel="Metric"
          value={metric}
          onChange={(m) => {
            setMetric(m);
            setHover(null);
          }}
          options={[
            { value: "impressions", label: "Impressions" },
            { value: "clicks", label: "Clicks" },
            { value: "enquiries", label: "Enquiries" },
          ]}
        />
      </div>
      <div ref={ref} className="relative mt-5 select-none">
        {width > 0 ? (
          <svg width="100%" height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label={`${LABEL[metric]} per day, ${count} days`} className="block overflow-visible">
            <defs>
              <linearGradient id={`ad-fill-${gid}`} x1="0" x2="0" y1="0" y2="1">
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
            {series.map((p, i) =>
              (i % every === 0 && count - 1 - i >= every * 0.7) || i === count - 1 ? (
                <text key={p.day} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === count - 1 ? "end" : "middle"} className="fill-muted text-[11px]">
                  {dayLabel(p.day, false)}
                </text>
              ) : null,
            )}
            <path key={`a-${metric}`} d={area} fill={`url(#ad-fill-${gid})`} className="mg-fade" />
            <path key={`l-${metric}`} d={line} fill="none" stroke={RED} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="mg-draw" />
            {count > 0 && hover === null && <circle cx={x(count - 1)} cy={y(series[count - 1][metric])} r={4} fill={RED} stroke="#fff" strokeWidth={2} />}
            {hp && hover !== null && (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + h} stroke={INK} strokeOpacity={0.25} strokeWidth={1} />
                <circle cx={x(hover)} cy={y(hp[metric])} r={5} fill={RED} stroke="#fff" strokeWidth={2} />
              </g>
            )}
            <rect
              x={pad.l - 8}
              y={pad.t}
              width={w + 16}
              height={h}
              fill="transparent"
              tabIndex={0}
              aria-label="Move across the chart to read each day"
              onMouseMove={(e) => pick(e.clientX, (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect())}
              onTouchStart={(e) => pick(e.touches[0].clientX, (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect())}
              onTouchMove={(e) => pick(e.touches[0].clientX, (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect())}
              onMouseLeave={() => setHover(null)}
              onBlur={() => setHover(null)}
              onFocus={() => setHover(count - 1)}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") setHover((v) => Math.max(0, (v ?? count - 1) - 1));
                if (e.key === "ArrowRight") setHover((v) => Math.min(count - 1, (v ?? 0) + 1));
              }}
              className="cursor-crosshair outline-none"
            />
          </svg>
        ) : (
          <div style={{ height: H }} />
        )}
        {hp && hover !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-2 z-10 min-w-[170px] border border-line bg-white px-3.5 py-2.5 text-[12.5px] shadow-soft"
            style={{ left: Math.min(Math.max(0, x(hover) - 85), Math.max(0, width - 180)) }}
          >
            <p className="font-medium">{dayLabel(hp.day)}</p>
            {(["impressions", "clicks", "enquiries"] as Metric[]).map((m) => (
              <p key={m} className="mt-0.5 flex items-center justify-between gap-4">
                <span className="inline-flex items-center gap-1.5 text-muted">
                  <span aria-hidden className="size-2 rounded-full" style={{ background: m === metric ? RED : "#C8C8C8" }} /> {LABEL[m]}
                </span>
                <span className="font-semibold num">{n(hp[m])}</span>
              </p>
            ))}
            <p className="mt-1 border-t border-line pt-1 text-[11.5px] text-muted">CTR {ctr(hp.clicks, hp.impressions)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
