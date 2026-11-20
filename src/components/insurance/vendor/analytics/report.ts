import { addDays, daysBetween, istDate } from "@/components/portal/billing/shared";
import { formatDate } from "@/lib/format";
import type { Metric } from "@/components/portal/analytics/report";

/* ──────────────────────────────────────────────────────────────
   Insurance vendor analytics: the date range (IST days) and the
   report shape. Client-safe — the page, the CSV export and the
   server share it.
   ────────────────────────────────────────────────────────────── */

export type { Metric };
export const INS_RANGE_PRESETS = ["30", "90", "365", "custom"] as const;
export type InsRangePreset = (typeof INS_RANGE_PRESETS)[number];
export const MAX_RANGE_DAYS = 731;

export interface InsDateRange {
  preset: InsRangePreset;
  from: string;
  to: string;
  days: number;
  prevFrom: string;
  prevTo: string;
  label: string;
  prevLabel: string;
  error?: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const validIso = (v: string | undefined): v is string => Boolean(v && ISO.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v));
const span = (from: string, to: string) => (from.slice(0, 4) === to.slice(0, 4) ? `${formatDate(from).replace(/ \d{4}$/, "")} – ${formatDate(to)}` : `${formatDate(from)} – ${formatDate(to)}`);

function build(preset: InsRangePreset, from: string, to: string, error?: string): InsDateRange {
  const days = daysBetween(from, to) + 1;
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(days - 1));
  return { preset, from, to, days, prevFrom, prevTo, label: span(from, to), prevLabel: span(prevFrom, prevTo), ...(error ? { error } : {}) };
}

/** ?range=30|90|365|custom&from=&to= — the last N days end today (IST). Defaults to 90 days. */
export function resolveInsRange(input: { range?: string; from?: string; to?: string }, today = istDate()): InsDateRange {
  const preset = (INS_RANGE_PRESETS as readonly string[]).includes(input.range ?? "") ? (input.range as InsRangePreset) : "90";
  if (preset !== "custom") return build(preset, addDays(today, -(Number(preset) - 1)), today);
  const { from, to } = input;
  const fallback = (error: string) => build("90", addDays(today, -89), today, error);
  if (!validIso(from) || !validIso(to)) return fallback("Choose both a start and an end date.");
  if (from > to) return fallback("The start date must be on or before the end date.");
  if (to > today) return fallback("The end date can't be in the future.");
  if (daysBetween(from, to) + 1 > MAX_RANGE_DAYS) return fallback(`Choose a range of up to ${MAX_RANGE_DAYS} days.`);
  return build("custom", from, to);
}

export const insRangeQuery = (r: Pick<InsDateRange, "preset" | "from" | "to">): Record<string, string> => (r.preset === "custom" ? { range: "custom", from: r.from, to: r.to } : { range: r.preset });

export type Bucket = "day" | "week" | "month";

export interface InsSeriesPoint {
  /** First and last IST day of the bucket. */
  date: string;
  end: string;
  label: string;
  enquiries: number;
  quotes: number;
  policies: number;
}

export interface InsAnalyticsReport {
  vendor: { name: string; reference: string };
  range: InsDateRange;
  generatedAt: string;
  bucket: Bucket;
  kpis: {
    enquiries: Metric;
    quotesSent: Metric;
    accepted: Metric;
    policiesReported: Metric;
    policiesVerified: Metric;
    productViews: Metric;
    providerViews: Metric;
    adImpressions: Metric;
    adClicks: Metric;
  };
  /** Percentages (0–100). */
  rates: { quoteAcceptance: Metric; conversion: Metric; renewal: Metric; adCtr: Metric };
  series: InsSeriesPoint[];
  sources: { key: string; label: string; value: number }[];
  cities: { key: string; label: string; value: number }[];
  funnel: { key: string; label: string; value: number }[];
  quoteOutcomes: { key: string; label: string; value: number }[];
  renewals: { pipeline: { key: string; label: string; value: number }[]; due: number; renewed: number; lost: number; open: number; upcoming: number; windowDays: number };
  views: { key: string; label: string; value: number }[];
  products: { id: number; name: string; status: string; views: number; listings: number; enquiries: number; quotes: number; policies: number }[];
  campaigns: { id: number; reference: string; title: string; status: string; views: number; clicks: number; enquiries: number; policies: number }[];
  ads: { id: number; reference: string; name: string; placement: string; status: string; impressions: number; clicks: number; ctr: number; enquiries: number; spend: number }[];
  adSpend: { month: string; label: string; invoiced: number; paid: number }[];
}

export const pct = (n: number, d: number) => (d ? (n / d) * 100 : 0);
export const fmtPct = (v: number) => `${v < 10 && v > 0 ? v.toFixed(1) : Math.round(v)}%`;
