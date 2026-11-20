"use server";

import { createHash, randomBytes, randomInt } from "node:crypto";
import { z } from "zod";
import { and, eq, inArray, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import {
  LEAD_STATUS,
  LEAD_TYPES,
  REVIEW_STATUS,
  USER_ROLES,
  cars,
  brands,
  dealerReviews,
  dealers,
  leadNotes,
  leads,
  ownerReviews,
  sessions,
  subscribers,
  users,
  type LeadStatus,
  type LeadType,
} from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { LEAD_STATUS_LABEL, LEAD_TYPE_LABEL } from "@/lib/leads";
import { DEALER_VISITS, LEAD_CHANNELS } from "@/components/admin/options";
import { audit } from "@/server/audit";
import { SESSION_COOKIE, STAFF_ROLES, destroyAllSessions, hashPassword, requireStaff, type SessionUser } from "@/server/auth";
import { expireCatalog } from "@/server/catalog";
import { refreshPartnerDealerRating } from "@/server/partner/public-sync";
import { isIndianState } from "@/data/states";
import { isDuplicate, isMissingParent } from "@/server/db-errors";
import { email, invalid, isoDate, mobile, todayISO } from "@/server/validation";

/** A name staff type in for someone else (the shared `name` rule speaks to the person themselves). */
const personName = (message: string) => z.string({ error: message }).trim().min(2, message).max(120, "That name is too long");

/* ── Leads ──────────────────────────────────────────────────── */

const id = z.coerce.number().int().positive();
/** An owner picked in a select: a staff id, or "" / null for nobody. */
const ownerId = z.union([id, z.literal("").transform(() => null), z.null()]);
const NOT_STAFF = "Choose an active staff member as the owner.";

/** Active staff accounts among the given ids, by id. Only these can own a lead. */
async function activeStaffNames(ids: number[]) {
  if (!ids.length) return new Map<number, string>();
  const rows = await getDb()
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(inArray(users.id, ids), inArray(users.role, STAFF_ROLES), eq(users.isActive, true)));
  return new Map(rows.map((r) => [r.id, r.name]));
}

type LeadRef = { id: number; reference: string; status: LeadStatus; assignedTo: number | null };
type LeadPatch = { status?: LeadStatus; assignedTo?: number | null };

/**
 * Applies a status and/or owner change to each lead, writing a timeline note and an
 * activity-log entry per lead for whatever actually changed. Returns how many changed.
 */
async function applyLeadChanges(me: SessionUser, rows: LeadRef[], patch: LeadPatch, ownerName: string | null) {
  const db = getDb();
  const notes: { leadId: number; authorId: number; kind: "status" | "assign"; body: string }[] = [];
  const log: { action: "status" | "assign"; leadId: number; summary: string }[] = [];
  const changed: number[] = [];
  for (const lead of rows) {
    let touched = false;
    if (patch.status && patch.status !== lead.status) {
      const from = LEAD_STATUS_LABEL[lead.status];
      const to = LEAD_STATUS_LABEL[patch.status];
      notes.push({ leadId: lead.id, authorId: me.id, kind: "status", body: `Status changed from ${from} to ${to}` });
      log.push({ action: "status", leadId: lead.id, summary: `Changed ${lead.reference} from ${from} to ${to}` });
      touched = true;
    }
    if (patch.assignedTo !== undefined && patch.assignedTo !== lead.assignedTo) {
      notes.push({ leadId: lead.id, authorId: me.id, kind: "assign", body: ownerName ? `Assigned to ${ownerName}` : "Unassigned" });
      log.push({ action: "assign", leadId: lead.id, summary: ownerName ? `Assigned ${lead.reference} to ${ownerName}` : `Unassigned ${lead.reference}` });
      touched = true;
    }
    if (touched) changed.push(lead.id);
  }
  if (!changed.length) return 0;
  const set: LeadPatch = {};
  if (patch.status) set.status = patch.status;
  if (patch.assignedTo !== undefined) set.assignedTo = patch.assignedTo;
  await db.update(leads).set(set).where(inArray(leads.id, changed));
  await db.insert(leadNotes).values(notes);
  for (const entry of log) await audit(me.id, entry.action, "lead", entry.leadId, entry.summary);
  return changed.length;
}

const leadRefColumns = { id: leads.id, reference: leads.reference, status: leads.status, assignedTo: leads.assignedTo };

