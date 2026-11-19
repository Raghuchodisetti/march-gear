import { formatPriceShort } from "@/lib/format";
import { CONDITIONS, type Condition, type ValueBand } from "./valuation";

const CX = 150;
const CY = 132;
const R = 100;

const point = (t: number, r = R) => {
  const a = Math.PI + t * Math.PI;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)] as const;
};

const arc = (t0: number, t1: number) => {
  const [x0, y0] = point(t0);
  const [x1, y1] = point(t1);
  return `M${x0.toFixed(2)},${y0.toFixed(2)} A${R},${R} 0 0 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
};

/**
 * Semicircular gauge spanning Fair → Excellent values. The selected band
 * is inked; the red needle points at its most likely value.
 */
export function ConditionGauge({ bands, selected }: { bands: Record<Condition, ValueBand>; selected: Condition }) {
  const lo = bands.fair.low;
  const hi = bands.excellent.high;
  const t = (v: number) => Math.min(1, Math.max(0, (v - lo) / (hi - lo || 1)));
  const edges = [0, t((bands.fair.mid + bands.good.mid) / 2), t((bands.good.mid + bands.excellent.mid) / 2), 1];
  const gap = 0.008;
  const needle = t(bands[selected].mid) * 180;

  return (
    <div>
      <svg viewBox="-28 0 356 152" className="mx-auto block w-full max-w-[440px]" role="img" aria-label={`Gauge: ${selected} condition selected`}>
        {CONDITIONS.map((c, i) => {
          const a = edges[i] + (i === 0 ? 0 : gap);
          const b = edges[i + 1] - (i === 2 ? 0 : gap);
          const [lx, ly] = point((edges[i] + edges[i + 1]) / 2, R + 16);
          // Anchor side labels away from the arc so long words never overlap it.
          const anchor = lx < CX - 24 ? "end" : lx > CX + 24 ? "start" : "middle";
          const active = c.value === selected;
          return (
            <g key={c.value}>
              <path
                d={arc(a, b)}
                fill="none"
                stroke={active ? "var(--color-ink)" : "var(--color-line)"}
                strokeWidth={14}
                style={{ transition: "stroke 400ms var(--ease-premium)" }}
              />
              <text
                x={lx}
                y={ly}
                textAnchor={anchor}
                dominantBaseline="middle"
                className="font-sans"
                fontSize={9}
                fontWeight={active ? 600 : 500}
                fill={active ? "var(--color-ink)" : "var(--color-muted)"}
                letterSpacing="0.1em"
              >
                {c.label.toUpperCase()}
              </text>
            </g>
          );
        })}
        {/* Scale ends */}
        <text x={CX - R} y={CY + 13} textAnchor="middle" fontSize={8.5} fill="var(--color-muted)">
          {formatPriceShort(lo)}
        </text>
        <text x={CX + R} y={CY + 13} textAnchor="middle" fontSize={8.5} fill="var(--color-muted)">
          {formatPriceShort(hi)}
        </text>
        {/* Needle */}
        <g transform={`translate(${CX} ${CY})`}>
          <g
            style={{
              transformOrigin: "0px 0px",
              transform: `rotate(${needle}deg)`,
              transition: "transform 900ms var(--ease-premium)",
            }}
          >
            <line x1={0} y1={0} x2={-(R - 24)} y2={0} stroke="var(--color-red)" strokeWidth={2.5} strokeLinecap="round" />
          </g>
        </g>
        <circle cx={CX} cy={CY} r={7} fill="var(--color-ink)" stroke="#fff" strokeWidth={2} />
      </svg>
    </div>
  );
}
