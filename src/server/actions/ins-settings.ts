"use server";

import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { and, count, eq, inArray, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { insMembers, sessions, users } from "@/db/schema";
import { INS_ROLES, type InsRole } from "@/db/enums";
import type { ActionResult } from "@/lib/action-result";
import { INS_ROLE_LABEL } from "@/insurance/labels";
import { ALL_INS_PERMISSIONS, INS_PERMISSIONS, INS_ROLE_PERMISSIONS, insPermissionsFor, type InsPermission } from "@/insurance/permissions";
import { insurerPlans } from "@/content/blocks/insurer-plans";
import { SESSION_COOKIE, destroyAllSessions, destroySession, hashPassword, verifyPassword } from "@/server/auth";
import { getCatalog } from "@/server/catalog";
import { isDuplicate } from "@/server/db-errors";
import { INS_PORTAL_BLOCKED, insurerAction, isInsurerError, vendorName, type InsurerContext } from "@/server/insurance/context";
import { logInsurerActivity, notifyInsurer } from "@/server/insurance/records";
import { MINUTE, reset, take } from "@/server/rate-limit";
import { email, invalid, mobile, name, password } from "@/server/validation";

/* Insurance vendor portal settings: the signed-in person's account and security, and the company's team
   (accounts, roles, custom permissions, access). Available before approval too. */

const TOO_MANY = "Too many attempts. Please wait 15 minutes and try again.";
const CHECK = "Please check the highlighted fields.";

/** The current session's id (sessions store the SHA-256 of the cookie token). */
async function currentSessionId() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? createHash("sha256").update(token).digest("hex") : null;
}

/* ── Your account ───────────────────────────────────────────── */

export async function updateInsAccountAction(input: unknown): Promise<ActionResult> {
  const ctx = await insurerAction(undefined, { approved: false });
  if (isInsurerError(ctx)) return ctx;
  const parsed = z.object({ name, mobile }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  await getDb().update(users).set({ name: parsed.data.name, phone: parsed.data.mobile }).where(eq(users.id, ctx.user.id));
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "update", "account", ctx.user.id, "Updated their account details");
  revalidatePath("/insurance-vendor", "layout");
  return { ok: true };
}

const passwordSchema = z
  .object({ current: z.string().min(1, "Enter your current password").max(200), next: password, confirm: z.string().max(200) })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "The passwords don't match" })
  .refine((v) => v.next !== v.current, { path: ["next"], message: "Choose a different password from your current one" });

/** Verifies the current password, then signs out every other device. */
export async function changeInsPasswordAction(input: unknown): Promise<ActionResult<{ signedOut: number }>> {
  const ctx = await insurerAction(undefined, { approved: false });
  if (isInsurerError(ctx)) return ctx;
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!take(`password:${ctx.user.id}`, 8, 15 * MINUTE)) return { ok: false, error: TOO_MANY };
  const db = getDb();
  const [u] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, ctx.user.id));
  if (!(await verifyPassword(parsed.data.current, u?.hash))) return { ok: false, error: CHECK, fieldErrors: { current: "That password is incorrect." } };
  await db.update(users).set({ passwordHash: await hashPassword(parsed.data.next) }).where(eq(users.id, ctx.user.id));
  reset(`password:${ctx.user.id}`);
  const signedOut = await endOtherSessions(ctx.user.id);
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "update", "security", ctx.user.id, "Changed their password and signed out other devices");
  return { ok: true, signedOut };
}

async function endOtherSessions(userId: number) {
  const current = await currentSessionId();
  const db = getDb();
  const others = await db.select({ id: sessions.id }).from(sessions).where(and(eq(sessions.userId, userId), current ? ne(sessions.id, current) : undefined));
  if (others.length)
    await db.delete(sessions).where(
      and(
        eq(sessions.userId, userId),
        inArray(
          sessions.id,
          others.map((s) => s.id),
        ),
      ),
    );
  return others.length;
}

