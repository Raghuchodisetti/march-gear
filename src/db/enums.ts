/** Enum values shared by the schema, server and client code (no database imports). */

export const PUBLISH_STATUS = ["published", "draft"] as const;
export type PublishStatus = (typeof PUBLISH_STATUS)[number];

export const USED_STATUS = ["active", "reserved", "sold", "draft"] as const;
export type UsedStatus = (typeof USED_STATUS)[number];

export const REVIEW_STATUS = ["pending", "approved", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUS)[number];

/**
 * "dealer" accounts sign in to the dealer partner portal (/dealer) and "insurer" accounts to the insurance
 * vendor portal (/insurance-vendor) — never to the staff admin.
 */
export const USER_ROLES = ["customer", "editor", "admin", "dealer", "insurer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const LEAD_TYPES = [
  "test_drive",
  "best_price",
  "contact_dealer",
  "callback",
  "inspection",
  "pdi_booking",
  "pdi_checklist",
  "sell_car",
  "used_car",
  "contact",
  "insurance_claim",
  "insurance_help",
] as const;
export type LeadType = (typeof LEAD_TYPES)[number];

export const LEAD_STATUS = ["new", "contacted", "qualified", "converted", "closed"] as const;
export type LeadStatus = (typeof LEAD_STATUS)[number];

export const FUEL_TYPES = ["Petrol", "Diesel", "CNG", "Hybrid", "Electric"] as const;

/* ── Dealer partner portal ──────────────────────────────────── */

export const PARTNER_STATUS = [
  "draft",
  "submitted",
  "pending_approval",
  "under_review",
  "documents_required",
  "changes_requested",
  "approved",
  "rejected",
  "suspended",
  "deactivated",
] as const;
export type PartnerStatus = (typeof PARTNER_STATUS)[number];

