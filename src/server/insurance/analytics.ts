import "server-only";
import { and, count, eq, gte, inArray, isNotNull, lt, lte, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { adCampaigns, adPlacements, adStats, insCampaigns, insEnquiries, insEnquiryEvents, insEvents, insInvoices, insProducts, insQuotes, insRenewals } from "@/db/schema";
import type { InsRenewalStatus, InsTrackKind } from "@/db/enums";
import { INS_CAMPAIGN_STATUS_LABEL, INS_PRODUCT_STATUS_LABEL, INS_RENEWAL_OPEN, INS_RENEWAL_STATUS_LABEL, AD_STATUS_LABEL, adDisplayStatus, campaignDisplayStatus } from "@/insurance/labels";
import { vendorName, type VendorRow } from "@/server/insurance/context";
import { addDays, daysBetween, istDate } from "@/components/portal/billing/shared";
import { sourceLabel } from "@/components/insurance/vendor/crm/shared";
import type { Bucket, InsAnalyticsReport, InsDateRange, InsSeriesPoint } from "@/components/insurance/vendor/analytics/report";

/* ──────────────────────────────────────────────────────────────
   Insurance vendor analytics for a date range (IST days) and the
   period before it. Sources: ins_enquiries (+ status events),
   ins_quotes, ins_renewals, ins_events (public-site views),
   ins_campaigns, ad_campaigns + ad_stats, ins_invoices.
   Every query is scoped to the one vendor. Reported and verified
   policy conversions are kept apart.
   ────────────────────────────────────────────────────────────── */

const IST_MS = 5.5 * 3_600_000;
const istStart = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) - IST_MS);
const istDayOf = (d: Date) => new Date(d.getTime() + IST_MS).toISOString().slice(0, 10);
const istDayExpr = (col: unknown) => sql<string>`DATE_FORMAT(DATE_ADD(${col}, INTERVAL 330 MINUTE), '%Y-%m-%d')`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dm = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
const metric = (value: number, prev: number) => ({ value, prev });

const VIEW_LABEL: Record<InsTrackKind, string> = {
  provider_view: "Provider page views",
  product_view: "Product page views",
  quote_listing: "Shown in quote results",
  compare_add: "Added to compare",
  enquiry_cta: "“Get quote” clicks",
  campaign_view: "Campaign views",
  campaign_click: "Campaign clicks",
  quote_view: "Quote links opened",
  document_download: "Brochure / wording downloads",
};

/** Buckets covering the range: days (≤ 31 days), weeks (≤ 120) or calendar months. */
function buckets(range: InsDateRange): { bucket: Bucket; points: { date: string; end: string; label: string }[] } {
  if (range.days <= 31) {
    return { bucket: "day", points: Array.from({ length: range.days }, (_, i) => addDays(range.from, i)).map((d) => ({ date: d, end: d, label: dm(d) })) };
  }
  if (range.days <= 120) {
    const out: { date: string; end: string; label: string }[] = [];
    for (let d = range.from; d <= range.to; d = addDays(d, 7)) {
      const end = addDays(d, 6) > range.to ? range.to : addDays(d, 6);
      out.push({ date: d, end, label: `${dm(d)} – ${dm(end)}` });
    }
    return { bucket: "week", points: out };
  }
  const out: { date: string; end: string; label: string }[] = [];
  let ym = range.from.slice(0, 7);
  while (`${ym}-01` <= range.to) {
    const [y, m] = ym.split("-").map(Number);
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    const start = `${ym}-01` < range.from ? range.from : `${ym}-01`;
    const last = addDays(`${next}-01`, -1);
    out.push({ date: start, end: last > range.to ? range.to : last, label: monthLabel(ym) });
    ym = next;
  }
  return { bucket: "month", points: out };
}

