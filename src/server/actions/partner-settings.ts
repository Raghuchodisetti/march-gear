"use server";

import { z } from "zod";
import { and, eq, inArray, ne, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { partnerTicketMessages, partnerTickets, partners, sessions, users } from "@/db/schema";
import { DEFAULT_PREFERENCES, type ActionResult, type UserPreferences } from "@/lib/action-result";
import { PARTNER_STATUS_LABEL } from "@/partner/labels";
import { currentSessionId as sessionIdIn, hashPassword, verifyPassword } from "@/server/auth";
import { isDuplicate } from "@/server/db-errors";
import { isActionError, partnerAction } from "@/server/partner/context";
import { logPartnerActivity, notifyPartner, recordApproval, reference } from "@/server/partner/records";
import { MINUTE, reset, take } from "@/server/rate-limit";
import { invalid, mobile, name, password } from "@/server/validation";
import { DEACTIVATION_SUBJECT } from "@/components/portal/settings/shared";
import { ALL_CATEGORIES, UNMUTABLE, type DealerNotificationPrefs, type NotificationCategory } from "@/components/portal/notifications/categories";

/* The signed-in person's own account: details, password, sessions, notification preferences —
   and the owner's request to deactivate the dealership. Available before approval too. */

const TOO_MANY = "Too many attempts. Please wait 15 minutes and try again.";

/** This browser's dealer-portal session id (sessions store the SHA-256 of the cookie token). */
const currentSessionId = () => sessionIdIn("dealer");

export async function updateAccountAction(input: unknown): Promise<ActionResult> {
  const ctx = await partnerAction(undefined, { approved: false });
  if (isActionError(ctx)) return ctx;
  const parsed = z.object({ name, mobile }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const db = getDb();
  await db.update(users).set({ name: v.name, phone: v.mobile }).where(eq(users.id, ctx.user.id));
  // The owner is the application's primary contact — keep both in step.
  if (ctx.partner.ownerUserId === ctx.user.id) {
    const [p] = await db.select({ application: partners.application }).from(partners).where(eq(partners.id, ctx.partner.id));
    const prev = p.application.personal;
    await db
      .update(partners)
      .set({ application: { ...p.application, personal: { ...prev, fullName: v.name, mobile: v.mobile, mobileVerified: v.mobile === prev.mobile ? prev.mobileVerified : false } } })
      .where(eq(partners.id, ctx.partner.id));
  }
  await logPartnerActivity(ctx.partner.id, ctx.user.id, "update", "account", ctx.user.id, "Updated their account details");
  revalidatePath("/dealer", "layout");
  return { ok: true };
}

const passwordSchema = z
  .object({ current: z.string().min(1, "Enter your current password").max(200), next: password, confirm: z.string() })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "The passwords don't match" })
  .refine((v) => v.next !== v.current, { path: ["next"], message: "Choose a password you haven't used here" });

/** Same rules as the customer account: verify the current password, then sign out every other device. */
export async function changeDealerPasswordAction(input: unknown): Promise<ActionResult<{ signedOut: number }>> {
  const ctx = await partnerAction(undefined, { approved: false });
  if (isActionError(ctx)) return ctx;
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!take(`password:${ctx.user.id}`, 8, 15 * MINUTE)) return { ok: false, error: TOO_MANY };
  const db = getDb();
  const [u] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, ctx.user.id));
  if (!(await verifyPassword(parsed.data.current, u?.hash))) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: { current: "That password is incorrect." } };
  await db.update(users).set({ passwordHash: await hashPassword(parsed.data.next) }).where(eq(users.id, ctx.user.id));
  reset(`password:${ctx.user.id}`);
  const current = await currentSessionId();
  const others = await db.select({ id: sessions.id }).from(sessions).where(and(eq(sessions.userId, ctx.user.id), current ? ne(sessions.id, current) : undefined));
  if (others.length) await db.delete(sessions).where(and(eq(sessions.userId, ctx.user.id), inArray(sessions.id, others.map((s) => s.id))));
  await logPartnerActivity(ctx.partner.id, ctx.user.id, "update", "security", ctx.user.id, "Changed their password and signed out other devices");
  return { ok: true, signedOut: others.length };
}

export async function revokeSessionAction(id: unknown): Promise<ActionResult> {
  const ctx = await partnerAction(undefined, { approved: false });
  if (isActionError(ctx)) return ctx;
  const parsed = z.string().regex(/^[a-f0-9]{64}$/).safeParse(id);
  if (!parsed.success) return { ok: false, error: "That session couldn't be found." };
  const current = await currentSessionId();
  if (parsed.data === current) return { ok: false, error: "That's this browser. Use Sign out in the menu instead." };
  const db = getDb();
  const where = and(eq(sessions.id, parsed.data), eq(sessions.userId, ctx.user.id));
  const [row] = await db.select({ id: sessions.id }).from(sessions).where(where);
  if (!row) return { ok: false, error: "That session has already ended." };
  await db.delete(sessions).where(where);
  await logPartnerActivity(ctx.partner.id, ctx.user.id, "revoke", "security", null, "Signed out a session on another device");
  revalidatePath("/dealer/settings");
  return { ok: true };
}