export async function revokeInsSessionAction(id: unknown): Promise<ActionResult> {
  const ctx = await insurerAction(undefined, { approved: false });
  if (isInsurerError(ctx)) return ctx;
  const parsed = z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .safeParse(id);
  if (!parsed.success) return { ok: false, error: "That session couldn't be found." };
  if (parsed.data === (await currentSessionId())) return { ok: false, error: "That's this browser. Use Sign out instead." };
  const db = getDb();
  const where = and(eq(sessions.id, parsed.data), eq(sessions.userId, ctx.user.id));
  const [row] = await db.select({ id: sessions.id }).from(sessions).where(where);
  if (!row) return { ok: false, error: "That session has already ended." };
  await db.delete(sessions).where(where);
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "revoke", "security", null, "Signed out a session on another device");
  revalidatePath("/insurance-vendor/settings");
  return { ok: true };
}

/** `everywhere: false` keeps this browser signed in; `true` also ends this session. */
export async function signOutInsSessionsAction(input: unknown): Promise<ActionResult<{ count: number }>> {
  const ctx = await insurerAction(undefined, { approved: false });
  if (isInsurerError(ctx)) return ctx;
  const everywhere = z.object({ everywhere: z.boolean() }).safeParse(input);
  if (!everywhere.success) return { ok: false, error: "That request wasn't valid." };
  const n = await endOtherSessions(ctx.user.id);
  await logInsurerActivity(
    ctx.vendor.id,
    ctx.user.id,
    "revoke",
    "security",
    null,
    everywhere.data.everywhere ? `Signed out everywhere (${n + 1} session${n ? "s" : ""})` : `Signed out everywhere else (${n} session${n === 1 ? "" : "s"})`,
  );
  if (everywhere.data.everywhere) await destroySession();
  else revalidatePath("/insurance-vendor/settings");
  return { ok: true, count: n };
}

/* ── Team ───────────────────────────────────────────────────── */

const tempPassword = () => randomBytes(9).toString("base64url");
type Assignable = Exclude<InsRole, "owner">;
const ASSIGNABLE = INS_ROLES.filter((r) => r !== "owner") as [Assignable, ...Assignable[]];
/** Everyone keeps the dashboard — it's where the portal sends people who lack a permission. */
const ALWAYS: InsPermission[] = ["dashboard.view"];

/** The plan's team-member limit (null = unlimited), from the insurerPlans content block. */
async function teamLimit(plan: string): Promise<{ limit: number | null; planName: string }> {
  const plans = (await getCatalog()).content.insurerPlans.plans;
  const p = plans.find((x) => x.id === plan) ?? insurerPlans.defaults.plans.find((x) => x.id === plan) ?? insurerPlans.defaults.plans[0];
  return { limit: p.members ?? null, planName: p.name };
}

async function activeMembers(vendorId: number) {
  const [{ n }] = await getDb()
    .select({ n: count() })
    .from(insMembers)
    .where(and(eq(insMembers.vendorId, vendorId), eq(insMembers.isActive, true)));
  return n;
}

/** Team actions: team.manage, and not while the company is suspended or rejected. */
async function teamAction(): Promise<InsurerContext | { ok: false; error: string }> {
  const ctx = await insurerAction("team.manage", { approved: false });
  if (isInsurerError(ctx)) return ctx;
  if (INS_PORTAL_BLOCKED.includes(ctx.vendor.status)) return { ok: false, error: "Team changes aren't available while your company's account is suspended or not approved." };
  return ctx;
}

/**
 * Who may change whom: never the owner, never yourself, only the owner manages administrators, and never someone
 * who holds access you don't (resetting their password would let you sign in as them).
 */
function guard(ctx: InsurerContext, target: { role: InsRole; userId: number; permissions: string[] | null }, nextRole?: InsRole) {
  if (target.role === "owner") return "The owner's access can't be changed or removed.";
  if (target.userId === ctx.user.id) return "You can't change your own access. Ask your company's owner.";
  const owner = ctx.member.role === "owner";
  if (!owner && (target.role === "admin" || nextRole === "admin")) return "Only the owner can manage administrators.";
  if (!owner && insPermissionsFor(target).some((p) => !ctx.can(p))) return "This person has access you don't have. Ask your company's owner to manage them.";
  return null;
}

