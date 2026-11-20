import "server-only";
import { and, count, desc, eq, inArray, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { insCampaigns, insEnquiries, insEvents, insProducts } from "@/db/schema";
import { INS_CAMPAIGN_TYPE_LABEL, campaignDisplayStatus } from "@/insurance/labels";
import type { CampaignListItem, CampaignProductOption } from "@/components/insurance/vendor/campaigns/shared";

/* Page data for /insurance-vendor/campaigns — always scoped to one vendor. */

export type CampaignRow = typeof insCampaigns.$inferSelect;

export async function getVendorCampaign(vendorId: number, id: number) {
  const [row] = await getDb()
    .select()
    .from(insCampaigns)
    .where(and(eq(insCampaigns.id, id), eq(insCampaigns.vendorId, vendorId)));
  return row ?? null;
}

/** The vendor's products a campaign can promote (published), plus any older picks that aren't published any more. */
export async function getCampaignProducts(vendorId: number, picked: number[] = []): Promise<CampaignProductOption[]> {
  const rows = await getDb()
    .select({ id: insProducts.id, name: insProducts.name, reference: insProducts.reference, category: insProducts.category, status: insProducts.status })
    .from(insProducts)
    .where(and(eq(insProducts.vendorId, vendorId), picked.length ? or(eq(insProducts.status, "published"), inArray(insProducts.id, picked)) : eq(insProducts.status, "published")))
    .orderBy(insProducts.name);
  return rows.map((r) => ({ id: r.id, name: r.name, reference: r.reference, category: r.category, published: r.status === "published" }));
}

/** Views and clicks from the public pages (ins_events) and enquiries/policies attributed to each campaign. */
export async function getCampaignMetrics(vendorId: number, ids: number[]) {
  const out = new Map<number, { views: number; clicks: number; enquiries: number; conversions: number }>();
  for (const id of ids) out.set(id, { views: 0, clicks: 0, enquiries: 0, conversions: 0 });
  if (!ids.length) return out;
  const db = getDb();
  const [events, enquiries] = await Promise.all([
    db
      .select({ refId: insEvents.refId, kind: insEvents.kind, n: count() })
      .from(insEvents)
      .where(and(eq(insEvents.vendorId, vendorId), inArray(insEvents.kind, ["campaign_view", "campaign_click"]), inArray(insEvents.refId, ids)))
      .groupBy(insEvents.refId, insEvents.kind),
    db
      .select({ campaignId: insEnquiries.campaignId, n: count(), won: sql<number>`SUM(${insEnquiries.status} = 'policy_issued')` })
      .from(insEnquiries)
      .where(and(eq(insEnquiries.vendorId, vendorId), inArray(insEnquiries.campaignId, ids)))
      .groupBy(insEnquiries.campaignId),
  ]);
  for (const e of events) {
    const m = e.refId ? out.get(e.refId) : undefined;
    if (!m) continue;
    if (e.kind === "campaign_view") m.views += e.n;
    else m.clicks += e.n;
  }
  for (const e of enquiries) {
    const m = e.campaignId ? out.get(e.campaignId) : undefined;
    if (!m) continue;
    m.enquiries = e.n;
    m.conversions = Number(e.won ?? 0);
  }
  return out;
}

export function toListItem(r: CampaignRow, names: Map<number, string>, metrics: { views: number; clicks: number; enquiries: number; conversions: number }, now = new Date()): CampaignListItem {
  return {
    id: r.id,
    reference: r.reference,
    title: r.title,
    summary: r.summary,
    type: r.type,
    typeLabel: INS_CAMPAIGN_TYPE_LABEL[r.type],
    banner: r.banner,
    ctaLabel: r.ctaLabel,
    startsAt: r.startsAt.toISOString(),
    endsAt: r.endsAt.toISOString(),
    status: r.status,
    display: campaignDisplayStatus(r, now),
    adminRemarks: r.adminRemarks,
    approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null,
    submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
    updatedAt: r.updatedAt.toISOString(),
    productNames: r.productIds.map((id) => names.get(id)).filter((n): n is string => Boolean(n)),
    ...metrics,
  };
}

/** Every campaign of the vendor, newest first, with performance. */
export async function listCampaigns(vendorId: number, now = new Date()): Promise<CampaignListItem[]> {
  const rows = await getDb().select().from(insCampaigns).where(eq(insCampaigns.vendorId, vendorId)).orderBy(desc(insCampaigns.updatedAt), desc(insCampaigns.id)).limit(300);
  const productIds = [...new Set(rows.flatMap((r) => r.productIds))];
  const [products, metrics] = await Promise.all([
    productIds.length
      ? getDb()
          .select({ id: insProducts.id, name: insProducts.name })
          .from(insProducts)
          .where(and(eq(insProducts.vendorId, vendorId), inArray(insProducts.id, productIds)))
      : Promise.resolve([]),
    getCampaignMetrics(
      vendorId,
      rows.map((r) => r.id),
    ),
  ]);
  const names = new Map(products.map((p) => [p.id, p.name]));
  return rows.map((r) => toListItem(r, names, metrics.get(r.id)!, now));
}
