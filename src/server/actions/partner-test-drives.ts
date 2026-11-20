"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { partnerLeads, partnerShowrooms, partnerTestDrives, partnerVehicles } from "@/db/schema";
import type { TestDriveStatus } from "@/db/enums";
import type { ActionResult } from "@/lib/action-result";
import { CRM_STATUS_LABEL, TEST_DRIVE_STATUS_LABEL } from "@/partner/labels";
import { isActionError, partnerAction, type PartnerContext } from "@/server/partner/context";
import { logPartnerActivity, notifyPartner, reference } from "@/server/partner/records";
import { activeMember, addLeadEvent, leadAccess, leadInScope, slotConflicts, testDriveInScope, vehicleLabelMap } from "@/server/partner/crm";
import { getCatalog } from "@/server/catalog";
import { isDuplicate } from "@/server/db-errors";
import { email, invalid, mobile, name, optionalText } from "@/server/validation";
import { CRM_FINISHED, PIPELINE_RANK, formatTime, formatWhen, fromISTInput } from "@/components/portal/crm/pipeline";

/* ──────────────────────────────────────────────────────────────
   Test drives: requests from the website, bookings made in the
   portal, scheduling, outcomes and feedback. Each change is
   logged on the linked enquiry's timeline.
   ────────────────────────────────────────────────────────────── */

const tdId = z.number().int().positive();
const istDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose a date and time");
const optionalId = z.union([z.literal("").transform(() => undefined), z.null().transform(() => undefined), z.coerce.number().int().positive()]).optional();
const NOT_FOUND = { ok: false as const, error: "That test drive no longer exists or isn't yours to manage." };
const ACTIVE: TestDriveStatus[] = ["requested", "accepted", "scheduled", "rescheduled"];

const refresh = () => revalidatePath("/dealer", "layout");
const when = (d: Date) => formatWhen(d, { weekday: true });

type Result = ActionResult<{ warning?: string }>;

async function actor() {
  const ctx = await partnerAction("test_drives.manage");
  return ctx;
}

/** Members who can't assign others may only take a booking themselves. */
async function resolveAssignee(ctx: PartnerContext, requested: number | undefined, current: number | null): Promise<{ id: number | null } | { error: string }> {
  const canAssign = ctx.can("leads.assign") && leadAccess(ctx) === "all";
  if (requested === undefined) return { id: current ?? (canAssign ? null : ctx.member.id) };
  // Keeping a colleague's existing booking as it is (e.g. when rescheduling it) is fine.
  if (!canAssign && requested !== ctx.member.id && requested !== current) return { error: "You can only assign test drives to yourself." };
  if (requested === current) return { id: requested };
  if (requested !== ctx.member.id && !(await activeMember(ctx.partner.id, requested))) return { error: "Choose an active member of your team" };
  return { id: requested };
}

/** The car being driven: a vehicle from inventory, or a catalogue model (+ variant), or free text. */
async function resolveCar(
  ctx: PartnerContext,
  v: { vehicleId?: number; carSlug?: string; variant?: string; carLabel?: string },
): Promise<{ vehicleId: number | null; carLabel: string; showroomId: number | null } | { error: Record<string, string> } | null> {
  if (v.vehicleId) {
    const [row] = await getDb()
      .select()
      .from(partnerVehicles)
      .where(and(eq(partnerVehicles.id, v.vehicleId), eq(partnerVehicles.partnerId, ctx.partner.id)));
    if (!row) return { error: { vehicleId: "Choose a vehicle from your inventory" } };
    return { vehicleId: row.id, carLabel: (await vehicleLabelMap())(row), showroomId: row.showroomId };
  }
  if (v.carSlug) {
    const { getCar, brandName } = await getCatalog();
    const car = getCar(v.carSlug);
    if (!car) return { error: { carSlug: "Choose a model from the list" } };
    return { vehicleId: null, carLabel: `${brandName(car.brand)} ${car.name}${v.variant ? ` ${v.variant}` : ""}`, showroomId: null };
  }
  if (v.carLabel) return { vehicleId: null, carLabel: v.carLabel, showroomId: null };
  return null;
}

