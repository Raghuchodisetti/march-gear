import type { InsProductCategory, InsVendorCategory } from "@/db/enums";
import type { CarLite } from "@/types";
import type { CoverPricing, FuelName, InsuranceSearch, PremiumEstimate, ProductDeductibles, ProductEligibility, ProductPricing } from "@/insurance/types";
import { ageYears, pricingConfigFrom, eligibilityProblems, estimatePremium, effectiveNcb, parseEngineCc, vehicleAgeMonths, type PricingBlock, type PricingConfig } from "@/insurance/estimator";
import { FUELS, isNewVehicle, isSearchReady, searchQuery } from "@/insurance/search";
import { FILTER_ADDONS } from "@/insurance/covers";

/* ──────────────────────────────────────────────────────────────
   The public marketplace's pure logic: the shape of a public
   product as the browser sees it, resolving the customer's car
   from the catalogue, which plans fit it and their indicative
   premiums. Client-safe — the quotes, compare and product pages
   use it live, and the enquiry Server Action re-runs it to
   re-validate what the customer was shown.
   ────────────────────────────────────────────────────────────── */

/* ── Public product (serialisable) ──────────────────────────── */

export interface MarketCover {
  id: number;
  key: string;
  name: string;
  description: string;
  eligibility: string | null;
  maxVehicleAgeYears: number | null;
  fuels: string[];
  exclusions: string[];
  limits: string | null;
  pricing: CoverPricing;
}

export interface MarketAddOn extends MarketCover {
  /** Bundled into the product's price (vs. the customer chooses it). */
  included: boolean;
}

export interface MarketDocument {
  filename: string;
  size: number;
  mime: string;
}

export interface MarketCompany {
  id: number;
  slug: string;
  name: string;
  shortName: string | null;
  logo: string | null;
}

export interface MarketProduct {
  id: number;
  reference: string;
  vendorId: number;
  vendorName: string;
  vendorCategory: InsVendorCategory | null;
  /** The distributor's name when the vendor isn't the underwriting insurer (broker, corporate agent…). */
  soldBy: string | null;
  company: MarketCompany;
  name: string;
  uin: string | null;
  category: InsProductCategory;
  tagline: string | null;
  description: string;
  eligibility: ProductEligibility;
  coverage: { ownDamage: boolean; thirdParty: boolean; paOwnerDriver: "included" | "optional" | "none"; tpPropertyLimit: string; highlights: string[] };
  /** Approved coverage items that come with the product. */
  coverageItems: MarketCover[];
  /** Approved add-on covers (included or optional). */
  addOns: MarketAddOn[];
  pricing: ProductPricing;
  deductibles: ProductDeductibles;
  /** Cashless garages for the product, falling back to the company's figure ("as stated by the insurer"). */
  garageCount: number | null;
  garageNote: string | null;
  exclusions: string[];
  documents: { brochure: MarketDocument | null; wording: MarketDocument | null };
  terms: string | null;
  publishedAt: string | null;
}

/** A live sponsored listing, resolved to a public product. */
export interface MarketSponsored {
  campaignId: number;
  productId: number;
}

/**
 * The estimator's config from the `insurancePricing` content block. The block doesn't carry every
 * field (the NCB slabs are fixed), so the launch defaults fill the gaps.
 */
export const pricingConfig = (block: PricingBlock): PricingConfig => pricingConfigFrom(block);

/* ── The customer's car ─────────────────────────────────────── */

export interface MarketVehicle {
  search: InsuranceSearch;
  brand: string;
  brandName: string;
  model: string;
  modelName: string;
  /** "" when no variant was chosen. */
  variant: string;
  variantName: string;
  /** Ex-showroom (₹): the variant's price, or the model's lowest price when no variant is chosen. */
  exShowroom: number;
  priceFromModel: boolean;
  fuel: FuelName | "";
  /** The model comes in several fuels and none was chosen — the first one is assumed. */
  fuelAssumed: boolean;
  engineCc: number | null;
  motorKw: number | null;
  bodyType: string;
  isLuxury: boolean;
  isNew: boolean;
  /** Manufacturing year (null for a new car). */
  year: number | null;
  /** No year was given for a registered car — a car about a year old is assumed. */
  yearAssumed: boolean;
  ageMonths: number;
  /** The no-claim bonus the customer actually keeps (see effectiveNcb). */
  ncbPct: number;
  /** Older than the site estimates for (insurancePricing.maxVehicleAgeYears). */
  tooOld: boolean;
  /** "Hyundai Creta" */
  title: string;
}

type CatalogLookup = { getCar: (slug: string) => CarLite | undefined; brandName: (slug: string) => string };

