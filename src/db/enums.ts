/** Enum values shared by the schema, server and client code (no database imports). */

export const PUBLISH_STATUS = ["published", "draft"] as const;
export type PublishStatus = (typeof PUBLISH_STATUS)[number];

export const USED_STATUS = ["active", "reserved", "sold", "draft"] as const;
export type UsedStatus = (typeof USED_STATUS)[number];

export const REVIEW_STATUS = ["pending", "approved", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUS)[number];

export const USER_ROLES = ["customer", "editor", "admin"] as const;
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
] as const;
export type LeadType = (typeof LEAD_TYPES)[number];

export const LEAD_STATUS = ["new", "contacted", "qualified", "converted", "closed"] as const;
export type LeadStatus = (typeof LEAD_STATUS)[number];

export const FUEL_TYPES = ["Petrol", "Diesel", "CNG", "Hybrid", "Electric"] as const;