/** Custom permissions: only ones the editor holds (no escalation), always including the dashboard. null = role defaults. */
function cleanPermissions(ctx: InsurerContext, role: InsRole, list: string[] | null): { perms: InsPermission[] | null; error?: string } {
  if (list === null) return { perms: null };
  const wanted = [...new Set([...ALWAYS, ...list.filter((p): p is InsPermission => p in INS_PERMISSIONS)])];
  const notMine = wanted.filter((p) => !ctx.can(p));
  if (notMine.length) return { perms: null, error: `You can't grant permissions you don't have yourself (${notMine.map((p) => INS_PERMISSIONS[p].toLowerCase()).join("; ")}).` };
  const defaults = INS_ROLE_PERMISSIONS[role];
  const same = wanted.length === defaults.length && defaults.every((p) => wanted.includes(p));
  return { perms: same ? null : ALL_INS_PERMISSIONS.filter((p) => wanted.includes(p)) };
}

const addSchema = z.object({
  name,
  email,
  mobile,
  role: z.enum(ASSIGNABLE, { error: "Choose a role" }),
});

export async function addInsMemberAction(input: unknown): Promise<ActionResult<{ password: string; email: string }>> {
  const ctx = await teamAction();
  if (isInsurerError(ctx)) return ctx;
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  if (v.role === "admin" && ctx.member.role !== "owner") return { ok: false, error: CHECK, fieldErrors: { role: "Only the owner can add administrators" } };
  const beyond = INS_ROLE_PERMISSIONS[v.role].filter((p) => !ctx.can(p));
  if (beyond.length) return { ok: false, error: CHECK, fieldErrors: { role: "This role has permissions you don't have yourself" } };
  if (!take(`ins-team-add:${ctx.vendor.id}`, 30, 60 * MINUTE)) return { ok: false, error: "You've added a lot of people in the last hour. Please try again later." };

  const [{ limit, planName }, n] = await Promise.all([teamLimit(ctx.vendor.plan), activeMembers(ctx.vendor.id)]);
  if (limit !== null && n >= limit) return { ok: false, error: `Your ${planName} plan includes ${limit} team accounts (including the owner). Deactivate someone or upgrade under Billing.` };

  const db = getDb();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, v.email));
  if (existing) return { ok: false, error: CHECK, fieldErrors: { email: "This email already has a MarchGear account. Each team member needs their own email address." } };

  const pw = tempPassword();
  const passwordHash = await hashPassword(pw);
  try {
    const created = await db.transaction(async (tx) => {
      const [u] = await tx.insert(users).values({ name: v.name, email: v.email, phone: v.mobile, role: "insurer", passwordHash });
      const [m] = await tx.insert(insMembers).values({ vendorId: ctx.vendor.id, userId: u.insertId, role: v.role });
      return { userId: u.insertId, memberId: m.insertId };
    });
    await logInsurerActivity(ctx.vendor.id, ctx.user.id, "create", "team", created.memberId, `Added ${v.name} as ${INS_ROLE_LABEL[v.role]}`);
    await notifyInsurer(ctx.vendor.id, {
      userId: created.userId,
      kind: "team",
      title: `Welcome to ${vendorName(ctx.vendor)} on MarchGear`,
      body: `${ctx.user.name} added you as ${INS_ROLE_LABEL[v.role]}. Change your temporary password under Settings → Account.`,
      href: "/insurance-vendor/settings",
    });
    revalidatePath("/insurance-vendor/settings");
    return { ok: true, password: pw, email: v.email };
  } catch (err) {
    if (isDuplicate(err)) return { ok: false, error: CHECK, fieldErrors: { email: "This email already has a MarchGear account." } };
    throw err;
  }
}

async function memberRow(ctx: InsurerContext, memberId: number) {
  const [row] = await getDb()
    .select({ m: insMembers, name: users.name, email: users.email })
    .from(insMembers)
    .innerJoin(users, eq(users.id, insMembers.userId))
    .where(and(eq(insMembers.id, memberId), eq(insMembers.vendorId, ctx.vendor.id)));
  return row;
}

const updateSchema = z.object({
  memberId: z.number().int().positive(),
  role: z.enum(ASSIGNABLE, { error: "Choose a role" }),
  permissions: z.array(z.string().max(40)).max(40).nullable(),
});

