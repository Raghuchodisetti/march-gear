import type {
  AdCampaignStatus,
  AdCreativeStatus,
  AdFormat,
  FileReviewStatus,
  InsBusinessType,
  InsCampaignStatus,
  InsCampaignType,
  InsCoverStatus,
  InsDocKind,
  InsIntent,
  InsInvoiceKind,
  InsLeadStatus,
  InsPolicyStatus,
  InsProductCategory,
  InsProductStatus,
  InsQuoteAuthorization,
  InsQuoteStatus,
  InsRenewalStatus,
  InsRole,
  InsVendorCategory,
  InsVendorStatus,
  InvoiceStatus,
  PaymentStatus,
} from "@/db/enums";
import type { Tone } from "@/partner/labels";

/* Human labels + badge tones for the insurance marketplace and the ad system. Client-safe. */

export type { Tone };

/* ── Vendor account ─────────────────────────────────────────── */

export const INS_VENDOR_STATUS_LABEL: Record<InsVendorStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  pending_approval: "Pending approval",
  under_review: "Under review",
  documents_required: "Documents required",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Rejected",
  suspended: "Suspended",
};
export const INS_VENDOR_STATUS_TONE: Record<InsVendorStatus, Tone> = {
  draft: "neutral",
  submitted: "blue",
  pending_approval: "blue",
  under_review: "blue",
  documents_required: "amber",
  changes_requested: "amber",
  approved: "green",
  rejected: "red",
  suspended: "dark",
};
/** Statuses in which the vendor may edit and resubmit the application. */
export const INS_VENDOR_EDITABLE: InsVendorStatus[] = ["draft", "documents_required", "changes_requested"];
/** Statuses waiting on MarchGear staff. */
export const INS_VENDOR_IN_REVIEW: InsVendorStatus[] = ["submitted", "pending_approval", "under_review"];

export const INS_VENDOR_CATEGORY_LABEL: Record<InsVendorCategory, string> = {
  insurer: "Insurance company (insurer)",
  broker: "Insurance broker",
  corporate_agent: "Corporate agent",
  web_aggregator: "Web aggregator",
  imf: "Insurance marketing firm",
  other_intermediary: "Other registered intermediary",
};
export const INS_VENDOR_CATEGORY_SHORT: Record<InsVendorCategory, string> = {
  insurer: "Insurer",
  broker: "Broker",
  corporate_agent: "Corporate agent",
  web_aggregator: "Web aggregator",
  imf: "IMF",
  other_intermediary: "Intermediary",
};

export const INS_BUSINESS_TYPE_LABEL: Record<InsBusinessType, string> = {
  public_limited: "Public limited company",
  private_limited: "Private limited company",
  llp: "Limited liability partnership",
  partnership: "Partnership firm",
  proprietorship: "Sole proprietorship",
  government: "Government / PSU",
  other: "Other",
};

export const INS_ROLE_LABEL: Record<InsRole, string> = {
  owner: "Owner",
  admin: "Administrator",
  manager: "Sales manager",
  executive: "Sales executive",
  marketing: "Marketing",
  finance: "Finance",
};

export const INS_DOC_KIND_LABEL: Record<InsDocKind, string> = {
  business_registration: "Business registration",
  gst: "GST certificate",
  pan: "PAN card",
  regulatory_licence: "Regulatory authorisation",
  address_proof: "Address proof",
  representative_id: "Representative ID proof",
  representative_authorisation: "Representative authorisation letter",
  bank_proof: "Bank proof (cancelled cheque / statement)",
  supporting: "Supporting document",
  brochure: "Product brochure",
  policy_wording: "Policy wording",
  tie_up_letter: "Insurer authorisation / tie-up letter",
  ticket_attachment: "Attachment",
  payment_proof: "Payment proof",
};

export const FILE_REVIEW_LABEL: Record<FileReviewStatus, string> = { pending: "Awaiting review", verified: "Verified", rejected: "Rejected" };
export const FILE_REVIEW_TONE: Record<FileReviewStatus, Tone> = { pending: "neutral", verified: "green", rejected: "red" };

/* ── Products, coverage and add-ons ─────────────────────────── */

export const INS_PRODUCT_CATEGORY_LABEL: Record<InsProductCategory, string> = {
  comprehensive: "Comprehensive",
  third_party: "Third-party",
  own_damage: "Standalone own-damage",
  bundled: "Bundled (1-year OD + 3-year TP)",
  new_car: "New car",
  used_car: "Used car",
  ev: "Electric vehicle",
  long_term: "Long-term (multi-year)",
};
export const INS_PRODUCT_CATEGORY_BLURB: Record<InsProductCategory, string> = {
  comprehensive: "Own damage plus third-party liability in one policy.",
  third_party: "The legal minimum: injury, death and property damage you cause to others.",
  own_damage: "Damage to your own car, for cars that already have a valid third-party policy.",
  bundled: "For new cars: one year of own-damage cover with three years of third-party cover.",
  new_car: "Cover designed for cars being registered for the first time.",
  used_car: "Cover for pre-owned cars, including ownership transfer of the policy.",
  ev: "Cover built around electric cars — battery, charger and motor.",
  long_term: "Multi-year cover so you don't renew every year.",
};

