import type { CarLite, FuelType } from "@/types";
import type { ClientCatalog as Catalog } from "@/lib/catalog";
import { clamp } from "@/lib/utils";

/**
 * Indicative used-car valuation. Deterministic and entirely client-safe:
 * the same inputs always produce the same figures on server and client.
 * This is a demonstration model, not a quote.
 */

/** Valuations are pinned to a reference year so renders never depend on the clock. */
export const VALUATION_YEAR = 2026;
export const OLDEST_YEAR = 2010;
export const YEARS = Array.from({ length: VALUATION_YEAR - OLDEST_YEAR + 1 }, (_, i) => VALUATION_YEAR - i);

export type Condition = "fair" | "good" | "excellent";
export type GearboxKind = "Manual" | "Automatic";

export const CONDITIONS: { value: Condition; label: string; note: string }[] = [
  { value: "fair", label: "Fair", note: "Visible wear, some repairs due" },
  { value: "good", label: "Good", note: "Normal wear for its age" },
  { value: "excellent", label: "Excellent", note: "Showroom-like, full history" },
];

export const FUELS: FuelType[] = ["Petrol", "Diesel", "CNG", "Hybrid", "Electric"];

const L = 100_000;

/** Typical mid-variant ex-showroom price when the exact model isn't in the catalogue. */
const BRAND_BASE: Record<string, number> = {
  "maruti-suzuki": 8 * L,
  hyundai: 12 * L,
  tata: 10 * L,
  mahindra: 16 * L,
  toyota: 20 * L,
  honda: 12 * L,
  kia: 14 * L,
  skoda: 15 * L,
  mg: 16 * L,
  byd: 35 * L,
  tesla: 65 * L,
  bmw: 70 * L,
  "mercedes-benz": 80 * L,
  audi: 65 * L,
  "land-rover": 120 * L,
  porsche: 180 * L,
  ford: 14 * L,
  volkswagen: 13 * L,
  jaguar: 80 * L,
  nissan: 9 * L,
  fiat: 8 * L,
};

/** Brand-level resale strength (1 = market average). */
const BRAND_RETENTION: Record<string, number> = {
  "maruti-suzuki": 1.06,
  toyota: 1.06,
  honda: 1.02,
  hyundai: 1.02,
  mahindra: 1.03,
  tata: 0.98,
  kia: 1,
  skoda: 0.96,
  volkswagen: 0.95,
  mg: 0.95,
  byd: 0.92,
  tesla: 0.95,
  bmw: 0.9,
  "mercedes-benz": 0.9,
  audi: 0.89,
  jaguar: 0.86,
  "land-rover": 0.9,
  porsche: 0.98,
  ford: 0.97,
  nissan: 0.9,
  fiat: 0.85,
};

/** Share of ex-showroom value retained at each whole year of age (0 = new). */
const RETENTION = [1, 0.85, 0.78, 0.72, 0.66, 0.61, 0.56, 0.51, 0.47, 0.43, 0.4];

const CITY_DEMAND: Record<string, number> = {
  Bengaluru: 1.02,
  Mumbai: 1.01,
  Hyderabad: 1.01,
  Pune: 1.01,
  "New Delhi": 0.97,
  Chandigarh: 0.99,
};

const CONDITION_FACTOR: Record<Condition, number> = { fair: 0.9, good: 1, excellent: 1.06 };

const KM_PER_YEAR = 11_000;

/** Brands offered in the valuation flows: the catalogue plus legacy marques. */
export const valuationBrands = (cat: Catalog) =>
  [...new Set([...cat.brands.map((b) => b.slug), "volkswagen", "ford", "nissan", "fiat", "jaguar"])].map((slug) => ({
    value: slug,
    label: cat.brandName(slug),
  }));

export const modelsForBrand = (brand: string, cat: Catalog): CarLite[] => cat.carsByBrand(brand);

export interface ValuationInput {
  brand: string;
  /** Catalogue slug, when the model is known */
  modelSlug?: string;
  year: number;
  km: number;
  fuel: FuelType;
  transmission: GearboxKind;
  owners: number;
  condition: Condition;
  city: string;
}

export interface ValueBand {
  low: number;
  mid: number;
  high: number;
}

export interface ValuationFactor {
  label: string;
  detail: string;
  /** Signed effect in percent */
  effect: number;
}

export interface ValuationResult {
  newPrice: number;
  age: number;
  byCondition: Record<Condition, ValueBand>;
  selected: ValueBand;
  factors: ValuationFactor[];
  /** Value at each age from new, for the depreciation curve */
  curve: { age: number; value: number }[];
  retainedPct: number;
}

/** Retention by (fractional) age, interpolated on the yearly table. */
export function retentionAt(age: number) {
  if (age <= 0) return 1;
  const last = RETENTION.length - 1;
  if (age >= last) return Math.max(0.12, RETENTION[last] * Math.pow(0.92, age - last));
  const i = Math.floor(age);
  const t = age - i;
  return RETENTION[i] + (RETENTION[i + 1] - RETENTION[i]) * t;
}

