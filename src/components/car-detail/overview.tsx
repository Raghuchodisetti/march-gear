import type { CarModel } from "@/types";
import { formatDate } from "@/lib/format";
import { Counter, Reveal } from "@/components/ui/reveal";
import { fuelSummary, transmissionSummary } from "@/components/vehicle/car-card";
import { DetailSection } from "./section";
import { isEv, maxOf, pad2, seatsLabel } from "./utils";

/** Overview: editorial intro, numbered highlights and an animated key-spec strip. */
export function CarOverview({ car, index }: { car: CarModel; index: string }) {
  const ev = isEv(car);
  const accel = maxOf(car.acceleration);

  const strip: { label: string; value: number; decimals?: number; suffix: string; note?: string }[] = [
    ev && car.ev
      ? { label: "Battery", value: car.ev.batteryKwh, decimals: car.ev.batteryKwh % 1 ? 1 : 0, suffix: " kWh", note: "Largest pack" }
      : { label: "Engine", value: maxOf(car.engine), suffix: " cc", note: "Displacement, up to" },
    { label: "Power", value: maxOf(car.power), suffix: " bhp", note: "Maximum" },
    { label: "Torque", value: maxOf(car.torque), suffix: " Nm", note: "Maximum" },
    ev
      ? { label: "Range", value: car.efficiencyValue, suffix: " km", note: "Claimed, per charge" }
      : { label: "Mileage", value: car.efficiencyValue, decimals: car.efficiencyValue % 1 ? 1 : 0, suffix: " kmpl", note: "Best claimed" },
    { label: "0–100 km/h", value: accel, decimals: 1, suffix: " s", note: "Quickest variant" },
    { label: "Boot space", value: car.bootSpace, suffix: " L", note: car.seats.some((s) => s > 5) ? "Third row up" : "Luggage volume" },
  ];

  const glance: [string, string][] = [
    ["Body style", car.bodyType],
    ["Seating", `${seatsLabel(car.seats)} seats`],
    ["Fuel", fuelSummary(car)],
    ["Gearbox", transmissionSummary(car)],
    ["Safety", car.safetyAgency === "Not tested" ? "Not crash-tested" : `${car.safetyRating}★ ${car.safetyAgency}`],
    car.launchedOn ? ["Launched", formatDate(car.launchedOn)] : ["Variants", `${car.variants.length} on sale`],
  ];

  return (
    <DetailSection
      id="overview"
      index={index}
      eyebrow="Overview"
      title={
        <>
          The {car.name}, <span className="type-editorial font-normal">in brief.</span>
        </>
      }
      divider={false}
    >
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10">
        <Reveal className="lg:col-span-7">
          <p className="type-lead max-w-2xl text-ink/85">{car.overview}</p>
          <dl className="mt-10 grid max-w-2xl grid-cols-2 gap-x-8 sm:grid-cols-3">
            {glance.map(([label, value]) => (
              <div key={label} className="border-t border-line py-4">
                <dt className="text-[12px] text-muted">{label}</dt>
                <dd className="mt-1 text-[14px] font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </Reveal>

        <Reveal delay={0.1} className="lg:col-span-5">
          <h3 className="type-eyebrow text-muted">Highlights</h3>
          <ol className="mt-4 border-t border-line">
            {car.highlights.map((h, i) => (
              <li key={h} className="flex items-baseline gap-5 border-b border-line py-4">
                <span className="w-6 shrink-0 text-[12px] font-medium text-red num">{pad2(i + 1)}</span>
                <span className="type-h4 font-medium">{h}</span>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>

      <dl className="mt-14 grid grid-cols-2 gap-px border border-line bg-line md:mt-20 md:grid-cols-3 xl:grid-cols-6">
        {strip.map((s) => (
          <div key={s.label} className="flex flex-col bg-white p-5 md:p-6">
            <dt className="type-eyebrow text-muted">{s.label}</dt>
            <dd className="mt-4">
              <Counter
                to={s.value}
                decimals={s.decimals ?? 0}
                suffix={s.suffix}
                className="font-display text-[clamp(1.5rem,1.2rem+1vw,2.125rem)] font-semibold leading-none tracking-[-0.03em] num"
              />
              {s.note && <span className="mt-2 block text-[12px] text-muted">{s.note}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </DetailSection>
  );
}
