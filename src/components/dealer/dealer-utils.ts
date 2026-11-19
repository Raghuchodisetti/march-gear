import type { Dealer } from "@/types";

/** "Hyundai · Authorised" or "Multi-brand · Pre-owned". */
export const dealerBrandLabel = (d: Pick<Dealer, "brand">, brandName: (slug: string) => string) =>
  d.brand === "multi-brand" ? "Multi-brand · Pre-owned" : `${brandName(d.brand)} · Authorised`;
