import type { InsCoverStatus, InsCoverType, InsProductStatus } from "@/db/enums";
import type { CoverPricing, FuelName } from "@/insurance/types";
import type { StandardCover } from "@/insurance/covers";

/* ──────────────────────────────────────────────────────────────
   Coverage items and add-on covers in the vendor portal — shapes,
   limits and wording shared by the pages, the editor and the
   Server Actions (src/server/actions/ins-covers.ts). Client-safe.
   ────────────────────────────────────────────────────────────── */

export const COVER_MAX = { exclusions: 15, description: 2000, eligibility: 300, limits: 300, name: 120 };
export const COVER_MIN_DESCRIPTION = 20;

export const COVER_TYPE_META: Record<InsCoverType, { title: string; singular: string; plural: string; base: string; blurb: string }> = {
  coverage: {
    title: "Coverage",
    singular: "coverage item",
    plural: "coverage items",
    base: "/insurance-vendor/coverage",
    blurb: "What every policy of a product covers — own damage, third-party liability, theft, fire and so on. Products list these as their coverage.",
  },
  addon: {
    title: "Add-on covers",
    singular: "add-on cover",
    plural: "add-on covers",
    base: "/insurance-vendor/add-ons",
    blurb: "Optional or bundled extras such as zero depreciation, engine protection and roadside assistance, each with its own indicative price.",
  },
};

/** What the editor works with (numbers as typed). */
export interface CoverFormValue {
  key: string;
  name: string;
  description: string;
  eligibility: string;
  maxVehicleAgeYears: string;
  fuels: FuelName[];
  exclusions: string[];
  limits: string;
  pricing: { basis: CoverPricing["basis"]; value: string };
}

export const emptyCover = (type: InsCoverType): CoverFormValue => ({
  key: "custom",
  name: "",
  description: "",
  eligibility: "",
  maxVehicleAgeYears: "",
  fuels: [],
  exclusions: [],
  limits: "",
  pricing: type === "coverage" ? { basis: "included", value: "0" } : { basis: "flat", value: "" },
});

export function coverFromTemplate(t: StandardCover): CoverFormValue {
  return {
    key: t.key,
    name: t.name,
    description: t.summary,
    eligibility: t.typicalMaxAge ? `Cars up to ${t.typicalMaxAge} years old` : "",
    maxVehicleAgeYears: t.typicalMaxAge ? String(t.typicalMaxAge) : "",
    fuels: (t.fuels ?? []) as FuelName[],
    exclusions: [],
    limits: "",
    pricing: { basis: t.defaultPricing.basis, value: String(t.defaultPricing.value) },
  };
}

/** A cover as the list and the editor show it. */
export interface CoverView {
  id: number;
  type: InsCoverType;
  key: string;
  name: string;
  description: string;
  eligibility: string | null;
  maxVehicleAgeYears: number | null;
  fuels: string[];
  exclusions: string[];
  limits: string | null;
  pricing: CoverPricing;
  status: InsCoverStatus;
  adminRemarks: string | null;
  submittedAt: string | null;
  updatedAt: string;
  createdAt: string;
  /** Products of this vendor that use the cover. */
  usedBy: { id: number; reference: string; name: string; status: InsProductStatus }[];
  /** MarchGear approved it at some point (so it can only be archived, not deleted). */
  everApproved: boolean;
}

export const coverToForm = (c: CoverView): CoverFormValue => ({
  key: c.key,
  name: c.name,
  description: c.description,
  eligibility: c.eligibility ?? "",
  maxVehicleAgeYears: c.maxVehicleAgeYears === null ? "" : String(c.maxVehicleAgeYears),
  fuels: c.fuels as FuelName[],
  exclusions: c.exclusions,
  limits: c.limits ?? "",
  pricing: { basis: c.pricing.basis, value: String(c.pricing.value) },
});

/** Editing these sends the cover back to MarchGear (after a confirm). */
export const COVER_LIVE: InsCoverStatus[] = ["approved"];
/** Waiting for MarchGear — locked until decided (or withdrawn). */
export const COVER_LOCKED: InsCoverStatus[] = ["pending_approval"];
export const COVER_SUBMITTABLE: InsCoverStatus[] = ["draft", "changes_requested", "rejected"];

/** "₹199 a year", "0.35% of IDV", "12% of the OD premium", "Included". */
export function pricingSummary(p: CoverPricing) {
  const n = (v: number) => (Number.isInteger(v) ? v.toLocaleString("en-IN") : String(+v.toFixed(3)));
  if (p.basis === "included") return "Included";
  if (p.basis === "flat") return `₹${n(p.value)} a year`;
  if (p.basis === "pct_idv") return `${n(p.value)}% of IDV a year`;
  return `${n(p.value)}% of the OD premium`;
}

/** Allowed values per pricing basis (validated on the server too). */
export const PRICING_RANGE: Record<CoverPricing["basis"], { min: number; max: number; step: number; unit: string }> = {
  included: { min: 0, max: 0, step: 1, unit: "" },
  flat: { min: 1, max: 100_000, step: 1, unit: "₹" },
  pct_idv: { min: 0.01, max: 10, step: 0.01, unit: "%" },
  pct_od: { min: 0.1, max: 100, step: 0.1, unit: "%" },
};
