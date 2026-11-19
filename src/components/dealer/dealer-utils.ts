import type { Dealer } from "@/types";
import { brandName } from "@/data/brands";

/** "Hyundai · Authorised" or "Multi-brand · Pre-owned". */
export const dealerBrandLabel = (d: Pick<Dealer, "brand">) =>
  d.brand === "multi-brand" ? "Multi-brand · Pre-owned" : `${brandName(d.brand)} · Authorised`;
