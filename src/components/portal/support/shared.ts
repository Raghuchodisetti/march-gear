import type { TicketPriority, TicketStatus } from "@/db/enums";
import type { Tone } from "@/partner/labels";

/* Support ticket options shared by the dealer portal, the admin inbox and the server. Client-safe. */

export const TICKET_CATEGORIES = [
  { value: "account", label: "Account & verification" },
  { value: "billing", label: "Subscription & invoices" },
  { value: "inventory", label: "Vehicle listings" },
  { value: "catalogue", label: "Request a new model" },
  { value: "offers", label: "Offers & campaigns" },
  { value: "leads", label: "Enquiries & test drives" },
  { value: "profile", label: "Dealer profile & showrooms" },
  { value: "technical", label: "Technical problem" },
  { value: "other", label: "Something else" },
] as const;

export const categoryLabel = (v: string) => TICKET_CATEGORIES.find((c) => c.value === v)?.label ?? v;

export const PRIORITY_TONE: Record<TicketPriority, Tone> = { low: "neutral", normal: "blue", high: "amber", urgent: "red" };
export const PRIORITY_HINT: Record<TicketPriority, string> = {
  low: "A question — no rush",
  normal: "Needs an answer in a day or two",
  high: "Affecting your sales today",
  urgent: "Portal unusable or listings down",
};

/** Staff-facing wording (the dealer-facing labels live in src/partner/labels.ts). */
export const STAFF_TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: "New",
  awaiting_dealer: "Awaiting dealer",
  awaiting_support: "Awaiting support",
  resolved: "Resolved",
  closed: "Closed",
};
export const STAFF_TICKET_STATUS_TONE: Record<TicketStatus, Tone> = { open: "red", awaiting_dealer: "amber", awaiting_support: "red", resolved: "green", closed: "neutral" };

/** Statuses the dealer sees as still in progress. */
export const TICKET_ACTIVE: TicketStatus[] = ["open", "awaiting_dealer", "awaiting_support"];

/* Server-safe twins of the uploader's helpers (functions exported from a "use client" module can't be called on the server). */
export const fileHref = (f: { id: number }) => `/dealer/files/${f.id}`;
export const sizeLabel = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
