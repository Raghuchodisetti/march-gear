import "server-only";
import { and, asc, count, desc, eq, gt, gte, inArray, isNotNull, like, lt, lte, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { adCampaigns, adCreatives, adPlacements, auditLog, insCompanies, insInvoices, insPayments, insProducts, insRefunds, insVendors, partners, users } from "@/db/schema";
import { publicProductWhere } from "@/server/insurance/public";
import { addDays, istDate } from "@/components/portal/billing/shared";
import { OCCUPYING, type AdvertiserType } from "@/components/ads/shared";
import { campaignSelect, enrich, toCreativeView, type CampaignItem, type CreativeView } from "./campaigns";
import { ensureAdPlacements } from "./placements";

/* Admin views of the site-wide ad system (every advertiser). */

export const ADMIN_TABS = ["pending", "live", "scheduled", "ended", "all"] as const;
export type AdminTab = (typeof ADMIN_TABS)[number];
export const PAGE_SIZE = 20;

function tabWhere(tab: AdminTab, today: string): SQL | undefined {
  switch (tab) {
    case "pending":
      return eq(adCampaigns.status, "pending_approval");
    case "live":
      return and(eq(adCampaigns.status, "approved"), lte(adCampaigns.startsOn, today), gte(adCampaigns.endsOn, today));
    case "scheduled":
      return and(eq(adCampaigns.status, "approved"), gt(adCampaigns.startsOn, today));
    case "ended":
      return and(eq(adCampaigns.status, "approved"), lt(adCampaigns.endsOn, today));
    default:
      return undefined;
  }
}

function typeWhere(t: AdvertiserType | undefined): SQL | undefined {
  if (t === "house") return eq(adCampaigns.house, true);
  if (t === "insurer") return isNotNull(adCampaigns.insVendorId);
  if (t === "dealer") return isNotNull(adCampaigns.partnerId);
  return undefined;
}

export interface AdminListFilters {
  tab: AdminTab;
  placement?: number;
  type?: AdvertiserType;
  q?: string;
  page: number;
}

export async function listAdminCampaigns(f: AdminListFilters) {
  await ensureAdPlacements();
  const today = istDate();
  const db = getDb();
  const search = f.q
    ? or(
        like(adCampaigns.reference, `%${f.q}%`),
        like(adCampaigns.name, `%${f.q}%`),
        like(insVendors.brandName, `%${f.q}%`),
        like(insVendors.legalName, `%${f.q}%`),
        like(partners.tradeName, `%${f.q}%`),
        like(insVendors.reference, `%${f.q}%`),
      )
    : undefined;
  const common = and(f.placement ? eq(adCampaigns.placementId, f.placement) : undefined, typeWhere(f.type), search);
  const where = and(common, tabWhere(f.tab, today));
  const countQuery = (w: SQL | undefined) =>
    db
      .select({ n: count() })
      .from(adCampaigns)
      .leftJoin(insVendors, eq(insVendors.id, adCampaigns.insVendorId))
      .leftJoin(partners, eq(partners.id, adCampaigns.partnerId))
      .where(w)
      .then((r) => r[0]?.n ?? 0);
  const order = f.tab === "pending" ? [asc(adCampaigns.submittedAt), asc(adCampaigns.id)] : f.tab === "scheduled" ? [asc(adCampaigns.startsOn), asc(adCampaigns.id)] : [desc(adCampaigns.createdAt), desc(adCampaigns.id)];
  const [rows, total, ...tabCounts] = await Promise.all([
    campaignSelect()
      .where(where)
      .orderBy(...order)
      .limit(PAGE_SIZE)
      .offset((f.page - 1) * PAGE_SIZE),
    countQuery(where),
    ...ADMIN_TABS.map((t) => countQuery(and(common, tabWhere(t, today)))),
  ]);
  const counts = Object.fromEntries(ADMIN_TABS.map((t, i) => [t, tabCounts[i]])) as Record<AdminTab, number>;
  return { items: await enrich(rows, today), total, counts, today };
}

/**
 * Revenue across advertising invoices + the value of confirmed advertiser bookings. Same rules as the
 * revenue page: collected = verified payments − refunds; outstanding = what's still owed on unpaid invoices.
 */
export async function adRevenue(opts: { vendorId?: number } = {}) {
  const db = getDb();
  const vendorInv = opts.vendorId ? eq(insInvoices.vendorId, opts.vendorId) : undefined;
  const [inv, paidRows, refunds, booked] = await Promise.all([
    db
      .select({ id: insInvoices.id, status: insInvoices.status, total: insInvoices.total })
      .from(insInvoices)
      .where(and(eq(insInvoices.kind, "advertising"), vendorInv)),
    db
      .select({ invoiceId: insPayments.invoiceId, paid: sql<number>`coalesce(sum(${insPayments.amount}), 0)`.mapWith(Number) })
      .from(insPayments)
      .innerJoin(insInvoices, eq(insInvoices.id, insPayments.invoiceId))
      .where(and(eq(insInvoices.kind, "advertising"), eq(insPayments.status, "verified"), vendorInv))
      .groupBy(insPayments.invoiceId),
    db
      .select({ total: sql<number>`coalesce(sum(${insRefunds.amount}), 0)`.mapWith(Number) })
      .from(insRefunds)
      .innerJoin(insInvoices, eq(insInvoices.id, insRefunds.invoiceId))
      .where(and(eq(insInvoices.kind, "advertising"), vendorInv)),
    db
      .select({ status: adCampaigns.status, total: sql<number>`coalesce(sum(${adCampaigns.total}), 0)`.mapWith(Number), n: count() })
      .from(adCampaigns)
      .where(and(eq(adCampaigns.house, false), inArray(adCampaigns.status, ["approved", "paused", "pending_approval", "changes_requested"]), opts.vendorId ? eq(adCampaigns.insVendorId, opts.vendorId) : undefined))
      .groupBy(adCampaigns.status),
  ]);
  const paidOn = new Map(paidRows.map((r) => [r.invoiceId, r.paid]));
  const refunded = refunds[0]?.total ?? 0;
  const by = (s: string[]) => inv.filter((r) => s.includes(r.status)).reduce((a, r) => a + r.total, 0);
  const owed = (s: string[]) => inv.filter((r) => s.includes(r.status)).reduce((a, r) => a + Math.max(0, r.total - (paidOn.get(r.id) ?? 0)), 0);
  const bookedBy = (s: string[]) => booked.filter((r) => s.includes(r.status)).reduce((a, r) => a + r.total, 0);
  return {
    /** Confirmed bookings (approved or paused), incl. GST. */
    booked: bookedBy(["approved", "paused"]),
    /** Awaiting review, incl. GST. */
    pipeline: bookedBy(["pending_approval", "changes_requested"]),
    invoiced: by(["due", "verifying", "paid", "overdue"]),
    /** Verified payments less refunds (cash actually kept). */
    collected: paidRows.reduce((a, r) => a + r.paid, 0) - refunded,
    refunded,
    /** Still owed on unpaid invoices (part-payments already deducted). */
    outstanding: owed(["due", "verifying", "overdue"]),
    verifying: owed(["verifying"]),
  };
}

export interface CreativeQueueItem extends CreativeView {
  campaign: { id: number; reference: string; name: string; placement: string; advertiser: string; house: boolean };
}

/** Creatives waiting for review, oldest first. */
export async function creativeQueue(limit = 8): Promise<{ items: CreativeQueueItem[]; total: number }> {
  const db = getDb();
  const [rows, [{ n }]] = await Promise.all([
    db
      .select({ cr: adCreatives, c: adCampaigns, placement: adPlacements.name, brandName: insVendors.brandName, legalName: insVendors.legalName, tradeName: partners.tradeName })
      .from(adCreatives)
      .innerJoin(adCampaigns, eq(adCampaigns.id, adCreatives.campaignId))
      .innerJoin(adPlacements, eq(adPlacements.id, adCampaigns.placementId))
      .leftJoin(insVendors, eq(insVendors.id, adCampaigns.insVendorId))
      .leftJoin(partners, eq(partners.id, adCampaigns.partnerId))
      .where(and(eq(adCreatives.status, "pending"), inArray(adCampaigns.status, ["pending_approval", "changes_requested", "approved", "paused"])))
      .orderBy(asc(adCreatives.updatedAt))
      .limit(limit),
    db
      .select({ n: count() })
      .from(adCreatives)
      .innerJoin(adCampaigns, eq(adCampaigns.id, adCreatives.campaignId))
      .where(and(eq(adCreatives.status, "pending"), inArray(adCampaigns.status, ["pending_approval", "changes_requested", "approved", "paused"]))),
  ]);
  return {
    total: n,
    items: rows.map((r) => ({
      ...toCreativeView(r.cr),
      campaign: { id: r.c.id, reference: r.c.reference, name: r.c.name, placement: r.placement, advertiser: r.c.house ? "MarchGear" : r.brandName || r.legalName || r.tradeName || "Advertiser", house: r.c.house },
    })),
  };
}

export interface ScheduleBar {
  id: number;
  reference: string;
  name: string;
  advertiser: string;
  house: boolean;
  status: CampaignItem["status"];
  startsOn: string;
  endsOn: string;
}

/** Placements with the campaigns holding their slots between from…to (for the schedule). */
export async function scheduleData(from: string, days: number) {
  await ensureAdPlacements();
  const to = addDays(from, days - 1);
  const db = getDb();
  const [placements, rows] = await Promise.all([
    db.select().from(adPlacements).orderBy(asc(adPlacements.sortOrder), asc(adPlacements.id)),
    db
      .select({ c: adCampaigns, brandName: insVendors.brandName, legalName: insVendors.legalName, tradeName: partners.tradeName })
      .from(adCampaigns)
      .leftJoin(insVendors, eq(insVendors.id, adCampaigns.insVendorId))
      .leftJoin(partners, eq(partners.id, adCampaigns.partnerId))
      .where(and(inArray(adCampaigns.status, OCCUPYING), lte(adCampaigns.startsOn, to), gte(adCampaigns.endsOn, from)))
      .orderBy(asc(adCampaigns.startsOn), asc(adCampaigns.id)),
  ]);
  const bars = new Map<number, ScheduleBar[]>();
  for (const r of rows)
    bars.set(r.c.placementId, [
      ...(bars.get(r.c.placementId) ?? []),
      { id: r.c.id, reference: r.c.reference, name: r.c.name, advertiser: r.c.house ? "MarchGear" : r.brandName || r.legalName || r.tradeName || "Advertiser", house: r.c.house, status: r.c.status, startsOn: r.c.startsOn, endsOn: r.c.endsOn },
    ]);
  return { from, to, placements, bars };
}

/** Every public product (for house sponsored listings). */
export async function publicProductOptions() {
  return getDb()
    .select({ id: insProducts.id, name: insProducts.name, reference: insProducts.reference, company: insCompanies.name })
    .from(insProducts)
    .innerJoin(insVendors, eq(insVendors.id, insProducts.vendorId))
    .innerJoin(insCompanies, eq(insCompanies.id, insProducts.companyId))
    .where(publicProductWhere)
    .orderBy(asc(insCompanies.name), asc(insProducts.name))
    .limit(500);
}

/** Admin activity-log entries for a campaign and its creatives (the history of house campaigns). */
export async function auditTrail(campaignId: number, creativeIds: number[]) {
  const ids = creativeIds.map(String);
  return getDb()
    .select({ id: auditLog.id, action: auditLog.action, summary: auditLog.summary, createdAt: auditLog.createdAt, actor: users.name })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.userId))
    .where(or(and(eq(auditLog.entity, "ad_campaign"), eq(auditLog.entityId, String(campaignId))), ids.length ? and(eq(auditLog.entity, "ad_creative"), inArray(auditLog.entityId, ids)) : undefined))
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(60);
}
