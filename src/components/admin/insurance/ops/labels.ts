import type { InsApprovalTarget, InsLeadEventKind, TicketStatus } from "@/db/enums";
import type { Tone } from "@/insurance/labels";

/* ──────────────────────────────────────────────────────────────
   Labels for the insurance operations screens (enquiries, quotes,
   renewals, campaigns, billing, audit, support). Client-safe.
   ────────────────────────────────────────────────────────────── */

export const humanize = (s: string) =>
  s
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());

export const LEAD_EVENT_LABEL: Record<InsLeadEventKind, string> = {
  created: "Enquiry received",
  note: "Note",
  call: "Call",
  email: "Email",
  whatsapp: "WhatsApp",
  status: "Status change",
  assign: "Assignment",
  reminder: "Follow-up reminder",
  quote: "Quote",
  policy: "Policy",
  renewal: "Renewal",
};

/** Where a public enquiry came from (ins_enquiries.source). */
export const SOURCE_LABEL: Record<string, string> = {
  compare: "Comparison",
  quotes: "Quotes page",
  product: "Product page",
  provider: "Provider page",
  campaign: "Promotional campaign",
  ad: "Advertisement",
  renewal: "Renewal form",
  new_car: "New car page",
};
export const sourceLabel = (s: string | null | undefined) => (s ? (SOURCE_LABEL[s] ?? humanize(s)) : "—");

export const CONVERSION_LABEL = { none: "No policy reported", reported: "Reported by vendor", verified: "Verified by MarchGear" } as const;
export type ConversionState = keyof typeof CONVERSION_LABEL;
export const CONVERSION_TONE: Record<ConversionState, Tone> = { none: "neutral", reported: "amber", verified: "green" };

export const INS_TARGET_LABEL: Record<InsApprovalTarget, string> = {
  vendor: "Vendor account",
  product: "Product",
  cover: "Coverage / add-on",
  campaign: "Promotional campaign",
  ad_campaign: "Ad campaign",
  ad_creative: "Ad creative",
  document: "Document",
  profile_change: "Change request",
  payment: "Payment",
  conversion: "Policy conversion",
  company: "Insurance company",
};

/** Staff-facing ticket wording ("awaiting_dealer" is shown to the vendor as "Awaiting your reply"). */
export const INS_TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: "New",
  awaiting_dealer: "Awaiting vendor",
  awaiting_support: "Awaiting support",
  resolved: "Resolved",
  closed: "Closed",
};
/** What the vendor reads in their portal. */
export const VENDOR_TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Open",
  awaiting_dealer: "Awaiting your reply",
  awaiting_support: "Awaiting MarchGear",
  resolved: "Resolved",
  closed: "Closed",
};
export const INS_TICKET_STATUS_TONE: Record<TicketStatus, Tone> = { open: "red", awaiting_dealer: "amber", awaiting_support: "red", resolved: "green", closed: "neutral" };

const TICKET_CATEGORY: Record<string, string> = {
  account: "Account & verification",
  verification: "Account & verification",
  billing: "Subscription & invoices",
  payments: "Payments",
  products: "Products & approvals",
  coverage: "Coverage & add-ons",
  enquiries: "Enquiries & quotes",
  quotes: "Enquiries & quotes",
  renewals: "Renewals",
  campaigns: "Campaigns",
  advertising: "Advertising",
  technical: "Technical problem",
  other: "Something else",
};
export const ticketCategoryLabel = (c: string) => TICKET_CATEGORY[c] ?? humanize(c);

/** Every payment method insurance vendors can record. */
export const METHOD_LABEL = { bank_transfer: "Bank transfer", upi: "UPI", cheque: "Cheque" } as const;
export type Method = keyof typeof METHOD_LABEL;
export const REF_LABEL: Record<Method, string> = { bank_transfer: "UTR number", upi: "UPI transaction ID", cheque: "Cheque number" };

/** Approval-history actions used by these screens, on top of the shared ones. */
export const OPS_ACTION_LABEL: Record<string, string> = {
  verified: "Verified",
  unverified: "Verification withdrawn",
  approved: "Approved",
  rejected: "Rejected",
  changes_requested: "Changes requested",
  paused: "Paused",
  resumed: "Resumed",
  cancelled: "Cancelled",
  submitted: "Submitted",
  resubmitted: "Resubmitted",
  marked_paid: "Marked paid",
  internal_note: "Internal note",
};
export const opsActionLabel = (a: string) => OPS_ACTION_LABEL[a] ?? humanize(a);
export function opsActionTone(a: string): Tone {
  if (/^(approved|verified|resumed|marked_paid|published|reactivated)$/.test(a)) return "green";
  if (/^(rejected|suspended)$/.test(a)) return "red";
  if (/^(changes_requested|documents_required|paused|unverified|unpublished)$/.test(a)) return "amber";
  if (a === "internal_note") return "dark";
  if (/^(submitted|resubmitted|under_review)$/.test(a)) return "blue";
  return "neutral";
}

/** Quote total more than this far from the customer's indicative estimate is flagged. */
export const DEVIATION_LIMIT = 0.3;
export const QUOTE_FLAG_LABEL = { missing_ref: "Insurer reference missing", expired: "Expired", deviation: "Over 30% from the estimate" } as const;
export type QuoteFlag = keyof typeof QUOTE_FLAG_LABEL;

export const pctLabel = (v: number) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}%`;
