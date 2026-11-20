"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { partnerMembers, users } from "@/db/schema";
import { PARTNER_ROLES, type PartnerRole } from "@/db/enums";
import type { ActionResult } from "@/lib/action-result";
import { PARTNER_ROLE_LABEL } from "@/partner/labels";
import { ALL_PERMISSIONS, PERMISSIONS, ROLE_PERMISSIONS, permissionsFor, type Permission } from "@/partner/permissions";
import { planById } from "@/partner/plans";
import { destroyAllSessions, hashPassword } from "@/server/auth";
import { getCatalog } from "@/server/catalog";
import { isDuplicate } from "@/server/db-errors";
import { isActionError, partnerAction, type PartnerContext } from "@/server/partner/context";
import { logPartnerActivity, notifyPartner } from "@/server/partner/records";
import { email, invalid, mobile, name } from "@/server/validation";

/* The dealership's team: accounts, roles, custom permissions and access. Only members with staff.manage. */

const tempPassword = () => randomBytes(9).toString("base64url");
const ASSIGNABLE = PARTNER_ROLES.filter((r) => r !== "owner") as [Exclude<PartnerRole, "owner">, ...Exclude<PartnerRole, "owner">[]];
/** Everyone keeps the dashboard — it's where the portal sends people who lack a permission. */
const ALWAYS: Permission[] = ["dashboard.view"];

async function staffLimit(ctx: PartnerContext) {
  const plans = (await getCatalog()).content.partnerPlans.plans;
  const plan = plans.find((p) => p.id === ctx.partner.plan);
  const fallback = planById(ctx.partner.plan);
  return { limit: plan ? plan.staff : fallback.limits.staff, name: plan?.name ?? fallback.name };
}

async function activeMembers(partnerId: number) {
  const [{ n }] = await getDb()
    .select({ n: count() })
    .from(partnerMembers)
    .where(and(eq(partnerMembers.partnerId, partnerId), eq(partnerMembers.isActive, true)));
  return n;
}

/**
 * Who may change whom: never the owner, never yourself, only the owner manages administrators, and never someone
 * who holds access you don't (resetting their password would let you sign in as them and use it).
 */
function guard(ctx: PartnerContext, target: { role: PartnerRole; userId: number; permissions: string[] | null }, nextRole?: PartnerRole) {
  if (target.role === "owner") return "The dealer owner's access can't be changed.";
  if (target.userId === ctx.user.id) return "You can't change your own access. Ask the dealer owner.";
  const owner = ctx.member.role === "owner";
  if (!owner && (target.role === "admin" || nextRole === "admin")) return "Only the dealer owner can manage administrators.";
  if (!owner && permissionsFor(target).some((p) => !ctx.can(p))) return "This person has access you don't have. Ask the dealer owner to manage them.";
  return null;
}

/** Custom permissions: only ones the editor holds themselves (no escalation), always including the dashboard. */
function cleanPermissions(ctx: PartnerContext, role: PartnerRole, list: string[] | null): { perms: Permission[] | null; error?: string } {
  if (list === null) return { perms: null };
  const wanted = [...new Set([...ALWAYS, ...list.filter((p): p is Permission => p in PERMISSIONS)])];
  const notMine = wanted.filter((p) => !ctx.can(p));
  if (notMine.length) return { perms: null, error: `You can't grant permissions you don't have yourself (${notMine.map((p) => PERMISSIONS[p].toLowerCase()).join("; ")}).` };
  const defaults = ROLE_PERMISSIONS[role];
  const same = wanted.length === defaults.length && defaults.every((p) => wanted.includes(p));
  return { perms: same ? null : ALL_PERMISSIONS.filter((p) => wanted.includes(p)) };
}

const addSchema = z.object({
  name,
  email,
  mobile,
  role: z.enum(ASSIGNABLE, { error: "Choose a role" }),
});

