import type { CarModel, Variant } from "@/types";
import { getCatalog } from "@/server/catalog";
import { formatINR, formatNumber } from "@/lib/format";
import { TextLink } from "@/components/ui/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { Bar, RangeRing } from "./meters";
import { REAL_WORLD_FACTOR, efficiencyOf, parseAc, parseDc, sortedVariants } from "./utils";


function VariantBars({ variants, unit }: { variants: Variant[]; unit: string }) {
  const max = Math.max(...variants.map((v) => efficiencyOf(v).value));
  return (
    <ul className="space-y-6">
      {variants.map((v, i) => {
        const e = efficiencyOf(v);
        const best = e.value === max;
        return (
          <li key={v.slug}>
            <div className="mb-2.5 flex items-baseline justify-between gap-4">
              <p className="min-w-0">
                <span className="block truncate text-[14px] font-medium">{v.name}</span>
                <span className="text-[12px] text-muted">
                  {v.fuel} · {v.transmission}
                </span>
              </p>
              <p className="shrink-0 text-right">
                <span className="font-display text-[22px] font-semibold tracking-[-0.02em] num">{e.value}</span>
                <span className="ml-1 text-[12px] text-muted">{unit}</span>
              </p>
            </div>
            <Bar value={e.value} max={max} delay={i * 0.07} barClassName={best ? "bg-red" : "bg-ink"} />
          </li>
        );
      })}
    </ul>
  );
}

/** Mileage section for combustion and hybrid cars. */
export async function CarMileage({ car }: { car: CarModel }) {
  // Same fuel prices as the calculators (admin: Site content → Fuel prices & finance rates).
  const { fuelPrices } = (await getCatalog()).content.toolRates;
  const FUEL_PRICE: Record<string, { price: number; unit: string }> = {
    Petrol: { price: fuelPrices.petrol, unit: "L" },
    Hybrid: { price: fuelPrices.hybrid, unit: "L" },
    Diesel: { price: fuelPrices.diesel, unit: "L" },
    CNG: { price: fuelPrices.cng, unit: "kg" },
  };
  const variants = sortedVariants(car);
  const groups = Array.from(new Set(variants.map((v) => efficiencyOf(v).unit))).map((unit) => ({
    unit,
    variants: variants.filter((v) => efficiencyOf(v).unit === unit),
  }));
  const liquid = variants.filter((v) => efficiencyOf(v).unit === "kmpl");
  const best = [...(liquid.length ? liquid : variants)].sort((a, b) => efficiencyOf(b).value - efficiencyOf(a).value)[0];
  const bestEff = efficiencyOf(best);
  const fuel = FUEL_PRICE[best.fuel] ?? FUEL_PRICE.Petrol;
  const monthlyCost = (1000 / bestEff.value) * fuel.price;

  const stats = [
    { label: "Best claimed", value: `${bestEff.value} ${bestEff.unit}`, note: best.name },
    { label: "Real-world, city", value: `≈ ${(bestEff.value * 0.72).toFixed(1)} ${bestEff.unit}`, note: "Heavy traffic, AC on" },
    { label: "Real-world, highway", value: `≈ ${(bestEff.value * 0.92).toFixed(1)} ${bestEff.unit}`, note: "Steady 80–100 km/h" },
    ...(car.fuelTank && bestEff.unit === "kmpl"
      ? [{ label: "Range per tank", value: `≈ ${formatNumber(Math.round(car.fuelTank * bestEff.value * 0.8))} km`, note: `${car.fuelTank}-litre tank, real-world` }]
      : []),
    {
      label: "Fuel cost / 1,000 km",
      value: formatINR(monthlyCost),
      note: `${best.fuel} at ₹${fuel.price}/${fuel.unit}`,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10">
      <Reveal className="space-y-12 lg:col-span-7">
        {groups.map((g) => (
          <div key={g.unit}>
            {groups.length > 1 && <h3 className="type-eyebrow mb-6 text-muted">Claimed · {g.unit}</h3>}
            <VariantBars variants={g.variants} unit={g.unit} />
          </div>
        ))}
      </Reveal>
      <Reveal delay={0.1} className="lg:col-span-5">
        <dl className="grid grid-cols-2 gap-px border border-line bg-line">
          {stats.map((s, i) => (
            <div key={s.label} className={i === 0 ? "col-span-2 bg-ink p-6 text-white" : "bg-white p-5"}>
              <dt className={i === 0 ? "type-eyebrow text-white/55" : "text-[12px] text-muted"}>{s.label}</dt>
              <dd className={i === 0 ? "type-h2 mt-4 num" : "mt-2 text-[18px] font-semibold num"}>{s.value}</dd>
              <dd className={i === 0 ? "mt-2 text-[12.5px] text-white/55" : "mt-1 text-[12px] text-muted"}>{s.note}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[12px] text-muted">
          Claimed figures are manufacturer-declared test results; real-world estimates are indicative and depend on driving style, load and conditions.
        </p>
      </Reveal>
    </div>
  );
}

/** Range section for electric cars. */
export function CarRange({ car }: { car: CarModel }) {
  if (!car.ev) return null;
  const variants = sortedVariants(car);
  const realWorld = Math.round(car.ev.rangeKm * REAL_WORLD_FACTOR);
  const dc = parseDc(car.ev.dcCharge);
  const ac = parseAc(car.ev.acCharge);

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10">
      <Reveal className="mx-auto w-full max-w-[340px] lg:col-span-5 lg:max-w-[400px]">
        <RangeRing range={car.ev.rangeKm} realWorld={realWorld} />
        <div className="mt-6 flex justify-center gap-6 text-[12px] text-muted">
          <span className="flex items-center gap-2">
            <span aria-hidden className="h-[3px] w-4 bg-red" /> Claimed
          </span>
          <span className="flex items-center gap-2">
            <span aria-hidden className="h-[3px] w-4 bg-ink" /> Real-world estimate
          </span>
        </div>
      </Reveal>
      <Reveal delay={0.1} className="lg:col-span-7">
        <dl className="grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-3">
          <div className="bg-white p-5">
            <dt className="text-[12px] text-muted">Battery</dt>
            <dd className="mt-2 text-[22px] font-semibold num">{car.ev.batteryKwh} kWh</dd>
          </div>
          <div className="bg-white p-5">
            <dt className="text-[12px] text-muted">DC fast charge</dt>
            <dd className="mt-2 text-[22px] font-semibold num">{dc.minutes} min</dd>
            <dd className="text-[12px] text-muted">{dc.window}</dd>
          </div>
          <div className="bg-white p-5">
            <dt className="text-[12px] text-muted">AC home charge</dt>
            <dd className="mt-2 text-[22px] font-semibold num">{ac.hours} h</dd>
            <dd className="text-[12px] text-muted">{ac.power} wallbox</dd>
          </div>
        </dl>
        <h3 className="type-eyebrow mb-6 mt-10 text-muted">Claimed range by variant</h3>
        <VariantBars variants={variants} unit="km" />
        <div className="mt-10">
          <TextLink href={`/electric-cars/${car.slug}`}>Explore charging, range and running costs</TextLink>
        </div>
      </Reveal>
    </div>
  );
}