export async function updateLeadAction(leadId: unknown, input: unknown): Promise<ActionResult> {
  const me = await requireStaff();
  const parsed = z.object({ status: z.enum(LEAD_STATUS), assignedTo: ownerId }).safeParse(input);
  const lid = id.safeParse(leadId);
  if (!parsed.success || !lid.success) return { ok: false, error: "Invalid update" };
  const [lead] = await getDb().select(leadRefColumns).from(leads).where(eq(leads.id, lid.data));
  if (!lead) return { ok: false, error: "Lead not found" };

  const { status, assignedTo } = parsed.data;
  let ownerName: string | null = null;
  // Only an active staff account can become the owner (an existing owner who was since disabled is left alone).
  if (assignedTo && assignedTo !== lead.assignedTo) {
    ownerName = (await activeStaffNames([assignedTo])).get(assignedTo) ?? null;
    if (!ownerName) return { ok: false, error: NOT_STAFF };
  }
  const n = await applyLeadChanges(me, [lead], { status, assignedTo }, ownerName);
  if (n) revalidatePath("/admin", "layout");
  return { ok: true };
}

const bulkIds = z.array(id).min(1, "Select at least one lead").max(100, "Select at most 100 leads at a time");
const bulkChange = z.discriminatedUnion("op", [
  z.object({ op: z.literal("status"), status: z.enum(LEAD_STATUS) }),
  z.object({ op: z.literal("assign"), assignedTo: ownerId }),
]);

/** Sets the status or the owner of several leads at once. */
export async function bulkUpdateLeadsAction(leadIds: unknown, change: unknown): Promise<ActionResult<{ changed: number }>> {
  const me = await requireStaff();
  const ids = bulkIds.safeParse(leadIds);
  const parsed = bulkChange.safeParse(change);
  if (!ids.success) return { ok: false, error: ids.error.issues[0]?.message ?? "Invalid selection" };
  if (!parsed.success) return { ok: false, error: "Choose what to change." };
  const rows = await getDb().select(leadRefColumns).from(leads).where(inArray(leads.id, [...new Set(ids.data)]));
  if (!rows.length) return { ok: false, error: "These leads no longer exist." };

  let ownerName: string | null = null;
  const c = parsed.data;
  if (c.op === "assign" && c.assignedTo) {
    ownerName = (await activeStaffNames([c.assignedTo])).get(c.assignedTo) ?? null;
    if (!ownerName) return { ok: false, error: NOT_STAFF };
  }
  const changed = await applyLeadChanges(me, rows, c.op === "status" ? { status: c.status } : { assignedTo: c.assignedTo }, ownerName);
  if (changed) revalidatePath("/admin", "layout");
  return { ok: true, changed };
}

export async function bulkDeleteLeadsAction(leadIds: unknown): Promise<ActionResult<{ deleted: number }>> {
  const me = await requireStaff(["admin"]);
  const ids = bulkIds.safeParse(leadIds);
  if (!ids.success) return { ok: false, error: ids.error.issues[0]?.message ?? "Invalid selection" };
  const db = getDb();
  const rows = await db.select({ id: leads.id, reference: leads.reference, name: leads.name }).from(leads).where(inArray(leads.id, [...new Set(ids.data)]));
  if (!rows.length) return { ok: true, deleted: 0 };
  await db.delete(leads).where(
    inArray(
      leads.id,
      rows.map((r) => r.id),
    ),
  );
  for (const r of rows) await audit(me.id, "delete", "lead", r.id, `Deleted lead ${r.reference}${r.name ? ` (${r.name})` : ""}`);
  revalidatePath("/admin", "layout");
  return { ok: true, deleted: rows.length };
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const leadReference = (type: LeadType) =>
  `${type.startsWith("pdi") ? "PDI" : "MG"}-${Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")}`;
/** Blank (after trimming) becomes null; anything else must pass the rule. */
const blankOr = <T extends z.ZodType>(rule: T) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.union([z.literal("").transform(() => null), rule]));
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .default("")
    .transform((v) => v || null);

const newLeadSchema = z
  .object({
    type: z.enum(LEAD_TYPES, { error: "Choose the type of request" }),
    channel: z.enum(LEAD_CHANNELS, { error: "Choose how they reached us" }),
    name: z.string({ error: "Enter the customer's name" }).trim().min(2, "Enter the customer's name").max(120, "That name is too long"),
    phone: blankOr(mobile),
    email: blankOr(email),
    city: optional(64),
    subject: optional(200),
    message: optional(4000),
    status: z.enum(LEAD_STATUS),
    assignedTo: ownerId,
  })
  .superRefine((v, ctx) => {
    if (!v.phone && !v.email) ctx.addIssue({ code: "custom", path: ["phone"], message: "Add a mobile number or an email address" });
  });

