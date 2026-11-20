import "server-only";
import type { NextRequest } from "next/server";
import { HOUR, clientIp, take } from "@/server/rate-limit";

/* ──────────────────────────────────────────────────────────────
   Who may be counted. Impressions and clicks are limited per
   visitor and campaign, with a per-campaign ceiling on top so a
   spoofed address can't inflate a campaign without bound.
   ────────────────────────────────────────────────────────────── */

const LIMITS = {
  /** Impressions per visitor per campaign per hour (one per page view). */
  i: { visitor: 30, campaign: 20_000 },
  /** Clicks per visitor per campaign per hour. */
  c: { visitor: 10, campaign: 5_000 },
} as const;

const BOT = /bot\b|crawler|spider|slurp|facebookexternalhit|embedly|preview|lighthouse|pingdom|uptime/i;

/** Requests from another site (a page trying to inflate someone's numbers) don't count. */
function sameSite(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

/** The visitor key: the trusted client IP where a proxy sets it, otherwise the (untrusted) forwarded address. */
async function visitor(req: NextRequest) {
  const trusted = await clientIp();
  if (trusted) return trusted;
  const fwd = (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "").trim().slice(0, 64);
  return `u:${fwd || "direct"}`;
}

/** Whether this hit should be counted (and records it against the limits). */
export async function countableHit(req: NextRequest, kind: "i" | "c", campaignId: number) {
  if (!sameSite(req)) return false;
  if (BOT.test(req.headers.get("user-agent") ?? "")) return false;
  const who = await visitor(req);
  const l = LIMITS[kind];
  return take(`ad:${kind}:${campaignId}:${who}`, l.visitor, HOUR) && take(`ad:${kind}:${campaignId}`, l.campaign, HOUR);
}
