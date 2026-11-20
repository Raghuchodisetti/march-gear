import type { TicketPriority, TicketStatus } from "@/db/enums";
import type { Tone } from "@/partner/labels";

/* Insurance vendor support tickets — options shared by the portal pages and the server. Client-safe. */

export const INS_TICKET_CATEGORIES = [
  { value: "onboarding", label: "Onboarding & verification" },
  { value: "products", label: "Products, coverage & add-ons" },
  { value: "enquiries", label: "Enquiries, quotes & renewals" },
  { value: "billing", label: "Plans, invoices & payments" },
  { value: "advertising", label: "Campaigns & advertising" },
  { value: "technical", label: "Technical problem" },
  { value: "other", label: "Something else" },
] as const;
export type InsTicketCategory = (typeof INS_TICKET_CATEGORIES)[number]["value"];

export const insCategoryLabel = (v: string) => INS_TICKET_CATEGORIES.find((c) => c.value === v)?.label ?? v;

/** Vendor-facing status wording. The shared enum value "awaiting_dealer" means "waiting for the vendor's reply". */
export const INS_TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Open",
  awaiting_support: "With MarchGear",
  awaiting_dealer: "Awaiting your reply",
  resolved: "Resolved",
  closed: "Closed",
};
export const INS_TICKET_STATUS_TONE: Record<TicketStatus, Tone> = { open: "blue", awaiting_support: "blue", awaiting_dealer: "amber", resolved: "green", closed: "neutral" };

export const INS_TICKET_PRIORITY_LABEL: Record<TicketPriority, string> = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" };
export const INS_PRIORITY_TONE: Record<TicketPriority, Tone> = { low: "neutral", normal: "blue", high: "amber", urgent: "red" };
export const INS_PRIORITY_HINT: Record<TicketPriority, string> = {
  low: "A question — no rush",
  normal: "Needs an answer in a day or two",
  high: "Affecting customers or enquiries today",
  urgent: "Portal unusable or products not showing",
};

/** Statuses the vendor sees as still in progress. */
export const INS_TICKET_ACTIVE: TicketStatus[] = ["open", "awaiting_support", "awaiting_dealer"];

export const MAX_TICKET_FILES = 5;

/* Server-safe twins of the uploader's helpers. */
export const insFileHref = (f: { id: number }) => `/insurance-vendor/files/${f.id}`;
export const sizeLabel = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