/** A lead taken by phone, walk-in or another channel the website doesn't see. */
export async function createLeadAction(input: unknown): Promise<ActionResult<{ id: number; reference: string }>> {
  const me = await requireStaff();
  const parsed = newLeadSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { channel, assignedTo, ...lead } = parsed.data;
  const ownerName = assignedTo ? ((await activeStaffNames([assignedTo])).get(assignedTo) ?? null) : null;
  if (assignedTo && !ownerName) return { ok: false, fieldErrors: { assignedTo: NOT_STAFF } };

  const db = getDb();
  for (let attempt = 0; attempt < 3; attempt++) {
    const reference = leadReference(lead.type);
    try {
      const [res] = await db.insert(leads).values({ ...lead, reference, assignedTo, details: { channel }, source: `Admin panel — added by ${me.name}` });
      const leadId = res.insertId;
      await db.insert(leadNotes).values([
        { leadId, authorId: me.id, kind: "status", body: `Added by ${me.name} (${channel.toLowerCase()}) as ${LEAD_STATUS_LABEL[lead.status]}` },
        ...(ownerName ? [{ leadId, authorId: me.id, kind: "assign" as const, body: `Assigned to ${ownerName}` }] : []),
      ]);
      await audit(
        me.id,
        "create",
        "lead",
        leadId,
        `Added ${LEAD_TYPE_LABEL[lead.type].toLowerCase()} lead ${reference} for ${lead.name} (${channel.toLowerCase()})${ownerName ? `, assigned to ${ownerName}` : ""}`,
      );
      revalidatePath("/admin", "layout");
      return { ok: true, id: leadId, reference };
    } catch (err) {
      // Retry only on a (very unlikely) duplicate reference.
      if (!isDuplicate(err)) throw err;
    }
  }
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function addLeadNoteAction(leadId: unknown, body: unknown): Promise<ActionResult> {
  const me = await requireStaff();
  const parsed = z.tuple([id, z.string().trim().min(1, "Write a note first").max(4000)]).safeParse([leadId, body]);
  if (!parsed.success) return invalid(parsed.error);
  const db = getDb();
  const [lead] = await db.select({ reference: leads.reference }).from(leads).where(eq(leads.id, parsed.data[0]));
  if (!lead) return { ok: false, error: "This lead no longer exists." };
  await db.insert(leadNotes).values({ leadId: parsed.data[0], body: parsed.data[1], authorId: me.id, kind: "note" });
  const excerpt = parsed.data[1].replace(/\s+/g, " ");
  await audit(me.id, "note", "lead", parsed.data[0], `Added a note to ${lead.reference}: “${excerpt.length > 80 ? `${excerpt.slice(0, 79)}…` : excerpt}”`);
  revalidatePath(`/admin/leads/${parsed.data[0]}`);
  return { ok: true };
}

export async function deleteLeadAction(leadId: unknown): Promise<ActionResult> {
  const me = await requireStaff(["admin"]);
  const lid = id.safeParse(leadId);
  if (!lid.success) return { ok: false, error: "Invalid lead" };
  const db = getDb();
  const [lead] = await db.select({ reference: leads.reference, name: leads.name }).from(leads).where(eq(leads.id, lid.data));
  if (!lead) return { ok: true };
  await db.delete(leads).where(eq(leads.id, lid.data));
  await audit(me.id, "delete", "lead", lid.data, `Deleted lead ${lead.reference}${lead.name ? ` (${lead.name})` : ""}`);
  revalidatePath("/admin", "layout");
  return { ok: true };
}

/* ── Reviews moderation ─────────────────────────────────────── */

const reviewKind = z.enum(["owner", "dealer"]);
const reviewId = z.string().min(1).max(64);
const REVIEW_GONE = { ok: false, error: "This review no longer exists." } as const;
const STATUS_VERB: Record<(typeof REVIEW_STATUS)[number], string> = { approved: "Published", rejected: "Hid", pending: "Moved back to pending" };

/** Title and what the review is about, for activity-log summaries. */
async function reviewLabel(kind: "owner" | "dealer", rid: string) {
  const db = getDb();
  if (kind === "owner") {
    const [r] = await db
      .select({ title: ownerReviews.title, name: ownerReviews.name, about: cars.name, brand: brands.name })
      .from(ownerReviews)
      .leftJoin(cars, eq(cars.slug, ownerReviews.carSlug))
      .leftJoin(brands, eq(brands.slug, cars.brand))
      .where(eq(ownerReviews.id, rid));
    return r && { ...r, about: [r.brand, r.about].filter(Boolean).join(" ") };
  }
  const [r] = await db
    .select({ title: dealerReviews.title, name: dealerReviews.name, about: dealers.name })
    .from(dealerReviews)
    .leftJoin(dealers, eq(dealers.id, dealerReviews.dealerId))
    .where(eq(dealerReviews.id, rid));
  return r;
}

const reviewEntity = (k: "owner" | "dealer") => (k === "owner" ? "owner_review" : "dealer_review");

/** The showroom a dealer review belongs to (for partner rating refreshes). */
async function dealerOfReview(rid: string) {
  const [r] = await getDb().select({ dealerId: dealerReviews.dealerId }).from(dealerReviews).where(eq(dealerReviews.id, rid));
  return r?.dealerId ?? null;
}

export async function setReviewStatusAction(kind: unknown, reviewKey: unknown, status: unknown): Promise<ActionResult> {
  const me = await requireStaff();
  const parsed = z.tuple([reviewKind, reviewId, z.enum(REVIEW_STATUS)]).safeParse([kind, reviewKey, status]);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const [k, rid, st] = parsed.data;
  const label = await reviewLabel(k, rid);
  if (!label) return REVIEW_GONE;
  const db = getDb();
  if (k === "owner") await db.update(ownerReviews).set({ status: st }).where(eq(ownerReviews.id, rid));
  else {
    await db.update(dealerReviews).set({ status: st }).where(eq(dealerReviews.id, rid));
    await refreshPartnerDealerRating(await dealerOfReview(rid));
  }
  await audit(me.id, "status", reviewEntity(k), rid, `${STATUS_VERB[st]} ${k} review “${label.title}”${label.about ? ` on ${label.about}` : ""}`);
  expireCatalog();
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function deleteReviewAction(kind: unknown, reviewKey: unknown): Promise<ActionResult> {
  const me = await requireStaff();
  const parsed = z.tuple([reviewKind, reviewId]).safeParse([kind, reviewKey]);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const [k, rid] = parsed.data;
  const label = await reviewLabel(k, rid);
  if (!label) return { ok: true };
  const db = getDb();
  if (k === "owner") await db.delete(ownerReviews).where(eq(ownerReviews.id, rid));
  else {
    const dealerId = await dealerOfReview(rid);
    await db.delete(dealerReviews).where(eq(dealerReviews.id, rid));
    await refreshPartnerDealerRating(dealerId);
  }
  await audit(me.id, "delete", reviewEntity(k), rid, `Deleted ${k} review “${label.title}” by ${label.name}${label.about ? ` on ${label.about}` : ""}`);
  expireCatalog();
  revalidatePath("/admin", "layout");
  return { ok: true };
}

const reviewText = {
  title: z.string().trim().min(4, "Add a short headline").max(200),
  body: z.string().trim().min(10, "Write at least 10 characters").max(5000),
  rating: z.number({ error: "Give a rating" }).int().min(1, "Give a rating from 1 to 5").max(5, "Give a rating from 1 to 5"),
};
const visit = z.enum(DEALER_VISITS, { error: "Choose the visit type" });

/** Staff corrections to a review's wording or rating (typos, personal details, wrong star count). */
export async function updateReviewAction(kind: unknown, reviewKey: unknown, input: unknown): Promise<ActionResult> {
  const me = await requireStaff();
  const key = z.tuple([reviewKind, reviewId]).safeParse([kind, reviewKey]);
  if (!key.success) return { ok: false, error: "Invalid request" };
  const [k, rid] = key.data;
  const parsed = (k === "owner" ? z.object(reviewText) : z.object({ ...reviewText, visit })).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const db = getDb();
  const [res] =
    k === "owner"
      ? await db.update(ownerReviews).set(parsed.data).where(eq(ownerReviews.id, rid))
      : await db.update(dealerReviews).set(parsed.data).where(eq(dealerReviews.id, rid));
  // mysql2 reports matched rows, so an unchanged save still counts as found.
  if (!res.affectedRows) return REVIEW_GONE;
  if (k === "dealer") await refreshPartnerDealerRating(await dealerOfReview(rid));
  const label = await reviewLabel(k, rid);
  await audit(me.id, "update", reviewEntity(k), rid, `Edited ${k} review “${parsed.data.title}”${label?.about ? ` on ${label.about}` : ""}`);
  expireCatalog();
  revalidatePath("/admin", "layout");
  return { ok: true };
}

const dealerReviewSchema = z.object({
  dealerId: z.string({ error: "Choose a showroom" }).trim().min(1, "Choose a showroom").max(64),
  name: personName("Enter the customer's name"),
  visit,
  date: isoDate.refine((d) => d <= todayISO(), "The visit can't be in the future"),
  ...reviewText,
  status: z.enum(REVIEW_STATUS).default("approved"),
});

/** A dealer review collected offline (feedback card, phone survey) and entered by staff. */
export async function createDealerReviewAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const me = await requireStaff();
  const parsed = dealerReviewSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const db = getDb();
  const [dealer] = await db.select({ name: dealers.name }).from(dealers).where(eq(dealers.id, parsed.data.dealerId));
  if (!dealer) return { ok: false, fieldErrors: { dealerId: "Choose a showroom" } };
  const rid = `dr-${Date.now().toString(36)}${randomInt(36 ** 3).toString(36).padStart(3, "0")}`;
  try {
    await db.insert(dealerReviews).values({ ...parsed.data, id: rid });
  } catch (err) {
    if (isMissingParent(err)) return { ok: false, fieldErrors: { dealerId: "That showroom no longer exists — choose another." } };
    throw err;
  }
  await refreshPartnerDealerRating(parsed.data.dealerId);
  await audit(me.id, "create", "dealer_review", rid, `Added dealer review “${parsed.data.title}” by ${parsed.data.name} on ${dealer.name}`);
  expireCatalog();
  revalidatePath("/admin", "layout");
  return { ok: true, id: rid };
}

/* ── Subscribers ────────────────────────────────────────────── */

export async function deleteSubscriberAction(subscriberId: unknown): Promise<ActionResult> {
  const me = await requireStaff();
  const sid = id.safeParse(subscriberId);
  if (!sid.success) return { ok: false, error: "Invalid subscriber" };
  const db = getDb();
  const [sub] = await db.select({ email: subscribers.email }).from(subscribers).where(eq(subscribers.id, sid.data));
  if (!sub) return { ok: true };
  await db.delete(subscribers).where(eq(subscribers.id, sid.data));
  await audit(me.id, "delete", "subscriber", sid.data, `Removed subscriber ${sub.email}`);
  revalidatePath("/admin/subscribers");
  return { ok: true };
}

/* ── Users (admins only) ────────────────────────────────────── */

const tempPassword = () => randomBytes(9).toString("base64url");
const ROLE_NAME: Record<(typeof USER_ROLES)[number], string> = { customer: "customer", editor: "editor", admin: "admin", dealer: "dealer partner", insurer: "insurance vendor" };
/** Roles staff can hand out here; dealer accounts come from dealer registration. */
const ASSIGNABLE_ROLES = ["customer", "editor", "admin"] as const;

export async function createStaffAction(input: unknown): Promise<ActionResult<{ id: number; password: string }>> {
  const me = await requireStaff(["admin"]);
  const parsed = z.object({ name: personName("Enter their name"), email, role: z.enum(ASSIGNABLE_ROLES) }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const db = getDb();
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, parsed.data.email));
  if (exists) return { ok: false, fieldErrors: { email: "An account with this email already exists." } };
  const pw = tempPassword();
  const [res] = await db.insert(users).values({ ...parsed.data, passwordHash: await hashPassword(pw) });
  await audit(me.id, "create", "user", res.insertId, `Created ${ROLE_NAME[parsed.data.role]} account for ${parsed.data.name} (${parsed.data.email})`);
  revalidatePath("/admin/users");
  return { ok: true, id: res.insertId, password: pw };
}

