import type { InsIntent, InsLeadEventKind, InsLeadStatus, InsPolicyStatus, InsQuoteAuthorization, InsQuoteStatus, InsRenewalStatus, InsRole } from "@/db/enums";
import type { PremiumEstimate } from "@/insurance/types";

/* ──────────────────────────────────────────────────────────────
   Insurance vendor CRM: shapes passed from server to client and
   the small constants the CRM screens and their Server Actions
   share. Client-safe.
   ────────────────────────────────────────────────────────────── */

/** Enquiry sources (free text in the database) → labels. Unknown sources are humanised. */
export const INS_SOURCE_LABEL: Record<string, string> = {
  compare: "Compare page",
  quotes: "Quotes page",
  product: "Product page",
  provider: "Provider page",
  campaign: "Campaign",
  ad: "Advertising",
  renewal: "Renewal form",
  new_car: "New car",
  renewal_desk: "Renewal desk",
  category: "Category page",
  home: "Insurance home",
};
export const sourceLabel = (s: string) => INS_SOURCE_LABEL[s] ?? s.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** Finished enquiries — reminders no longer matter. */
export const INS_LEAD_FINISHED: InsLeadStatus[] = ["policy_issued", "lost", "closed"];
/** Statuses a submitted quote may move the enquiry on from (it never moves an enquiry backwards). */
export const QUOTE_MOVES_FROM: InsLeadStatus[] = ["new", "assigned", "contacted", "quote_requested", "follow_up", "quote_submitted"];

export const CALL_OUTCOMES = {
  connected: "Connected",
  no_answer: "No answer",
  busy: "Busy",
  callback: "Asked to call back",
  wrong_number: "Wrong number",
  not_interested: "Not interested",
} as const;
export type CallOutcome = keyof typeof CALL_OUTCOMES;

export const INS_LOST_REASONS = [
  "Bought from another insurer",
  "Premium too high",
  "Renewed with current insurer",
  "Vehicle not eligible",
  "Not reachable",
  "Duplicate enquiry",
  "Only comparing prices",
  "Other",
] as const;

/** Policy types for renewals added by hand. */
export const RENEWAL_POLICY_TYPES = ["Comprehensive", "Third-party", "Standalone own-damage", "Bundled (1+3)", "Long-term"] as const;

export const RENEWAL_LOST_REASONS = ["Renewed elsewhere", "Premium too high", "Vehicle sold", "Not reachable", "Other"] as const;

export interface MemberOption {
  id: number;
  userId: number;
  name: string;
  role: InsRole;
  roleLabel: string;
}

export interface ProductOption {
  id: number;
  reference: string;
  name: string;
  category: string;
  status: string;
}

export interface EnquiryListItem {
  id: number;
  reference: string;
  intent: InsIntent;
  name: string;
  mobile: string;
  email: string | null;
  regNumber: string | null;
  vehicleIsNew: boolean;
  brandName: string | null;
  modelName: string | null;
  variantName: string | null;
  year: number | null;
  fuel: string | null;
  city: string | null;
  state: string | null;
  policyStatus: InsPolicyStatus | null;
  policyExpiry: string | null;
  product: { id: number; name: string; reference: string } | null;
  source: string;
  status: InsLeadStatus;
  lostReason: string | null;
  followUpAt: string | null;
  createdAt: string;
  updatedAt: string;
  assigned: { id: number; name: string } | null;
  indicativePremium: number | null;
}

export interface EnquiryEventItem {
  id: number;
  kind: InsLeadEventKind;
  body: string;
  meta: Record<string, string | number | boolean | null> | null;
  createdAt: string;
  author: string | null;
}

export interface QuoteSummary {
  id: number;
  reference: string;
  status: InsQuoteStatus;
  display: InsQuoteStatus | "viewed" | "expired";
  authorization: InsQuoteAuthorization;
  total: number;
  validUntil: string;
  productName: string | null;
  createdAt: string;
  submittedAt: string | null;
  enquiryId: number;
  enquiryReference: string;
}