export const BUSINESS_TYPES = ["proprietorship", "partnership", "llp", "private_limited"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const PARTNER_ROLES = ["owner", "admin", "sales_manager", "sales_executive", "inventory_manager", "marketing_manager"] as const;
export type PartnerRole = (typeof PARTNER_ROLES)[number];

export const PARTNER_DOC_KINDS = [
  "pan",
  "gst",
  "registration",
  "identity",
  "address",
  "brand_authorization",
  "cancelled_cheque",
  "supporting",
  "inspection_report",
  "brochure",
  "ticket_attachment",
  "payment_proof",
] as const;
export type PartnerDocKind = (typeof PARTNER_DOC_KINDS)[number];

export const FILE_REVIEW_STATUS = ["pending", "verified", "rejected"] as const;
export type FileReviewStatus = (typeof FILE_REVIEW_STATUS)[number];

export const BRAND_AUTH_STATUS = ["pending", "approved", "rejected", "expired"] as const;
export type BrandAuthStatus = (typeof BRAND_AUTH_STATUS)[number];

export const PARTNER_VEHICLE_STATUS = ["draft", "pending_approval", "changes_requested", "approved", "published", "rejected", "unpublished", "archived"] as const;
export type PartnerVehicleStatus = (typeof PARTNER_VEHICLE_STATUS)[number];

/** Stored offer status. "Scheduled", "Active" and "Expired" are derived from an approved offer's dates (see src/partner/status.ts). */
export const OFFER_STATUS = ["draft", "submitted", "pending_approval", "changes_requested", "approved", "rejected", "cancelled", "paused"] as const;
export type OfferStatus = (typeof OFFER_STATUS)[number];

export const OFFER_CATEGORIES = [
  "festival",
  "diwali",
  "sankranti",
  "ugadi",
  "dussehra",
  "anniversary",
  "dealership_anniversary",
  "year_end",
  "new_year",
  "seasonal",
  "launch",
  "exchange",
  "corporate",
  "limited_time",
  "finance",
  "insurance",
  "accessories",
  "clearance",
] as const;
export type OfferCategory = (typeof OFFER_CATEGORIES)[number];

export const CRM_STATUS = ["new", "contacted", "follow_up", "interested", "test_drive_scheduled", "negotiation", "booking_completed", "converted", "lost", "closed"] as const;
export type CrmStatus = (typeof CRM_STATUS)[number];

export const LEAD_SOURCES = ["website", "offer", "listing", "walk_in", "phone", "referral", "social", "event", "other"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_EVENT_KINDS = ["note", "call", "status", "assign", "reminder", "email", "whatsapp", "test_drive", "created"] as const;
export type LeadEventKind = (typeof LEAD_EVENT_KINDS)[number];

export const TEST_DRIVE_STATUS = ["requested", "accepted", "scheduled", "rescheduled", "completed", "cancelled", "rejected", "no_show"] as const;
export type TestDriveStatus = (typeof TEST_DRIVE_STATUS)[number];

export const TICKET_STATUS = ["open", "awaiting_dealer", "awaiting_support", "resolved", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUS)[number];

export const TICKET_PRIORITY = ["low", "normal", "high", "urgent"] as const;
export type TicketPriority = (typeof TICKET_PRIORITY)[number];

export const INVOICE_STATUS = ["due", "verifying", "paid", "overdue", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUS)[number];

export const PAYMENT_STATUS = ["submitted", "verified", "rejected"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[number];

export const PLAN_STATUS = ["trial", "active", "past_due", "cancelled"] as const;
export type PlanStatus = (typeof PLAN_STATUS)[number];

export const APPROVAL_TARGETS = ["partner", "vehicle", "offer", "brand", "document", "profile_change", "payment"] as const;
export type ApprovalTarget = (typeof APPROVAL_TARGETS)[number];

export const PARTNER_EVENT_KINDS = ["profile_view", "vehicle_view", "offer_view", "phone_click", "whatsapp_click", "direction_click"] as const;
export type PartnerEventKind = (typeof PARTNER_EVENT_KINDS)[number];

/* ── Insurance marketplace (/insurance, /insurance-vendor, /admin/insurance) ── */

export const INS_VENDOR_STATUS = [
  "draft",
  "submitted",
  "pending_approval",
  "under_review",
  "documents_required",
  "changes_requested",
  "approved",
  "rejected",
  "suspended",
] as const;
export type InsVendorStatus = (typeof INS_VENDOR_STATUS)[number];

/** What kind of regulated entity the vendor is. Only "insurer" vendors underwrite; the rest distribute an insurer's products. */
export const INS_VENDOR_CATEGORIES = ["insurer", "broker", "corporate_agent", "web_aggregator", "imf", "other_intermediary"] as const;
export type InsVendorCategory = (typeof INS_VENDOR_CATEGORIES)[number];

export const INS_BUSINESS_TYPES = ["public_limited", "private_limited", "llp", "partnership", "proprietorship", "government", "other"] as const;
export type InsBusinessType = (typeof INS_BUSINESS_TYPES)[number];

export const INS_ROLES = ["owner", "admin", "manager", "executive", "marketing", "finance"] as const;
export type InsRole = (typeof INS_ROLES)[number];

export const INS_DOC_KINDS = [
  "business_registration",
  "gst",
  "pan",
  "regulatory_licence",
  "address_proof",
  "representative_id",
  "representative_authorisation",
  "bank_proof",
  "supporting",
  "brochure",
  "policy_wording",
  "tie_up_letter",
  "ticket_attachment",
  "payment_proof",
] as const;
export type InsDocKind = (typeof INS_DOC_KINDS)[number];

export const INS_PRODUCT_CATEGORIES = ["comprehensive", "third_party", "own_damage", "bundled", "new_car", "used_car", "ev", "long_term"] as const;
export type InsProductCategory = (typeof INS_PRODUCT_CATEGORIES)[number];

/** Only "published" products are public. "submitted" is recorded in the history; a submission lands in "pending_approval". */
export const INS_PRODUCT_STATUS = ["draft", "submitted", "pending_approval", "changes_requested", "approved", "published", "rejected", "suspended"] as const;
export type InsProductStatus = (typeof INS_PRODUCT_STATUS)[number];

/** Coverage items and add-on covers are reviewed separately from the products that use them. */
export const INS_COVER_TYPES = ["coverage", "addon"] as const;
export type InsCoverType = (typeof INS_COVER_TYPES)[number];
export const INS_COVER_STATUS = ["draft", "pending_approval", "changes_requested", "approved", "rejected"] as const;
export type InsCoverStatus = (typeof INS_COVER_STATUS)[number];

/** The customer's current insurance situation. */
export const INS_POLICY_STATUS = ["new_vehicle", "active", "expired_recent", "expired_long", "not_sure"] as const;
export type InsPolicyStatus = (typeof INS_POLICY_STATUS)[number];

export const INS_INTENTS = ["new", "renewal"] as const;
export type InsIntent = (typeof INS_INTENTS)[number];

export const INS_LEAD_STATUS = ["new", "assigned", "contacted", "quote_requested", "quote_submitted", "follow_up", "interested", "policy_issued", "lost", "closed"] as const;
export type InsLeadStatus = (typeof INS_LEAD_STATUS)[number];

export const INS_LEAD_EVENT_KINDS = ["created", "note", "call", "email", "whatsapp", "status", "assign", "reminder", "quote", "policy", "renewal"] as const;
export type InsLeadEventKind = (typeof INS_LEAD_EVENT_KINDS)[number];

/** Stored quote status. "Viewed" (viewed_at) and "Expired" (valid_until passed) are derived — see quoteDisplayStatus(). */
export const INS_QUOTE_STATUS = ["draft", "submitted", "accepted", "declined", "withdrawn"] as const;
export type InsQuoteStatus = (typeof INS_QUOTE_STATUS)[number];

/** Every quote is one or the other, and says so on screen and in the PDF. */
export const INS_QUOTE_AUTHORIZATION = ["indicative", "insurer_authorised"] as const;
export type InsQuoteAuthorization = (typeof INS_QUOTE_AUTHORIZATION)[number];

export const INS_RENEWAL_STATUS = ["upcoming", "contacted", "quote_sent", "follow_up", "renewed", "lapsed", "lost", "closed"] as const;
export type InsRenewalStatus = (typeof INS_RENEWAL_STATUS)[number];

/** Promotional campaigns (shown on the insurance pages once approved). Scheduled/active/expired are derived from dates. */
export const INS_CAMPAIGN_STATUS = ["draft", "pending_approval", "changes_requested", "approved", "rejected", "paused", "cancelled"] as const;
export type InsCampaignStatus = (typeof INS_CAMPAIGN_STATUS)[number];

export const INS_CAMPAIGN_TYPES = ["product_launch", "renewal_drive", "ev_promotion", "seasonal", "awareness", "add_on_highlight", "other"] as const;
export type InsCampaignType = (typeof INS_CAMPAIGN_TYPES)[number];

export const INS_INVOICE_KINDS = ["subscription", "advertising", "lead_fee", "other"] as const;
export type InsInvoiceKind = (typeof INS_INVOICE_KINDS)[number];

export const INS_APPROVAL_TARGETS = ["vendor", "product", "cover", "campaign", "ad_campaign", "ad_creative", "document", "profile_change", "payment", "conversion", "company"] as const;
export type InsApprovalTarget = (typeof INS_APPROVAL_TARGETS)[number];

/** Public-site interactions for vendor analytics. */
export const INS_TRACK_KINDS = ["provider_view", "product_view", "quote_listing", "compare_add", "enquiry_cta", "campaign_view", "campaign_click", "quote_view", "document_download"] as const;
export type InsTrackKind = (typeof INS_TRACK_KINDS)[number];

/* ── Site-wide advertising (/admin/advertising) ──────────────── */

export const AD_FORMATS = ["banner", "sponsored_listing"] as const;
export type AdFormat = (typeof AD_FORMATS)[number];

/** Who may book a placement. */
export const AD_AUDIENCE = ["all", "insurer", "dealer"] as const;
export type AdAudience = (typeof AD_AUDIENCE)[number];

/** Stored ad campaign status. Scheduled/live/ended are derived from dates — see adDisplayStatus(). */
export const AD_CAMPAIGN_STATUS = ["draft", "pending_approval", "changes_requested", "approved", "rejected", "paused", "cancelled"] as const;
export type AdCampaignStatus = (typeof AD_CAMPAIGN_STATUS)[number];

export const AD_CREATIVE_STATUS = ["pending", "approved", "changes_requested", "rejected"] as const;
export type AdCreativeStatus = (typeof AD_CREATIVE_STATUS)[number];
