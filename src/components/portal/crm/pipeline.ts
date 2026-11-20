import type { CrmStatus, LeadSource } from "@/db/enums";

/* Pipeline maths and IST date helpers shared by the CRM screens and their Server Actions. Client-safe. */

/** How far along the sales pipeline each status is (lost/closed say nothing about how far a lead got). */
export const PIPELINE_RANK: Record<CrmStatus, number> = {
  new: 0,
  contacted: 1,
  follow_up: 1,
  interested: 2,
  test_drive_scheduled: 3,
  negotiation: 4,
  booking_completed: 5,
  converted: 5,
  lost: -1,
  closed: -1,
};

export const FUNNEL = [
  { key: "new", label: "New", rank: 0 },
  { key: "contacted", label: "Contacted", rank: 1 },
  { key: "interested", label: "Interested", rank: 2 },
  { key: "test_drive", label: "Test drive", rank: 3 },
  { key: "negotiation", label: "Negotiation", rank: 4 },
  { key: "won", label: "Converted", rank: 5 },
] as const;

/** Finished leads — reminders on these no longer matter. */
export const CRM_FINISHED: CrmStatus[] = ["converted", "lost", "closed"];

/** Sources a dealer can pick when adding an enquiry by hand. */
export const MANUAL_SOURCES: LeadSource[] = ["walk_in", "phone", "referral", "social", "event", "other"];

export const CALL_OUTCOMES = {
  connected: "Connected",
  no_answer: "No answer",
  busy: "Busy",
  callback: "Asked to call back",
  wrong_number: "Wrong number",
  not_interested: "Not interested",
} as const;
export type CallOutcome = keyof typeof CALL_OUTCOMES;

export const LOST_REASONS = [
  "Bought from another dealer",
  "Price too high",
  "Financing not approved",
  "Chose another model",
  "Not reachable",
  "Postponed purchase",
  "Other",
] as const;

const IST_MS = 5.5 * 3_600_000;

/** "YYYY-MM-DDTHH:mm" in IST — the value a datetime-local input expects. */
export function toISTInput(d: Date | string) {
  const t = new Date(typeof d === "string" ? d : d.getTime());
  return new Date(t.getTime() + IST_MS).toISOString().slice(0, 16);
}

/** Parses a datetime-local value as IST, whatever the browser's or server's own time zone. */
export function fromISTInput(v: string) {
  return new Date(`${v}:00+05:30`);
}

/** The IST calendar day "YYYY-MM-DD" of an instant. */
export const istDay = (d: Date | string) => new Date(new Date(d).getTime() + IST_MS).toISOString().slice(0, 10);

/** Minutes since IST midnight. */
export const istMinutes = (d: Date | string) => {
  const t = new Date(new Date(d).getTime() + IST_MS);
  return t.getUTCHours() * 60 + t.getUTCMinutes();
};

/* Deterministic IST formatting (no Intl), so server-rendered and hydrated text always agree. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ist = (d: Date | string) => new Date(new Date(d).getTime() + IST_MS);

/** "4:30 pm" */
export function formatTime(d: Date | string) {
  const t = ist(d);
  const h = t.getUTCHours();
  return `${((h + 11) % 12) + 1}:${String(t.getUTCMinutes()).padStart(2, "0")} ${h >= 12 ? "pm" : "am"}`;
}

/** "21 Nov 2026" (or "21 Nov" without the year) */
export function formatIstDay(d: Date | string, withYear = true) {
  const t = ist(d);
  return `${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]}${withYear ? ` ${t.getUTCFullYear()}` : ""}`;
}

/** "Sat, 21 Nov · 4:30 pm" */
export function formatWhen(d: Date | string, opts: { weekday?: boolean; year?: boolean } = {}) {
  const t = ist(d);
  return `${opts.weekday ? `${WEEKDAYS[t.getUTCDay()]}, ` : ""}${formatIstDay(d, opts.year ?? false)} · ${formatTime(d)}`;
}

/** "21 Nov 2026, 4:30 pm" */
export const formatIstDateTime = (d: Date | string) => `${formatIstDay(d)}, ${formatTime(d)}`;

export const monthLabel = (year: number, month: number) => `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][month]} ${year}`;

/** "2h 15m", "3d 4h", "12m". */
export function formatDuration(ms: number) {
  const m = Math.max(0, Math.round(ms / 60_000));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h${m % 60 ? ` ${m % 60}m` : ""}`;
  const d = Math.floor(h / 24);
  return `${d}d${h % 24 ? ` ${h % 24}h` : ""}`;
}

/** "in 2h", "3d ago". */
export function relativeTime(d: Date | string, now = Date.now()) {
  const diff = new Date(d).getTime() - now;
  const label = formatDuration(Math.abs(diff));
  if (Math.abs(diff) < 60_000) return "just now";
  return diff > 0 ? `in ${label}` : `${label} ago`;
}

export const isOverdue = (followUpAt: string | Date | null, status: CrmStatus, now = Date.now()) =>
  Boolean(followUpAt) && !CRM_FINISHED.includes(status) && new Date(followUpAt as string).getTime() < now;

/** WhatsApp click-to-chat for an Indian mobile number. */
export const whatsappHref = (mobile: string, text?: string) =>
  `https://wa.me/91${mobile.replace(/\D/g, "").slice(-10)}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

/** The customers page groups people by mobile number, else email. */
export function customerKey(mobile: string | null | undefined, email: string | null | undefined) {
  const m = mobile?.replace(/\D/g, "").slice(-10);
  if (m && m.length === 10) return `m-${m}`;
  const e = email?.trim().toLowerCase();
  if (e) return `e-${encodeURIComponent(e)}`;
  return null;
}

export function parseCustomerKey(key: string): { mobile: string } | { email: string } | null {
  const k = decodeURIComponent(key);
  if (/^m-[6-9]\d{9}$/.test(k)) return { mobile: k.slice(2) };
  if (k.startsWith("e-") && k.length > 4 && k.length < 200 && k.includes("@")) return { email: k.slice(2).toLowerCase() };
  return null;
}
