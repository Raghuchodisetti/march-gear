import { ShieldCheck } from "lucide-react";
import type { CarModel } from "@/types";
import { Stars } from "@/components/ui/rating";
import { Reveal } from "@/components/ui/reveal";

/** Top-down cabin schematic with airbag positions (right-hand drive). */
function AirbagDiagram({ count }: { count: number }) {
  const points: ({ kind: "dot"; x: number; y: number; label: string } | { kind: "curtain"; x: number; label: string })[] = [
    { kind: "dot", x: 77, y: 50, label: "Driver front" },
    { kind: "dot", x: 43, y: 50, label: "Passenger front" },
    { kind: "dot", x: 95, y: 78, label: "Driver side" },
    { kind: "dot", x: 25, y: 78, label: "Passenger side" },
    { kind: "curtain", x: 101, label: "Right curtain" },
    { kind: "curtain", x: 19, label: "Left curtain" },
    { kind: "dot", x: 77, y: 64, label: "Driver knee" },
    { kind: "dot", x: 95, y: 130, label: "Rear side, right" },
    { kind: "dot", x: 25, y: 130, label: "Rear side, left" },
    { kind: "dot", x: 60, y: 80, label: "Front centre" },
  ];
  const active = points.slice(0, Math.min(count, points.length));

  return (
    <svg viewBox="0 0 120 200" className="h-auto w-full" role="img" aria-label={`Cabin diagram showing ${count} airbag positions: ${active.map((p) => p.label).join(", ")}`}>
      <rect x="16" y="8" width="88" height="184" rx="30" fill="none" className="stroke-ink/25" strokeWidth="1.5" />
      <path d="M 28 40 Q 60 28 92 40" fill="none" className="stroke-ink/20" strokeWidth="1.5" />
      <path d="M 30 160 Q 60 170 90 160" fill="none" className="stroke-ink/20" strokeWidth="1.5" />
      {/* Seats */}
      <rect x="31" y="62" width="24" height="30" rx="4" className="fill-mist stroke-ink/15" />
      <rect x="65" y="62" width="24" height="30" rx="4" className="fill-mist stroke-ink/15" />
      <rect x="31" y="114" width="58" height="30" rx="4" className="fill-mist stroke-ink/15" />
      {/* Steering wheel (right-hand drive) */}
      <circle cx="77" cy="54" r="7" fill="none" className="stroke-ink/30" strokeWidth="1.5" />
      {active.map((p) =>
        p.kind === "curtain" ? (
          <line key={p.label} x1={p.x} y1="56" x2={p.x} y2="148" className="stroke-red" strokeWidth="3" strokeLinecap="round" opacity="0.85" />
        ) : (
          <g key={p.label}>
            <circle cx={p.x} cy={p.y} r="7.5" className="fill-red" opacity="0.15" />
            <circle cx={p.x} cy={p.y} r="3.5" className="fill-red" />
          </g>
        ),
      )}
    </svg>
  );
}

/** Safety: crash-test rating, airbag schematic and the safety equipment list. */
export function CarSafety({ car }: { car: CarModel }) {
  const tested = car.safetyAgency !== "Not tested";
  const items = car.features.find((g) => g.group === "Safety")?.items ?? [];
  const adas = items.find((i) => /ADAS/i.test(i));
  const rest = items.filter((i) => i !== adas);

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10">
      <Reveal className="lg:col-span-5">
        <div className="border-t-2 border-ink pt-6">
          <p className="type-eyebrow text-muted">Crash-test rating</p>
          {tested ? (
            <>
              <p className="mt-5 flex items-baseline gap-2">
                <span className="type-display num">{car.safetyRating}</span>
                <span className="type-h3 text-muted">/ 5</span>
              </p>
              <Stars value={car.safetyRating} size={22} className="mt-4" tone="red" />
              <p className="mt-4 max-w-sm text-[14px] text-muted">
                Rated by <span className="font-medium text-ink">{car.safetyAgency}</span> for adult and child occupant protection.
              </p>
            </>
          ) : (
            <>
              <p className="type-h1 mt-5">Not yet rated</p>
              <p className="mt-4 max-w-sm text-[14px] text-muted">
                The {car.name} has not been crash-tested by an independent NCAP programme. Its safety credentials rest on the equipment listed here.
              </p>
            </>
          )}
        </div>

        <div className="mt-10 grid grid-cols-[96px_1fr] items-center gap-6 border-t border-line pt-8 sm:grid-cols-[120px_1fr]">
          <AirbagDiagram count={car.airbags} />
          <div>
            <p className="font-display text-[clamp(2.5rem,2rem+2vw,3.5rem)] font-semibold leading-none tracking-[-0.03em] num">{car.airbags}</p>
            <p className="mt-2 text-[14px] font-medium">Airbags, top variant</p>
            <p className="mt-1 text-[13px] text-muted">Positions shown are illustrative for a right-hand-drive cabin.</p>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.1} className="lg:col-span-7">
        {adas && (
          <div className="mb-8 flex items-start gap-4 bg-ink p-6 text-white md:p-7">
            <ShieldCheck aria-hidden className="mt-0.5 size-6 shrink-0 text-red" />
            <div>
              <p className="type-eyebrow text-white/60">Driver assistance</p>
              <p className="type-h3 mt-3">{adas}</p>
              <p className="mt-2 text-[13.5px] text-white/60">Radar and camera-based systems that can brake, steer and hold distance to help prevent collisions.</p>
            </div>
          </div>
        )}
        <h3 className="type-h4">Safety equipment</h3>
        <ul className="mt-4 grid grid-cols-1 gap-x-10 sm:grid-cols-2">
          {rest.map((item) => (
            <li key={item} className="flex items-center gap-3 border-b border-line py-4 text-[15px]">
              <ShieldCheck aria-hidden className="size-4 shrink-0 text-ink/60" />
              {item}
            </li>
          ))}
        </ul>
      </Reveal>
    </div>
  );
}
