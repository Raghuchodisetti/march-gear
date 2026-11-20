import "server-only";
import { and, count, desc, eq, exists, gte, inArray, isNotNull, isNull, lt, lte, ne, notInArray, sql, sum, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import {
  adCampaigns,
  adStats,
  insActivity,
  insBranches,
  insCampaigns,
  insCovers,
  insEnquiries,
  insEvents,
  insInvoices,
  insMembers,
  insProducts,
  insQuotes,
  insRenewals,
  users,
} from "@/db/schema";
import type { InsLeadStatus, InsProductStatus } from "@/db/enums";
import { INS_LEAD_OPEN, INS_RENEWAL_OPEN, adDisplayStatus, campaignDisplayStatus } from "@/insurance/labels";
import type { InsurerContext } from "@/server/insurance/context";
import { productUsage } from "@/server/insurance/catalog-limits";
import { productEnquiriesSql, productViewsSql } from "@/components/insurance/vendor/products/queries";
import { todayISO } from "@/server/validation";

/* ──────────────────────────────────────────────────────────────
   Read model for the insurance vendor dashboard. Everything is
   scoped by the vendor, and enquiries / quotes / renewals by the
   member's own assignments when they can't see every enquiry
   ("enquiries.view_own"). Policy conversions are kept apart:
   reported by the vendor vs verified by MarchGear.
   ────────────────────────────────────────────────────────────── */

const DAY = 86_400_000;
const CAMPAIGN_ID = sql.raw("`ins_campaigns`.`id`");
const IST_MIN = 330;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type LeadScope = "all" | "own" | "none";
export function enquiryScope(ctx: InsurerContext): LeadScope {
  if (ctx.can("enquiries.view_all")) return "all";
  if (ctx.can("enquiries.view_own")) return "own";
  return "none";
}

/** The last 12 IST months, oldest first: { key: "2026-11", label: "Nov", year }. */
export function lastMonths(today = todayISO(), n = 12) {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7)) - 1;
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - (n - 1 - i), 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    return { key, label: MONTHS[d.getUTCMonth()], year: d.getUTCFullYear() };
  });
}

export interface FollowUp {
  kind: "enquiry" | "renewal";
  id: number;
  reference: string;
  name: string;
  detail: string;
  at: Date;
  overdue: boolean;
  href: string;
}

export interface PendingItem {
  key: string;
  tone: "red" | "amber" | "blue";
  title: string;
  detail: string;
  href: string;
  count: number;
}

export interface CampaignPerf {
  key: string;
  kind: "promo" | "ad";
  name: string;
  reference: string;
  status: string;
  statusKind: "campaign" | "ad";
  views: number;
  clicks: number;
  enquiries: number;
  href: string;
}

