import { z } from "zod";
import {
  CO2_PER_KWH,
  CO2_PER_LITRE,
  EV_DEPRECIATION_DRAG,
  EV_MAINTENANCE_FACTOR,
  EV_REAL_WORLD_FACTOR,
  FOIR,
  FUEL_PRICE,
  HOME_TARIFF,
  ICE_REAL_WORLD_FACTOR,
  INSURANCE_RATE,
  LOAN_TO_VALUE,
  LUXURY_DEPRECIATION_DRAG,
  LUXURY_MAINTENANCE,
  MAINTENANCE_BY_SEGMENT,
  MAINTENANCE_GROWTH,
  RESALE_CURVE,
  TREE_KG_PER_YEAR,
} from "@/data/tools-assumptions";
import type { Field } from "@/components/admin/fields";
import { defineBlock, number } from "../define";

/* Percentages are stored as admins type them (50 = 50%); the calculators
   convert them with calcRates() in components/tools/calc.ts. */

/** 0.62 → 62, without floating-point noise (0.55 × 100 = 55.000…01). */
const pct = (fraction: number) => Math.round(fraction * 1e6) / 1e4;

const RESALE_YEARS = [1, 2, 3, 4, 5, 6, 7] as const;
type ResaleKey = `year${(typeof RESALE_YEARS)[number]}`;
const resaleKey = (y: number) => `year${y}` as ResaleKey;

const fuelPrice = (label: string) => number(label, 30, 300);
const service = (label: string) => number(label, 0, 500_000);

/** Share of the ex-showroom price kept after 1–7 years; never rising with age. */
const resaleCurve = z
  .object(
    Object.fromEntries(RESALE_YEARS.map((y) => [resaleKey(y), number(`value after ${y} year${y === 1 ? "" : "s"}`, 0, 100)])) as Record<ResaleKey, z.ZodNumber>,
  )
  .superRefine((curve, ctx) => {
    for (const y of RESALE_YEARS.slice(1)) {
      const prev = curve[resaleKey(y - 1)];
      if (curve[resaleKey(y)] > prev)
        ctx.addIssue({
          code: "custom",
          path: [resaleKey(y)],
          message: `Can't be higher than after ${y - 1} year${y === 2 ? "" : "s"} (${prev}%) — cars don't gain value with age`,
        });
    }
  });

const schema = z.object({
  fuelPrices: z.object({
    petrol: fuelPrice("petrol price"),
    diesel: fuelPrice("diesel price"),
    hybrid: fuelPrice("hybrid fuel price"),
    cng: fuelPrice("CNG price"),
  }),
  homeTariff: number("home electricity tariff", 1, 30),
  evRealWorldFactor: number("EV real-world factor", 1, 2),
  iceRealWorldFactor: number("fuel-economy factor", 0.5, 1),
  co2PerLitre: number("CO₂ per litre", 0.5, 5),
  co2PerKwh: number("CO₂ per kWh", 0, 2),
  treeKgPerYear: number("CO₂ a tree absorbs", 1, 100),
  foir: z.object({
    salaried: number("salaried FOIR", 10, 80),
    selfEmployed: number("self-employed FOIR", 10, 80),
  }),
  loanToValue: number("loan-to-value", 50, 100),
  insuranceRate: number("insurance rate", 0.5, 10),
  resaleCurve,
  luxuryDepreciationDrag: number("luxury depreciation factor", 0.8, 1),
  evDepreciationDrag: number("EV depreciation factor", 0.8, 1),
  maintenance: z.object({
    hatchback: service("hatchback servicing cost"),
    sedan: service("sedan servicing cost"),
    suv: service("SUV servicing cost"),
    muv: service("MUV servicing cost"),
    coupe: service("coupé servicing cost"),
    luxury: service("luxury servicing cost"),
  }),
  evMaintenanceFactor: number("EV servicing share", 10, 100),
  maintenanceGrowth: number("yearly servicing increase", 0, 30),
});

