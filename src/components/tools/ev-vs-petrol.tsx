"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowUpRight, Zap } from "lucide-react";
import type { CarModel } from "@/types";
import { carTitle, isElectric } from "@/lib/catalog";
import { CO2_PER_KWH, CO2_PER_LITRE, FUEL_PRICE, HOME_TARIFF, TREE_KG_PER_YEAR } from "@/data/tools-assumptions";
import { formatINR, formatNumber, formatPrice, formatPriceShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RangeField, SelectField } from "@/components/ui/field";
import { useCatalog } from "@/components/providers/catalog-provider";
import { evKwhPerKm, evVsIce, formatYears, iceKmpl, splitPrice } from "./calc";
import { CostLineChart } from "./cost-line-chart";
import { EstimateNote, Readout, StepLabel } from "./instrument";

export function EvVsPetrol() {
  const { cars, electricCars, brandName } = useCatalog();
  const { evs, ices } = useMemo(() => {
    const byName = (a: CarModel, b: CarModel) => carTitle(a, brandName).localeCompare(carTitle(b, brandName));
    return { evs: electricCars().sort(byName), ices: cars.filter((c) => !isElectric(c)).sort(byName) };
  }, [cars, electricCars, brandName]);
  const [evSlug, setEvSlug] = useState("tata-nexon-ev");
  const [iceSlug, setIceSlug] = useState("hyundai-creta");
  const [dailyKm, setDailyKm] = useState(40);
  const [years, setYears] = useState(5);
  const [tariff, setTariff] = useState(HOME_TARIFF);
  const [fuelPrice, setFuelPrice] = useState(FUEL_PRICE.Petrol);
  const [showTable, setShowTable] = useState(false);

  const ev = evs.find((c) => c.slug === evSlug) ?? evs[0];
  const ice = ices.find((c) => c.slug === iceSlug) ?? ices[0];
  const r = evVsIce({ ev, ice, dailyKm, years, tariff, fuelPrice });

  const [figure, unit] = splitPrice(Math.abs(r.savings));
  const co2Tonnes = r.co2AvoidedKg / 1000;
  const trees = r.co2AvoidedKg > 0 ? Math.round(r.co2AvoidedKg / (TREE_KG_PER_YEAR * years)) : 0;

  const breakEven = {
    "ev-always": { value: "Day one", caption: "Cheaper to buy and to run" },
    breakeven: { value: formatYears(r.breakEven ?? 0), caption: "Until the EV premium is paid back" },
    later: { value: `${years}+ yrs`, caption: `At this usage, about ${formatYears(r.breakEven ?? 0)}` },
    never: { value: "Not at these prices", caption: "EV running costs don't undercut" },
  }[r.status];

  return (
    <section aria-label="EV vs petrol calculator" className="py-14 md:py-20">
      <div className="container-x">
        {/* Match-up */}
        <div className="grid grid-cols-1 border border-line md:grid-cols-[1fr_auto_1fr]">
          <Contender
            car={ev}
            eyebrow={
              <>
                <Zap aria-hidden className="size-3 text-red" /> Electric
              </>
            }
            label="Electric car"
            options={evs}
            onChange={setEvSlug}
            facts={[formatPriceShort(ev.priceMin), `${ev.ev?.rangeKm ?? ev.efficiencyValue} km claimed`, `${ev.ev?.batteryKwh ?? "—"} kWh`]}
          />
          <div className="relative flex items-center justify-center py-1 md:px-0">
            <span aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-line md:inset-x-auto md:inset-y-0 md:left-1/2 md:top-0 md:h-auto md:w-px" />
            <span className="relative inline-flex size-11 items-center justify-center rounded-full border border-line bg-white font-display text-[13px] font-semibold uppercase tracking-[0.08em]">
              vs
            </span>
          </div>
          <Contender
            car={ice}
            eyebrow="Petrol · Diesel · Hybrid"
            label="Petrol, diesel or hybrid car"
            options={ices}
            onChange={setIceSlug}
            facts={[formatPriceShort(ice.priceMin), `${ice.efficiencyValue} kmpl claimed`, ice.fuelTypes.filter((f) => f !== "Electric").join(" / ")]}
          />
        </div>

        <div className="grid grid-cols-1 gap-px border-x border-b border-line bg-line lg:grid-cols-12">
          {/* Inputs */}
          <div className="space-y-9 bg-white p-6 md:p-8 lg:col-span-4">
            <StepLabel index="01">Your driving</StepLabel>
            <RangeField label="Daily distance" value={dailyKm} min={10} max={200} step={5} onChange={setDailyKm} format={(v) => `${v} km`} minLabel="10 km" maxLabel="200 km" />
            <RangeField label="Years of ownership" value={years} min={1} max={10} onChange={setYears} format={(v) => `${v} ${v === 1 ? "year" : "years"}`} minLabel="1" maxLabel="10" />
            <div className="border-t border-line pt-9">
              <StepLabel index="02">Energy prices</StepLabel>
            </div>
            <RangeField label="Electricity tariff" value={tariff} min={4} max={20} step={0.5} onChange={setTariff} format={(v) => `₹${v.toFixed(1)}/kWh`} minLabel="₹4" maxLabel="₹20 (public DC)" />
            <RangeField label="Fuel price" value={fuelPrice} min={80} max={130} step={1} onChange={setFuelPrice} format={(v) => `₹${v}/L`} minLabel="₹80" maxLabel="₹130" />
            <p className="text-[12.5px] leading-relaxed text-muted">
              Running {formatNumber(r.annualKm)} km a year. Home charging is usually ₹6–10/kWh; public fast chargers ₹18–24.
            </p>
          </div>

          {/* Results */}
          <div className="min-w-0 bg-white p-6 md:p-10 lg:col-span-8">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-[1.3fr_1fr]">
              <Readout
                size="hero"
                live
                label={r.savings >= 0 ? `You save over ${years} ${years === 1 ? "year" : "years"}` : `The EV costs more over ${years} ${years === 1 ? "year" : "years"}`}
                value={figure}
                unit={unit}
                caption="Purchase price plus energy, cumulative"
              />
              <Readout size="lg" label="Break-even" value={breakEven.value} caption={breakEven.caption} className="sm:pt-1" />
            </div>

            <CostLineChart
              className="mt-12"
              series={r.series}
              evLabel={ev.name}
              iceLabel={ice.name}
              breakEven={r.status === "breakeven" ? r.breakEven : null}
            />

            <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 border-t border-line pt-8 md:grid-cols-4">
              <Readout size="sm" label="EV per km" value={`₹${r.evPerKm.toFixed(2)}`} caption={`${(evKwhPerKm(ev) * 100).toFixed(1)} kWh / 100 km`} />
              <Readout size="sm" label={`${ice.name} per km`} value={`₹${r.icePerKm.toFixed(2)}`} caption={`${iceKmpl(ice).toFixed(1)} kmpl real-world`} />
              <Readout size="sm" label="CO₂ avoided" value={co2Tonnes > 0 ? `${co2Tonnes.toFixed(1)} t` : "—"} caption={trees > 0 ? `≈ ${formatNumber(trees)} trees over ${years} yrs` : "No reduction"} />
              <Readout size="sm" label="Energy saved / yr" value={formatINR(Math.max(0, r.iceAnnual - r.evAnnual))} caption="Running cost difference" />
            </div>

            <div className="mt-10 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                aria-expanded={showTable}
                aria-controls="ev-table"
                onClick={() => setShowTable((v) => !v)}
                className="inline-flex items-center gap-2 self-start text-[13px] font-medium underline-offset-4 hover:underline"
              >
                {showTable ? "Hide" : "Show"} year-by-year table
              </button>
              <Link href={`/compare?cars=${ev.slug},${ice.slug}`} className="group/cmp inline-flex items-center gap-1.5 text-[13px] font-medium">
                Compare these two side by side
                <ArrowUpRight aria-hidden className="size-4 text-red transition-transform duration-[250ms] group-hover/cmp:-translate-y-0.5 group-hover/cmp:translate-x-0.5" />
              </Link>
            </div>

            {showTable && (
              <div id="ev-table" className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[440px] text-[13.5px] num">
                  <caption className="sr-only">Cumulative cost by year</caption>
                  <thead>
                    <tr className="border-b border-ink text-left text-[11.5px] uppercase tracking-[0.12em] text-muted">
                      <th scope="col" className="py-3 pr-4 font-medium">Year</th>
                      <th scope="col" className="py-3 pr-4 text-right font-medium">{ev.name}</th>
                      <th scope="col" className="py-3 pr-4 text-right font-medium">{ice.name}</th>
                      <th scope="col" className="py-3 text-right font-medium">EV ahead by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.series.map((p) => (
                      <tr key={p.year} className="border-b border-line">
                        <th scope="row" className="py-3 pr-4 text-left font-medium">{p.year === 0 ? "Purchase" : p.year}</th>
                        <td className="py-3 pr-4 text-right">{formatPrice(p.ev)}</td>
                        <td className="py-3 pr-4 text-right">{formatPrice(p.ice)}</td>
                        <td className={cn("py-3 text-right", p.ice - p.ev < 0 && "text-muted")}>
                          {p.ice - p.ev < 0 ? "−" : ""}
                          {formatPrice(Math.abs(p.ice - p.ev))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <EstimateNote className="mt-8">
              Illustrative estimate. EV use = battery ÷ claimed range × 1.25; fuel economy = claimed × 0.85. CO₂ at {CO2_PER_LITRE} kg/L petrol vs{" "}
              {CO2_PER_KWH} kg/kWh grid. Excludes insurance, servicing, subsidies and resale.
            </EstimateNote>
          </div>
        </div>
      </div>
    </section>
  );
}

function Contender({
  car,
  eyebrow,
  label,
  options,
  onChange,
  facts,
}: {
  car: CarModel;
  eyebrow: ReactNode;
  label: string;
  options: CarModel[];
  onChange: (slug: string) => void;
  facts: string[];
}) {
  const { brandName } = useCatalog();
  const title = (c: CarModel) => carTitle(c, brandName);
  return (
    <div className="min-w-0">
      <div className="relative aspect-[2/1] overflow-hidden bg-mist md:aspect-[16/9]">
        <Image
          key={car.slug}
          src={car.images[0]}
          alt={title(car)}
          fill
          sizes="(min-width: 768px) 45vw, 100vw"
          className="object-cover"
          style={{ objectPosition: car.focus ?? "50% 55%" }}
        />
      </div>
      <div className="p-5 md:p-7">
        <p className="type-eyebrow inline-flex items-center gap-1.5 text-muted">{eyebrow}</p>
        <SelectField
          className="mt-4"
          label={label}
          options={options.map((c) => ({ value: c.slug, label: title(c) }))}
          value={car.slug}
          onChange={(e) => onChange(e.target.value)}
        />
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted num">
          {facts.map((f, i) => (
            <li key={`${f}-${i}`} className={cn(i === 0 && "font-medium text-ink")}>
              {i === 0 ? `From ${f}` : f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
