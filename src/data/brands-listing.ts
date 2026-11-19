import type { Brand } from "@/types";
import { brands } from "./brands";
import { carsByBrand, isElectric } from "./cars";
import { upcomingCars } from "./upcoming";

export type BrandSegment = "all" | "mainstream" | "luxury" | "electric";

export interface BrandSummary {
  brand: Brand;
  models: number;
  evs: number;
  upcoming: number;
  /** Lowest ex-showroom price across the line-up, if any models are on sale */
  startingPrice?: number;
  segments: BrandSegment[];
}

/** Line-up statistics for a brand, derived from the demo catalogue. */
export function brandSummary(brand: Brand): BrandSummary {
  const line = carsByBrand(brand.slug);
  const evs = line.filter(isElectric).length;
  const segments: BrandSegment[] = ["all", brand.isLuxury ? "luxury" : "mainstream"];
  // "Electric-first": at least half of the current line-up is battery-electric.
  if (line.length > 0 && evs / line.length >= 0.5) segments.push("electric");
  return {
    brand,
    models: line.length,
    evs,
    upcoming: upcomingCars.filter((c) => c.brand === brand.slug).length,
    startingPrice: line.length ? Math.min(...line.map((c) => c.priceMin)) : undefined,
    segments,
  };
}

export const brandSummaries = () => brands.map(brandSummary).sort((a, b) => a.brand.name.localeCompare(b.brand.name));

export const SEGMENTS: { value: BrandSegment; label: string }[] = [
  { value: "all", label: "All brands" },
  { value: "mainstream", label: "Mainstream" },
  { value: "luxury", label: "Luxury" },
  { value: "electric", label: "Electric-first" },
];

/** The marque given the featured banner on /brands. */
export const FEATURED_BRAND = "porsche";
