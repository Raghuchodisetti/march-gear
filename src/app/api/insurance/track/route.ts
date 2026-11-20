import type { NextRequest } from "next/server";
import { z } from "zod";
import { INS_TRACK_KINDS } from "@/db/enums";
import { HOUR, allowFromIp, take } from "@/server/rate-limit";
import { isTrackable, recordInsEvent } from "@/server/insurance/market";

/**
 * Public interaction beacons for insurance vendor analytics:
 * POST { kind, vendorId, refId } → one ins_events row. Fire-and-forget from the browser
 * (`trackInsurance()` in src/components/insurance/public/market/track.tsx). Unknown kinds, ids that
 * don't belong to the vendor and anything that isn't public are ignored. Always 204.
 */
const body = z.object({
  kind: z.enum(INS_TRACK_KINDS),
  vendorId: z.number().int().positive().max(2 ** 31 - 1),
  refId: z.number().int().positive().max(2 ** 31 - 1),
});

const BOT = /bot|crawler|spider|slurp|facebookexternalhit|embedly|preview|lighthouse|pingdom|uptime/i;

/** Beacons from another site (a page trying to inflate someone's numbers) don't count. */
function sameSite(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const ok = new Response(null, { status: 204 });
  if (!sameSite(req) || BOT.test(req.headers.get("user-agent") ?? "")) return ok;
  let data: unknown;
  try {
    const text = await req.text();
    if (text.length > 500) return ok;
    data = JSON.parse(text);
  } catch {
    return ok;
  }
  const parsed = body.safeParse(data);
  if (!parsed.success) return ok;
  const { kind, vendorId, refId } = parsed.data;
  // Per IP: a ceiling overall, and one target can't be inflated by reloading.
  if (!(await allowFromIp("ins-track", 600, HOUR))) return ok;
  if (!(await allowFromIp(`ins-track:${kind}:${vendorId}:${refId}`, 20, HOUR))) return ok;
  // Ceilings that hold even where the client IP can't be trusted (so the per-IP limits above are skipped).
  if (!take(`ins-track:t:${kind}:${vendorId}:${refId}`, 3_000, HOUR) || !take(`ins-track:v:${vendorId}`, 30_000, HOUR)) return ok;
  try {
    if (await isTrackable(kind, vendorId, refId)) await recordInsEvent(kind, vendorId, refId);
  } catch (err) {
    console.error("[insurance] track failed", err);
  }
  return ok;
}