export async function updateUserAction(userId: unknown, input: unknown): Promise<ActionResult> {
  const me = await requireStaff(["admin"]);
  const uid = id.safeParse(userId);
  const parsed = z
    .object({
      name: personName("Enter their name"),
      email,
      phone: z.union([z.literal("").transform(() => null), mobile]).nullable(),
      state: z
        .string()
        .nullish()
        .transform((v) => v || null)
        .refine((v) => v === null || isIndianState(v), "Choose a state from the list"),
      city: z
        .string()
        .trim()
        .max(64)
        .nullable()
        .transform((v) => v || null),
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
  const [before] = await db
    .select({ name: users.name, email: users.email, phone: users.phone, state: users.state, city: users.city, role: users.role, isActive: users.isActive })
    .from(users)
    .where(eq(users.id, uid.data));
  if (!before) return { ok: false, error: "This account no longer exists." };
  // Dealer and insurance vendor accounts belong to their portal; they can't change role, and nobody can be given those roles here.
  if (before.role !== parsed.data.role && (["dealer", "insurer"].includes(before.role) || ["dealer", "insurer"].includes(parsed.data.role)))
    return {
      ok: false,
      fieldErrors: {
        role:
          before.role === "dealer"
            ? "Dealer partner accounts keep the dealer role."
            : before.role === "insurer"
              ? "Insurance vendor accounts keep the insurance vendor role."
              : "Dealer and insurance vendor accounts are created by their own registration.",
      },
    };
  await db.update(users).set(parsed.data).where(eq(users.id, uid.data));
  if (!parsed.data.isActive) await destroyAllSessions(uid.data);

  const v = parsed.data;
  const changes = [
    before.name !== v.name && `name to “${v.name}”`,
    before.email !== v.email && `email to ${v.email}`,
    (before.phone !== v.phone || before.city !== v.city || before.state !== v.state) && "contact details",
    before.role !== v.role && `role ${ROLE_NAME[before.role]} → ${ROLE_NAME[v.role]}`,
    before.isActive !== v.isActive && (v.isActive ? "re-enabled" : "disabled"),
  ].filter(Boolean);
  if (changes.length) await audit(me.id, "update", "user", uid.data, `Updated ${before.name}'s account: ${changes.join(", ")}`);
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function resetUserPasswordAction(userId: unknown): Promise<ActionResult<{ password: string }>> {
  const me = await requireStaff(["admin"]);
  const uid = id.safeParse(userId);
  if (!uid.success) return { ok: false, error: "Invalid user" };
  const db = getDb();
  const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, uid.data));
  if (!user) return { ok: false, error: "This account no longer exists." };
  const pw = tempPassword();
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(pw) })
    .where(eq(users.id, uid.data));
  await destroyAllSessions(uid.data);
  await audit(me.id, "reset", "user", uid.data, `Reset the password for ${user.name} and signed them out everywhere`);
  return { ok: true, password: pw };
}

