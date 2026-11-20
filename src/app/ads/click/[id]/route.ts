import type { NextRequest } from "next/server";
import { clickDestination, liveCampaign } from "@/server/ads/live";
import { bumpAdStat } from "@/server/ads/stats";
import { countableHit } from "@/server/ads/tracking";

/**
 * GET /ads/click/<campaignId> — every ad links here. Counts the click (live campaigns only, rate-
 * limited like impressions), then 302s to the campaign's target:
 *   - a /path on this site, with ad=<id> added (so enquiries can be attributed),
 *   - a product → /insurance/products/<reference>?ad=<id>,
 *   - an approved https:// URL as-is.
 * Anything unknown, unapproved or unsafe goes to "/". Never an open redirect.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/ads/click/[id]">) {
  const { id: raw } = await ctx.params;
  let to = "/";
  if (/^\d{1,10}$/.test(raw) && Number(raw) > 0 && Number(raw) <= 2_147_483_647) {
    const id = Number(raw);
    try {
      to = await clickDestination(id);
      if ((await countableHit(req, "c", id)) && (await liveCampaign(id))) await bumpAdStat(id, "clicks");
    } catch (err) {
      console.error(`[ads] click ${id} failed`, err);
    }
  }
  // A relative Location keeps the visitor on this host whatever proxy sits in front.
  return new Response(null, {
    status: 302,
    headers: { Location: to, "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "strict-origin-when-cross-origin" },
  });
}
