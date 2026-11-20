import type { BodyType, FuelType } from "@/types";

/* ──────────────────────────────────────────────────────────────
   Modelling assumptions shared by the March Gear calculators.
   Every figure here is an illustrative, rounded industry average
   used for demonstration — not a quote, tariff or lender policy.

   These are the launch defaults for the `toolRates` content block
   (src/content/blocks/tool-rates.ts). The calculators read the saved
   block instead: calcRates(content.toolRates) in components/tools/calc.ts.
   ────────────────────────────────────────────────────────────── */

export type IceFuel = Exclude<FuelType, "Electric">;
export type Employment = "salaried" | "self-employed";

/** Indicative retail fuel prices, ₹ per litre (CNG per kg). */
export const FUEL_PRICE: Record<IceFuel, number> = {
  Petrol: 105,
  Diesel: 92,
  Hybrid: 105,
  CNG: 88,
};

/** Indicative residential electricity tariff, ₹ per kWh. */
export const HOME_TARIFF = 8;

/** Claimed EV range is optimistic — real-world consumption is ~25% higher. */
export const EV_REAL_WORLD_FACTOR = 1.25;

/** Real-world fuel economy is typically ~85% of the claimed figure. */
export const ICE_REAL_WORLD_FACTOR = 0.85;

/** Tailpipe CO₂ per litre of petrol burned, kg. */
export const CO2_PER_LITRE = 2.3;

/** Indian grid emission factor, kg CO₂ per kWh. */
export const CO2_PER_KWH = 0.82;

/** CO₂ a mature tree absorbs in a year, kg — used for a relatable equivalent. */
export const TREE_KG_PER_YEAR = 21;

/** Fixed obligation-to-income ratio caps applied by most lenders. */
export const FOIR: Record<Employment, number> = {
  salaried: 0.5,
  "self-employed": 0.4,
};

/** Loan-to-value: lenders typically fund up to 80% of the car's price. */
export const LOAN_TO_VALUE = 0.8;

/** Annual insurance premium as a share of the car's insured value. */
export const INSURANCE_RATE = 0.03;

/** Share of ex-showroom value retained at each age (index = years old). */
export const RESALE_CURVE = [1, 0.8, 0.7, 0.62, 0.55, 0.49, 0.44, 0.39] as const;

/** Luxury cars and EVs shed value a little faster each year. */
export const LUXURY_DEPRECIATION_DRAG = 0.97;
export const EV_DEPRECIATION_DRAG = 0.98;

/** Average scheduled service + wear items per year, ₹ (first year of ownership). */
export const MAINTENANCE_BY_SEGMENT: Record<BodyType, number> = {
  Hatchback: 9_000,
  Sedan: 12_000,
  SUV: 15_000,
  MUV: 16_000,
  Coupe: 40_000,
};
export const LUXURY_MAINTENANCE = 65_000;

/** EVs have far fewer wear parts — no oil, filters, clutch or exhaust. */
export const EV_MAINTENANCE_FACTOR = 0.6;

/** Service costs rise with age as wear items come due. */
export const MAINTENANCE_GROWTH = 0.08;
