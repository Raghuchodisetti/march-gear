"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { partnerLeads, partnerOffers, partnerVehicles } from "@/db/schema";
import { CRM_STATUS, type CrmStatus } from "@/db/enums";
import type { ActionResult } from "@/lib/action-result";
import { CRM_STATUS_LABEL, CRM_WON, LEAD_SOURCE_LABEL } from "@/partner/labels";
import { expireCatalog } from "@/server/catalog";
import { isActionError, partnerAction, type PartnerContext } from "@/server/partner/context";
import { logPartnerActivity, notifyPartner, reference } from "@/server/partner/records";
import { activeMember, addLeadEvent, getLeadDetail, leadAccess, leadInScope, leadScope, vehicleLabelMap } from "@/server/partner/crm";
import { getCatalog } from "@/server/catalog";
import { isDuplicate } from "@/server/db-errors";
import { email, invalid, mobile, name, optionalText } from "@/server/validation";
import { notifyCustomerOfDealerStatus } from "@/server/customer/requests";
import { CALL_OUTCOMES, CRM_FINISHED, MANUAL_SOURCES, formatIstDateTime, fromISTInput } from "@/components/portal/crm/pipeline";
import type { LeadDetail } from "@/components/portal/crm/types";

/* ──────────────────────────────────────────────────────────────
   Dealer CRM: enquiries, notes, call logs, reminders, assignment.
   Every action checks the member's permission and that the lead
   belongs to their dealership (and to them, for "own" access).
   ────────────────────────────────────────────────────────────── */

const leadId = z.number().int().positive();
const istDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose a date and time");
const NOT_FOUND = { ok: false as const, error: "That enquiry no longer exists or isn't assigned to you." };

const refresh = () => revalidatePath("/dealer", "layout");

async function actor(perm: Parameters<typeof partnerAction>[0]) {
  const ctx = await partnerAction(perm);
  if (isActionError(ctx)) return ctx;
  if (!leadAccess(ctx)) return { ok: false as const, error: "You don't have access to enquiries." };
  return ctx;
}

/** Notify a member (by member id) that a lead is now theirs — unless they did it themselves. */
async function notifyAssignee(ctx: PartnerContext, memberId: number, lead: { id: number; reference: string; name: string }) {
  if (memberId === ctx.member.id) return;
  const m = await activeMember(ctx.partner.id, memberId);
  if (!m) return;
  await notifyPartner(ctx.partner.id, {
    userId: m.userId,
    kind: "lead_assigned",
    title: `Enquiry assigned to you: ${lead.name}`,
    body: `${ctx.user.name} assigned ${lead.reference} to you.`,
    href: `/dealer/enquiries/${lead.id}`,
  });
}

/**
 * Keeps partner_offers.conversions — and redemptions (a won deal on an offer is one redemption,
 * which is what "max redemptions" limits) — in step when a lead with an offer is won or un-won.
 */
async function trackOfferConversion(offerId: number | null, from: CrmStatus, to: CrmStatus) {
  if (!offerId) return;
  const was = CRM_WON.includes(from);
  const now = CRM_WON.includes(to);
  if (was === now) return;
  await getDb()
    .update(partnerOffers)
    .set(
      now
        ? { conversions: sql`${partnerOffers.conversions} + 1`, redemptions: sql`${partnerOffers.redemptions} + 1` }
        : { conversions: sql`GREATEST(${partnerOffers.conversions} - 1, 0)`, redemptions: sql`GREATEST(${partnerOffers.redemptions} - 1, 0)` },
    )
    .where(eq(partnerOffers.id, offerId));
  // A sold-out offer drops off the public site.
  expireCatalog();
}

/* ── Read (for the drawer after client-side mutations) ─────── */

export async function loadLeadAction(id: number): Promise<ActionResult<{ lead: LeadDetail }>> {
  const ctx = await actor(undefined);
  if (isActionError(ctx)) return ctx;
  if (!leadId.safeParse(id).success) return NOT_FOUND;
  const lead = await getLeadDetail(ctx, id);
  return lead ? { ok: true, lead } : NOT_FOUND;
}

/* ── Create (walk-ins, phone calls…) ───────────────────────── */