export async function getInsDashboard(ctx: InsurerContext) {
  const db = getDb();
  const vid = ctx.vendor.id;
  const scope = enquiryScope(ctx);
  const own = scope === "own";
  const show = {
    products: ctx.can("products.view"),
    enquiries: scope !== "none",
    quotes: scope !== "none" && (ctx.can("quotes.manage") || ctx.can("enquiries.manage") || scope === "all"),
    renewals: ctx.can("renewals.manage"),
    campaigns: ctx.can("campaigns.manage") || ctx.can("analytics.view"),
    ads: ctx.can("ads.manage") || ctx.can("analytics.view"),
    spend: ctx.can("billing.manage") || ctx.can("ads.manage"),
    analytics: ctx.can("analytics.view"),
  };
  const now = new Date();
  const today = todayISO();
  const months = lastMonths(today);
  const since12 = new Date(`${months[0].key}-01T00:00:00+05:30`);
  const since30 = new Date(Date.now() - 30 * DAY);
  const prev30 = new Date(Date.now() - 60 * DAY);
  const dayStart = new Date(`${today}T00:00:00+05:30`);
  const dayEnd = new Date(dayStart.getTime() + DAY);

  const enq = (...extra: (SQL | undefined)[]) => and(eq(insEnquiries.vendorId, vid), own ? eq(insEnquiries.assignedMemberId, ctx.member.id) : undefined, ...extra);
  // Quotes on enquiries this person may see.
  const quoteScope = own
    ? inArray(
        insQuotes.enquiryId,
        db
          .select({ id: insEnquiries.id })
          .from(insEnquiries)
          .where(and(eq(insEnquiries.vendorId, vid), eq(insEnquiries.assignedMemberId, ctx.member.id))),
      )
    : undefined;
  const zero = Promise.resolve([{ n: 0 }]);
  const month = (col: typeof insEnquiries.createdAt) => sql<string>`DATE_FORMAT(DATE_ADD(${col}, INTERVAL ${IST_MIN} MINUTE), '%Y-%m')`;

  const [
    productRows,
    [{ n: enquiries }],
    [{ n: newLeads }],
    [{ n: enquiries30 }],
    [{ n: enquiriesPrev }],
    [{ n: quotesSubmitted }],
    [{ n: renewalEnquiries }],
    [{ n: reported }],
    [{ n: verified }],
    monthlyRows,
    funnelRows,
  ] = await Promise.all([
    show.products ? db.select({ status: insProducts.status, n: count() }).from(insProducts).where(eq(insProducts.vendorId, vid)).groupBy(insProducts.status) : Promise.resolve([]),
    show.enquiries ? db.select({ n: count() }).from(insEnquiries).where(enq()) : zero,
    show.enquiries ? db.select({ n: count() }).from(insEnquiries).where(enq(eq(insEnquiries.status, "new"))) : zero,
    show.enquiries ? db.select({ n: count() }).from(insEnquiries).where(enq(gte(insEnquiries.createdAt, since30))) : zero,
    show.enquiries ? db.select({ n: count() }).from(insEnquiries).where(enq(gte(insEnquiries.createdAt, prev30), lt(insEnquiries.createdAt, since30))) : zero,
    show.enquiries ? db.select({ n: count() }).from(insQuotes).where(and(eq(insQuotes.vendorId, vid), isNotNull(insQuotes.submittedAt), quoteScope)) : zero,
    show.enquiries ? db.select({ n: count() }).from(insEnquiries).where(enq(eq(insEnquiries.intent, "renewal"))) : zero,
    show.enquiries ? db.select({ n: count() }).from(insEnquiries).where(enq(isNotNull(insEnquiries.policyIssuedAt))) : zero,
    show.enquiries ? db.select({ n: count() }).from(insEnquiries).where(enq(isNotNull(insEnquiries.conversionVerifiedAt))) : zero,
    show.enquiries
      ? db
          .select({ month: month(insEnquiries.createdAt), n: count() })
          .from(insEnquiries)
          .where(enq(gte(insEnquiries.createdAt, since12)))
          .groupBy(month(insEnquiries.createdAt))
      : Promise.resolve([] as { month: string; n: number }[]),
    show.enquiries
      ? db
          .select({
            total: count(),
            quoted: sql<number>`SUM(CASE WHEN ${exists(
              db
                .select({ x: sql`1` })
                .from(insQuotes)
                .where(and(eq(insQuotes.enquiryId, insEnquiries.id), isNotNull(insQuotes.submittedAt))),
            )} THEN 1 ELSE 0 END)`,
            interested: sql<number>`SUM(CASE WHEN ${insEnquiries.status} IN ('interested','policy_issued') OR ${exists(
              db
                .select({ x: sql`1` })
                .from(insQuotes)
                .where(and(eq(insQuotes.enquiryId, insEnquiries.id), eq(insQuotes.status, "accepted"))),
            )} THEN 1 ELSE 0 END)`,
            issued: sql<number>`SUM(CASE WHEN ${insEnquiries.policyIssuedAt} IS NOT NULL THEN 1 ELSE 0 END)`,
            verified: sql<number>`SUM(CASE WHEN ${insEnquiries.conversionVerifiedAt} IS NOT NULL THEN 1 ELSE 0 END)`,
          })
          .from(insEnquiries)
          .where(enq(gte(insEnquiries.createdAt, since12)))
      : Promise.resolve([{ total: 0, quoted: 0, interested: 0, issued: 0, verified: 0 }]),
  ]);

  const byStatus = new Map(productRows.map((r) => [r.status, Number(r.n)]));
  const st = (s: InsProductStatus[]) => s.reduce((a, x) => a + (byStatus.get(x) ?? 0), 0);
  const byMonth = new Map(monthlyRows.map((r) => [r.month, Number(r.n)]));
  const f = funnelRows[0] ?? { total: 0, quoted: 0, interested: 0, issued: 0, verified: 0 };

  const [productPerf, campaigns, adSpend, followUps, pending, activity, setup, usage, campaign30] = await Promise.all([
    show.products ? productPerformance(vid, own ? ctx.member.id : null) : Promise.resolve([]),
    show.campaigns || show.ads ? campaignPerformance(vid, show, today) : Promise.resolve([]),
    show.spend ? adSpending(vid, months[0].key) : Promise.resolve([]),
    followUpsDue(ctx, own, show, dayEnd, now),
    pendingItems(ctx, show, own),
    recentActivity(ctx),
    setupChecklist(ctx),
    productUsage(vid, ctx.vendor.plan),
    show.campaigns || show.ads ? campaignTotals(vid, own ? ctx.member.id : null, since30, today) : Promise.resolve(null),
  ]);

  const spendByMonth = new Map(adSpend.map((r) => [r.month, r]));
  return {
    scope,
    show,
    kpi: {
      products: st(["draft", "submitted", "pending_approval", "changes_requested", "approved", "published", "rejected", "suspended"]),
      published: st(["published"]),
      pendingProducts: st(["submitted", "pending_approval"]),
      attentionProducts: st(["changes_requested", "rejected"]),
      enquiries,
      newLeads,
      enquiries30,
      enquiriesPrev,
      quotesSubmitted,
      renewalEnquiries,
      reported,
      verified,
    },
    campaign30,
    monthly: months.map((m) => ({ key: m.key, label: m.label, year: m.year, value: byMonth.get(m.key) ?? 0 })),
    funnel: [
      { key: "enquiries", label: "Enquiries", value: Number(f.total) || 0 },
      { key: "quoted", label: "Quote submitted", value: Number(f.quoted) || 0 },
      { key: "interested", label: "Customer interested", value: Number(f.interested) || 0 },
      { key: "issued", label: "Policy issued (reported)", value: Number(f.issued) || 0 },
      { key: "verified", label: "Verified by MarchGear", value: Number(f.verified) || 0 },
    ],
    productPerf,
    campaigns,
    adSpend: months.map((m) => ({ key: m.key, label: m.label, year: m.year, invoiced: spendByMonth.get(m.key)?.invoiced ?? 0, paid: spendByMonth.get(m.key)?.paid ?? 0 })),
    followUps,
    pending,
    activity,
    setup,
    usage: { published: usage.published, limit: usage.limit, planName: usage.plan.name },
    dayStart,
  };
}