/** Indicative ex-showroom price when new. */
export function estimateNewPrice(brand: string, cat: Catalog, modelSlug?: string) {
  const car = modelSlug ? cat.getCar(modelSlug) : undefined;
  if (car) return car.priceMin + (car.priceMax - car.priceMin) * 0.5;
  return BRAND_BASE[brand] ?? 12 * L;
}

function kmFactor(km: number, age: number) {
  const expected = KM_PER_YEAR * Math.max(age, 0.5);
  return clamp(1 - ((km - expected) / 10_000) * 0.022, 0.75, 1.06);
}

function fuelFactor(fuel: FuelType, age: number) {
  if (fuel === "Diesel") return age >= 7 ? 0.94 : 1;
  if (fuel === "Electric") return 0.94;
  if (fuel === "CNG") return 0.96;
  if (fuel === "Hybrid") return 1.03;
  return 1;
}

const ownersFactor = (owners: number) => (owners <= 1 ? 1 : owners === 2 ? 0.95 : 0.9);

/** Round to a tidy figure: ₹5,000 steps below ₹10 lakh, ₹10,000 above. */
export function tidy(value: number) {
  const step = value >= 10 * L ? 10_000 : 5_000;
  return Math.max(step, Math.round(value / step) * step);
}

const pct = (factor: number) => Math.round((factor - 1) * 1000) / 10;

export function valuate(input: ValuationInput, cat: Catalog): ValuationResult {
  const newPrice = estimateNewPrice(input.brand, cat, input.modelSlug);
  // Assume mid-year registration; valuations are dated late in the reference year.
  const age = Math.max(0.5, VALUATION_YEAR - input.year + 0.5);
  const brandF = BRAND_RETENTION[input.brand] ?? 1;
  const retention = Math.min(0.95, retentionAt(age) * brandF);
  const kmF = kmFactor(input.km, age);
  const fuelF = fuelFactor(input.fuel, age);
  const gearF = input.transmission === "Automatic" ? 1.03 : 1;
  const ownF = ownersFactor(input.owners);
  const cityF = CITY_DEMAND[input.city] ?? 1;

  const base = newPrice * retention * kmF * fuelF * gearF * ownF * cityF;
  const band = (c: Condition): ValueBand => {
    const mid = base * CONDITION_FACTOR[c];
    return { low: tidy(mid * 0.95), mid: tidy(mid), high: tidy(mid * 1.045) };
  };
  const byCondition = { fair: band("fair"), good: band("good"), excellent: band("excellent") };

  const kmRate = input.km / age;
  const horizon = Math.max(10, Math.ceil(age));
  const curve = Array.from({ length: horizon + 1 }, (_, t) => {
    if (t === 0) return { age: 0, value: newPrice };
    const r = Math.min(0.95, retentionAt(t) * brandF);
    const v = newPrice * r * kmFactor(kmRate * t, t) * fuelFactor(input.fuel, t) * gearF * ownF * cityF * CONDITION_FACTOR[input.condition];
    return { age: t, value: Math.min(newPrice, v) };
  });

  const years = Math.round(age - 0.5);
  const factors: ValuationFactor[] = [
    { label: "Age", detail: years <= 0 ? "Under a year" : `${years} ${years === 1 ? "year" : "years"}`, effect: pct(retention) },
    { label: "Kilometres", detail: `${Math.round(input.km / 1000)}k vs ${Math.round((KM_PER_YEAR * age) / 1000)}k typical`, effect: pct(kmF) },
    { label: "Ownership", detail: input.owners <= 1 ? "First owner" : `${input.owners}${input.owners >= 3 ? "+" : ""} owners`, effect: pct(ownF) },
    { label: "Fuel & gearbox", detail: `${input.fuel} · ${input.transmission}`, effect: pct(fuelF * gearF) },
    { label: "City demand", detail: input.city, effect: pct(cityF) },
    { label: "Condition", detail: CONDITIONS.find((c) => c.value === input.condition)!.label, effect: pct(CONDITION_FACTOR[input.condition]) },
  ];

  const selected = byCondition[input.condition];
  return {
    newPrice,
    age,
    byCondition,
    selected,
    factors,
    curve,
    retainedPct: Math.round((selected.mid / newPrice) * 100),
  };
}

export function valuationTitle(input: Pick<ValuationInput, "brand" | "modelSlug" | "year">, cat: Catalog, modelName?: string) {
  const car = input.modelSlug ? cat.getCar(input.modelSlug) : undefined;
  const name = car?.name ?? modelName?.trim();
  return [input.year, cat.brandName(input.brand), name].filter(Boolean).join(" ");
}
