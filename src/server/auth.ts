import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { and, eq, gt, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions, users, type UserRole } from "@/db/schema";
import type { SessionUser } from "@/lib/action-result";
import { clientIp } from "@/server/rate-limit";

/* ──────────────────────────────────────────────────────────────
   Database sessions. The browser holds a random token in an
   httpOnly cookie; the database stores only its SHA-256 hash.
   ────────────────────────────────────────────────────────────── */

export const SESSION_COOKIE = "mg_session";
const DAY_MS = 86_400_000;
/** Customers stay signed in for 30 days; staff sign-ins last a working day. */
export const SESSION_TTL = { customer: 30 * DAY_MS, staff: 12 * 3_600_000 } as const;
const BCRYPT_ROUNDS = 12;

export type { SessionUser } from "@/lib/action-result";

export const STAFF_ROLES: UserRole[] = ["admin", "editor"];
export const isStaff = (role: UserRole) => STAFF_ROLES.includes(role);

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const hashPassword = (password: string) => bcrypt.hash(password, BCRYPT_ROUNDS);

// Compared against when the email is unknown, so timing doesn't reveal which accounts exist.
const DUMMY_HASH = "$2b$12$I3Xj7zTr7b1C.yMd4bFKNOPcz9gCaJuKs5r20MPpmmX5RrQ0KXKOO";
export const verifyPassword = (password: string, hash: string | null | undefined) => bcrypt.compare(password, hash ?? DUMMY_HASH);

// Recorded for the audit trail only — never used for access decisions.
async function requestMeta() {
  const h = await headers();
  return {
    userAgent: h.get("user-agent")?.slice(0, 255) ?? null,
    ip: (await clientIp()) ?? null,
  };
}

/** Starts a session for the user and sets the cookie. Call from Server Actions / Route Handlers only. */
export async function createSession(userId: number, ttlMs: number = SESSION_TTL.customer) {
  const db = getDb();
  const jar = await cookies();
  // Revoke whatever session this browser had before (e.g. a customer signing in as staff).
  const previous = jar.get(SESSION_COOKIE)?.value;
  if (previous) await db.delete(sessions).where(eq(sessions.id, hashToken(previous)));

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ttlMs);
  const meta = await requestMeta();
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt, ...meta });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  // Housekeeping: drop this user's expired sessions.
  await db.delete(sessions).where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, new Date())));

  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Ends the current session. Call from Server Actions / Route Handlers only. */
export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await getDb().delete(sessions).where(eq(sessions.id, hashToken(token)));
  jar.delete(SESSION_COOKIE);
}

/** Signs a user out everywhere (e.g. after a password change or deactivation). */
export async function destroyAllSessions(userId: number) {
  await getDb().delete(sessions).where(eq(sessions.userId, userId));
}

/** The signed-in user, or null. Deduplicated per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await getDb()
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      state: users.state,
      city: users.city,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date()), eq(users.isActive, true)))
    .limit(1);
  if (!row) return null;
  const { createdAt, ...user } = row;
  return { ...user, memberSince: createdAt.toISOString() };
});

/** For customer pages: the user, or a redirect to sign in. */
export async function requireUser(next = "/profile") {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

/** For admin pages and actions: a staff user with one of the roles, or a redirect to the admin sign-in. */
export async function requireStaff(roles: UserRole[] = STAFF_ROLES) {
  const user = await getSessionUser();
  if (!user || !isStaff(user.role)) redirect("/admin/login");
  if (!roles.includes(user.role)) redirect("/admin?denied=1");
  return user;
}
