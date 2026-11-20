"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLog, insTicketMessages, insTickets } from "@/db/schema";
import { TICKET_PRIORITY, TICKET_STATUS } from "@/db/enums";
import type { ActionResult } from "@/lib/action-result";
import { TICKET_PRIORITY_LABEL } from "@/partner/labels";
import { audit } from "@/server/audit";
import { requireStaff } from "@/server/auth";
import { notifyInsurer } from "@/server/insurance/records";
import { invalid } from "@/server/validation";
import { INS_TICKET_STATUS_LABEL, VENDOR_TICKET_STATUS_LABEL } from "@/components/admin/insurance/ops/labels";

/* MarchGear staff answering insurance vendors' support tickets (/admin/insurance/support). */

const id = z.coerce.number().int().positive();
const href = (ticketId: number) => `/insurance-vendor/support/${ticketId}`;

async function load(ticketId: unknown) {
  const tid = id.safeParse(ticketId);
  if (!tid.success) return null;
  const [t] = await getDb().select().from(insTickets).where(eq(insTickets.id, tid.data));
  return t ?? null;
}

const replySchema = z.object({
  message: z.string({ error: "Write a reply" }).trim().min(2, "Write a reply").max(5000, "Keep the reply under 5,000 characters"),
  status: z.enum(["awaiting_dealer", "resolved", "closed"], { error: "Choose what happens to the ticket" }),
});

/** Reply as MarchGear support. The vendor sees "awaiting_dealer" as "Awaiting your reply". */
export async function staffReplyInsTicketAction(ticketId: unknown, input: unknown): Promise<ActionResult> {
  const me = await requireStaff();
  const parsed = replySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const t = await load(ticketId);
  if (!t) return { ok: false, error: "Ticket not found." };
  const { message, status } = parsed.data;

  await getDb().transaction(async (tx) => {
    await tx.insert(insTicketMessages).values({ ticketId: t.id, userId: me.id, fromStaff: true, body: message, attachments: [] });
    await tx.update(insTickets).set({ status, updatedAt: new Date() }).where(eq(insTickets.id, t.id));
  });
  await notifyInsurer(t.vendorId, {
    kind: "support",
    title: `MarchGear support replied on ${t.reference}`,
    body: `${t.subject} — ${VENDOR_TICKET_STATUS_LABEL[status]}. ${message.slice(0, 300)}`,
    href: href(t.id),
  });
  await audit(me.id, "update", "ins_ticket", t.id, `Replied to vendor ticket ${t.reference} (${INS_TICKET_STATUS_LABEL[status]})`);
  return { ok: true };
}

export async function staffUpdateInsTicketAction(ticketId: unknown, input: unknown): Promise<ActionResult> {
  const me = await requireStaff();
  // Only the fields staff changed are sent, so a stale form can't undo a status set by a reply meanwhile.
  const parsed = z.object({ status: z.enum(TICKET_STATUS, { error: "Choose a status" }).optional(), priority: z.enum(TICKET_PRIORITY, { error: "Choose a priority" }).optional() }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const t = await load(ticketId);
  if (!t) return { ok: false, error: "Ticket not found." };
  const status = parsed.data.status ?? t.status;
  const priority = parsed.data.priority ?? t.priority;
  if (status === t.status && priority === t.priority) return { ok: true };

  await getDb().update(insTickets).set({ status, priority }).where(eq(insTickets.id, t.id));
  const changes = [
    status !== t.status ? `status ${INS_TICKET_STATUS_LABEL[t.status]} → ${INS_TICKET_STATUS_LABEL[status]}` : "",
    priority !== t.priority ? `priority ${TICKET_PRIORITY_LABEL[t.priority]} → ${TICKET_PRIORITY_LABEL[priority]}` : "",
  ].filter(Boolean);
  if (status !== t.status)
    await notifyInsurer(t.vendorId, { kind: "support", title: `Support ticket ${t.reference} is now “${VENDOR_TICKET_STATUS_LABEL[status]}”`, body: t.subject, href: href(t.id) });
  await audit(me.id, "status", "ins_ticket", t.id, `Vendor ticket ${t.reference}: ${changes.join(", ")}`);
  return { ok: true };
}

/** A staff-only handling note (never shown to the vendor). Stored in the activity log against the ticket. */
export async function addInsTicketNoteAction(ticketId: unknown, input: unknown): Promise<ActionResult> {
  const me = await requireStaff();
  const parsed = z.object({ note: z.string({ error: "Write a note" }).trim().min(3, "Write a note (at least 3 characters)").max(300, "Keep internal notes under 300 characters") }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const t = await load(ticketId);
  if (!t) return { ok: false, error: "Ticket not found." };
  // Written directly (audit() swallows errors) — the note must not be lost silently.
  await getDb().insert(auditLog).values({ userId: me.id, action: "note", entity: "ins_ticket_note", entityId: String(t.id), summary: parsed.data.note });
  return { ok: true };
}
