import "server-only";
import { aliasedTable, and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, like, lt, lte, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { adCampaigns, insActivity, insCampaigns, insCompanies, insEnquiries, insEnquiryEvents, insMembers, insProducts, insQuotes, insRenewals, users } from "@/db/schema";
import { INS_INTENTS, INS_LEAD_STATUS, INS_RENEWAL_STATUS, type InsIntent, type InsLeadEventKind, type InsLeadStatus, type InsRenewalStatus } from "@/db/enums";
import { INS_LEAD_STATUS_LABEL, INS_RENEWAL_OPEN, INS_ROLE_LABEL, quoteDisplayStatus } from "@/insurance/labels";
import { insPermissionsFor } from "@/insurance/permissions";
import type { InsurerContext } from "@/server/insurance/context";
import { addDays, istDate } from "@/components/portal/billing/shared";
import {
  INS_LEAD_FINISHED,
  type EnquiryDetail,
  type EnquiryEventItem,
  type EnquiryListItem,
  type MemberOption,
  type ProductOption,
  type QuoteSummary,
  type RenewalActivity,
  type RenewalItem,
} from "@/components/insurance/vendor/crm/shared";

/* ──────────────────────────────────────────────────────────────
   Insurance vendor CRM data layer: enquiries, their timeline,
   quotes on them and renewals. Every query is scoped to the
   signed-in vendor — and, for members who may only see their own
   enquiries, to the enquiries and renewals assigned to them.
   ────────────────────────────────────────────────────────────── */

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const IST_MS = 5.5 * 3_600_000;
/** Start of an IST calendar day as a UTC instant. */
export const istStart = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - IST_MS);

/* ── Access ────────────────────────────────────────────────── */

/** "all" sees every enquiry; "own" only those assigned to them; null none. */
export function enquiryAccess(ctx: InsurerContext): "all" | "own" | null {
  if (ctx.can("enquiries.view_all")) return "all";
  if (ctx.can("enquiries.view_own")) return "own";
  return null;
}

/** WHERE for the enquiries this person may see. */
export function enquiryScope(ctx: InsurerContext): SQL {
  return enquiryAccess(ctx) === "all"
    ? eq(insEnquiries.vendorId, ctx.vendor.id)
    : and(eq(insEnquiries.vendorId, ctx.vendor.id), eq(insEnquiries.assignedMemberId, ctx.member.id))!;
}

/** The enquiry row if this person may see it. */
export async function enquiryInScope(ctx: InsurerContext, id: number) {
  if (!enquiryAccess(ctx) && !ctx.can("quotes.manage") && !ctx.can("renewals.manage")) return null;
  const [row] = await getDb().select().from(insEnquiries).where(and(enquiryScope(ctx), eq(insEnquiries.id, id)));
  return row ?? null;
}

/** Renewals follow the same rule: own-only members see the ones assigned to them. */
export function renewalScope(ctx: InsurerContext): SQL {
  return enquiryAccess(ctx) === "all"
    ? eq(insRenewals.vendorId, ctx.vendor.id)
    : and(eq(insRenewals.vendorId, ctx.vendor.id), eq(insRenewals.assignedMemberId, ctx.member.id))!;
}

export async function renewalInScope(ctx: InsurerContext, id: number) {
  const [row] = await getDb().select().from(insRenewals).where(and(renewalScope(ctx), eq(insRenewals.id, id)));
  return row ?? null;
}

/** Quotes are visible when their enquiry is. */
export function quoteScope(ctx: InsurerContext): SQL {
  if (enquiryAccess(ctx) === "all") return eq(insQuotes.vendorId, ctx.vendor.id);
  return and(
    eq(insQuotes.vendorId, ctx.vendor.id),
    inArray(insQuotes.enquiryId, getDb().select({ id: insEnquiries.id }).from(insEnquiries).where(and(eq(insEnquiries.vendorId, ctx.vendor.id), eq(insEnquiries.assignedMemberId, ctx.member.id)))),
  )!;
}

