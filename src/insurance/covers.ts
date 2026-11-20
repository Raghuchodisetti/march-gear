import type { InsCoverType } from "@/db/enums";
import type { CoverPricing } from "./types";

/* ──────────────────────────────────────────────────────────────
   Standard coverage items and add-on covers. Vendors create their
   own ins_covers rows from these (or "custom"); the key lets the
   public site filter and compare like with like across insurers.
   Descriptions are generic explanations, not any insurer's terms.
   Client-safe.
   ────────────────────────────────────────────────────────────── */

export interface StandardCover {
  key: string;
  type: InsCoverType;
  name: string;
  /** One-line explanation for customers. */
  summary: string;
  /** Typical pricing basis for the indicative estimate when the vendor hasn't set one. */
  defaultPricing: CoverPricing;
  /** Usually only offered on cars up to this age (years). */
  typicalMaxAge?: number;
  /** Only relevant for these fuels (empty = all). */
  fuels?: string[];
  /** Shown as a filter on /insurance/compare and /insurance/quotes. */
  filter?: boolean;
}

export const STANDARD_COVERS: StandardCover[] = [
  // Add-ons
  {
    key: "zero_dep",
    type: "addon",
    name: "Zero depreciation",
    summary: "Claims are paid without deducting depreciation on replaced parts like plastic, rubber and metal.",
    defaultPricing: { basis: "pct_idv", value: 0.35 },
    typicalMaxAge: 5,
    filter: true,
  },
  {
    key: "engine_protection",
    type: "addon",
    name: "Engine protection",
    summary: "Covers engine and gearbox damage from water ingress or oil leakage, which standard policies exclude.",
    defaultPricing: { basis: "pct_idv", value: 0.1 },
    typicalMaxAge: 7,
    fuels: ["Petrol", "Diesel", "CNG", "Hybrid"],
    filter: true,
  },
  {
    key: "rsa",
    type: "addon",
    name: "Roadside assistance",
    summary: "Towing, flat-tyre help, battery jump-start, fuel delivery and on-spot minor repairs.",
    defaultPricing: { basis: "flat", value: 199 },
    filter: true,
  },
  {
    key: "rti",
    type: "addon",
    name: "Return to invoice",
    summary: "On total loss or theft, pays the car's invoice value (with road tax and registration) instead of only the IDV.",
    defaultPricing: { basis: "pct_idv", value: 0.12 },
    typicalMaxAge: 3,
    filter: true,
  },
  {
    key: "consumables",
    type: "addon",
    name: "Consumables cover",
    summary: "Pays for nuts, bolts, engine oil, coolant and other consumables used during a repair.",
    defaultPricing: { basis: "pct_idv", value: 0.07 },
    typicalMaxAge: 5,
    filter: true,
  },
  {
    key: "key_replacement",
    type: "addon",
    name: "Key replacement",
    summary: "Covers the cost of replacing lost or stolen keys, including re-programming and lock sets.",
    defaultPricing: { basis: "flat", value: 249 },
  },
  {
    key: "pa_cover",
    type: "addon",
    name: "Personal accident cover",
    summary: "Extra personal accident cover for passengers or a higher sum insured for the owner-driver.",
    defaultPricing: { basis: "flat", value: 150 },
  },
  {
    key: "tyre_protection",
    type: "addon",
    name: "Tyre protection",
    summary: "Covers repair or replacement of tyres and tubes damaged in an accident, bulge or cut.",
    defaultPricing: { basis: "pct_idv", value: 0.05 },
    typicalMaxAge: 3,
  },
  {
    key: "electrical_accessories",
    type: "addon",
    name: "Electrical accessories",
    summary: "Covers fitted electrical and electronic accessories (music system, lights, cameras) declared on the policy.",
    defaultPricing: { basis: "flat", value: 400 },
  },
  {
    key: "ncb_protect",
    type: "addon",
    name: "NCB protection",
    summary: "Keeps your no-claim bonus even after a claim (usually one claim a year).",
    defaultPricing: { basis: "pct_od", value: 12 },
  },
  {
    key: "personal_belongings",
    type: "addon",
    name: "Loss of personal belongings",
    summary: "Pays for personal items lost from the car through theft or an accident.",
    defaultPricing: { basis: "flat", value: 200 },
  },
  {
    key: "ev_battery",
    type: "addon",
    name: "EV battery protection",
    summary: "Covers the traction battery, motor and charger against water ingress and electrical short circuit.",
    defaultPricing: { basis: "pct_idv", value: 0.15 },
    fuels: ["Electric"],
  },
  // Coverage items
  {
    key: "own_damage",
    type: "coverage",
    name: "Own damage",
    summary: "Damage to your car from accidents, fire, theft, natural and man-made calamities.",
    defaultPricing: { basis: "included", value: 0 },
  },
  {
    key: "third_party",
    type: "coverage",
    name: "Third-party liability",
    summary: "Legal liability for injury or death of others and damage to their property — required by law.",
    defaultPricing: { basis: "included", value: 0 },
  },
  {
    key: "pa_owner_driver",
    type: "coverage",
    name: "Owner-driver personal accident",
    summary: "Compulsory personal accident cover for the registered owner-driver.",
    defaultPricing: { basis: "included", value: 0 },
  },
  {
    key: "natural_calamity",
    type: "coverage",
    name: "Natural calamities",
    summary: "Flood, cyclone, earthquake, landslide and similar events.",
    defaultPricing: { basis: "included", value: 0 },
  },
  {
    key: "theft",
    type: "coverage",
    name: "Theft and burglary",
    summary: "Theft of the car, or damage caused during an attempted theft.",
    defaultPricing: { basis: "included", value: 0 },
  },
  {
    key: "fire",
    type: "coverage",
    name: "Fire and explosion",
    summary: "Damage from fire, explosion, self-ignition and lightning.",
    defaultPricing: { basis: "included", value: 0 },
  },
];

export const STANDARD_COVER_BY_KEY: Record<string, StandardCover> = Object.fromEntries(STANDARD_COVERS.map((c) => [c.key, c]));
export const STANDARD_ADDONS = STANDARD_COVERS.filter((c) => c.type === "addon");
export const STANDARD_COVERAGE = STANDARD_COVERS.filter((c) => c.type === "coverage");
/** The add-ons customers can filter by (compare and quotes pages). */
export const FILTER_ADDONS = STANDARD_ADDONS.filter((c) => c.filter);

export const COVER_PRICING_BASIS_LABEL: Record<CoverPricing["basis"], string> = {
  included: "Included — no extra premium",
  flat: "Flat amount per year (₹)",
  pct_idv: "% of IDV per year",
  pct_od: "% of own-damage premium",
};
