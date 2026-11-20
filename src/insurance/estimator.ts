import type { InsProductCategory } from "@/db/enums";
import type { CoverPricing, EstimateAddOn, FuelName, PremiumEstimate, ProductEligibility, ProductPricing } from "./types";

/* ──────────────────────────────────────────────────────────────
   Indicative premium estimator. Pure and client-safe: the public
   quotes/compare pages and the vendor quote builder all use it.

   Everything it returns is an ESTIMATE from typical rates
   (admin-editable in /admin/insurance/pricing → the
   `insurancePricing` content block). It is never an insurer's
   quotation — label it with INDICATIVE_NOTE wherever it's shown.
   ────────────────────────────────────────────────────────────── */

export interface TpSlab {
  /** Upper bound (inclusive) of the slab; null = everything above the previous slab. */
  max: number | null;
  annual: number;
  threeYear: number;
}

export interface PricingConfig {
  /** Third-party premium for private cars by engine capacity (cc). */
  tpPrivateCar: TpSlab[];
  /** Third-party premium for electric private cars by motor power (kW). */
  tpElectric: TpSlab[];
  /** IDV depreciation by vehicle age, up to 5 years. */
  depreciation: { maxAgeMonths: number; pct: number }[];
  /** Approximate depreciation for each further year past 5 (IDV is then agreed with the insurer). */
  olderDepreciationPct: number[];
  /** No-claim bonus slabs (%), index = claim-free years. */
  ncbSlabs: number[];
  gstPct: number;
  /** Owner-driver personal accident cover, per year (₹). */
  paOwnerDriver: number;
  /** Range vendors may set for own-damage rates (% of IDV), and the default. */
  odRate: { min: number; max: number; default: number };
  /** The oldest car the site estimates for (years). */
  maxVehicleAgeYears: number;
}

/** Launch defaults. Check the third-party rates against the latest regulator notification before going live. */
export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  tpPrivateCar: [
    { max: 1000, annual: 2094, threeYear: 6521 },
    { max: 1500, annual: 3416, threeYear: 10640 },
    { max: null, annual: 7897, threeYear: 24596 },
  ],
  tpElectric: [
    { max: 30, annual: 1780, threeYear: 5543 },
    { max: 65, annual: 2904, threeYear: 9044 },
    { max: null, annual: 6712, threeYear: 20907 },
  ],
  depreciation: [
    { maxAgeMonths: 6, pct: 5 },
    { maxAgeMonths: 12, pct: 15 },
    { maxAgeMonths: 24, pct: 20 },
    { maxAgeMonths: 36, pct: 30 },
    { maxAgeMonths: 48, pct: 40 },
    { maxAgeMonths: 60, pct: 50 },
  ],
  olderDepreciationPct: [55, 60, 65, 70, 75, 80],
  ncbSlabs: [0, 20, 25, 35, 45, 50],
  gstPct: 18,
  paOwnerDriver: 330,
  odRate: { min: 1.2, max: 6, default: 2.8 },
  maxVehicleAgeYears: 15,
};

/** What the `insurancePricing` content block holds (older-car depreciation is stored as { pct } rows for the admin form). */
export type PricingBlock = Omit<Partial<PricingConfig>, "olderDepreciationPct"> & { olderDepreciationPct?: readonly (number | { pct: number })[]; disclaimer?: string };

/**
 * The estimator config from the `insurancePricing` content block. The block holds the admin-editable
 * parts; anything it doesn't carry (the regulator's NCB slabs) comes from the defaults.
 */
export function pricingConfigFrom(block: PricingBlock | null | undefined): PricingConfig {
  const { olderDepreciationPct, disclaimer: _disclaimer, ...rest } = block ?? {};
  void _disclaimer;
  return {
    ...DEFAULT_PRICING_CONFIG,
    ...rest,
    olderDepreciationPct: olderDepreciationPct?.length ? olderDepreciationPct.map((x) => (typeof x === "number" ? x : x.pct)) : DEFAULT_PRICING_CONFIG.olderDepreciationPct,
    ncbSlabs: rest.ncbSlabs?.length ? rest.ncbSlabs : DEFAULT_PRICING_CONFIG.ncbSlabs,
  };
}

/** Default OD/TP terms per product category (vendors can change them within reason). */
export const CATEGORY_TERMS: Record<InsProductCategory, { odYears: number; tpYears: number }> = {
  comprehensive: { odYears: 1, tpYears: 1 },
  third_party: { odYears: 0, tpYears: 1 },
  own_damage: { odYears: 1, tpYears: 0 },
  bundled: { odYears: 1, tpYears: 3 },
  new_car: { odYears: 1, tpYears: 3 },
  used_car: { odYears: 1, tpYears: 1 },
  ev: { odYears: 1, tpYears: 1 },
  long_term: { odYears: 3, tpYears: 3 },
};

