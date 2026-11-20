"use client";

import { useMemo, type ReactNode } from "react";
import { ChevronDown, Info } from "lucide-react";
import { INDICATIVE_NOTE } from "@/insurance/labels";
import { effectiveNcb, estimatePremium, vehicleAgeMonths, type EstimateAddOnInput, type PricingConfig } from "@/insurance/estimator";
import type { FuelName, PremiumEstimate, ProductPricing } from "@/insurance/types";
import { NCB_OPTIONS } from "@/insurance/search";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────
   A catalogue-car picker and the indicative estimate breakdown,
   shared by the product review's sample estimate and the pricing
   calculator. Everything shown is an indicative estimate.
   ────────────────────────────────────────────────────────────── */

/** Mirrors EstimateCar in src/server/admin/insurance.ts (client-safe copy of the shape). */
export interface PickerCar {
  slug: string;
  name: string;
  brand: string;
  brandName: string;
  bodyType: string;
  isLuxury: boolean;
  engineCc: number | null;
  motorKw: number | null;
  variants: { slug: string; name: string; fuel: string; price: number }[];
}

export interface VehicleChoice {
  car: string;
  variant: string;
  /** Manufacturing year; ignored for a new car. */
  year: number;
  isNew: boolean;
  ncb: number;
}

export const firstChoice = (cars: PickerCar[], today: string): VehicleChoice => {
  // A mid-range petrol car makes the most representative default.
  const car = cars.find((c) => c.variants.some((v) => v.fuel === "Petrol" && v.price >= 800_000 && v.price <= 1_500_000)) ?? cars[0];
  const variant = car?.variants.find((v) => v.fuel === "Petrol" && v.price >= 800_000) ?? car?.variants[0];
  return { car: car?.slug ?? "", variant: variant?.slug ?? "", year: Number(today.slice(0, 4)) - 2, isNew: false, ncb: 25 };
};

const select = "h-10 w-full cursor-pointer appearance-none rounded-[3px] border border-line bg-white pl-3 pr-9 text-[13.5px] outline-none transition-colors hover:border-ink/30 focus:border-ink disabled:cursor-not-allowed disabled:bg-mist";

function Select({ label, value, onChange, children, disabled, className }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode; disabled?: boolean; className?: string }) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="mb-1.5 block text-[12px] font-medium text-muted">{label}</span>
      <span className="relative block">
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={select}>
          {children}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
      </span>
    </label>
  );
}

/** Brand → model → variant, year (or new) and NCB. */
export function VehiclePicker({ cars, value, onChange, maxAgeYears, today, compact }: { cars: PickerCar[]; value: VehicleChoice; onChange: (v: VehicleChoice) => void; maxAgeYears: number; today: string; compact?: boolean }) {
  const brands = useMemo(() => [...new Map(cars.map((c) => [c.brand, c.brandName])).entries()], [cars]);
  const car = cars.find((c) => c.slug === value.car) ?? cars[0];
  const brand = car?.brand ?? "";
  const thisYear = Number(today.slice(0, 4));
  const years = Array.from({ length: Math.max(1, maxAgeYears) + 1 }, (_, i) => thisYear - i);
  const set = (patch: Partial<VehicleChoice>) => onChange({ ...value, ...patch });
  const pickCar = (slug: string) => {
    const c = cars.find((x) => x.slug === slug);
    set({ car: slug, variant: c?.variants[0]?.slug ?? "" });
  };
  if (!cars.length) return <p className="text-[13px] text-muted">The catalogue has no cars with variant prices yet.</p>;
  return (
    <div className={cn("grid grid-cols-1 gap-3", compact ? "" : "sm:grid-cols-2")}>
      <Select label="Brand" value={brand} onChange={(b) => pickCar(cars.find((c) => c.brand === b)?.slug ?? "")}>
        {brands.map(([slug, name]) => (
          <option key={slug} value={slug}>
            {name}
          </option>
        ))}
      </Select>
      <Select label="Model" value={car?.slug ?? ""} onChange={pickCar}>
        {cars
          .filter((c) => c.brand === brand)
          .map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
      </Select>
      <Select label="Variant" value={value.variant} onChange={(variant) => set({ variant })} className={compact ? "" : "sm:col-span-2"}>
        {car?.variants.map((v) => (
          <option key={v.slug} value={v.slug}>
            {v.name} · {v.fuel} · ₹{v.price.toLocaleString("en-IN")}
          </option>
        ))}
      </Select>
      <Select label="Manufacturing year" value={value.isNew ? "new" : String(value.year)} onChange={(y) => (y === "new" ? set({ isNew: true, ncb: 0 }) : set({ isNew: false, year: Number(y) }))}>
        <option value="new">New car (not registered yet)</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </Select>
      <Select label="No-claim bonus" value={String(value.isNew ? 0 : value.ncb)} onChange={(n) => set({ ncb: Number(n) })} disabled={value.isNew}>
        {NCB_OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n === 0 ? "None (0%)" : `${n}%`}
          </option>
        ))}
      </Select>
    </div>
  );
}

