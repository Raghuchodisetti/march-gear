"use client";

import { useMemo, useState } from "react";
import { isElectric } from "@/lib/catalog";
import { FUEL_PRICE } from "@/data/tools-assumptions";
import { formatINR, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SelectField } from "@/components/ui/field";
import { TextLink } from "@/components/ui/section-heading";
import { useCatalog } from "@/components/providers/catalog-provider";
import { niceTicks, parseAmount } from "./calc";
import { UnitField } from "./fields";
import { EstimateNote, LegendKey, Readout, StepLabel } from "./instrument";

const fmt1 = (n: number) => (Number.isFinite(n) ? n.toFixed(1) : "—");

export function MileageCalculator() {
  const { cars, brandName } = useCatalog();
  const { iceCars, carOptions } = useMemo(() => {
    const ice = cars
      .filter((c) => !isElectric(c))
      .sort((a, b) => `${brandName(a.brand)} ${a.name}`.localeCompare(`${brandName(b.brand)} ${b.name}`));
    return {
      iceCars: ice,
      carOptions: ice.map((c) => ({ value: c.slug, label: `${brandName(c.brand)} ${c.name} — claimed ${c.efficiencyValue} kmpl` })),
    };
  }, [cars, brandName]);
  const [slug, setSlug] = useState("hyundai-creta");
  const [distance, setDistance] = useState("412");
  const [litres, setLitres] = useState("24");
  const [price, setPrice] = useState(String(FUEL_PRICE.Petrol));
  const [monthly, setMonthly] = useState("1200");

  const car = iceCars.find((c) => c.slug === slug) ?? iceCars[0];
  const d = parseAmount(distance);
  const l = parseAmount(litres);
  const p = parseAmount(price);
  const mo = parseAmount(monthly);

  const errors = {
    distance: distance !== "" && !(d > 0) ? "Enter the distance on your trip meter" : undefined,
    litres: litres !== "" && !(l > 0) ? "Enter the litres you filled" : undefined,
    price: price !== "" && !(p > 0) ? "Enter a fuel price" : undefined,
  };

  const kmpl = d > 0 && l > 0 ? d / l : NaN;
  const costPerKm = Number.isFinite(kmpl) && p > 0 ? p / kmpl : NaN;
  const monthlyLitres = Number.isFinite(kmpl) && mo >= 0 ? mo / kmpl : NaN;
  const monthlyCost = Number.isFinite(monthlyLitres) && p > 0 ? monthlyLitres * p : NaN;
  const ratio = Number.isFinite(kmpl) ? kmpl / car.efficiencyValue : NaN;
  const implausible = Number.isFinite(kmpl) && kmpl > 60;

  const verdict = !Number.isFinite(ratio)
    ? "Enter your trip reading to compare against the claimed figure."
    : ratio >= 1
      ? "Better than the claimed figure — a light right foot and free-flowing roads."
      : ratio >= 0.75
        ? "Right in the typical real-world band of 75–95% of the claimed figure."
        : "Well below par. The tips below can recover 10–20%.";

  return (
    <section aria-label="Mileage calculator" className="py-14 md:py-20">
      <div className="container-x">
        <div className="grid grid-cols-1 gap-px overflow-hidden border border-line bg-line lg:grid-cols-[1fr_1.15fr]">
          <div className="space-y-10 bg-white p-6 md:p-10">
            <div>
              <StepLabel index="01">Your car</StepLabel>
              <SelectField className="mt-5" label="Model (for its claimed efficiency)" options={carOptions} value={slug} onChange={(e) => setSlug(e.target.value)} />
            </div>

            <div>
              <StepLabel index="02">Trip-meter reading</StepLabel>
              <p className="mt-3 text-[13px] leading-relaxed text-muted">Fill to the brim and reset the trip meter. Drive normally, then refill to the brim and note the litres.</p>
              <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
                <UnitField label="Distance driven" unit="km" value={distance} onChange={setDistance} error={errors.distance} decimals={false} />
                <UnitField
                  label="Fuel filled"
                  unit="litres"
                  value={litres}
                  onChange={setLitres}
                  error={errors.litres}
                  hint={implausible ? "That's unusually high — double-check the litres." : undefined}
                />
              </div>
            </div>

            <div>
              <StepLabel index="03">Costs</StepLabel>
              <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
                <UnitField label="Fuel price" prefix="₹" unit="per litre" value={price} onChange={setPrice} error={errors.price} />
                <UnitField label="Monthly distance" unit="km" value={monthly} onChange={setMonthly} decimals={false} />
              </div>
            </div>
          </div>

          <div className="flex flex-col bg-mist p-6 md:p-10">
            <Readout
              size="hero"
              live
              label="Real-world efficiency"
              value={fmt1(kmpl)}
              unit="kmpl"
              caption={Number.isFinite(kmpl) ? `${formatNumber(d)} km on ${l} litres` : "Waiting for a valid trip reading"}
            />

            <div className="mt-10 grid grid-cols-3 gap-4 border-t border-line pt-8">
              <Readout size="sm" label="Per km" value={Number.isFinite(costPerKm) ? `₹${costPerKm.toFixed(2)}` : "—"} />
              <Readout size="sm" label="Per month" value={Number.isFinite(monthlyCost) ? formatINR(monthlyCost) : "—"} />
              <Readout size="sm" label="Fuel / month" value={Number.isFinite(monthlyLitres) ? `${Math.round(monthlyLitres)} L` : "—"} />
            </div>

            <div className="mt-10 border-t border-line pt-8">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="type-h4">Against the claimed figure</p>
                {Number.isFinite(ratio) && <p className="text-[13px] font-medium num">{Math.round(ratio * 100)}% of claimed</p>}
              </div>
              <DualBar claimed={car.efficiencyValue} actual={kmpl} carName={`${brandName(car.brand)} ${car.name}`} className="mt-6" />
              <p className={cn("mt-6 text-[14px] leading-relaxed", Number.isFinite(ratio) && ratio < 0.75 ? "text-ink" : "text-muted")}>{verdict}</p>
            </div>

            <div className="mt-auto flex flex-col gap-4 pt-10">
              <TextLink href="/tools/ev-vs-petrol">See what an EV would cost per km</TextLink>
              <EstimateNote>Illustrative estimate. One tank is a small sample — average three fills for a dependable figure.</EstimateNote>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DualBar({ claimed, actual, carName, className }: { claimed: number; actual: number; carName: string; className?: string }) {
  const has = Number.isFinite(actual);
  const ticks = niceTicks(0, Math.max(claimed, has ? actual : 0) * 1.05, 4);
  const top = ticks[ticks.length - 1];
  const pct = (v: number) => `${Math.min(100, (v / top) * 100)}%`;
  const rows = [
    { key: "claimed", label: "Claimed", value: claimed, bar: "bg-ink" },
    { key: "actual", label: "Your drive", value: has ? actual : 0, bar: "bg-red" },
  ];
  return (
    <div className={className}>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <LegendKey swatch="bg-ink" label={`Claimed · ${carName}`} />
        <LegendKey swatch="bg-red" label="Your trip" />
      </div>
      <div className="mt-6 grid grid-cols-[76px_1fr_56px] items-center gap-x-4 gap-y-4">
        {rows.map((row) => (
          <div key={row.key} className="contents">
            <span className="text-[12.5px] text-muted">{row.label}</span>
            <div className="relative h-5">
              {ticks.slice(1, -1).map((t) => (
                <span key={t} aria-hidden className="absolute inset-y-[-8px] w-px bg-line" style={{ left: pct(t) }} />
              ))}
              <div
                role="img"
                aria-label={`${row.label}: ${row.key === "actual" && !has ? "not available" : `${row.value.toFixed(1)} kmpl`}`}
                className={cn("relative h-full rounded-r-[4px] transition-[width] duration-500 ease-[var(--ease-premium)]", row.bar)}
                style={{ width: pct(row.value) }}
              />
            </div>
            <span className="text-right text-[14px] font-semibold num">{row.key === "actual" && !has ? "—" : row.value.toFixed(1)}</span>
          </div>
        ))}
        <span />
        <div className="relative h-4">
          {ticks.map((t, i) => (
            <span
              key={t}
              className={cn("absolute top-0 text-[11px] text-muted num", i === 0 ? "" : i === ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2")}
              style={{ left: pct(t) }}
            >
              {t}
            </span>
          ))}
        </div>
        <span className="text-right text-[11px] text-muted">kmpl</span>
      </div>
    </div>
  );
}
