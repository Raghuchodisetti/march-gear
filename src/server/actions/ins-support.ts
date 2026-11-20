"use server";

import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { insFiles, insTicketMessages, insTickets } from "@/db/schema";
import { TICKET_PRIORITY } from "@/db/enums";
import type { ActionResult } from "@/lib/action-result";
import type { FileRef } from "@/partner/types";
import { isDuplicate } from "@/server/db-errors";
import { insurerAction, isInsurerError } from "@/server/insurance/context";
import { insReference, logInsurerActivity } from "@/server/insurance/records";
import { HOUR, take } from "@/server/rate-limit";
import { invalid } from "@/server/validation";
import { INS_TICKET_CATEGORIES, MAX_TICKET_FILES } from "@/components/insurance/vendor/support/shared";

/* ──────────────────────────────────────────────────────────────
   Insurance vendor support tickets (support.use — vendors still in
   review can use them too). Staff replies come from the admin side
   (/admin/insurance/support) as rows with from_staff = true.
   Status: open → awaiting_support (vendor replied) ⇄ awaiting_dealer
   (staff replied, shown as "awaiting your reply") → resolved / closed.
   The vendor can reply, mark resolved, or reopen.
   ────────────────────────────────────────────────────────────── */

const id = z.coerce.number().int().positive();
const message = z.string({ error: "Write a message" }).trim().min(2, "Write a message").max(5000, "Keep the message under 5,000 characters");
const attachments = z.array(id).max(MAX_TICKET_FILES, `Attach up to ${MAX_TICKET_FILES} files`).default([]);

/** The vendor's own uploaded ticket attachments, read back from the database (never trust the client's names). */
async function ownAttachments(vendorId: number, ids: number[]): Promise<FileRef[] | null> {
  if (!ids.length) return [];
  const unique = [...new Set(ids)];
  const rows = await getDb()
    .select({ id: insFiles.id, filename: insFiles.filename, mime: insFiles.mime, size: insFiles.size })
    .from(insFiles)
    .where(and(eq(insFiles.vendorId, vendorId), eq(insFiles.kind, "ticket_attachment"), inArray(insFiles.id, unique)));
  if (rows.length !== unique.length) return null;
  return unique.map((i) => rows.find((r) => r.id === i)!);
}

const createSchema = z.object({
  subject: z.string({ error: "Add a subject" }).trim().min(4, "Add a short subject (at least 4 characters)").max(200, "Keep the subject under 200 characters"),
  category: z.enum(INS_TICKET_CATEGORIES.map((c) => c.value) as [string, ...string[]], { error: "Choose a category" }),
  priority: z.enum(TICKET_PRIORITY, { error: "Choose a priority" }),
  message,
  attachments,
});

const MISSING_FILE = { ok: false as const, error: "One of the attachments couldn't be found — upload it again.", fieldErrors: { attachments: "One of the attachments couldn't be found — upload it again." } };

export async function createInsTicketAction(input: unknown): Promise<ActionResult<{ id: number; reference: string }>> {
  const ctx = await insurerAction("support.use", { approved: false });
  if (isInsurerError(ctx)) return ctx;
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!take(`ins-ticket-create:${ctx.user.id}`, 15, HOUR)) return { ok: false, error: "You've raised a lot of tickets in a short time. Please wait a little and try again." };
  const files = await ownAttachments(ctx.vendor.id, parsed.data.attachments);
  if (!files) return MISSING_FILE;

  const db = getDb();
  for (let attempt = 0; attempt < 3; attempt++) {
    const ref = insReference("ITK");
    try {
      const ticketId = await db.transaction(async (tx) => {
        const [t] = await tx.insert(insTickets).values({
          vendorId: ctx.vendor.id,
          reference: ref,
          subject: parsed.data.subject,
          category: parsed.data.category,
          priority: parsed.data.priority,
          status: "open",
          createdBy: ctx.user.id,
        });
        await tx.insert(insTicketMessages).values({ ticketId: t.insertId, userId: ctx.user.id, fromStaff: false, body: parsed.data.message, attachments: files });
        return t.insertId;
      });
      await logInsurerActivity(ctx.vendor.id, ctx.user.id, "create", "ticket", ref, `Raised support ticket ${ref}: ${parsed.data.subject}`);
      return { ok: true, id: ticketId, reference: ref };
    } catch (err) {
      if (!isDuplicate(err)) throw err;
    }
  }
  return { ok: false, error: "Couldn't create the ticket. Please try again." };
}

