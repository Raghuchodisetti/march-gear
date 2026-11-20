import type { OfferStatus } from "@/db/enums";
import type { OfferCategory, OfferDiscount, OfferLocations, OfferMedia, OfferScope } from "@/partner/types";
import type { OfferDisplayStatus } from "@/partner/labels";

/* What the offer editor sends to the server, and the shapes the portal pages pass to client components. Client-safe. */

export interface OfferInput {
  title: string;
  campaignName: string;
  category: OfferCategory | "";
  description: string;
  tagline: string;
  terms: string;
  scope: OfferScope;
  discount: OfferDiscount;
  /** IST wall-clock date/time as typed; the server stores UTC. */
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  limitedStock: number | null;
  maxRedemptions: number | null;
  media: OfferMedia;
  locations: OfferLocations;
}

/** Stored statuses the dealer edits with autosave (nothing is public yet). */
export const OFFER_DRAFT_STATUSES: OfferStatus[] = ["draft", "changes_requested"];
/** Approved (scheduled/active/expired) or paused: edits go back to MarchGear before they replace the live offer. */
export const OFFER_LIVE_STATUSES: OfferStatus[] = ["approved", "paused"];
/** Waiting on MarchGear. */
export const OFFER_REVIEW_STATUSES: OfferStatus[] = ["submitted", "pending_approval"];

/** Sections A–G of the offer form. */
export const OFFER_STEPS = [
  { key: "basics", letter: "A", title: "Basic information", hint: "Title, category, story and terms" },
  { key: "vehicles", letter: "B", title: "Vehicle selection", hint: "Brands, models and variants" },
  { key: "discount", letter: "C", title: "Discount configuration", hint: "Benefits customers receive" },
  { key: "validity", letter: "D", title: "Offer validity", hint: "Dates, stock and redemptions" },
  { key: "media", letter: "E", title: "Promotional media", hint: "Banners, gallery, video, brochure" },
  { key: "location", letter: "F", title: "Location", hint: "Where the offer is valid" },
  { key: "review", letter: "G", title: "Review & submit", hint: "Preview and send for approval" },
] as const;
export type OfferStepKey = (typeof OFFER_STEPS)[number]["key"];

/** Which section a server field-error path belongs to. */
export function stepOfField(path: string): OfferStepKey {
  if (path.startsWith("scope")) return "vehicles";
  if (path.startsWith("discount")) return "discount";
  if (/^(startsAt|endsAt|startDate|startTime|endDate|endTime|limitedStock|maxRedemptions)/.test(path)) return "validity";
  if (path.startsWith("media")) return "media";
  if (path.startsWith("locations")) return "location";
  if (path === "confirmTerms" || path === "form") return "review";
  return "basics";
}

/** One offer as the list, campaign and picker views need it (dates as ISO strings). */
export interface OfferListItem {
  id: number;
  reference: string;
  title: string;
  campaignName: string;
  category: string;
  categoryLabel: string;
  tagline: string;
  status: OfferStatus;
  display: OfferDisplayStatus;
  startsAt: string;
  endsAt: string;
  image: string;
  headline: string;
  benefits: number;
  vehicleLabel: string;
  locationLabel: string;
  views: number;
  enquiries: number;
  conversions: number;
  limitedStock: number | null;
  maxRedemptions: number | null;
  redemptions: number;
  adminRemarks: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  updatedAt: string;
}

/** Brand → models → variants the dealer may target, from its authorisations and the catalogue. */
export interface EditorBrand {
  slug: string;
  name: string;
  /** "approved" brands can be used for new cars; others are shown as pending. */
  authorised: boolean;
  status: string;
  models: { slug: string; name: string; variants: { slug: string; name: string }[] }[];
}

export interface EditorOptions {
  brands: EditorBrand[];
  /** Every catalogue brand (for used-car offers, which don't need an authorisation). */
  catalogueBrands: EditorBrand[];
  showrooms: { id: number; name: string; city: string; state: string; address: string }[];
  citySuggestions: string[];
  dealerName: string;
  dealerCity: string;
}

export interface OfferTemplateView {
  key: string;
  name: string;
  category: OfferCategory;
  categoryLabel: string;
  blurb: string;
  windowLabel: string;
  dateNote: string;
  tone: "red" | "ink" | "gold" | "green" | "blue" | "violet";
}

export interface ApprovalEntry {
  id: number;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  remarks: string | null;
  actorSide: "dealer" | "admin" | "system";
  actorName: string | null;
  createdAt: string;
}
