import type {
  BrandAuthStatus,
  BusinessType,
  CrmStatus,
  FileReviewStatus,
  InvoiceStatus,
  LeadSource,
  OfferCategory,
  OfferStatus,
  PartnerDocKind,
  PartnerRole,
  PartnerStatus,
  PartnerVehicleStatus,
  PaymentStatus,
  PlanStatus,
  TestDriveStatus,
  TicketPriority,
  TicketStatus,
} from "@/db/enums";

/* Human labels + badge tones for everything in the dealer portal. Client-safe. */

export type Tone = "neutral" | "red" | "green" | "amber" | "blue" | "dark";

export const PARTNER_STATUS_LABEL: Record<PartnerStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  pending_approval: "Pending approval",
  under_review: "Under review",
  documents_required: "Documents required",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Rejected",
  suspended: "Suspended",
  deactivated: "Deactivated",
};
export const PARTNER_STATUS_TONE: Record<PartnerStatus, Tone> = {
  draft: "neutral",
  submitted: "blue",
  pending_approval: "blue",
  under_review: "blue",
  documents_required: "amber",
  changes_requested: "amber",
  approved: "green",
  rejected: "red",
  suspended: "red",
  deactivated: "neutral",
};
/** The dealer can edit and resubmit the application in these states. */
export const PARTNER_EDITABLE: PartnerStatus[] = ["draft", "documents_required", "changes_requested"];
/** Waiting on MarchGear staff. */
export const PARTNER_IN_REVIEW: PartnerStatus[] = ["submitted", "pending_approval", "under_review"];

export const BUSINESS_TYPE_LABEL: Record<BusinessType, string> = {
  proprietorship: "Proprietorship",
  partnership: "Partnership",
  llp: "LLP",
  private_limited: "Private Limited",
};

export const PARTNER_ROLE_LABEL: Record<PartnerRole, string> = {
  owner: "Dealer Owner",
  admin: "Dealer Administrator",
  sales_manager: "Sales Manager",
  sales_executive: "Sales Executive",
  inventory_manager: "Inventory Manager",
  marketing_manager: "Marketing Manager",
};

export const DOC_KIND_LABEL: Record<PartnerDocKind, string> = {
  pan: "PAN card",
  gst: "GST certificate",
  registration: "Business registration certificate",
  identity: "Identity proof",
  address: "Address proof",
  brand_authorization: "Brand authorisation certificate",
  cancelled_cheque: "Cancelled cheque",
  supporting: "Supporting document",
  inspection_report: "Inspection report",
  brochure: "Brochure",
  ticket_attachment: "Attachment",
  payment_proof: "Payment proof",
};

export const FILE_STATUS_LABEL: Record<FileReviewStatus, string> = { pending: "Awaiting check", verified: "Verified", rejected: "Rejected" };
export const FILE_STATUS_TONE: Record<FileReviewStatus, Tone> = { pending: "blue", verified: "green", rejected: "red" };

export const BRAND_STATUS_LABEL: Record<BrandAuthStatus, string> = { pending: "Pending", approved: "Authorised", rejected: "Rejected", expired: "Expired" };
export const BRAND_STATUS_TONE: Record<BrandAuthStatus, Tone> = { pending: "blue", approved: "green", rejected: "red", expired: "amber" };

export const VEHICLE_STATUS_LABEL: Record<PartnerVehicleStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  changes_requested: "Changes requested",
  approved: "Approved",
  published: "Published",
  rejected: "Rejected",
  unpublished: "Unpublished",
  archived: "Archived",
};
export const VEHICLE_STATUS_TONE: Record<PartnerVehicleStatus, Tone> = {
  draft: "neutral",
  pending_approval: "blue",
  changes_requested: "amber",
  approved: "green",
  published: "dark",
  rejected: "red",
  unpublished: "neutral",
  archived: "neutral",
};

/** What dealers and staff see for an offer: stored status plus the date-derived ones. */
export type OfferDisplayStatus = OfferStatus | "scheduled" | "active" | "expired";

export const OFFER_STATUS_LABEL: Record<OfferDisplayStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  pending_approval: "Pending approval",
  changes_requested: "Changes requested",
  approved: "Approved",
  scheduled: "Scheduled",
  active: "Active",
  expired: "Expired",
  rejected: "Rejected",
  cancelled: "Cancelled",
  paused: "Paused",
};
export const OFFER_STATUS_TONE: Record<OfferDisplayStatus, Tone> = {
  draft: "neutral",
  submitted: "blue",
  pending_approval: "blue",
  changes_requested: "amber",
  approved: "green",
  scheduled: "blue",
  active: "green",
  expired: "neutral",
  rejected: "red",
  cancelled: "neutral",
  paused: "amber",
};

