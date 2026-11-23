"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { leadNotes, leads, partnerLeads, partnerMembers, partnerTestDrives } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { can } from "@/partner/permissions";
import { getSessionUser } from "@/server/auth";
import { HOUR, take } from "@/server/rate-limit";
import { addLeadEvent } from "@/server/partner/crm";
import { logPartnerActivity, notifyPartner } from "@/server/partner/records";
import { CUSTOMER_NOTE, SLOT_LABEL, TEST_DRIVE_ACTIVE, preferredLabel, type TimeSlot } from "@/server/customer/requests";
import { invalid, optionalText, todayISO } from "@/server/validation";
import { formatWhen } from "@/components/portal/crm/pipeline";
import { addDays } from "@/components/portal/billing/shared";

/* ──────────────────────────────────────────────────────────────
   What a signed-in customer can do with their own test drives:
   cancel one, or ask the dealer for another time. Both reach the
   dealership (enquiry timeline + notification + activity log), or
   MarchGear's team for requests that weren't routed to a dealer.
   Ownership is always re-checked here through leads.user_id.
   ────────────────────────────────────────────────────────────── */

const SIGNED_OUT = { ok: false as const, error: "Your session has ended. Please sign in again." };
const NOT_FOUND = { ok: false as const, error: "That test drive couldn't be found in your account." };
const CLOSED = { ok: false as const, error: "This test drive is already closed, so it can't be changed." };
const TOO_MANY = { ok: false as const, error: "You've made a lot of changes in a short time. Please try again in a little while." };

const driveKey = z.string().regex(/^(td|lead)-\d{1,10}$/, "That test drive couldn't be found in your account.");

type Target =
  | { kind: "drive"; drive: typeof partnerTestDrives.$inferSelect; siteLeadId: number }
  | { kind: "request"; lead: typeof leads.$inferSelect };

/** The customer's own test drive or test-drive request, or null. */
async function ownDrive(userId: number, key: string): Promise<Target | null> {
  const [kind, raw] = key.split("-");
  const id = Number(raw);
  const db = getDb();
  if (kind === "td") {
    const [r] = await db
      .select({ drive: partnerTestDrives, siteLeadId: leads.id })
      .from(partnerTestDrives)
      .innerJoin(partnerLeads, and(eq(partnerLeads.id, partnerTestDrives.leadId), eq(partnerLeads.partnerId, partnerTestDrives.partnerId)))
      .innerJoin(leads, eq(leads.id, partnerLeads.siteLeadId))
      .where(and(eq(partnerTestDrives.id, id), eq(leads.userId, userId)));
    return r ? { kind: "drive", drive: r.drive, siteLeadId: r.siteLeadId } : null;
  }
  // A website request MarchGear is still arranging (not passed to a dealer partner).
  const [r] = await db
    .select({ lead: leads })
    .from(leads)
    .leftJoin(partnerLeads, eq(partnerLeads.siteLeadId, leads.id))
    .where(and(eq(leads.id, id), eq(leads.userId, userId), eq(leads.type, "test_drive"), isNull(partnerLeads.id)));
  return r ? { kind: "request", lead: r.lead } : null;
}

/**
 * Tells the dealership: everyone who sees all enquiries (a dealership-wide notification reaches exactly them),
 * plus the assigned executive personally when they don't.
 */
async function tellDealer(drive: typeof partnerTestDrives.$inferSelect, n: { title: string; body: string }) {
  const note = { kind: "test_drive", ...n, href: `/dealer/test-drives?td=${drive.id}` };
  await notifyPartner(drive.partnerId, note);
  if (!drive.assignedMemberId) return;
  const [m] = await getDb()
    .select({ userId: partnerMembers.userId, role: partnerMembers.role, permissions: partnerMembers.permissions })
    .from(partnerMembers)
    .where(and(eq(partnerMembers.id, drive.assignedMemberId), eq(partnerMembers.partnerId, drive.partnerId), eq(partnerMembers.isActive, true)));
  if (m && !can(m, "leads.view_all")) await notifyPartner(drive.partnerId, { ...note, userId: m.userId });
}

function refresh(siteRef?: string) {
  revalidatePath("/account", "layout");
  revalidatePath("/dealer", "layout");
  revalidatePath("/admin", "layout");
  if (siteRef) revalidatePath(`/account/enquiries/${siteRef}`);
}

/* ── Cancel ────────────────────────────────────────────────── */

const cancelSchema = z.object({ id: driveKey, reason: optionalText(300) });