/** The customer's car from the catalogue, or null when the search doesn't name a known model. `today` is an IST YYYY-MM-DD. */
export function resolveVehicle(search: InsuranceSearch, catalog: CatalogLookup, config: PricingConfig, today: string): MarketVehicle | null {
  if (!isSearchReady(search)) return null;
  const car = catalog.getCar(search.model);
  if (!car) return null;
  const variant = search.variant ? car.variants.find((x) => x.slug === search.variant) : undefined;
  const carFuels = car.fuelTypes.filter((f): f is FuelName => (FUELS as string[]).includes(f));
  const chosenFuel = search.fuel && carFuels.includes(search.fuel) ? search.fuel : "";
  const fuel: FuelName | "" = (variant?.fuel as FuelName | undefined) ?? (chosenFuel || carFuels[0] || "");
  const isNew = isNewVehicle(search);
  const thisYear = Number(today.slice(0, 4));
  const year = isNew ? null : (search.year ?? thisYear - 1);
  const ageMonths = vehicleAgeMonths(year, isNew, today);
  const brandName = catalog.brandName(car.brand);
  return {
    search,
    brand: car.brand,
    brandName,
    model: car.slug,
    modelName: car.name,
    variant: variant?.slug ?? "",
    variantName: variant?.name ?? "",
    exShowroom: variant?.price ?? car.priceMin,
    priceFromModel: !variant,
    fuel,
    fuelAssumed: !variant && !chosenFuel && carFuels.length > 1,
    engineCc: fuel === "Electric" ? null : parseEngineCc(car.engine),
    motorKw: fuel === "Electric" ? (car.ev?.motorKw ?? null) : null,
    bodyType: car.bodyType,
    isLuxury: car.isLuxury,
    isNew,
    year,
    yearAssumed: !isNew && !search.year,
    ageMonths,
    ncbPct: effectiveNcb(search.ncb, { isNew, claimed: search.claimed, lapsedLong: search.policy === "expired_long" }, config),
    tooOld: ageYears(ageMonths) > config.maxVehicleAgeYears,
    title: `${brandName} ${car.name}`,
  };
}

/** The vehicle-only query string (what /insurance/quotes and /insurance/compare read). */
export const vehicleQuery = (search: InsuranceSearch) => searchQuery(search);

/* ── Eligibility ────────────────────────────────────────────── */

/** Why a plan can't be offered for this car (empty = it can). */
export function productProblems(p: MarketProduct, v: MarketVehicle): string[] {
  const out = eligibilityProblems(p.eligibility, {
    brand: v.brand,
    model: v.model,
    bodyType: v.bodyType,
    isLuxury: v.isLuxury,
    fuel: v.fuel,
    ageYears: ageYears(v.ageMonths),
    state: v.search.state,
    city: v.search.city,
  });
  if (p.category === "ev" && v.fuel && v.fuel !== "Electric") out.push("Only for electric cars");
  if (v.isNew) {
    if (p.category === "used_car") out.push("For pre-owned cars");
    else if (p.category === "own_damage") out.push("Needs an existing third-party policy — new cars are insured with a bundled policy");
    else if (p.pricing.tpYears > 0 && p.pricing.tpYears < 3) out.push("New cars need 3-year third-party cover");
  } else if (p.category === "bundled" || p.category === "new_car") {
    out.push("Only for new cars being registered");
  }
  return [...new Set(out)];
}

/** Whether an add-on can be bought for this car (age and fuel limits). */
export function addOnAvailable(a: MarketCover, v: MarketVehicle | null, odYears: number): boolean {
  if (odYears <= 0) return false;
  if (!v) return true;
  if (a.maxVehicleAgeYears !== null && ageYears(v.ageMonths) > a.maxVehicleAgeYears) return false;
  if (a.fuels.length && v.fuel && !a.fuels.includes(v.fuel)) return false;
  return true;
}

/** Does the product offer this add-on (by standard key, or `c<coverId>` for a custom cover)? */
export const offersAddOn = (p: MarketProduct, key: string, v: MarketVehicle | null) =>
  p.addOns.some((a) => (a.key === key || `c${a.id}` === key) && addOnAvailable(a, v, p.pricing.odYears));

/* ── Indicative premium ─────────────────────────────────────── */

export type AddOnStatus = "included" | "selected" | "optional" | "unavailable";

export interface MarketAddOnLine {
  cover: MarketAddOn;
  status: AddOnStatus;
  /** ₹ before GST — what it costs (included/selected) or would add (optional). */
  premium: number;
}

export interface MarketEstimate {
  estimate: PremiumEstimate;
  addOns: MarketAddOnLine[];
}

/** What one add-on adds to an estimate (₹, before GST) — the estimator's own formula. */
export function addOnPremium(pricing: CoverPricing, e: Pick<PremiumEstimate, "idv" | "od" | "odYears">): number {
  const years = Math.max(1, e.odYears);
  const v = pricing.value;
  const p = pricing.basis === "included" ? 0 : pricing.basis === "flat" ? v * years : pricing.basis === "pct_idv" ? (e.idv * v * years) / 100 : (e.od * v) / 100;
  return Math.round(p);
}

export interface EstimateOptions {
  /** Add-on keys (standard key, or `c<coverId>`) the customer wants. */
  addOns: string[];
  /** A chosen IDV — clamped to the product's band. */
  idv?: number | null;
  /** For products where owner-driver PA cover is optional. */
  includePa?: boolean;
}