export const INS_PRODUCT_STATUS_LABEL: Record<InsProductStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  pending_approval: "Pending approval",
  changes_requested: "Changes requested",
  approved: "Approved — not live",
  published: "Published",
  rejected: "Rejected",
  suspended: "Suspended",
};
export const INS_PRODUCT_STATUS_TONE: Record<InsProductStatus, Tone> = {
  draft: "neutral",
  submitted: "blue",
  pending_approval: "blue",
  changes_requested: "amber",
  approved: "green",
  published: "green",
  rejected: "red",
  suspended: "dark",
};
/** The vendor may edit a product in these statuses (editing approved/published ones sends them back for approval). */
export const INS_PRODUCT_EDITABLE: InsProductStatus[] = ["draft", "changes_requested", "rejected", "approved", "published"];

export const INS_COVER_STATUS_LABEL: Record<InsCoverStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Rejected",
};
export const INS_COVER_STATUS_TONE: Record<InsCoverStatus, Tone> = {
  draft: "neutral",
  pending_approval: "blue",
  changes_requested: "amber",
  approved: "green",
  rejected: "red",
};

/* ── Customers, enquiries, quotes, renewals ─────────────────── */

export const INS_INTENT_LABEL: Record<InsIntent, string> = { new: "New policy", renewal: "Renewal" };

export const INS_POLICY_STATUS_LABEL: Record<InsPolicyStatus, string> = {
  new_vehicle: "New car — no policy yet",
  active: "Policy active",
  expired_recent: "Expired within 90 days",
  expired_long: "Expired over 90 days ago",
  not_sure: "Not sure",
};

export const INS_LEAD_STATUS_LABEL: Record<InsLeadStatus, string> = {
  new: "New",
  assigned: "Assigned",
  contacted: "Contacted",
  quote_requested: "Quote requested",
  quote_submitted: "Quote submitted",
  follow_up: "Follow-up",
  interested: "Interested",
  policy_issued: "Policy issued",
  lost: "Lost",
  closed: "Closed",
};
export const INS_LEAD_STATUS_TONE: Record<InsLeadStatus, Tone> = {
  new: "red",
  assigned: "blue",
  contacted: "blue",
  quote_requested: "amber",
  quote_submitted: "blue",
  follow_up: "amber",
  interested: "green",
  policy_issued: "green",
  lost: "neutral",
  closed: "neutral",
};
export const INS_LEAD_OPEN: InsLeadStatus[] = ["new", "assigned", "contacted", "quote_requested", "quote_submitted", "follow_up", "interested"];

export const INS_QUOTE_STATUS_LABEL: Record<InsQuoteStatus | "viewed" | "expired", string> = {
  draft: "Draft",
  submitted: "Sent to customer",
  viewed: "Viewed by customer",
  accepted: "Customer interested",
  declined: "Declined by customer",
  withdrawn: "Withdrawn",
  expired: "Expired",
};
export const INS_QUOTE_STATUS_TONE: Record<InsQuoteStatus | "viewed" | "expired", Tone> = {
  draft: "neutral",
  submitted: "blue",
  viewed: "blue",
  accepted: "green",
  declined: "red",
  withdrawn: "neutral",
  expired: "neutral",
};

/** What a quote shows as its status (adds "viewed" and "expired"). `today` is an IST YYYY-MM-DD. */
export function quoteDisplayStatus(q: { status: InsQuoteStatus; validUntil: string; viewedAt: Date | string | null }, today: string): InsQuoteStatus | "viewed" | "expired" {
  if (q.status === "submitted" && q.validUntil < today) return "expired";
  if (q.status === "submitted" && q.viewedAt) return "viewed";
  return q.status;
}

export const INS_QUOTE_AUTH_LABEL: Record<InsQuoteAuthorization, string> = {
  indicative: "Indicative estimate — not an insurer quotation",
  insurer_authorised: "Insurer-authorised quotation",
};
export const INS_QUOTE_AUTH_SHORT: Record<InsQuoteAuthorization, string> = { indicative: "Indicative", insurer_authorised: "Insurer-authorised" };
export const INS_QUOTE_AUTH_TONE: Record<InsQuoteAuthorization, Tone> = { indicative: "amber", insurer_authorised: "green" };

export const INS_RENEWAL_STATUS_LABEL: Record<InsRenewalStatus, string> = {
  upcoming: "Upcoming",
  contacted: "Contacted",
  quote_sent: "Quote sent",
  follow_up: "Follow-up",
  renewed: "Renewed",
  lapsed: "Lapsed",
  lost: "Lost",
  closed: "Closed",
};
export const INS_RENEWAL_STATUS_TONE: Record<InsRenewalStatus, Tone> = {
  upcoming: "blue",
  contacted: "blue",
  quote_sent: "blue",
  follow_up: "amber",
  renewed: "green",
  lapsed: "red",
  lost: "neutral",
  closed: "neutral",
};
export const INS_RENEWAL_OPEN: InsRenewalStatus[] = ["upcoming", "contacted", "quote_sent", "follow_up"];

