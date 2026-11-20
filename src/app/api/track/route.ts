import type { NextRequest } from "next/server";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { PARTNER_EVENT_KINDS } from "@/db/enums";
import { partnerEvents, partnerOffers, partnerVehicles, partners } from "@/db/schema";
import { HOUR, allowFromIp } from "@/server/rate-limit";

/**
 * Public interaction beacons for dealer analytics:
 * POST { p: partnerId, k: kind, r?: vehicle/offer id }. Fire-and-forget from the browser
 * (navigator.sendBeacon) — public pages are cached, so views can't be counted on the server.
 */
const body = z.object({ p: z.number().int().positive(), k: z.enum(PARTNER_EVENT_KINDS), r: z.number().int().positive().optional() });

export async function POST(req: NextRequest) {
  const ok = new Response(null, { status: 204 });
  let data: unknown;
  try {
    data = JSON.parse(await req.text());
  } catch {
    return ok;
  }
  const parsed = body.safeParse(data);
  if (!parsed.success) return ok;
  const { p, k, r } = parsed.data;
  if (!(await allowFromIp(`track:${p}:${k}:${r ?? 0}`, 30, HOUR))) return ok;

  const db = getDb();
  const [partner] = await db.select({ id: partners.id }).from(partners).where(and(eq(partners.id, p), eq(partners.status, "approved")));
  if (!partner) return ok;
  await db.insert(partnerEvents).values({ partnerId: p, kind: k, refId: r ?? null });
  if (k === "vehicle_view" && r) await db.update(partnerVehicles).set({ views: sql`${partnerVehicles.views} + 1` }).where(and(eq(partnerVehicles.id, r), eq(partnerVehicles.partnerId, p)));
  if (k === "offer_view" && r) await db.update(partnerOffers).set({ views: sql`${partnerOffers.views} + 1` }).where(and(eq(partnerOffers.id, r), eq(partnerOffers.partnerId, p)));
  return ok;
}
