import type { CarLite, CarModel, UsedCar } from "@/types";
import { calculateEmi } from "@/lib/finance";

/* Pure helpers shared by the vehicle cards and the pages around them —
   safe to call from server and client components alike. */

/* ── New cars ───────────────────────────────────────────────── */

export function carHref(car: Pick<CarModel, "slug">) {
  return `/cars/${car.slug}`;
}

/** Short transmission summary: "MT / AT", "Automatic" or "Manual". */
export function transmissionSummary(car: Pick<CarLite, "transmissions">) {
  const auto = car.transmissions.some((t) => t !== "Manual");
  const manual = car.transmissions.includes("Manual");
  if (auto && manual) return "MT / AT";
  return auto ? "Automatic" : "Manual";
}

/** Best claimed figure: "21.8 kmpl" or "489 km" for EVs; "" when none is published. */
export function bestEfficiency(car: Pick<CarLite, "ev" | "efficiency">) {
  if (car.ev) return `${car.ev.rangeKm} km`;
  // "17.4 – 21.8 kmpl · 26.1 km/kg CNG" → "21.8 kmpl"
  return car.efficiency.split(" · ")[0].split("–").pop()!.trim();
}

export function fuelSummary(car: Pick<CarLite, "fuelTypes">) {
  return car.fuelTypes.length > 2 ? `${car.fuelTypes[0]} + ${car.fuelTypes.length - 1}` : car.fuelTypes.join(" / ");
}

/* ── Used cars ──────────────────────────────────────────────── */

export const usedHref = (car: Pick<UsedCar, "id">) => `/used-cars/${car.id}`;

export const usedTitle = (car: Pick<UsedCar, "brand" | "name" | "year">, brandName: (slug: string) => string) =>
  `${car.year} ${brandName(car.brand)} ${car.name}`;

/** Indicative EMI with 20% down at 9.5% over 5 years. */
export const usedEmi = (price: number) => calculateEmi(price * 0.8, 9.5, 60);