export type InsDashboard = Awaited<ReturnType<typeof getInsDashboard>>;

/** Top products by views (all time), with their enquiries. */
async function productPerformance(vendorId: number, memberId: number | null) {
  const db = getDb();
  const views = productViewsSql(vendorId);
  const enquiries = productEnquiriesSql(vendorId, memberId);
  const rows = await db
    .select({ id: insProducts.id, reference: insProducts.reference, name: insProducts.name, status: insProducts.status, views, enquiries })
    .from(insProducts)
    .where(and(eq(insProducts.vendorId, vendorId), inArray(insProducts.status, ["published", "approved", "pending_approval", "changes_requested"])))
    .orderBy(desc(views), desc(enquiries), desc(insProducts.updatedAt))
    .limit(6);
  return rows.map((r) => ({ ...r, views: Number(r.views) || 0, enquiries: Number(r.enquiries) || 0 }));
}

/** Promotional campaigns (views, clicks, enquiries) and ad campaigns (impressions, clicks, enquiries), all time. */
async function campaignPerformance(vendorId: number, show: { campaigns: boolean; ads: boolean }, today: string): Promise<CampaignPerf[]> {
  const db = getDb();
  const out: CampaignPerf[] = [];
  if (show.campaigns) {
    const rows = await db
      .select({
        id: insCampaigns.id,
        reference: insCampaigns.reference,
        title: insCampaigns.title,
        status: insCampaigns.status,
        startsAt: insCampaigns.startsAt,
        endsAt: insCampaigns.endsAt,
        // Explicit aliases: Drizzle leaves select-list columns unqualified in single-table queries.
        views: sql<number>`(select count(*) from \`ins_events\` ev where ev.\`vendor_id\` = ${vendorId} and ev.\`kind\` = 'campaign_view' and ev.\`ref_id\` = ${CAMPAIGN_ID})`,
        clicks: sql<number>`(select count(*) from \`ins_events\` ev where ev.\`vendor_id\` = ${vendorId} and ev.\`kind\` = 'campaign_click' and ev.\`ref_id\` = ${CAMPAIGN_ID})`,
        enquiries: sql<number>`(select count(*) from \`ins_enquiries\` en where en.\`vendor_id\` = ${vendorId} and en.\`campaign_id\` = ${CAMPAIGN_ID})`,
      })
      .from(insCampaigns)
      .where(and(eq(insCampaigns.vendorId, vendorId), notInArray(insCampaigns.status, ["draft", "cancelled"])))
      .orderBy(desc(insCampaigns.startsAt))
      .limit(20);
    for (const r of rows)
      out.push({
        key: `c${r.id}`,
        kind: "promo",
        name: r.title,
        reference: r.reference,
        status: campaignDisplayStatus(r),
        statusKind: "campaign",
        views: Number(r.views) || 0,
        clicks: Number(r.clicks) || 0,
        enquiries: Number(r.enquiries) || 0,
        href: "/insurance-vendor/campaigns",
      });
  }
  if (show.ads) {
    const rows = await db
      .select({
        id: adCampaigns.id,
        reference: adCampaigns.reference,
        name: adCampaigns.name,
        status: adCampaigns.status,
        startsOn: adCampaigns.startsOn,
        endsOn: adCampaigns.endsOn,
        impressions: sql<number>`COALESCE(SUM(${adStats.impressions}), 0)`,
        clicks: sql<number>`COALESCE(SUM(${adStats.clicks}), 0)`,
        enquiries: sql<number>`COALESCE(SUM(${adStats.enquiries}), 0)`,
      })
      .from(adCampaigns)
      .leftJoin(adStats, eq(adStats.campaignId, adCampaigns.id))
      .where(and(eq(adCampaigns.insVendorId, vendorId), notInArray(adCampaigns.status, ["draft", "cancelled"])))
      .groupBy(adCampaigns.id)
      .orderBy(desc(adCampaigns.startsOn))
      .limit(20);
    for (const r of rows)
      out.push({
        key: `a${r.id}`,
        kind: "ad",
        name: r.name,
        reference: r.reference,
        status: adDisplayStatus(r, today),
        statusKind: "ad",
        views: Number(r.impressions) || 0,
        clicks: Number(r.clicks) || 0,
        enquiries: Number(r.enquiries) || 0,
        href: "/insurance-vendor/advertising",
      });
  }
  return out.sort((a, b) => b.views - a.views || b.clicks - a.clicks).slice(0, 8);
}

