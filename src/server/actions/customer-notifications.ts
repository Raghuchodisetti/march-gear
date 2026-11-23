"use server";

import { z } from "zod";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { customerNotifications } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { getSessionUser } from "@/server/auth";

/* Read state of a website customer's own notifications (/account/notifications). */

const SIGNED_OUT = { ok: false as const, error: "Your session has ended. Please sign in again." };
const NOT_FOUND = { ok: false as const, error: "That notification couldn't be found." };

export async function setCustomerNotificationReadAction(input: unknown): Promise<ActionResult> {
  const user = await getSessionUser("customer");
  if (!user) return SIGNED_OUT;
  const parsed = z.object({ id: z.number().int().positive(), read: z.boolean() }).safeParse(input);
  if (!parsed.success) return NOT_FOUND;
  const db = getDb();
  const own = and(eq(customerNotifications.id, parsed.data.id), eq(customerNotifications.userId, user.id));
  const [row] = await db.select({ id: customerNotifications.id }).from(customerNotifications).where(own);
  if (!row) return NOT_FOUND;
  await db
    .update(customerNotifications)
    .set({ readAt: parsed.data.read ? new Date() : null })
    .where(and(own, parsed.data.read ? isNull(customerNotifications.readAt) : isNotNull(customerNotifications.readAt)));
  revalidatePath("/account", "layout");
  return { ok: true };
}

export async function markAllCustomerNotificationsReadAction(): Promise<ActionResult<{ count: number }>> {
  const user = await getSessionUser("customer");
  if (!user) return SIGNED_OUT;
  const [res] = await getDb()
    .update(customerNotifications)
    .set({ readAt: new Date() })
    .where(and(eq(customerNotifications.userId, user.id), isNull(customerNotifications.readAt)));
  revalidatePath("/account", "layout");
  return { ok: true, count: res.affectedRows };
}
