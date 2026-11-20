import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { adCampaigns } from "@/db/schema";
import type { PlacementKey } from "@/ads/placements";
import { adClickHref } from "@/ads/links";
import { bumpAdStat } from "./stats";
import { chooseBanner, chooseSponsored } from "./live";

/* ──────────────────────────────────────────────────────────────
   Serving ads.

   A campaign serves when: its placement is active, status is
   "approved", today (IST) is within startsOn…endsOn, and — for
   banners — it has at least one approved creative. Sponsored
   listings also need their product to be published. (Details in
   ./live.ts.) None of these throw: a broken ad must never break
   the page it sits on.
   ────────────────────────────────────────────────────────────── */

export interface BannerAd {
  campaignId: number;
  creativeId: number;
  desktopImage: string;
  mobileImage: string;
  alt: string;
  headline: string | null;
  body: string | null;
  ctaLabel: string | null;
  /** Always /ads/click/<campaignId> — the click route counts the click and redirects. */
  href: string;
  advertiser: string;
}

/** One live banner for the slot (rotates between live campaigns), or null. */
export async function pickBanner(placement: PlacementKey): Promise<BannerAd | null> {
  try {
    const choice = await chooseBanner(placement);
    if (!choice) return null;
    const c = choice.creative;
    return {
      campaignId: choice.campaignId,
      creativeId: c.id,
      desktopImage: c.desktopImage ?? "",
      mobileImage: c.mobileImage ?? "",
      alt: c.alt,
      headline: c.headline || null,
      body: c.body || null,
      ctaLabel: c.ctaLabel || null,
      href: adClickHref(choice.campaignId),
      advertiser: choice.advertiser,
    };
  } catch (err) {
    console.error(`[ads] pickBanner(${placement}) failed`, err);
    return null;
  }
}

/** Live sponsored listings: which published products to show first, marked "Sponsored". */
export async function getSponsoredListings(placement: PlacementKey, limit = 2): Promise<{ campaignId: number; productId: number }[]> {
  try {
    return await chooseSponsored(placement, Math.max(1, Math.min(10, Math.floor(limit) || 1)));
  } catch (err) {
    console.error(`[ads] getSponsoredListings(${placement}) failed`, err);
    return [];
  }
}

/** Counts an enquiry against the ad campaign that brought the customer (from the `ad` query param). Never throws. */
export async function recordAdEnquiry(campaignId: number): Promise<void> {
  if (!Number.isSafeInteger(campaignId) || campaignId <= 0) return;
  try {
    const [c] = await getDb().select({ id: adCampaigns.id }).from(adCampaigns).where(eq(adCampaigns.id, campaignId));
    if (c) await bumpAdStat(campaignId, "enquiries");
  } catch (err) {
    console.error(`[ads] recordAdEnquiry(${campaignId}) failed`, err);
  }
}
