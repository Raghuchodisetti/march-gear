"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatPrice, formatPriceShort } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Point {
  age: number;
  value: number;
}

function niceTicks(max: number, target = 4) {
  const raw = max / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

function valueAt(curve: Point[], age: number) {
  const i = Math.min(curve.length - 2, Math.max(0, Math.floor(age)));
  const a = curve[i];
  const b = curve[i + 1];
  const t = Math.min(1, Math.max(0, age - a.age));
  return a.value + (b.value - a.value) * t;
}

/**
 * Single-series depreciation curve in house style: ink line, red marker
 * for today, hairline grid. Plot geometry is drawn in a stretched 0–100
 * SVG (non-scaling strokes); labels and markers are HTML so they stay
 * crisp and legible at every width.
 */
export function DepreciationChart({
  curve,
  currentAge,
  currentValue,
  className,
}: {
  curve: Point[];
  currentAge: number;
  currentValue: number;
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const maxAge = curve[curve.length - 1].age;
  const ticks = niceTicks(curve[0].value);
  const yMax = ticks[ticks.length - 1];
  const X = (age: number) => (age / maxAge) * 100;
  const Y = (value: number) => 100 - (value / yMax) * 100;
  const newPrice = curve[0].value;

  const cut = Math.min(currentAge, maxAge);
  const past = [...curve.filter((p) => p.age < cut), { age: cut, value: valueAt(curve, cut) }];
  const future = [{ age: cut, value: valueAt(curve, cut) }, ...curve.filter((p) => p.age > cut)];
  const line = (pts: Point[]) => pts.map((p, i) => `${i ? "L" : "M"}${X(p.age).toFixed(2)},${Y(p.value).toFixed(2)}`).join(" ");
  const area = `${line(curve)} L100,100 L0,100 Z`;

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    setHover(Math.min(maxAge, Math.max(0, Math.round(frac * maxAge))));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    setHover((h) => Math.min(maxAge, Math.max(0, (h ?? Math.round(cut)) + (e.key === "ArrowRight" ? 1 : -1))));
  };

  const hovered = hover === null ? null : curve.find((p) => p.age === hover) ?? null;
  const markerX = X(cut);
  const markerY = Y(currentValue);
  const align = (x: number) => (x > 72 ? "right" : x < 18 ? "left" : "center");

  return (
    <figure className={className}>
      <div className="relative h-[240px] pb-8 pl-14 pr-3 pt-12 md:h-[300px]">
        <div
          className="relative h-full w-full cursor-crosshair touch-pan-y outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red"
          tabIndex={0}
          role="img"
          aria-label={`Depreciation curve from ${formatPrice(newPrice)} when new to ${formatPrice(curve[curve.length - 1].value)} at ${maxAge} years. Use the arrow keys to read each year.`}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
          onKeyDown={onKey}
          onBlur={() => setHover(null)}
        >
          {/* Hairline grid + y labels */}
          {ticks.map((t) => (
            <div key={t} aria-hidden className="absolute inset-x-0 h-px bg-line" style={{ top: `${Y(t)}%` }}>
              <span className="absolute right-full top-1/2 mr-3 -translate-y-1/2 whitespace-nowrap text-[11px] text-muted num">
                {t === 0 ? "₹0" : formatPriceShort(t)}
              </span>
            </div>
          ))}

          <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
            <path d={area} fill="var(--color-ink)" fillOpacity={0.045} />
            <path
              d={line(future)}
              fill="none"
              stroke="var(--color-ink)"
              strokeOpacity={0.35}
              strokeWidth={2}
              strokeDasharray="3 5"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={line(past)}
              fill="none"
              stroke="var(--color-ink)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* X labels */}
          {curve.map((p) => (
            <span
              key={p.age}
              aria-hidden
              className={cn(
                "absolute top-full mt-2.5 -translate-x-1/2 text-[11px] num",
                p.age === hover ? "font-medium text-ink" : "text-muted",
                p.age % 2 === 1 && p.age !== hover && "max-sm:hidden",
              )}
              style={{ left: `${X(p.age)}%` }}
            >
              {p.age === 0 ? "New" : `${p.age}y`}
            </span>
          ))}

          {/* Today marker */}
          <div aria-hidden className="absolute" style={{ left: `${markerX}%`, top: `${markerY}%` }}>
            <span
              className={cn(
                "absolute bottom-3 whitespace-nowrap bg-red px-2 py-1 text-[11px] font-medium text-white num transition-opacity duration-[250ms]",
                align(markerX) === "center" && "-translate-x-1/2",
                align(markerX) === "right" && "right-0 -mr-1.5",
                align(markerX) === "left" && "-ml-1.5",
                hovered && Math.abs(hovered.age - cut) < 1.5 && "opacity-0",
              )}
            >
              Today · {formatPriceShort(currentValue)}
            </span>
            <span className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red ring-2 ring-white" />
          </div>

          {/* Hover layer */}
          {hovered && (
            <div aria-hidden className="pointer-events-none absolute inset-y-0" style={{ left: `${X(hovered.age)}%` }}>
              <span className="absolute inset-y-0 w-px bg-ink/25" />
              <span
                className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink ring-2 ring-white"
                style={{ top: `${Y(hovered.value)}%`, left: 0.5 }}
              />
              <span
                className={cn(
                  "absolute -top-11 whitespace-nowrap border border-line bg-white px-2.5 py-1.5 text-[11.5px] shadow-soft num",
                  align(X(hovered.age)) === "center" && "-translate-x-1/2",
                  align(X(hovered.age)) === "right" && "right-0",
                )}
              >
                <span className="font-medium text-ink">{hovered.age === 0 ? "New" : `Year ${hovered.age}`}</span>
                <span className="text-muted"> · {formatPriceShort(hovered.value)} · {Math.round((hovered.value / newPrice) * 100)}% of new</span>
              </span>
            </div>
          )}
        </div>
      </div>

      <figcaption className="sr-only">
        <table>
          <caption>Estimated value by age</caption>
          <thead>
            <tr>
              <th scope="col">Age</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            {curve.map((p) => (
              <tr key={p.age}>
                <td>{p.age === 0 ? "New" : `${p.age} years`}</td>
                <td>{formatPrice(p.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
