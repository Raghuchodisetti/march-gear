import "server-only";
import { aliasedTable, and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, like, lt, lte, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import {
  leads,
  partnerBrands,
  partnerLeadEvents,
  partnerLeads,
  partnerMembers,
  partnerOffers,
  partnerShowrooms,
  partnerTestDrives,
  partnerVehicles,
  users,
} from "@/db/schema";
import { CRM_STATUS, LEAD_SOURCES, type CrmStatus, type LeadEventKind, type LeadSource } from "@/db/enums";
import { PARTNER_ROLE_LABEL } from "@/partner/labels";
import { permissionsFor } from "@/partner/permissions";
import type { PartnerContext } from "@/server/partner/context";
import { getCatalog } from "@/server/catalog";
import { CRM_FINISHED, FUNNEL, PIPELINE_RANK, customerKey } from "@/components/portal/crm/pipeline";
import type {
  LeadAnalytics,
  LeadDetail,
  LeadListItem,
  MemberOption,
  ModelOption,
  OfferOption,
  ShowroomOption,
  TestDriveItem,
  VehicleOption,
} from "@/components/portal/crm/types";

/* ──────────────────────────────────────────────────────────────
   Dealer CRM data layer: enquiries, their timeline, test drives
   and the people behind them. Every query is scoped to the
   signed-in dealership — and, for members who may only see their
   own enquiries, to the leads assigned to them.
   ────────────────────────────────────────────────────────────── */

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
/** Raw SQL datetimes come back as "YYYY-MM-DD HH:MM:SS" (UTC). */
export const sqlDate = (v: string | null | undefined) => (v ? new Date(`${v.replace(" ", "T")}Z`) : null);

/** "all" sees every enquiry; "own" only those assigned to them; null none. */
export function leadAccess(ctx: PartnerContext): "all" | "own" | null {
  if (ctx.can("leads.view_all")) return "all";
  if (ctx.can("leads.view_own")) return "own";
  return null;
}

/** WHERE for the leads this person may see. */
export function leadScope(ctx: PartnerContext): SQL {
  const own = leadAccess(ctx) !== "all";
  return own ? and(eq(partnerLeads.partnerId, ctx.partner.id), eq(partnerLeads.assignedMemberId, ctx.member.id))! : eq(partnerLeads.partnerId, ctx.partner.id);
}

/** The lead if this person may see it. */
export async function leadInScope(ctx: PartnerContext, id: number) {
  if (!leadAccess(ctx)) return null;
  const [row] = await getDb().select().from(partnerLeads).where(and(leadScope(ctx), eq(partnerLeads.id, id)));
  return row ?? null;
}

export async function addLeadEvent(leadId: number, memberId: number | null, kind: LeadEventKind, body: string, meta: Record<string, string | number | boolean | null> | null = null) {
  await getDb().insert(partnerLeadEvents).values({ leadId, memberId, kind, body: body.slice(0, 5000), meta });
}

/* ── Options for pickers ───────────────────────────────────── */

/** Active people at the dealership who can work enquiries (for assignment pickers). */
export async function salesMembers(partnerId: number): Promise<MemberOption[]> {
  const rows = await getDb()
    .select({ id: partnerMembers.id, role: partnerMembers.role, permissions: partnerMembers.permissions, name: users.name })
    .from(partnerMembers)
    .innerJoin(users, eq(users.id, partnerMembers.userId))
    .where(and(eq(partnerMembers.partnerId, partnerId), eq(partnerMembers.isActive, true)))
    .orderBy(asc(users.name));
  return rows
    .filter((m) => {
      const p = permissionsFor(m);
      return p.includes("leads.view_all") || p.includes("leads.view_own");
    })
    .map((m) => ({ id: m.id, name: m.name, role: m.role, roleLabel: PARTNER_ROLE_LABEL[m.role] }));
}

export async function activeMember(partnerId: number, memberId: number) {
  const [m] = await getDb()
    .select({ id: partnerMembers.id, userId: partnerMembers.userId, name: users.name })
    .from(partnerMembers)
    .innerJoin(users, eq(users.id, partnerMembers.userId))
    .where(and(eq(partnerMembers.partnerId, partnerId), eq(partnerMembers.id, memberId), eq(partnerMembers.isActive, true)));
  return m ?? null;
}

export async function vehicleLabelMap() {
  const { brandName } = await getCatalog();
  return (v: { brand: string; model: string; variant: string; year?: number; kind?: "new" | "used" }) =>
    `${v.kind === "used" && v.year ? `${v.year} ` : ""}${brandName(v.brand)} ${v.model}${v.variant ? ` ${v.variant}` : ""}`.trim();
}

/** Published stock (for test drives and manual enquiries), or everything not archived (`all`, for filters). */
export async function vehicleOptions(partnerId: number, opts: { includeIds?: number[]; all?: boolean } = {}): Promise<VehicleOption[]> {
  const label = await vehicleLabelMap();
  const rows = await getDb()
    .select({
      id: partnerVehicles.id,
      reference: partnerVehicles.reference,
      kind: partnerVehicles.kind,
      brand: partnerVehicles.brand,
      model: partnerVehicles.model,
      variant: partnerVehicles.variant,
      year: partnerVehicles.year,
      showroomId: partnerVehicles.showroomId,
    })
    .from(partnerVehicles)
    .where(
      and(
        eq(partnerVehicles.partnerId, partnerId),
        opts.all
          ? ne(partnerVehicles.status, "archived")
          : opts.includeIds?.length
            ? or(eq(partnerVehicles.status, "published"), inArray(partnerVehicles.id, opts.includeIds))
            : eq(partnerVehicles.status, "published"),
      ),
    )
    .orderBy(asc(partnerVehicles.brand), asc(partnerVehicles.model));
  return rows.map((v) => ({ id: v.id, reference: v.reference, kind: v.kind, label: label(v), showroomId: v.showroomId }));
}

/** Catalogue models (brand + model + variants) for "interested in" and test-drive pickers — the dealership's own brands first. */
export async function modelOptions(partnerId?: number): Promise<ModelOption[]> {
  const [{ cars, brandName }, own] = await Promise.all([
    getCatalog(),
    partnerId
      ? getDb().select({ brand: partnerBrands.brand }).from(partnerBrands).where(and(eq(partnerBrands.partnerId, partnerId), eq(partnerBrands.status, "approved")))
      : Promise.resolve([]),
  ]);
  const mine = new Set(own.map((b) => b.brand));
  return cars
    .map((c) => ({ value: c.slug, label: `${brandName(c.brand)} ${c.name}`, variants: c.variants.map((v) => v.name), own: mine.has(c.brand) }))
    .sort((a, b) => Number(b.own) - Number(a.own) || a.label.localeCompare(b.label))
    .map((m) => ({ value: m.value, label: m.label, variants: m.variants }));
}

export async function showroomOptions(partnerId: number): Promise<ShowroomOption[]> {
  const rows = await getDb()
    .select({ id: partnerShowrooms.id, name: partnerShowrooms.name, city: partnerShowrooms.city, isPrimary: partnerShowrooms.isPrimary })
    .from(partnerShowrooms)
    .where(and(eq(partnerShowrooms.partnerId, partnerId), eq(partnerShowrooms.isActive, true)))
    .orderBy(desc(partnerShowrooms.isPrimary), asc(partnerShowrooms.name));
  return rows.map(({ id, name, city }) => ({ id, name, city }));
}

export async function offerOptions(partnerId: number): Promise<OfferOption[]> {
  return getDb()
    .select({ id: partnerOffers.id, reference: partnerOffers.reference, title: partnerOffers.title })
    .from(partnerOffers)
    .where(and(eq(partnerOffers.partnerId, partnerId), notInArray(partnerOffers.status, ["draft", "rejected"])))
    .orderBy(desc(partnerOffers.createdAt))
    .limit(200);
}

/* ── Enquiry list ──────────────────────────────────────────── */

export interface LeadFilters {
  q?: string;
  status?: CrmStatus;
  source?: LeadSource;
  /** "me", "none" or a member id. */
  assigned?: string;
  offer?: number;
  vehicle?: number;
  from?: string;
  to?: string;
  overdue?: boolean;
  sort: "newest" | "oldest" | "follow_up" | "updated";
}

type Params = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const posInt = (v: string | string[] | undefined) => {
  const n = Number.parseInt(str(v) ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};
const day = (v: string | string[] | undefined) => {
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined;
};

export function parseLeadFilters(sp: Params): LeadFilters {
  const status = str(sp.status);
  const source = str(sp.source);
  const sort = str(sp.sort);
  const assigned = str(sp.assigned);
  return {
    q: str(sp.q)?.slice(0, 100),
    status: CRM_STATUS.includes(status as CrmStatus) ? (status as CrmStatus) : undefined,
    source: LEAD_SOURCES.includes(source as LeadSource) ? (source as LeadSource) : undefined,
    assigned: assigned && (assigned === "me" || assigned === "none" || /^\d+$/.test(assigned)) ? assigned : undefined,
    offer: posInt(sp.offer),
    vehicle: posInt(sp.vehicle),
    from: day(sp.from),
    to: day(sp.to),
    overdue: str(sp.overdue) === "1",
    sort: sort === "oldest" || sort === "follow_up" || sort === "updated" ? sort : "newest",
  };
}

/** The filters as URL params (for links, the export and pagination). */
export function leadFilterParams(f: LeadFilters): Record<string, string | undefined> {
  return {
    q: f.q,
    status: f.status,
    source: f.source,
    assigned: f.assigned,
    offer: f.offer ? String(f.offer) : undefined,
    vehicle: f.vehicle ? String(f.vehicle) : undefined,
    from: f.from,
    to: f.to,
    overdue: f.overdue ? "1" : undefined,
    sort: f.sort === "newest" ? undefined : f.sort,
  };
}

export function leadWhere(ctx: PartnerContext, f: LeadFilters, opts: { ignoreStatus?: boolean } = {}): SQL {
  const parts: (SQL | undefined)[] = [leadScope(ctx)];
  if (f.q) {
    const q = `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const digits = f.q.replace(/\D/g, "");
    parts.push(
      or(
        like(partnerLeads.name, q),
        like(partnerLeads.email, q),
        like(partnerLeads.reference, q),
        like(partnerLeads.carLabel, q),
        like(partnerLeads.location, q),
        digits.length >= 3 ? like(partnerLeads.mobile, `%${digits}%`) : undefined,
      ),
    );
  }
  if (f.status && !opts.ignoreStatus) parts.push(eq(partnerLeads.status, f.status));
  if (f.source) parts.push(eq(partnerLeads.source, f.source));
  if (f.assigned === "me") parts.push(eq(partnerLeads.assignedMemberId, ctx.member.id));
  else if (f.assigned === "none") parts.push(isNull(partnerLeads.assignedMemberId));
  else if (f.assigned) parts.push(eq(partnerLeads.assignedMemberId, Number(f.assigned)));
  if (f.offer) parts.push(eq(partnerLeads.offerId, f.offer));
  if (f.vehicle) parts.push(eq(partnerLeads.vehicleId, f.vehicle));
  if (f.from) parts.push(gte(partnerLeads.createdAt, new Date(`${f.from}T00:00:00+05:30`)));
  if (f.to) parts.push(lte(partnerLeads.createdAt, new Date(`${f.to}T23:59:59.999+05:30`)));
  if (f.overdue) parts.push(isNotNull(partnerLeads.followUpAt), lt(partnerLeads.followUpAt, new Date()), notInArray(partnerLeads.status, CRM_FINISHED));
  return and(...parts)!;
}

const assignee = aliasedTable(users, "assignee_user");

function leadSelect() {
  return getDb()
    .select({
      lead: partnerLeads,
      assignedName: assignee.name,
      offerTitle: partnerOffers.title,
      offerRef: partnerOffers.reference,
      vBrand: partnerVehicles.brand,
      vModel: partnerVehicles.model,
      vVariant: partnerVehicles.variant,
      vYear: partnerVehicles.year,
      vKind: partnerVehicles.kind,
      vRef: partnerVehicles.reference,
    })
    .from(partnerLeads)
    .leftJoin(partnerMembers, eq(partnerMembers.id, partnerLeads.assignedMemberId))
    .leftJoin(assignee, eq(assignee.id, partnerMembers.userId))
    .leftJoin(partnerOffers, eq(partnerOffers.id, partnerLeads.offerId))
    .leftJoin(partnerVehicles, eq(partnerVehicles.id, partnerLeads.vehicleId));
}

type SelectedLead = Awaited<ReturnType<ReturnType<typeof leadSelect>["where"]>>[number];

function toListItem(r: SelectedLead, label: Awaited<ReturnType<typeof vehicleLabelMap>>): LeadListItem {
  const l = r.lead;
  return {
    id: l.id,
    reference: l.reference,
    name: l.name,
    mobile: l.mobile,
    email: l.email,
    carLabel: l.carLabel,
    carSlug: l.carSlug,
    variant: l.variant,
    budget: l.budget,
    location: l.location,
    source: (LEAD_SOURCES.includes(l.source as LeadSource) ? l.source : "other") as LeadSource,
    status: l.status,
    lostReason: l.lostReason,
    followUpAt: iso(l.followUpAt),
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
    assigned: l.assignedMemberId && r.assignedName ? { id: l.assignedMemberId, name: r.assignedName } : null,
    offer: l.offerId && r.offerTitle ? { id: l.offerId, title: r.offerTitle, reference: r.offerRef ?? "" } : null,
    vehicle:
      l.vehicleId && r.vBrand
        ? { id: l.vehicleId, reference: r.vRef ?? "", label: label({ brand: r.vBrand, model: r.vModel ?? "", variant: r.vVariant ?? "", year: r.vYear ?? undefined, kind: r.vKind ?? undefined }) }
        : null,
  };
}

const ORDER = {
  newest: [desc(partnerLeads.createdAt), desc(partnerLeads.id)],
  oldest: [asc(partnerLeads.createdAt), asc(partnerLeads.id)],
  updated: [desc(partnerLeads.updatedAt), desc(partnerLeads.id)],
  // Soonest reminders first; leads without one last.
  follow_up: [sql`${partnerLeads.followUpAt} IS NULL`, asc(partnerLeads.followUpAt), desc(partnerLeads.id)],
} as const;

export async function queryLeads(ctx: PartnerContext, f: LeadFilters, page: { limit: number; offset: number }) {
  const where = leadWhere(ctx, f);
  const [rows, [{ total }], label] = await Promise.all([
    leadSelect()
      .where(where)
      .orderBy(...ORDER[f.sort])
      .limit(page.limit)
      .offset(page.offset),
    getDb().select({ total: count() }).from(partnerLeads).where(where),
    vehicleLabelMap(),
  ]);
  return { rows: rows.map((r) => toListItem(r, label)), total };
}

/** Funnel, conversion and first-response time for the filtered enquiries (ignoring the status filter). */
export async function leadAnalytics(ctx: PartnerContext, f: LeadFilters): Promise<LeadAnalytics> {
  const db = getDb();
  const where = leadWhere(ctx, { ...f, overdue: false }, { ignoreStatus: true });
  const ids = db.select({ id: partnerLeads.id }).from(partnerLeads).where(where);
  const [rows, statusEvents, firstResponses] = await Promise.all([
    db.select({ id: partnerLeads.id, status: partnerLeads.status, createdAt: partnerLeads.createdAt, followUpAt: partnerLeads.followUpAt }).from(partnerLeads).where(where),
    db
      .select({ leadId: partnerLeadEvents.leadId, meta: partnerLeadEvents.meta })
      .from(partnerLeadEvents)
      .where(and(eq(partnerLeadEvents.kind, "status"), inArray(partnerLeadEvents.leadId, ids))),
    db
      .select({ leadId: partnerLeadEvents.leadId, first: sql<string>`MIN(${partnerLeadEvents.createdAt})` })
      .from(partnerLeadEvents)
      .where(and(isNotNull(partnerLeadEvents.memberId), inArray(partnerLeadEvents.kind, ["call", "status", "whatsapp", "email"]), inArray(partnerLeadEvents.leadId, ids)))
      .groupBy(partnerLeadEvents.leadId),
  ]);

  const reached = new Map<number, number>();
  for (const r of rows) reached.set(r.id, PIPELINE_RANK[r.status]);
  for (const e of statusEvents) {
    const to = e.meta?.to as CrmStatus | undefined;
    if (to && to in PIPELINE_RANK) reached.set(e.leadId, Math.max(reached.get(e.leadId) ?? 0, PIPELINE_RANK[to]));
  }
  const ranks = rows.map((r) => Math.max(0, reached.get(r.id) ?? 0));
  const stages = FUNNEL.map((s) => ({ key: s.key, label: s.label, count: ranks.filter((rank) => rank >= s.rank).length }));
  const won = rows.filter((r) => PIPELINE_RANK[r.status] === 5).length;
  const lost = rows.filter((r) => r.status === "lost").length;

  const created = new Map(rows.map((r) => [r.id, r.createdAt.getTime()]));
  let sum = 0;
  let n = 0;
  for (const fr of firstResponses) {
    const start = created.get(fr.leadId);
    const first = sqlDate(fr.first);
    if (start === undefined || !first) continue;
    sum += Math.max(0, first.getTime() - start);
    n++;
  }
  const now = Date.now();
  return {
    total: rows.length,
    stages,
    won,
    lost,
    conversionPct: rows.length ? Math.round((won / rows.length) * 1000) / 10 : 0,
    avgFirstResponseMs: n ? sum / n : null,
    responded: n,
    overdue: rows.filter((r) => r.followUpAt && r.followUpAt.getTime() < now && !CRM_FINISHED.includes(r.status)).length,
  };
}

/** All filtered enquiries (for the kanban board and exports), newest first. */
export async function allLeads(ctx: PartnerContext, f: LeadFilters, limit = 2000) {
  const [rows, label] = await Promise.all([leadSelect().where(leadWhere(ctx, f)).orderBy(...ORDER[f.sort]).limit(limit), vehicleLabelMap()]);
  return rows.map((r) => toListItem(r, label));
}

/* ── One enquiry ───────────────────────────────────────────── */

export async function getLeadDetail(ctx: PartnerContext, id: number): Promise<LeadDetail | null> {
  if (!leadAccess(ctx)) return null;
  const db = getDb();
  const [[row], label] = await Promise.all([leadSelect().where(and(leadScope(ctx), eq(partnerLeads.id, id))), vehicleLabelMap()]);
  if (!row) return null;
  const author = aliasedTable(users, "event_author");
  const [events, drives, [site]] = await Promise.all([
    db
      .select({ e: partnerLeadEvents, memberName: author.name })
      .from(partnerLeadEvents)
      .leftJoin(partnerMembers, eq(partnerMembers.id, partnerLeadEvents.memberId))
      .leftJoin(author, eq(author.id, partnerMembers.userId))
      .where(eq(partnerLeadEvents.leadId, id))
      .orderBy(desc(partnerLeadEvents.createdAt), desc(partnerLeadEvents.id)),
    db
      .select()
      .from(partnerTestDrives)
      .where(and(eq(partnerTestDrives.partnerId, ctx.partner.id), eq(partnerTestDrives.leadId, id)))
      .orderBy(desc(partnerTestDrives.createdAt)),
    row.lead.siteLeadId
      ? db
          .select({ reference: leads.reference, type: leads.type, message: leads.message, page: leads.source, details: leads.details })
          .from(leads)
          .where(eq(leads.id, row.lead.siteLeadId))
      : Promise.resolve([]),
  ]);
  const base = toListItem(row, label);
  return {
    ...base,
    events: events.map(({ e, memberName }) => ({ id: e.id, kind: e.kind, body: e.body, meta: e.meta, createdAt: e.createdAt.toISOString(), memberName })),
    testDrives: drives.map((d) => ({ id: d.id, reference: d.reference, status: d.status, carLabel: d.carLabel, requestedFor: iso(d.requestedFor), scheduledAt: iso(d.scheduledAt) })),
    siteLead: site ? { reference: site.reference, type: site.type, message: site.message, page: site.page, details: site.details } : null,
    customerKey: customerKey(base.mobile, base.email),
  };
}

/* ── Test drives ───────────────────────────────────────────── */

/** WHERE for the test drives this person may see: all, or (own-only members) theirs and their leads'. */
export function testDriveScope(ctx: PartnerContext): SQL {
  const base = eq(partnerTestDrives.partnerId, ctx.partner.id);
  if (leadAccess(ctx) === "all") return base;
  return and(
    base,
    or(
      eq(partnerTestDrives.assignedMemberId, ctx.member.id),
      inArray(
        partnerTestDrives.leadId,
        getDb()
          .select({ id: partnerLeads.id })
          .from(partnerLeads)
          .where(and(eq(partnerLeads.partnerId, ctx.partner.id), eq(partnerLeads.assignedMemberId, ctx.member.id))),
      ),
    ),
  )!;
}

export async function testDriveInScope(ctx: PartnerContext, id: number) {
  const [row] = await getDb().select().from(partnerTestDrives).where(and(testDriveScope(ctx), eq(partnerTestDrives.id, id)));
  return row ?? null;
}

const tdAssignee = aliasedTable(users, "td_assignee");

export async function queryTestDrives(ctx: PartnerContext, where: SQL | undefined, opts: { limit?: number; order?: "scheduled" | "created" } = {}): Promise<TestDriveItem[]> {
  const [rows, label] = await Promise.all([
    getDb()
      .select({
        td: partnerTestDrives,
        assignedName: tdAssignee.name,
        showroomName: partnerShowrooms.name,
        leadRef: partnerLeads.reference,
        leadStatus: partnerLeads.status,
        vBrand: partnerVehicles.brand,
        vModel: partnerVehicles.model,
        vVariant: partnerVehicles.variant,
        vYear: partnerVehicles.year,
        vKind: partnerVehicles.kind,
        vRef: partnerVehicles.reference,
      })
      .from(partnerTestDrives)
      .leftJoin(partnerMembers, eq(partnerMembers.id, partnerTestDrives.assignedMemberId))
      .leftJoin(tdAssignee, eq(tdAssignee.id, partnerMembers.userId))
      .leftJoin(partnerShowrooms, eq(partnerShowrooms.id, partnerTestDrives.showroomId))
      .leftJoin(partnerLeads, eq(partnerLeads.id, partnerTestDrives.leadId))
      .leftJoin(partnerVehicles, eq(partnerVehicles.id, partnerTestDrives.vehicleId))
      .where(and(testDriveScope(ctx), where))
      .orderBy(
        ...(opts.order === "created"
          ? [desc(partnerTestDrives.createdAt)]
          : [sql`COALESCE(${partnerTestDrives.scheduledAt}, ${partnerTestDrives.requestedFor}) IS NULL`, asc(sql`COALESCE(${partnerTestDrives.scheduledAt}, ${partnerTestDrives.requestedFor})`)]),
        desc(partnerTestDrives.id),
      )
      .limit(opts.limit ?? 500),
    vehicleLabelMap(),
  ]);
  return rows.map((r) => {
    const t = r.td;
    return {
      id: t.id,
      reference: t.reference,
      status: t.status,
      customerName: t.customerName,
      mobile: t.mobile,
      email: t.email,
      carLabel: t.carLabel,
      vehicle:
        t.vehicleId && r.vBrand
          ? { id: t.vehicleId, reference: r.vRef ?? "", label: label({ brand: r.vBrand, model: r.vModel ?? "", variant: r.vVariant ?? "", year: r.vYear ?? undefined, kind: r.vKind ?? undefined }) }
          : null,
      showroom: t.showroomId && r.showroomName ? { id: t.showroomId, name: r.showroomName } : null,
      requestedFor: iso(t.requestedFor),
      scheduledAt: iso(t.scheduledAt),
      assigned: t.assignedMemberId && r.assignedName ? { id: t.assignedMemberId, name: r.assignedName } : null,
      lead: t.leadId && r.leadRef ? { id: t.leadId, reference: r.leadRef, status: r.leadStatus ?? "new" } : null,
      feedback: t.feedback,
      rating: t.rating,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  });
}

/** Active bookings for an executive within ±`windowMin` minutes of `at` (for the clash warning). */
export async function slotConflicts(partnerId: number, memberId: number, at: Date, excludeId?: number, windowMin = 60) {
  const from = new Date(at.getTime() - windowMin * 60_000);
  const to = new Date(at.getTime() + windowMin * 60_000);
  return getDb()
    .select({ id: partnerTestDrives.id, reference: partnerTestDrives.reference, customerName: partnerTestDrives.customerName, scheduledAt: partnerTestDrives.scheduledAt })
    .from(partnerTestDrives)
    .where(
      and(
        eq(partnerTestDrives.partnerId, partnerId),
        eq(partnerTestDrives.assignedMemberId, memberId),
        inArray(partnerTestDrives.status, ["accepted", "scheduled", "rescheduled"]),
        isNotNull(partnerTestDrives.scheduledAt),
        gte(partnerTestDrives.scheduledAt, from),
        lte(partnerTestDrives.scheduledAt, to),
        excludeId ? ne(partnerTestDrives.id, excludeId) : undefined,
      ),
    );
}

/* ── Customers (people behind the enquiries) ───────────────── */

export interface CustomerRow {
  key: string;
  name: string;
  mobile: string | null;
  email: string | null;
  enquiries: number;
  won: number;
  testDrives: number;
  latestStatus: CrmStatus;
  firstSeen: string;
  lastActivity: string;
  lastContact: string | null;
  cars: string[];
}

/** Groups the visible enquiries by mobile number (else email) into customers. */
export async function queryCustomers(ctx: PartnerContext): Promise<CustomerRow[]> {
  if (!leadAccess(ctx)) return [];
  const db = getDb();
  const key = sql<string>`COALESCE(NULLIF(${partnerLeads.mobile}, ''), LOWER(NULLIF(${partnerLeads.email}, '')))`;
  const scope = and(leadScope(ctx), sql`${key} IS NOT NULL`);
  const [groups, contacts, drives] = await Promise.all([
    db
      .select({
        key,
        name: sql<string>`SUBSTRING_INDEX(GROUP_CONCAT(${partnerLeads.name} ORDER BY ${partnerLeads.createdAt} DESC SEPARATOR '\x1f'), '\x1f', 1)`,
        mobile: sql<string | null>`MAX(${partnerLeads.mobile})`,
        email: sql<string | null>`MAX(${partnerLeads.email})`,
        enquiries: sql<number>`COUNT(*)`,
        won: sql<number>`SUM(${partnerLeads.status} IN ('booking_completed', 'converted'))`,
        latestStatus: sql<string>`SUBSTRING_INDEX(GROUP_CONCAT(${partnerLeads.status} ORDER BY ${partnerLeads.createdAt} DESC SEPARATOR ','), ',', 1)`,
        firstSeen: sql<string>`MIN(${partnerLeads.createdAt})`,
        lastActivity: sql<string>`MAX(${partnerLeads.updatedAt})`,
        cars: sql<string | null>`GROUP_CONCAT(DISTINCT ${partnerLeads.carLabel} ORDER BY ${partnerLeads.carLabel} SEPARATOR '\x1f')`,
      })
      .from(partnerLeads)
      .where(scope)
      .groupBy(key)
      .limit(5000),
    db
      .select({ key, last: sql<string>`MAX(${partnerLeadEvents.createdAt})` })
      .from(partnerLeadEvents)
      .innerJoin(partnerLeads, eq(partnerLeads.id, partnerLeadEvents.leadId))
      .where(and(scope, isNotNull(partnerLeadEvents.memberId), inArray(partnerLeadEvents.kind, ["call", "whatsapp", "email"])))
      .groupBy(key),
    db
      .select({ mobile: partnerTestDrives.mobile, n: sql<number>`COUNT(*)` })
      .from(partnerTestDrives)
      // Turned-down and cancelled requests don't count as a test drive.
      .where(and(testDriveScope(ctx), notInArray(partnerTestDrives.status, ["rejected", "cancelled"])))
      .groupBy(partnerTestDrives.mobile),
  ]);
  const lastContact = new Map(contacts.map((c) => [c.key, c.last]));
  const driveCount = new Map(drives.map((d) => [d.mobile, Number(d.n)]));
  return groups.map((g) => {
    const mobile = g.mobile;
    return {
      key: customerKey(mobile, g.email) ?? `e-${encodeURIComponent(g.key)}`,
      name: g.name,
      mobile,
      email: g.email,
      enquiries: Number(g.enquiries),
      won: Number(g.won ?? 0),
      testDrives: mobile ? (driveCount.get(mobile) ?? 0) : 0,
      latestStatus: (CRM_STATUS.includes(g.latestStatus as CrmStatus) ? g.latestStatus : "new") as CrmStatus,
      firstSeen: sqlDate(g.firstSeen)!.toISOString(),
      lastActivity: sqlDate(g.lastActivity)!.toISOString(),
      lastContact: sqlDate(lastContact.get(g.key))?.toISOString() ?? null,
      cars: (g.cars ?? "").split("\x1f").filter(Boolean),
    };
  });
}

/** One customer's enquiries, test drives and combined timeline. */
export async function customerDetail(ctx: PartnerContext, who: { mobile: string } | { email: string }) {
  if (!leadAccess(ctx)) return null;
  const db = getDb();
  const match = "mobile" in who ? eq(partnerLeads.mobile, who.mobile) : sql`LOWER(${partnerLeads.email}) = ${who.email}`;
  const [rows, label] = await Promise.all([leadSelect().where(and(leadScope(ctx), match)).orderBy(desc(partnerLeads.createdAt)), vehicleLabelMap()]);
  if (!rows.length) return null;
  const leadsList = rows.map((r) => toListItem(r, label));
  const ids = leadsList.map((l) => l.id);
  const author = aliasedTable(users, "customer_event_author");
  const [events, drives] = await Promise.all([
    db
      .select({ e: partnerLeadEvents, memberName: author.name, leadRef: partnerLeads.reference })
      .from(partnerLeadEvents)
      .innerJoin(partnerLeads, eq(partnerLeads.id, partnerLeadEvents.leadId))
      .leftJoin(partnerMembers, eq(partnerMembers.id, partnerLeadEvents.memberId))
      .leftJoin(author, eq(author.id, partnerMembers.userId))
      .where(inArray(partnerLeadEvents.leadId, ids))
      .orderBy(desc(partnerLeadEvents.createdAt), desc(partnerLeadEvents.id))
      .limit(500),
    queryTestDrives(ctx, "mobile" in who ? or(eq(partnerTestDrives.mobile, who.mobile), inArray(partnerTestDrives.leadId, ids)) : inArray(partnerTestDrives.leadId, ids), { order: "created" }),
  ]);
  return {
    leads: leadsList,
    drives,
    events: events.map(({ e, memberName, leadRef }) => ({ id: e.id, kind: e.kind, body: e.body, createdAt: e.createdAt.toISOString(), memberName, leadId: e.leadId, leadRef })),
  };
}
