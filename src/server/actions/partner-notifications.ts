"use server";

import { z } from "zod";
import { and, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { partnerNotifications } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { isActionError, partnerAction, type PartnerContext } from "@/server/partner/context";
import { ALL_CATEGORIES, categoryOf, notificationVisible } from "@/components/portal/notifications/categories";

/* Notification read state. Any member may manage the notifications addressed to them or to the whole dealership. */

const visible = (ctx: PartnerContext) => and(eq(partnerNotifications.partnerId, ctx.partner.id), or(isNull(partnerNotifications.userId), eq(partnerNotifications.userId, ctx.user.id)));

export async function setNotificationReadAction(input: unknown): Promise<ActionResult> {
  const ctx = await partnerAction(undefined, { approved: false });
  if (isActionError(ctx)) return ctx;
  const parsed = z.object({ id: z.number().int().positive(), read: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "That notification couldn't be found." };
  const db = getDb();
  const where = and(visible(ctx), eq(partnerNotifications.id, parsed.data.id));
  const [row] = await db.select({ id: partnerNotifications.id, kind: partnerNotifications.kind, userId: partnerNotifications.userId }).from(partnerNotifications).where(where);
  if (!row || !notificationVisible(row, ctx.can)) return { ok: false, error: "That notification couldn't be found." };
  await db
    .update(partnerNotifications)
    .set({ readAt: parsed.data.read ? new Date() : null })
    .where(and(where, parsed.data.read ? isNull(partnerNotifications.readAt) : isNotNull(partnerNotifications.readAt)));
  revalidatePath("/dealer", "layout");
  return { ok: true };
}

/** Marks everything visible to this person as read — optionally just one category. */
export async function markAllNotificationsReadAction(input: unknown): Promise<ActionResult<{ count: number }>> {
  const ctx = await partnerAction(undefined, { approved: false });
  if (isActionError(ctx)) return ctx;
  const parsed = z.object({ category: z.enum(ALL_CATEGORIES as [string, ...string[]]).nullable() }).safeParse(input ?? { category: null });
  if (!parsed.success) return { ok: false, error: "Choose a category." };
  const db = getDb();
  const unread = await db
    .select({ id: partnerNotifications.id, kind: partnerNotifications.kind, userId: partnerNotifications.userId })
    .from(partnerNotifications)
    .where(and(visible(ctx), isNull(partnerNotifications.readAt)));
  // Read state is shared — never mark the ones this person can't see (e.g. billing) as read for everyone else.
  const ids = unread.filter((n) => notificationVisible(n, ctx.can) && (!parsed.data.category || categoryOf(n.kind) === parsed.data.category)).map((n) => n.id);
  if (ids.length) await db.update(partnerNotifications).set({ readAt: new Date() }).where(and(visible(ctx), inArray(partnerNotifications.id, ids)));
  revalidatePath("/dealer", "layout");
  return { ok: true, count: ids.length };
}
