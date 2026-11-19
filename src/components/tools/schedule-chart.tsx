"use client";

import { useState } from "react";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { compactINR, niceTicks, type ScheduleRow } from "./calc";
import { useElementWidth } from "./fields";
import { LegendKey } from "./instrument";

const GAP = 2;

/** Rounded data-end, square at the baseline. */
function topRoundedRect(x: number, y: number, w: number, h: number, r = 4) {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/**
 * One stacked column per loan year: principal (ink) grows from the baseline,
 * interest (red) sits on top. Equal yearly outflow makes the shift visible.
 */
export function ScheduleChart({ rows, className }: { rows: ScheduleRow[]; className?: string }) {
  const [ref, width] = useElementWidth<HTMLDivElement>(640);
  const [active, setActive] = useState<number | null>(null);

  const compact = width < 520;
  const height = compact ? 240 : 300;
  const m = { top: 20, right: 4, bottom: 34, left: compact ? 46 : 58 };
  const innerW = Math.max(10, width - m.left - m.right);
  const innerH = height - m.top - m.bottom;

  const max = Math.max(1, ...rows.map((r) => r.principal + r.interest));
  const ticks = niceTicks(0, max, compact ? 3 : 4);
  const top = ticks[ticks.length - 1];
  const y = (v: number) => m.top + innerH - (v / top) * innerH;

  const band = innerW / Math.max(1, rows.length);
  const barW = Math.min(compact ? 22 : 28, band * 0.5);
  const activeRow = active !== null ? rows[active] : null;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <LegendKey label="Principal repaid" swatch="bg-ink" />
        <LegendKey label="Interest paid" swatch="bg-red" />
      </div>

      <div ref={ref} className="relative mt-6">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="group"
          aria-label="Yearly principal and interest paid"
          className="block h-auto max-w-full overflow-visible"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} className="stroke-line" strokeWidth={1} shapeRendering="crispEdges" />
              <text x={m.left - 10} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] num">
                {compactINR(t)}
              </text>
            </g>
          ))}

          {rows.map((row, i) => {
            const cx = m.left + band * i + band / 2;
            const x = cx - barW / 2;
            const pTop = y(row.principal);
            const pH = m.top + innerH - pTop;
            const iTop = y(row.principal + row.interest);
            const iH = Math.max(0, pTop - iTop - GAP);
            const dim = active !== null && active !== i;
            return (
              <g key={row.year} className={cn("transition-opacity duration-[250ms]", dim && "opacity-35")}>
                <rect x={x} y={pTop} width={barW} height={Math.max(0, pH)} className="fill-ink" />
                {iH > 0 && <path d={topRoundedRect(x, iTop, barW, iH)} className="fill-red" />}
                <text x={cx} y={height - 12} textAnchor="middle" className={cn("text-[11px] num", active === i ? "fill-ink font-medium" : "fill-muted")}>
                  {compact ? `Y${row.year}` : `Year ${row.year}`}
                </text>
                <rect
                  x={m.left + band * i}
                  y={m.top}
                  width={band}
                  height={innerH}
                  fill="transparent"
                  tabIndex={0}
                  role="img"
                  aria-label={`Year ${row.year}: principal ${formatINR(row.principal)}, interest ${formatINR(row.interest)}`}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="cursor-default outline-none"
                />
              </g>
            );
          })}
          <line x1={m.left} x2={width - m.right} y1={m.top + innerH} y2={m.top + innerH} className="stroke-ink/40" strokeWidth={1} shapeRendering="crispEdges" />
        </svg>

        {activeRow && active !== null && (
          <div
            aria-hidden
            className="pointer-events-none absolute z-10 w-44 -translate-x-1/2 -translate-y-full border border-line bg-white px-3.5 py-3 shadow-soft"
            style={{
              left: Math.min(Math.max(m.left + band * active + band / 2, 88), width - 88),
              top: Math.max(8, y(activeRow.principal + activeRow.interest) - 10),
            }}
          >
            <p className="type-eyebrow text-muted">Year {activeRow.year}</p>
            <TooltipRow swatch="bg-ink" label="Principal" value={formatINR(activeRow.principal)} />
            <TooltipRow swatch="bg-red" label="Interest" value={formatINR(activeRow.interest)} />
            <p className="mt-2 border-t border-line pt-2 text-[11.5px] text-muted num">
              Balance {formatINR(activeRow.balance)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function TooltipRow({ swatch, label, value }: { swatch: string; label: string; value: string }) {
  return (
    <p className="mt-1.5 flex items-center justify-between gap-3 text-[12px]">
      <span className="inline-flex items-center gap-1.5 text-muted">
        <span aria-hidden className={cn("h-[2px] w-3 rounded-full", swatch)} />
        {label}
      </span>
      <span className="font-semibold text-ink num">{value}</span>
    </p>
  );
}