/** Last 30 days: promotional campaign views/clicks/enquiries and ad impressions/clicks/enquiries. */
async function campaignTotals(vendorId: number, memberId: number | null, since: Date, today: string) {
  const db = getDb();
  const fromDay = new Date(new Date(`${today}T00:00:00Z`).getTime() - 29 * DAY).toISOString().slice(0, 10);
  const [[views], [clicks], [enq], [ads]] = await Promise.all([
    db.select({ n: count() }).from(insEvents).where(and(eq(insEvents.vendorId, vendorId), eq(insEvents.kind, "campaign_view"), gte(insEvents.createdAt, since))),
    db.select({ n: count() }).from(insEvents).where(and(eq(insEvents.vendorId, vendorId), eq(insEvents.kind, "campaign_click"), gte(insEvents.createdAt, since))),
    db
      .select({ n: count() })
      .from(insEnquiries)
      .where(and(eq(insEnquiries.vendorId, vendorId), isNotNull(insEnquiries.campaignId), gte(insEnquiries.createdAt, since), memberId ? eq(insEnquiries.assignedMemberId, memberId) : undefined)),
    db
      .select({ impressions: sum(adStats.impressions), clicks: sum(adStats.clicks), enquiries: sum(adStats.enquiries) })
      .from(adStats)
      .innerJoin(adCampaigns, eq(adCampaigns.id, adStats.campaignId))
      .where(and(eq(adCampaigns.insVendorId, vendorId), gte(adStats.day, fromDay))),
  ]);
  return {
    views: views.n,
    clicks: clicks.n,
    enquiries: enq.n,
    adImpressions: Number(ads?.impressions ?? 0),
    adClicks: Number(ads?.clicks ?? 0),
    adEnquiries: Number(ads?.enquiries ?? 0),
  };
}

