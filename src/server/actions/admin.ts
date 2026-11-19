"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { and, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { LEAD_STATUS, REVIEW_STATUS, USER_ROLES, dealerReviews, leadNotes, leads, ownerReviews, subscribers, users } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { LEAD_STATUS_LABEL } from "@/lib/leads";
import { STAFF_ROLES, destroyAllSessions, hashPassword, requireStaff } from "@/server/auth";
import { expireCatalog } from "@/server/catalog";
import { email, invalid, mobile, name } from "@/server/validation";

/* ── Leads ──────────────────────────────────────────────────── */

const id = z.coerce.number().int().positive();

export async function updateLeadAction(leadId: unknown, input: unknown): Promise<ActionResult> {
  const me = await requireStaff();
  const parsed = z
    .object({ status: z.enum(LEAD_STATUS), assignedTo: z.union([id, z.literal("").transform(() => null), z.null()]) })
    .safeParse(input);
  const lid = id.safeParse(leadId);
  if (!parsed.success || !lid.success) return { ok: false, error: "Invalid update" };
  const db = getDb();
  const [lead] = await db.select().from(leads).where(eq(leads.id, lid.data));
  if (!lead) return { ok: false, error: "Lead not found" };

  const { status, assignedTo } = parsed.data;
  const notes: { kind: "status" | "assign"; body: string }[] = [];
  if (status !== lead.status) notes.push({ kind: "status", body: `Status changed from ${LEAD_STATUS_LABEL[lead.status]} to ${LEAD_STATUS_LABEL[status]}` });
  if ((assignedTo ?? null) !== lead.assignedTo) {
    // Only an active staff account can own a lead (an existing owner who was since disabled is left alone above).
    const [who] = assignedTo
      ? await db
          .select({ name: users.name })
          .from(users)
          .where(and(eq(users.id, assignedTo), inArray(users.role, STAFF_ROLES), eq(users.isActive, true)))
      : [];
    if (assignedTo && !who) return { ok: false, error: "Choose an active staff member as the owner." };
    notes.push({ kind: "assign", body: who ? `Assigned to ${who.name}` : "Unassigned" });
  }
  if (!notes.length) return { ok: true };
  await db.update(leads).set({ status, assignedTo: assignedTo ?? null }).where(eq(leads.id, lead.id));
  await db.insert(leadNotes).values(notes.map((n) => ({ ...n, leadId: lead.id, authorId: me.id })));
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function addLeadNoteAction(leadId: unknown, body: unknown): Promise<ActionResult> {
  const me = await requireStaff();
  const parsed = z.tuple([id, z.string().trim().min(1, "Write a note first").max(4000)]).safeParse([leadId, body]);
  if (!parsed.success) return invalid(parsed.error);
  await getDb().insert(leadNotes).values({ leadId: parsed.data[0], body: parsed.data[1], authorId: me.id, kind: "note" });
  revalidatePath(`/admin/leads/${parsed.data[0]}`);
  return { ok: true };
}

export async function deleteLeadAction(leadId: unknown): Promise<ActionResult> {
  await requireStaff(["admin"]);
  const lid = id.safeParse(leadId);
  if (!lid.success) return { ok: false, error: "Invalid lead" };
  await getDb().delete(leads).where(eq(leads.id, lid.data));
  revalidatePath("/admin", "layout");
  return { ok: true };
}

/* ── Reviews moderation ─────────────────────────────────────── */

export async function setReviewStatusAction(kind: unknown, reviewId: unknown, status: unknown): Promise<ActionResult> {
  await requireStaff();
  const parsed = z.tuple([z.enum(["owner", "dealer"]), z.string().min(1).max(64), z.enum(REVIEW_STATUS)]).safeParse([kind, reviewId, status]);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const [k, rid, st] = parsed.data;
  const db = getDb();
  if (k === "owner") await db.update(ownerReviews).set({ status: st }).where(eq(ownerReviews.id, rid));
  else await db.update(dealerReviews).set({ status: st }).where(eq(dealerReviews.id, rid));
  expireCatalog();
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function deleteReviewAction(kind: unknown, reviewId: unknown): Promise<ActionResult> {
  await requireStaff();
  const parsed = z.tuple([z.enum(["owner", "dealer"]), z.string().min(1).max(64)]).safeParse([kind, reviewId]);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const [k, rid] = parsed.data;
  const db = getDb();
  if (k === "owner") await db.delete(ownerReviews).where(eq(ownerReviews.id, rid));
  else await db.delete(dealerReviews).where(eq(dealerReviews.id, rid));
  expireCatalog();
  revalidatePath("/admin", "layout");
  return { ok: true };
}

/* ── Subscribers ────────────────────────────────────────────── */

export async function deleteSubscriberAction(subscriberId: unknown): Promise<ActionResult> {
  await requireStaff();
  const sid = id.safeParse(subscriberId);
  if (!sid.success) return { ok: false, error: "Invalid subscriber" };
  await getDb().delete(subscribers).where(eq(subscribers.id, sid.data));
  revalidatePath("/admin/subscribers");
  return { ok: true };
}

/* ── Users (admins only) ────────────────────────────────────── */

const tempPassword = () => randomBytes(9).toString("base64url");

export async function createStaffAction(input: unknown): Promise<ActionResult<{ id: number; password: string }>> {
  await requireStaff(["admin"]);
  const parsed = z.object({ name, email, role: z.enum(USER_ROLES) }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const db = getDb();
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, parsed.data.email));
  if (exists) return { ok: false, fieldErrors: { email: "An account with this email already exists." } };
  const pw = tempPassword();
  const [res] = await db.insert(users).values({ ...parsed.data, passwordHash: await hashPassword(pw) });
  revalidatePath("/admin/users");
  return { ok: true, id: res.insertId, password: pw };
}

export async function updateUserAction(userId: unknown, input: unknown): Promise<ActionResult> {
  const me = await requireStaff(["admin"]);
  const uid = id.safeParse(userId);
  const parsed = z
    .object({
      name,
      email,
      phone: z.union([z.literal("").transform(() => null), mobile]).nullable(),
      city: z.string().trim().max(64).nullable(),
      role: z.enum(USER_ROLES),
      isActive: z.boolean(),
    })
    .safeParse(input);
  if (!uid.success) return { ok: false, error: "Invalid user" };
  if (!parsed.success) return invalid(parsed.error);
  const db = getDb();
  if (uid.data === me.id && (parsed.data.role !== "admin" || !parsed.data.isActive))
    return { ok: false, error: "You can't remove your own admin access or disable your own account." };
  const [dupe] = await db.select({ id: users.id }).from(users).where(and(eq(users.email, parsed.data.email), ne(users.id, uid.data)));
  if (dupe) return { ok: false, fieldErrors: { email: "Another account uses this email." } };
  // mysql2 reports matched rows (FOUND_ROWS), so an unchanged save still counts as found.
  const [res] = await db.update(users).set(parsed.data).where(eq(users.id, uid.data));
  if (!res.affectedRows) return { ok: false, error: "This account no longer exists." };
  if (!parsed.data.isActive) await destroyAllSessions(uid.data);
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function resetUserPasswordAction(userId: unknown): Promise<ActionResult<{ password: string }>> {
  await requireStaff(["admin"]);
  const uid = id.safeParse(userId);
  if (!uid.success) return { ok: false, error: "Invalid user" };
  const pw = tempPassword();
  const [res] = await getDb()
    .update(users)
    .set({ passwordHash: await hashPassword(pw) })
    .where(eq(users.id, uid.data));
  if (!res.affectedRows) return { ok: false, error: "This account no longer exists." };
  await destroyAllSessions(uid.data);
  return { ok: true, password: pw };
}

export async function deleteUserAction(userId: unknown): Promise<ActionResult> {
  const me = await requireStaff(["admin"]);
  const uid = id.safeParse(userId);
  if (!uid.success) return { ok: false, error: "Invalid user" };
  if (uid.data === me.id) return { ok: false, error: "You can't delete your own account." };
  await getDb().delete(users).where(eq(users.id, uid.data));
  revalidatePath("/admin/users");
  return { ok: true };
}