async function validShowroom(partnerId: number, id: number | undefined) {
  if (!id) return true;
  const [r] = await getDb().select({ id: partnerShowrooms.id }).from(partnerShowrooms).where(and(eq(partnerShowrooms.id, id), eq(partnerShowrooms.partnerId, partnerId)));
  return Boolean(r);
}

async function conflictWarning(partnerId: number, memberId: number | null, at: Date | null, excludeId?: number) {
  if (!memberId || !at) return undefined;
  const clashes = await slotConflicts(partnerId, memberId, at, excludeId);
  if (!clashes.length) return undefined;
  const c = clashes[0];
  return `Heads up: this executive already has ${c.reference} (${c.customerName}) at ${c.scheduledAt ? formatTime(c.scheduledAt) : "around then"}${clashes.length > 1 ? ` and ${clashes.length - 1} more` : ""} within an hour.`;
}

/**
 * Logs on the linked enquiry and moves it to "Test drive scheduled" when that's progress.
 * An unassigned enquiry goes to the drive's executive, so they can see the customer's history.
 */
async function onLead(ctx: PartnerContext, leadId: number | null, body: string, meta: Record<string, string | number | boolean | null>, scheduled = false, executive: number | null = null) {
  if (!leadId) return;
  const [lead] = await getDb().select().from(partnerLeads).where(and(eq(partnerLeads.id, leadId), eq(partnerLeads.partnerId, ctx.partner.id)));
  if (!lead) return;
  await addLeadEvent(lead.id, ctx.member.id, "test_drive", body, meta);
  if (executive && !lead.assignedMemberId) {
    const m = await activeMember(ctx.partner.id, executive);
    if (m) {
      await getDb().update(partnerLeads).set({ assignedMemberId: m.id }).where(eq(partnerLeads.id, lead.id));
      await addLeadEvent(lead.id, ctx.member.id, "assign", `Assigned to ${m.name} with the test drive.`, { memberId: m.id });
    }
  }
  if (scheduled && !CRM_FINISHED.includes(lead.status) && PIPELINE_RANK[lead.status] < PIPELINE_RANK.test_drive_scheduled) {
    await getDb().update(partnerLeads).set({ status: "test_drive_scheduled" }).where(eq(partnerLeads.id, lead.id));
    await addLeadEvent(lead.id, ctx.member.id, "status", `${CRM_STATUS_LABEL[lead.status]} → ${CRM_STATUS_LABEL.test_drive_scheduled}`, { from: lead.status, to: "test_drive_scheduled", reason: null });
  } else {
    await getDb().update(partnerLeads).set({ updatedAt: new Date() }).where(eq(partnerLeads.id, lead.id));
  }
}

async function tellAssignee(ctx: PartnerContext, memberId: number | null, td: { id: number; reference: string; customerName: string }, at: Date | null) {
  if (!memberId || memberId === ctx.member.id) return;
  const m = await activeMember(ctx.partner.id, memberId);
  if (!m) return;
  await notifyPartner(ctx.partner.id, {
    userId: m.userId,
    kind: "test_drive",
    title: `Test drive with ${td.customerName}${at ? ` · ${when(at)}` : ""}`,
    body: `${ctx.user.name} assigned ${td.reference} to you.`,
    href: `/dealer/test-drives?td=${td.id}`,
  });
}

/* ── Clash check while picking a time ──────────────────────── */

export async function checkSlotAction(input: unknown): Promise<ActionResult<{ warning: string | null }>> {
  const ctx = await actor();
  if (isActionError(ctx)) return ctx;
  const parsed = z.object({ memberId: z.number().int().positive(), at: istDateTime, excludeId: tdId.optional() }).safeParse(input);
  if (!parsed.success) return { ok: true, warning: null };
  // People who can only book themselves don't get to see a colleague's diary.
  const canAssign = ctx.can("leads.assign") && leadAccess(ctx) === "all";
  if (!canAssign && parsed.data.memberId !== ctx.member.id) return { ok: true, warning: null };
  const warning = await conflictWarning(ctx.partner.id, parsed.data.memberId, fromISTInput(parsed.data.at), parsed.data.excludeId);
  return { ok: true, warning: warning ?? null };
}

/* ── Book a test drive in the portal ───────────────────────── */

