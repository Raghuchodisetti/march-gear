import type { z } from "zod";
import { site } from "./blocks/site";
import { announcements } from "./blocks/announcements";
import { homeHero } from "./blocks/home-hero";
import { homeCategories } from "./blocks/home-categories";
import { comparisons } from "./blocks/comparisons";
import { about } from "./blocks/about";
import { sell } from "./blocks/sell";
import { legal } from "./blocks/legal";
import { pdiPlans } from "./blocks/pdi-plans";
import { pdiChecklist } from "./blocks/pdi-checklist";
import { pdiPage } from "./blocks/pdi-page";
import { cities } from "./blocks/cities";
import { toolRates } from "./blocks/tool-rates";
import { reviewsFeatured } from "./blocks/reviews-featured";
import { billing } from "./blocks/billing";
import { partnerPlans } from "./blocks/partner-plans";
import { insurancePage } from "./blocks/insurance-page";
import { insuranceGuides } from "./blocks/insurance-guides";
import { insurancePricing } from "./blocks/insurance-pricing";
import { insuranceSettings } from "./blocks/insurance-settings";
import { insurerPlans } from "./blocks/insurer-plans";

/* Every editable content block. Server-only at runtime — public code may import the types. */
export const BLOCKS = { site, announcements, homeHero, homeCategories, comparisons, about, sell, legal, pdiPlans, pdiChecklist, pdiPage, cities, toolRates, reviewsFeatured,
  billing,
  partnerPlans,
  insurancePage,
  insuranceGuides,
  insurancePricing,
  insuranceSettings,
  insurerPlans,
} as const;

export type BlockKey = keyof typeof BLOCKS;
export const BLOCK_KEYS = Object.keys(BLOCKS) as BlockKey[];
// Own keys only: `in` would also accept inherited names like "toString" or "__proto__".
export const isBlockKey = (k: string): k is BlockKey => Object.hasOwn(BLOCKS, k);

/** The parsed value of every block — what public pages read. */
export type SiteContent = { [K in BlockKey]: z.output<(typeof BLOCKS)[K]["schema"]> };
