import type { FuelType } from "@/types";
import type { GearboxKind } from "./valuation";

/* ──────────────────────────────────────────────────────────────
   Prefilling the valuation tool and the sell-car flow from the
   URL, e.g. from a car in the customer's garage:
   /tools/car-valuation?brand=hyundai&model=hyundai-creta&year=2021&km=42000&fuel=Petrol&gearbox=Manual&city=Pune
   Values are only suggestions — each tool checks them against the
   catalogue and its own options before using them. Client-safe.
   ────────────────────────────────────────────────────────────── */

export interface CarPrefill {
  brand?: string;
  model?: string;
  /** A model that isn't in the catalogue. */
  modelName?: string;
  year?: number;
  km?: number;
  fuel?: FuelType;
  transmission?: GearboxKind;
  city?: string;
}

const FUELS: FuelType[] = ["Petrol", "Diesel", "CNG", "Hybrid", "Electric"];
const slug = (v: string | null) => (v && /^[a-z0-9][a-z0-9-]{0,119}$/.test(v) ? v : undefined);
const text = (v: string | null, max: number) => {
  const t = v?.trim();
  return t && t.length <= max && /^[\p{L}\p{N} .'()&/-]+$/u.test(t) ? t : undefined;
};

/** Gearbox names (Manual, Automatic, AMT, DCT, CVT…) folded into the tools' Manual / Automatic. */
export const gearboxKind = (t: string | null | undefined): GearboxKind | undefined => (!t ? undefined : /^manual$/i.test(t) ? "Manual" : "Automatic");

type Params = string | URLSearchParams | Record<string, string | string[] | undefined>;

export function readCarPrefill(search: Params): CarPrefill {
  const q =
    typeof search === "string" || search instanceof URLSearchParams
      ? new URLSearchParams(search)
      : new URLSearchParams(Object.entries(search).flatMap(([k, v]) => (v === undefined ? [] : [[k, Array.isArray(v) ? v[0] : v] as [string, string]])));
  const year = Number(q.get("year"));
  const km = Number(q.get("km"));
  const fuel = q.get("fuel");
  return {
    brand: slug(q.get("brand")),
    model: slug(q.get("model")),
    modelName: text(q.get("modelName"), 80),
    year: Number.isInteger(year) && year > 1980 && year < 2100 ? year : undefined,
    km: Number.isFinite(km) && km >= 0 && km <= 1_000_000 && q.get("km") !== null ? Math.round(km) : undefined,
    fuel: FUELS.includes(fuel as FuelType) ? (fuel as FuelType) : undefined,
    transmission: gearboxKind(q.get("gearbox")),
    city: text(q.get("city"), 64),
  };
}

export const hasCarPrefill = (p: CarPrefill) => Object.values(p).some((v) => v !== undefined);

/** The query string for a prefill (empty values left out), without the leading "?". */
export function carPrefillQuery(p: CarPrefill): string {
  const q = new URLSearchParams();
  if (p.brand) q.set("brand", p.brand);
  if (p.model) q.set("model", p.model);
  else if (p.modelName) q.set("modelName", p.modelName);
  if (p.year) q.set("year", String(p.year));
  if (p.km !== undefined) q.set("km", String(p.km));
  if (p.fuel) q.set("fuel", p.fuel);
  if (p.transmission) q.set("gearbox", p.transmission);
  if (p.city) q.set("city", p.city);
  return q.toString();
}