export const DEFAULT_PRODUCT_PRICING = (category: InsProductCategory, config = DEFAULT_PRICING_CONFIG): ProductPricing => ({
  odRatePct: config.odRate.default,
  minOdPremium: 1500,
  idvMinPct: -10,
  idvMaxPct: 10,
  odAdjustmentPct: 0,
  ...CATEGORY_TERMS[category],
});

/* ── Vehicle helpers ────────────────────────────────────────── */

/** Largest cc figure in a catalogue engine string ("1199 – 1497 cc" → 1497), or null. */
export function parseEngineCc(engine: string | null | undefined): number | null {
  if (!engine || !/cc/i.test(engine)) return null;
  const nums = (engine.match(/\d{3,4}/g) ?? []).map(Number).filter((n) => n >= 500 && n <= 8000);
  return nums.length ? Math.max(...nums) : null;
}

/** Approximate age in months at `today` (YYYY-MM-DD) for a car made in `year` (assumes mid-year). New cars are 0. */
export function vehicleAgeMonths(year: number | null, isNew: boolean, today: string): number {
  if (isNew || !year) return 0;
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  return Math.max(0, (y - year) * 12 + (m - 7));
}

export const ageYears = (ageMonths: number) => Math.floor(ageMonths / 12);

/** IDV depreciation (%) for a car of this age, plus whether it's only approximate (over 5 years). */
export function depreciationFor(ageMonths: number, config: PricingConfig): { pct: number; approximate: boolean } {
  for (const d of config.depreciation) if (ageMonths <= d.maxAgeMonths) return { pct: d.pct, approximate: false };
  const last = config.depreciation[config.depreciation.length - 1];
  const extraYears = Math.ceil((ageMonths - (last?.maxAgeMonths ?? 60)) / 12);
  const older = config.olderDepreciationPct;
  const pct = older.length ? older[Math.min(extraYears - 1, older.length - 1)] : Math.min(90, (last?.pct ?? 50) + extraYears * 5);
  return { pct, approximate: true };
}

const slabFor = (slabs: TpSlab[], value: number | null) => {
  if (!slabs.length) return null;
  if (value === null) return slabs[Math.min(1, slabs.length - 1)]; // unknown size → middle slab
  return slabs.find((s) => s.max === null || value <= s.max) ?? slabs[slabs.length - 1];
};

/** Third-party premium for the term. Uses the 3-year rate for 3-year terms. */
export function tpPremium(fuel: FuelName | "", engineCc: number | null, motorKw: number | null, tpYears: number, config: PricingConfig): number {
  if (tpYears <= 0) return 0;
  const slab = fuel === "Electric" ? slabFor(config.tpElectric, motorKw) : slabFor(config.tpPrivateCar, engineCc);
  if (!slab) return 0;
  return tpYears === 3 ? slab.threeYear : slab.annual * tpYears;
}

/** NCB the customer keeps: none for new cars, after a claim, or when the old policy lapsed over 90 days ago. */
export function effectiveNcb(ncbPct: number, opts: { isNew: boolean; claimed: boolean; lapsedLong: boolean }, config: PricingConfig): number {
  if (opts.isNew || opts.claimed || opts.lapsedLong) return 0;
  return config.ncbSlabs.includes(ncbPct) ? ncbPct : 0;
}

/* ── Eligibility ────────────────────────────────────────────── */

export interface VehicleFacts {
  brand: string;
  model: string;
  bodyType: string | null;
  isLuxury: boolean;
  fuel: FuelName | "";
  ageYears: number;
  state: string;
  city: string;
}

/** Why a product can't be offered for this car (empty = eligible). Empty criteria mean "any". */
export function eligibilityProblems(e: ProductEligibility, v: VehicleFacts): string[] {
  const out: string[] = [];
  if (e.brands.length && v.brand && !e.brands.includes(v.brand)) out.push("Not offered for this brand");
  if (e.models.length && v.model && !e.models.includes(v.model)) out.push("Not offered for this model");
  if (e.bodyTypes.length && v.bodyType && !e.bodyTypes.includes(v.bodyType)) out.push(`Only for ${e.bodyTypes.join(", ")}`);
  if (e.luxury === "exclude" && v.isLuxury) out.push("Not offered for luxury cars");
  if (e.luxury === "only" && !v.isLuxury) out.push("Only for luxury cars");
  if (e.fuels.length && v.fuel && !e.fuels.includes(v.fuel)) out.push(`Only for ${e.fuels.join(", ")} cars`);
  if (v.ageYears < e.minAgeYears) out.push(`For cars at least ${e.minAgeYears} year${e.minAgeYears === 1 ? "" : "s"} old`);
  if (v.ageYears > e.maxAgeYears) out.push(`For cars up to ${e.maxAgeYears} year${e.maxAgeYears === 1 ? "" : "s"} old`);
  if (e.states.length && v.state && !e.states.includes(v.state)) out.push("Not available in your state");
  if (e.cities.length && v.city && !e.cities.includes(v.city)) out.push("Not available in your city");
  return out;
}