export async function updateInsMemberAccessAction(input: unknown): Promise<ActionResult> {
  const ctx = await teamAction();
  if (isInsurerError(ctx)) return ctx;
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const row = await memberRow(ctx, v.memberId);
  if (!row) return { ok: false, error: "That team member couldn't be found." };
  const denied = guard(ctx, row.m, v.role);
  if (denied) return { ok: false, error: denied };
  const { perms, error } = cleanPermissions(ctx, v.role, v.permissions);
  if (error) return { ok: false, error };
  if (perms === null && INS_ROLE_PERMISSIONS[v.role].some((p) => !ctx.can(p))) return { ok: false, error: "That role includes permissions you don't have yourself. Ask your company's owner." };

  await getDb().update(insMembers).set({ role: v.role, permissions: perms }).where(eq(insMembers.id, row.m.id));
  const before = insPermissionsFor(row.m);
  const after = insPermissionsFor({ role: v.role, permissions: perms });
  const changes = [
    row.m.role !== v.role ? `role ${INS_ROLE_LABEL[row.m.role]} → ${INS_ROLE_LABEL[v.role]}` : null,
    before.join() !== after.join() ? (perms ? `${after.length} custom permissions` : "permissions reset to the role's defaults") : null,
  ].filter(Boolean);
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "update", "team", row.m.id, `Changed access for ${row.name}${changes.length ? `: ${changes.join(", ")}` : ""}`);
  if (changes.length)
    await notifyInsurer(ctx.vendor.id, { userId: row.m.userId, kind: "team", title: "Your portal access changed", body: `${ctx.user.name} updated your access: ${changes.join(", ")}.`, href: "/insurance-vendor/settings" });
  revalidatePath("/insurance-vendor/settings");
  return { ok: true };
}

export async function setInsMemberActiveAction(input: unknown): Promise<ActionResult> {
  const ctx = await teamAction();
  if (isInsurerError(ctx)) return ctx;
  const parsed = z.object({ memberId: z.number().int().positive(), active: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "That team member couldn't be found." };
  const { memberId, active } = parsed.data;
  const row = await memberRow(ctx, memberId);
  if (!row) return { ok: false, error: "That team member couldn't be found." };
  const denied = guard(ctx, row.m);
  if (denied) return { ok: false, error: denied };
  if (row.m.isActive === active) return { ok: true };
  if (active) {
    const [{ limit, planName }, n] = await Promise.all([teamLimit(ctx.vendor.plan), activeMembers(ctx.vendor.id)]);
    if (limit !== null && n >= limit) return { ok: false, error: `Your ${planName} plan includes ${limit} team accounts. Deactivate someone or upgrade under Billing first.` };
  }
  await getDb().transaction(async (tx) => {
    await tx.update(insMembers).set({ isActive: active }).where(eq(insMembers.id, row.m.id));
    await tx.update(users).set({ isActive: active }).where(eq(users.id, row.m.userId));
  });
  // Deactivation signs them out everywhere, immediately.
  if (!active) await destroyAllSessions(row.m.userId);
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, active ? "activate" : "deactivate", "team", row.m.id, `${active ? "Reactivated" : "Deactivated"} ${row.name}${active ? "" : " and signed them out"}`);
  revalidatePath("/insurance-vendor/settings");
  return { ok: true };
}

export async function resetInsMemberPasswordAction(memberId: unknown): Promise<ActionResult<{ password: string; email: string }>> {
  const ctx = await teamAction();
  if (isInsurerError(ctx)) return ctx;
  const parsed = z.number().int().positive().safeParse(memberId);
  if (!parsed.success) return { ok: false, error: "That team member couldn't be found." };
  const row = await memberRow(ctx, parsed.data);
  if (!row) return { ok: false, error: "That team member couldn't be found." };
  const denied = guard(ctx, row.m);
  if (denied) return { ok: false, error: denied };
  if (!row.m.isActive) return { ok: false, error: "Reactivate this person before resetting their password." };
  if (!take(`ins-team-reset:${ctx.user.id}`, 20, 60 * MINUTE)) return { ok: false, error: TOO_MANY };
  const pw = tempPassword();
  await getDb()
    .update(users)
    .set({ passwordHash: await hashPassword(pw) })
    .where(eq(users.id, row.m.userId));
  await destroyAllSessions(row.m.userId);
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "reset", "team", row.m.id, `Reset the password for ${row.name} and signed them out`);
  return { ok: true, password: pw, email: row.email };
}