export function estimateProduct(p: MarketProduct, v: MarketVehicle, opts: EstimateOptions, config: PricingConfig): MarketEstimate {
  const wanted = new Set(opts.addOns);
  const isWanted = (a: MarketAddOn) => wanted.has(a.key) || wanted.has(`c${a.id}`);
  const available = p.addOns.filter((a) => addOnAvailable(a, v, p.pricing.odYears));
  const estimate = estimatePremium({
    exShowroom: v.exShowroom,
    ageMonths: v.ageMonths,
    isNew: v.isNew,
    fuel: v.fuel,
    engineCc: v.engineCc,
    motorKw: v.motorKw,
    ncbPct: v.ncbPct,
    pricing: p.pricing,
    paOwnerDriver: p.coverage.paOwnerDriver,
    includePa: opts.includePa ?? true,
    addOns: available.map((a) => ({ coverId: a.id, key: a.key, name: a.name, pricing: a.pricing, included: a.included, selected: isWanted(a) })),
    idv: opts.idv ?? null,
    config,
  });
  const lines = p.addOns.map((cover): MarketAddOnLine => {
    if (!available.includes(cover)) return { cover, status: "unavailable", premium: 0 };
    const inEstimate = estimate.addOns.find((x) => x.coverId === cover.id);
    if (cover.included) return { cover, status: "included", premium: inEstimate?.premium ?? 0 };
    if (inEstimate) return { cover, status: "selected", premium: inEstimate.premium };
    return { cover, status: "optional", premium: addOnPremium(cover.pricing, estimate) };
  });
  return { estimate, addOns: lines };
}

/* ── Filters ────────────────────────────────────────────────── */

export const FILTER_ADDON_KEYS = FILTER_ADDONS.map((a) => a.key);

export type SortKey = "premium" | "idv" | "garages";
export const SORT_LABEL: Record<SortKey, string> = { premium: "Lowest premium", idv: "Highest IDV", garages: "Most cashless garages" };

export interface MarketFilters {
  /** Company slugs (empty = all). */
  providers: string[];
  categories: InsProductCategory[];
  /** Indicative premium range (₹, incl. GST); null = any. */
  premium: [number, number] | null;
  idv: [number, number] | null;
  /** Standard add-on keys the plan must offer (they're also added to the estimate). */
  addOns: string[];
}

export const EMPTY_FILTERS: MarketFilters = { providers: [], categories: [], premium: null, idv: null, addOns: [] };

/** Comma-separated list param → sanitised values. */
export function listParam(v: string | string[] | null | undefined, allowed?: readonly string[], max = 12): string[] {
  const raw = Array.isArray(v) ? v.join(",") : (v ?? "");
  const out = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[a-zA-Z0-9_-]{1,80}$/.test(s) && (!allowed || allowed.includes(s)));
  return [...new Set(out)].slice(0, max);
}

/** Positive integer param, or null. */
export const idParam = (v: string | string[] | null | undefined) => {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isInteger(n) && n > 0 && n < 2 ** 31 ? n : null;
};

/* ── Display helpers (shared by every page) ────────────────────────────────────────── */

/** "1 yr OD + 3 yr TP" */
export function termLabel(pricing: Pick<ProductPricing, "odYears" | "tpYears">) {
  const parts: string[] = [];
  if (pricing.odYears > 0) parts.push(`${pricing.odYears} yr OD`);
  if (pricing.tpYears > 0) parts.push(`${pricing.tpYears} yr TP`);
  return parts.join(" + ") || "—";
}

/** "Comprehensive, Petrol · 2023 · 25% NCB" style one-liner for the vehicle bar. */
export function vehicleFacts(v: MarketVehicle): string[] {
  const out: string[] = [];
  if (v.variantName) out.push(v.variantName);
  if (v.fuel) out.push(v.fuel);
  out.push(v.isNew ? "New car" : `${v.year ?? ""}${v.yearAssumed ? " (assumed)" : ""}`.trim());
  if (v.search.reg) out.push(v.search.reg);
  if (!v.isNew) out.push(`${v.ncbPct}% NCB`);
  if (v.search.city) out.push(v.search.city);
  return out.filter(Boolean);
}

/** Notes about assumptions the estimate made for this car. */
export function vehicleAssumptions(v: MarketVehicle): string[] {
  const out: string[] = [];
  if (v.priceFromModel) out.push("No variant chosen — IDV uses the model's starting ex-showroom price.");
  if (v.fuelAssumed) out.push(`No fuel chosen — estimates assume ${v.fuel}.`);
  if (v.yearAssumed) out.push("Manufacturing year not given — estimates assume a car about a year old.");
  if (!v.isNew && v.search.ncb > 0 && v.ncbPct === 0) out.push(v.search.claimed ? "No NCB after a claim last year." : "No NCB — the previous policy lapsed over 90 days ago.");
  return out;
}
