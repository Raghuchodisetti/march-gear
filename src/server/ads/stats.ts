import "server-only";
import { and, asc, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { adStats } from "@/db/schema";
import { addDays, daysBetween, istDate } from "@/components/portal/billing/shared";

/* Daily ad counters (one ad_stats row per campaign per IST day). */

export type StatField = "impressions" | "clicks" | "enquiries";

export interface StatTotals {
  impressions: number;
  clicks: number;
  enquiries: number;
}
export interface DayStat extends StatTotals {
  day: string;
}

export const ZERO: StatTotals = { impressions: 0, clicks: 0, enquiries: 0 };

const INCREMENT = {
  impressions: sql`impressions + 1`,
  clicks: sql`clicks + 1`,
  enquiries: sql`enquiries + 1`,
} as const;

/** Adds one to a counter for the IST day (INSERT … ON DUPLICATE KEY UPDATE x = x + 1). Throws on failure. */
export async function bumpAdStat(campaignId: number, field: StatField, day = istDate()) {
  const one = (f: StatField) => (f === field ? 1 : 0);
  const set = field === "impressions" ? { impressions: INCREMENT.impressions } : field === "clicks" ? { clicks: INCREMENT.clicks } : { enquiries: INCREMENT.enquiries };
  await getDb()
    .insert(adStats)
    .values({ campaignId, day, impressions: one("impressions"), clicks: one("clicks"), enquiries: one("enquiries") })
    .onDuplicateKeyUpdate({ set });
}

/** Lifetime totals per campaign. */
export async function totalsFor(ids: number[]): Promise<Map<number, StatTotals>> {
  const out = new Map<number, StatTotals>();
  if (!ids.length) return out;
  const rows = await getDb()
    .select({
      id: adStats.campaignId,
      impressions: sql<number>`coalesce(sum(${adStats.impressions}), 0)`.mapWith(Number),
      clicks: sql<number>`coalesce(sum(${adStats.clicks}), 0)`.mapWith(Number),
      enquiries: sql<number>`coalesce(sum(${adStats.enquiries}), 0)`.mapWith(Number),
    })
    .from(adStats)
    .where(inArray(adStats.campaignId, ids))
    .groupBy(adStats.campaignId);
  for (const r of rows) out.set(r.id, { impressions: r.impressions, clicks: r.clicks, enquiries: r.enquiries });
  return out;
}

/** Day-by-day totals across campaigns, every day from…to present (zeros filled in). */
export async function dailySeries(ids: number[], from: string, to: string): Promise<DayStat[]> {
  const days = Math.max(0, daysBetween(from, to) + 1);
  const map = new Map<string, DayStat>();
  for (let i = 0; i < days; i++) {
    const day = addDays(from, i);
    map.set(day, { day, ...ZERO });
  }
  if (ids.length && days) {
    const rows = await getDb()
      .select({
        day: adStats.day,
        impressions: sql<number>`sum(${adStats.impressions})`.mapWith(Number),
        clicks: sql<number>`sum(${adStats.clicks})`.mapWith(Number),
        enquiries: sql<number>`sum(${adStats.enquiries})`.mapWith(Number),
      })
      .from(adStats)
      .where(and(inArray(adStats.campaignId, ids), gte(adStats.day, from), lte(adStats.day, to)))
      .groupBy(adStats.day)
      .orderBy(asc(adStats.day));
    for (const r of rows) {
      const d = map.get(r.day);
      if (d) Object.assign(d, { impressions: r.impressions, clicks: r.clicks, enquiries: r.enquiries });
    }
  }
  return [...map.values()];
}

export const sumStats = (list: StatTotals[]): StatTotals =>
  list.reduce((a, s) => ({ impressions: a.impressions + s.impressions, clicks: a.clicks + s.clicks, enquiries: a.enquiries + s.enquiries }), { ...ZERO });