export interface RenewalSummary {
  id: number;
  reference: string;
  status: InsRenewalStatus;
  expiryDate: string;
  source: string;
}

export interface EnquiryDetail extends EnquiryListItem {
  userId: number | null;
  previousInsurer: string | null;
  ncbPct: number;
  claimedLastYear: boolean;
  addOns: string[];
  idv: number | null;
  estimate: PremiumEstimate | null;
  message: string | null;
  consentAt: string;
  brand: string | null;
  model: string | null;
  variant: string | null;
  productDetail: { id: number; reference: string; name: string; code: string; category: string; status: string; companyName: string | null } | null;
  campaign: { id: number; reference: string; title: string } | null;
  adCampaign: { id: number; reference: string; name: string } | null;
  policyIssuedAt: string | null;
  policyNumber: string | null;
  policyPremium: number | null;
  conversionVerifiedAt: string | null;
  events: EnquiryEventItem[];
  quotes: QuoteSummary[];
  renewals: RenewalSummary[];
  history: { enquiries: EnquiryListItem[]; quotes: QuoteSummary[] };
}

export interface RenewalItem {
  id: number;
  reference: string;
  enquiry: { id: number; reference: string; status: InsLeadStatus } | null;
  name: string;
  mobile: string;
  email: string | null;
  regNumber: string | null;
  brandName: string | null;
  modelName: string | null;
  variantName: string | null;
  year: number | null;
  fuel: string | null;
  city: string | null;
  currentInsurer: string | null;
  policyNumber: string | null;
  policyType: string | null;
  expiryDate: string;
  ncbPct: number;
  premium: number | null;
  status: InsRenewalStatus;
  assigned: { id: number; name: string } | null;
  followUpAt: string | null;
  notes: string | null;
  renewedAt: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface RenewalActivity {
  id: number;
  summary: string;
  author: string | null;
  createdAt: string;
}

export const RENEWAL_SOURCE_LABEL: Record<string, string> = { enquiry: "Renewal enquiry", manual: "Added by your team", policy: "Issued policy" };

/* ── Dates (IST) ───────────────────────────────────────────── */

const DAY = 86_400_000;
const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** Whole days from `today` to `iso` (both IST calendar days). Negative = in the past. */
export const daysFrom = (today: string, iso: string) => Math.round((utc(iso) - utc(today)) / DAY);

/** "in 12 days", "today", "3 days ago". */
export function daysLabel(n: number) {
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  return n > 0 ? `In ${n} days` : `${-n} days ago`;
}

/** One year of cover from `issued` (YYYY-MM-DD): the day before the anniversary. */
export function policyExpiryFrom(issued: string) {
  const [y, m, d] = issued.split("-").map(Number);
  const anniversary = new Date(Date.UTC(y + 1, m - 1, d));
  // 29 Feb → 1 Mar next year; the day before is 28 Feb.
  if (anniversary.getUTCMonth() !== m - 1) anniversary.setUTCDate(0);
  else anniversary.setUTCDate(anniversary.getUTCDate() - 1);
  return anniversary.toISOString().slice(0, 10);
}

/** "Hyundai Creta SX(O) · 2022 · Petrol" */
export function vehicleLine(v: { brandName: string | null; modelName: string | null; variantName?: string | null; year?: number | null; fuel?: string | null; vehicleIsNew?: boolean }) {
  const car = [v.brandName, v.modelName && v.brandName && v.modelName.startsWith(v.brandName) ? v.modelName.slice(v.brandName.length).trim() : v.modelName, v.variantName].filter(Boolean).join(" ");
  const bits = [car || null, v.vehicleIsNew ? "New car" : v.year ? String(v.year) : null, v.fuel || null].filter(Boolean);
  return bits.join(" · ");
}

export const formatMobile = (m: string) => (m.length === 10 ? `${m.slice(0, 5)} ${m.slice(5)}` : m);

/** Only follow links inside the site (never an external URL stored in a row). */
export const safeHref = (h: string | null | undefined) => (h && h.startsWith("/") && !h.startsWith("//") ? h : null);