export async function cancelTestDriveAction(input: unknown): Promise<ActionResult> {
  const user = await getSessionUser("customer");
  if (!user) return SIGNED_OUT;
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!take(`customer-td:${user.id}`, 12, HOUR)) return TOO_MANY;
  const target = await ownDrive(user.id, parsed.data.id);
  if (!target) return NOT_FOUND;
  const reason = parsed.data.reason;
  const db = getDb();

  if (target.kind === "drive") {
    const t = target.drive;
    if (!TEST_DRIVE_ACTIVE.includes(t.status)) return CLOSED;
    const [res] = await db
      .update(partnerTestDrives)
      .set({ status: "cancelled", feedback: `Cancelled by the customer from their MarchGear account${reason ? `\n“${reason}”` : ""}` })
      .where(and(eq(partnerTestDrives.id, t.id), inArray(partnerTestDrives.status, TEST_DRIVE_ACTIVE)));
    if (!res.affectedRows) return CLOSED;
    const was = t.scheduledAt ? ` (was ${formatWhen(t.scheduledAt, { weekday: true })})` : "";
    if (t.leadId) {
      await addLeadEvent(t.leadId, null, "test_drive", `Customer cancelled test drive ${t.reference}${was} from their MarchGear account${reason ? `\n“${reason}”` : ""}`, {
        testDriveId: t.id,
        status: "cancelled",
        by: "customer",
      });
      await db.update(partnerLeads).set({ updatedAt: new Date() }).where(eq(partnerLeads.id, t.leadId));
    }
    await tellDealer(t, { title: `${t.customerName} cancelled their test drive`, body: `${t.reference} · ${t.carLabel}${was}${reason ? ` · “${reason.slice(0, 200)}”` : ""}` });
    await logPartnerActivity(t.partnerId, null, "customer_cancel", "test_drive", t.id, `Customer cancelled test drive ${t.reference} from their MarchGear account`);
    const [site] = await db.select({ reference: leads.reference }).from(leads).where(eq(leads.id, target.siteLeadId));
    refresh(site?.reference);
    return { ok: true };
  }

  // A request MarchGear is arranging: close it and leave a note for the team.
  const l = target.lead;
  if (!["new", "contacted", "qualified"].includes(l.status)) return CLOSED;
  await db.update(leads).set({ status: "closed" }).where(eq(leads.id, l.id));
  await db.insert(leadNotes).values({ leadId: l.id, authorId: user.id, kind: "status", body: `${CUSTOMER_NOTE.cancelled}.${reason ? `\n“${reason}”` : ""}` });
  refresh(l.reference);
  return { ok: true };
}

/* ── Ask for another time ──────────────────────────────────── */

const askSchema = z.object({
  id: driveKey,
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a day")
    .refine((d) => d >= todayISO(), "Pick a date from today onwards")
    .refine((d) => d <= addDays(todayISO(), 60), "Pick a date in the next two months"),
  slot: z.enum(Object.keys(SLOT_LABEL) as [TimeSlot, ...TimeSlot[]], { error: "Choose a time of day" }),
  note: optionalText(500),
});

/** Asks for a different day and time. The booking itself stays as it is until the dealer changes it. */
export async function requestTestDriveTimeAction(input: unknown): Promise<ActionResult> {
  const user = await getSessionUser("customer");
  if (!user) return SIGNED_OUT;
  const parsed = askSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!take(`customer-td:${user.id}`, 12, HOUR)) return TOO_MANY;
  const target = await ownDrive(user.id, parsed.data.id);
  if (!target) return NOT_FOUND;
  const { date, slot, note } = parsed.data;
  const wanted = preferredLabel(date, slot);
  const db = getDb();

  if (target.kind === "drive") {
    const t = target.drive;
    if (!TEST_DRIVE_ACTIVE.includes(t.status)) return CLOSED;
    if (t.leadId) {
      await addLeadEvent(t.leadId, null, "test_drive", `Customer asked for another time for test drive ${t.reference}: ${wanted}${note ? `\n“${note}”` : ""}`, {
        testDriveId: t.id,
        by: "customer",
        action: "reschedule_request",
        date,
        slot,
      });
      await db.update(partnerLeads).set({ updatedAt: new Date() }).where(eq(partnerLeads.id, t.leadId));
    }
    await tellDealer(t, { title: `${t.customerName} asked for another test-drive time`, body: `${t.reference} · ${t.carLabel} · prefers ${wanted}${note ? ` · “${note.slice(0, 200)}”` : ""}` });
    await logPartnerActivity(t.partnerId, null, "customer_request", "test_drive", t.id, `Customer asked to move test drive ${t.reference} to ${wanted}`);
    const [site] = await db.select({ reference: leads.reference }).from(leads).where(eq(leads.id, target.siteLeadId));
    refresh(site?.reference);
    return { ok: true };
  }

  const l = target.lead;
  if (!["new", "contacted", "qualified"].includes(l.status)) return CLOSED;
  // The note is the request; the lead itself is untouched (its updated_at tells us when staff last acted on it).
  await db.insert(leadNotes).values({ leadId: l.id, authorId: user.id, kind: "note", body: `${CUSTOMER_NOTE.ask} ${wanted}${note ? `\n“${note}”` : ""}` });
  refresh(l.reference);
  return { ok: true };
}