export async function signOutOtherSessionsAction(): Promise<ActionResult<{ count: number }>> {
  const ctx = await partnerAction(undefined, { approved: false });
  if (isActionError(ctx)) return ctx;
  const current = await currentSessionId();
  const db = getDb();
  const others = await db.select({ id: sessions.id }).from(sessions).where(and(eq(sessions.userId, ctx.user.id), current ? ne(sessions.id, current) : undefined));
  if (others.length) await db.delete(sessions).where(and(eq(sessions.userId, ctx.user.id), inArray(sessions.id, others.map((s) => s.id))));
  await logPartnerActivity(ctx.partner.id, ctx.user.id, "revoke", "security", null, `Signed out everywhere else (${others.length} session${others.length === 1 ? "" : "s"})`);
  revalidatePath("/dealer/settings");
  return { ok: true, count: others.length };
}

export async function saveNotificationPrefsAction(input: unknown): Promise<ActionResult> {
  const ctx = await partnerAction(undefined, { approved: false });
  if (isActionError(ctx)) return ctx;
  const parsed = z.object({ muted: z.array(z.enum(ALL_CATEGORIES as [NotificationCategory, ...NotificationCategory[]])).max(ALL_CATEGORIES.length) }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const db = getDb();
  const [u] = await db.select({ preferences: users.preferences }).from(users).where(eq(users.id, ctx.user.id));
  const dealer: DealerNotificationPrefs = { muted: [...new Set(parsed.data.muted)].filter((c) => !UNMUTABLE.includes(c)) };
  // Dealer preferences sit beside the customer ones in the same JSON document.
  const preferences = { ...(u?.preferences ?? DEFAULT_PREFERENCES), dealer } as UserPreferences;
  await db.update(users).set({ preferences }).where(eq(users.id, ctx.user.id));
  await logPartnerActivity(ctx.partner.id, ctx.user.id, "update", "preferences", ctx.user.id, dealer.muted.length ? `Muted ${dealer.muted.length} notification categor${dealer.muted.length === 1 ? "y" : "ies"}` : "Unmuted all notification categories");
  revalidatePath("/dealer", "layout");
  return { ok: true };
}

/** The owner asks MarchGear to close the dealership. Nothing is switched off here — staff process it. */
export async function requestDeactivationAction(input: unknown): Promise<ActionResult<{ ticketId: number; reference: string }>> {
  const ctx = await partnerAction(undefined, { approved: false });
  if (isActionError(ctx)) return ctx;
  if (ctx.partner.ownerUserId !== ctx.user.id) return { ok: false, error: "Only the dealer owner can ask to deactivate the dealership." };
  const parsed = z
    .object({
      reason: z.string().trim().min(10, "Tell us why (at least 10 characters)").max(2000),
      confirm: z.literal(true, { error: "Confirm that you understand what happens next" }),
    })
    .safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (ctx.partner.status === "deactivated") return { ok: false, error: "This dealership is already deactivated." };
  const db = getDb();
  const [open] = await db
    .select({ id: partnerTickets.id, reference: partnerTickets.reference })
    .from(partnerTickets)
    .where(and(eq(partnerTickets.partnerId, ctx.partner.id), eq(partnerTickets.subject, DEACTIVATION_SUBJECT), notInArray(partnerTickets.status, ["resolved", "closed"])))
    .limit(1);
  if (open) return { ok: false, error: `You already asked for this — follow ticket ${open.reference} in Support.` };

  const body = `The dealer owner (${ctx.user.name}, ${ctx.user.email}) asked MarchGear to deactivate ${ctx.partner.tradeName || ctx.partner.legalName || ctx.partner.reference} (${ctx.partner.reference}, currently ${PARTNER_STATUS_LABEL[ctx.partner.status].toLowerCase()}).\n\nReason:\n${parsed.data.reason}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const ref = reference("TKT");
    try {
      const ticketId = await db.transaction(async (tx) => {
        const [t] = await tx.insert(partnerTickets).values({ partnerId: ctx.partner.id, reference: ref, subject: DEACTIVATION_SUBJECT, category: "account", priority: "high", status: "open", createdBy: ctx.user.id });
        await tx.insert(partnerTicketMessages).values({ ticketId: t.insertId, userId: ctx.user.id, fromStaff: false, body, attachments: [] });
        return t.insertId;
      });
      await recordApproval({ partnerId: ctx.partner.id, target: "partner", targetId: ctx.partner.id, action: "deactivation_requested", fromStatus: ctx.partner.status, remarks: parsed.data.reason, actorUserId: ctx.user.id, actorSide: "dealer" });
      await notifyPartner(ctx.partner.id, { userId: ctx.user.id, kind: "account", title: "Deactivation request sent to MarchGear", body: `Ticket ${ref}. Your dealership stays live until our team confirms with you.`, href: `/dealer/support/${ticketId}` });
      await logPartnerActivity(ctx.partner.id, ctx.user.id, "request", "partner", ctx.partner.id, `Asked MarchGear to deactivate the dealership (ticket ${ref})`);
      revalidatePath("/dealer", "layout");
      return { ok: true, ticketId, reference: ref };
    } catch (err) {
      if (!isDuplicate(err)) throw err;
    }
  }
  return { ok: false, error: "Couldn't send the request. Please try again." };
}