/** Runs the estimator for a picked car. */
export function estimateFor(choice: VehicleChoice, cars: PickerCar[], opts: { pricing: ProductPricing; paOwnerDriver: "included" | "optional" | "none"; includePa: boolean; addOns: EstimateAddOnInput[]; config: PricingConfig; today: string }) {
  const car = cars.find((c) => c.slug === choice.car);
  const variant = car?.variants.find((v) => v.slug === choice.variant) ?? car?.variants[0];
  if (!car || !variant) return null;
  const fuel = variant.fuel as FuelName;
  const ageMonths = vehicleAgeMonths(choice.isNew ? null : choice.year, choice.isNew, opts.today);
  const estimate = estimatePremium({
    exShowroom: variant.price,
    ageMonths,
    isNew: choice.isNew,
    fuel,
    engineCc: car.engineCc,
    motorKw: car.motorKw,
    ncbPct: effectiveNcb(choice.ncb, { isNew: choice.isNew, claimed: false, lapsedLong: false }, opts.config),
    pricing: opts.pricing,
    paOwnerDriver: opts.paOwnerDriver,
    includePa: opts.includePa,
    addOns: opts.addOns,
    config: opts.config,
  });
  return { car, variant, ageMonths, estimate };
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function Row({ label, value, muted, strong, negative }: { label: ReactNode; value: number | string; muted?: boolean; strong?: boolean; negative?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-1.5 text-[13px]", strong && "text-[14px] font-semibold", muted && "text-muted")}>
      <dt className="min-w-0">{label}</dt>
      <dd className="shrink-0 num">{typeof value === "number" ? `${negative && value ? "− " : ""}${inr(value)}` : value}</dd>
    </div>
  );
}

/** The estimate's lines, always labelled indicative. */
export function EstimateBreakdown({ estimate, extraNote, terms = true }: { estimate: PremiumEstimate; extraNote?: string; terms?: boolean }) {
  const e = estimate;
  return (
    <div>
      <div className="flex items-end justify-between gap-3 border-b border-line pb-3">
        <div>
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-muted">Indicative premium</p>
          <p className="mt-1 font-display text-[30px] font-semibold leading-none tracking-[-0.03em] num">{inr(e.total)}</p>
        </div>
        {terms && (
          <p className="text-right text-[12px] text-muted">
            {e.odYears ? `${e.odYears}-yr own damage` : "No own damage"}
            <br />
            {e.tpYears ? `${e.tpYears}-yr third party` : "No third party"}
          </p>
        )}
      </div>
      <dl className="mt-2 divide-y divide-line/70">
        {e.odYears > 0 && <Row label={<>IDV <span className="text-muted">({inr(e.idvMin)} – {inr(e.idvMax)})</span></>} value={e.idv} muted />}
        {e.odYears > 0 && <Row label="Own damage" value={e.od} />}
        {e.ncbDiscount > 0 && <Row label={`No-claim bonus (${e.ncbPct}%)`} value={e.ncbDiscount} negative />}
        {e.tpYears > 0 && <Row label="Third-party liability" value={e.tp} />}
        {e.pa > 0 && <Row label="Owner-driver personal accident" value={e.pa} />}
        {e.addOns.map((a) => (
          <Row key={`${a.key}-${a.coverId}`} label={`${a.name}${a.included ? " (included)" : ""}`} value={a.premium} />
        ))}
        <Row label="Net premium" value={e.net} />
        <Row label={`GST (${e.gstPct}%)`} value={e.gst} muted />
        <Row label="Total" value={e.total} strong />
      </dl>
      {e.notes.length > 0 && (
        <ul className="mt-3 space-y-1 text-[12px] text-muted">
          {e.notes.map((n) => (
            <li key={n}>• {n}</li>
          ))}
        </ul>
      )}
      <p className="mt-3 flex gap-2 rounded-[3px] bg-mist/70 px-3 py-2.5 text-[11.5px] leading-relaxed text-muted">
        <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        <span>
          {INDICATIVE_NOTE}
          {extraNote ? ` ${extraNote}` : ""}
        </span>
      </p>
    </div>
  );
}
