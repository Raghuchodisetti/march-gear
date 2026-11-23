"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import type { ActionResult, WishlistData } from "@/lib/action-result";
import {
  REALM_LOGIN,
  createSession,
  destroyAllSessions,
  destroySession,
  getSessionUser,
  hashPassword,
  realmOf,
  verifyPassword,
  type SessionRealm,
  type SessionUser,
} from "@/server/auth";
import { HOUR, MINUTE, allowFromIp, clientIp, reset, take } from "@/server/rate-limit";
import { isDuplicate } from "@/server/db-errors";
import { getCatalogData } from "@/server/catalog";
import { isIndianState } from "@/data/states";
import { audit } from "@/server/audit";
import { getWishlist, mergeWishlist } from "@/server/wishlist";
import { email, invalid, mobile, name, password } from "@/server/validation";

const localWishlist = z
  .object({ cars: z.array(z.string().max(120)).max(200), used: z.array(z.string().max(120)).max(200) })
  .partial()
  .optional();
const optionalMobile = z.union([z.literal("").transform(() => undefined), mobile]).optional();
const city = z.string().trim().min(2, "Enter your city").max(64, "Keep the city under 64 characters");
const state = z.string({ error: "Choose your state" }).refine(isIndianState, "Choose your state");

type AuthResult = ActionResult<{ user: SessionUser; wishlist: WishlistData }>;

const TOO_MANY = "Too many attempts. Please wait 15 minutes and try again.";

/* Website (customer) sign-in. Staff, dealer and insurance vendor accounts each have their own login. */

async function signedIn(userId: number, local: Partial<WishlistData> | undefined): Promise<AuthResult> {
  await createSession(userId, "customer");
  await mergeWishlist(userId, local);
  const [u] = await getDb().select().from(users).where(eq(users.id, userId));
  return {
    ok: true,
    user: { id: u.id, name: u.name, email: u.email, phone: u.phone, state: u.state, city: u.city, role: u.role, memberSince: u.createdAt.toISOString() },
    wishlist: await getWishlist(userId),
  };
}

const signUpSchema = z.object({ name, email, phone: optionalMobile, state, city, password, wishlist: localWishlist });

const EMAIL_TAKEN: AuthResult = { ok: false, fieldErrors: { email: "An account with this email already exists — sign in instead." } };

export async function signUpAction(input: unknown): Promise<AuthResult> {
  if (!(await allowFromIp("signup", 5, HOUR))) return { ok: false, error: TOO_MANY };
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { wishlist, password: pw, ...data } = parsed.data;
  const db = getDb();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, data.email));
  if (existing) return EMAIL_TAKEN;

  try {
    const [res] = await db.insert(users).values({ ...data, phone: data.phone ?? null, passwordHash: await hashPassword(pw) });
    return signedIn(res.insertId, wishlist);
  } catch (err) {
    // Two sign-ups with the same email at the same moment.
    if (isDuplicate(err)) return EMAIL_TAKEN;
    throw err;
  }
}

const signInSchema = z.object({ email, password: z.string().min(1, "Enter your password").max(200), wishlist: localWishlist });

async function checkCredentials(input: unknown) {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return { result: invalid(parsed.error) as AuthResult };
  // Count the attempt before checking it: per IP + email, and (looser, so nobody can lock
  // a real user out cheaply) per email across all IPs.
  const ip = await clientIp();
  const keys = [`signin:${ip ?? "?"}:${parsed.data.email}`, `signin:${parsed.data.email}`];
  const withinLimits = [take(keys[0], 8, 15 * MINUTE), take(keys[1], 20, 15 * MINUTE)];
  if (withinLimits.includes(false)) return { result: { ok: false, error: TOO_MANY } as AuthResult };

  const [user] = await getDb().select().from(users).where(eq(users.email, parsed.data.email));
  const valid = await verifyPassword(parsed.data.password, user?.passwordHash);
  if (!user || !valid) return { result: { ok: false, error: "Email or password is incorrect." } as AuthResult };
  if (!user.isActive) {
    const { email: contact } = (await getCatalogData()).content.site;
    return { result: { ok: false, error: `This account has been disabled. Contact ${contact}.` } as AuthResult };
  }
  keys.forEach(reset);
  return { user, wishlist: parsed.data.wishlist };
}

