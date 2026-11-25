import type { CarModel } from "@/types";
import { formatDate, formatPrice } from "@/lib/format";
import { accelSeconds, known, topFigure } from "@/lib/specs";
import { Counter, Reveal } from "@/components/ui/reveal";
import { fuelSummary, transmissionSummary } from "@/components/vehicle/card-utils";
import { DetailSection } from "./section";
import { isEv, maxOf, pad2, seatsLabel } from "./utils";

/** Overview: editorial intro, numbered highlights and an animated key-spec strip. */
const STRIP_COLS: Record<number, string> = { 1: "xl:grid-cols-1", 2: "xl:grid-cols-2", 3: "xl:grid-cols-3", 4: "xl:grid-cols-4", 5: "xl:grid-cols-5", 6: "xl:grid-cols-6" };

const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** A factual opener for models without editorial copy, built from the catalogue data. */
function factualIntro(car: CarModel, brand: string) {
  const fuels = car.fuelTypes.map((f) => (f === "CNG" ? "CNG" : f.toLowerCase()));
  const gearboxes = car.transmissions.map((t) => (t === "Manual" || t === "Automatic" ? t.toLowerCase() : t));
  const n = car.variants.length;
  const price = car.priceMin === car.priceMax ? `at ${formatPrice(car.priceMin)}` : `from ${formatPrice(car.priceMin)} to ${formatPrice(car.priceMax)}`;
  const where = car.priceCity ? ` (ex-showroom ${car.priceCity})` : " (ex-showroom)";
  const power = car.fuelTypes.every((f) => f === "Electric") ? "an electric powertrain" : `${list(fuels)} ${fuels.length === 1 ? "power" : "powertrains"}`;
  const seats = list([...new Set(car.seats)].map(String)).replace(" and ", " or ");
  return `The ${brand} ${car.name} is on sale in India in ${n} ${n === 1 ? "variant" : "variants"}, priced ${price}${where}. It is offered with ${power}, ${list(gearboxes)} ${gearboxes.length === 1 ? "transmission" : "transmissions"}, and seating for ${seats}.`;
}

export function CarOverview({ car, index, brand }: { car: CarModel; index: string; brand?: string }) {
  const ev = isEv(car);
  const accel = accelSeconds(car.acceleration);
  const power = topFigure(car.power);
  const torque = topFigure(car.torque, ["Nm", "kgm"]);
  const cc = /\bcc\b/i.test(car.engine) ? maxOf(car.engine) : 0;
  const mileageUnit = /kmpl/.test(car.efficiency) ? " kmpl" : /km\/kg/.test(car.efficiency) ? " km/kg" : " kmpl";

  // Only published figures: a spec the maker doesn't publish is left out rather than shown as zero.
  type Tile = { label: string; value: number; decimals?: number; suffix: string; note?: string };
  const tiles: (Tile | null)[] = [
    ev && car.ev
      ? { label: "Battery", value: car.ev.batteryKwh, decimals: car.ev.batteryKwh % 1 ? 1 : 0, suffix: " kWh", note: "Largest pack" }
      : known(cc)
        ? { label: "Engine", value: cc, suffix: " cc", note: "Displacement, up to" }
        : null,
    power ? { label: "Power", value: power.value, decimals: power.value % 1 ? 1 : 0, suffix: power.unit ? ` ${power.unit}` : "", note: "Maximum" } : null,
    torque ? { label: "Torque", value: torque.value, decimals: torque.value % 1 ? 1 : 0, suffix: torque.unit ? ` ${torque.unit}` : "", note: "Maximum" } : null,
    known(car.efficiencyValue)
      ? ev
        ? { label: "Range", value: car.efficiencyValue, suffix: " km", note: car.ev?.rangeStandard ? `Claimed, ${car.ev.rangeStandard}` : "Claimed, per charge" }
        : { label: "Mileage", value: car.efficiencyValue, decimals: car.efficiencyValue % 1 ? 1 : 0, suffix: mileageUnit, note: "Best claimed" }
      : null,
    accel !== undefined ? { label: "0–100 km/h", value: accel, decimals: 1, suffix: " s", note: "Quickest variant" } : null,
    known(car.bootSpace) ? { label: "Boot space", value: car.bootSpace, suffix: " L", note: car.seats.some((s) => s > 5) ? "Third row up" : "Luggage volume" } : null,
  ];
  const strip = tiles.filter((s): s is Tile => s !== null);
  const intro = car.overview.trim() || factualIntro(car, brand ?? "");

  const glance: [string, string][] = [
    ["Body style", car.bodyType],
    ["Seating", `${seatsLabel(car.seats)} seats`],
    ["Fuel", fuelSummary(car)],
    ["Gearbox", transmissionSummary(car)],
    ["Safety", car.safetyAgency === "Not tested" ? "No NCAP result" : `${car.safetyRating}★ ${car.safetyAgency}`],
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
        <Reveal className={car.highlights.length ? "lg:col-span-7" : "lg:col-span-12"}>
          <p className="type-lead max-w-2xl text-ink/85">{intro}</p>
          <dl className="mt-10 grid max-w-2xl grid-cols-2 gap-x-8 sm:grid-cols-3">
            {glance.map(([label, value]) => (
              <div key={label} className="border-t border-line py-4">
                <dt className="text-[12px] text-muted">{label}</dt>
                <dd className="mt-1 text-[14px] font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </Reveal>

        {car.highlights.length > 0 && (
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
        )}
      </div>

      {strip.length > 0 && (
      <dl className={`mt-14 grid grid-cols-2 gap-px border border-line bg-line md:mt-20 md:grid-cols-3 ${STRIP_COLS[strip.length]}`}>
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
      )}
    </DetailSection>
  );
}
