import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { and, eq, gt, inArray, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions, users, type UserRole } from "@/db/schema";
import type { SessionUser } from "@/lib/action-result";
import { clientIp } from "@/server/rate-limit";

/* ──────────────────────────────────────────────────────────────
   Database sessions. The browser holds a random token in an
   httpOnly cookie; the database stores only its SHA-256 hash.

   Every kind of login is separate: the website (customers), the
   staff admin, the dealer portal and the insurance vendor portal
   each have their own cookie and only accept their own kind of
   account. Signing in or out of one never touches the others, so
   all four can be open in the same browser at once.
   ────────────────────────────────────────────────────────────── */

export type SessionRealm = "customer" | "staff" | "dealer" | "insurer";

export const SESSION_COOKIES: Record<SessionRealm, string> = {
  customer: "mg_session",
  staff: "mg_admin",
  dealer: "mg_dealer",
  insurer: "mg_insurer",
};

const DAY_MS = 86_400_000;
/** Customers stay signed in for 30 days, staff for a working day, dealer and insurer users for a week. */
export const SESSION_TTL: Record<SessionRealm, number> = { customer: 30 * DAY_MS, staff: 12 * 3_600_000, dealer: 7 * DAY_MS, insurer: 7 * DAY_MS };
const BCRYPT_ROUNDS = 12;

export type { SessionUser } from "@/lib/action-result";

export const STAFF_ROLES: UserRole[] = ["admin", "editor"];
export const isStaff = (role: UserRole) => STAFF_ROLES.includes(role);

/** The account roles each login accepts. */
export const REALM_ROLES: Record<SessionRealm, UserRole[]> = { customer: ["customer"], staff: STAFF_ROLES, dealer: ["dealer"], insurer: ["insurer"] };

/** Which login an account belongs to. */
export const realmOf = (role: UserRole): SessionRealm => (isStaff(role) ? "staff" : role === "dealer" ? "dealer" : role === "insurer" ? "insurer" : "customer");

/** Where each kind of account signs in — for "use the … sign-in" messages. */
export const REALM_LOGIN: Record<SessionRealm, { href: string; label: string }> = {
  customer: { href: "/login", label: "the MarchGear website sign-in" },
  staff: { href: "/admin/login", label: "the staff admin sign-in" },
  dealer: { href: "/dealer/login", label: "the dealer partner portal sign-in" },
  insurer: { href: "/insurance-vendor/login", label: "the insurance vendor portal sign-in" },
};

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

/** The hash of this browser's session token for a login (to mark "this device" in session lists), or null. */
export async function currentSessionId(realm: SessionRealm): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIES[realm])?.value;
  return token ? hashToken(token) : null;
}

/**
 * Starts a session for the user in one login and sets that login's cookie. Other logins in the same
 * browser are left alone. Call from Server Actions / Route Handlers only.
 */
export async function createSession(userId: number, realm: SessionRealm, ttlMs: number = SESSION_TTL[realm]) {
  const db = getDb();
  const jar = await cookies();
  const name = SESSION_COOKIES[realm];
  // Revoke whatever session this browser had in the same login before (e.g. switching dealer accounts).
  const previous = jar.get(name)?.value;
  if (previous) await db.delete(sessions).where(eq(sessions.id, hashToken(previous)));

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ttlMs);
  const meta = await requestMeta();
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt, ...meta });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  // Housekeeping: drop this user's expired sessions.
  await db.delete(sessions).where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, new Date())));

  jar.set(name, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Ends this browser's session in one login only. Call from Server Actions / Route Handlers only. */
export async function destroySession(realm: SessionRealm) {
  const jar = await cookies();
  const name = SESSION_COOKIES[realm];
  const token = jar.get(name)?.value;
  if (token) await getDb().delete(sessions).where(eq(sessions.id, hashToken(token)));
  jar.delete(name);
}

/** Signs a user out everywhere (e.g. after a password change or deactivation). */
export async function destroyAllSessions(userId: number) {
  await getDb().delete(sessions).where(eq(sessions.userId, userId));
}

/**
 * The account signed in to one login, or null. A session only counts in the login its account belongs
 * to (a dealer's session is never a website or admin session). Deduplicated per request.
 */
export const getSessionUser = cache(async (realm: SessionRealm): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIES[realm])?.value;
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
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date()), eq(users.isActive, true), inArray(users.role, REALM_ROLES[realm])))
    .limit(1);
  if (!row) return null;
  const { createdAt, ...user } = row;
  return { ...user, memberSince: createdAt.toISOString() };
});

/** For customer pages: the signed-in customer, or a redirect to sign in. */
export async function requireUser(next = "/account") {
  const user = await getSessionUser("customer");
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

/** The signed-in staff member, or null (no redirect) — e.g. for routes staff and portal users share. */
export const getStaffUser = () => getSessionUser("staff");

/** For admin pages and actions: a staff user with one of the roles, or a redirect to the admin sign-in. */
export async function requireStaff(roles: UserRole[] = STAFF_ROLES) {
  const user = await getSessionUser("staff");
  if (!user || !isStaff(user.role)) redirect("/admin/login");
  if (!roles.includes(user.role)) redirect("/admin?denied=1");
  return user;
}