const optionalId = z.union([z.literal("").transform(() => undefined), z.coerce.number().int().positive()]).optional();
const createSchema = z.object({
  name,
  mobile,
  email: z.union([z.literal("").transform(() => undefined), email]).optional(),
  source: z.enum(MANUAL_SOURCES as [string, ...string[]], { error: "Choose where this enquiry came from" }),
  carSlug: optionalText(120),
  variant: optionalText(120),
  carLabel: optionalText(200),
  vehicleId: optionalId,
  offerId: optionalId,
  budget: optionalText(60),
  location: optionalText(120),
  assignedMemberId: optionalId,
  note: optionalText(2000),
  followUpAt: z.union([z.literal("").transform(() => undefined), istDateTime]).optional(),
});

export async function createLeadAction(input: unknown): Promise<ActionResult<{ id: number; reference: string }>> {
  const ctx = await actor("leads.manage");
  if (isActionError(ctx)) return ctx;
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const db = getDb();

  let carLabel = d.carLabel ?? null;
  let carSlug = d.carSlug ?? null;
  let variant = d.variant ?? null;
  if (d.vehicleId) {
    const [v] = await db.select().from(partnerVehicles).where(and(eq(partnerVehicles.id, d.vehicleId), eq(partnerVehicles.partnerId, ctx.partner.id)));
    if (!v) return { ok: false, fieldErrors: { vehicleId: "Choose a vehicle from your inventory" } };
    carLabel = (await vehicleLabelMap())(v);
    carSlug = v.modelSlug;
    variant = v.variant;
  } else if (carSlug) {
    const { getCar, brandName } = await getCatalog();
    const car = getCar(carSlug);
    if (!car) return { ok: false, fieldErrors: { carSlug: "Choose a model from the list" } };
    carLabel = `${brandName(car.brand)} ${car.name}`;
  }
  if (d.offerId) {
    const [o] = await db.select({ id: partnerOffers.id }).from(partnerOffers).where(and(eq(partnerOffers.id, d.offerId), eq(partnerOffers.partnerId, ctx.partner.id)));
    if (!o) return { ok: false, fieldErrors: { offerId: "Choose one of your offers" } };
  }

  // Without "assign" (or without access to everyone's leads) the creator keeps the enquiry.
  let assignedMemberId: number | null = d.assignedMemberId ?? null;
  if (!ctx.can("leads.assign") || leadAccess(ctx) === "own") assignedMemberId = ctx.member.id;
  if (assignedMemberId && assignedMemberId !== ctx.member.id && !(await activeMember(ctx.partner.id, assignedMemberId)))
    return { ok: false, fieldErrors: { assignedMemberId: "Choose an active member of your team" } };

  const followUpAt = d.followUpAt ? fromISTInput(d.followUpAt) : null;
  let id = 0;
  let ref = "";
  for (let attempt = 0; attempt < 3 && !id; attempt++) {
    ref = reference("LD");
    try {
      const [res] = await db.insert(partnerLeads).values({
        partnerId: ctx.partner.id,
        reference: ref,
        name: d.name,
        mobile: d.mobile,
        email: d.email ?? null,
        carLabel,
        carSlug,
        variant,
        vehicleId: d.vehicleId ?? null,
        offerId: d.offerId ?? null,
        budget: d.budget ?? null,
        location: d.location ?? null,
        source: d.source,
        status: "new",
        assignedMemberId,
        followUpAt,
      });
      id = res.insertId;
    } catch (err) {
      if (!isDuplicate(err) || attempt === 2) throw err;
    }
  }

  await addLeadEvent(id, ctx.member.id, "created", `Added by ${ctx.user.name} · ${LEAD_SOURCE_LABEL[d.source as keyof typeof LEAD_SOURCE_LABEL]}.`, { source: d.source });
  if (d.note) await addLeadEvent(id, ctx.member.id, "note", d.note);
  if (followUpAt) await addLeadEvent(id, ctx.member.id, "reminder", `Follow-up set for ${followUpLabel(followUpAt)}.`, { at: followUpAt.toISOString() });
  if (d.vehicleId) await db.update(partnerVehicles).set({ enquiries: sql`${partnerVehicles.enquiries} + 1` }).where(eq(partnerVehicles.id, d.vehicleId));
  if (d.offerId) await db.update(partnerOffers).set({ enquiries: sql`${partnerOffers.enquiries} + 1` }).where(eq(partnerOffers.id, d.offerId));
  if (assignedMemberId) await notifyAssignee(ctx, assignedMemberId, { id, reference: ref, name: d.name });
  await logPartnerActivity(ctx.partner.id, ctx.user.id, "create", "lead", id, `Added enquiry ${ref} (${d.name})`);
  refresh();
  return { ok: true, id, reference: ref };
}

