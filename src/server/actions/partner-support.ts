"use server";

import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { TICKET_PRIORITY, TICKET_STATUS, partnerFiles, partnerTicketMessages, partnerTickets } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { TICKET_PRIORITY_LABEL, TICKET_STATUS_LABEL } from "@/partner/labels";
import type { FileRef } from "@/partner/types";
import { STAFF_TICKET_STATUS_LABEL, TICKET_CATEGORIES } from "@/components/portal/support/shared";
import { audit } from "@/server/audit";
import { requireStaff } from "@/server/auth";
import { isDuplicate } from "@/server/db-errors";
import { isActionError, partnerAction } from "@/server/partner/context";
import { logPartnerActivity, notifyPartner, reference } from "@/server/partner/records";
import { HOUR, take } from "@/server/rate-limit";
import { invalid } from "@/server/validation";

/* Support tickets: dealers (support.use — pending dealers too) and MarchGear staff. */

const id = z.coerce.number().int().positive();
const message = z.string({ error: "Write a message" }).trim().min(2, "Write a message").max(5000, "Keep the message under 5,000 characters");
const attachments = z.array(id).max(5, "Attach up to 5 files").default([]);

/** The dealer's own uploaded ticket attachments, read back from the database (never trust the client's names). */
async function ownAttachments(partnerId: number, ids: number[]): Promise<FileRef[] | null> {
  if (!ids.length) return [];
  const unique = [...new Set(ids)];
  const rows = await getDb()
    .select({ id: partnerFiles.id, filename: partnerFiles.filename, mime: partnerFiles.mime, size: partnerFiles.size })
    .from(partnerFiles)
    .where(and(eq(partnerFiles.partnerId, partnerId), eq(partnerFiles.kind, "ticket_attachment"), inArray(partnerFiles.id, unique)));
  if (rows.length !== unique.length) return null;
  return unique.map((i) => rows.find((r) => r.id === i)!);
}

const createSchema = z.object({
  subject: z.string({ error: "Add a subject" }).trim().min(4, "Add a short subject (at least 4 characters)").max(200, "Keep the subject under 200 characters"),
  category: z.enum(TICKET_CATEGORIES.map((c) => c.value) as [string, ...string[]], { error: "Choose a category" }),
  priority: z.enum(TICKET_PRIORITY, { error: "Choose a priority" }),
  message,
  attachments,
});

export async function createTicketAction(input: unknown): Promise<ActionResult<{ id: number; reference: string }>> {
  const ctx = await partnerAction("support.use", { approved: false });
  if (isActionError(ctx)) return ctx;
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!take(`ticket-create:${ctx.user.id}`, 15, HOUR)) return { ok: false, error: "You've raised a lot of tickets in a short time. Please wait a little and try again." };
  const files = await ownAttachments(ctx.partner.id, parsed.data.attachments);
  if (!files) return { ok: false, fieldErrors: { attachments: "One of the attachments couldn't be found — upload it again." } };

  const db = getDb();
  for (let attempt = 0; attempt < 3; attempt++) {
    const ref = reference("TKT");
    try {
      const ticketId = await db.transaction(async (tx) => {
        const [t] = await tx.insert(partnerTickets).values({
          partnerId: ctx.partner.id,
          reference: ref,
          subject: parsed.data.subject,
          category: parsed.data.category,
          priority: parsed.data.priority,
          status: "open",
          createdBy: ctx.user.id,
        });
        await tx.insert(partnerTicketMessages).values({ ticketId: t.insertId, userId: ctx.user.id, fromStaff: false, body: parsed.data.message, attachments: files });
        return t.insertId;
      });
      await logPartnerActivity(ctx.partner.id, ctx.user.id, "create", "ticket", ref, `Raised support ticket ${ref}: ${parsed.data.subject}`);
      return { ok: true, id: ticketId, reference: ref };
    } catch (err) {
      if (!isDuplicate(err)) throw err;
    }
  }
  return { ok: false, error: "Couldn't create the ticket. Please try again." };
}

async function ownTicket(partnerId: number, ticketId: number) {
  const [t] = await getDb().select().from(partnerTickets).where(and(eq(partnerTickets.id, ticketId), eq(partnerTickets.partnerId, partnerId)));
  return t ?? null;
}

export async function replyTicketAction(ticketId: unknown, input: unknown): Promise<ActionResult> {
  const ctx = await partnerAction("support.use", { approved: false });
  if (isActionError(ctx)) return ctx;
  const tid = id.safeParse(ticketId);
  const parsed = z.object({ message, attachments }).safeParse(input);
  if (!tid.success) return { ok: false, error: "Ticket not found." };
  if (!parsed.success) return invalid(parsed.error);
  if (!take(`ticket-reply:${ctx.user.id}`, 60, HOUR)) return { ok: false, error: "Too many replies in a short time. Please wait a little." };
  const t = await ownTicket(ctx.partner.id, tid.data);
  if (!t) return { ok: false, error: "Ticket not found." };
  if (t.status === "closed") return { ok: false, error: "This ticket is closed. Reopen it to reply." };
  const files = await ownAttachments(ctx.partner.id, parsed.data.attachments);
  if (!files) return { ok: false, fieldErrors: { attachments: "One of the attachments couldn't be found — upload it again." } };

  await getDb().transaction(async (tx) => {
    await tx.insert(partnerTicketMessages).values({ ticketId: t.id, userId: ctx.user.id, fromStaff: false, body: parsed.data.message, attachments: files });
    await tx.update(partnerTickets).set({ status: "awaiting_support", updatedAt: new Date() }).where(eq(partnerTickets.id, t.id));
  });
  await logPartnerActivity(ctx.partner.id, ctx.user.id, "reply", "ticket", t.reference, `Replied on support ticket ${t.reference}`);
  return { ok: true };
}

