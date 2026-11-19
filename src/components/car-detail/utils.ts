import type { CarModel, Variant } from "@/types";
import type { Catalog } from "@/lib/catalog";
import { onRoadPrice } from "@/data/cities";
import { calculateEmi } from "@/lib/finance";

/* Pure helpers shared by the car, variant and EV detail pages. */

/** Header (72px) + section navigation (56px). */
export const NAV_OFFSET = 128;

/** Bottom padding for pages that render the mobile action bar. */
export const BOTTOM_BAR_PADDING = "pb-[calc(76px+env(safe-area-inset-bottom))] lg:pb-0";

export const isEv = (car: Pick<CarModel, "fuelTypes">) => car.fuelTypes.includes("Electric");

/** All numbers inside a display string: "113 – 158 bhp" → [113, 158] */
export function numbersIn(value: string): number[] {
  return (value.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
}

export function maxOf(value: string) {
  const n = numbersIn(value);
  return n.length ? Math.max(...n) : 0;
}

export function minOf(value: string) {
  const n = numbersIn(value);
  return n.length ? Math.min(...n) : 0;
}

/** "17.4 kmpl" → { value: 17.4, unit: "kmpl" }; "473 km" → { value: 473, unit: "km" } */
export function efficiencyOf(v: Pick<Variant, "efficiency">) {
  const m = v.efficiency.match(/(\d+(?:\.\d+)?)\s*(.*)$/);
  return { value: m ? Number(m[1]) : 0, unit: m ? m[2].trim() : "" };
}

export const seatsLabel = (seats: number[]) => seats.join(" / ");

export const sortedVariants = (car: CarModel) => [...car.variants].sort((a, b) => a.price - b.price);

/** Indicative monthly EMI: 80% financed at 9.25% over five years. */
export const emiFrom = (price: number) => calculateEmi(price * 0.8, 9.25, 60);

/** Split the indicative on-road premium into plausible line items. */
export function onRoadBreakdown(exShowroom: number, citySlug: string, ev: boolean) {
  const total = onRoadPrice(exShowroom, citySlug, ev);
  const extra = Math.max(0, total - exShowroom);
  // EVs attract near-zero road tax, so insurance dominates the premium.
  const share = ev ? { tax: 0.08, insurance: 0.74 } : { tax: 0.68, insurance: 0.24 };
  const roadTax = Math.round((extra * share.tax) / 100) * 100;
  const insurance = Math.round((extra * share.insurance) / 100) * 100;
  const other = extra - roadTax - insurance;
  return { exShowroom, roadTax, insurance, other, total };
}

/** Deterministic star distribution that averages close to the model rating. */
export function ratingDistribution(rating: number, count: number) {
  const five = Math.min(0.9, Math.max(0.05, 0.2 + (rating - 3.6) * 0.5));
  const four = Math.min(0.5, Math.max(0.05, 0.62 - five * 0.55));
  const rest = Math.max(0.02, 1 - five - four);
  const raw = [five, four, rest * 0.55, rest * 0.25, rest * 0.2];
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((share, i) => ({ stars: 5 - i, share: share / sum, count: Math.round((share / sum) * count) }));
}

export function competitorsOf(car: CarModel, cat: Catalog, limit = 3) {
  return car.competitors
    .map((slug) => cat.getCar(slug))
    .filter((c): c is CarModel => c !== undefined)
    .slice(0, limit);
}

/** Direct rivals first, then the closest-priced cars of the same body style. */
export function similarCars(car: CarModel, cat: Catalog, limit = 8) {
  const rivals = competitorsOf(car, cat, 8);
  const seen = new Set([car.slug, ...rivals.map((c) => c.slug)]);
  const sameBody = cat.cars
    .filter((c) => !seen.has(c.slug) && c.bodyType === car.bodyType)
    .sort((a, b) => Math.abs(a.priceMin - car.priceMin) - Math.abs(b.priceMin - car.priceMin));
  return [...rivals, ...sameBody].slice(0, limit);
}

/** Comparable cars used to scale performance meters. */
export function peersOf(car: CarModel, cat: Catalog) {
  const sameClass = cat.cars.filter((c) => c.isLuxury === car.isLuxury);
  const sameBody = sameClass.filter((c) => c.bodyType === car.bodyType);
  return sameBody.length >= 4 ? sameBody : sameClass;
}

/** "40 min (10–80%)" → { minutes: 40, window: "10–80%" } */
export function parseDc(value: string) {
  const minutes = numbersIn(value)[0] ?? 0;
  const window = value.match(/\(([^)]+)\)/)?.[1] ?? "";
  return { minutes, window };
}

/** "6.5 h (7.2 kW)" → { hours: 6.5, power: "7.2 kW" } */
export function parseAc(value: string) {
  const hours = numbersIn(value)[0] ?? 0;
  const power = value.match(/\(([^)]+)\)/)?.[1] ?? "";
  return { hours, power };
}

/** Real-world range estimate used across EV visualisations. */
export const REAL_WORLD_FACTOR = 0.78;

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

export const pad2 = (n: number) => String(n).padStart(2, "0");
