"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import type { ActionResult, UserPreferences } from "@/lib/action-result";
import { getSessionUser } from "@/server/auth";
import { getPreferences } from "@/server/customer/account";
import { invalid } from "@/server/validation";

/* ── Preferences (/account/preferences) ─────────────────────── */

const preferencesSchema = z.object({
  alerts: z.object({ price: z.boolean(), launch: z.boolean(), digest: z.boolean(), whatsapp: z.boolean() }),
  contact: z.enum(["call", "whatsapp", "email"], { error: "Choose how we should contact you" }),
});

/** The signed-in customer's alert and contact preferences (defaults until they save them). */
export async function myPreferencesAction(): Promise<ActionResult<{ preferences: UserPreferences }>> {
  const me = await getSessionUser("customer");
  if (!me) return { ok: false, error: "Please sign in again." };
  return { ok: true, preferences: (await getPreferences(me.id)).preferences };
}

export async function savePreferencesAction(input: unknown): Promise<ActionResult> {
  const me = await getSessionUser("customer");
  if (!me) return { ok: false, error: "Please sign in again." };
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const db = getDb();
  // Keep what else lives in the column — e.g. the sign-up consent record (`consent`).
  const [row] = await db.select({ preferences: users.preferences }).from(users).where(eq(users.id, me.id));
  const kept = row?.preferences && typeof row.preferences === "object" ? row.preferences : {};
  await db
    .update(users)
    .set({ preferences: { ...kept, ...parsed.data } })
    .where(eq(users.id, me.id));
  return { ok: true };
}
