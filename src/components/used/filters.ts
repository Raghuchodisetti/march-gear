import type { UsedCar } from "@/types";
import { usedCars } from "@/data/used-cars";
import { brandName } from "@/data/brands";
import { formatKm } from "@/lib/format";

const L = 100_000;

/* ── Option sets ──────────────────────────────────────────────── */

export const USED_BUDGETS = [
  { slug: "under-5", label: "Under ₹5 Lakh", min: 0, max: 5 * L },
  { slug: "5-10", label: "₹5 – 10 Lakh", min: 5 * L, max: 10 * L },
  { slug: "10-20", label: "₹10 – 20 Lakh", min: 10 * L, max: 20 * L },
  { slug: "20-30", label: "₹20 – 30 Lakh", min: 20 * L, max: 30 * L },
  { slug: "luxury", label: "Luxury · ₹30 Lakh +", min: 30 * L, max: Infinity },
] as const;

export const USED_SORTS = [
  { value: "newest", label: "Newest listings" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "km", label: "Lowest kilometres" },
  { value: "year", label: "Newest model year" },
] as const;

export type UsedSort = (typeof USED_SORTS)[number]["value"];

export const OWNER_OPTIONS = [
  { value: 1, label: "1st owner" },
  { value: 2, label: "Up to 2 owners" },
] as const;

const uniq = <T,>(list: T[]) => Array.from(new Set(list));

/** Facets present in the inventory, in a sensible display order. */
export const FACETS = {
  cities: uniq(usedCars.map((c) => c.city)).sort(),
  brands: uniq(usedCars.map((c) => c.brand)).sort((a, b) => brandName(a).localeCompare(brandName(b))),
  bodies: (["SUV", "Sedan", "Hatchback", "MUV", "Coupe"] as const).filter((b) => usedCars.some((c) => c.bodyType === b)),
  fuels: (["Petrol", "Diesel", "CNG", "Hybrid", "Electric"] as const).filter((f) => usedCars.some((c) => c.fuel === f)),
  transmissions: (["Manual", "Automatic", "AMT", "DCT", "CVT"] as const).filter((t) => usedCars.some((c) => c.transmission === t)),
  yearMin: Math.min(...usedCars.map((c) => c.year)),
  yearMax: Math.max(...usedCars.map((c) => c.year)),
};

export const KM_MIN = 10_000;
export const KM_MAX = 100_000;
export const KM_STEP = 5_000;

/* ── State ────────────────────────────────────────────────────── */

export interface UsedFilters {
  city: string[];
  budget: string;
  body: string[];
  fuel: string[];
  transmission: string[];
  brand: string[];
  yearFrom: number | null;
  yearTo: number | null;
  /** Maximum kilometres; null = any */
  km: number | null;
  /** Maximum number of owners; null = any */
  owners: number | null;
  verified: boolean;
  sort: UsedSort;
}

export type ListKey = "city" | "body" | "fuel" | "transmission" | "brand";

export const EMPTY_FILTERS: UsedFilters = {
  city: [],
  budget: "",
  body: [],
  fuel: [],
  transmission: [],
  brand: [],
  yearFrom: null,
  yearTo: null,
  km: null,
  owners: null,
  verified: false,
  sort: "newest",
};

interface ParamReader {
  get(name: string): string | null;
}

const list = (v: string | null) =>
  v
    ? v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