/** "This is a staff account — use the staff admin sign-in." */
const otherLogin = (realm: SessionRealm, kind: string) => `This is ${kind} account. Use ${REALM_LOGIN[realm].label} (${REALM_LOGIN[realm].href}).`;
const ACCOUNT_KIND: Record<SessionRealm, string> = { customer: "a MarchGear website", staff: "a staff", dealer: "a dealer partner", insurer: "an insurance vendor" };

export async function signInAction(input: unknown): Promise<AuthResult> {
  const checked = await checkCredentials(input);
  if (checked.result) return checked.result;
  const realm = realmOf(checked.user!.role);
  if (realm !== "customer") return { ok: false, error: otherLogin(realm, ACCOUNT_KIND[realm]) };
  return signedIn(checked.user!.id, checked.wishlist);
}

/** Signs out of the website only (the admin and the portals keep their own sign-ins). */
export async function signOutAction(): Promise<ActionResult> {
  await destroySession("customer");
  return { ok: true };
}

/* Staff admin sign-in: staff accounts only, with their own session. */

export async function adminSignInAction(input: unknown): Promise<ActionResult> {
  const checked = await checkCredentials(input);
  if (checked.result) return checked.result;
  const realm = realmOf(checked.user!.role);
  if (realm !== "staff") return { ok: false, error: otherLogin(realm, ACCOUNT_KIND[realm]) };
  await createSession(checked.user!.id, "staff");
  await audit(checked.user!.id, "login", "session", checked.user!.id, `${checked.user!.name} signed in to the admin panel`);
  return { ok: true };
}

/** Signs out of the staff admin only. */
export async function adminSignOutAction(): Promise<ActionResult> {
  await destroySession("staff");
  return { ok: true };
}

const profileSchema = z.object({ name, phone: optionalMobile, state, city });

export async function updateProfileAction(input: unknown): Promise<ActionResult<{ user: SessionUser }>> {
  const me = await getSessionUser("customer");
  if (!me) return { ok: false, error: "Your session has expired. Please sign in again." };
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { name: newName, phone, state: newState, city: newCity } = parsed.data;
  await getDb()
    .update(users)
    .set({ name: newName, phone: phone ?? null, state: newState, city: newCity })
    .where(eq(users.id, me.id));
  return { ok: true, user: { ...me, name: newName, phone: phone ?? null, state: newState, city: newCity } };
}

const passwordSchema = z.object({ current: z.string().min(1, "Enter your current password"), next: password });

/** Website account password change. */
export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  return changePassword("customer", input);
}

/** Staff admin password change (/admin/account). */
export async function adminChangePasswordAction(input: unknown): Promise<ActionResult> {
  return changePassword("staff", input);
}

async function changePassword(realm: "customer" | "staff", input: unknown): Promise<ActionResult> {
  const me = await getSessionUser(realm);
  if (!me) return { ok: false, error: "Your session has expired. Please sign in again." };
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!take(`password:${me.id}`, 8, 15 * MINUTE)) return { ok: false, error: TOO_MANY };
  const db = getDb();
  const [u] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, me.id));
  if (!(await verifyPassword(parsed.data.current, u?.hash))) return { ok: false, fieldErrors: { current: "That password is incorrect." } };
  await db.update(users).set({ passwordHash: await hashPassword(parsed.data.next) }).where(eq(users.id, me.id));
  reset(`password:${me.id}`);
  // Sign out other devices, keep this one signed in.
  await destroyAllSessions(me.id);
  await createSession(me.id, realm);
  return { ok: true };
}