const createSchema = z.object({
  leadId: optionalId,
  customerName: name,
  mobile,
  email: z.union([z.literal("").transform(() => undefined), email]).optional(),
  vehicleId: optionalId,
  carSlug: optionalText(120),
  variant: optionalText(120),
  carLabel: optionalText(200),
  showroomId: optionalId,
  assignedMemberId: optionalId,
  scheduledAt: istDateTime,
  note: optionalText(1000),
});

export async function createTestDriveAction(input: unknown): Promise<ActionResult<{ id: number; reference: string; warning?: string }>> {
  const ctx = await actor();
  if (isActionError(ctx)) return ctx;
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const at = fromISTInput(d.scheduledAt);
  if (at.getTime() < Date.now() - 5 * 60_000) return { ok: false, fieldErrors: { scheduledAt: "Pick a time in the future" } };

  if (d.leadId && !(await leadInScope(ctx, d.leadId))) return { ok: false, error: "That enquiry isn't available to you." };
  const car = await resolveCar(ctx, d);
  if (!car) return { ok: false, fieldErrors: { vehicleId: "Choose the car for the test drive" } };
  if ("error" in car) return { ok: false, fieldErrors: car.error };
  if (!(await validShowroom(ctx.partner.id, d.showroomId))) return { ok: false, fieldErrors: { showroomId: "Choose one of your showrooms" } };
  const who = await resolveAssignee(ctx, d.assignedMemberId, null);
  if ("error" in who) return { ok: false, fieldErrors: { assignedMemberId: who.error } };

  const db = getDb();
  let id = 0;
  let ref = "";
  for (let attempt = 0; attempt < 3 && !id; attempt++) {
    ref = reference("TD");
    try {
      const [res] = await db.insert(partnerTestDrives).values({
        partnerId: ctx.partner.id,
        reference: ref,
        leadId: d.leadId ?? null,
        customerName: d.customerName,
        mobile: d.mobile,
        email: d.email ?? null,
        carLabel: car.carLabel.slice(0, 200),
        vehicleId: car.vehicleId,
        showroomId: d.showroomId ?? car.showroomId ?? null,
        requestedFor: at,
        scheduledAt: at,
        status: "scheduled",
        assignedMemberId: who.id,
      });
      id = res.insertId;
    } catch (err) {
      if (!isDuplicate(err) || attempt === 2) throw err;
    }
  }
  await onLead(ctx, d.leadId ?? null, `Test drive ${ref} booked for ${when(at)} · ${car.carLabel}${d.note ? `\n${d.note}` : ""}`, { testDriveId: id, reference: ref, status: "scheduled" }, true, who.id);
  await tellAssignee(ctx, who.id, { id, reference: ref, customerName: d.customerName }, at);
  await logPartnerActivity(ctx.partner.id, ctx.user.id, "create", "test_drive", id, `Booked test drive ${ref} for ${d.customerName}`);
  const warning = await conflictWarning(ctx.partner.id, who.id, at, id);
  refresh();
  return { ok: true, id, reference: ref, warning };
}

/* ── Accept / schedule / reschedule ────────────────────────── */

const scheduleSchema = z.object({
  id: tdId,
  scheduledAt: z.union([z.literal("").transform(() => undefined), istDateTime]).optional(),
  vehicleId: optionalId,
  carSlug: optionalText(120),
  variant: optionalText(120),
  showroomId: optionalId,
  assignedMemberId: optionalId,
  note: optionalText(500),
});

/**
 * Accepts a request (with or without a time yet), schedules an accepted one, or reschedules.
 * The vehicle, showroom and executive can be set at the same time.
 */