const int = (v: string | null) => {
  if (!v) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

/** Case-insensitive match onto the canonical option spelling. */
const canonical = (values: string[], options: readonly string[]) =>
  values.map((v) => options.find((o) => o.toLowerCase() === v.toLowerCase()) ?? v);

export function parseUsedFilters(params: ParamReader): UsedFilters {
  const sort = params.get("sort");
  return {
    city: canonical(list(params.get("city")), FACETS.cities),
    budget: USED_BUDGETS.some((b) => b.slug === params.get("budget")) ? params.get("budget")! : "",
    body: canonical(list(params.get("body")), FACETS.bodies),
    fuel: canonical(list(params.get("fuel")), FACETS.fuels),
    transmission: canonical(list(params.get("transmission")), FACETS.transmissions),
    brand: list(params.get("brand")).map((b) => b.toLowerCase()),
    yearFrom: int(params.get("yearFrom")),
    yearTo: int(params.get("yearTo")),
    km: int(params.get("km")),
    owners: int(params.get("owners")),
    verified: params.get("verified") === "1",
    sort: USED_SORTS.some((s) => s.value === sort) ? (sort as UsedSort) : "newest",
  };
}

export function serializeUsedFilters(f: UsedFilters) {
  const p = new URLSearchParams();
  if (f.city.length) p.set("city", f.city.join(","));
  if (f.budget) p.set("budget", f.budget);
  if (f.body.length) p.set("body", f.body.join(","));
  if (f.fuel.length) p.set("fuel", f.fuel.join(","));
  if (f.transmission.length) p.set("transmission", f.transmission.join(","));
  if (f.brand.length) p.set("brand", f.brand.join(","));
  if (f.yearFrom) p.set("yearFrom", String(f.yearFrom));
  if (f.yearTo) p.set("yearTo", String(f.yearTo));
  if (f.km) p.set("km", String(f.km));
  if (f.owners) p.set("owners", String(f.owners));
  if (f.verified) p.set("verified", "1");
  if (f.sort !== "newest") p.set("sort", f.sort);
  return p.toString();
}

/* ── Filtering ────────────────────────────────────────────────── */

export function matches(car: UsedCar, f: UsedFilters) {
  if (f.city.length && !f.city.includes(car.city)) return false;
  if (f.budget) {
    const b = USED_BUDGETS.find((x) => x.slug === f.budget);
    if (b && (car.price < b.min || car.price >= b.max)) return false;
  }
  if (f.body.length && !f.body.includes(car.bodyType)) return false;
  if (f.fuel.length && !f.fuel.includes(car.fuel)) return false;
  if (f.transmission.length && !f.transmission.includes(car.transmission)) return false;
  if (f.brand.length && !f.brand.includes(car.brand)) return false;
  if (f.yearFrom && car.year < f.yearFrom) return false;
  if (f.yearTo && car.year > f.yearTo) return false;
  if (f.km && car.km > f.km) return false;
  if (f.owners && car.owners > f.owners) return false;
  if (f.verified && !car.verified) return false;
  return true;
}

const SORTERS: Record<UsedSort, (a: UsedCar, b: UsedCar) => number> = {
  newest: (a, b) => (a.postedOn < b.postedOn ? 1 : a.postedOn > b.postedOn ? -1 : 0),
  "price-asc": (a, b) => a.price - b.price,
  "price-desc": (a, b) => b.price - a.price,
  km: (a, b) => a.km - b.km,
  year: (a, b) => b.year - a.year || a.km - b.km,
};

export function applyUsedFilters(cars: UsedCar[], f: UsedFilters) {
  return cars.filter((c) => matches(c, f)).sort(SORTERS[f.sort]);
}

/** How many cars an option would show, given every other active filter. */
export function facetCount(cars: UsedCar[], f: UsedFilters, key: ListKey, value: string) {
  const probe = { ...f, [key]: [value] };
  return cars.filter((c) => matches(c, probe)).length;
}

/* ── Active filter chips ──────────────────────────────────────── */

export interface ActiveChip {
  id: string;
  label: string;
  patch: Partial<UsedFilters>;
}

export function activeChips(f: UsedFilters): ActiveChip[] {
  const out: ActiveChip[] = [];
  if (f.verified) out.push({ id: "verified", label: "Verified only", patch: { verified: false } });
  const listChip = (key: ListKey, fmt: (v: string) => string = (v) => v) =>
    f[key].forEach((v) => out.push({ id: `${key}-${v}`, label: fmt(v), patch: { [key]: f[key].filter((x) => x !== v) } }));
  listChip("city");
  if (f.budget) {
    out.push({ id: "budget", label: USED_BUDGETS.find((b) => b.slug === f.budget)?.label ?? f.budget, patch: { budget: "" } });
  }
  listChip("brand", brandName);
  listChip("body");
  listChip("fuel");
  listChip("transmission");
  if (f.yearFrom || f.yearTo) {
    const label =
      f.yearFrom && f.yearTo ? `${f.yearFrom} – ${f.yearTo}` : f.yearFrom ? `${f.yearFrom} or newer` : `${f.yearTo} or older`;
    out.push({ id: "year", label, patch: { yearFrom: null, yearTo: null } });
  }
  if (f.km) out.push({ id: "km", label: `Under ${formatKm(f.km)}`, patch: { km: null } });
  if (f.owners) out.push({ id: "owners", label: f.owners === 1 ? "1st owner" : `Up to ${f.owners} owners`, patch: { owners: null } });
  return out;
}
