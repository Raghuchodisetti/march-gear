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
import { accessForPath, allows, deskPath, isSection, type Access, type Desk, type Section } from "@/lib/staff-access";
import { clientIp } from "@/server/rate-limit";

/* ──────────────────────────────────────────────────────────────
   Database sessions. The browser holds a random token in an
   httpOnly cookie; the database stores only its SHA-256 hash.

   Every kind of login is separate: the website (customers), the
   admin desk (/admin, admins), the staff desk (/staff, staff with
   the sections an admin gave them), the dealer portal and the
   insurance vendor portal each have their own cookie and only
   accept their own kind of account. Signing in or out of one never
   touches the others, so all five can be open in one browser.
   ────────────────────────────────────────────────────────────── */

export type SessionRealm = "customer" | "admin" | "staff" | "dealer" | "insurer";

export const SESSION_COOKIES: Record<SessionRealm, string> = {
  customer: "mg_session",
  admin: "mg_admin",
  staff: "mg_staff",
  dealer: "mg_dealer",
  insurer: "mg_insurer",
};

const DAY_MS = 86_400_000;
/** Customers stay signed in for 30 days, admins and staff for a working day, dealer and insurer users for a week. */
export const SESSION_TTL: Record<SessionRealm, number> = { customer: 30 * DAY_MS, admin: 12 * 3_600_000, staff: 12 * 3_600_000, dealer: 7 * DAY_MS, insurer: 7 * DAY_MS };
const BCRYPT_ROUNDS = 12;

export type { SessionUser } from "@/lib/action-result";

/** Back-office roles: admins (the admin desk) and staff (the staff desk). */
export const STAFF_ROLES: UserRole[] = ["admin", "staff"];
export const isStaff = (role: UserRole) => STAFF_ROLES.includes(role);

/** The account roles each login accepts. */
export const REALM_ROLES: Record<SessionRealm, UserRole[]> = { customer: ["customer"], admin: ["admin"], staff: ["staff"], dealer: ["dealer"], insurer: ["insurer"] };

/** Which login an account belongs to. */
export const realmOf = (role: UserRole): SessionRealm =>
  role === "admin" ? "admin" : role === "staff" ? "staff" : role === "dealer" ? "dealer" : role === "insurer" ? "insurer" : "customer";

/** Where each kind of account signs in — for "use the … sign-in" messages. */
export const REALM_LOGIN: Record<SessionRealm, { href: string; label: string }> = {
  customer: { href: "/login", label: "the MarchGear website sign-in" },
  admin: { href: "/admin/login", label: "the admin sign-in" },
  staff: { href: "/staff/login", label: "the staff sign-in" },
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

/* ── The two back-office desks ─────────────────────────────── */

/** Which desk this request is for: src/proxy.ts sets it from the URL (/staff/… or /admin/…). Defaults to the admin desk. */
export const getDesk = cache(async (): Promise<Desk> => ((await headers()).get("x-mg-desk") === "staff" ? "staff" : "admin"));

/** The account signed in to this request's desk, or null. */
export const getDeskUser = cache(async () => getSessionUser(await getDesk()));

/** A staff account's sections (what an admin ticked for them). */
export const staffSections = cache(async (userId: number): Promise<Section[]> => {
  const [row] = await getDb().select({ permissions: users.permissions }).from(users).where(eq(users.id, userId));
  return (row?.permissions ?? []).filter(isSection);
});

/** What the page being requested needs (from its /admin/… path); undefined when the request didn't come through the proxy. */
async function requestedAccess(): Promise<Access | null | undefined> {
  const path = (await headers()).get("x-mg-path");
  return path ? accessForPath(path) : undefined;
}

/**
 * For admin pages and Server Actions: the signed-in admin (admin desk) or staff member (staff desk), or a redirect
 * to that desk's sign-in. On the staff desk the account must have `access` — a section, any of several, or "admin"
 * (never for staff). Without `access`, the page's own section is used (from its path); Server Actions must always
 * name theirs, because an action can be posted to any URL.
 */
export async function requireStaff(access?: Access) {
  const desk = await getDesk();
  const user = await getSessionUser(desk);
  if (!user) redirect(desk === "staff" ? "/staff/login" : "/admin/login");
  if (desk === "staff") {
    const need = access ?? (await requestedAccess());
    if (need === undefined || !allows("staff", await staffSections(user.id), need)) redirect("/staff?denied=1");
  }
  return user;
}

/** For Route Handlers on the desks: the desk's account if it has `access`, else null (no redirect — answer 401/403). */
export async function deskUserFor(access: Access | null): Promise<SessionUser | null> {
  const desk = await getDesk();
  const user = await getSessionUser(desk);
  if (!user) return null;
  return desk === "admin" || allows("staff", await staffSections(user.id), access) ? user : null;
}

/** redirect() to an /admin/… page on this request's desk (/staff/… on the staff desk). */
export async function deskRedirect(path: string): Promise<never> {
  redirect(deskPath(await getDesk(), path));
}

/** Admins only (staff accounts, billing, the activity log). */
export const requireAdmin = () => requireStaff("admin");

/**
 * The back-office account allowed `access` in this request, or null — no redirect. For routes outside the two desks
 * that staff open too (e.g. a dealer's or vendor's uploaded file): an admin session, else a staff session with the section.
 */
export async function backOfficeUser(access: Access | null): Promise<SessionUser | null> {
  const desk = await getDesk();
  for (const realm of desk === "staff" ? (["staff", "admin"] as const) : (["admin", "staff"] as const)) {
    const user = await getSessionUser(realm);
    if (user && (realm === "admin" || allows("staff", await staffSections(user.id), access))) return user;
  }
  return null;
}