export async function setTicketOpenAction(ticketId: unknown, open: unknown): Promise<ActionResult> {
  const ctx = await partnerAction("support.use", { approved: false });
  if (isActionError(ctx)) return ctx;
  const tid = id.safeParse(ticketId);
  const want = z.boolean().safeParse(open);
  if (!tid.success || !want.success) return { ok: false, error: "Ticket not found." };
  const t = await ownTicket(ctx.partner.id, tid.data);
  if (!t) return { ok: false, error: "Ticket not found." };
  if (want.data === (t.status !== "closed")) return { ok: true };
  const status = want.data ? "awaiting_support" : "closed";
  await getDb().update(partnerTickets).set({ status }).where(eq(partnerTickets.id, t.id));
  await logPartnerActivity(ctx.partner.id, ctx.user.id, want.data ? "reopen" : "close", "ticket", t.reference, `${want.data ? "Reopened" : "Closed"} support ticket ${t.reference}`);
  return { ok: true };
}

/* ── MarchGear staff (/admin/partner-support) ─────────────────── */

const staffReplySchema = z.object({
  message,
  status: z.enum(["awaiting_dealer", "resolved", "closed"]).default("awaiting_dealer"),
});

export async function staffReplyTicketAction(ticketId: unknown, input: unknown): Promise<ActionResult> {
  const me = await requireStaff();
  const tid = id.safeParse(ticketId);
  const parsed = staffReplySchema.safeParse(input);
  if (!tid.success) return { ok: false, error: "Ticket not found." };
  if (!parsed.success) return invalid(parsed.error);
  const db = getDb();
  const [t] = await db.select().from(partnerTickets).where(eq(partnerTickets.id, tid.data));
  if (!t) return { ok: false, error: "Ticket not found." };

  await db.transaction(async (tx) => {
    await tx.insert(partnerTicketMessages).values({ ticketId: t.id, userId: me.id, fromStaff: true, body: parsed.data.message, attachments: [] });
    await tx.update(partnerTickets).set({ status: parsed.data.status, updatedAt: new Date() }).where(eq(partnerTickets.id, t.id));
  });
  await notifyPartner(t.partnerId, {
    kind: "support",
    title: `MarchGear support replied on ${t.reference}`,
    body: `${t.subject} — ${TICKET_STATUS_LABEL[parsed.data.status]}. ${parsed.data.message.slice(0, 300)}`,
    href: `/dealer/support/${t.id}`,
  });
  await audit(me.id, "note", "partner_ticket", t.id, `Replied to dealer ticket ${t.reference} (${STAFF_TICKET_STATUS_LABEL[parsed.data.status]})`);
  return { ok: true };
}

export async function staffUpdateTicketAction(ticketId: unknown, input: unknown): Promise<ActionResult> {
  const me = await requireStaff();
  const tid = id.safeParse(ticketId);
  const parsed = z.object({ status: z.enum(TICKET_STATUS), priority: z.enum(TICKET_PRIORITY) }).safeParse(input);
  if (!tid.success) return { ok: false, error: "Ticket not found." };
  if (!parsed.success) return invalid(parsed.error);
  const db = getDb();
  const [t] = await db.select().from(partnerTickets).where(eq(partnerTickets.id, tid.data));
  if (!t) return { ok: false, error: "Ticket not found." };
  const { status, priority } = parsed.data;
  if (status === t.status && priority === t.priority) return { ok: true };

  await db.update(partnerTickets).set({ status, priority }).where(eq(partnerTickets.id, t.id));
  const changes = [
    status !== t.status ? `status ${STAFF_TICKET_STATUS_LABEL[t.status]} → ${STAFF_TICKET_STATUS_LABEL[status]}` : "",
    priority !== t.priority ? `priority ${TICKET_PRIORITY_LABEL[t.priority]} → ${TICKET_PRIORITY_LABEL[priority]}` : "",
  ].filter(Boolean);
  if (status !== t.status)
    await notifyPartner(t.partnerId, {
      kind: "support",
      title: `Support ticket ${t.reference} is now “${TICKET_STATUS_LABEL[status]}”`,
      body: t.subject,
      href: `/dealer/support/${t.id}`,
    });
  await audit(me.id, "status", "partner_ticket", t.id, `Dealer ticket ${t.reference}: ${changes.join(", ")}`);
  return { ok: true };
}