export async function addEnquiryEvent(
  ctx: Pick<InsurerContext, "vendor" | "user">,
  enquiryId: number,
  kind: InsLeadEventKind,
  body: string,
  meta: Record<string, string | number | boolean | null> | null = null,
) {
  await getDb()
    .insert(insEnquiryEvents)
    .values({ enquiryId, vendorId: ctx.vendor.id, userId: ctx.user.id, kind, body: body.slice(0, 5000), meta });
}

/** Status change + its timeline row. Returns false when nothing changed. */
export async function setEnquiryStatus(ctx: InsurerContext, lead: typeof insEnquiries.$inferSelect, status: InsLeadStatus, extra: { lostReason?: string; note?: string } = {}) {
  if (lead.status === status && (status !== "lost" || lead.lostReason === extra.lostReason)) return false;
  const leavingPolicy = lead.status === "policy_issued" && status !== "policy_issued";
  await getDb()
    .update(insEnquiries)
    .set({
      status,
      lostReason: status === "lost" ? (extra.lostReason ?? null) : null,
      // A finished enquiry no longer needs reminders.
      ...(INS_LEAD_FINISHED.includes(status) ? { followUpAt: null } : {}),
      // Moving off "policy issued" withdraws the (unverified) report.
      ...(leavingPolicy ? { policyIssuedAt: null, policyNumber: null, policyPremium: null } : {}),
    })
    .where(eq(insEnquiries.id, lead.id));
  await addEnquiryEvent(
    ctx,
    lead.id,
    "status",
    `${INS_LEAD_STATUS_LABEL[lead.status]} → ${INS_LEAD_STATUS_LABEL[status]}${status === "lost" && extra.lostReason ? ` · ${extra.lostReason}` : ""}${leavingPolicy ? "\nThe reported policy was withdrawn." : ""}${extra.note ? `\n${extra.note}` : ""}`,
    { from: lead.status, to: status, reason: status === "lost" ? (extra.lostReason ?? null) : null },
  );
  return true;
}

/* ── Pickers ───────────────────────────────────────────────── */

/** Active people at the vendor who can work enquiries (for assignment pickers and filters). */
export async function teamMembers(vendorId: number): Promise<MemberOption[]> {
  const rows = await getDb()
    .select({ id: insMembers.id, userId: insMembers.userId, role: insMembers.role, permissions: insMembers.permissions, name: users.name })
    .from(insMembers)
    .innerJoin(users, eq(users.id, insMembers.userId))
    .where(and(eq(insMembers.vendorId, vendorId), eq(insMembers.isActive, true)))
    .orderBy(asc(users.name));
  return rows
    .filter((m) => {
      const p = insPermissionsFor(m);
      return p.includes("enquiries.view_all") || p.includes("enquiries.view_own");
    })
    .map((m) => ({ id: m.id, userId: m.userId, name: m.name, role: m.role, roleLabel: INS_ROLE_LABEL[m.role] }));
}

/** An active member of this vendor who can work enquiries, or null. */
export async function activeMember(vendorId: number, memberId: number) {
  return (await teamMembers(vendorId)).find((m) => m.id === memberId) ?? null;
}

export async function productOptions(vendorId: number): Promise<ProductOption[]> {
  return getDb()
    .select({ id: insProducts.id, reference: insProducts.reference, name: insProducts.name, category: insProducts.category, status: insProducts.status })
    .from(insProducts)
    .where(eq(insProducts.vendorId, vendorId))
    .orderBy(asc(insProducts.name))
    .limit(300);
}

/** Distinct sources this vendor's enquiries came from (for the filter). */
export async function sourceOptions(vendorId: number): Promise<string[]> {
  const rows = await getDb().selectDistinct({ source: insEnquiries.source }).from(insEnquiries).where(eq(insEnquiries.vendorId, vendorId)).limit(50);
  return rows.map((r) => r.source).sort();
}

/* ── Enquiry list ──────────────────────────────────────────── */

export const ENQUIRY_SORTS = ["newest", "oldest", "follow_up", "expiry", "updated", "name"] as const;
export type EnquirySort = (typeof ENQUIRY_SORTS)[number];