async function ownTicket(vendorId: number, ticketId: number) {
  const [t] = await getDb()
    .select()
    .from(insTickets)
    .where(and(eq(insTickets.id, ticketId), eq(insTickets.vendorId, vendorId)));
  return t ?? null;
}

/** A reply from the vendor. Replying on a resolved ticket reopens it; a closed one must be reopened first. */
export async function replyInsTicketAction(ticketId: unknown, input: unknown): Promise<ActionResult> {
  const ctx = await insurerAction("support.use", { approved: false });
  if (isInsurerError(ctx)) return ctx;
  const tid = id.safeParse(ticketId);
  const parsed = z.object({ message, attachments }).safeParse(input);
  if (!tid.success) return { ok: false, error: "Ticket not found." };
  if (!parsed.success) return invalid(parsed.error);
  if (!take(`ins-ticket-reply:${ctx.user.id}`, 60, HOUR)) return { ok: false, error: "Too many replies in a short time. Please wait a little." };
  const t = await ownTicket(ctx.vendor.id, tid.data);
  if (!t) return { ok: false, error: "Ticket not found." };
  if (t.status === "closed") return { ok: false, error: "This ticket is closed. Reopen it to reply." };
  const files = await ownAttachments(ctx.vendor.id, parsed.data.attachments);
  if (!files) return MISSING_FILE;

  await getDb().transaction(async (tx) => {
    await tx.insert(insTicketMessages).values({ ticketId: t.id, userId: ctx.user.id, fromStaff: false, body: parsed.data.message, attachments: files });
    await tx.update(insTickets).set({ status: "awaiting_support", updatedAt: new Date() }).where(eq(insTickets.id, t.id));
  });
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "reply", "ticket", t.reference, `Replied on support ticket ${t.reference}${t.status === "resolved" ? " (reopened it)" : ""}`);
  return { ok: true };
}

/** "My problem is solved." */
export async function resolveInsTicketAction(ticketId: unknown): Promise<ActionResult> {
  const ctx = await insurerAction("support.use", { approved: false });
  if (isInsurerError(ctx)) return ctx;
  const tid = id.safeParse(ticketId);
  if (!tid.success) return { ok: false, error: "Ticket not found." };
  const t = await ownTicket(ctx.vendor.id, tid.data);
  if (!t) return { ok: false, error: "Ticket not found." };
  if (t.status === "resolved") return { ok: true };
  if (t.status === "closed") return { ok: false, error: "This ticket is already closed." };
  const [res] = await getDb()
    .update(insTickets)
    .set({ status: "resolved", updatedAt: new Date() })
    .where(and(eq(insTickets.id, t.id), eq(insTickets.status, t.status)));
  if (!res.affectedRows) return { ok: false, error: "This ticket changed in the meantime. Refresh and try again." };
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "resolve", "ticket", t.reference, `Marked support ticket ${t.reference} resolved`);
  return { ok: true };
}

/** Reopens a resolved or closed ticket — it goes back to MarchGear. */
export async function reopenInsTicketAction(ticketId: unknown): Promise<ActionResult> {
  const ctx = await insurerAction("support.use", { approved: false });
  if (isInsurerError(ctx)) return ctx;
  const tid = id.safeParse(ticketId);
  if (!tid.success) return { ok: false, error: "Ticket not found." };
  const t = await ownTicket(ctx.vendor.id, tid.data);
  if (!t) return { ok: false, error: "Ticket not found." };
  if (t.status !== "resolved" && t.status !== "closed") return { ok: true };
  const [res] = await getDb()
    .update(insTickets)
    .set({ status: "awaiting_support", updatedAt: new Date() })
    .where(and(eq(insTickets.id, t.id), eq(insTickets.status, t.status)));
  if (!res.affectedRows) return { ok: false, error: "This ticket changed in the meantime. Refresh and try again." };
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "reopen", "ticket", t.reference, `Reopened support ticket ${t.reference}`);
  return { ok: true };
}