export async function addStaffAction(input: unknown): Promise<ActionResult<{ password: string; email: string }>> {
  const ctx = await partnerAction("staff.manage");
  if (isActionError(ctx)) return ctx;
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  if (v.role === "admin" && ctx.member.role !== "owner") return { ok: false, fieldErrors: { role: "Only the dealer owner can add administrators" }, error: "Please check the highlighted fields." };
  // Default role permissions mustn't exceed the creator's own (e.g. an admin adding someone with billing).
  const beyond = ROLE_PERMISSIONS[v.role].filter((p) => !ctx.can(p));
  if (beyond.length) return { ok: false, fieldErrors: { role: "This role has permissions you don't have yourself" }, error: "Please check the highlighted fields." };

  const [{ limit, name: planName }, n] = await Promise.all([staffLimit(ctx), activeMembers(ctx.partner.id)]);
  if (limit !== null && n >= limit) return { ok: false, error: `Your ${planName} plan includes ${limit} team accounts (including the owner). Upgrade under Subscription or deactivate someone first.` };

  const db = getDb();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, v.email));
  if (existing) return { ok: false, fieldErrors: { email: "This email already has a MarchGear account. Each team member needs their own email address." }, error: "Please check the highlighted fields." };

  const password = tempPassword();
  const passwordHash = await hashPassword(password);
  try {
    const created = await db.transaction(async (tx) => {
      const [u] = await tx.insert(users).values({ name: v.name, email: v.email, phone: v.mobile, role: "dealer", passwordHash });
      const [m] = await tx.insert(partnerMembers).values({ partnerId: ctx.partner.id, userId: u.insertId, role: v.role });
      return { userId: u.insertId, memberId: m.insertId };
    });
    await logPartnerActivity(ctx.partner.id, ctx.user.id, "create", "staff", created.memberId, `Added ${v.name} as ${PARTNER_ROLE_LABEL[v.role]}`);
    await notifyPartner(ctx.partner.id, {
      userId: created.userId,
      kind: "staff",
      title: `Welcome to ${ctx.partner.tradeName || ctx.partner.legalName || "the dealership"} on MarchGear`,
      body: `${ctx.user.name} added you as ${PARTNER_ROLE_LABEL[v.role]}. Change your temporary password under Settings → Security.`,
      href: "/dealer/settings?tab=security",
    });
    revalidatePath("/dealer/staff");
    return { ok: true, password, email: v.email };
  } catch (err) {
    if (isDuplicate(err)) return { ok: false, fieldErrors: { email: "This email already has a MarchGear account." }, error: "Please check the highlighted fields." };
    throw err;
  }
}

const updateSchema = z.object({
  memberId: z.number().int().positive(),
  role: z.enum(ASSIGNABLE, { error: "Choose a role" }),
  permissions: z.array(z.string().max(40)).max(40).nullable(),
});

export async function updateStaffAccessAction(input: unknown): Promise<ActionResult> {
  const ctx = await partnerAction("staff.manage");
  if (isActionError(ctx)) return ctx;
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const db = getDb();
  const [row] = await db
    .select({ m: partnerMembers, name: users.name })
    .from(partnerMembers)
    .innerJoin(users, eq(users.id, partnerMembers.userId))
    .where(and(eq(partnerMembers.id, v.memberId), eq(partnerMembers.partnerId, ctx.partner.id)));
  if (!row) return { ok: false, error: "That team member couldn't be found." };
  const denied = guard(ctx, row.m, v.role);
  if (denied) return { ok: false, error: denied };
  const { perms, error } = cleanPermissions(ctx, v.role, v.permissions);
  if (error) return { ok: false, error };
  if (perms === null) {
    const beyond = ROLE_PERMISSIONS[v.role].filter((p) => !ctx.can(p));
    if (beyond.length) return { ok: false, error: "That role includes permissions you don't have yourself. Ask the dealer owner." };
  }

  await db.update(partnerMembers).set({ role: v.role, permissions: perms }).where(eq(partnerMembers.id, row.m.id));
  const before = permissionsFor(row.m);
  const after = permissionsFor({ role: v.role, permissions: perms });
  const changes = [
    row.m.role !== v.role ? `role ${PARTNER_ROLE_LABEL[row.m.role]} → ${PARTNER_ROLE_LABEL[v.role]}` : null,
    before.join() !== after.join() ? (perms ? `${after.length} custom permissions` : "permissions reset to role defaults") : null,
  ].filter(Boolean);
  await logPartnerActivity(ctx.partner.id, ctx.user.id, "update", "staff", row.m.id, `Changed access for ${row.name}${changes.length ? `: ${changes.join(", ")}` : ""}`);
  if (changes.length)
    await notifyPartner(ctx.partner.id, { userId: row.m.userId, kind: "staff", title: "Your portal access changed", body: `${ctx.user.name} updated your access: ${changes.join(", ")}.`, href: "/dealer/settings" });
  revalidatePath("/dealer/staff");
  return { ok: true };
}

