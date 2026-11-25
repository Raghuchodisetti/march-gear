"use client";

import { CarImage } from "@/components/vehicle/car-image";
import { useMemo, useState } from "react";
import type { CarLite } from "@/types";
import { carTitle, isElectric } from "@/lib/catalog";
import { formatINR, formatNumber, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RangeField, Segmented, SelectField } from "@/components/ui/field";
import { Eyebrow, TextLink } from "@/components/ui/section-heading";
import { useCity } from "@/components/providers/app-provider";
import { useCatalog } from "@/components/providers/catalog-provider";
import { calcRates, ownershipCost, splitPrice } from "./calc";
import { Switch } from "./fields";
import { EstimateNote, Readout, StepLabel } from "./instrument";

/** 0.03 → "3%", 0.025 → "2.5%" */
const pct = (fraction: number) => `${Number((fraction * 100).toFixed(1))}%`;

type PartKey = "depreciation" | "fuel" | "interest" | "insurance" | "maintenance" | "registration";

export function OwnershipCost() {
  const { city } = useCity();
  const { cars, getCar, brandName, cities, getCity, onRoadPrice, content } = useCatalog();
  const rates = useMemo(() => calcRates(content.toolRates), [content.toolRates]);
  const cityOptions = useMemo(() => cities.map((c) => ({ value: c.slug, label: `${c.name}, ${c.state}` })), [cities]);
  const title = (c: CarLite) => carTitle(c, brandName);
  const carOptions = useMemo(
    () =>
      [...cars]
        // Running costs need a claimed mileage (or an EV range): models without one are left out.
        .filter((c) => (isElectric(c) ? Boolean(c.ev?.rangeKm) : c.efficiencyValue > 0))
        .sort((a, b) => carTitle(a, brandName).localeCompare(carTitle(b, brandName)))
        .map((c) => ({ value: c.slug, label: carTitle(c, brandName) })),
    [cars, brandName],
  );
  const [slug, setSlug] = useState("hyundai-creta");
  // Follows the visitor's preferred city until they pick one here.
  const [cityChoice, setCityChoice] = useState<string | null>(null);
  const [km, setKm] = useState(12_000);
  const [years, setYears] = useState<"3" | "5" | "7">("5");
  const [finance, setFinance] = useState(false);
  const [downPct, setDownPct] = useState(20);
  const [rate, setRate] = useState(9.25);
  const [active, setActive] = useState<PartKey | null>(null);

  const citySlug = cityChoice ?? city.slug;
  const car = getCar(slug) ?? cars[0];
  const n = Number(years);
  const r = ownershipCost({ car, citySlug, kmPerYear: km, years: n, finance: { enabled: finance, downPct, ratePct: rate }, rates, onRoadPrice });
  const [figure, unit] = splitPrice(r.total);

  const allParts: { key: PartKey; label: string; swatch: string; value: number; note: string }[] = [
      { key: "depreciation", label: "Depreciation", swatch: "bg-red", value: r.components.depreciation, note: "Ex-showroom value lost by resale" },
      { key: "fuel", label: r.ev ? "Charging" : "Fuel", swatch: "bg-ink", value: r.components.fuel, note: `₹${r.runningPerKm.toFixed(2)} per km` },
      { key: "interest", label: "Loan interest", swatch: "bg-ink/70", value: r.components.interest, note: `${downPct}% down · ${rate.toFixed(2)}%` },
      { key: "insurance", label: "Insurance", swatch: "bg-ink/45", value: r.components.insurance, note: `~${pct(rates.insuranceRate)} of value, falling yearly` },
      { key: "maintenance", label: "Servicing & wear", swatch: "bg-ink/25", value: r.components.maintenance, note: `Rises ~${pct(rates.maintenanceGrowth)} a year with age` },
      { key: "registration", label: "Registration & road tax", swatch: "bg-ink/12", value: r.components.registration, note: "Paid once, in the on-road price" },
  ];
  const parts = allParts.filter((p) => p.value > 0);

  const activePart = parts.find((p) => p.key === active);

  return (
    <>
      <section aria-label="Ownership cost calculator" className="py-14 md:py-20">
        <div className="container-x">
          <div className="grid grid-cols-1 gap-px overflow-hidden border border-line bg-line lg:grid-cols-12">
            {/* Inputs */}
            <div className="space-y-9 bg-white p-6 md:p-8 lg:col-span-4">
              <div className="space-y-5">
                <StepLabel index="01">The car</StepLabel>
                <SelectField label="Model" options={carOptions} value={slug} onChange={(e) => setSlug(e.target.value)} />
                <SelectField label="Registration city" options={cityOptions} value={citySlug} onChange={(e) => setCityChoice(e.target.value)} />
              </div>

              <div className="space-y-8 border-t border-line pt-9">
                <StepLabel index="02">Your usage</StepLabel>
                <RangeField label="Distance per year" value={km} min={5_000} max={40_000} step={1_000} onChange={setKm} format={(v) => `${formatNumber(v)} km`} minLabel="5,000" maxLabel="40,000" />
                <div>
                  <p className="mb-3 text-[13px] text-muted">Ownership period</p>
                  <Segmented
                    ariaLabel="Ownership period in years"
                    className="flex w-full"
                    options={[
                      { value: "3", label: "3 years" },
                      { value: "5", label: "5 years" },
                      { value: "7", label: "7 years" },
                    ]}
                    value={years}
                    onChange={setYears}
                  />
                </div>
              </div>

              <div className="space-y-8 border-t border-line pt-9">
                <StepLabel index="03">Finance</StepLabel>
                <Switch checked={finance} onChange={setFinance} label="Finance this car" description={`A loan over the full ${n}-year period, on the on-road price.`} />
                {finance && (
                  <>
                    <RangeField label="Down payment" value={downPct} min={10} max={90} step={5} onChange={setDownPct} format={(v) => `${v}%`} minLabel="10%" maxLabel="90%" />
                    <RangeField label="Interest rate (p.a.)" value={rate} min={7} max={16} step={0.25} onChange={setRate} format={(v) => `${v.toFixed(2)}%`} minLabel="7%" maxLabel="16%" />
                  </>
                )}
              </div>
            </div>

            {/* Results */}
            <div className="min-w-0 bg-white p-6 md:p-10 lg:col-span-8">
              <div className="flex items-center gap-4 border-b border-line pb-6">
                <div className="relative h-14 w-20 shrink-0 overflow-hidden bg-mist">
                  <CarImage car={car} alt="" sizes="80px" className="object-cover" style={{ objectPosition: car.focus ?? "50% 55%" }} />
                </div>
                <div className="min-w-0">
                  <p className="type-h4 truncate">{title(car)}</p>
                  <p className="mt-0.5 text-[12.5px] text-muted num">
                    {getCity(citySlug).name} · {n} years · {formatNumber(km)} km/yr
                  </p>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-[1.4fr_1fr]">
                <Readout size="hero" live label={`True cost over ${n} years`} value={figure} unit={unit} caption={`On-road ${formatPrice(r.onRoad)} · resale ~${formatPrice(r.resale)}`} />
                <div className="grid grid-cols-2 gap-6 md:grid-cols-1 md:gap-5 md:border-l md:border-line md:pl-8">
                  <Readout size="md" label="Per km" value={`₹${r.perKm.toFixed(1)}`} />
                  <Readout size="md" label="Per month" value={formatINR(r.perMonth)} />
                </div>
              </div>

              {/* Stacked share bar */}
              <div className="mt-12">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="type-h4">Where the money goes</p>
                  <p className="min-h-[1.25rem] text-right text-[12.5px] text-muted num" aria-live="polite">
                    {activePart ? `${activePart.label} · ${formatPrice(activePart.value)} · ${Math.round((activePart.value / r.total) * 100)}%` : "Hover or tap a segment"}
                  </p>
                </div>
                <div className="mt-4 flex h-6 gap-[2px]" onPointerLeave={() => setActive(null)}>
                  {parts.map((p) => (
                    <span
                      key={p.key}
                      tabIndex={0}
                      role="img"
                      aria-label={`${p.label}: ${formatPrice(p.value)}, ${Math.round((p.value / r.total) * 100)}%`}
                      onPointerEnter={() => setActive(p.key)}
                      onFocus={() => setActive(p.key)}
                      onBlur={() => setActive(null)}
                      className={cn(
                        "h-full min-w-[3px] transition-[width,opacity] duration-500 ease-[var(--ease-premium)] first:rounded-l-[2px] last:rounded-r-[2px] focus-visible:outline-offset-4",
                        p.swatch,
                        active && active !== p.key && "opacity-30",
                      )}
                      style={{ width: `${(p.value / r.total) * 100}%` }}
                    />
                  ))}
                </div>
                <ul className="mt-8 grid grid-cols-1 gap-x-10 sm:grid-cols-2">
                  {parts.map((p) => (
                    <li
                      key={p.key}
                      onPointerEnter={() => setActive(p.key)}
                      onPointerLeave={() => setActive(null)}
                      className={cn("flex items-start justify-between gap-4 border-t border-line py-3.5 transition-opacity duration-[250ms]", active && active !== p.key && "opacity-45")}
                    >
                      <span className="flex min-w-0 items-start gap-2.5">
                        <span aria-hidden className={cn("mt-1.5 size-2.5 shrink-0 rounded-[1px]", p.swatch, p.key === "registration" && "ring-1 ring-inset ring-ink/10")} />
                        <span className="min-w-0">
                          <span className="block text-[14px] font-medium">{p.label}</span>
                          <span className="block text-[12px] text-muted">{p.note}</span>
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[14px] font-semibold num">{formatPrice(p.value)}</span>
                        <span className="block text-[12px] text-muted num">{Math.round((p.value / r.total) * 100)}%</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {finance && (
                <p className="mt-6 border-l-2 border-red bg-mist px-4 py-3 text-[13px] text-ink num">
                  Down payment {formatINR(r.downPayment)} · loan {formatINR(r.loanAmount)} · EMI {formatINR(r.emi)}/mo for {n} years
                </p>
              )}

              <EstimateNote className="mt-8">
                Illustrative estimate based on the entry variant&apos;s indicative ex-showroom price, rounded segment averages and a typical resale curve.
                Excludes tyres, accessories, tolls and parking.
              </EstimateNote>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="yearly-heading" className="border-t border-line py-14 md:py-20">
        <div className="container-x">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <Eyebrow>Year by year</Eyebrow>
              <h2 id="yearly-heading" className="type-h2 mt-5 text-balance">
                The running total, <span className="type-editorial">itemised</span>
              </h2>
            </div>
            <TextLink href={`/cars/${car.slug}`}>Explore the {car.name}</TextLink>
          </div>

          <div className="mt-12 overflow-x-auto">
            <table className="w-full min-w-[760px] text-[13.5px] num">
              <caption className="sr-only">
                Yearly ownership cost for the {title(car)} in {getCity(citySlug).name}
              </caption>
              <thead>
                <tr className="border-b border-ink text-left text-[11.5px] uppercase tracking-[0.12em] text-muted">
                  <th scope="col" className="py-3 pr-4 font-medium">Year</th>
                  <th scope="col" className="py-3 pr-4 text-right font-medium">{r.ev ? "Charging" : "Fuel"}</th>
                  <th scope="col" className="py-3 pr-4 text-right font-medium">Insurance</th>
                  <th scope="col" className="py-3 pr-4 text-right font-medium">Servicing</th>
                  {finance && <th scope="col" className="py-3 pr-4 text-right font-medium">Interest</th>}
                  <th scope="col" className="py-3 pr-4 text-right font-medium">Depreciation</th>
                  <th scope="col" className="py-3 pr-4 text-right font-medium text-ink">Year total</th>
                  <th scope="col" className="py-3 text-right font-medium">Value at year end</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-line">
                  <th scope="row" className="py-3.5 pr-4 text-left font-medium">Purchase</th>
                  <td colSpan={finance ? 5 : 4} className="py-3.5 pr-4 text-right text-muted">
                    Registration, road tax &amp; handling
                  </td>
                  <td className="py-3.5 pr-4 text-right font-semibold">{formatINR(r.registration)}</td>
                  <td className="py-3.5 text-right">{formatINR(r.exShowroom)}</td>
                </tr>
                {r.rows.map((row) => (
                  <tr key={row.year} className="border-b border-line">
                    <th scope="row" className="py-3.5 pr-4 text-left font-medium">{row.year}</th>
                    <td className="py-3.5 pr-4 text-right">{formatINR(row.fuel)}</td>
                    <td className="py-3.5 pr-4 text-right">{formatINR(row.insurance)}</td>
                    <td className="py-3.5 pr-4 text-right">{formatINR(row.maintenance)}</td>
                    {finance && <td className="py-3.5 pr-4 text-right">{formatINR(row.interest)}</td>}
                    <td className="py-3.5 pr-4 text-right">{formatINR(row.depreciation)}</td>
                    <td className="py-3.5 pr-4 text-right font-semibold">{formatINR(row.total)}</td>
                    <td className="py-3.5 text-right text-muted">{formatINR(row.value)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" className="pt-4 pr-4 text-left font-semibold">Total</th>
                  <td className="pt-4 pr-4 text-right font-semibold">{formatINR(r.components.fuel)}</td>
                  <td className="pt-4 pr-4 text-right font-semibold">{formatINR(r.components.insurance)}</td>
                  <td className="pt-4 pr-4 text-right font-semibold">{formatINR(r.components.maintenance)}</td>
                  {finance && <td className="pt-4 pr-4 text-right font-semibold">{formatINR(r.components.interest)}</td>}
                  <td className="pt-4 pr-4 text-right font-semibold">{formatINR(r.components.depreciation)}</td>
                  <td className="pt-4 pr-4 text-right font-semibold text-red">{formatINR(r.total)}</td>
                  <td className="pt-4 text-right text-muted">{formatINR(r.resale)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-5 text-[12px] text-muted">First-year insurance is bundled into the on-road price and shown in year 1.</p>
        </div>
      </section>
    </>
  );
}