/**
 * An approved offer is Scheduled before its start, Active during its window and Expired after —
 * so offers go live and expire on their own. Every other status is shown as stored.
 */
export function offerDisplayStatus(o: { status: OfferStatus; startsAt: Date | string; endsAt: Date | string }, now = new Date()): OfferDisplayStatus {
  if (o.status !== "approved") return o.status;
  const start = new Date(o.startsAt).getTime();
  const end = new Date(o.endsAt).getTime();
  if (now.getTime() < start) return "scheduled";
  if (now.getTime() > end) return "expired";
  return "active";
}

export const OFFER_CATEGORY_LABEL: Record<OfferCategory, string> = {
  festival: "Festival Offers",
  diwali: "Diwali Offers",
  sankranti: "Sankranti Offers",
  ugadi: "Ugadi Offers",
  dussehra: "Dussehra Offers",
  anniversary: "Anniversary Offers",
  dealership_anniversary: "Dealership Anniversary",
  year_end: "Year-End Sale",
  new_year: "New Year Offers",
  seasonal: "Seasonal Offers",
  launch: "Launch Offers",
  exchange: "Exchange Offers",
  corporate: "Corporate Offers",
  limited_time: "Limited-Time Offers",
  finance: "Finance Offers",
  insurance: "Insurance Offers",
  accessories: "Accessories Offers",
  clearance: "Clearance Sales",
};

export const CRM_STATUS_LABEL: Record<CrmStatus, string> = {
  new: "New",
  contacted: "Contacted",
  follow_up: "Follow-up",
  interested: "Interested",
  test_drive_scheduled: "Test drive scheduled",
  negotiation: "Negotiation",
  booking_completed: "Booking completed",
  converted: "Converted",
  lost: "Lost",
  closed: "Closed",
};
export const CRM_STATUS_TONE: Record<CrmStatus, Tone> = {
  new: "red",
  contacted: "amber",
  follow_up: "amber",
  interested: "blue",
  test_drive_scheduled: "blue",
  negotiation: "blue",
  booking_completed: "green",
  converted: "green",
  lost: "neutral",
  closed: "neutral",
};
/** Statuses that count as a win for conversion rates. */
export const CRM_WON: CrmStatus[] = ["booking_completed", "converted"];

export const LEAD_SOURCE_LABEL: Record<LeadSource, string> = {
  website: "Website",
  offer: "Offer",
  listing: "Vehicle listing",
  walk_in: "Walk-in",
  phone: "Phone call",
  referral: "Referral",
  social: "Social media",
  event: "Event",
  other: "Other",
};

export const TEST_DRIVE_STATUS_LABEL: Record<TestDriveStatus, string> = {
  requested: "Requested",
  accepted: "Accepted",
  scheduled: "Scheduled",
  rescheduled: "Rescheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Rejected",
  no_show: "No-show",
};
export const TEST_DRIVE_STATUS_TONE: Record<TestDriveStatus, Tone> = {
  requested: "red",
  accepted: "blue",
  scheduled: "blue",
  rescheduled: "amber",
  completed: "green",
  cancelled: "neutral",
  rejected: "neutral",
  no_show: "amber",
};

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Open",
  awaiting_dealer: "Awaiting your reply",
  awaiting_support: "With support",
  resolved: "Resolved",
  closed: "Closed",
};
export const TICKET_STATUS_TONE: Record<TicketStatus, Tone> = { open: "red", awaiting_dealer: "amber", awaiting_support: "blue", resolved: "green", closed: "neutral" };
export const TICKET_PRIORITY_LABEL: Record<TicketPriority, string> = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" };

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = { due: "Due", verifying: "Payment being verified", paid: "Paid", overdue: "Overdue", void: "Void" };
export const INVOICE_STATUS_TONE: Record<InvoiceStatus, Tone> = { due: "amber", verifying: "blue", paid: "green", overdue: "red", void: "neutral" };
export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = { submitted: "Submitted", verified: "Verified", rejected: "Rejected" };
export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = { trial: "Trial", active: "Active", past_due: "Payment due", cancelled: "Cancelled" };
