"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { compactINR, formatYears, niceTicks } from "./calc";
import { useElementWidth } from "./fields";
import { LegendKey } from "./instrument";

export interface CostPoint {
  year: number;
  ev: number;
  ice: number;
}

/**
 * Cumulative cost of ownership over time — EV in red, combustion in ink —
 * with a crosshair readout and a marker where the two lines cross.
 */
export function CostLineChart({
  series,
  evLabel,
  iceLabel,
  breakEven,
  className,
}: {
  series: CostPoint[];
  evLabel: string;
  iceLabel: string;
  /** Years until the EV becomes cheaper overall, when inside the plotted range */
  breakEven: number | null;
  className?: string;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>(720);
  const [active, setActive] = useState<number | null>(null);

  const compact = width < 560;
  const height = compact ? 260 : 340;
  const m = { top: 28, right: compact ? 12 : 20, bottom: 44, left: compact ? 50 : 64 };
  const innerW = Math.max(10, width - m.left - m.right);
  const innerH = height - m.top - m.bottom;

  const years = series.length - 1;
  const values = series.flatMap((p) => [p.ev, p.ice]);
  const ticks = niceTicks(Math.min(...values), Math.max(...values), compact ? 4 : 5);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const x = (yr: number) => m.left + (years === 0 ? 0 : (yr / years) * innerW);
  const y = (v: number) => m.top + innerH - ((v - lo) / (hi - lo || 1)) * innerH;

  const path = (key: "ev" | "ice") => series.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.year).toFixed(1)},${y(p[key]).toFixed(1)}`).join("");

  const crossing =
    breakEven !== null && breakEven > 0 && breakEven <= years
      ? { x: x(breakEven), y: y(series[0].ev + ((series[years].ev - series[0].ev) / Math.max(1, years)) * breakEven) }
      : null;

  const point = active !== null ? series[active] : null;
  const last = series[years];

  const fromPointer = (e: PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / Math.max(1, rect.width);
    setActive(Math.round(Math.min(1, Math.max(0, rel)) * years));
  };

  const onKey = (e: KeyboardEvent<SVGRectElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    setActive((cur) => {
      const base = cur ?? 0;
      return Math.min(years, Math.max(0, base + (e.key === "ArrowRight" ? 1 : -1)));
    });
  };

  const readout = (p: CostPoint) =>
    `${p.year === 0 ? "At purchase" : `After ${p.year} ${p.year === 1 ? "year" : "years"}`}: ${evLabel} ${formatPrice(p.ev)}, ${iceLabel} ${formatPrice(p.ice)}`;

  const tooltipLeft = point ? Math.min(Math.max(x(point.year), 100), width - 100) : 0;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <LegendKey line swatch="bg-red" label={evLabel} />
        <LegendKey line swatch="bg-ink" label={iceLabel} />
        {crossing && (
          <span className="inline-flex items-center gap-2 text-[12.5px] text-ink/80">
            <span aria-hidden className="size-2.5 rounded-full border-2 border-red bg-white" />
            Break-even
          </span>
        )}
      </div>

      <div ref={ref} className="relative mt-6">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block h-auto max-w-full overflow-visible"
          role="group"
          aria-label={`Cumulative cost over ${years} years. ${evLabel}: ${formatPrice(last.ev)}. ${iceLabel}: ${formatPrice(last.ice)}.`}
        >
          <text x={m.left} y={10} className="fill-muted text-[11px]">
            Cumulative cost (price + running)
          </text>

          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} className="stroke-line" strokeWidth={1} shapeRendering="crispEdges" />
              <text x={m.left - 10} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] num">
                {compactINR(t)}
              </text>
            </g>
          ))}

          {series.map((p) => (
            <text
              key={p.year}
              x={x(p.year)}
              y={m.top + innerH + 20}
              textAnchor={p.year === 0 ? "start" : p.year === years ? "end" : "middle"}
              className={cn("text-[11px] num", active === p.year ? "fill-ink font-medium" : "fill-muted", compact && years > 6 && p.year % 2 === 1 && p.year !== years && "hidden")}
            >
              {p.year === 0 ? "Buy" : p.year}
            </text>
          ))}
          <text x={width - m.right} y={height - 4} textAnchor="end" className="fill-muted text-[11px]">
            Years of ownership
          </text>

          {point && (
            <line x1={x(point.year)} x2={x(point.year)} y1={m.top} y2={m.top + innerH} className="stroke-ink/25" strokeWidth={1} shapeRendering="crispEdges" />
          )}

          {crossing && (
            <g>
              <line x1={crossing.x} x2={crossing.x} y1={crossing.y + 8} y2={m.top + innerH} className="stroke-red/50" strokeWidth={1} shapeRendering="crispEdges" />
              <text
                x={crossing.x}
                y={crossing.y - 14}
                textAnchor={crossing.x > width - 120 ? "end" : crossing.x < m.left + 80 ? "start" : "middle"}
                className="fill-ink text-[11.5px] font-semibold"
                stroke="white"
                strokeWidth={4}
                paintOrder="stroke"
              >
                Break-even · {formatYears(breakEven ?? 0)}
              </text>
            </g>
          )}

          <path d={path("ice")} fill="none" className="stroke-ink" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <path d={path("ev")} fill="none" className="stroke-red" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {crossing && <circle cx={crossing.x} cy={crossing.y} r={5} className="fill-white stroke-red" strokeWidth={2} />}

          {(point ? [point] : [last]).map((p) => (
            <g key={`dots-${p.year}`}>
              <circle cx={x(p.year)} cy={y(p.ice)} r={4.5} className="fill-ink stroke-white" strokeWidth={2} />
              <circle cx={x(p.year)} cy={y(p.ev)} r={4.5} className="fill-red stroke-white" strokeWidth={2} />
            </g>
          ))}

          <line x1={m.left} x2={width - m.right} y1={m.top + innerH} y2={m.top + innerH} className="stroke-ink/40" strokeWidth={1} shapeRendering="crispEdges" />

          <rect
            x={m.left - 12}
            y={m.top}
            width={innerW + 24}
            height={innerH}
            fill="transparent"
            tabIndex={0}
            role="slider"
            aria-label="Year to read"
            aria-valuemin={0}
            aria-valuemax={years}
            aria-valuenow={active ?? years}
            aria-valuetext={readout(series[active ?? years])}
            onPointerMove={fromPointer}
            onPointerDown={fromPointer}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive((cur) => cur ?? years)}
            onBlur={() => setActive(null)}
            onKeyDown={onKey}
            className="cursor-crosshair outline-none"
          />
        </svg>

        {point && (
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 z-10 w-52 -translate-x-1/2 border border-line bg-white px-3.5 py-3 shadow-soft"
            style={{ left: tooltipLeft }}
          >
            <p className="type-eyebrow text-muted">{point.year === 0 ? "At purchase" : `After ${point.year} ${point.year === 1 ? "year" : "years"}`}</p>
            <Row swatch="bg-red" label={evLabel} value={formatPrice(point.ev)} />
            <Row swatch="bg-ink" label={iceLabel} value={formatPrice(point.ice)} />
            <p className="mt-2 border-t border-line pt-2 text-[11.5px] text-muted num">
              {point.ice >= point.ev ? "EV ahead by " : "EV behind by "}
              <span className="font-semibold text-ink">{formatPrice(Math.abs(point.ice - point.ev))}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ swatch, label, value }: { swatch: string; label: string; value: string }) {
  return (
    <p className="mt-1.5 flex items-center justify-between gap-3 text-[12px]">
      <span className="inline-flex min-w-0 items-center gap-1.5 text-muted">
        <span aria-hidden className={cn("h-[2px] w-3 shrink-0 rounded-full", swatch)} />
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 font-semibold text-ink num">{value}</span>
    </p>
  );
}
