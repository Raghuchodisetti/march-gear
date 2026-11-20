import type { InsCoverStatus, InsCoverType, InsProductCategory, InsProductStatus, InsVendorCategory } from "@/db/enums";
import { CATEGORY_TERMS, DEFAULT_PRODUCT_PRICING, pricingConfigFrom, type PricingBlock, type PricingConfig } from "@/insurance/estimator";
import type { CoverPricing, FuelName, ProductAddOn, ProductCoverage, ProductDeductibles, ProductDocuments, ProductEligibility, ProductPricing } from "@/insurance/types";

/* ──────────────────────────────────────────────────────────────
   Insurance products in the vendor portal — the form's shape, the
   rules both the form and the Server Actions apply, and the views
   the list and detail pages render. Client-safe.
   ────────────────────────────────────────────────────────────── */

export const BODY_TYPES = ["Hatchback", "Sedan", "SUV", "MUV", "Coupe"] as const;

export const PRODUCT_MAX = {
  name: 160,
  code: 40,
  uin: 60,
  tagline: 200,
  description: 5000,
  highlights: 8,
  exclusions: 20,
  voluntary: 6,
  terms: 8000,
  brands: 80,
  models: 300,
  states: 40,
  cities: 300,
  tpLimit: 60,
};
export const MIN_DESCRIPTION = 80;
export const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{1,39}$/;

/** Ranges the form and the server both enforce (OD rate comes from the pricing config). */
export const PRICING_LIMITS = {
  minOdPremium: { min: 0, max: 100_000 },
  idvMinPct: { min: -30, max: 0 },
  idvMaxPct: { min: 0, max: 30 },
  odYears: { min: 0, max: 5 },
  tpYears: { min: 0, max: 5 },
  odAdjustmentPct: { min: -50, max: 50 },
  deductible: { min: 0, max: 100_000 },
  garages: { min: 0, max: 100_000 },
};

/** Statuses: live ones go back to review when edited; locked ones can't be edited. */
export const PRODUCT_LIVE: InsProductStatus[] = ["approved", "published"];
export const PRODUCT_IN_REVIEW: InsProductStatus[] = ["submitted", "pending_approval"];
export const PRODUCT_LOCKED: InsProductStatus[] = ["submitted", "pending_approval", "suspended"];
export const PRODUCT_SUBMITTABLE: InsProductStatus[] = ["draft", "changes_requested", "rejected"];
export const PRODUCT_ATTENTION: InsProductStatus[] = ["changes_requested", "rejected"];

/** The estimator config from the `insurancePricing` block (the shared foundation helper fills the gaps). */
export const pricingConfigOf = (block: PricingBlock | null | undefined): PricingConfig => pricingConfigFrom(block);

/** Only insurers underwrite; every other category distributes an insurer's products. */
export const isIntermediary = (c: InsVendorCategory | null) => c !== "insurer";

export interface ProductFormValue {
  name: string;
  code: string;
  uin: string;
  category: InsProductCategory;
  tagline: string;
  description: string;
  companyId: string;
  eligibility: {
    bodyTypes: string[];
    luxury: ProductEligibility["luxury"];
    brands: string[];
    models: string[];
    fuels: FuelName[];
    minAgeYears: string;
    maxAgeYears: string;
    states: string[];
    cities: string[];
  };
  coverage: {
    ownDamage: boolean;
    thirdParty: boolean;
    paOwnerDriver: ProductCoverage["paOwnerDriver"];
    tpPropertyLimit: string;
    coverIds: number[];
    highlights: string[];
  };
  addOns: ProductAddOn[];
  pricing: { odRatePct: string; minOdPremium: string; idvMinPct: string; idvMaxPct: string; odYears: string; tpYears: string; odAdjustmentPct: string };
  deductibles: { compulsory: string; voluntary: number[] };
  garageCount: string;
  exclusions: string[];
  documents: ProductDocuments;
  terms: string;
}

