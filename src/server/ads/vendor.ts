import "server-only";
import { desc, eq } from "drizzle-orm";
import { adCampaigns } from "@/db/schema";
import { addDays, istDate } from "@/components/portal/billing/shared";
import { campaignSelect, enrich } from "./campaigns";
import { adRevenue } from "./admin";
import { dailySeries, sumStats } from "./stats";

/* The vendor's advertising overview: its bookings, totals, spend and a daily trend. Scoped by vendor id. */

export const TREND_DAYS = 30;

export async function vendorAdOverview(vendorId: number) {
  const today = istDate();
  const rows = await campaignSelect().where(eq(adCampaigns.insVendorId, vendorId)).orderBy(desc(adCampaigns.createdAt), desc(adCampaigns.id)).limit(200);
  const items = await enrich(rows, today);
  const ids = items.map((i) => i.id);
  const from = addDays(today, -(TREND_DAYS - 1));
  const [series, money] = await Promise.all([dailySeries(ids, from, today), adRevenue({ vendorId })]);
  return { today, items, series, totals: sumStats(items.map((i) => i.stats)), money };
}