/** Advertising invoices per IST month (by invoice date): invoiced (not void) vs paid. */
async function adSpending(vendorId: number, fromMonth: string) {
  const m = sql<string>`DATE_FORMAT(DATE_ADD(${insInvoices.createdAt}, INTERVAL ${IST_MIN} MINUTE), '%Y-%m')`;
  const rows = await getDb()
    .select({
      month: m,
      invoiced: sql<number>`COALESCE(SUM(${insInvoices.total}), 0)`,
      paid: sql<number>`COALESCE(SUM(CASE WHEN ${insInvoices.status} = 'paid' THEN ${insInvoices.total} ELSE 0 END), 0)`,
    })
    .from(insInvoices)
    .where(and(eq(insInvoices.vendorId, vendorId), eq(insInvoices.kind, "advertising"), ne(insInvoices.status, "void"), gte(insInvoices.createdAt, new Date(`${fromMonth}-01T00:00:00+05:30`))))
    .groupBy(m);
  return rows.map((r) => ({ month: r.month, invoiced: Number(r.invoiced) || 0, paid: Number(r.paid) || 0 }));
}

/** Enquiry and renewal follow-ups due today (IST) or overdue, for what this person can see. */
async function followUpsDue(ctx: InsurerContext, own: boolean, show: { enquiries: boolean; renewals: boolean }, dayEnd: Date, now: Date): Promise<FollowUp[]> {
  const db = getDb();
  const vid = ctx.vendor.id;
  const [enquiries, renewals] = await Promise.all([
    show.enquiries
      ? db
          .select({ id: insEnquiries.id, reference: insEnquiries.reference, name: insEnquiries.name, status: insEnquiries.status, at: insEnquiries.followUpAt, car: insEnquiries.modelName, brand: insEnquiries.brandName })
          .from(insEnquiries)
          .where(
            and(
              eq(insEnquiries.vendorId, vid),
              own ? eq(insEnquiries.assignedMemberId, ctx.member.id) : undefined,
              isNotNull(insEnquiries.followUpAt),
              lt(insEnquiries.followUpAt, dayEnd),
              inArray(insEnquiries.status, INS_LEAD_OPEN as InsLeadStatus[]),
            ),
          )
          .orderBy(insEnquiries.followUpAt)
          .limit(12)
      : Promise.resolve([]),
    show.renewals
      ? db
          .select({ id: insRenewals.id, reference: insRenewals.reference, name: insRenewals.name, at: insRenewals.followUpAt, expiry: insRenewals.expiryDate, car: insRenewals.modelName })
          .from(insRenewals)
          .where(
            and(
              eq(insRenewals.vendorId, vid),
              own ? eq(insRenewals.assignedMemberId, ctx.member.id) : undefined,
              isNotNull(insRenewals.followUpAt),
              lt(insRenewals.followUpAt, dayEnd),
              inArray(insRenewals.status, INS_RENEWAL_OPEN),
            ),
          )
          .orderBy(insRenewals.followUpAt)
          .limit(12)
      : Promise.resolve([]),
  ]);
  const list: FollowUp[] = [
    ...enquiries.map((e) => ({
      kind: "enquiry" as const,
      id: e.id,
      reference: e.reference,
      name: e.name,
      detail: [e.brand, e.car].filter(Boolean).join(" ") || "Quote request",
      at: e.at!,
      overdue: e.at! < now,
      href: `/insurance-vendor/enquiries/${e.id}`,
    })),
    ...renewals.map((r) => ({
      kind: "renewal" as const,
      id: r.id,
      reference: r.reference,
      name: r.name,
      detail: `Renewal${r.car ? ` · ${r.car}` : ""} · expires ${r.expiry}`,
      at: r.at!,
      overdue: r.at! < now,
      href: `/insurance-vendor/renewals?renewal=${r.id}`,
    })),
  ];
  return list.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, 10);
}

