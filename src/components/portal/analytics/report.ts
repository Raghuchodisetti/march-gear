import { addDays, daysBetween, istDate } from "@/components/portal/billing/shared";
import { formatDate } from "@/lib/format";

/* ──────────────────────────────────────────────────────────────
   Dealer analytics: the date range (IST days) and the report shape.
   Client-safe — the page, the exports and the server share it.
   ────────────────────────────────────────────────────────────── */

export const RANGE_PRESETS = ["7", "30", "90", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];
export const MAX_RANGE_DAYS = 366;

export interface DateRange {
  preset: RangePreset;
  from: string;
  to: string;
  days: number;
  prevFrom: string;
  prevTo: string;
  label: string;
  prevLabel: string;
  /** Set when a custom range was invalid and we fell back. */
  error?: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const validIso = (v: string | undefined): v is string => Boolean(v && ISO.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v));
const span = (from: string, to: string) => (from.slice(0, 4) === to.slice(0, 4) ? `${formatDate(from).replace(/ \d{4}$/, "")} – ${formatDate(to)}` : `${formatDate(from)} – ${formatDate(to)}`);

function build(preset: RangePreset, from: string, to: string, error?: string): DateRange {
  const days = daysBetween(from, to) + 1;
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(days - 1));
  return { preset, from, to, days, prevFrom, prevTo, label: span(from, to), prevLabel: span(prevFrom, prevTo), ...(error ? { error } : {}) };
}

/** The range from ?range=7|30|90|custom&from=&to= — the last N days end today (IST). */
export function resolveRange(input: { range?: string; from?: string; to?: string }, today = istDate()): DateRange {
  const preset = (RANGE_PRESETS as readonly string[]).includes(input.range ?? "") ? (input.range as RangePreset) : "30";
  if (preset !== "custom") return build(preset, addDays(today, -(Number(preset) - 1)), today);
  const { from, to } = input;
  const fallback = (error: string) => build("30", addDays(today, -29), today, error);
  if (!validIso(from) || !validIso(to)) return fallback("Choose both a start and an end date.");
  if (from > to) return fallback("The start date must be on or before the end date.");
  if (to > today) return fallback("The end date can't be in the future.");
  if (daysBetween(from, to) + 1 > MAX_RANGE_DAYS) return fallback(`Choose a range of up to ${MAX_RANGE_DAYS} days.`);
  return build("custom", from, to);
}

export const rangeQuery = (r: Pick<DateRange, "preset" | "from" | "to">) => (r.preset === "custom" ? { range: "custom", from: r.from, to: r.to } : { range: r.preset });

/* ── Report ───────────────────────────────────────────────────── */

export const METRICS = {
  profileViews: "Dealer profile views",
  vehicleViews: "Vehicle views",
  offerViews: "Offer views",
  contactClicks: "Call, WhatsApp & directions",
  enquiries: "All enquiries",
  vehicleEnquiries: "Vehicle enquiries",
  offerEnquiries: "Offer enquiries",
  leadConversions: "Lead conversions",
  testDrivesCompleted: "Test drives completed",
  testDriveConversions: "Test-drive conversions",
} as const;
export type MetricKey = keyof typeof METRICS;

export interface Metric {
  value: number;
  prev: number;
}

export interface SeriesPoint {
  /** First day of the bucket. */
  date: string;
  /** Last day of the bucket (same as date for daily buckets). */
  end: string;
  views: number;
  enquiries: number;
  prevViews: number;
  prevEnquiries: number;
}

export interface AnalyticsReport {
  dealer: { name: string; reference: string };
  range: DateRange;
  generatedAt: string;
  bucket: "day" | "week";
  totals: Record<MetricKey, Metric>;
  /** Won leads ÷ enquiries, and completed test drives that became won leads. */
  rates: { leadConversion: Metric; testDriveConversion: Metric; viewToEnquiry: Metric };
  clicks: { phone: number; whatsapp: number; directions: number };
  series: SeriesPoint[];
  funnel: { key: string; label: string; value: number }[];
  sources: { source: string; label: string; value: number }[];
  vehicles: { id: number; reference: string; label: string; kind: string; status: string; views: number; enquiries: number; won: number }[];
  campaigns: { id: number; reference: string; title: string; campaign: string; status: string; views: number; enquiries: number; won: number }[];
  team: { memberId: number | null; name: string; role: string; assigned: number; contacted: number; converted: number; avgResponseMins: number | null; responded: number }[];
}

/** % with one decimal under 10, whole numbers above. */
export const pct = (n: number, d: number) => (d ? (n / d) * 100 : 0);
export const fmtPct = (v: number) => `${v < 10 && v > 0 ? v.toFixed(1) : Math.round(v)}%`;

/** Change vs the previous period, or null when there's nothing to compare with. */
export function delta(m: Metric) {
  if (!m.prev) return m.value ? { pct: null, up: true } : null;
  const d = ((m.value - m.prev) / m.prev) * 100;
  return { pct: d, up: d >= 0 };
}

export function fmtDuration(mins: number | null) {
  if (mins === null) return "—";
  if (mins < 1) return "< 1 min";
  if (mins < 60) return `${Math.round(mins)} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ${Math.round(mins % 60)}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}
