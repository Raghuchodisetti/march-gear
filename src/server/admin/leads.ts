import "server-only";
import { and, asc, count, desc, eq, gte, inArray, isNull, like, lt, or, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { getDb } from "@/db";
import { LEAD_STATUS, LEAD_TYPES, leadNotes, leads, users, type LeadStatus, type LeadType } from "@/db/schema";
import { requireStaff, STAFF_ROLES } from "@/server/auth";

export interface LeadFilters {
  q?: string;
  type?: string;
  status?: string;
  assigned?: string;
  /** Received on or after this IST day (YYYY-MM-DD). */
  from?: string;
  /** Received on or before this IST day (YYYY-MM-DD). */
  to?: string;
  page?: number;
}

export const LEADS_PAGE_SIZE = 25;

const assignee = alias(users, "assignee");
const DAY_MS = 86_400_000;
const IST_OFFSET_MS = 330 * 60_000;

/** Midnight IST at the start of a YYYY-MM-DD day, or null if it isn't a real date. */
function istDayStart(day: string | undefined) {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const utc = new Date(`${day}T00:00:00Z`);
  // Rejects impossible days like 2026-02-30, which Date would roll over into March.
  if (Number.isNaN(utc.getTime()) || utc.toISOString().slice(0, 10) !== day) return null;
  return new Date(utc.getTime() - IST_OFFSET_MS);
}

/** A valid from/to pair (either may be missing), swapped if entered the wrong way round. */
export function leadDateRange(f: Pick<LeadFilters, "from" | "to">) {
  let from = istDayStart(f.from) ? f.from : undefined;
  let to = istDayStart(f.to) ? f.to : undefined;
  if (from && to && from > to) [from, to] = [to, from];
  return { from, to };
}

function where(f: LeadFilters, meId: number) {
  const conds: SQL[] = [];
  if (f.type && (LEAD_TYPES as readonly string[]).includes(f.type)) conds.push(eq(leads.type, f.type as LeadType));
  if (f.status && (LEAD_STATUS as readonly string[]).includes(f.status)) conds.push(eq(leads.status, f.status as LeadStatus));
  if (f.assigned === "me") conds.push(eq(leads.assignedTo, meId));
  if (f.assigned === "none") conds.push(isNull(leads.assignedTo));
  const range = leadDateRange(f);
  const start = istDayStart(range.from);
  const end = istDayStart(range.to);
  if (start) conds.push(gte(leads.createdAt, start));
  if (end) conds.push(lt(leads.createdAt, new Date(end.getTime() + DAY_MS)));
  if (f.q) {
    const term = `%${f.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    conds.push(or(like(leads.name, term), like(leads.email, term), like(leads.phone, term), like(leads.reference, term), like(leads.subject, term))!);
  }
  return conds.length ? and(...conds) : undefined;
}

const listColumns = {
  id: leads.id,
  reference: leads.reference,
  type: leads.type,
  status: leads.status,
  name: leads.name,
  email: leads.email,
  phone: leads.phone,
  city: leads.city,
  subject: leads.subject,
  message: leads.message,
  details: leads.details,
  source: leads.source,
  createdAt: leads.createdAt,
  assigneeName: assignee.name,
};

export async function listLeads(f: LeadFilters) {
  const me = await requireStaff();
  const db = getDb();
  const w = where(f, me.id);
  const [{ total }] = await db.select({ total: count() }).from(leads).where(w);
  // A stale or hand-typed ?page= past the end shows the last page rather than an empty one.
  const page = Math.min(Math.max(1, f.page ?? 1), Math.max(1, Math.ceil(total / LEADS_PAGE_SIZE)));
  const rows = await db
    .select(listColumns)
    .from(leads)
    .leftJoin(assignee, eq(assignee.id, leads.assignedTo))
    .where(w)
    .orderBy(desc(leads.createdAt), desc(leads.id))
    .limit(LEADS_PAGE_SIZE)
    .offset((page - 1) * LEADS_PAGE_SIZE);
  return { rows, total, page };
}

/** Every matching lead, newest first — for CSV export (capped). */
export async function exportLeads(f: LeadFilters) {
  const me = await requireStaff();
  return getDb()
    .select(listColumns)
    .from(leads)
    .leftJoin(assignee, eq(assignee.id, leads.assignedTo))
    .where(where(f, me.id))
    .orderBy(desc(leads.createdAt), desc(leads.id))
    .limit(20_000);
}

/** Active staff accounts — the people a lead can be assigned to. */
export async function listStaff() {
  await requireStaff();
  return getDb()
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(inArray(users.role, STAFF_ROLES), eq(users.isActive, true)))
    .orderBy(asc(users.name));
}

export async function getLead(id: number) {
  await requireStaff();
  const db = getDb();
  const [lead] = await db.select().from(leads).where(eq(leads.id, id));
  if (!lead) return null;
  const author = alias(users, "author");
  const [notes, staff, [account]] = await Promise.all([
    db
      .select({ id: leadNotes.id, kind: leadNotes.kind, body: leadNotes.body, createdAt: leadNotes.createdAt, authorName: author.name })
      .from(leadNotes)
      .leftJoin(author, eq(author.id, leadNotes.authorId))
      .where(eq(leadNotes.leadId, id))
      .orderBy(desc(leadNotes.createdAt), desc(leadNotes.id)),
    db.select({ id: users.id, name: users.name }).from(users).where(and(inArray(users.role, STAFF_ROLES), eq(users.isActive, true))).orderBy(asc(users.name)),
    lead.userId ? db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.id, lead.userId)) : Promise.resolve([undefined]),
  ]);
  return { lead, notes, staff, account };
}
