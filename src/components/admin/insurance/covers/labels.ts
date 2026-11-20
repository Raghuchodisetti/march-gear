import type { CoverPricing } from "@/insurance/types";

/* Client-safe wording for covers. */

/** How a cover is priced for indicative estimates, in plain words. */
export const coverPricingLabel = (p: CoverPricing) =>
  p.basis === "included" ? "Included — no extra premium" : p.basis === "flat" ? `₹${Math.round(p.value).toLocaleString("en-IN")} a year` : p.basis === "pct_idv" ? `${p.value}% of IDV a year` : `${p.value}% of the own-damage premium`;
