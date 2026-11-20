import type { NextRequest } from "next/server";
import type { InsProductCategory } from "@/db/enums";
import { AD_STATUS_LABEL, INS_CAMPAIGN_STATUS_LABEL, INS_PRODUCT_CATEGORY_LABEL, INS_RENEWAL_STATUS_LABEL, adDisplayStatus, campaignDisplayStatus } from "@/insurance/labels";
import { requireStaff } from "@/server/auth";
import { csvResponse } from "@/server/admin/csv";
import { dayRange, getInsReports, type DayRange } from "@/server/admin/insurance-ops";
import { addDays, istDate } from "@/components/portal/billing/shared";
import { sourceLabel } from "@/components/admin/insurance/ops/labels";

const COUNT_HEAD = ["Enquiries", "Renewal enquiries", "Quoted", "Policies reported by vendor", "Verified by MarchGear"];
const counts = (g: { total: number; renewals: number; quoted: number; reported: number; verified: number }) => [g.total, g.renewals, g.quoted, g.reported, g.verified];
const rate = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "");

/** One report from /admin/insurance/reports as CSV (staff only; formula-safe cells). */
export async function GET(req: NextRequest) {
  await requireStaff();
  const p = req.nextUrl.searchParams;
  const today = istDate();
  const custom = dayRange(p.get("from") ?? undefined, p.get("to") ?? undefined);
  // Same default as the page: the last 30 days.
  const range: DayRange = p.get("range") === "all" ? {} : custom.from || custom.to ? custom : { from: addDays(today, -29), to: today };
  const report = p.get("report") ?? "vendors";
  const r = await getInsReports(range);
  const suffix = `${range.from ?? "start"}-to-${range.to ?? today}`;
  const file = (name: string) => `marchgear-insurance-${name}-${suffix}.csv`;
  const now = new Date();

  switch (report) {
    case "funnel":
      return csvResponse(file("funnel"), ["Stage", "Enquiries", "Of previous stage"], [
        ["Enquiries", r.funnel.enquiries, ""],
        ["Quote sent", r.funnel.quoted, rate(r.funnel.quoted, r.funnel.enquiries)],
        ["Customer interested", r.funnel.interested, rate(r.funnel.interested, r.funnel.quoted)],
        ["Policy reported by vendor", r.funnel.reported, rate(r.funnel.reported, r.funnel.interested)],
        ["Verified by MarchGear", r.funnel.verified, rate(r.funnel.verified, r.funnel.reported)],
      ]);
    case "quotes":
      return csvResponse(file("quote-acceptance"), ["Measure", "Quotes", "Share of sent"], [
        ["Sent", r.quotes.sent, ""],
        ["Viewed by the customer", r.quotes.viewed, rate(r.quotes.viewed, r.quotes.sent)],
        ["Customer interested", r.quotes.accepted, rate(r.quotes.accepted, r.quotes.sent)],
        ["Declined", r.quotes.declined, rate(r.quotes.declined, r.quotes.sent)],
        ["Expired unanswered", r.quotes.expired, rate(r.quotes.expired, r.quotes.sent)],
        ["Withdrawn", r.quotes.withdrawn, rate(r.quotes.withdrawn, r.quotes.sent)],
        ["Still open", r.quotes.open, rate(r.quotes.open, r.quotes.sent)],
      ]);
    case "products":
      return csvResponse(file("enquiries-by-product"), ["Product", "Code · vendor", "Category", ...COUNT_HEAD], r.byProduct.map((g) => [g.label, g.sub, g.category ? INS_PRODUCT_CATEGORY_LABEL[g.category] : "", ...counts(g)]));
    case "categories":
      return csvResponse(file("enquiries-by-category"), ["Category", ...COUNT_HEAD], r.byCategory.map((g) => [INS_PRODUCT_CATEGORY_LABEL[g.key as InsProductCategory] ?? "Product removed", ...counts(g)]));
    case "cities":
      return csvResponse(file("enquiries-by-city"), ["City", ...COUNT_HEAD], r.byCity.map((g) => [g.label, ...counts(g)]));
    case "sources":
      return csvResponse(file("enquiries-by-source"), ["Source", ...COUNT_HEAD], r.bySource.map((g) => [sourceLabel(g.key), ...counts(g)]));
    case "renewals":
      return csvResponse(file("renewals-pipeline"), ["Group", "Renewals"], [
        ...r.pipeline.buckets.map((b) => [`Open · ${b.label}`, b.n]),
        ...r.pipeline.byStatus.map((b) => [`Status · ${INS_RENEWAL_STATUS_LABEL[b.status]}`, b.n]),
        ["Renewed in the period", r.pipeline.renewedInRange],
      ]);
    case "promotions":
      return csvResponse(
        file("promotion-performance"),
        ["Campaign", "Reference", "Vendor", "Status", "Starts", "Ends", "Views", "Clicks", "CTR", "Enquiries", "Policies (reported or verified)"],
        r.promotions.map((c) => [c.title, c.reference, c.vendor, INS_CAMPAIGN_STATUS_LABEL[campaignDisplayStatus(c, now)], istDate(c.startsAt), istDate(c.endsAt), c.views, c.clicks, rate(c.clicks, c.views), c.enquiries, c.policies]),
      );
    case "ads":
      return csvResponse(
        file("ad-performance"),
        ["Ad campaign", "Reference", "Advertiser", "Placement", "Status", "Starts", "Ends", "Impressions", "Clicks", "CTR", "Enquiries"],
        r.ads.map((a) => [a.name, a.reference, a.advertiser, a.placement, AD_STATUS_LABEL[adDisplayStatus(a, today)], a.startsOn, a.endsOn, a.impressions, a.clicks, rate(a.clicks, a.impressions), a.enquiries]),
      );
    case "league":
      return csvResponse(
        file("vendor-league"),
        ["Rank", "Vendor", "Reference", "Enquiries", "Quoted", "Quotes sent", "Quotes accepted", "Policies reported", "Policies verified", "Median hours to first quote", "Collected (₹)"],
        r.league.map((v, i) => [i + 1, v.name, v.reference, v.enquiries, v.quoted, v.quotesSent, v.accepted, v.reported, v.verified, v.medianResponseHours === null ? "" : v.medianResponseHours.toFixed(1), v.collected]),
      );
    default:
      return csvResponse(file("enquiries-by-vendor"), ["Vendor", "Reference", ...COUNT_HEAD], r.byVendor.map((g) => [g.label, g.sub, ...counts(g)]));
  }
}