export interface EnquiryFilters {
  q?: string;
  status?: InsLeadStatus;
  intent?: InsIntent;
  product?: number;
  /** "me", "none" or a member id. */
  assigned?: string;
  source?: string;
  from?: string;
  to?: string;
  /** Follow-up due today, or already overdue. */
  due?: "today" | "overdue";
  sort: EnquirySort;
}

type Params = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const posInt = (v: string | string[] | undefined) => {
  const n = Number.parseInt(str(v) ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};
const day = (v: string | string[] | undefined) => {
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) ? s : undefined;
};

export function parseEnquiryFilters(sp: Params): EnquiryFilters {
  const status = str(sp.status);
  const intent = str(sp.intent);
  const sort = str(sp.sort);
  const assigned = str(sp.assigned);
  const source = str(sp.source);
  const due = str(sp.due);
  return {
    q: str(sp.q)?.slice(0, 100),
    status: (INS_LEAD_STATUS as readonly string[]).includes(status ?? "") ? (status as InsLeadStatus) : undefined,
    intent: (INS_INTENTS as readonly string[]).includes(intent ?? "") ? (intent as InsIntent) : undefined,
    product: posInt(sp.product),
    assigned: assigned && (assigned === "me" || assigned === "none" || /^\d+$/.test(assigned)) ? assigned : undefined,
    source: source && /^[a-z0-9_-]{2,40}$/.test(source) ? source : undefined,
    from: day(sp.from),
    to: day(sp.to),
    due: due === "today" || due === "overdue" ? due : undefined,
    sort: (ENQUIRY_SORTS as readonly string[]).includes(sort ?? "") ? (sort as EnquirySort) : "newest",
  };
}

