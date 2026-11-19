import type { BrandSegment } from "@/lib/catalog";

// Line-up statistics (brandSummary / brandSummaries) live on the catalogue.

export const SEGMENTS: { value: BrandSegment; label: string }[] = [
  { value: "all", label: "All brands" },
  { value: "mainstream", label: "Mainstream" },
  { value: "luxury", label: "Luxury" },
  { value: "electric", label: "Electric-first" },
];

/** The marque given the featured banner on /brands. */
export const FEATURED_BRAND = "porsche";