const followUpLabel = (d: Date) => formatIstDateTime(d);

/* ── Edit customer details ─────────────────────────────────── */

const detailsSchema = z.object({
  id: leadId,
  name,
  mobile: z.union([z.literal("").transform(() => undefined), mobile]).optional(),
  email: z.union([z.literal("").transform(() => undefined), email]).optional(),
  carLabel: optionalText(200),
  variant: optionalText(120),
  budget: optionalText(60),
  location: optionalText(120),
});

export async function updateLeadDetailsAction(input: unknown): Promise<ActionResult> {
  const ctx = await actor("leads.manage");
  if (isActionError(ctx)) return ctx;
  const parsed = detailsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  if (!d.mobile && !d.email) return { ok: false, fieldErrors: { mobile: "Add a mobile number or an email address" } };
  const lead = await leadInScope(ctx, d.id);
  if (!lead) return NOT_FOUND;
  await getDb()
    .update(partnerLeads)
    .set({ name: d.name, mobile: d.mobile ?? null, email: d.email ?? null, carLabel: d.carLabel ?? null, variant: d.variant ?? null, budget: d.budget ?? null, location: d.location ?? null })
    .where(eq(partnerLeads.id, lead.id));
  await addLeadEvent(lead.id, ctx.member.id, "note", "Updated the customer details.", { edit: true });
  refresh();
  return { ok: true };
}

/* ── Status ────────────────────────────────────────────────── */

const statusSchema = z
  .object({ id: leadId, status: z.enum(CRM_STATUS), lostReason: optionalText(200) })
  .refine((v) => v.status !== "lost" || Boolean(v.lostReason), { path: ["lostReason"], message: "Say why the enquiry was lost" });

async function applyStatus(ctx: PartnerContext, lead: typeof partnerLeads.$inferSelect, status: CrmStatus, lostReason?: string) {
  if (lead.status === status && (status !== "lost" || lead.lostReason === lostReason)) return false;
  await getDb()
    .update(partnerLeads)
    .set({
      status,
      lostReason: status === "lost" ? (lostReason ?? null) : null,
      // A finished enquiry no longer needs reminders.
      ...(CRM_FINISHED.includes(status) ? { followUpAt: null } : {}),
    })
    .where(eq(partnerLeads.id, lead.id));
  await addLeadEvent(
    lead.id,
    ctx.member.id,
    "status",
    `${CRM_STATUS_LABEL[lead.status]} → ${CRM_STATUS_LABEL[status]}${status === "lost" && lostReason ? ` · ${lostReason}` : ""}`,
    { from: lead.status, to: status, reason: status === "lost" ? (lostReason ?? null) : null },
  );
  await trackOfferConversion(lead.offerId, lead.status, status);
  // A customer who sent this while signed in sees the customer-visible steps in /account (never the lost reason).
  await notifyCustomerOfDealerStatus(lead.id, lead.status, status);
  return true;
}

export async function updateLeadStatusAction(input: unknown): Promise<ActionResult> {
  const ctx = await actor("leads.manage");
  if (isActionError(ctx)) return ctx;
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const lead = await leadInScope(ctx, parsed.data.id);
  if (!lead) return NOT_FOUND;
  if (await applyStatus(ctx, lead, parsed.data.status, parsed.data.lostReason)) {
    await logPartnerActivity(ctx.partner.id, ctx.user.id, "status", "lead", lead.id, `${lead.reference}: ${CRM_STATUS_LABEL[parsed.data.status]}`);
    refresh();
  }
  return { ok: true };
}

/* ── Assignment ────────────────────────────────────────────── */

const assignSchema = z.object({ id: leadId, memberId: z.number().int().positive().nullable() });

