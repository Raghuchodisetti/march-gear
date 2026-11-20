import type { AdAudience, AdFormat } from "@/db/enums";

/* ──────────────────────────────────────────────────────────────
   Ad placements rendered by the site. Each key has an <AdSlot>
   somewhere in the code; staff set the name, price, rotation and
   availability in /admin/advertising/placements (ad_placements,
   seeded from this list on first use). Client-safe.
   ────────────────────────────────────────────────────────────── */

export interface PlacementDefinition {
  key: string;
  name: string;
  description: string;
  location: string;
  format: AdFormat;
  desktopSize: string | null;
  mobileSize: string | null;
  /** Launch price per day (₹, before GST) — staff change it in the admin. */
  pricePerDay: number;
  minDays: number;
  maxDays: number;
  slots: number;
  audience: AdAudience;
  sortOrder: number;
}

export const PLACEMENTS = [
  {
    key: "home_banner",
    name: "Homepage banner",
    description: "Full-width banner on the MarchGear homepage.",
    location: "Homepage, between the featured sections",
    format: "banner",
    desktopSize: "1600×400",
    mobileSize: "800×600",
    pricePerDay: 6000,
    minDays: 7,
    maxDays: 60,
    slots: 2,
    audience: "all",
    sortOrder: 1,
  },
  {
    key: "insurance_home_banner",
    name: "Insurance homepage banner",
    description: "Banner on the /insurance homepage, below the quote form.",
    location: "/insurance, below the hero",
    format: "banner",
    desktopSize: "1600×400",
    mobileSize: "800×600",
    pricePerDay: 3500,
    minDays: 7,
    maxDays: 90,
    slots: 3,
    audience: "insurer",
    sortOrder: 2,
  },
  {
    key: "insurance_category_banner",
    name: "Insurance category banner",
    description: "Banner on the insurance category pages (types, new car, renewal, used car, EV, add-ons, claims, guides).",
    location: "Insurance category pages",
    format: "banner",
    desktopSize: "1600×400",
    mobileSize: "800×600",
    pricePerDay: 2000,
    minDays: 7,
    maxDays: 90,
    slots: 3,
    audience: "insurer",
    sortOrder: 3,
  },
  {
    key: "insurance_sponsored_listing",
    name: "Sponsored insurance listing",
    description: "A published product shown first, marked Sponsored, in quote results and on the compare page.",
    location: "/insurance/quotes and /insurance/compare results",
    format: "sponsored_listing",
    desktopSize: null,
    mobileSize: null,
    pricePerDay: 1500,
    minDays: 7,
    maxDays: 90,
    slots: 2,
    audience: "insurer",
    sortOrder: 4,
  },
] as const satisfies readonly PlacementDefinition[];

export type PlacementKey = (typeof PLACEMENTS)[number]["key"];
export const PLACEMENT_KEYS = PLACEMENTS.map((p) => p.key) as PlacementKey[];