/** The filters as URL params (for links, the export and pagination). */
export function enquiryFilterParams(f: EnquiryFilters): Record<string, string | undefined> {
  return {
    q: f.q,
    status: f.status,
    intent: f.intent,
    product: f.product ? String(f.product) : undefined,
    assigned: f.assigned,
    source: f.source,
    from: f.from,
    to: f.to,
    due: f.due,
    sort: f.sort === "newest" ? undefined : f.sort,
  };
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export function enquiryWhere(ctx: InsurerContext, f: EnquiryFilters, opts: { ignoreStatus?: boolean } = {}): SQL {
  const parts: (SQL | undefined)[] = [enquiryScope(ctx)];
  if (f.q) {
    const q = `%${escapeLike(f.q)}%`;
    const digits = f.q.replace(/\D/g, "");
    const reg = f.q.toUpperCase().replace(/[^A-Z0-9]/g, "");
    parts.push(
      or(
        like(insEnquiries.name, q),
        like(insEnquiries.email, q),
        like(insEnquiries.reference, q),
        reg.length >= 3 ? like(insEnquiries.regNumber, `%${reg}%`) : undefined,
        digits.length >= 3 ? like(insEnquiries.mobile, `%${digits}%`) : undefined,
      ),
    );
  }
  if (f.status && !opts.ignoreStatus) parts.push(eq(insEnquiries.status, f.status));
  if (f.intent) parts.push(eq(insEnquiries.intent, f.intent));
  if (f.product) parts.push(eq(insEnquiries.productId, f.product));
  if (f.source) parts.push(eq(insEnquiries.source, f.source));
  if (enquiryAccess(ctx) === "all") {
    if (f.assigned === "me") parts.push(eq(insEnquiries.assignedMemberId, ctx.member.id));
    else if (f.assigned === "none") parts.push(isNull(insEnquiries.assignedMemberId));
    else if (f.assigned) parts.push(eq(insEnquiries.assignedMemberId, Number(f.assigned)));
  }
  if (f.from) parts.push(gte(insEnquiries.createdAt, istStart(f.from)));
  if (f.to) parts.push(lt(insEnquiries.createdAt, istStart(addDays(f.to, 1))));
  if (f.due) {
    const today = istDate();
    parts.push(isNotNull(insEnquiries.followUpAt), notInArray(insEnquiries.status, INS_LEAD_FINISHED));
    if (f.due === "overdue") parts.push(lt(insEnquiries.followUpAt, new Date()));
    else parts.push(gte(insEnquiries.followUpAt, istStart(today)), lt(insEnquiries.followUpAt, istStart(addDays(today, 1))));
  }
  return and(...parts)!;
}

const assignee = aliasedTable(users, "ins_assignee_user");

function enquirySelect() {
  return getDb()
    .select({ e: insEnquiries, assignedName: assignee.name, productName: insProducts.name, productRef: insProducts.reference })
    .from(insEnquiries)
    .leftJoin(insMembers, eq(insMembers.id, insEnquiries.assignedMemberId))
    .leftJoin(assignee, eq(assignee.id, insMembers.userId))
    .leftJoin(insProducts, eq(insProducts.id, insEnquiries.productId));
}

type SelectedEnquiry = Awaited<ReturnType<ReturnType<typeof enquirySelect>["where"]>>[number];

function toListItem(r: SelectedEnquiry): EnquiryListItem {
  const e = r.e;
  return {
    id: e.id,
    reference: e.reference,
    intent: e.intent,
    name: e.name,
    mobile: e.mobile,
    email: e.email,
    regNumber: e.regNumber,
    vehicleIsNew: e.vehicleIsNew,
    brandName: e.brandName,
    modelName: e.modelName,
    variantName: e.variantName,
    year: e.year,
    fuel: e.fuel,
    city: e.city,
    state: e.state,
    policyStatus: e.policyStatus,
    policyExpiry: e.policyExpiry,
    product: e.productId && r.productName ? { id: e.productId, name: r.productName, reference: r.productRef ?? "" } : null,
    source: e.source,
    status: e.status,
    lostReason: e.lostReason,
    followUpAt: iso(e.followUpAt),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    assigned: e.assignedMemberId && r.assignedName ? { id: e.assignedMemberId, name: r.assignedName } : null,
    indicativePremium: e.indicativePremium,
  };
}

const ORDER = {
  newest: [desc(insEnquiries.createdAt), desc(insEnquiries.id)],
  oldest: [asc(insEnquiries.createdAt), asc(insEnquiries.id)],
  updated: [desc(insEnquiries.updatedAt), desc(insEnquiries.id)],
  name: [asc(insEnquiries.name), desc(insEnquiries.id)],
  // Soonest first; rows without a date last.
  follow_up: [sql`${insEnquiries.followUpAt} IS NULL`, asc(insEnquiries.followUpAt), desc(insEnquiries.id)],
  expiry: [sql`${insEnquiries.policyExpiry} IS NULL`, asc(insEnquiries.policyExpiry), desc(insEnquiries.id)],
} as const;

export async function queryEnquiries(ctx: InsurerContext, f: EnquiryFilters, page: { limit: number; offset: number }) {
  const where = enquiryWhere(ctx, f);
  const [rows, [{ total }]] = await Promise.all([
    enquirySelect()
      .where(where)
      .orderBy(...ORDER[f.sort])
      .limit(page.limit)
      .offset(page.offset),
    getDb().select({ total: count() }).from(insEnquiries).where(where),
  ]);
  return { rows: rows.map(toListItem), total };
}

/** Enquiries per status for the current filters (ignoring the status filter itself), plus follow-ups due. */
export async function enquiryCounts(ctx: InsurerContext, f: EnquiryFilters) {
  const db = getDb();
  const base = enquiryWhere(ctx, { ...f, due: undefined }, { ignoreStatus: true });
  const today = istDate();
  const open = notInArray(insEnquiries.status, INS_LEAD_FINISHED);
  const [byStatus, [{ overdue }], [{ dueToday }]] = await Promise.all([
    db.select({ status: insEnquiries.status, n: count() }).from(insEnquiries).where(base).groupBy(insEnquiries.status),
    db
      .select({ overdue: count() })
      .from(insEnquiries)
      .where(and(enquiryScope(ctx), open, isNotNull(insEnquiries.followUpAt), lt(insEnquiries.followUpAt, new Date()))),
    db
      .select({ dueToday: count() })
      .from(insEnquiries)
      .where(and(enquiryScope(ctx), open, gte(insEnquiries.followUpAt, istStart(today)), lt(insEnquiries.followUpAt, istStart(addDays(today, 1))))),
  ]);
  const counts = Object.fromEntries(INS_LEAD_STATUS.map((s) => [s, 0])) as Record<InsLeadStatus, number>;
  for (const r of byStatus) counts[r.status] = Number(r.n);
  return { byStatus: counts, total: Object.values(counts).reduce((a, b) => a + b, 0), overdue: Number(overdue), dueToday: Number(dueToday) };
}

/** Every filtered enquiry (for the export). */
export async function allEnquiries(ctx: InsurerContext, f: EnquiryFilters, limit = 10_000) {
  const rows = await enquirySelect()
    .where(enquiryWhere(ctx, f))
    .orderBy(...ORDER[f.sort])
    .limit(limit);
  return rows.map(toListItem);
}

/* ── Quotes (summaries for enquiry pages) ──────────────────── */

export async function quoteSummaries(ctx: InsurerContext, where: SQL, limit = 100): Promise<QuoteSummary[]> {
  const today = istDate();
  const rows = await getDb()
    .select({ q: insQuotes, productName: insProducts.name, enquiryRef: insEnquiries.reference })
    .from(insQuotes)
    .innerJoin(insEnquiries, eq(insEnquiries.id, insQuotes.enquiryId))
    .leftJoin(insProducts, eq(insProducts.id, insQuotes.productId))
    .where(and(quoteScope(ctx), where))
    .orderBy(desc(insQuotes.createdAt), desc(insQuotes.id))
    .limit(limit);
  return rows.map(({ q, productName, enquiryRef }) => ({
    id: q.id,
    reference: q.reference,
    status: q.status,
    display: quoteDisplayStatus(q, today),
    authorization: q.authorization,
    total: q.total,
    validUntil: q.validUntil,
    productName,
    createdAt: q.createdAt.toISOString(),
    submittedAt: iso(q.submittedAt),
    enquiryId: q.enquiryId,
    enquiryReference: enquiryRef,
  }));
}

/* ── One enquiry ───────────────────────────────────────────── */

const author = aliasedTable(users, "ins_event_author");

export async function enquiryEvents(enquiryId: number, limit = 300): Promise<EnquiryEventItem[]> {
  const rows = await getDb()
    .select({ e: insEnquiryEvents, name: author.name, role: author.role })
    .from(insEnquiryEvents)
    .leftJoin(author, eq(author.id, insEnquiryEvents.userId))
    .where(eq(insEnquiryEvents.enquiryId, enquiryId))
    .orderBy(desc(insEnquiryEvents.createdAt), desc(insEnquiryEvents.id))
    .limit(limit);
  return rows.map(({ e, name, role }) => ({
    id: e.id,
    kind: e.kind,
    body: e.body ?? "",
    meta: e.meta,
    createdAt: e.createdAt.toISOString(),
    // Team members by name; customers (signed in or not) as "Customer".
    author: role === "insurer" ? name : e.userId || e.kind === "created" || ["accepted", "declined", "viewed"].includes(String(e.meta?.action ?? "")) ? "Customer" : null,
  }));
}

export async function getEnquiryDetail(ctx: InsurerContext, id: number): Promise<EnquiryDetail | null> {
  if (!enquiryAccess(ctx)) return null;
  const db = getDb();
  const [row] = await enquirySelect().where(and(enquiryScope(ctx), eq(insEnquiries.id, id)));
  if (!row) return null;
  const e = row.e;
  const [events, product, campaign, ad, quotes, renewals, others] = await Promise.all([
    enquiryEvents(id),
    e.productId
      ? db
          .select({ id: insProducts.id, reference: insProducts.reference, name: insProducts.name, code: insProducts.code, category: insProducts.category, status: insProducts.status, companyName: insCompanies.name })
          .from(insProducts)
          .leftJoin(insCompanies, eq(insCompanies.id, insProducts.companyId))
          .where(and(eq(insProducts.id, e.productId), eq(insProducts.vendorId, ctx.vendor.id)))
      : Promise.resolve([]),
    e.campaignId
      ? db
          .select({ id: insCampaigns.id, reference: insCampaigns.reference, title: insCampaigns.title })
          .from(insCampaigns)
          .where(and(eq(insCampaigns.id, e.campaignId), eq(insCampaigns.vendorId, ctx.vendor.id)))
      : Promise.resolve([]),
    e.adCampaignId
      ? db
          .select({ id: adCampaigns.id, reference: adCampaigns.reference, name: adCampaigns.name })
          .from(adCampaigns)
          .where(and(eq(adCampaigns.id, e.adCampaignId), eq(adCampaigns.insVendorId, ctx.vendor.id)))
      : Promise.resolve([]),
    quoteSummaries(ctx, eq(insQuotes.enquiryId, id)),
    db
      .select({ id: insRenewals.id, reference: insRenewals.reference, status: insRenewals.status, expiryDate: insRenewals.expiryDate, source: insRenewals.source })
      .from(insRenewals)
      .where(and(eq(insRenewals.vendorId, ctx.vendor.id), eq(insRenewals.enquiryId, id)))
      .orderBy(desc(insRenewals.createdAt)),
    // Customer history: this person's other enquiries with this vendor that the viewer may see.
    enquirySelect()
      .where(and(enquiryScope(ctx), eq(insEnquiries.mobile, e.mobile), ne(insEnquiries.id, id)))
      .orderBy(desc(insEnquiries.createdAt))
      .limit(25),
  ]);
  const otherEnquiries = others.map(toListItem);
  const otherQuotes = otherEnquiries.length ? await quoteSummaries(ctx, inArray(insQuotes.enquiryId, otherEnquiries.map((o) => o.id)), 50) : [];
  return {
    ...toListItem(row),
    userId: e.userId,
    previousInsurer: e.previousInsurer,
    ncbPct: e.ncbPct,
    claimedLastYear: e.claimedLastYear,
    addOns: e.addOns ?? [],
    idv: e.idv,
    estimate: e.estimate,
    message: e.message,
    consentAt: e.consentAt.toISOString(),
    brand: e.brand,
    model: e.model,
    variant: e.variant,
    productDetail: product[0] ?? null,
    campaign: campaign[0] ?? null,
    adCampaign: ad[0] ?? null,
    policyIssuedAt: iso(e.policyIssuedAt),
    policyNumber: e.policyNumber,
    policyPremium: e.policyPremium,
    conversionVerifiedAt: iso(e.conversionVerifiedAt),
    events,
    quotes,
    renewals,
    history: { enquiries: otherEnquiries, quotes: otherQuotes },
  };
}

/* ── Renewals ──────────────────────────────────────────────── */

export const RENEWAL_VIEWS = ["upcoming", "overdue", "expired", "renewed", "all"] as const;
export type RenewalView = (typeof RENEWAL_VIEWS)[number];
export const RENEWAL_WINDOWS = [7, 15, 30] as const;

export interface RenewalFilters {
  view: RenewalView;
  /** Days ahead for "upcoming": 7, 15, 30 or the settings window. */
  within: number;
  q?: string;
  status?: InsRenewalStatus;
  assigned?: string;
  sort: "expiry" | "follow_up" | "newest";
}

export function parseRenewalFilters(sp: Params, windowDays: number): RenewalFilters {
  const view = str(sp.view);
  const within = Number(str(sp.within));
  const status = str(sp.status);
  const assigned = str(sp.assigned);
  const sort = str(sp.sort);
  const windows = [...RENEWAL_WINDOWS, windowDays];
  return {
    view: (RENEWAL_VIEWS as readonly string[]).includes(view ?? "") ? (view as RenewalView) : "upcoming",
    within: windows.includes(within) ? within : windowDays,
    q: str(sp.q)?.slice(0, 100),
    status: (INS_RENEWAL_STATUS as readonly string[]).includes(status ?? "") ? (status as InsRenewalStatus) : undefined,
    assigned: assigned && (assigned === "me" || assigned === "none" || /^\d+$/.test(assigned)) ? assigned : undefined,
    sort: sort === "follow_up" || sort === "newest" ? sort : "expiry",
  };
}

export function renewalFilterParams(f: RenewalFilters, windowDays: number): Record<string, string | undefined> {
  return {
    view: f.view === "upcoming" ? undefined : f.view,
    within: f.view === "upcoming" && f.within !== windowDays ? String(f.within) : undefined,
    q: f.q,
    status: f.status,
    assigned: f.assigned,
    sort: f.sort === "expiry" ? undefined : f.sort,
  };
}

/** The view's own condition (upcoming / overdue follow-ups / expired or lapsed / renewed / all). */
function renewalViewWhere(view: RenewalView, within: number): SQL | undefined {
  const today = istDate();
  const open = inArray(insRenewals.status, INS_RENEWAL_OPEN);
  switch (view) {
    case "upcoming":
      return and(open, gte(insRenewals.expiryDate, today), lte(insRenewals.expiryDate, addDays(today, within)));
    case "overdue":
      return and(open, isNotNull(insRenewals.followUpAt), lt(insRenewals.followUpAt, new Date()));
    case "expired":
      return or(eq(insRenewals.status, "lapsed"), and(open, lt(insRenewals.expiryDate, today)));
    case "renewed":
      return eq(insRenewals.status, "renewed");
    default:
      return undefined;
  }
}

function renewalWhere(ctx: InsurerContext, f: RenewalFilters, opts: { ignoreView?: boolean } = {}): SQL {
  const parts: (SQL | undefined)[] = [renewalScope(ctx)];
  if (!opts.ignoreView) parts.push(renewalViewWhere(f.view, f.within));
  if (f.q) {
    const q = `%${escapeLike(f.q)}%`;
    const digits = f.q.replace(/\D/g, "");
    const reg = f.q.toUpperCase().replace(/[^A-Z0-9]/g, "");
    parts.push(
      or(
        like(insRenewals.name, q),
        like(insRenewals.reference, q),
        like(insRenewals.policyNumber, q),
        like(insRenewals.email, q),
        reg.length >= 3 ? like(insRenewals.regNumber, `%${reg}%`) : undefined,
        digits.length >= 3 ? like(insRenewals.mobile, `%${digits}%`) : undefined,
      ),
    );
  }
  if (f.status) parts.push(eq(insRenewals.status, f.status));
  if (enquiryAccess(ctx) === "all") {
    if (f.assigned === "me") parts.push(eq(insRenewals.assignedMemberId, ctx.member.id));
    else if (f.assigned === "none") parts.push(isNull(insRenewals.assignedMemberId));
    else if (f.assigned) parts.push(eq(insRenewals.assignedMemberId, Number(f.assigned)));
  }
  return and(...parts)!;
}

const renewalAssignee = aliasedTable(users, "ins_renewal_assignee");

function renewalSelect() {
  return getDb()
    .select({ r: insRenewals, assignedName: renewalAssignee.name, enquiryRef: insEnquiries.reference, enquiryStatus: insEnquiries.status })
    .from(insRenewals)
    .leftJoin(insMembers, eq(insMembers.id, insRenewals.assignedMemberId))
    .leftJoin(renewalAssignee, eq(renewalAssignee.id, insMembers.userId))
    .leftJoin(insEnquiries, and(eq(insEnquiries.id, insRenewals.enquiryId), eq(insEnquiries.vendorId, insRenewals.vendorId)));
}

type SelectedRenewal = Awaited<ReturnType<ReturnType<typeof renewalSelect>["where"]>>[number];

function toRenewal(row: SelectedRenewal): RenewalItem {
  const r = row.r;
  return {
    id: r.id,
    reference: r.reference,
    enquiry: r.enquiryId && row.enquiryRef ? { id: r.enquiryId, reference: row.enquiryRef, status: row.enquiryStatus ?? "new" } : null,
    name: r.name,
    mobile: r.mobile,
    email: r.email,
    regNumber: r.regNumber,
    brandName: r.brandName,
    modelName: r.modelName,
    variantName: r.variantName,
    year: r.year,
    fuel: r.fuel,
    city: r.city,
    currentInsurer: r.currentInsurer,
    policyNumber: r.policyNumber,
    policyType: r.policyType,
    expiryDate: r.expiryDate,
    ncbPct: r.ncbPct,
    premium: r.premium,
    status: r.status,
    assigned: r.assignedMemberId && row.assignedName ? { id: r.assignedMemberId, name: row.assignedName } : null,
    followUpAt: iso(r.followUpAt),
    notes: r.notes,
    renewedAt: iso(r.renewedAt),
    source: r.source,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

const RENEWAL_ORDER = {
  expiry: [asc(insRenewals.expiryDate), asc(insRenewals.id)],
  follow_up: [sql`${insRenewals.followUpAt} IS NULL`, asc(insRenewals.followUpAt), asc(insRenewals.expiryDate)],
  newest: [desc(insRenewals.createdAt), desc(insRenewals.id)],
} as const;

export async function queryRenewals(ctx: InsurerContext, f: RenewalFilters, page: { limit: number; offset: number }) {
  const where = renewalWhere(ctx, f);
  const [rows, [{ total }]] = await Promise.all([
    renewalSelect()
      .where(where)
      .orderBy(...RENEWAL_ORDER[f.sort])
      .limit(page.limit)
      .offset(page.offset),
    getDb().select({ total: count() }).from(insRenewals).where(where),
  ]);
  return { rows: rows.map(toRenewal), total };
}

/** Counts per view (respecting search/status/assignee) and the renewal pipeline per status. */
export async function renewalCounts(ctx: InsurerContext, f: RenewalFilters, windowDays: number) {
  const db = getDb();
  const base = renewalWhere(ctx, f, { ignoreView: true });
  const views = await Promise.all(
    (["upcoming", "overdue", "expired", "renewed", "all"] as const).map(async (v) => {
      const [{ n }] = await db
        .select({ n: count() })
        .from(insRenewals)
        .where(and(base, renewalViewWhere(v, v === "upcoming" ? f.within : windowDays)));
      return [v, Number(n)] as const;
    }),
  );
  const windows = await Promise.all(
    [...new Set([...RENEWAL_WINDOWS, windowDays])].map(async (w) => {
      const [{ n }] = await db
        .select({ n: count() })
        .from(insRenewals)
        .where(and(base, renewalViewWhere("upcoming", w)));
      return [w, Number(n)] as const;
    }),
  );
  return { views: Object.fromEntries(views) as Record<RenewalView, number>, windows: Object.fromEntries(windows) as Record<number, number> };
}

export async function getRenewal(ctx: InsurerContext, id: number): Promise<{ renewal: RenewalItem; activity: RenewalActivity[] } | null> {
  const [row] = await renewalSelect().where(and(renewalScope(ctx), eq(insRenewals.id, id)));
  if (!row) return null;
  const actor = aliasedTable(users, "ins_renewal_actor");
  const activity = await getDb()
    .select({ id: insActivity.id, summary: insActivity.summary, createdAt: insActivity.createdAt, name: actor.name })
    .from(insActivity)
    .leftJoin(actor, eq(actor.id, insActivity.userId))
    .where(and(eq(insActivity.vendorId, ctx.vendor.id), eq(insActivity.entity, "renewal"), eq(insActivity.entityId, String(id))))
    .orderBy(desc(insActivity.createdAt), desc(insActivity.id))
    .limit(100);
  return { renewal: toRenewal(row), activity: activity.map((a) => ({ id: a.id, summary: a.summary, author: a.name, createdAt: a.createdAt.toISOString() })) };
}