export async function assignLeadAction(input: unknown): Promise<ActionResult> {
  const ctx = await actor("leads.assign");
  if (isActionError(ctx)) return ctx;
  if (leadAccess(ctx) !== "all") return { ok: false, error: "Only people who can see every enquiry can reassign them." };
  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const lead = await leadInScope(ctx, parsed.data.id);
  if (!lead) return NOT_FOUND;
  const memberId = parsed.data.memberId;
  if (lead.assignedMemberId === memberId) return { ok: true };
  const m = memberId ? await activeMember(ctx.partner.id, memberId) : null;
  if (memberId && !m) return { ok: false, fieldErrors: { memberId: "Choose an active member of your team" } };
  await getDb().update(partnerLeads).set({ assignedMemberId: memberId }).where(eq(partnerLeads.id, lead.id));
  await addLeadEvent(lead.id, ctx.member.id, "assign", m ? `Assigned to ${m.name}.` : "Unassigned.", { memberId });
  if (memberId) await notifyAssignee(ctx, memberId, lead);
  await logPartnerActivity(ctx.partner.id, ctx.user.id, "assign", "lead", lead.id, `${lead.reference} ${m ? `assigned to ${m.name}` : "unassigned"}`);
  refresh();
  return { ok: true };
}

/* ── Bulk ──────────────────────────────────────────────────── */

const bulkSchema = z
  .object({
    ids: z.array(leadId).min(1, "Select at least one enquiry").max(500),
    status: z.enum(CRM_STATUS).optional(),
    lostReason: optionalText(200),
    /** null = unassign. */
    memberId: z.number().int().positive().nullable().optional(),
  })
  .refine((v) => v.status !== undefined || v.memberId !== undefined, { path: ["form"], message: "Choose a status or a person" })
  .refine((v) => v.status !== "lost" || Boolean(v.lostReason), { path: ["lostReason"], message: "Say why these enquiries were lost" });

export async function bulkUpdateLeadsAction(input: unknown): Promise<ActionResult<{ updated: number }>> {
  const ctx = await actor(undefined);
  if (isActionError(ctx)) return ctx;
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { ids, status, lostReason, memberId } = parsed.data;
  if (status && !ctx.can("leads.manage")) return { ok: false, error: "You don't have permission to update enquiries." };
  if (memberId !== undefined && (!ctx.can("leads.assign") || leadAccess(ctx) !== "all")) return { ok: false, error: "You don't have permission to assign enquiries." };
  const m = memberId ? await activeMember(ctx.partner.id, memberId) : null;
  if (memberId && !m) return { ok: false, fieldErrors: { memberId: "Choose an active member of your team" } };

  const rows = await getDb()
    .select()
    .from(partnerLeads)
    .where(and(leadScope(ctx), inArray(partnerLeads.id, ids)));
  let updated = 0;
  for (const lead of rows) {
    let changed = false;
    if (status) changed = (await applyStatus(ctx, lead, status, lostReason)) || changed;
    if (memberId !== undefined && lead.assignedMemberId !== memberId) {
      await getDb().update(partnerLeads).set({ assignedMemberId: memberId }).where(eq(partnerLeads.id, lead.id));
      await addLeadEvent(lead.id, ctx.member.id, "assign", m ? `Assigned to ${m.name}.` : "Unassigned.", { memberId, bulk: true });
      changed = true;
    }
    if (changed) updated++;
  }
  if (memberId && updated) {
    const mm = await activeMember(ctx.partner.id, memberId);
    if (mm && memberId !== ctx.member.id)
      await notifyPartner(ctx.partner.id, { userId: mm.userId, kind: "lead_assigned", title: `${updated} enquir${updated === 1 ? "y" : "ies"} assigned to you`, body: `Assigned by ${ctx.user.name}.`, href: "/dealer/enquiries?assigned=me" });
  }
  if (updated) {
    await logPartnerActivity(
      ctx.partner.id,
      ctx.user.id,
      "bulk_update",
      "lead",
      null,
      `Bulk-updated ${updated} enquir${updated === 1 ? "y" : "ies"}${status ? ` → ${CRM_STATUS_LABEL[status]}` : ""}${memberId !== undefined ? (m ? ` · assigned to ${m.name}` : " · unassigned") : ""}`,
    );
    refresh();
  }
  return { ok: true, updated };
}

/* ── Notes, calls, reminders ───────────────────────────────── */

const noteSchema = z.object({ id: leadId, body: z.string().trim().min(2, "Write a note").max(2000) });

