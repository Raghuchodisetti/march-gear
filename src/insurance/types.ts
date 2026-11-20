import type { InsBusinessType, InsIntent, InsPolicyStatus, InsVendorCategory } from "@/db/enums";
import type { FileRef } from "@/partner/types";

/* ──────────────────────────────────────────────────────────────
   Shapes of the JSON documents the insurance marketplace stores.
   Client-safe (types only). See docs/insurance-marketplace.md.
   ────────────────────────────────────────────────────────────── */

export type { FileRef };

export type FuelName = "Petrol" | "Diesel" | "CNG" | "Hybrid" | "Electric";

/** A branch office, as entered in the registration wizard (becomes an ins_branches row on approval). */
export interface ApplicationBranch {
  /** Client-side key so rows survive reordering. */
  key: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pin: string;
  phone: string;
  email: string;
  isPrimary: boolean;
}

/** The 7-step vendor registration wizard's draft — autosaved as the vendor types. */
export interface InsurerApplication {
  /** Step 1 */
  contact: {
    name: string;
    designation: string;
    mobile: string;
    mobileVerified: boolean;
    email: string;
    emailVerified: boolean;
  };
  /** Step 2 */
  company: {
    legalName: string;
    /** Name shown to customers, e.g. "Acme General". */
    brandName: string;
    businessType: InsBusinessType | "";
    website: string;
    address: string;
    city: string;
    state: string;
    pin: string;
  };
  /** Step 3 */
  registration: {
    gstin: string;
    pan: string;
    /** CIN, LLPIN or other registration number. */
    cin: string;
    establishedOn: string; // YYYY-MM-DD or ""
  };
  /** Step 4 */
  regulatory: {
    category: InsVendorCategory | "";
    /** e.g. "IRDAI registration as a general insurer", "IRDAI direct broker (general)". */
    registrationType: string;
    licenceNumber: string;
    licenceValidUntil: string; // YYYY-MM-DD or ""
    representative: { name: string; designation: string; mobile: string; email: string };
    documents: FileRef[];
  };
  /** Step 5 */
  branches: ApplicationBranch[];
  /** Step 6. `accountNumber` is encrypted (encryptField) before it is stored; the browser only ever sees `accountMasked`. */
  bank: {
    holder: string;
    bankName: string;
    accountNumber: string;
    accountMasked: string;
    ifsc: string;
    proof: FileRef | null;
  };
  /** Step 7 */
  documents: {
    businessRegistration: FileRef | null;
    gst: FileRef | null;
    pan: FileRef | null;
    regulatory: FileRef | null;
    addressProof: FileRef | null;
    representativeId: FileRef | null;
    representativeAuthorisation: FileRef | null;
    supporting: FileRef[];
  };
  declaration: { accepted: boolean; name: string; acceptedAt: string | null };
}

/** The vendor's public-facing profile — editable any time without re-approval. */
export interface InsurerProfile {
  logo: string; // public /media URL or ""
  about: string;
  website: string;
  supportPhone: string;
  supportEmail: string;
  claimsPhone: string;
  claimsEmail: string;
  /** Free-text hours, e.g. "24×7" or "Mon–Sat, 9:30–18:30". */
  supportHours: string;
}

/** Claim figures shown publicly only when `verified` (set by MarchGear staff, with the source). */
export interface CompanyClaimInfo {
  settlementRatio: number | null; // percent
  year: string; // e.g. "FY 2024-25"
  source: string; // where the figure comes from
  verified: boolean;
  verifiedAt: string | null;
  verifiedBy: number | null;
  /** How to make a claim with this insurer (steps, one per line). */
  process: string[];
}

/** Which vehicles a product is sold for. Empty arrays mean "any". */
export interface ProductEligibility {
  /** Catalogue body types: "Hatchback" | "Sedan" | "SUV" | "MUV" | "Coupe". */
  bodyTypes: string[];
  luxury: "any" | "exclude" | "only";
  /** Catalogue brand slugs. */
  brands: string[];
  /** Catalogue car (model) slugs. */
  models: string[];
  fuels: FuelName[];
  /** Vehicle age in whole years at the policy start. */
  minAgeYears: number;
  maxAgeYears: number;
  /** Empty = all of India. */
  states: string[];
  cities: string[];
}