const rupeeField = (name: string, label: string, suffix: string, hint?: string): Field => ({
  name,
  label,
  type: "number",
  required: true,
  prefix: "₹",
  suffix,
  step: 0.01,
  min: 0,
  hint,
});
const percentField = (name: string, label: string, hint?: string, max = 100): Field => ({
  name,
  label,
  type: "number",
  required: true,
  suffix: "%",
  step: 0.5,
  min: 0,
  max,
  hint,
});

/** Every number the calculators assume. */
export const toolRates = defineBlock({
  key: "toolRates",
  title: "Fuel prices & finance rates",
  group: "Pricing & tools",
  description: "Fuel and electricity prices, insurance, loan and depreciation assumptions used by the calculators.",
  usedOn: ["/tools", "EV vs petrol", "Ownership cost", "Car loan", "Mileage calculator"],
  schema,
  defaults: {
    fuelPrices: {
      petrol: FUEL_PRICE.Petrol,
      diesel: FUEL_PRICE.Diesel,
      hybrid: FUEL_PRICE.Hybrid,
      cng: FUEL_PRICE.CNG,
    },
    homeTariff: HOME_TARIFF,
    evRealWorldFactor: EV_REAL_WORLD_FACTOR,
    iceRealWorldFactor: ICE_REAL_WORLD_FACTOR,
    co2PerLitre: CO2_PER_LITRE,
    co2PerKwh: CO2_PER_KWH,
    treeKgPerYear: TREE_KG_PER_YEAR,
    foir: {
      salaried: pct(FOIR.salaried),
      selfEmployed: pct(FOIR["self-employed"]),
    },
    loanToValue: pct(LOAN_TO_VALUE),
    insuranceRate: pct(INSURANCE_RATE),
    resaleCurve: Object.fromEntries(RESALE_YEARS.map((y) => [resaleKey(y), pct(RESALE_CURVE[y])])) as Record<ResaleKey, number>,
    luxuryDepreciationDrag: LUXURY_DEPRECIATION_DRAG,
    evDepreciationDrag: EV_DEPRECIATION_DRAG,
    maintenance: {
      hatchback: MAINTENANCE_BY_SEGMENT.Hatchback,
      sedan: MAINTENANCE_BY_SEGMENT.Sedan,
      suv: MAINTENANCE_BY_SEGMENT.SUV,
      muv: MAINTENANCE_BY_SEGMENT.MUV,
      coupe: MAINTENANCE_BY_SEGMENT.Coupe,
      luxury: LUXURY_MAINTENANCE,
    },
    evMaintenanceFactor: pct(EV_MAINTENANCE_FACTOR),
    maintenanceGrowth: pct(MAINTENANCE_GROWTH),
  },
  sections: [
    {
      title: "Fuel & electricity prices",
      description:
        "Starting values for the EV vs petrol and mileage calculators (visitors can adjust them), and the running costs in the ownership cost calculator.",
      fields: [
        {
          name: "fuelPrices",
          label: "Retail fuel prices",
          type: "group",
          fields: [
            rupeeField("petrol", "Petrol", "/ litre"),
            rupeeField("diesel", "Diesel", "/ litre"),
            rupeeField("hybrid", "Hybrid (petrol)", "/ litre", "Hybrids run on petrol — usually the same as petrol."),
            rupeeField("cng", "CNG", "/ kg"),
          ],
        },
        rupeeField("homeTariff", "Home electricity tariff", "/ kWh", "Residential charging, typically ₹6–10 per kWh."),
      ],
    },
    {
      title: "Real-world corrections",
      description: "Brochure figures are optimistic. These turn them into real-world numbers.",
      fields: [
        {
          name: "evRealWorldFactor",
          label: "EV energy use vs claimed",
          type: "number",
          required: true,
          step: 0.01,
          min: 1,
          max: 2,
          suffix: "×",
          hint: "kWh per km = battery ÷ claimed range × this. 1.25 means 25% more energy than the claimed range implies.",
        },
        {
          name: "iceRealWorldFactor",
          label: "Fuel economy vs claimed",
          type: "number",
          required: true,
          step: 0.01,
          min: 0.5,
          max: 1,
          suffix: "×",
          hint: "Real-world kmpl = claimed × this. 0.85 means 85% of the claimed figure.",
        },
      ],
    },
    {
      title: "CO₂",
      description: "Used for the CO₂ avoided figure in the EV vs petrol calculator.",
      fields: [
        {
          name: "co2PerLitre",
          label: "Tailpipe CO₂ per litre of petrol",
          type: "number",
          required: true,
          step: 0.01,
          min: 0,
          suffix: "kg / litre",
        },
        {
          name: "co2PerKwh",
          label: "Grid CO₂ per kWh",
          type: "number",
          required: true,
          step: 0.01,
          min: 0,
          suffix: "kg / kWh",
          hint: "India's grid emission factor.",
        },
        {
          name: "treeKgPerYear",
          label: "CO₂ a mature tree absorbs",
          type: "number",
          required: true,
          step: 1,
          min: 1,
          suffix: "kg / year",
          hint: "For the “≈ N trees” equivalent.",
        },
      ],
    },
    {
      title: "Loans",
      description: "Used by the car loan eligibility calculator.",
      fields: [
        {
          name: "foir",
          label: "EMI cap as a share of take-home pay (FOIR)",
          type: "group",
          fields: [
            percentField("salaried", "Salaried", "All EMIs together, incl. the new car loan. Between 10% and 80%.", 80),
            percentField("selfEmployed", "Self-employed", "Usually lower — business income varies. Between 10% and 80%.", 80),
          ],
        },
        percentField("loanToValue", "Loan-to-value", "Share of the car's price lenders fund; the rest is the down payment. Between 50% and 100%."),
      ],
    },
    {
      title: "Ownership costs",
      description: "Used by the ownership cost calculator.",
      fields: [
        percentField("insuranceRate", "Yearly insurance premium", "Share of the car's current value each year. Between 0.5% and 10%.", 10),
        {
          name: "resaleCurve",
          label: "Resale value — share of the ex-showroom price kept",
          type: "group",
          fields: RESALE_YEARS.map((y) =>
            percentField(
              resaleKey(y),
              `After ${y} year${y === 1 ? "" : "s"}`,
              y === 1 ? "Each year must be the same or lower than the one before." : undefined,
            ),
          ),
        },
        {
          name: "luxuryDepreciationDrag",
          label: "Luxury cars: extra depreciation",
          type: "number",
          required: true,
          step: 0.01,
          min: 0.8,
          max: 1,
          suffix: "× per year",
          hint: "The resale value is multiplied by this once per year of age. 0.97 ≈ 3% a year faster than the curve; 1 = no extra loss.",
        },
        {
          name: "evDepreciationDrag",
          label: "Electric cars: extra depreciation",
          type: "number",
          required: true,
          step: 0.01,
          min: 0.8,
          max: 1,
          suffix: "× per year",
          hint: "Same as above, for EVs. 0.98 ≈ 2% a year faster.",
        },
        {
          name: "maintenance",
          label: "First-year servicing & wear, by segment",
          type: "group",
          fields: [
            rupeeField("hatchback", "Hatchback", "/ year"),
            rupeeField("sedan", "Sedan", "/ year"),
            rupeeField("suv", "SUV", "/ year"),
            rupeeField("muv", "MUV", "/ year"),
            rupeeField("coupe", "Coupé", "/ year"),
            rupeeField("luxury", "Any luxury car", "/ year", "Used instead of the segment figure for luxury models."),
          ],
        },
        percentField(
          "evMaintenanceFactor",
          "EV servicing vs a petrol car",
          "EVs have fewer wear parts. 60% means an EV costs 60% as much to service. Between 10% and 100%.",
        ),
        percentField("maintenanceGrowth", "Servicing cost increase per year", "Service bills rise as the car ages. Between 0% and 30%.", 30),
      ],
    },
  ],
});
