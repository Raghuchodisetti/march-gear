import "server-only";
import { and, count, eq, gte, inArray, notInArray } from "drizzle-orm";
import { getDb } from "@/db";
import { partnerOffers, partnerVehicles } from "@/db/schema";
import { getPlans, planNameOf } from "@/server/partner/billing";

/* Plan limits on what a dealership can have live (or waiting to go live). */

/** Vehicles that count towards the listing limit: live, approved or waiting for approval. */
const LISTING_STATUSES = ["published", "approved", "pending_approval"] as const;

/**
 * Null when `adding` more listings fit the dealership's plan; otherwise a message for the dealer.
 * `excludeIds` are the vehicles being submitted (so a resubmission isn't counted twice).
 */
export async function listingLimitError(partnerId: number, plan: string, adding: number, excludeIds: number[] = []) {
  const plans = await getPlans();
  const limit = plans.find((p) => p.id === plan)?.limits.listings ?? null;
  if (limit === null) return null;
  const [{ n }] = await getDb()
    .select({ n: count() })
    .from(partnerVehicles)
    .where(
      and(
        eq(partnerVehicles.partnerId, partnerId),
        inArray(partnerVehicles.status, [...LISTING_STATUSES]),
        excludeIds.length ? notInArray(partnerVehicles.id, excludeIds) : undefined,
      ),
    );
  if (n + adding <= limit) return null;
  const left = Math.max(0, limit - n);
  return `Your ${planNameOf(plans, plan)} plan allows ${limit} live or pending listings and you have ${n}${left ? ` — room for ${left} more` : ""}. Archive a listing or upgrade in Subscription.`;
}

/** Null when one more running/upcoming offer fits the plan; otherwise a message for the dealer. */
export async function offerLimitError(partnerId: number, plan: string, excludeId?: number) {
  const plans = await getPlans();
  const limit = plans.find((p) => p.id === plan)?.limits.activeOffers ?? null;
  if (limit === null) return null;
  const db = getDb();
  const now = new Date();
  const scope = and(eq(partnerOffers.partnerId, partnerId), excludeId ? notInArray(partnerOffers.id, [excludeId]) : undefined);
  const [[{ live }], [{ pending }]] = await Promise.all([
    // Approved offers that haven't ended yet (active now or scheduled). A paused offer keeps its approval and can be
    // resumed without review, so it keeps its slot too — otherwise pause → approve another → resume beats the limit.
    db.select({ live: count() }).from(partnerOffers).where(and(scope, inArray(partnerOffers.status, ["approved", "paused"]), gte(partnerOffers.endsAt, now))),
    db.select({ pending: count() }).from(partnerOffers).where(and(scope, inArray(partnerOffers.status, ["submitted", "pending_approval"]))),
  ]);
  if (live + pending < limit) return null;
  return `Your ${planNameOf(plans, plan)} plan allows ${limit} active or upcoming offers and you have ${live + pending} (including paused ones and ones waiting for approval). Let one end, cancel one, or upgrade in Subscription.`;
}