export interface ProductCoverage {
  ownDamage: boolean;
  thirdParty: boolean;
  /** Compulsory personal accident cover for the owner-driver. */
  paOwnerDriver: "included" | "optional" | "none";
  /** e.g. "₹7.5 lakh" — third-party property damage limit. */
  tpPropertyLimit: string;
  /** ins_covers ids of type "coverage" that come with the product. */
  coverIds: number[];
  /** Short selling points, one per line. */
  highlights: string[];
}

/** An add-on cover offered with a product. Its price comes from the cover's own pricing. */
export interface ProductAddOn {
  coverId: number;
  /** Bundled into the price vs. the customer chooses it. */
  included: boolean;
}

/** How the vendor prices the product. All premiums the site shows from this are indicative. */
export interface ProductPricing {
  /** Own-damage premium as a % of IDV per year (within the admin's allowed range). */
  odRatePct: number;
  /** Floor for the own-damage premium (₹). */
  minOdPremium: number;
  /** Customer may move IDV within this band around the computed value (e.g. -10 … +10). */
  idvMinPct: number;
  idvMaxPct: number;
  /** Policy term in years for own damage and third party (e.g. new car bundled = 1 OD + 3 TP). 0 = not covered. */
  odYears: number;
  tpYears: number;
  /** Optional flat adjustment applied to OD (negative = discount), in %. Usually 0. */
  odAdjustmentPct: number;
}

export interface ProductDeductibles {
  /** Compulsory deductible per claim (₹). */
  compulsory: number;
  /** Voluntary deductible options (₹) the customer may pick. */
  voluntary: number[];
}

/** Public product documents (private ins_files, downloadable only while the product is published). */
export interface ProductDocuments {
  brochure: FileRef | null;
  wording: FileRef | null;
  /** Intermediaries: the insurer's authorisation / tie-up letter. Never public. */
  tieUp: FileRef | null;
}

/** How an add-on or coverage item is priced for the indicative estimate. */
export interface CoverPricing {
  basis: "included" | "flat" | "pct_idv" | "pct_od";
  /** ₹ for flat, % for the percentage bases. */
  value: number;
}

/** The vehicle and situation a customer searches with (URL params of /insurance/quotes — see src/insurance/search.ts). */
export interface InsuranceSearch {
  intent: InsIntent;
  /** Registration number, upper-case without spaces, or "" (new car / not registered yet). */
  reg: string;
  brand: string; // catalogue brand slug
  model: string; // catalogue car slug
  variant: string; // variant slug
  year: number | null; // manufacturing year
  fuel: FuelName | "";
  city: string;
  state: string;
  policy: InsPolicyStatus | "";
  expiry: string; // YYYY-MM-DD or ""
  /** No-claim bonus the customer holds, in % (0, 20, 25, 35, 45, 50). */
  ncb: number;
  claimed: boolean;
}

/** One line of the indicative premium estimate. */
export interface EstimateAddOn {
  coverId: number | null;
  key: string;
  name: string;
  premium: number;
  included: boolean;
}

/** The estimator's result — always indicative (see src/insurance/estimator.ts). */
export interface PremiumEstimate {
  idv: number;
  idvMin: number;
  idvMax: number;
  odYears: number;
  tpYears: number;
  od: number; // own damage before NCB
  ncbPct: number;
  ncbDiscount: number;
  tp: number;
  pa: number;
  addOns: EstimateAddOn[];
  addOnsTotal: number;
  net: number;
  gstPct: number;
  gst: number;
  total: number;
  /** Notes such as "IDV for cars over 5 years is agreed with the insurer". */
  notes: string[];
}

/** A quotation's premium breakdown (vendor quote builder). Same shape as the estimate, plus the vendor's own adjustments. */
export interface QuoteBreakdown extends PremiumEstimate {
  /** Extra discount or loading the vendor applied to OD (₹, negative = discount). */
  adjustment: number;
  deductible: number;
}

export interface QuoteCoverLine {
  name: string;
  detail: string;
}

/** Fields in an ad creative's or campaign's link. */
export interface CampaignTarget {
  kind: "product" | "provider" | "page" | "url";
  /** Product reference, company slug, /path, or https:// URL. */
  value: string;
}