const s = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

export function pricingToForm(p: ProductPricing): ProductFormValue["pricing"] {
  return { odRatePct: s(p.odRatePct), minOdPremium: s(p.minOdPremium), idvMinPct: s(p.idvMinPct), idvMaxPct: s(p.idvMaxPct), odYears: s(p.odYears), tpYears: s(p.tpYears), odAdjustmentPct: s(p.odAdjustmentPct) };
}

/** OD/TP flags and owner-driver PA a category implies. */
export function coverageForCategory(category: InsProductCategory) {
  const t = CATEGORY_TERMS[category];
  return { ownDamage: t.odYears > 0, thirdParty: t.tpYears > 0, paOwnerDriver: (t.tpYears > 0 ? "included" : "none") as ProductCoverage["paOwnerDriver"] };
}

export function emptyProduct(category: InsProductCategory, config: PricingConfig, companyId: number | null): ProductFormValue {
  return {
    name: "",
    code: "",
    uin: "",
    category,
    tagline: "",
    description: "",
    companyId: companyId ? String(companyId) : "",
    eligibility: { bodyTypes: [], luxury: "any", brands: [], models: [], fuels: [], minAgeYears: "0", maxAgeYears: String(config.maxVehicleAgeYears), states: [], cities: [] },
    coverage: { ...coverageForCategory(category), tpPropertyLimit: CATEGORY_TERMS[category].tpYears > 0 ? "₹7.5 lakh" : "", coverIds: [], highlights: [] },
    addOns: [],
    pricing: pricingToForm(DEFAULT_PRODUCT_PRICING(category, config)),
    deductibles: { compulsory: "1000", voluntary: [] },
    garageCount: "",
    exclusions: [],
    documents: { brochure: null, wording: null, tieUp: null },
    terms: "",
  };
}

/** The columns of an ins_products row the form needs. */
export interface ProductRowLike {
  name: string;
  code: string;
  uin: string | null;
  category: InsProductCategory;
  tagline: string | null;
  description: string;
  companyId: number;
  eligibility: ProductEligibility;
  coverage: ProductCoverage;
  addOns: ProductAddOn[];
  pricing: ProductPricing;
  deductibles: ProductDeductibles;
  garageCount: number | null;
  exclusions: string[];
  documents: ProductDocuments;
  terms: string | null;
}

export function productToForm(p: ProductRowLike): ProductFormValue {
  const e = p.eligibility;
  return {
    name: p.name,
    code: p.code,
    uin: p.uin ?? "",
    category: p.category,
    tagline: p.tagline ?? "",
    description: p.description,
    companyId: String(p.companyId),
    eligibility: {
      bodyTypes: e.bodyTypes ?? [],
      luxury: e.luxury ?? "any",
      brands: e.brands ?? [],
      models: e.models ?? [],
      fuels: e.fuels ?? [],
      minAgeYears: s(e.minAgeYears),
      maxAgeYears: s(e.maxAgeYears),
      states: e.states ?? [],
      cities: e.cities ?? [],
    },
    coverage: {
      ownDamage: p.coverage.ownDamage,
      thirdParty: p.coverage.thirdParty,
      paOwnerDriver: p.coverage.paOwnerDriver,
      tpPropertyLimit: p.coverage.tpPropertyLimit ?? "",
      coverIds: p.coverage.coverIds ?? [],
      highlights: p.coverage.highlights ?? [],
    },
    addOns: p.addOns ?? [],
    pricing: pricingToForm(p.pricing),
    deductibles: { compulsory: s(p.deductibles.compulsory), voluntary: p.deductibles.voluntary ?? [] },
    garageCount: s(p.garageCount),
    exclusions: p.exclusions ?? [],
    documents: { brochure: p.documents?.brochure ?? null, wording: p.documents?.wording ?? null, tieUp: p.documents?.tieUp ?? null },
    terms: p.terms ?? "",
  };
}