export async function scheduleTestDriveAction(input: unknown): Promise<Result> {
  const ctx = await actor();
  if (isActionError(ctx)) return ctx;
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const td = await testDriveInScope(ctx, d.id);
  if (!td) return NOT_FOUND;
  if (!ACTIVE.includes(td.status)) return { ok: false, error: `This test drive is ${TEST_DRIVE_STATUS_LABEL[td.status].toLowerCase()} — it can't be scheduled.` };
  const at = d.scheduledAt ? fromISTInput(d.scheduledAt) : null;
  if (at && at.getTime() < Date.now() - 5 * 60_000) return { ok: false, fieldErrors: { scheduledAt: "Pick a time in the future" } };
  if (!at && td.status !== "requested") return { ok: false, fieldErrors: { scheduledAt: "Choose the new date and time" } };

  const car = await resolveCar(ctx, d);
  if (car && "error" in car) return { ok: false, fieldErrors: car.error };
  if (!(await validShowroom(ctx.partner.id, d.showroomId))) return { ok: false, fieldErrors: { showroomId: "Choose one of your showrooms" } };
  const who = await resolveAssignee(ctx, d.assignedMemberId, td.assignedMemberId);
  if ("error" in who) return { ok: false, fieldErrors: { assignedMemberId: who.error } };

  const wasScheduled = td.status === "scheduled" || td.status === "rescheduled";
  const status: TestDriveStatus = !at ? "accepted" : wasScheduled ? "rescheduled" : "scheduled";
  await getDb()
    .update(partnerTestDrives)
    .set({
      status,
      scheduledAt: at ?? td.scheduledAt,
      assignedMemberId: who.id,
      showroomId: d.showroomId ?? (car?.showroomId || td.showroomId),
      ...(car ? { vehicleId: car.vehicleId, carLabel: car.carLabel.slice(0, 200) } : {}),
    })
    .where(eq(partnerTestDrives.id, td.id));

  const label = car?.carLabel ?? td.carLabel;
  const verb = status === "accepted" ? "accepted (time to be confirmed)" : status === "rescheduled" ? `rescheduled to ${when(at!)}` : `scheduled for ${when(at!)}`;
  await onLead(ctx, td.leadId, `Test drive ${td.reference} ${verb} · ${label}${d.note ? `\n${d.note}` : ""}`, { testDriveId: td.id, status }, Boolean(at), who.id);
  if (who.id !== td.assignedMemberId || at) await tellAssignee(ctx, who.id, td, at);
  await logPartnerActivity(ctx.partner.id, ctx.user.id, status, "test_drive", td.id, `Test drive ${td.reference} ${verb}`);
  const warning = await conflictWarning(ctx.partner.id, who.id, at ?? td.scheduledAt, td.id);
  refresh();
  return { ok: true, warning };
}

/* ── Details (vehicle, showroom, executive) ────────────────── */

const updateSchema = z.object({
  id: tdId,
  vehicleId: optionalId,
  carSlug: optionalText(120),
  variant: optionalText(120),
  showroomId: optionalId,
  assignedMemberId: optionalId,
});

export async function updateTestDriveAction(input: unknown): Promise<Result> {
  const ctx = await actor();
  if (isActionError(ctx)) return ctx;
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const td = await testDriveInScope(ctx, d.id);
  if (!td) return NOT_FOUND;
  if (!ACTIVE.includes(td.status)) return { ok: false, error: "Only upcoming test drives can be changed." };
  const car = await resolveCar(ctx, d);
  if (car && "error" in car) return { ok: false, fieldErrors: car.error };
  if (!(await validShowroom(ctx.partner.id, d.showroomId))) return { ok: false, fieldErrors: { showroomId: "Choose one of your showrooms" } };
  const who = await resolveAssignee(ctx, d.assignedMemberId, td.assignedMemberId);
  if ("error" in who) return { ok: false, fieldErrors: { assignedMemberId: who.error } };

  await getDb()
    .update(partnerTestDrives)
    .set({
      assignedMemberId: who.id,
      showroomId: d.showroomId ?? td.showroomId,
      ...(car ? { vehicleId: car.vehicleId, carLabel: car.carLabel.slice(0, 200) } : {}),
    })
    .where(eq(partnerTestDrives.id, td.id));
  const changes = [car && car.carLabel !== td.carLabel ? `car: ${car.carLabel}` : null, who.id !== td.assignedMemberId ? "executive changed" : null, d.showroomId && d.showroomId !== td.showroomId ? "showroom changed" : null].filter(Boolean);
  if (changes.length) await onLead(ctx, td.leadId, `Test drive ${td.reference} updated · ${changes.join(", ")}`, { testDriveId: td.id }, false, who.id);
  if (who.id !== td.assignedMemberId) await tellAssignee(ctx, who.id, td, td.scheduledAt);
  const warning = await conflictWarning(ctx.partner.id, who.id, td.scheduledAt, td.id);
  refresh();
  return { ok: true, warning };
}

