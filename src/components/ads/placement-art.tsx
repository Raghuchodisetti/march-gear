import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────
   A small wireframe of where a placement sits on the page (red =
   the ad). Server-safe SVG, used on placement cards.
   ────────────────────────────────────────────────────────────── */

const INK = "#111111";
const LINE = "#E3E3E3";
const SOFT = "#F1F1F1";
const RED = "#E31E24";

function Chrome() {
  return (
    <>
      <rect x="0" y="0" width="240" height="150" rx="4" fill="#fff" />
      <rect x="0" y="0" width="240" height="14" rx="4" fill={INK} />
      <rect x="0" y="10" width="240" height="4" fill={INK} />
      <rect x="10" y="5" width="24" height="4" rx="1" fill="#fff" opacity="0.9" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={150 + i * 20} y="6" width="14" height="2.5" rx="1" fill="#fff" opacity="0.45" />
      ))}
    </>
  );
}

const Cards = ({ y, n = 4 }: { y: number; n?: number }) => (
  <>
    {Array.from({ length: n }, (_, i) => {
      const w = (220 - (n - 1) * 6) / n;
      return (
        <g key={i}>
          <rect x={10 + i * (w + 6)} y={y} width={w} height="18" rx="2" fill={SOFT} />
          <rect x={10 + i * (w + 6)} y={y + 21} width={w * 0.7} height="3" rx="1" fill={LINE} />
        </g>
      );
    })}
  </>
);

function Banner({ y, h = 22 }: { y: number; h?: number }) {
  return (
    <g>
      <rect x="10" y={y} width="220" height={h} rx="2.5" fill={RED} />
      <rect x="18" y={y + h / 2 - 4} width="60" height="4" rx="1" fill="#fff" />
      <rect x="18" y={y + h / 2 + 2} width="36" height="3" rx="1" fill="#fff" opacity="0.7" />
      <rect x="196" y={y + 4} width="28" height="5" rx="1" fill="#fff" opacity="0.9" />
    </g>
  );
}

export function PlacementArt({ placementKey, format, className }: { placementKey: string; format: "banner" | "sponsored_listing"; className?: string }) {
  return (
    <svg viewBox="0 0 240 150" role="img" aria-label="Where the ad appears (shown in red)" className={cn("block h-auto w-full", className)}>
      <Chrome />
      {format === "sponsored_listing" ? (
        <>
          <rect x="10" y="22" width="80" height="5" rx="1" fill={INK} />
          <rect x="10" y="31" width="120" height="3" rx="1" fill={LINE} />
          {[0, 1, 2, 3].map((i) => {
            const y = 42 + i * 26;
            const ad = i === 0;
            return (
              <g key={i}>
                <rect x="10" y={y} width="220" height="21" rx="2.5" fill={ad ? "#FDF2F2" : "#fff"} stroke={ad ? RED : LINE} strokeWidth={ad ? 1.2 : 1} />
                <rect x="16" y={y + 5} width="11" height="11" rx="2" fill={ad ? RED : SOFT} />
                <rect x="32" y={y + 6} width="60" height="3.5" rx="1" fill={ad ? INK : "#BDBDBD"} />
                <rect x="32" y={y + 12} width="38" height="2.5" rx="1" fill={LINE} />
                {ad && <rect x="98" y={y + 5.5} width="22" height="5" rx="1" fill={RED} />}
                <rect x="190" y={y + 6} width="32" height="9" rx="2" fill={ad ? RED : INK} opacity={ad ? 1 : 0.85} />
              </g>
            );
          })}
        </>
      ) : placementKey === "home_banner" ? (
        <>
          <rect x="0" y="14" width="240" height="34" fill="#1d1d1d" />
          <rect x="10" y="24" width="70" height="6" rx="1" fill="#fff" />
          <rect x="10" y="34" width="44" height="3" rx="1" fill="#fff" opacity="0.5" />
          <Cards y={56} />
          <Banner y={88} />
          <Cards y={118} />
        </>
      ) : placementKey === "insurance_home_banner" ? (
        <>
          <rect x="0" y="14" width="240" height="44" fill="#1d1d1d" />
          <rect x="10" y="22" width="64" height="6" rx="1" fill="#fff" />
          <rect x="10" y="32" width="40" height="3" rx="1" fill="#fff" opacity="0.5" />
          <rect x="120" y="21" width="110" height="30" rx="2" fill="#fff" />
          <rect x="126" y="27" width="60" height="5" rx="1" fill={SOFT} />
          <rect x="126" y="36" width="98" height="9" rx="1.5" fill={INK} />
          <Banner y={66} />
          <Cards y={98} n={3} />
          <rect x="10" y="132" width="140" height="4" rx="1" fill={LINE} />
        </>
      ) : (
        <>
          <rect x="10" y="22" width="40" height="3" rx="1" fill={LINE} />
          <rect x="10" y="29" width="96" height="7" rx="1" fill={INK} />
          <rect x="10" y="40" width="150" height="3" rx="1" fill={LINE} />
          <rect x="10" y="46" width="120" height="3" rx="1" fill={LINE} />
          <Cards y={56} n={3} />
          <Banner y={88} />
          {[0, 1, 2].map((i) => (
            <rect key={i} x="10" y={118 + i * 7} width={i === 2 ? 120 : 220} height="3" rx="1" fill={LINE} />
          ))}
        </>
      )}
    </svg>
  );
}
