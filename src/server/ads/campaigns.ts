import "server-only";
import { and, asc, desc, eq, inArray, ne, or, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { adCampaigns, adCreatives, adPlacements, insApprovals, insInvoices, insProducts, insVendors, partners, users } from "@/db/schema";
import type { AdCampaignStatus, AdCreativeStatus, AdFormat, InvoiceStatus } from "@/db/enums";
import { adDisplayStatus, type AdDisplayStatus } from "@/insurance/labels";
import { insInvoiceDisplayStatus } from "@/server/insurance/billing";
import { istDate } from "@/components/portal/billing/shared";
import type { AdvertiserType } from "@/components/ads/shared";
import { ZERO, totalsFor, type StatTotals } from "./stats";

/* Campaign lists and details, shaped for the vendor portal and the admin (serialisable). */

export type CreativeRow = typeof adCreatives.$inferSelect;

export interface CampaignItem {
  id: number;
  reference: string;
  name: string;
  status: AdCampaignStatus;
  display: AdDisplayStatus;
  startsOn: string;
  endsOn: string;
  days: number;
  pricePerDay: number;
  amount: number;
  gst: number;
  total: number;
  house: boolean;
  placement: { id: number; key: string; name: string; format: AdFormat; desktopSize: string | null; mobileSize: string | null; isActive: boolean };
  advertiser: { type: AdvertiserType; id: number | null; name: string; reference: string | null; status: string | null };
  productId: number | null;
  productName: string | null;
  productRef: string | null;
  targetUrl: string | null;
  adminRemarks: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  stats: StatTotals;
  creatives: { total: number; approved: number; pending: number; changes: number; rejected: number };
  invoice: { id: number; number: string; status: InvoiceStatus; display: InvoiceStatus; total: number; dueOn: string } | null;
}

export interface CreativeView {
  id: number;
  campaignId: number;
  name: string;
  desktopImage: string | null;
  mobileImage: string | null;
  headline: string | null;
  body: string | null;
  ctaLabel: string | null;
  alt: string;
  status: AdCreativeStatus;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
}

export const toCreativeView = (c: CreativeRow): CreativeView => ({
  id: c.id,
  campaignId: c.campaignId,
  name: c.name,
  desktopImage: c.desktopImage,
  mobileImage: c.mobileImage,
  headline: c.headline,
  body: c.body,
  ctaLabel: c.ctaLabel,
  alt: c.alt,
  status: c.status,
  remarks: c.remarks,
  createdAt: c.createdAt.toISOString(),
  updatedAt: c.updatedAt.toISOString(),
});

/** The base select every campaign list uses (placement, advertiser and product joined). */
export const campaignSelect = () =>
  getDb()
    .select({
      c: adCampaigns,
      p: { id: adPlacements.id, key: adPlacements.key, name: adPlacements.name, format: adPlacements.format, desktopSize: adPlacements.desktopSize, mobileSize: adPlacements.mobileSize, isActive: adPlacements.isActive },
      v: { id: insVendors.id, brandName: insVendors.brandName, legalName: insVendors.legalName, reference: insVendors.reference, status: insVendors.status },
      d: { id: partners.id, tradeName: partners.tradeName, legalName: partners.legalName, reference: partners.reference, status: partners.status },
      productName: insProducts.name,
      productRef: insProducts.reference,
    })
    .from(adCampaigns)
    .innerJoin(adPlacements, eq(adPlacements.id, adCampaigns.placementId))
    .leftJoin(insVendors, eq(insVendors.id, adCampaigns.insVendorId))
    .leftJoin(partners, eq(partners.id, adCampaigns.partnerId))
    .leftJoin(insProducts, eq(insProducts.id, adCampaigns.productId));

type BaseRow = Awaited<ReturnType<ReturnType<typeof campaignSelect>["where"]>>[number];

function advertiserOf(r: BaseRow): CampaignItem["advertiser"] {
  if (r.c.house) return { type: "house", id: null, name: "MarchGear", reference: null, status: null };
  if (r.v?.id) return { type: "insurer", id: r.v.id, name: r.v.brandName || r.v.legalName || r.v.reference, reference: r.v.reference, status: r.v.status };
  if (r.d?.id) return { type: "dealer", id: r.d.id, name: r.d.tradeName || r.d.legalName || r.d.reference, reference: r.d.reference, status: r.d.status };
  return { type: "house", id: null, name: "Advertiser", reference: null, status: null };
}

/** Adds stats, creative counts and the (latest, non-void) invoice to campaign rows. */
export async function enrich(rows: BaseRow[], today = istDate()): Promise<CampaignItem[]> {
  const ids = rows.map((r) => r.c.id);
  const db = getDb();
  const [stats, creativeRows, invoiceRows] = await Promise.all([
    totalsFor(ids),
    ids.length ? db.select({ campaignId: adCreatives.campaignId, status: adCreatives.status }).from(adCreatives).where(inArray(adCreatives.campaignId, ids)) : Promise.resolve([]),
    ids.length
      ? db
          .select({ id: insInvoices.id, campaignId: insInvoices.adCampaignId, number: insInvoices.number, status: insInvoices.status, total: insInvoices.total, dueOn: insInvoices.dueOn })
          .from(insInvoices)
          .where(and(inArray(insInvoices.adCampaignId, ids), eq(insInvoices.kind, "advertising"), ne(insInvoices.status, "void")))
          .orderBy(desc(insInvoices.id))
      : Promise.resolve([]),
  ]);
  const counts = new Map<number, CampaignItem["creatives"]>();
  for (const c of creativeRows) {
    const k = counts.get(c.campaignId) ?? { total: 0, approved: 0, pending: 0, changes: 0, rejected: 0 };
    k.total += 1;
    if (c.status === "approved") k.approved += 1;
    else if (c.status === "pending") k.pending += 1;
    else if (c.status === "changes_requested") k.changes += 1;
    else k.rejected += 1;
    counts.set(c.campaignId, k);
  }
  const invoices = new Map<number, CampaignItem["invoice"]>();
  for (const i of invoiceRows) {
    if (!i.campaignId || invoices.has(i.campaignId)) continue;
    invoices.set(i.campaignId, { id: i.id, number: i.number, status: i.status, display: insInvoiceDisplayStatus(i, today), total: i.total, dueOn: i.dueOn });
  }
  return rows.map((r) => ({
    id: r.c.id,
    reference: r.c.reference,
    name: r.c.name,
    status: r.c.status,
    display: adDisplayStatus(r.c, today),
    startsOn: r.c.startsOn,
    endsOn: r.c.endsOn,
    days: r.c.days,
    pricePerDay: r.c.pricePerDay,
    amount: r.c.amount,
    gst: r.c.gst,
    total: r.c.total,
    house: r.c.house,
    placement: r.p,
    advertiser: advertiserOf(r),
    productId: r.c.productId,
    productName: r.productName,
    productRef: r.productRef,
    targetUrl: r.c.targetUrl,
    adminRemarks: r.c.adminRemarks,
    submittedAt: r.c.submittedAt?.toISOString() ?? null,
    approvedAt: r.c.approvedAt?.toISOString() ?? null,
    createdAt: r.c.createdAt.toISOString(),
    stats: stats.get(r.c.id) ?? { ...ZERO },
    creatives: counts.get(r.c.id) ?? { total: 0, approved: 0, pending: 0, changes: 0, rejected: 0 },
    invoice: invoices.get(r.c.id) ?? null,
  }));
}

/** One campaign (optionally only when it belongs to `vendorId`) with its creatives. */
export async function getCampaign(id: number, opts: { vendorId?: number } = {}) {
  const where: SQL[] = [eq(adCampaigns.id, id)];
  if (opts.vendorId !== undefined) where.push(eq(adCampaigns.insVendorId, opts.vendorId));
  const [row] = await campaignSelect().where(and(...where));
  if (!row) return null;
  const [[item], creatives] = await Promise.all([enrich([row]), getDb().select().from(adCreatives).where(eq(adCreatives.campaignId, id)).orderBy(asc(adCreatives.id))]);
  return { item, row: row.c, creatives: creatives.map(toCreativeView) };
}

export interface AdHistoryEntry {
  id: number;
  target: "ad_campaign" | "ad_creative";
  targetId: number | null;
  targetLabel: string | null;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  remarks: string | null;
  actorSide: "vendor" | "admin" | "system";
  actorName: string | null;
  createdAt: string;
}

/** The approval history of a vendor campaign and its creatives. Vendors never see internal notes. */
export async function campaignHistory(vendorId: number, campaignId: number, creatives: { id: number; name: string }[], opts: { includeInternal?: boolean } = {}): Promise<AdHistoryEntry[]> {
  const creativeIds = creatives.map((c) => c.id);
  const target = or(
    and(eq(insApprovals.target, "ad_campaign"), eq(insApprovals.targetId, campaignId)),
    creativeIds.length ? and(eq(insApprovals.target, "ad_creative"), inArray(insApprovals.targetId, creativeIds)) : undefined,
  );
  const rows = await getDb()
    .select({ a: insApprovals, actorName: users.name })
    .from(insApprovals)
    .leftJoin(users, eq(users.id, insApprovals.actorUserId))
    .where(and(eq(insApprovals.vendorId, vendorId), target, opts.includeInternal ? undefined : ne(insApprovals.action, "internal_note")))
    .orderBy(desc(insApprovals.createdAt), desc(insApprovals.id))
    .limit(100);
  const names = new Map(creatives.map((c) => [c.id, c.name]));
  return rows.map(({ a, actorName }) => ({
    id: a.id,
    target: a.target === "ad_creative" ? "ad_creative" : "ad_campaign",
    targetId: a.targetId,
    targetLabel: a.target === "ad_creative" && a.targetId ? (names.get(a.targetId) ?? "Removed creative") : null,
    action: a.action,
    fromStatus: a.fromStatus,
    toStatus: a.toStatus,
    remarks: a.remarks,
    actorSide: a.actorSide,
    actorName,
    createdAt: a.createdAt.toISOString(),
  }));
}