export async function setStaffActiveAction(input: unknown): Promise<ActionResult> {
  const ctx = await partnerAction("staff.manage");
  if (isActionError(ctx)) return ctx;
  const parsed = z.object({ memberId: z.number().int().positive(), active: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "That team member couldn't be found." };
  const { memberId, active } = parsed.data;
  const db = getDb();
  const [row] = await db
    .select({ m: partnerMembers, name: users.name })
    .from(partnerMembers)
    .innerJoin(users, eq(users.id, partnerMembers.userId))
    .where(and(eq(partnerMembers.id, memberId), eq(partnerMembers.partnerId, ctx.partner.id)));
  if (!row) return { ok: false, error: "That team member couldn't be found." };
  const denied = guard(ctx, row.m);
  if (denied) return { ok: false, error: denied };
  if (row.m.isActive === active) return { ok: true };
  if (active) {
    const [{ limit, name: planName }, n] = await Promise.all([staffLimit(ctx), activeMembers(ctx.partner.id)]);
    if (limit !== null && n >= limit) return { ok: false, error: `Your ${planName} plan includes ${limit} team accounts. Upgrade under Subscription or deactivate someone first.` };
  }
  await db.transaction(async (tx) => {
    await tx.update(partnerMembers).set({ isActive: active }).where(eq(partnerMembers.id, row.m.id));
    await tx.update(users).set({ isActive: active }).where(eq(users.id, row.m.userId));
  });
  // Deactivation signs them out everywhere, immediately.
  if (!active) await destroyAllSessions(row.m.userId);
  await logPartnerActivity(ctx.partner.id, ctx.user.id, active ? "activate" : "deactivate", "staff", row.m.id, `${active ? "Reactivated" : "Deactivated"} ${row.name}${active ? "" : " and signed them out"}`);
  revalidatePath("/dealer/staff");
  return { ok: true };
}

export async function resetStaffPasswordAction(memberId: unknown): Promise<ActionResult<{ password: string; email: string }>> {
  const ctx = await partnerAction("staff.manage");
  if (isActionError(ctx)) return ctx;
  const parsed = z.number().int().positive().safeParse(memberId);
  if (!parsed.success) return { ok: false, error: "That team member couldn't be found." };
  const db = getDb();
  const [row] = await db
    .select({ m: partnerMembers, name: users.name, email: users.email })
    .from(partnerMembers)
    .innerJoin(users, eq(users.id, partnerMembers.userId))
    .where(and(eq(partnerMembers.id, parsed.data), eq(partnerMembers.partnerId, ctx.partner.id)));
  if (!row) return { ok: false, error: "That team member couldn't be found." };
  const denied = guard(ctx, row.m);
  if (denied) return { ok: false, error: denied };
  if (!row.m.isActive) return { ok: false, error: "Reactivate this person before resetting their password." };
  const password = tempPassword();
  await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, row.m.userId));
  await destroyAllSessions(row.m.userId);
  await logPartnerActivity(ctx.partner.id, ctx.user.id, "reset", "staff", row.m.id, `Reset the password for ${row.name} and signed them out`);
  return { ok: true, password, email: row.email };
}