/** Things that need someone at the vendor — only shown to people who can act on them. */
async function pendingItems(ctx: InsurerContext, show: { enquiries: boolean }, own: boolean): Promise<PendingItem[]> {
  const db = getDb();
  const vid = ctx.vendor.id;
  const zero = Promise.resolve([{ n: 0 }]);
  const [[{ n: products }], [{ n: covers }], [{ n: campaigns }], [{ n: unassigned }], [{ n: invoices }], [{ n: newLeads }]] = await Promise.all([
    ctx.can("products.manage") ? db.select({ n: count() }).from(insProducts).where(and(eq(insProducts.vendorId, vid), inArray(insProducts.status, ["changes_requested", "rejected"]))) : zero,
    ctx.can("products.manage") ? db.select({ n: count() }).from(insCovers).where(and(eq(insCovers.vendorId, vid), inArray(insCovers.status, ["changes_requested", "rejected"]))) : zero,
    ctx.can("campaigns.manage") ? db.select({ n: count() }).from(insCampaigns).where(and(eq(insCampaigns.vendorId, vid), eq(insCampaigns.status, "changes_requested"))) : zero,
    ctx.can("enquiries.assign") && !own ? db.select({ n: count() }).from(insEnquiries).where(and(eq(insEnquiries.vendorId, vid), isNull(insEnquiries.assignedMemberId), inArray(insEnquiries.status, INS_LEAD_OPEN as InsLeadStatus[]))) : zero,
    ctx.can("billing.manage") ? db.select({ n: count() }).from(insInvoices).where(and(eq(insInvoices.vendorId, vid), inArray(insInvoices.status, ["due", "overdue"]))) : zero,
    show.enquiries
      ? db
          .select({ n: count() })
          .from(insEnquiries)
          .where(and(eq(insEnquiries.vendorId, vid), own ? eq(insEnquiries.assignedMemberId, ctx.member.id) : undefined, eq(insEnquiries.status, "new"), lte(insEnquiries.createdAt, new Date(Date.now() - 4 * 3_600_000))))
      : zero,
  ]);
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const out: PendingItem[] = [];
  if (newLeads) out.push({ key: "leads", tone: "red", count: newLeads, title: "Enquiries waiting over 4 hours", detail: `${plural(newLeads, "new enquiry", "new enquiries")} not yet contacted.`, href: "/insurance-vendor/enquiries" });
  if (products) out.push({ key: "products", tone: "amber", count: products, title: "Products sent back", detail: `MarchGear asked for changes on ${plural(products, "product")}.`, href: "/insurance-vendor/approvals" });
  if (covers) out.push({ key: "covers", tone: "amber", count: covers, title: "Covers sent back", detail: `Fix ${plural(covers, "coverage item or add-on", "coverage items or add-ons")} and resubmit.`, href: "/insurance-vendor/approvals?kind=cover" });
  if (campaigns) out.push({ key: "campaigns", tone: "amber", count: campaigns, title: "Campaign changes requested", detail: `Update ${plural(campaigns, "campaign")} and resubmit.`, href: "/insurance-vendor/campaigns" });
  if (unassigned) out.push({ key: "unassigned", tone: "blue", count: unassigned, title: "Unassigned enquiries", detail: `Assign ${plural(unassigned, "open enquiry", "open enquiries")} to your team.`, href: "/insurance-vendor/enquiries" });
  if (invoices) out.push({ key: "invoices", tone: "amber", count: invoices, title: "Invoices to pay", detail: `${plural(invoices, "invoice")} due or overdue.`, href: "/insurance-vendor/invoices" });
  return out;
}