/* ── Promotional campaigns ──────────────────────────────────── */

export const INS_CAMPAIGN_TYPE_LABEL: Record<InsCampaignType, string> = {
  product_launch: "Product launch",
  renewal_drive: "Renewal drive",
  ev_promotion: "EV promotion",
  seasonal: "Seasonal",
  awareness: "Awareness",
  add_on_highlight: "Add-on highlight",
  other: "Other",
};

export type InsCampaignDisplay = Exclude<InsCampaignStatus, "approved"> | "scheduled" | "active" | "expired";
export const INS_CAMPAIGN_STATUS_LABEL: Record<InsCampaignDisplay, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  changes_requested: "Changes requested",
  rejected: "Rejected",
  paused: "Paused",
  cancelled: "Cancelled",
  scheduled: "Scheduled",
  active: "Active",
  expired: "Expired",
};
export const INS_CAMPAIGN_STATUS_TONE: Record<InsCampaignDisplay, Tone> = {
  draft: "neutral",
  pending_approval: "blue",
  changes_requested: "amber",
  rejected: "red",
  paused: "neutral",
  cancelled: "neutral",
  scheduled: "blue",
  active: "green",
  expired: "neutral",
};
/** Approved campaigns are scheduled / active / expired by their dates. Only "active" ones are public. */
export function campaignDisplayStatus(c: { status: InsCampaignStatus; startsAt: Date | string; endsAt: Date | string }, now = new Date()): InsCampaignDisplay {
  if (c.status !== "approved") return c.status;
  if (new Date(c.endsAt) < now) return "expired";
  if (new Date(c.startsAt) > now) return "scheduled";
  return "active";
}

/* ── Billing ────────────────────────────────────────────────── */

export const INS_INVOICE_KIND_LABEL: Record<InsInvoiceKind, string> = { subscription: "Subscription", advertising: "Advertising", lead_fee: "Lead fee", other: "Other" };
export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = { due: "Due", verifying: "Payment being verified", paid: "Paid", overdue: "Overdue", void: "Void" };
export const INVOICE_STATUS_TONE: Record<InvoiceStatus, Tone> = { due: "amber", verifying: "blue", paid: "green", overdue: "red", void: "neutral" };
export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = { submitted: "Awaiting verification", verified: "Verified", rejected: "Rejected" };
export const PAYMENT_STATUS_TONE: Record<PaymentStatus, Tone> = { submitted: "blue", verified: "green", rejected: "red" };

/* ── Advertising ────────────────────────────────────────────── */

export const AD_FORMAT_LABEL: Record<AdFormat, string> = { banner: "Banner", sponsored_listing: "Sponsored listing" };

export type AdDisplayStatus = Exclude<AdCampaignStatus, "approved"> | "scheduled" | "live" | "ended";
export const AD_STATUS_LABEL: Record<AdDisplayStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  changes_requested: "Changes requested",
  rejected: "Rejected",
  paused: "Paused",
  cancelled: "Cancelled",
  scheduled: "Scheduled",
  live: "Live",
  ended: "Ended",
};
export const AD_STATUS_TONE: Record<AdDisplayStatus, Tone> = {
  draft: "neutral",
  pending_approval: "blue",
  changes_requested: "amber",
  rejected: "red",
  paused: "neutral",
  cancelled: "neutral",
  scheduled: "blue",
  live: "green",
  ended: "neutral",
};
/** Approved ad campaigns are scheduled / live / ended by their IST dates (inclusive). `today` is an IST YYYY-MM-DD. */
export function adDisplayStatus(c: { status: AdCampaignStatus; startsOn: string; endsOn: string }, today: string): AdDisplayStatus {
  if (c.status !== "approved") return c.status;
  if (c.endsOn < today) return "ended";
  if (c.startsOn > today) return "scheduled";
  return "live";
}

export const AD_CREATIVE_STATUS_LABEL: Record<AdCreativeStatus, string> = { pending: "Awaiting review", approved: "Approved", changes_requested: "Changes requested", rejected: "Rejected" };
export const AD_CREATIVE_STATUS_TONE: Record<AdCreativeStatus, Tone> = { pending: "blue", approved: "green", changes_requested: "amber", rejected: "red" };

/* ── Public wording ─────────────────────────────────────────── */

/** Shown next to every premium the site calculates. */
export const INDICATIVE_NOTE =
  "Indicative premium, estimated by MarchGear from typical rates. It is not an offer or a quotation from the insurer — the final premium, IDV and terms are set by the insurer when the policy is issued.";
export const NOT_AN_INSURER_NOTE = "MarchGear lists insurance products from registered insurers and intermediaries. MarchGear does not issue policies or settle claims.";