export async function getInsAnalytics(vendor: VendorRow, range: InsDateRange, opts: { renewalWindowDays: number }): Promise<InsAnalyticsReport> {
  const db = getDb();
  const vid = vendor.id;
  const end = istStart(addDays(range.to, 1));
  const prevStart = istStart(range.prevFrom);
  const today = istDate();
  const inCur = (day: string) => day >= range.from && day <= range.to;
  const inPrev = (day: string) => day >= range.prevFrom && day <= range.prevTo;

  const [enquiries, interestedEvents, quotes, events, renewals, campaigns, ads, adDaily, invoices, products] = await Promise.all([
    db
      .select({
        id: insEnquiries.id,
        createdAt: insEnquiries.createdAt,
        source: insEnquiries.source,
        city: insEnquiries.city,
        productId: insEnquiries.productId,
        status: insEnquiries.status,
        campaignId: insEnquiries.campaignId,
        adCampaignId: insEnquiries.adCampaignId,
        policyIssuedAt: insEnquiries.policyIssuedAt,
        conversionVerifiedAt: insEnquiries.conversionVerifiedAt,
      })
      .from(insEnquiries)
      .where(and(eq(insEnquiries.vendorId, vid), gte(insEnquiries.createdAt, prevStart), lt(insEnquiries.createdAt, end))),
    // Enquiries that ever reached "interested" (they may have moved on since).
    db
      .selectDistinct({ enquiryId: insEnquiryEvents.enquiryId })
      .from(insEnquiryEvents)
      .where(and(eq(insEnquiryEvents.vendorId, vid), eq(insEnquiryEvents.kind, "status"), sql`JSON_UNQUOTE(JSON_EXTRACT(${insEnquiryEvents.meta}, '$.to')) = 'interested'`)),
    db
      .select({ id: insQuotes.id, enquiryId: insQuotes.enquiryId, productId: insQuotes.productId, status: insQuotes.status, submittedAt: insQuotes.submittedAt, viewedAt: insQuotes.viewedAt, validUntil: insQuotes.validUntil })
      .from(insQuotes)
      .where(and(eq(insQuotes.vendorId, vid), isNotNull(insQuotes.submittedAt), gte(insQuotes.submittedAt, prevStart), lt(insQuotes.submittedAt, end))),
    db
      .select({ kind: insEvents.kind, refId: insEvents.refId, day: istDayExpr(insEvents.createdAt), n: count() })
      .from(insEvents)
      .where(and(eq(insEvents.vendorId, vid), gte(insEvents.createdAt, prevStart), lt(insEvents.createdAt, end)))
      .groupBy(insEvents.kind, insEvents.refId, istDayExpr(insEvents.createdAt)),
    db.select({ status: insRenewals.status, expiryDate: insRenewals.expiryDate }).from(insRenewals).where(eq(insRenewals.vendorId, vid)),
    db
      .select({ id: insCampaigns.id, reference: insCampaigns.reference, title: insCampaigns.title, status: insCampaigns.status, startsAt: insCampaigns.startsAt, endsAt: insCampaigns.endsAt })
      .from(insCampaigns)
      .where(and(eq(insCampaigns.vendorId, vid), ne(insCampaigns.status, "draft")))
      .limit(100),
    db
      .select({ id: adCampaigns.id, reference: adCampaigns.reference, name: adCampaigns.name, status: adCampaigns.status, startsOn: adCampaigns.startsOn, endsOn: adCampaigns.endsOn, total: adCampaigns.total, days: adCampaigns.days, placement: adPlacements.name })
      .from(adCampaigns)
      .innerJoin(adPlacements, eq(adPlacements.id, adCampaigns.placementId))
      .where(eq(adCampaigns.insVendorId, vid))
      .limit(100),
    db
      .select({ campaignId: adStats.campaignId, day: adStats.day, impressions: adStats.impressions, clicks: adStats.clicks, enquiries: adStats.enquiries })
      .from(adStats)
      .innerJoin(adCampaigns, eq(adCampaigns.id, adStats.campaignId))
      .where(and(eq(adCampaigns.insVendorId, vid), gte(adStats.day, range.prevFrom), lte(adStats.day, range.to))),
    db
      .select({ periodStart: insInvoices.periodStart, total: insInvoices.total, status: insInvoices.status })
      .from(insInvoices)
      .where(and(eq(insInvoices.vendorId, vid), eq(insInvoices.kind, "advertising"), ne(insInvoices.status, "void"), gte(insInvoices.periodStart, range.from), lte(insInvoices.periodStart, range.to))),
    db.select({ id: insProducts.id, name: insProducts.name, status: insProducts.status }).from(insProducts).where(eq(insProducts.vendorId, vid)),
  ]);

  /* Enquiries */
  const cur = enquiries.filter((e) => inCur(istDayOf(e.createdAt)));
  const prev = enquiries.filter((e) => inPrev(istDayOf(e.createdAt)));
  // Conversions are counted on the day the policy was issued, whichever period the enquiry arrived in.
  const allPolicies = await db
    .select({ id: insEnquiries.id, productId: insEnquiries.productId, campaignId: insEnquiries.campaignId, policyIssuedAt: insEnquiries.policyIssuedAt, conversionVerifiedAt: insEnquiries.conversionVerifiedAt, status: insEnquiries.status })
    .from(insEnquiries)
    .where(and(eq(insEnquiries.vendorId, vid), eq(insEnquiries.status, "policy_issued"), isNotNull(insEnquiries.policyIssuedAt), gte(insEnquiries.policyIssuedAt, prevStart), lt(insEnquiries.policyIssuedAt, end)));
  const policiesCur = allPolicies.filter((e) => inCur(istDayOf(e.policyIssuedAt!)));
  const policiesPrev = allPolicies.filter((e) => inPrev(istDayOf(e.policyIssuedAt!)));

  /* Quotes */
  const qCur = quotes.filter((q) => q.submittedAt && inCur(istDayOf(q.submittedAt)));
  const qPrev = quotes.filter((q) => q.submittedAt && inPrev(istDayOf(q.submittedAt)));
  const accepted = (rows: typeof quotes) => rows.filter((q) => q.status === "accepted").length;

  /* Funnel: this period's enquiries and how far each got */
  const curIds = new Set(cur.map((e) => e.id));
  const quotedIds = new Set(
    (
      await (cur.length
        ? db
            .selectDistinct({ enquiryId: insQuotes.enquiryId })
            .from(insQuotes)
            .where(and(eq(insQuotes.vendorId, vid), isNotNull(insQuotes.submittedAt), inArray(insQuotes.enquiryId, [...curIds])))
        : Promise.resolve([]))
    ).map((r) => r.enquiryId),
  );
  const interestedIds = new Set(interestedEvents.map((r) => r.enquiryId));
  const reached = (e: (typeof cur)[number]) => ({
    quoted: quotedIds.has(e.id) || ["quote_submitted", "interested", "policy_issued"].includes(e.status),
    interested: interestedIds.has(e.id) || ["interested", "policy_issued"].includes(e.status),
    policy: e.status === "policy_issued",
    verified: e.status === "policy_issued" && Boolean(e.conversionVerifiedAt),
  });
  const r = cur.map(reached);
  const funnel = [
    { key: "enquiries", label: "Enquiries", value: cur.length },
    { key: "quoted", label: "Quoted", value: r.filter((x) => x.quoted).length },
    { key: "interested", label: "Interested", value: r.filter((x) => x.interested).length },
    { key: "reported", label: "Policy issued (reported)", value: r.filter((x) => x.policy).length },
    { key: "verified", label: "Verified by MarchGear", value: r.filter((x) => x.verified).length },
  ];
  const prevReached = prev.filter((e) => e.status === "policy_issued").length;

  /* Series */
  const { bucket, points } = buckets(range);
  const bucketOf = (day: string) => points.findIndex((p) => day >= p.date && day <= p.end);
  const series: InsSeriesPoint[] = points.map((p) => ({ ...p, enquiries: 0, quotes: 0, policies: 0 }));
  for (const e of cur) {
    const i = bucketOf(istDayOf(e.createdAt));
    if (i >= 0) series[i].enquiries++;
  }
  for (const q of qCur) {
    const i = bucketOf(istDayOf(q.submittedAt!));
    if (i >= 0) series[i].quotes++;
  }
  for (const p of policiesCur) {
    const i = bucketOf(istDayOf(p.policyIssuedAt!));
    if (i >= 0) series[i].policies++;
  }

  /* Breakdown by source / city */
  const tally = (rows: string[]) => {
    const m = new Map<string, number>();
    for (const k of rows) m.set(k, (m.get(k) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const sources = tally(cur.map((e) => e.source)).map(([key, value]) => ({ key, label: sourceLabel(key), value }));
  const cityRows = tally(cur.map((e) => e.city?.trim() || "Not given"));
  const cities = cityRows.slice(0, 9).map(([key, value]) => ({ key, label: key, value }));
  const restCities = cityRows.slice(9).reduce((s, [, v]) => s + v, 0);
  if (restCities) cities.push({ key: "_other", label: `${cityRows.length - 9} other cities`, value: restCities });

  /* Events (views) */
  const ev = (kind: InsTrackKind, inRange: (d: string) => boolean, refId?: number) => events.filter((e) => e.kind === kind && inRange(e.day) && (refId === undefined || e.refId === refId)).reduce((s, e) => s + Number(e.n), 0);
  const views = (Object.keys(VIEW_LABEL) as InsTrackKind[]).map((k) => ({ key: k, label: VIEW_LABEL[k], value: ev(k, inCur) })).filter((v) => v.value > 0 || ["provider_view", "product_view"].includes(v.key));

  /* Products */
  const productRows = products
    .map((p) => ({
      id: p.id,
      name: p.name,
      status: INS_PRODUCT_STATUS_LABEL[p.status],
      views: ev("product_view", inCur, p.id),
      listings: ev("quote_listing", inCur, p.id),
      enquiries: cur.filter((e) => e.productId === p.id).length,
      quotes: qCur.filter((q) => q.productId === p.id).length,
      policies: policiesCur.filter((e) => e.productId === p.id).length,
    }))
    .filter((p) => p.views + p.listings + p.enquiries + p.quotes + p.policies > 0)
    .sort((a, b) => b.enquiries - a.enquiries || b.views - a.views);

  /* Promotional campaigns */
  const now = new Date();
  const campaignRows = campaigns
    .map((c) => ({
      id: c.id,
      reference: c.reference,
      title: c.title,
      status: INS_CAMPAIGN_STATUS_LABEL[campaignDisplayStatus(c, now)],
      views: ev("campaign_view", inCur, c.id),
      clicks: ev("campaign_click", inCur, c.id),
      enquiries: cur.filter((e) => e.campaignId === c.id).length,
      policies: policiesCur.filter((e) => e.campaignId === c.id).length,
    }))
    .filter((c) => c.views + c.clicks + c.enquiries > 0 || c.status === "Active")
    .sort((a, b) => b.enquiries - a.enquiries || b.views - a.views);

  /* Ads */
  const adCur = adDaily.filter((d) => inCur(d.day));
  const adPrev = adDaily.filter((d) => inPrev(d.day));
  const sum = (rows: typeof adDaily, k: "impressions" | "clicks" | "enquiries") => rows.reduce((s, d) => s + d[k], 0);
  const adRows = ads
    .map((a) => {
      const rows = adCur.filter((d) => d.campaignId === a.id);
      const impressions = sum(rows, "impressions");
      const clicks = sum(rows, "clicks");
      // Enquiries attributed through ?ad= links, counted from the enquiries themselves (ad_stats.enquiries as a fallback).
      const attributed = cur.filter((e) => e.adCampaignId === a.id).length;
      return {
        id: a.id,
        reference: a.reference,
        name: a.name,
        placement: a.placement,
        status: AD_STATUS_LABEL[adDisplayStatus(a, today)],
        impressions,
        clicks,
        ctr: impressions ? (clicks / impressions) * 100 : 0,
        enquiries: Math.max(attributed, sum(rows, "enquiries")),
        spend: a.status === "approved" ? a.total : 0,
      };
    })
    .filter((a) => a.impressions + a.clicks + a.enquiries > 0 || a.status === "Live" || a.status === "Scheduled")
    .sort((a, b) => b.impressions - a.impressions);
  const impCur = sum(adCur, "impressions");
  const clkCur = sum(adCur, "clicks");
  const impPrev = sum(adPrev, "impressions");
  const clkPrev = sum(adPrev, "clicks");

  /* Ad spend per month (advertising invoices, by billing period start) */
  const spend = new Map<string, { invoiced: number; paid: number }>();
  for (const inv of invoices) {
    const m = inv.periodStart.slice(0, 7);
    const e = spend.get(m) ?? { invoiced: 0, paid: 0 };
    e.invoiced += inv.total;
    if (inv.status === "paid") e.paid += inv.total;
    spend.set(m, e);
  }
  const adSpend: InsAnalyticsReport["adSpend"] = [];
  for (let ym = range.from.slice(0, 7); ym <= range.to.slice(0, 7); ) {
    const e = spend.get(ym) ?? { invoiced: 0, paid: 0 };
    adSpend.push({ month: ym, label: monthLabel(ym), ...e });
    const [y, m] = ym.split("-").map(Number);
    ym = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  }

  /* Renewals: those due (expiring) in the period, and the open pipeline */
  const dueCur = renewals.filter((x) => inCur(x.expiryDate) && x.expiryDate <= today);
  const duePrev = renewals.filter((x) => inPrev(x.expiryDate));
  const renewedOf = (rows: typeof renewals) => rows.filter((x) => x.status === "renewed").length;
  const statuses: InsRenewalStatus[] = ["upcoming", "contacted", "quote_sent", "follow_up", "renewed", "lapsed", "lost", "closed"];
  const inPeriod = renewals.filter((x) => inCur(x.expiryDate) || (INS_RENEWAL_OPEN.includes(x.status) && x.expiryDate > range.to && daysBetween(today, x.expiryDate) <= opts.renewalWindowDays));
  const pipeline = statuses.map((s) => ({ key: s, label: INS_RENEWAL_STATUS_LABEL[s], value: inPeriod.filter((x) => x.status === s).length }));
  const upcoming = renewals.filter((x) => INS_RENEWAL_OPEN.includes(x.status) && x.expiryDate >= today && daysBetween(today, x.expiryDate) <= opts.renewalWindowDays).length;

  const quoteOutcomes = [
    { key: "accepted", label: "Customer interested", value: accepted(qCur) },
    { key: "declined", label: "Declined", value: qCur.filter((q) => q.status === "declined").length },
    { key: "open", label: "Awaiting a response", value: qCur.filter((q) => q.status === "submitted" && q.validUntil >= today).length },
    { key: "expired", label: "Expired unanswered", value: qCur.filter((q) => q.status === "submitted" && q.validUntil < today).length },
    { key: "withdrawn", label: "Withdrawn", value: qCur.filter((q) => q.status === "withdrawn").length },
  ];
  const viewed = qCur.filter((q) => q.viewedAt).length;
  // Viewing overlaps the outcomes below it, so it leads the list.
  quoteOutcomes.unshift({ key: "viewed", label: "Opened by the customer", value: viewed });

  const rate = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);
  return {
    vendor: { name: vendorName(vendor), reference: vendor.reference },
    range,
    generatedAt: new Date().toISOString(),
    bucket,
    kpis: {
      enquiries: metric(cur.length, prev.length),
      quotesSent: metric(qCur.length, qPrev.length),
      accepted: metric(accepted(qCur), accepted(qPrev)),
      policiesReported: metric(policiesCur.length, policiesPrev.length),
      policiesVerified: metric(policiesCur.filter((p) => p.conversionVerifiedAt).length, policiesPrev.filter((p) => p.conversionVerifiedAt).length),
      productViews: metric(ev("product_view", inCur), ev("product_view", inPrev)),
      providerViews: metric(ev("provider_view", inCur), ev("provider_view", inPrev)),
      adImpressions: metric(impCur, impPrev),
      adClicks: metric(clkCur, clkPrev),
    },
    rates: {
      quoteAcceptance: metric(rate(accepted(qCur), qCur.length), rate(accepted(qPrev), qPrev.length)),
      conversion: metric(rate(funnel[3].value, cur.length), rate(prevReached, prev.length)),
      renewal: metric(rate(renewedOf(dueCur), dueCur.length), rate(renewedOf(duePrev), duePrev.length)),
      adCtr: metric(impCur ? Math.round((clkCur / impCur) * 10000) / 100 : 0, impPrev ? Math.round((clkPrev / impPrev) * 10000) / 100 : 0),
    },
    series,
    sources,
    cities,
    funnel,
    quoteOutcomes,
    renewals: { pipeline, due: dueCur.length, renewed: renewedOf(dueCur), lost: dueCur.filter((x) => x.status === "lapsed" || x.status === "lost").length, open: dueCur.filter((x) => INS_RENEWAL_OPEN.includes(x.status)).length, upcoming, windowDays: opts.renewalWindowDays },
    views,
    products: productRows,
    campaigns: campaignRows,
    ads: adRows,
    adSpend,
  };
}