/* ── The estimate ───────────────────────────────────────────── */

export interface EstimateAddOnInput {
  coverId: number | null;
  key: string;
  name: string;
  pricing: CoverPricing;
  /** Bundled into the product. */
  included: boolean;
  /** Chosen by the customer (ignored when included). */
  selected: boolean;
}

export interface EstimateInput {
  /** Ex-showroom price (₹) of the variant. */
  exShowroom: number;
  ageMonths: number;
  isNew: boolean;
  fuel: FuelName | "";
  engineCc: number | null;
  motorKw: number | null;
  ncbPct: number;
  pricing: ProductPricing;
  paOwnerDriver: "included" | "optional" | "none";
  /** For "optional" PA cover. */
  includePa: boolean;
  addOns: EstimateAddOnInput[];
  /** A chosen IDV; clamped to the product's allowed band. */
  idv?: number | null;
  config: PricingConfig;
}

const round100 = (n: number) => Math.round(n / 100) * 100;

export function estimatePremium(input: EstimateInput): PremiumEstimate {
  const { pricing, config } = input;
  const odYears = Math.max(0, Math.round(pricing.odYears));
  const tpYears = Math.max(0, Math.round(pricing.tpYears));
  const notes: string[] = [];

  let idv = 0;
  let idvMin = 0;
  let idvMax = 0;
  if (odYears > 0) {
    const dep = depreciationFor(input.ageMonths, config);
    if (dep.approximate) notes.push("For cars over 5 years old, the IDV is agreed with the insurer — this estimate uses a typical value.");
    const base = round100(input.exShowroom * (1 - dep.pct / 100));
    idvMin = round100(base * (1 + pricing.idvMinPct / 100));
    idvMax = round100(base * (1 + pricing.idvMaxPct / 100));
    idv = input.idv ? Math.min(idvMax, Math.max(idvMin, Math.round(input.idv))) : base;
  }

  const odAnnual = odYears > 0 ? Math.max(pricing.minOdPremium, (idv * pricing.odRatePct * (1 + pricing.odAdjustmentPct / 100)) / 100) : 0;
  const od = Math.round(odAnnual * odYears);
  if (odYears > 1) notes.push(`Own-damage premium for ${odYears} years is estimated at the first-year rate.`);

  const ncbPct = odYears > 0 ? input.ncbPct : 0;
  const ncbDiscount = Math.round((od * ncbPct) / 100);

  const tp = tpPremium(input.fuel, input.engineCc, input.motorKw, tpYears, config);
  if (tpYears > 0 && input.fuel !== "Electric" && input.engineCc === null) notes.push("Engine size unknown — third-party premium uses the 1,000–1,500 cc rate.");

  const paWanted = input.paOwnerDriver === "included" || (input.paOwnerDriver === "optional" && input.includePa);
  const pa = tpYears > 0 && paWanted ? Math.round(config.paOwnerDriver * Math.max(1, tpYears === 3 ? 1 : tpYears)) : 0;

  const addOns: EstimateAddOn[] = [];
  if (odYears > 0) {
    for (const a of input.addOns) {
      if (!a.included && !a.selected) continue;
      const years = Math.max(1, odYears);
      const p = a.pricing;
      const premium =
        p.basis === "included" ? 0 : p.basis === "flat" ? p.value * years : p.basis === "pct_idv" ? (idv * p.value * years) / 100 : (od * p.value) / 100;
      addOns.push({ coverId: a.coverId, key: a.key, name: a.name, premium: Math.round(premium), included: a.included });
    }
  }
  const addOnsTotal = addOns.reduce((s, a) => s + a.premium, 0);

  const net = Math.max(0, od - ncbDiscount + tp + pa + addOnsTotal);
  const gst = Math.round((net * config.gstPct) / 100);
  return {
    idv,
    idvMin,
    idvMax,
    odYears,
    tpYears,
    od,
    ncbPct,
    ncbDiscount,
    tp,
    pa,
    addOns,
    addOnsTotal,
    net,
    gstPct: config.gstPct,
    gst,
    total: net + gst,
    notes,
  };
}