async function recentActivity(ctx: InsurerContext) {
  const everyone = ctx.can("team.manage") || ctx.can("settings.manage");
  return getDb()
    .select({ id: insActivity.id, summary: insActivity.summary, entity: insActivity.entity, createdAt: insActivity.createdAt, who: users.name })
    .from(insActivity)
    .leftJoin(users, eq(users.id, insActivity.userId))
    .where(and(eq(insActivity.vendorId, ctx.vendor.id), everyone ? undefined : eq(insActivity.userId, ctx.user.id)))
    .orderBy(desc(insActivity.createdAt), desc(insActivity.id))
    .limit(7);
}

/** "Get started" for a new vendor — each step checked against real data, shown to people who can do it. */
async function setupChecklist(ctx: InsurerContext) {
  const db = getDb();
  const vid = ctx.vendor.id;
  const [[{ branches }], [{ covers }], [{ products }], [{ submitted }], [{ live }], [{ team }]] = await Promise.all([
    db.select({ branches: count() }).from(insBranches).where(eq(insBranches.vendorId, vid)),
    db.select({ covers: count() }).from(insCovers).where(eq(insCovers.vendorId, vid)),
    db.select({ products: count() }).from(insProducts).where(eq(insProducts.vendorId, vid)),
    db.select({ submitted: count() }).from(insProducts).where(and(eq(insProducts.vendorId, vid), isNotNull(insProducts.submittedAt))),
    db.select({ live: count() }).from(insProducts).where(and(eq(insProducts.vendorId, vid), eq(insProducts.status, "published"))),
    db.select({ team: count() }).from(insMembers).where(and(eq(insMembers.vendorId, vid), ne(insMembers.role, "owner"), eq(insMembers.isActive, true))),
  ]);
  const p = ctx.vendor.profile;
  return [
    { key: "profile", label: "Add your logo and an introduction", done: Boolean(p?.logo && p.about), href: "/insurance-vendor/profile", perm: ctx.can("profile.manage") },
    { key: "branch", label: "List your offices", done: branches > 0, href: "/insurance-vendor/profile?tab=branches", perm: ctx.can("profile.manage") },
    { key: "covers", label: "Add coverage items and add-ons", done: covers > 0, href: "/insurance-vendor/add-ons", perm: ctx.can("products.manage") },
    { key: "product", label: "Create your first product", done: products > 0, href: "/insurance-vendor/products/create", perm: ctx.can("products.manage") },
    { key: "submit", label: "Submit it for approval", done: submitted > 0, href: "/insurance-vendor/products", perm: ctx.can("products.manage") },
    { key: "publish", label: "Publish an approved product", done: live > 0, href: "/insurance-vendor/products?tab=approved", perm: ctx.can("products.manage") },
    { key: "team", label: "Invite your team", done: team > 0, href: "/insurance-vendor/settings?tab=team", perm: ctx.can("team.manage") },
  ].filter((s) => s.perm);
}
