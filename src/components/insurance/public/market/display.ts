import type { CoverPricing, ProductEligibility } from "@/insurance/types";

/* Plain-language descriptions of product terms (compare, product and provider pages). Client-safe. */

/** How an add-on is priced, in words ("0.32% of IDV a year"). */
export function pricingBasisLabel(p: CoverPricing): string {
  if (p.basis === "included") return "No extra premium";
  if (p.basis === "flat") return `₹${p.value.toLocaleString("en-IN")} a year`;
  if (p.basis === "pct_idv") return `${p.value}% of IDV a year`;
  return `${p.value}% of the own-damage premium`;
}

/** Who a product is for, in plain words. */
export function eligibilitySummary(e: ProductEligibility): { label: string; value: string }[] {
  const age =
    e.maxAgeYears === 0
      ? "New cars only"
      : e.minAgeYears > 0
        ? `${e.minAgeYears}–${e.maxAgeYears} years old`
        : `Up to ${e.maxAgeYears} year${e.maxAgeYears === 1 ? "" : "s"} old`;
  const out = [
    { label: "Car age", value: age },
    { label: "Fuel", value: e.fuels.length ? e.fuels.join(", ") : "All fuels" },
    { label: "Body type", value: e.bodyTypes.length ? e.bodyTypes.join(", ") : "All body types" },
  ];
  if (e.luxury !== "any") out.push({ label: "Luxury cars", value: e.luxury === "only" ? "Luxury cars only" : "Not for luxury cars" });
  if (e.brands.length || e.models.length) out.push({ label: "Makes", value: `Selected ${e.models.length ? "models" : "brands"} only` });
  out.push({ label: "Where", value: e.states.length || e.cities.length ? [...e.states, ...e.cities].join(", ") : "All of India" });
  return out;
}
