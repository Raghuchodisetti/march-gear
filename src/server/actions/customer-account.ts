"use server";

import { z } from "zod";
import { and, eq, inArray, like, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { audit } from "@/server/audit";
import { currentSessionId, destroyAllSessions, destroySession, getSessionUser, verifyPassword } from "@/server/auth";
import { MINUTE, reset, take } from "@/server/rate-limit";
import { invalid } from "@/server/validation";

/* ──────────────────────────────────────────────────────────────
   Customer account actions for /account (security, privacy).
   Each one re-checks the website session — never trusts the page.
   ────────────────────────────────────────────────────────────── */

const EXPIRED = { ok: false as const, error: "Your session has expired. Please sign in again." };
const TOO_MANY = "Too many attempts. Please wait 15 minutes and try again.";

/** This customer's sessions other than this browser's. */
async function otherSessions(userId: number) {
  const current = await currentSessionId("customer");
  return getDb()
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), current ? ne(sessions.id, current) : undefined));
}

/** Signs out one of the customer's other devices. `key` is the short session key shown on the security page. */
export async function revokeCustomerSessionAction(key: unknown): Promise<ActionResult> {
  const me = await getSessionUser("customer");
  if (!me) return EXPIRED;
  const parsed = z.string().regex(/^[a-f0-9]{16}$/).safeParse(key);
  if (!parsed.success) return { ok: false, error: "That session couldn't be found." };
  const db = getDb();
  const matches = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.userId, me.id), like(sessions.id, `${parsed.data}%`)));
  if (matches.length !== 1) return { ok: false, error: "That device has already been signed out." };
  if (matches[0].id === (await currentSessionId("customer"))) return { ok: false, error: "That's this browser — use Sign out instead." };
  await db.delete(sessions).where(and(eq(sessions.userId, me.id), eq(sessions.id, matches[0].id)));
  return { ok: true };
}

/** Signs the customer out everywhere except this browser. */
export async function signOutOtherDevicesAction(): Promise<ActionResult<{ count: number }>> {
  const me = await getSessionUser("customer");
  if (!me) return EXPIRED;
  const others = await otherSessions(me.id);
  if (others.length)
    await getDb()
      .delete(sessions)
      .where(and(eq(sessions.userId, me.id), inArray(sessions.id, others.map((s) => s.id))));
  return { ok: true, count: others.length };
}

/** Signs the customer out on every device, this one included. */
export async function signOutEverywhereAction(): Promise<ActionResult> {
  const me = await getSessionUser("customer");
  if (!me) return EXPIRED;
  await destroySession("customer");
  await destroyAllSessions(me.id);
  return { ok: true };
}

const deleteSchema = z.object({
  confirm: z.string().trim().refine((v) => v === "DELETE", "Type DELETE in capital letters to confirm"),
  password: z.string().min(1, "Enter your password").max(200),
});

/**
 * Deletes the customer's account. The database removes what belongs only to them (saved cars, garage,
 * notifications, sessions); enquiries, test drives, insurance requests and reviews stay with the businesses
 * that handled them but are no longer linked to an account. Then this browser is signed out.
 */
export async function deleteAccountAction(input: unknown): Promise<ActionResult> {
  const me = await getSessionUser("customer");
  if (!me || me.role !== "customer") return EXPIRED;
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const limit = `delete-account:${me.id}`;
  if (!take(limit, 5, 15 * MINUTE)) return { ok: false, error: TOO_MANY };
  const db = getDb();
  const [u] = await db.select({ hash: users.passwordHash, role: users.role }).from(users).where(eq(users.id, me.id));
  if (!u || u.role !== "customer") return EXPIRED;
  if (!(await verifyPassword(parsed.data.password, u.hash))) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: { password: "That password is incorrect." } };
  reset(limit);

  // Recorded first: the entry outlives the account (its user link is cleared when the account goes).
  await audit(me.id, "delete", "user", me.id, `Customer account #${me.id} was deleted by its owner from /account/privacy`);
  await destroySession("customer");
  await db.delete(users).where(and(eq(users.id, me.id), eq(users.role, "customer")));
  return { ok: true };
}
