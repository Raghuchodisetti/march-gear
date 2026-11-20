import type { NextRequest } from "next/server";
import { z } from "zod";
import { liveCampaign } from "@/server/ads/live";
import { bumpAdStat } from "@/server/ads/stats";
import { countableHit } from "@/server/ads/tracking";

/**
 * Ad impression beacon: POST { c: campaignId, k: "i" } from <AdImpression> (navigator.sendBeacon).
 * Counts one impression for the IST day when the campaign is live, rate-limited per visitor and
 * campaign. Always answers 204 — the browser never needs to know whether it counted.
 */
const body = z.object({ c: z.number().int().positive().max(2_147_483_647), k: z.literal("i") });

export async function POST(req: NextRequest) {
  const done = new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  try {
    if (Number(req.headers.get("content-length") ?? 0) > 1024) return done;
    let data: unknown;
    try {
      data = JSON.parse(await req.text());
    } catch {
      return done;
    }
    const parsed = body.safeParse(data);
    if (!parsed.success) return done;
    const { c } = parsed.data;
    if (!(await countableHit(req, "i", c))) return done;
    if (!(await liveCampaign(c))) return done;
    await bumpAdStat(c, "impressions");
  } catch (err) {
    console.error("[ads] impression not counted", err);
  }
  return done;
}
