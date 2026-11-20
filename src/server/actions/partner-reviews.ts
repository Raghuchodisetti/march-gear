"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { dealerReviews } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { expireCatalog } from "@/server/catalog";
import { isActionError, partnerAction } from "@/server/partner/context";
import { logPartnerActivity } from "@/server/partner/records";
import { invalid } from "@/server/validation";

/* Public replies to the reviews of the dealer's MarchGear showroom page. */

const reviewId = z.string().trim().min(1).max(64);
const NOT_FOUND = { ok: false as const, error: "That review isn't on your showroom page." };

async function ownReview(input: { id: string }) {
  const ctx = await partnerAction("reviews.reply");
  if (isActionError(ctx)) return ctx;
  if (!ctx.partner.publicDealerId) return { ok: false as const, error: "Your public showroom page isn't live yet." };
  const [review] = await getDb()
    .select()
    .from(dealerReviews)
    .where(and(eq(dealerReviews.id, input.id), eq(dealerReviews.dealerId, ctx.partner.publicDealerId), eq(dealerReviews.status, "approved")));
  if (!review) return NOT_FOUND;
  return { ctx, review };
}

const replySchema = z.object({
  id: reviewId,
  reply: z.string().trim().min(10, "Write at least 10 characters").max(1500, "Keep your reply under 1,500 characters"),
});

export async function replyToReviewAction(input: unknown): Promise<ActionResult> {
  const parsed = replySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const found = await ownReview(parsed.data);
  if ("ok" in found) return found;
  const { ctx, review } = found;
  await getDb().update(dealerReviews).set({ reply: parsed.data.reply, repliedAt: new Date() }).where(eq(dealerReviews.id, review.id));
  await logPartnerActivity(ctx.partner.id, ctx.user.id, review.reply ? "update" : "reply", "review", review.id, `${review.reply ? "Edited the reply to" : "Replied to"} ${review.name}'s review`);
  expireCatalog();
  revalidatePath("/dealer/reviews");
  return { ok: true };
}

export async function deleteReviewReplyAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ id: reviewId }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const found = await ownReview(parsed.data);
  if ("ok" in found) return found;
  const { ctx, review } = found;
  if (!review.reply) return { ok: true };
  await getDb().update(dealerReviews).set({ reply: null, repliedAt: null }).where(eq(dealerReviews.id, review.id));
  await logPartnerActivity(ctx.partner.id, ctx.user.id, "delete", "review", review.id, `Removed the reply to ${review.name}'s review`);
  expireCatalog();
  revalidatePath("/dealer/reviews");
  return { ok: true };
}
