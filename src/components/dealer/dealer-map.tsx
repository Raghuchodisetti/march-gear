"use client";

import Link from "next/link";
import type { Dealer } from "@/types";
import type { DealerProfile } from "@/lib/catalog";
import { clamp, cn } from "@/lib/utils";
import { useCatalog } from "@/components/providers/catalog-provider";

/* Schematic map geometry, in a 0–100 square. The viewer sits at the centre. */
const MAX_KM = 15;
const radiusFor = (km: number) => 8 + (km / MAX_KM) * 36;

export function mapPosition(dealer: Dealer, dealerProfile: (id: string) => DealerProfile) {
  const r = radiusFor(dealer.distanceKm);
  const a = (dealerProfile(dealer.id).bearing * Math.PI) / 180;
  return { x: 50 + r * Math.sin(a), y: 50 - r * Math.cos(a), r };
}

const MINOR_X = [6, 14, 21, 29, 36, 43, 57, 64, 71, 79, 86, 94];
const MINOR_Y = [7, 15, 23, 31, 38, 44, 56, 62, 69, 77, 85, 93];
const PARKS = [
  { x: 14.5, y: 15.5, w: 13.5, h: 7 },
  { x: 64.5, y: 62.5, w: 6, h: 6 },
  { x: 29.5, y: 77.5, w: 13, h: 7 },
  { x: 79.5, y: 23.5, w: 6, h: 7 },
];
const RINGS = [2, 5, 10];

function Streets() {
  return (
    <g>
      {PARKS.map((p) => (
        <rect key={`${p.x}-${p.y}`} x={p.x} y={p.y} width={p.w} height={p.h} fill="#f3f3f3" />
      ))}
      {/* River */}
      <path d="M-5,34 C18,30 26,46 44,52 S74,58 84,74 S96,96 108,98" fill="none" stroke="#eeeeee" strokeWidth={3.2} />
      {MINOR_X.map((x) => (
        <line key={`x${x}`} x1={x} y1={0} x2={x} y2={100} stroke="#efefef" strokeWidth={0.45} />
      ))}
      {MINOR_Y.map((y) => (
        <line key={`y${y}`} x1={0} y1={y} x2={100} y2={y} stroke="#efefef" strokeWidth={0.45} />
      ))}
      {/* Arterials */}
      <line x1={50} y1={0} x2={50} y2={100} stroke="#e4e4e4" strokeWidth={1.3} />
      <line x1={0} y1={50} x2={100} y2={50} stroke="#e4e4e4" strokeWidth={1.3} />
      <line x1={0} y1={90} x2={100} y2={12} stroke="#e8e8e8" strokeWidth={0.9} />
      <path d="M10,0 C22,26 30,40 50,50" fill="none" stroke="#e8e8e8" strokeWidth={0.9} />
      {RINGS.map((km) => (
        <circle
          key={km}
          cx={50}
          cy={50}
          r={radiusFor(km)}
          fill="none"
          stroke="#111111"
          strokeOpacity={0.16}
          strokeWidth={1}
          strokeDasharray="2 4"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
}

/**
 * A stylised, pure-SVG dealer map. It zooms to fit the visible pins;
 * hovering a dealer card (or a pin) highlights the matching marker.
 */
export function DealerMap({
  dealers,
  activeId,
  onActive,
  locationLabel,
  className,
}: {
  dealers: Dealer[];
  activeId: string | null;
  onActive: (id: string | null) => void;
  locationLabel: string;
  className?: string;
}) {
  const { dealerProfile } = useCatalog();
  const pins = dealers.map((d, i) => ({ dealer: d, index: i, ...mapPosition(d, dealerProfile) }));
  const maxR = Math.max(14, ...pins.map((p) => p.r));
  const scale = clamp(42 / maxR, 1, 2.6);
  const project = (v: number) => 50 + (v - 50) * scale;

  return (
    <div className={cn("relative aspect-square overflow-hidden border border-line bg-white", className)}>
      <svg aria-hidden viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <g
          style={{
            transformBox: "view-box",
            transformOrigin: "50px 50px",
            transform: `scale(${scale})`,
            transition: "transform 900ms var(--ease-premium)",
          }}
        >
          <Streets />
        </g>
      </svg>

      {/* Ring labels */}
      {RINGS.map((km) => {
        const top = 50 - radiusFor(km) * scale;
        if (top < 3) return null;
        return (
          <span
            key={km}
            aria-hidden
            className="absolute -translate-x-1/2 -translate-y-1/2 bg-white px-1.5 text-[10px] font-medium text-muted transition-[top] duration-[900ms] ease-[var(--ease-premium)] num"
            style={{ left: "50%", top: `${top}%` }}
          >
            {km} km
          </span>
        );
      })}

      {/* Viewer */}
      <div aria-hidden className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <span className="block size-3.5 rounded-full border-[3px] border-white bg-ink shadow-[0_0_0_6px_rgb(17_17_17/0.08)]" />
        <span className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink">
          {locationLabel}
        </span>
      </div>

      {/* Pins */}
      <ul aria-label="Dealers on map">
        {pins.map(({ dealer, index, x, y }) => {
          const left = project(x);
          const top = project(y);
          const active = dealer.id === activeId;
          const side = left > 66 ? "right" : left < 34 ? "left" : "center";
          return (
            <li
              key={dealer.id}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-[900ms] ease-[var(--ease-premium)]",
                active ? "z-20" : "z-10",
              )}
              style={{ left: `${left}%`, top: `${top}%` }}
            >
              <Link
                href={`/dealers/${dealer.id}`}
                aria-label={`${index + 1}. ${dealer.name}, ${dealer.area} — ${dealer.distanceKm} km`}
                onMouseEnter={() => onActive(dealer.id)}
                onMouseLeave={() => onActive(null)}
                onFocus={() => onActive(dealer.id)}
                onBlur={() => onActive(null)}
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-[11px] font-semibold text-white shadow-soft ring-2 ring-white transition-[background-color,transform] duration-[250ms] num",
                  active ? "scale-[1.18] bg-red" : "bg-ink hover:bg-ink-3",
                )}
              >
                {index + 1}
              </Link>
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute bottom-full mb-2.5 whitespace-nowrap border border-line bg-white px-2.5 py-1.5 text-left shadow-soft transition-[opacity,transform] duration-[250ms]",
                  side === "center" && "left-1/2 -translate-x-1/2",
                  side === "left" && "-left-1",
                  side === "right" && "-right-1",
                  active ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
                )}
              >
                <span className="block text-[12px] font-medium text-ink">{dealer.name}</span>
                <span className="block text-[11px] text-muted num">
                  {dealer.area} · {dealer.distanceKm} km
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <p className="absolute bottom-3 left-3 bg-white/90 px-2 py-1 text-[10.5px] text-muted backdrop-blur-sm">
        Schematic map · not to scale
      </p>
    </div>
  );
}