/** "12,50,000" / "2.8" / "-10" as typed → number, or null when empty or not a number. */
export function toNum(v: string): number | null {
  const t = v.replace(/[,\s₹%]/g, "");
  if (!t || !/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

/** The pricing as numbers, falling back to the defaults for anything not filled in (for the preview). */
export function formPricing(v: ProductFormValue, config: PricingConfig): ProductPricing {
  const d = DEFAULT_PRODUCT_PRICING(v.category, config);
  const n = (x: string, fb: number) => toNum(x) ?? fb;
  return {
    odRatePct: n(v.pricing.odRatePct, d.odRatePct),
    minOdPremium: n(v.pricing.minOdPremium, d.minOdPremium),
    idvMinPct: n(v.pricing.idvMinPct, d.idvMinPct),
    idvMaxPct: n(v.pricing.idvMaxPct, d.idvMaxPct),
    odYears: v.coverage.ownDamage ? Math.max(1, Math.round(n(v.pricing.odYears, d.odYears || 1))) : 0,
    tpYears: v.coverage.thirdParty ? Math.max(1, Math.round(n(v.pricing.tpYears, d.tpYears || 1))) : 0,
    odAdjustmentPct: n(v.pricing.odAdjustmentPct, 0),
  };
}

/* ── Options the form picks from ────────────────────────────── */

export interface CoverOption {
  id: number;
  type: InsCoverType;
  key: string;
  name: string;
  description: string;
  status: InsCoverStatus;
  pricing: CoverPricing;
  maxVehicleAgeYears: number | null;
  fuels: string[];
}

export interface CompanyOption {
  id: number;
  name: string;
  shortName: string | null;
  isActive: boolean;
  /** The insurer's cashless network as MarchGear lists it, e.g. "1,200 garages · Across 300 cities". */
  garages: string | null;
}

/* ── Readiness (mirrors the server's submit check) ──────────── */

export const SECTIONS = [
  { key: "basics", label: "Basics" },
  { key: "insurer", label: "Underwriting insurer" },
  { key: "eligibility", label: "Vehicle eligibility" },
  { key: "coverage", label: "Coverage" },
  { key: "addons", label: "Add-on covers" },
  { key: "pricing", label: "Pricing" },
  { key: "deductibles", label: "Deductibles" },
  { key: "garages", label: "Cashless garages" },
  { key: "exclusions", label: "Exclusions" },
  { key: "documents", label: "Documents" },
  { key: "terms", label: "Terms and conditions" },
] as const;
export type SectionKey = (typeof SECTIONS)[number]["key"];

/** Which section each server field error belongs to (for the nav and scrolling). */
export function sectionOf(field: string): SectionKey {
  const head = field.split(".")[0];
  if (["name", "code", "uin", "category", "tagline", "description"].includes(head)) return "basics";
  if (head === "companyId" || field === "documents.tieUp") return "insurer";
  if (head === "eligibility") return "eligibility";
  if (head === "coverage") return "coverage";
  if (head === "addOns") return "addons";
  if (head === "pricing") return "pricing";
  if (head === "deductibles") return "deductibles";
  if (head === "garageCount") return "garages";
  if (head === "exclusions") return "exclusions";
  if (head === "documents") return "documents";
  return "terms";
}

const BLOCKING_COVER: InsCoverStatus[] = ["draft", "changes_requested", "rejected"];

export function readiness(v: ProductFormValue, o: { intermediary: boolean; covers: CoverOption[]; config: PricingConfig }): Record<SectionKey, { ok: boolean; note: string }> {
  const num = (x: string) => toNum(x);
  const min = num(v.eligibility.minAgeYears);
  const max = num(v.eligibility.maxAgeYears);
  const od = num(v.pricing.odRatePct);
  const blockingOf = (ids: number[]) => ids.map((id) => o.covers.find((c) => c.id === id)).filter((c): c is CoverOption => Boolean(c) && BLOCKING_COVER.includes(c!.status));
  const blockingItems = blockingOf(v.coverage.coverIds);
  const blocking = blockingOf(v.addOns.map((a) => a.coverId));
  const catTerms = CATEGORY_TERMS[v.category];
  const catOk = (catTerms.odYears === 0 ? !v.coverage.ownDamage : true) && (catTerms.tpYears === 0 ? !v.coverage.thirdParty : true);
  return {
    basics: {
      ok: v.name.trim().length >= 3 && CODE_PATTERN.test(v.code.trim()) && v.description.trim().length >= MIN_DESCRIPTION,
      note: v.description.trim().length < MIN_DESCRIPTION ? `Description needs ${MIN_DESCRIPTION}+ characters` : "Name, code and description",
    },
    insurer: { ok: Boolean(v.companyId) && (!o.intermediary || Boolean(v.documents.tieUp)), note: o.intermediary && !v.documents.tieUp ? "Upload the tie-up letter" : "Insurer chosen" },
    eligibility: { ok: min !== null && max !== null && min >= 0 && max >= min && max <= o.config.maxVehicleAgeYears, note: "Car age range" },
    coverage: {
      ok: (v.coverage.ownDamage || v.coverage.thirdParty) && catOk && (v.coverage.thirdParty || v.coverage.paOwnerDriver === "none") && blockingItems.length === 0,
      note: blockingItems.length ? `${blockingItems.length} coverage item${blockingItems.length === 1 ? "" : "s"} not submitted` : "OD / TP cover",
    },
    addons: { ok: blocking.length === 0, note: blocking.length ? `${blocking.length} cover${blocking.length === 1 ? "" : "s"} not submitted` : "Optional" },
    pricing: {
      ok: !v.coverage.ownDamage || (od !== null && od >= o.config.odRate.min && od <= o.config.odRate.max && num(v.pricing.minOdPremium) !== null),
      note: `OD rate ${o.config.odRate.min}–${o.config.odRate.max}%`,
    },
    deductibles: { ok: num(v.deductibles.compulsory) !== null, note: "Compulsory deductible" },
    garages: { ok: true, note: "Optional" },
    exclusions: { ok: v.exclusions.length > 0, note: "At least one" },
    documents: { ok: Boolean(v.documents.wording), note: "Policy wording PDF" },
    terms: { ok: true, note: "Optional" },
  };
}

/* ── Views ──────────────────────────────────────────────────── */

export interface ProductListRow {
  id: number;
  reference: string;
  code: string;
  name: string;
  category: InsProductCategory;
  status: InsProductStatus;
  companyName: string;
  adminRemarks: string | null;
  views: number;
  enquiries: number;
  everSubmitted: boolean;
  updatedAt: string;
  publicHref: string | null;
}

export const PRODUCT_SORTS = [
  { value: "updated", label: "Last updated" },
  { value: "created", label: "Date created" },
  { value: "name", label: "Name" },
  { value: "views", label: "Views" },
  { value: "enquiries", label: "Enquiries" },
] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number]["value"];

export const PRODUCT_TABS = [
  { value: "all", label: "All", statuses: [] as InsProductStatus[] },
  { value: "live", label: "Published", statuses: ["published"] as InsProductStatus[] },
  { value: "approved", label: "Approved", statuses: ["approved"] as InsProductStatus[] },
  { value: "review", label: "In review", statuses: ["submitted", "pending_approval"] as InsProductStatus[] },
  { value: "attention", label: "Needs changes", statuses: ["changes_requested", "rejected"] as InsProductStatus[] },
  { value: "draft", label: "Drafts", statuses: ["draft"] as InsProductStatus[] },
  { value: "suspended", label: "Suspended", statuses: ["suspended"] as InsProductStatus[] },
] as const;
export type ProductTab = (typeof PRODUCT_TABS)[number]["value"];

export const publicProductHref = (reference: string) => `/insurance/products/${encodeURIComponent(reference)}`;
