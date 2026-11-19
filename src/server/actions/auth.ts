"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import type { ActionResult, WishlistData } from "@/lib/action-result";
import {
  SESSION_TTL,
  createSession,
  destroyAllSessions,
  destroySession,
  getSessionUser,
  hashPassword,
  isStaff,
  verifyPassword,
  type SessionUser,
} from "@/server/auth";
import { HOUR, MINUTE, allowFromIp, clientIp, reset, take } from "@/server/rate-limit";
import { isDuplicate } from "@/server/db-errors";
import { getWishlist, mergeWishlist } from "@/server/wishlist";
import { email, invalid, mobile, name, password } from "@/server/validation";

const localWishlist = z
  .object({ cars: z.array(z.string().max(120)).max(200), used: z.array(z.string().max(120)).max(200) })
  .partial()
  .optional();
const optionalMobile = z.union([z.literal("").transform(() => undefined), mobile]).optional();
const city = z.string().trim().max(64).optional();

type AuthResult = ActionResult<{ user: SessionUser; wishlist: WishlistData }>;

const TOO_MANY = "Too many attempts. Please wait 15 minutes and try again.";

async function signedIn(userId: number, local: Partial<WishlistData> | undefined, staff = false): Promise<AuthResult> {
  await createSession(userId, staff ? SESSION_TTL.staff : SESSION_TTL.customer);
  await mergeWishlist(userId, local);
  const [u] = await getDb().select().from(users).where(eq(users.id, userId));
  return {
    ok: true,
    user: { id: u.id, name: u.name, email: u.email, phone: u.phone, city: u.city, role: u.role, memberSince: u.createdAt.toISOString() },
    wishlist: await getWishlist(userId),
  };
}

const signUpSchema = z.object({ name, email, phone: optionalMobile, city, password, wishlist: localWishlist });

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
    const [res] = await db.insert(users).values({ ...data, phone: data.phone ?? null, city: data.city ?? null, passwordHash: await hashPassword(pw) });
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
  if (!user.isActive) return { result: { ok: false, error: "This account has been disabled. Contact hello@marchgear.in." } as AuthResult };
  keys.forEach(reset);
  return { user, wishlist: parsed.data.wishlist };
}

export async function signInAction(input: unknown): Promise<AuthResult> {
  const checked = await checkCredentials(input);
  if (checked.result) return checked.result;
  return signedIn(checked.user!.id, checked.wishlist, isStaff(checked.user!.role));
}

/** Admin panel sign-in: staff accounts only. */
export async function adminSignInAction(input: unknown): Promise<ActionResult> {
  const checked = await checkCredentials(input);
  if (checked.result) return checked.result;
  if (!isStaff(checked.user!.role)) return { ok: false, error: "This account doesn't have admin access." };
  await createSession(checked.user!.id, SESSION_TTL.staff);
  return { ok: true };
}

export async function signOutAction(): Promise<ActionResult> {
  await destroySession();
  return { ok: true };
}

const profileSchema = z.object({ name, phone: optionalMobile, city });

export async function updateProfileAction(input: unknown): Promise<ActionResult<{ user: SessionUser }>> {
  const me = await getSessionUser();
  if (!me) return { ok: false, error: "Your session has expired. Please sign in again." };
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { name: newName, phone, city: newCity } = parsed.data;
  await getDb()
    .update(users)
    .set({ name: newName, phone: phone ?? null, city: newCity ?? null })
    .where(eq(users.id, me.id));
  return { ok: true, user: { ...me, name: newName, phone: phone ?? null, city: newCity ?? null } };
}

const passwordSchema = z.object({ current: z.string().min(1, "Enter your current password"), next: password });

export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  const me = await getSessionUser();
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
  await createSession(me.id, isStaff(me.role) ? SESSION_TTL.staff : SESSION_TTL.customer);
  return { ok: true };
}
