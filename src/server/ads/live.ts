import "server-only";
import { and, eq, gte, inArray, isNotNull, lte, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { adCampaigns, adCreatives, adPlacements, adStats, insCompanies, insProducts, insVendors, partners } from "@/db/schema";
import { publicProductWhere } from "@/server/insurance/public";
import { istDate } from "@/components/portal/billing/shared";
import { productHref, safeHttpsUrl, safeInternalPath, withAdParam } from "@/components/ads/shared";
import { ensureAdPlacements, type PlacementRow } from "./placements";

/* ──────────────────────────────────────────────────────────────
   What is live right now. A campaign serves when:
   - its placement is active,
   - status is "approved" and today (IST) is within startsOn…endsOn,
   - the advertiser is in good standing (approved vendor / dealer;
     house campaigns always),
   - banners: ≥1 approved creative with both images;
     sponsored listings: the product is public and belongs to the
     advertiser (house campaigns may promote any public product).
   ────────────────────────────────────────────────────────────── */

export type CampaignRow = typeof adCampaigns.$inferSelect;

const advertiserOk = or(
  eq(adCampaigns.house, true),
  and(isNotNull(adCampaigns.insVendorId), eq(insVendors.status, "approved")),
  and(isNotNull(adCampaigns.partnerId), eq(partners.status, "approved")),
);

const liveWhere = (today: string) =>
  and(eq(adPlacements.isActive, true), eq(adCampaigns.status, "approved"), lte(adCampaigns.startsOn, today), gte(adCampaigns.endsOn, today), advertiserOk);

const hasBothImages = and(isNotNull(adCreatives.desktopImage), ne(adCreatives.desktopImage, ""), isNotNull(adCreatives.mobileImage), ne(adCreatives.mobileImage, ""));

export const advertiserLabel = (r: { house: boolean; brandName: string | null; legalName: string | null; tradeName: string | null; partnerLegal: string | null }) =>
  r.house ? "MarchGear" : r.brandName || r.legalName || r.tradeName || r.partnerLegal || "Advertiser";

const advertiserCols = { brandName: insVendors.brandName, legalName: insVendors.legalName, tradeName: partners.tradeName, partnerLegal: partners.legalName };

/** Approved creatives usable on a banner, per campaign. */
async function bannerCreatives(ids: number[]) {
  if (!ids.length) return new Map<number, (typeof adCreatives.$inferSelect)[]>();
  const rows = await getDb()
    .select()
    .from(adCreatives)
    .where(and(inArray(adCreatives.campaignId, ids), eq(adCreatives.status, "approved"), hasBothImages));
  const map = new Map<number, (typeof adCreatives.$inferSelect)[]>();
  for (const r of rows) map.set(r.campaignId, [...(map.get(r.campaignId) ?? []), r]);
  return map;
}

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

/** Among candidates, the ones with the fewest impressions today, then one at random. */
function leastShown<T extends { shown: number }>(list: T[]): T | undefined {
  if (!list.length) return undefined;
  const min = Math.min(...list.map((c) => c.shown));
  return pick(list.filter((c) => c.shown === min));
}

export interface BannerChoice {
  campaignId: number;
  creative: typeof adCreatives.$inferSelect;
  advertiser: string;
  placement: PlacementRow;
}

/** One live banner for a placement, rotating towards the campaign shown least today. */
export async function chooseBanner(placementKey: string): Promise<BannerChoice | null> {
  await ensureAdPlacements();
  const today = istDate();
  const rows = await getDb()
    .select({ id: adCampaigns.id, house: adCampaigns.house, placement: adPlacements, shown: sql<number>`coalesce(${adStats.impressions}, 0)`.mapWith(Number), ...advertiserCols })
    .from(adCampaigns)
    .innerJoin(adPlacements, eq(adPlacements.id, adCampaigns.placementId))
    .leftJoin(insVendors, eq(insVendors.id, adCampaigns.insVendorId))
    .leftJoin(partners, eq(partners.id, adCampaigns.partnerId))
    .leftJoin(adStats, and(eq(adStats.campaignId, adCampaigns.id), eq(adStats.day, today)))
    .where(and(eq(adPlacements.key, placementKey), eq(adPlacements.format, "banner"), liveWhere(today)));
  if (!rows.length) return null;
  const creatives = await bannerCreatives(rows.map((r) => r.id));
  const chosen = leastShown(rows.filter((r) => creatives.has(r.id)));
  if (!chosen) return null;
  return { campaignId: chosen.id, creative: pick(creatives.get(chosen.id)!), advertiser: advertiserLabel(chosen), placement: chosen.placement };
}

/** Live sponsored listings for a placement: one per product, least shown today first. */
export async function chooseSponsored(placementKey: string, limit: number) {
  await ensureAdPlacements();
  const today = istDate();
  const rows = await getDb()
    .select({ campaignId: adCampaigns.id, productId: insProducts.id, shown: sql<number>`coalesce(${adStats.impressions}, 0)`.mapWith(Number) })
    .from(adCampaigns)
    .innerJoin(adPlacements, eq(adPlacements.id, adCampaigns.placementId))
    .innerJoin(insProducts, eq(insProducts.id, adCampaigns.productId))
    .innerJoin(insVendors, eq(insVendors.id, insProducts.vendorId))
    .innerJoin(insCompanies, eq(insCompanies.id, insProducts.companyId))
    .leftJoin(adStats, and(eq(adStats.campaignId, adCampaigns.id), eq(adStats.day, today)))
    .where(
      and(
        eq(adPlacements.key, placementKey),
        eq(adPlacements.format, "sponsored_listing"),
        eq(adPlacements.isActive, true),
        eq(adCampaigns.status, "approved"),
        lte(adCampaigns.startsOn, today),
        gte(adCampaigns.endsOn, today),
        publicProductWhere,
        // The advertiser promotes its own product (its approval is part of publicProductWhere).
        or(eq(adCampaigns.house, true), eq(adCampaigns.insVendorId, insProducts.vendorId)),
      ),
    );
  // Random order inside each impressions tier, then one campaign per product.
  const shuffled = rows.map((r) => ({ ...r, r: Math.random() })).sort((a, b) => a.shown - b.shown || a.r - b.r);
  const seen = new Set<number>();
  const out: { campaignId: number; productId: number }[] = [];
  for (const r of shuffled) {
    if (seen.has(r.productId)) continue;
    seen.add(r.productId);
    out.push({ campaignId: r.campaignId, productId: r.productId });
    if (out.length >= limit) break;
  }
  return out;
}

/** Is a public product (for sponsored listings and product targets)? Returns its reference. */
export async function publicProductRef(productId: number): Promise<{ reference: string; vendorId: number } | null> {
  const [row] = await getDb()
    .select({ reference: insProducts.reference, vendorId: insProducts.vendorId })
    .from(insProducts)
    .innerJoin(insVendors, eq(insVendors.id, insProducts.vendorId))
    .innerJoin(insCompanies, eq(insCompanies.id, insProducts.companyId))
    .where(and(eq(insProducts.id, productId), publicProductWhere));
  return row ?? null;
}

/** The campaign when it is serving right now (any format), else null — the track and click routes only count these. */
export async function liveCampaign(id: number): Promise<CampaignRow | null> {
  await ensureAdPlacements();
  const today = istDate();
  const [row] = await getDb()
    .select({ c: adCampaigns, format: adPlacements.format })
    .from(adCampaigns)
    .innerJoin(adPlacements, eq(adPlacements.id, adCampaigns.placementId))
    .leftJoin(insVendors, eq(insVendors.id, adCampaigns.insVendorId))
    .leftJoin(partners, eq(partners.id, adCampaigns.partnerId))
    .where(and(eq(adCampaigns.id, id), liveWhere(today)));
  if (!row) return null;
  if (row.format === "banner") return (await bannerCreatives([id])).has(id) ? row.c : null;
  if (!row.c.productId) return null;
  const p = await publicProductRef(row.c.productId);
  return p && (row.c.house || p.vendorId === row.c.insVendorId) ? row.c : null;
}

/**
 * Where a click on a campaign goes. Only targets staff approved are followed (status approved or
 * paused, i.e. reviewed — including campaigns that have since ended); anything else, or anything
 * that isn't a safe same-site path, a public product or an https URL, goes to the homepage.
 */
export async function clickDestination(id: number): Promise<string> {
  const [c] = await getDb().select().from(adCampaigns).where(eq(adCampaigns.id, id));
  if (!c || (c.status !== "approved" && c.status !== "paused")) return "/";
  if (c.productId) {
    const p = await publicProductRef(c.productId);
    return p ? withAdParam(productHref(p.reference), c.id) : "/";
  }
  const internal = safeInternalPath(c.targetUrl);
  if (internal) return withAdParam(internal, c.id);
  return safeHttpsUrl(c.targetUrl) ?? "/";
}