export async function addLeadNoteAction(input: unknown): Promise<ActionResult> {
  const ctx = await actor("leads.manage");
  if (isActionError(ctx)) return ctx;
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const lead = await leadInScope(ctx, parsed.data.id);
  if (!lead) return NOT_FOUND;
  await addLeadEvent(lead.id, ctx.member.id, "note", parsed.data.body);
  await getDb().update(partnerLeads).set({ updatedAt: new Date() }).where(eq(partnerLeads.id, lead.id));
  refresh();
  return { ok: true };
}

const contactSchema = z.object({
  id: leadId,
  channel: z.enum(["call", "whatsapp", "email"]),
  outcome: z.enum(Object.keys(CALL_OUTCOMES) as [keyof typeof CALL_OUTCOMES, ...(keyof typeof CALL_OUTCOMES)[]]).optional(),
  durationMin: z.coerce.number().int().min(0).max(600).optional(),
  notes: optionalText(2000),
});

/** A manual record of a call / WhatsApp / email with the customer (no telephony integration). */
export async function logLeadContactAction(input: unknown): Promise<ActionResult> {
  const ctx = await actor("leads.manage");
  if (isActionError(ctx)) return ctx;
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  if (d.channel === "call" && !d.outcome) return { ok: false, fieldErrors: { outcome: "Choose how the call went" } };
  if (d.channel !== "call" && !d.notes) return { ok: false, fieldErrors: { notes: "Summarise the conversation" } };
  const lead = await leadInScope(ctx, d.id);
  if (!lead) return NOT_FOUND;

  const body =
    d.channel === "call"
      ? `Call · ${CALL_OUTCOMES[d.outcome!]}${d.durationMin ? ` · ${d.durationMin} min` : ""}${d.notes ? `\n${d.notes}` : ""}`
      : `${d.channel === "whatsapp" ? "WhatsApp" : "Email"} conversation${d.notes ? `\n${d.notes}` : ""}`;
  await addLeadEvent(lead.id, ctx.member.id, d.channel, body, { outcome: d.outcome ?? null, durationMin: d.durationMin ?? null });
  // First real contact moves a brand-new enquiry along.
  if (lead.status === "new" && (d.channel !== "call" || d.outcome === "connected" || d.outcome === "callback")) await applyStatus(ctx, lead, "contacted");
  else await getDb().update(partnerLeads).set({ updatedAt: new Date() }).where(eq(partnerLeads.id, lead.id));
  refresh();
  return { ok: true };
}

const reminderSchema = z.object({
  id: leadId,
  at: z.union([z.literal(""), istDateTime]),
  note: optionalText(300),
});

/** Sets (or clears, with an empty `at`) the follow-up reminder. */
export async function setFollowUpAction(input: unknown): Promise<ActionResult> {
  const ctx = await actor("leads.manage");
  if (isActionError(ctx)) return ctx;
  const parsed = reminderSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const lead = await leadInScope(ctx, parsed.data.id);
  if (!lead) return NOT_FOUND;
  const at = parsed.data.at ? fromISTInput(parsed.data.at) : null;
  if (at && at.getTime() < Date.now() - 60_000) return { ok: false, fieldErrors: { at: "Pick a time in the future" } };
  if (at && CRM_FINISHED.includes(lead.status)) return { ok: false, fieldErrors: { at: "Reopen the enquiry before setting a reminder" } };
  await getDb()
    .update(partnerLeads)
    .set({ followUpAt: at, ...(at && lead.status === "contacted" ? { status: "follow_up" as const } : {}) })
    .where(eq(partnerLeads.id, lead.id));
  await addLeadEvent(
    lead.id,
    ctx.member.id,
    "reminder",
    at ? `Follow-up set for ${followUpLabel(at)}${parsed.data.note ? ` · ${parsed.data.note}` : ""}.` : "Follow-up reminder cleared.",
    { at: at?.toISOString() ?? null },
  );
  if (at && lead.status === "contacted")
    await addLeadEvent(lead.id, ctx.member.id, "status", `${CRM_STATUS_LABEL.contacted} → ${CRM_STATUS_LABEL.follow_up}`, { from: "contacted", to: "follow_up", reason: null });
  refresh();
  return { ok: true };
}