/** Ends every session of an account. On your own account, this browser stays signed in. */
export async function signOutEverywhereAction(userId: unknown): Promise<ActionResult<{ ended: number }>> {
  const me = await requireStaff(["admin"]);
  const uid = id.safeParse(userId);
  if (!uid.success) return { ok: false, error: "Invalid user" };
  const db = getDb();
  const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, uid.data));
  if (!user) return { ok: false, error: "This account no longer exists." };
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const current = token ? createHash("sha256").update(token).digest("hex") : null;
  const self = uid.data === me.id;
  const [res] = await db.delete(sessions).where(self && current ? and(eq(sessions.userId, uid.data), ne(sessions.id, current)) : eq(sessions.userId, uid.data));
  await audit(me.id, "signout", "user", uid.data, self ? "Signed out of their other sessions" : `Signed ${user.name} out on every device`);
  revalidatePath(`/admin/users/${uid.data}`);
  return { ok: true, ended: res.affectedRows };
}

export async function deleteUserAction(userId: unknown): Promise<ActionResult> {
  const me = await requireStaff(["admin"]);
  const uid = id.safeParse(userId);
  if (!uid.success) return { ok: false, error: "Invalid user" };
  if (uid.data === me.id) return { ok: false, error: "You can't delete your own account." };
  const db = getDb();
  const [user] = await db.select({ name: users.name, email: users.email, role: users.role }).from(users).where(eq(users.id, uid.data));
  if (!user) return { ok: true };
  await db.delete(users).where(eq(users.id, uid.data));
  await audit(me.id, "delete", "user", uid.data, `Deleted ${ROLE_NAME[user.role]} account ${user.name} (${user.email})`);
  revalidatePath("/admin/users");
  return { ok: true };
}