/* ── Reject / cancel ───────────────────────────────────────── */

const closeSchema = z.object({
  id: tdId,
  outcome: z.enum(["rejected", "cancelled"]),
  reason: z.string().trim().min(3, "Give a short reason").max(500),
});

/** Rejects a request or cancels a booking. The reason is kept in `feedback` (shown as "Reason"). */
export async function closeTestDriveAction(input: unknown): Promise<Result> {
  const ctx = await actor();
  if (isActionError(ctx)) return ctx;
  const parsed = closeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, outcome, reason } = parsed.data;
  const td = await testDriveInScope(ctx, id);
  if (!td) return NOT_FOUND;
  if (!ACTIVE.includes(td.status)) return { ok: false, error: "This test drive is already closed." };
  if (outcome === "rejected" && td.status !== "requested") return { ok: false, error: "Only new requests can be rejected — cancel the booking instead." };
  await getDb().update(partnerTestDrives).set({ status: outcome, feedback: reason }).where(eq(partnerTestDrives.id, td.id));
  await onLead(ctx, td.leadId, `Test drive ${td.reference} ${outcome === "rejected" ? "request rejected" : "cancelled"} · ${reason}`, { testDriveId: td.id, status: outcome });
  await logPartnerActivity(ctx.partner.id, ctx.user.id, outcome, "test_drive", td.id, `Test drive ${td.reference} ${outcome}`);
  refresh();
  return { ok: true };
}

/* ── Outcome and feedback ──────────────────────────────────── */

const completeSchema = z.object({
  id: tdId,
  outcome: z.enum(["completed", "no_show"]),
  feedback: optionalText(2000),
  rating: z.union([z.literal(0).transform(() => undefined), z.number().int().min(1).max(5)]).optional(),
});

export async function completeTestDriveAction(input: unknown): Promise<Result> {
  const ctx = await actor();
  if (isActionError(ctx)) return ctx;
  const parsed = completeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, outcome, feedback, rating } = parsed.data;
  const td = await testDriveInScope(ctx, id);
  if (!td) return NOT_FOUND;
  const editingFeedback = td.status === "completed" && outcome === "completed";
  if (!editingFeedback && !["accepted", "scheduled", "rescheduled"].includes(td.status))
    return { ok: false, error: "Only accepted or scheduled test drives can be marked completed or no-show." };
  if (outcome === "completed" && !td.scheduledAt && !editingFeedback) return { ok: false, error: "Schedule a time before marking it completed." };
  // An outcome is something that has happened (a customer may come in a little early, never days early).
  if (!editingFeedback && td.scheduledAt) {
    const ahead = td.scheduledAt.getTime() - Date.now();
    if (outcome === "no_show" && ahead > 0) return { ok: false, error: `It's booked for ${when(td.scheduledAt)} — mark a no-show after that time.` };
    if (outcome === "completed" && ahead > 2 * 3_600_000) return { ok: false, error: `It's booked for ${when(td.scheduledAt)} — mark it completed once the drive has happened.` };
  }

  await getDb()
    .update(partnerTestDrives)
    .set({ status: outcome, feedback: feedback ?? null, rating: outcome === "completed" ? (rating ?? null) : null })
    .where(eq(partnerTestDrives.id, td.id));
  const body = editingFeedback
    ? `Feedback updated for test drive ${td.reference}${rating ? ` · ${rating}/5` : ""}${feedback ? `\n${feedback}` : ""}`
    : outcome === "completed"
      ? `Test drive ${td.reference} completed${rating ? ` · rated ${rating}/5` : ""}${feedback ? `\n${feedback}` : ""}`
      : `Customer didn't turn up for test drive ${td.reference}${feedback ? `\n${feedback}` : ""}`;
  await onLead(ctx, td.leadId, body, { testDriveId: td.id, status: outcome, rating: rating ?? null });
  if (!editingFeedback) await logPartnerActivity(ctx.partner.id, ctx.user.id, outcome, "test_drive", td.id, `Test drive ${td.reference}: ${TEST_DRIVE_STATUS_LABEL[outcome]}`);
  refresh();
  return { ok: true };
}
