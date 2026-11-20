"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { insNotifications } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { insurerAction, isInsurerError, type InsurerContext } from "@/server/insurance/context";
import { insNotificationScope } from "@/server/insurance/records";

/* Notification read state. Anyone at the vendor may manage the notifications addressed to them or to the whole vendor — even before approval. */

const visible = (ctx: InsurerContext) => insNotificationScope(ctx);

export async function setInsNotificationReadAction(input: unknown): Promise<ActionResult> {
  const ctx = await insurerAction(undefined, { approved: false });
  if (isInsurerError(ctx)) return ctx;
  const parsed = z.object({ id: z.number().int().positive(), read: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "That notification couldn't be found." };
  const where = and(visible(ctx), eq(insNotifications.id, parsed.data.id));
  const [row] = await getDb().select({ id: insNotifications.id }).from(insNotifications).where(where);
  if (!row) return { ok: false, error: "That notification couldn't be found." };
  await getDb()
    .update(insNotifications)
    .set({ readAt: parsed.data.read ? new Date() : null })
    .where(and(where, parsed.data.read ? isNull(insNotifications.readAt) : isNotNull(insNotifications.readAt)));
  revalidatePath("/insurance-vendor", "layout");
  return { ok: true };
}

/** Marks everything this person can see as read. */
export async function markAllInsNotificationsReadAction(): Promise<ActionResult<{ count: number }>> {
  const ctx = await insurerAction(undefined, { approved: false });
  if (isInsurerError(ctx)) return ctx;
  const [res] = await getDb()
    .update(insNotifications)
    .set({ readAt: new Date() })
    .where(and(visible(ctx), isNull(insNotifications.readAt)));
  revalidatePath("/insurance-vendor", "layout");
  return { ok: true, count: res.affectedRows };
}
