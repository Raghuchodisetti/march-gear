"use client";

import { useState } from "react";
import { Fuel, Zap } from "lucide-react";
import { formatINR } from "@/lib/format";
import { RangeField } from "@/components/ui/field";
import { Counter } from "@/components/ui/reveal";
import { useCatalog } from "@/components/providers/catalog-provider";
import { Bar } from "./meters";
import { REAL_WORLD_FACTOR } from "./utils";

const PETROL_KMPL = 15;

/** Home-charging running cost vs an equivalent petrol car. */
export function EvCostCalculator({ batteryKwh, rangeKm, name }: { batteryKwh: number; rangeKm: number; name: string }) {
  const [kmPerDay, setKmPerDay] = useState(40);
  // Home tariff and petrol price from the admin-editable rates.
  const { homeTariff: TARIFF, fuelPrices } = useCatalog().content.toolRates;
  const PETROL = fuelPrices.petrol;
  const kwhPerKm = batteryKwh / (rangeKm * REAL_WORLD_FACTOR);
  const monthlyKm = kmPerDay * 30;
  const evMonthly = monthlyKm * kwhPerKm * TARIFF;
  const petrolMonthly = (monthlyKm / PETROL_KMPL) * PETROL;
  const saving = Math.max(0, petrolMonthly - evMonthly);

  return (
    <div className="grid grid-cols-1 gap-px bg-white/10 lg:grid-cols-12">
      <div className="bg-ink-2 p-6 md:p-10 lg:col-span-5">
        <RangeField
          tone="light"
          label="Distance you drive per day"
          value={kmPerDay}
          min={10}
          max={200}
          step={5}
          onChange={setKmPerDay}
          format={(v) => `${v} km`}
          minLabel="10 km"
          maxLabel="200 km"
        />
        <dl className="mt-10 space-y-0 text-[13px]">
          {[
            ["Monthly distance", `${monthlyKm.toLocaleString("en-IN")} km`],
            ["Energy use (real-world)", `${(kwhPerKm * 100).toFixed(1)} kWh / 100 km`],
            ["Home electricity", `₹${TARIFF} per kWh`],
            ["Petrol comparison", `₹${PETROL}/L at ${PETROL_KMPL} kmpl`],
          ].map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-6 border-b border-white/10 py-3.5">
              <dt className="text-white/55">{label}</dt>
              <dd className="text-right font-medium num">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex flex-col bg-ink p-6 md:p-10 lg:col-span-7">
        <p className="type-eyebrow text-white/55">You save, every month</p>
        <p aria-hidden className="mt-4 font-display text-[clamp(2.75rem,2rem+3vw,4.75rem)] font-semibold leading-none tracking-[-0.035em] num">
          <Counter to={Math.round(saving)} prefix="₹" duration={0.6} />
        </p>
        <p className="sr-only" aria-live="polite">
          Estimated monthly saving {formatINR(saving)}
        </p>
        <p className="mt-3 text-[14px] text-white/60">
          <span className="num text-white">{formatINR(saving * 12)}</span> a year ·{" "}
          <span className="num text-white">{formatINR(saving * 60)}</span> over five years
        </p>

        <div className="mt-10 space-y-6">
          <div>
            <div className="mb-2.5 flex items-baseline justify-between gap-4 text-[14px]">
              <span className="flex items-center gap-2 font-medium">
                <Zap aria-hidden className="size-4 text-red" /> {name}, charged at home
              </span>
              <span className="shrink-0 font-semibold num">{formatINR(evMonthly)}/mo</span>
            </div>
            <Bar value={evMonthly} max={petrolMonthly} className="h-2.5" trackClassName="bg-white/[0.06]" barClassName="bg-red" />
            <p className="mt-2 text-[12px] text-white/45 num">₹{(kwhPerKm * TARIFF).toFixed(2)} per km</p>
          </div>
          <div>
            <div className="mb-2.5 flex items-baseline justify-between gap-4 text-[14px]">
              <span className="flex items-center gap-2 font-medium">
                <Fuel aria-hidden className="size-4 text-white/60" /> Equivalent petrol car
              </span>
              <span className="shrink-0 font-semibold num">{formatINR(petrolMonthly)}/mo</span>
            </div>
            <Bar value={petrolMonthly} max={petrolMonthly} className="h-2.5" trackClassName="bg-white/[0.06]" barClassName="bg-white/80" />
            <p className="mt-2 text-[12px] text-white/45 num">₹{(PETROL / PETROL_KMPL).toFixed(2)} per km</p>
          </div>
        </div>
        <p className="mt-auto pt-10 text-[11.5px] text-white/40">
          Illustrative energy costs only. Public DC charging typically costs ₹18–25 per kWh; excludes maintenance, insurance and depreciation.
        </p>
      </div>
    </div>
  );
}
