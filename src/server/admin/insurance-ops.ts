import "server-only";
import { and, asc, count, desc, eq, gt, gte, inArray, isNotNull, isNull, like, lt, lte, max, ne, or, sql, type SQL } from "drizzle-orm";
import type { AnyMySqlColumn } from "drizzle-orm/mysql-core";
import { getDb } from "@/db";
import {
  adCampaigns,
  adPlacements,
  adStats,
  auditLog,
  insApprovals,
  insCampaigns,
  insCompanies,
  insEnquiries,
  insEnquiryEvents,
  insEvents,
  insInvoices,
  insMembers,
  insPayments,
  insProducts,
  insQuotes,
  insRefunds,
  insRenewals,
  insTicketMessages,
  insTickets,
  insVendors,
  users,
} from "@/db/schema";
import {
  INS_APPROVAL_TARGETS,
  INS_CAMPAIGN_TYPES,
  INS_INTENTS,
  INS_INVOICE_KINDS,
  INS_LEAD_STATUS,
  INS_PRODUCT_CATEGORIES,
  INS_QUOTE_AUTHORIZATION,
  INS_RENEWAL_STATUS,
  INVOICE_STATUS,
  PAYMENT_STATUS,
  TICKET_PRIORITY,
  TICKET_STATUS,
  type InsApprovalTarget,
  type InsInvoiceKind,
  type InsProductCategory,
  type InsQuoteStatus,
  type TicketStatus,
} from "@/db/enums";
import { INS_RENEWAL_OPEN, quoteDisplayStatus } from "@/insurance/labels";
import { insInvoiceDisplayStatus } from "@/server/insurance/billing";
import { campaignSlotsUsed } from "@/server/insurance/subscription";
import { requireStaff, STAFF_ROLES } from "@/server/auth";
import { getCatalog } from "@/server/catalog";
import { addDays, istDate } from "@/components/portal/billing/shared";
import { DEVIATION_LIMIT } from "@/components/admin/insurance/ops/labels";

/* ──────────────────────────────────────────────────────────────
   Queries behind /admin/insurance/{enquiries, quotes, renewals,
   campaigns, revenue, payments, invoices, refunds, reports, audit,
   support}. Staff only — every exported reader checks access.
   Money: "collected" = verified payments − refunds; "outstanding"
   = what's still unpaid on due / verifying invoices. Never mixed.
   ────────────────────────────────────────────────────────────── */

export const PAGE_SIZE = 30;
const IST_OFFSET_MS = 330 * 60_000;
const MAX_PAGE = 200;

/* ── Small helpers ──────────────────────────────────────────── */

/** A real YYYY-MM-DD calendar day ("2026-02-31" is not). */
export function isDay(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const t = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === v;
}
/** Midnight IST at the start of a day, as the UTC instant stored in datetime columns. */
export const istStart = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - IST_OFFSET_MS);

export interface DayRange {
  from?: string;
  to?: string;
}
/** A valid from/to pair (either may be missing), swapped if entered the wrong way round. */
export function dayRange(from?: string, to?: string): DayRange {
  let f = isDay(from) ? from : undefined;
  let t = isDay(to) ? to : undefined;
  if (f && t && f > t) [f, t] = [t, f];
  return { from: f, to: t };
}
/** datetime column within IST days. */
const within = (col: AnyMySqlColumn, r: DayRange) => [r.from ? gte(col, istStart(r.from)) : undefined, r.to ? lt(col, istStart(addDays(r.to, 1))) : undefined];
/** date column within IST days. */
const dayWithin = (col: AnyMySqlColumn, r: DayRange) => [r.from ? gte(col, r.from) : undefined, r.to ? lte(col, r.to) : undefined];

/** Search text matched literally (% and _ are not wildcards). */
export const term = (q: string) => `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
export const numId = (v?: string | null) => (v && /^\d{1,9}$/.test(v) ? Number(v) : undefined);
export const oneOf = <T extends string>(list: readonly T[], v?: string | null): T | undefined => (v && (list as readonly string[]).includes(v) ? (v as T) : undefined);
const clampPage = (page: number | undefined, total: number) => Math.min(Math.max(1, page ?? 1), Math.max(1, Math.ceil(total / PAGE_SIZE)), MAX_PAGE);
const n = (v: unknown) => Number(v ?? 0) || 0;
const inIst = (d: Date | string, r: DayRange) => {
  const day = istDate(d);
  return (!r.from || day >= r.from) && (!r.to || day <= r.to);
};
const dayIn = (day: string, r: DayRange) => (!r.from || day >= r.from) && (!r.to || day <= r.to);

/** Vendor name columns for joins. */
const V = { vendorId: insVendors.id, vendorRef: insVendors.reference, vendorBrand: insVendors.brandName, vendorLegal: insVendors.legalName };
export const vendorLabel = (r: { vendorBrand: string | null; vendorLegal: string | null; vendorRef: string }) => r.vendorBrand || r.vendorLegal || r.vendorRef;
const vendorSearch = (q: string) => [like(insVendors.brandName, term(q)), like(insVendors.legalName, term(q)), like(insVendors.reference, term(q))];

export async function insuranceSettings() {
  return (await getCatalog()).content.insuranceSettings;
}

/** Every vendor past the draft stage, for filters. */
export async function vendorOptions() {
  const rows = await getDb().select(V).from(insVendors).where(ne(insVendors.status, "draft"));
  return rows.map((r) => ({ value: String(r.vendorId), label: `${vendorLabel(r)} (${r.vendorRef})` })).sort((a, b) => a.label.localeCompare(b.label));
}

/** Vendors staff may invoice (approved or suspended). */
export async function billableVendorOptions() {
  const rows = await getDb().select(V).from(insVendors).where(inArray(insVendors.status, ["approved", "suspended"]));
  return rows.map((r) => ({ value: String(r.vendorId), label: `${vendorLabel(r)} (${r.vendorRef})` })).sort((a, b) => a.label.localeCompare(b.label));
}

/** Active staff accounts (audit filters, internal notes). */
export async function staffOptions() {
  const rows = await getDb().select({ id: users.id, name: users.name }).from(users).where(inArray(users.role, STAFF_ROLES)).orderBy(asc(users.name));
  return rows.map((r) => ({ value: String(r.id), label: r.name }));
}

/* ══ Enquiries ══════════════════════════════════════════════════ */

export interface EnquiryFilters {
  q?: string;
  vendor?: string;
  status?: string;
  intent?: string;
  product?: string;
  company?: string;
  city?: string;
  source?: string;
  from?: string;
  to?: string;
  conversion?: string;
}

function enquiryWhere(f: EnquiryFilters) {
  const r = dayRange(f.from, f.to);
  const status = oneOf(INS_LEAD_STATUS, f.status);
  const intent = oneOf(INS_INTENTS, f.intent);
  const conds: (SQL | undefined)[] = [
    numId(f.vendor) ? eq(insEnquiries.vendorId, numId(f.vendor)!) : undefined,
    status ? eq(insEnquiries.status, status) : undefined,
    intent ? eq(insEnquiries.intent, intent) : undefined,
    numId(f.product) ? eq(insEnquiries.productId, numId(f.product)!) : undefined,
    numId(f.company) ? eq(insEnquiries.companyId, numId(f.company)!) : undefined,
    f.city ? eq(insEnquiries.city, f.city.slice(0, 64)) : undefined,
    f.source ? eq(insEnquiries.source, f.source.slice(0, 40)) : undefined,
    ...within(insEnquiries.createdAt, r),
    f.conversion === "verified"
      ? isNotNull(insEnquiries.conversionVerifiedAt)
      : f.conversion === "reported"
        ? and(eq(insEnquiries.status, "policy_issued"), isNull(insEnquiries.conversionVerifiedAt))
        : f.conversion === "none"
          ? and(ne(insEnquiries.status, "policy_issued"), isNull(insEnquiries.conversionVerifiedAt))
          : undefined,
    f.q
      ? or(
          like(insEnquiries.name, term(f.q)),
          like(insEnquiries.mobile, term(f.q)),
          like(insEnquiries.email, term(f.q)),
          like(insEnquiries.reference, term(f.q)),
          like(insEnquiries.regNumber, term(f.q)),
          like(insEnquiries.policyNumber, term(f.q)),
          ...vendorSearch(f.q),
        )
      : undefined,
  ];
  return and(...conds);
}

/** `ins_enquiries`.`id` spelled out for correlated subqueries (Drizzle writes a bare `id` in single-table selects). */
const ENQUIRY_ID = sql.raw("`ins_enquiries`.`id`");

const enquiryCols = {
  id: insEnquiries.id,
  reference: insEnquiries.reference,
  intent: insEnquiries.intent,
  name: insEnquiries.name,
  mobile: insEnquiries.mobile,
  email: insEnquiries.email,
  regNumber: insEnquiries.regNumber,
  brandName: insEnquiries.brandName,
  modelName: insEnquiries.modelName,
  variantName: insEnquiries.variantName,
  year: insEnquiries.year,
  fuel: insEnquiries.fuel,
  city: insEnquiries.city,
  state: insEnquiries.state,
  status: insEnquiries.status,
  source: insEnquiries.source,
  createdAt: insEnquiries.createdAt,
  policyNumber: insEnquiries.policyNumber,
  policyIssuedAt: insEnquiries.policyIssuedAt,
  policyPremium: insEnquiries.policyPremium,
  conversionVerifiedAt: insEnquiries.conversionVerifiedAt,
  indicativePremium: insEnquiries.indicativePremium,
  policyExpiry: insEnquiries.policyExpiry,
  ...V,
  productId: insEnquiries.productId,
  productName: insProducts.name,
  productCategory: insProducts.category,
  companyName: insCompanies.name,
  quotes: sql<number>`(SELECT COUNT(*) FROM ins_quotes q WHERE q.enquiry_id = ${ENQUIRY_ID} AND q.status <> 'draft')`,
};

function enquiryQuery(f: EnquiryFilters) {
  return getDb()
    .select(enquiryCols)
    .from(insEnquiries)
    .innerJoin(insVendors, eq(insVendors.id, insEnquiries.vendorId))
    .leftJoin(insProducts, eq(insProducts.id, insEnquiries.productId))
    .leftJoin(insCompanies, eq(insCompanies.id, insEnquiries.companyId))
    .where(enquiryWhere(f))
    .orderBy(desc(insEnquiries.createdAt), desc(insEnquiries.id));
}

export async function listInsEnquiries(f: EnquiryFilters, page?: number) {
  await requireStaff();
  const [{ total }] = await getDb().select({ total: count() }).from(insEnquiries).innerJoin(insVendors, eq(insVendors.id, insEnquiries.vendorId)).where(enquiryWhere(f));
  const p = clampPage(page, total);
  const rows = await enquiryQuery(f)
    .limit(PAGE_SIZE)
    .offset((p - 1) * PAGE_SIZE);
  return { rows: rows.map((r) => ({ ...r, quotes: n(r.quotes) })), total, page: p };
}

/** Same filters as the list, for CSV (capped). */
export async function exportInsEnquiries(f: EnquiryFilters) {
  await requireStaff();
  const rows = await enquiryQuery(f).limit(20_000);
  return rows.map((r) => ({ ...r, quotes: n(r.quotes) }));
}

export async function enquiryCounts() {
  await requireStaff();
  const start = istStart(istDate());
  const [r] = await getDb()
    .select({
      total: count(),
      today: sql<string>`SUM(${gte(insEnquiries.createdAt, start)})`,
      fresh: sql<string>`SUM(${insEnquiries.status} = 'new')`,
      reported: sql<string>`SUM(${insEnquiries.status} = 'policy_issued' AND ${insEnquiries.conversionVerifiedAt} IS NULL)`,
      verified: sql<string>`SUM(${insEnquiries.conversionVerifiedAt} IS NOT NULL)`,
    })
    .from(insEnquiries);
  return { total: r?.total ?? 0, today: n(r?.today), fresh: n(r?.fresh), reported: n(r?.reported), verified: n(r?.verified) };
}

/** Options for the enquiry filters, from what's actually in the table. */
export async function enquiryFilterOptions() {
  await requireStaff();
  const db = getDb();
  const [vendors, products, companies, cities, sources] = await Promise.all([
    vendorOptions(),
    db
      .selectDistinct({ id: insProducts.id, name: insProducts.name, code: insProducts.code })
      .from(insProducts)
      .innerJoin(insEnquiries, eq(insEnquiries.productId, insProducts.id)),
    db.selectDistinct({ id: insCompanies.id, name: insCompanies.name }).from(insCompanies).innerJoin(insEnquiries, eq(insEnquiries.companyId, insCompanies.id)),
    db.selectDistinct({ city: insEnquiries.city }).from(insEnquiries).where(isNotNull(insEnquiries.city)),
    db.selectDistinct({ source: insEnquiries.source }).from(insEnquiries),
  ]);
  return {
    vendors,
    products: products.map((p) => ({ value: String(p.id), label: `${p.name} (${p.code})` })).sort((a, b) => a.label.localeCompare(b.label)),
    companies: companies.map((c) => ({ value: String(c.id), label: c.name })).sort((a, b) => a.label.localeCompare(b.label)),
    cities: cities
      .map((c) => c.city!)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b)),
    sources: sources.map((s) => s.source).sort(),
  };
}

export async function getInsEnquiry(id: number) {
  await requireStaff();
  const db = getDb();
  const [row] = await db
    .select({ e: insEnquiries, v: insVendors, product: { id: insProducts.id, name: insProducts.name, reference: insProducts.reference, category: insProducts.category, status: insProducts.status }, companyName: insCompanies.name })
    .from(insEnquiries)
    .innerJoin(insVendors, eq(insVendors.id, insEnquiries.vendorId))
    .leftJoin(insProducts, eq(insProducts.id, insEnquiries.productId))
    .leftJoin(insCompanies, eq(insCompanies.id, insEnquiries.companyId))
    .where(eq(insEnquiries.id, id));
  if (!row) return null;
  const e = row.e;
  const [events, quotes, renewals, approvals, leadFees, assigned, account, verifier, campaign, adCampaign] = await Promise.all([
    db
      .select({ id: insEnquiryEvents.id, kind: insEnquiryEvents.kind, body: insEnquiryEvents.body, meta: insEnquiryEvents.meta, createdAt: insEnquiryEvents.createdAt, userName: users.name, userRole: users.role })
      .from(insEnquiryEvents)
      .leftJoin(users, eq(users.id, insEnquiryEvents.userId))
      .where(eq(insEnquiryEvents.enquiryId, id))
      .orderBy(desc(insEnquiryEvents.createdAt), desc(insEnquiryEvents.id)),
    db.select().from(insQuotes).where(eq(insQuotes.enquiryId, id)).orderBy(desc(insQuotes.createdAt)),
    db.select().from(insRenewals).where(eq(insRenewals.enquiryId, id)).orderBy(desc(insRenewals.createdAt)),
    approvalsFor("conversion", [id]),
    db
      .select({ id: insInvoices.id, number: insInvoices.number, status: insInvoices.status, dueOn: insInvoices.dueOn, total: insInvoices.total })
      .from(insInvoices)
      .where(and(eq(insInvoices.vendorId, e.vendorId), eq(insInvoices.kind, "lead_fee"), like(insInvoices.description, term(e.reference))))
      .orderBy(desc(insInvoices.createdAt)),
    e.assignedMemberId
      ? db.select({ name: users.name }).from(insMembers).innerJoin(users, eq(users.id, insMembers.userId)).where(eq(insMembers.id, e.assignedMemberId))
      : Promise.resolve([]),
    e.userId ? db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, e.userId)) : Promise.resolve([]),
    e.conversionVerifiedBy ? db.select({ name: users.name }).from(users).where(eq(users.id, e.conversionVerifiedBy)) : Promise.resolve([]),
    e.campaignId ? db.select({ id: insCampaigns.id, title: insCampaigns.title, reference: insCampaigns.reference }).from(insCampaigns).where(eq(insCampaigns.id, e.campaignId)) : Promise.resolve([]),
    e.adCampaignId ? db.select({ id: adCampaigns.id, name: adCampaigns.name, reference: adCampaigns.reference }).from(adCampaigns).where(eq(adCampaigns.id, e.adCampaignId)) : Promise.resolve([]),
  ]);
  return {
    ...row,
    events,
    quotes,
    renewals,
    approvals,
    leadFees,
    assignedName: assigned[0]?.name ?? null,
    account: account[0] ?? null,
    verifierName: verifier[0]?.name ?? null,
    campaign: campaign[0] ?? null,
    adCampaign: adCampaign[0] ?? null,
  };
}

/** Approval-history rows for some records of one workflow, newest first. */
export async function approvalsFor(target: InsApprovalTarget, ids: number[]) {
  if (!ids.length) return [];
  return getDb()
    .select({
      id: insApprovals.id,
      vendorId: insApprovals.vendorId,
      target: insApprovals.target,
      targetId: insApprovals.targetId,
      action: insApprovals.action,
      fromStatus: insApprovals.fromStatus,
      toStatus: insApprovals.toStatus,
      remarks: insApprovals.remarks,
      actorSide: insApprovals.actorSide,
      actorName: users.name,
      createdAt: insApprovals.createdAt,
    })
    .from(insApprovals)
    .leftJoin(users, eq(users.id, insApprovals.actorUserId))
    .where(and(eq(insApprovals.target, target), inArray(insApprovals.targetId, ids)))
    .orderBy(desc(insApprovals.createdAt), desc(insApprovals.id));
}

/* ══ Quotes ═════════════════════════════════════════════════════ */

export const QUOTE_DISPLAY = ["draft", "submitted", "viewed", "accepted", "declined", "withdrawn", "expired"] as const;
export type QuoteDisplay = (typeof QUOTE_DISPLAY)[number];

export interface QuoteFilters {
  q?: string;
  vendor?: string;
  status?: string;
  authorization?: string;
  flag?: string;
  from?: string;
  to?: string;
}

const missingRef = () => and(eq(insQuotes.authorization, "insurer_authorised"), or(isNull(insQuotes.insurerQuoteRef), sql`TRIM(${insQuotes.insurerQuoteRef}) = ''`));
const expiredQuote = (today: string) => and(eq(insQuotes.status, "submitted"), lt(insQuotes.validUntil, today));
const deviates = () => sql`(${insEnquiries.indicativePremium} > 0 AND ABS(${insQuotes.total} - ${insEnquiries.indicativePremium}) > ${DEVIATION_LIMIT} * ${insEnquiries.indicativePremium})`;

function quoteWhere(f: QuoteFilters, today: string) {
  const status = oneOf(QUOTE_DISPLAY, f.status);
  const auth = oneOf(INS_QUOTE_AUTHORIZATION, f.authorization);
  const statusCond =
    status === "expired"
      ? expiredQuote(today)
      : status === "viewed"
        ? and(eq(insQuotes.status, "submitted"), isNotNull(insQuotes.viewedAt), gte(insQuotes.validUntil, today))
        : status === "submitted"
          ? and(eq(insQuotes.status, "submitted"), isNull(insQuotes.viewedAt), gte(insQuotes.validUntil, today))
          : status
            ? eq(insQuotes.status, status as InsQuoteStatus)
            : undefined;
  const flagCond =
    f.flag === "missing_ref" ? missingRef() : f.flag === "expired" ? expiredQuote(today) : f.flag === "deviation" ? deviates() : f.flag === "any" ? or(missingRef(), expiredQuote(today), deviates()) : undefined;
  return and(
    numId(f.vendor) ? eq(insQuotes.vendorId, numId(f.vendor)!) : undefined,
    statusCond,
    auth ? eq(insQuotes.authorization, auth) : undefined,
    flagCond,
    ...within(insQuotes.createdAt, dayRange(f.from, f.to)),
    f.q ? or(like(insQuotes.reference, term(f.q)), like(insQuotes.insurerQuoteRef, term(f.q)), like(insEnquiries.reference, term(f.q)), like(insEnquiries.name, term(f.q)), ...vendorSearch(f.q)) : undefined,
  );
}

export async function listInsQuotes(f: QuoteFilters, page?: number) {
  await requireStaff();
  const db = getDb();
  const today = istDate();
  const where = quoteWhere(f, today);
  const base = () =>
    db
      .select({ total: count() })
      .from(insQuotes)
      .innerJoin(insVendors, eq(insVendors.id, insQuotes.vendorId))
      .innerJoin(insEnquiries, eq(insEnquiries.id, insQuotes.enquiryId));
  const [[{ total }], [k]] = await Promise.all([
    base().where(where),
    db
      .select({
        all: count(),
        live: sql<string>`SUM(${insQuotes.status} = 'submitted' AND ${insQuotes.validUntil} >= ${today})`,
        viewed: sql<string>`SUM(${insQuotes.status} = 'submitted' AND ${insQuotes.viewedAt} IS NOT NULL AND ${insQuotes.validUntil} >= ${today})`,
        accepted: sql<string>`SUM(${insQuotes.status} = 'accepted')`,
        expired: sql<string>`SUM(${insQuotes.status} = 'submitted' AND ${insQuotes.validUntil} < ${today})`,
        missingRef: sql<string>`SUM(${missingRef()})`,
        deviation: sql<string>`SUM(${deviates()})`,
      })
      .from(insQuotes)
      .innerJoin(insEnquiries, eq(insEnquiries.id, insQuotes.enquiryId)),
  ]);
  const p = clampPage(page, total);
  const rows = await db
    .select({
      id: insQuotes.id,
      reference: insQuotes.reference,
      status: insQuotes.status,
      authorization: insQuotes.authorization,
      insurerQuoteRef: insQuotes.insurerQuoteRef,
      total: insQuotes.total,
      idv: insQuotes.idv,
      validUntil: insQuotes.validUntil,
      viewedAt: insQuotes.viewedAt,
      submittedAt: insQuotes.submittedAt,
      respondedAt: insQuotes.respondedAt,
      createdAt: insQuotes.createdAt,
      ...V,
      enquiryId: insEnquiries.id,
      enquiryRef: insEnquiries.reference,
      customer: insEnquiries.name,
      indicative: insEnquiries.indicativePremium,
      vehicle: sql<string>`CONCAT_WS(' ', ${insEnquiries.brandName}, ${insEnquiries.modelName})`,
      productName: insProducts.name,
    })
    .from(insQuotes)
    .innerJoin(insVendors, eq(insVendors.id, insQuotes.vendorId))
    .innerJoin(insEnquiries, eq(insEnquiries.id, insQuotes.enquiryId))
    .leftJoin(insProducts, eq(insProducts.id, insQuotes.productId))
    .where(where)
    .orderBy(desc(insQuotes.createdAt), desc(insQuotes.id))
    .limit(PAGE_SIZE)
    .offset((p - 1) * PAGE_SIZE);
  return {
    rows: rows.map((r) => ({ ...r, display: quoteDisplayStatus(r, today), flags: quoteFlags(r, today) })),
    total,
    page: p,
    counts: { all: k?.all ?? 0, live: n(k?.live), viewed: n(k?.viewed), accepted: n(k?.accepted), expired: n(k?.expired), missingRef: n(k?.missingRef), deviation: n(k?.deviation) },
  };
}

/** Compliance flags on a quote (same rules as the SQL filter). */
export function quoteFlags(
  q: { status: InsQuoteStatus; authorization: string; insurerQuoteRef: string | null; validUntil: string; viewedAt: Date | null; total: number; indicative: number | null },
  today = istDate(),
) {
  const deviation = q.indicative && q.indicative > 0 ? (q.total - q.indicative) / q.indicative : null;
  return {
    missingRef: q.authorization === "insurer_authorised" && !q.insurerQuoteRef?.trim(),
    expired: quoteDisplayStatus(q, today) === "expired",
    deviation: deviation !== null && Math.abs(deviation) > DEVIATION_LIMIT ? deviation : null,
    deviationRaw: deviation,
  };
}

export async function getInsQuote(id: number) {
  await requireStaff();
  const db = getDb();
  const [row] = await db
    .select({ q: insQuotes, v: insVendors, e: insEnquiries, productName: insProducts.name, productRef: insProducts.reference, companyName: insCompanies.name, author: users.name })
    .from(insQuotes)
    .innerJoin(insVendors, eq(insVendors.id, insQuotes.vendorId))
    .innerJoin(insEnquiries, eq(insEnquiries.id, insQuotes.enquiryId))
    .leftJoin(insProducts, eq(insProducts.id, insQuotes.productId))
    .leftJoin(insCompanies, eq(insCompanies.id, insEnquiries.companyId))
    .leftJoin(users, eq(users.id, insQuotes.createdBy))
    .where(eq(insQuotes.id, id));
  if (!row) return null;
  const events = await db
    .select({ id: insEnquiryEvents.id, kind: insEnquiryEvents.kind, body: insEnquiryEvents.body, createdAt: insEnquiryEvents.createdAt, userName: users.name, userRole: users.role })
    .from(insEnquiryEvents)
    .leftJoin(users, eq(users.id, insEnquiryEvents.userId))
    .where(and(eq(insEnquiryEvents.enquiryId, row.e.id), eq(insEnquiryEvents.kind, "quote")))
    .orderBy(desc(insEnquiryEvents.createdAt));
  return { ...row, events };
}

/* ══ Renewals ═══════════════════════════════════════════════════ */

export interface RenewalFilters {
  q?: string;
  vendor?: string;
  status?: string;
  due?: string;
  followup?: string;
}
export const DUE_WINDOWS = ["7", "15", "30", "45"] as const;

function renewalWhere(f: RenewalFilters, today: string) {
  const status = oneOf(INS_RENEWAL_STATUS, f.status);
  const due = oneOf(DUE_WINDOWS, f.due);
  return and(
    numId(f.vendor) ? eq(insRenewals.vendorId, numId(f.vendor)!) : undefined,
    status ? eq(insRenewals.status, status) : undefined,
    due ? and(inArray(insRenewals.status, INS_RENEWAL_OPEN), gte(insRenewals.expiryDate, today), lte(insRenewals.expiryDate, addDays(today, Number(due)))) : undefined,
    f.due === "expired" ? and(inArray(insRenewals.status, INS_RENEWAL_OPEN), lt(insRenewals.expiryDate, today)) : undefined,
    f.followup === "overdue" ? and(inArray(insRenewals.status, INS_RENEWAL_OPEN), lt(insRenewals.followUpAt, new Date())) : undefined,
    f.q
      ? or(like(insRenewals.name, term(f.q)), like(insRenewals.mobile, term(f.q)), like(insRenewals.regNumber, term(f.q)), like(insRenewals.policyNumber, term(f.q)), like(insRenewals.reference, term(f.q)), ...vendorSearch(f.q))
      : undefined,
  );
}

export async function listInsRenewals(f: RenewalFilters, page?: number) {
  await requireStaff();
  const db = getDb();
  const today = istDate();
  const where = renewalWhere(f, today);
  const open = inArray(insRenewals.status, INS_RENEWAL_OPEN);
  const dueIn = (d: number) => sql<string>`SUM(${open} AND ${insRenewals.expiryDate} BETWEEN ${today} AND ${addDays(today, d)})`;
  const [[{ total }], [k]] = await Promise.all([
    db.select({ total: count() }).from(insRenewals).innerJoin(insVendors, eq(insVendors.id, insRenewals.vendorId)).where(where),
    db
      .select({
        d7: dueIn(7),
        d15: dueIn(15),
        d30: dueIn(30),
        d45: dueIn(45),
        expired: sql<string>`SUM(${open} AND ${insRenewals.expiryDate} < ${today})`,
        overdue: sql<string>`SUM(${and(open, lt(insRenewals.followUpAt, new Date()))})`,
        renewed: sql<string>`SUM(${and(eq(insRenewals.status, "renewed"), gte(insRenewals.renewedAt, istStart(addDays(today, -30))))})`,
      })
      .from(insRenewals),
  ]);
  const p = clampPage(page, total);
  const rows = await db
    .select({
      r: insRenewals,
      ...V,
      assignee: users.name,
    })
    .from(insRenewals)
    .innerJoin(insVendors, eq(insVendors.id, insRenewals.vendorId))
    .leftJoin(insMembers, eq(insMembers.id, insRenewals.assignedMemberId))
    .leftJoin(users, eq(users.id, insMembers.userId))
    .where(where)
    // Open renewals first (soonest expiry on top), then closed ones.
    .orderBy(sql`(${insRenewals.status} NOT IN ('upcoming', 'contacted', 'quote_sent', 'follow_up'))`, asc(insRenewals.expiryDate), asc(insRenewals.id))
    .limit(PAGE_SIZE)
    .offset((p - 1) * PAGE_SIZE);
  return {
    rows,
    total,
    page: p,
    counts: { d7: n(k?.d7), d15: n(k?.d15), d30: n(k?.d30), d45: n(k?.d45), expired: n(k?.expired), overdue: n(k?.overdue), renewed: n(k?.renewed) },
  };
}

/* ══ Promotional campaigns ══════════════════════════════════════ */

export const CAMPAIGN_VIEWS = ["pending", "active", "scheduled", "ended", "all"] as const;
export type CampaignView = (typeof CAMPAIGN_VIEWS)[number];

function campaignViewCond(view: CampaignView, now: Date) {
  switch (view) {
    case "pending":
      return eq(insCampaigns.status, "pending_approval");
    case "active":
      return and(eq(insCampaigns.status, "approved"), lte(insCampaigns.startsAt, now), gte(insCampaigns.endsAt, now));
    case "scheduled":
      return and(eq(insCampaigns.status, "approved"), gt(insCampaigns.startsAt, now));
    case "ended":
      return or(and(eq(insCampaigns.status, "approved"), lt(insCampaigns.endsAt, now)), eq(insCampaigns.status, "cancelled"));
    default:
      return undefined;
  }
}

export async function listInsCampaigns(view: CampaignView, f: { q?: string; vendor?: string; type?: string }, page?: number) {
  await requireStaff();
  const db = getDb();
  const now = new Date();
  const type = oneOf(INS_CAMPAIGN_TYPES, f.type);
  const filters = and(
    numId(f.vendor) ? eq(insCampaigns.vendorId, numId(f.vendor)!) : undefined,
    type ? eq(insCampaigns.type, type) : undefined,
    f.q ? or(like(insCampaigns.title, term(f.q)), like(insCampaigns.reference, term(f.q)), ...vendorSearch(f.q)) : undefined,
  );
  const where = and(filters, campaignViewCond(view, now));
  const tally = (v: CampaignView) => sql<string>`SUM(${campaignViewCond(v, now) ?? sql`1`})`;
  const [[{ total }], [k]] = await Promise.all([
    db.select({ total: count() }).from(insCampaigns).innerJoin(insVendors, eq(insVendors.id, insCampaigns.vendorId)).where(where),
    db
      .select({ pending: tally("pending"), active: tally("active"), scheduled: tally("scheduled"), ended: tally("ended"), all: count() })
      .from(insCampaigns)
      .innerJoin(insVendors, eq(insVendors.id, insCampaigns.vendorId))
      .where(filters),
  ]);
  const p = clampPage(page, total);
  const rows = await db
    .select({ c: insCampaigns, ...V })
    .from(insCampaigns)
    .innerJoin(insVendors, eq(insVendors.id, insCampaigns.vendorId))
    .where(where)
    // The approval queue is oldest first; other views newest first.
    .orderBy(view === "pending" ? asc(insCampaigns.submittedAt) : desc(insCampaigns.startsAt), desc(insCampaigns.id))
    .limit(PAGE_SIZE)
    .offset((p - 1) * PAGE_SIZE);
  return { rows, total, page: p, counts: { pending: n(k?.pending), active: n(k?.active), scheduled: n(k?.scheduled), ended: n(k?.ended), all: k?.all ?? 0 } };
}

export async function getInsCampaign(id: number) {
  await requireStaff();
  const db = getDb();
  const [row] = await db.select({ c: insCampaigns, v: insVendors, author: users.name }).from(insCampaigns).innerJoin(insVendors, eq(insVendors.id, insCampaigns.vendorId)).leftJoin(users, eq(users.id, insCampaigns.createdBy)).where(eq(insCampaigns.id, id));
  if (!row) return null;
  const c = row.c;
  const ids = (c.productIds ?? []).filter((x) => Number.isInteger(x));
  const now = new Date();
  const [products, history, events, enquiries, others, daily] = await Promise.all([
    ids.length
      ? db
          .select({ id: insProducts.id, name: insProducts.name, reference: insProducts.reference, category: insProducts.category, status: insProducts.status, vendorId: insProducts.vendorId, companyName: insCompanies.name })
          .from(insProducts)
          .leftJoin(insCompanies, eq(insCompanies.id, insProducts.companyId))
          .where(inArray(insProducts.id, ids))
      : Promise.resolve([]),
    approvalsFor("campaign", [id]),
    db
      .select({ kind: insEvents.kind, n: count() })
      .from(insEvents)
      .where(and(eq(insEvents.vendorId, c.vendorId), eq(insEvents.refId, id), inArray(insEvents.kind, ["campaign_view", "campaign_click"])))
      .groupBy(insEvents.kind),
    db
      .select({
        total: count(),
        renewals: sql<string>`SUM(${insEnquiries.intent} = 'renewal')`,
        // Explicit `ins_enquiries`.`id`: in this single-table select Drizzle would write a bare `id`, which binds to q.id.
        quoted: sql<string>`SUM(EXISTS (SELECT 1 FROM ins_quotes q WHERE q.enquiry_id = ${ENQUIRY_ID} AND q.status <> 'draft'))`,
        reported: sql<string>`SUM(${insEnquiries.status} = 'policy_issued' OR ${insEnquiries.conversionVerifiedAt} IS NOT NULL)`,
        verified: sql<string>`SUM(${insEnquiries.conversionVerifiedAt} IS NOT NULL)`,
      })
      .from(insEnquiries)
      .where(eq(insEnquiries.campaignId, id)),
    db
      .select({ id: insCampaigns.id, title: insCampaigns.title, startsAt: insCampaigns.startsAt, endsAt: insCampaigns.endsAt, status: insCampaigns.status })
      .from(insCampaigns)
      .where(and(eq(insCampaigns.vendorId, c.vendorId), ne(insCampaigns.id, id), inArray(insCampaigns.status, ["approved", "paused"]), gte(insCampaigns.endsAt, now))),
    db
      .select({ day: sql<string>`DATE(CONVERT_TZ(${insEvents.createdAt}, '+00:00', '+05:30'))`, kind: insEvents.kind, n: count() })
      .from(insEvents)
      .where(and(eq(insEvents.vendorId, c.vendorId), eq(insEvents.refId, id), inArray(insEvents.kind, ["campaign_view", "campaign_click"]), gte(insEvents.createdAt, istStart(addDays(istDate(), -29)))))
      .groupBy(sql`1`, insEvents.kind),
  ]);
  const views = events.find((x) => x.kind === "campaign_view")?.n ?? 0;
  const clicks = events.find((x) => x.kind === "campaign_click")?.n ?? 0;
  const e = enquiries[0];
  const plans = (await getCatalog()).content.insurerPlans.plans;
  const plan = plans.find((p) => p.id === row.v.plan);
  return {
    ...row,
    products,
    missingProducts: ids.filter((x) => !products.some((p) => p.id === x)),
    history,
    performance: {
      views,
      clicks,
      enquiries: e?.total ?? 0,
      renewals: n(e?.renewals),
      quoted: n(e?.quoted),
      reported: n(e?.reported),
      verified: n(e?.verified),
      daily: daily.map((d) => ({ day: String(d.day).slice(0, 10), kind: d.kind, n: d.n })),
    },
    liveOthers: others,
    // The plan's slots taken by the vendor's other campaigns, counted exactly as the vendor portal counts them.
    slotsUsed: await campaignSlotsUsed(c.vendorId, id),
    planName: plan?.name ?? row.v.plan,
    planLimit: plan ? plan.activeCampaigns : null,
  };
}

/* ══ Billing ledger (invoices, payments, refunds) ═══════════════ */

const invoiceLite = {
  id: insInvoices.id,
  vendorId: insInvoices.vendorId,
  number: insInvoices.number,
  kind: insInvoices.kind,
  adCampaignId: insInvoices.adCampaignId,
  amount: insInvoices.amount,
  gst: insInvoices.gst,
  total: insInvoices.total,
  status: insInvoices.status,
  dueOn: insInvoices.dueOn,
  createdAt: insInvoices.createdAt,
  paidAt: insInvoices.paidAt,
};
type InvoiceLite = { id: number; vendorId: number; number: string; kind: InsInvoiceKind; adCampaignId: number | null; amount: number; gst: number; total: number; status: (typeof INVOICE_STATUS)[number]; dueOn: string; createdAt: Date; paidAt: Date | null };

/** Every invoice, payment and refund (small tables) — the single source for the money maths. */
export async function loadLedger() {
  await requireStaff();
  const db = getDb();
  const [invoices, payments, refunds, vendors, ads] = await Promise.all([
    db.select(invoiceLite).from(insInvoices),
    db.select({ id: insPayments.id, invoiceId: insPayments.invoiceId, vendorId: insPayments.vendorId, amount: insPayments.amount, status: insPayments.status, paidOn: insPayments.paidOn }).from(insPayments),
    db.select({ id: insRefunds.id, invoiceId: insRefunds.invoiceId, vendorId: insRefunds.vendorId, amount: insRefunds.amount, refundedOn: insRefunds.refundedOn }).from(insRefunds),
    db.select(V).from(insVendors),
    db
      .select({ id: adCampaigns.id, reference: adCampaigns.reference, name: adCampaigns.name, insVendorId: adCampaigns.insVendorId, productId: adCampaigns.productId, placementName: adPlacements.name, placementKey: adPlacements.key, category: insProducts.category })
      .from(adCampaigns)
      .innerJoin(adPlacements, eq(adPlacements.id, adCampaigns.placementId))
      .leftJoin(insProducts, eq(insProducts.id, adCampaigns.productId)),
  ]);
  return { invoices: invoices as InvoiceLite[], payments, refunds, vendors, ads };
}
export type Ledger = Awaited<ReturnType<typeof loadLedger>>;

export interface Bucket {
  key: string;
  label: string;
  sub?: string;
  href?: string;
  invoiced: number;
  collected: number;
  outstanding: number;
}

/**
 * Revenue for a period. Collected is cash basis (verified payments by the day the vendor paid,
 * minus refunds by the day they were paid back); invoiced is by issue day (void excluded);
 * outstanding is always as of today, whatever the period.
 */
export function summariseLedger(ledger: Ledger, range: DayRange, today = istDate()) {
  const { invoices, payments, refunds, vendors, ads } = ledger;
  const inv = new Map(invoices.map((i) => [i.id, i]));
  const ad = new Map(ads.map((a) => [a.id, a]));
  const vend = new Map(vendors.map((v) => [v.vendorId, v]));
  const verified = payments.filter((p) => p.status === "verified");
  const paidOnInvoice = new Map<number, number>();
  for (const p of verified) paidOnInvoice.set(p.invoiceId, (paidOnInvoice.get(p.invoiceId) ?? 0) + p.amount);
  const refundedOnInvoice = new Map<number, number>();
  for (const r of refunds) refundedOnInvoice.set(r.invoiceId, (refundedOnInvoice.get(r.invoiceId) ?? 0) + r.amount);
  const pendingOnInvoice = new Map<number, number>();
  for (const p of payments) if (p.status === "submitted") pendingOnInvoice.set(p.invoiceId, (pendingOnInvoice.get(p.invoiceId) ?? 0) + p.amount);

  const exGst = (i: InvoiceLite | undefined, amount: number) => (i && i.total > 0 ? (amount * i.amount) / i.total : amount);
  const pPayments = verified.filter((p) => dayIn(p.paidOn, range));
  const pRefunds = refunds.filter((r) => dayIn(r.refundedOn, range));
  const pInvoices = invoices.filter((i) => i.status !== "void" && inIst(i.createdAt, range));
  const unpaid = invoices.filter((i) => i.status === "due" || i.status === "verifying");
  const balance = (i: InvoiceLite) => Math.max(0, i.total - (paidOnInvoice.get(i.id) ?? 0));

  const gross = pPayments.reduce((s, p) => s + p.amount, 0);
  const refunded = pRefunds.reduce((s, r) => s + r.amount, 0);
  const net = Math.round(pPayments.reduce((s, p) => s + exGst(inv.get(p.invoiceId), p.amount), 0) - pRefunds.reduce((s, r) => s + exGst(inv.get(r.invoiceId), r.amount), 0));
  const overdueList = unpaid.filter((i) => insInvoiceDisplayStatus(i, today) === "overdue");

  // Generic bucketing: key(invoice) → bucket.
  const bucket = (keyOf: (i: InvoiceLite) => { key: string; label: string; sub?: string; href?: string } | null) => {
    const out = new Map<string, Bucket>();
    const get = (i: InvoiceLite | undefined) => {
      if (!i) return null;
      const k = keyOf(i);
      if (!k) return null;
      if (!out.has(k.key)) out.set(k.key, { ...k, invoiced: 0, collected: 0, outstanding: 0 });
      return out.get(k.key)!;
    };
    for (const i of pInvoices) {
      const b = get(i);
      if (b) b.invoiced += i.total;
    }
    for (const p of pPayments) {
      const b = get(inv.get(p.invoiceId));
      if (b) b.collected += p.amount;
    }
    for (const r of pRefunds) {
      const b = get(inv.get(r.invoiceId));
      if (b) b.collected -= r.amount;
    }
    for (const i of unpaid) {
      const b = get(i);
      if (b) b.outstanding += balance(i);
    }
    return [...out.values()].sort((a, b) => b.collected - a.collected || b.invoiced - a.invoiced || b.outstanding - a.outstanding || a.label.localeCompare(b.label));
  };

  const KIND: Record<InsInvoiceKind, string> = { subscription: "Vendor subscriptions", advertising: "Advertising", lead_fee: "Lead generation", other: "Other charges" };
  const byKind = Object.fromEntries(bucket((i) => ({ key: i.kind, label: KIND[i.kind] })).map((b) => [b.key, b])) as Partial<Record<InsInvoiceKind, Bucket>>;
  const kinds = INS_INVOICE_KINDS.map((k) => byKind[k] ?? { key: k, label: KIND[k], invoiced: 0, collected: 0, outstanding: 0 });

  const byPlacement = bucket((i) => {
    if (i.kind !== "advertising") return null;
    const a = i.adCampaignId ? ad.get(i.adCampaignId) : undefined;
    return a ? { key: a.placementKey, label: a.placementName } : { key: "unknown", label: "Placement not recorded" };
  });
  const byVendor = bucket((i) => {
    const v = vend.get(i.vendorId);
    return { key: String(i.vendorId), label: v ? vendorLabel(v) : `Vendor #${i.vendorId}`, sub: v?.vendorRef, href: `/admin/insurance/vendors/${i.vendorId}` };
  });
  const byCampaign = bucket((i) => {
    if (i.kind !== "advertising") return null;
    const a = i.adCampaignId ? ad.get(i.adCampaignId) : undefined;
    return a ? { key: String(a.id), label: a.name, sub: `${a.reference} · ${a.placementName}` } : { key: "unknown", label: "Campaign not recorded" };
  });
  const CAT: Record<InsProductCategory, string> = {
    comprehensive: "Comprehensive",
    third_party: "Third-party",
    own_damage: "Own-damage",
    bundled: "Bundled",
    new_car: "New car",
    used_car: "Used car",
    ev: "Electric vehicle",
    long_term: "Long-term",
  };
  const byCategory = bucket((i) => {
    const a = i.kind === "advertising" && i.adCampaignId ? ad.get(i.adCampaignId) : undefined;
    const cat = a?.category;
    return cat ? { key: cat, label: CAT[cat] ?? cat, sub: "Product ads" } : { key: "none", label: "Not product-specific", sub: "Subscriptions, banners, lead fees, other" };
  });

  // Last 12 IST months: invoiced vs collected (independent of the period).
  const months: string[] = [];
  const [y, m] = today.slice(0, 7).split("-").map(Number);
  for (let k = 11; k >= 0; k--) {
    const d = new Date(Date.UTC(y, m - 1 - k, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  const monthly = months.map((month) => ({
    month,
    invoiced: invoices.filter((i) => i.status !== "void" && istDate(i.createdAt).startsWith(month)).reduce((s, i) => s + i.total, 0),
    collected: verified.filter((p) => p.paidOn.startsWith(month)).reduce((s, p) => s + p.amount, 0) - refunds.filter((r) => r.refundedOn.startsWith(month)).reduce((s, r) => s + r.amount, 0),
  }));

  return {
    gross,
    refunded,
    collected: gross - refunded,
    net,
    invoiced: pInvoices.reduce((s, i) => s + i.total, 0),
    invoicedCount: pInvoices.length,
    outstanding: unpaid.reduce((s, i) => s + balance(i), 0),
    outstandingCount: unpaid.filter((i) => balance(i) > 0).length,
    overdue: overdueList.reduce((s, i) => s + balance(i), 0),
    overdueCount: overdueList.length,
    awaitingVerification: [...pendingOnInvoice.values()].reduce((s, v) => s + v, 0),
    awaitingCount: payments.filter((p) => p.status === "submitted").length,
    kinds,
    byKind,
    byPlacement,
    byVendor,
    byCampaign,
    byCategory,
    monthly,
    hasLeadFees: invoices.some((i) => i.kind === "lead_fee"),
    paidOnInvoice,
    refundedOnInvoice,
  };
}
export type RevenueSummary = ReturnType<typeof summariseLedger>;

/* ── Invoices ── */

export interface InvoiceFilters {
  q?: string;
  vendor?: string;
  kind?: string;
  status?: string;
  from?: string;
  to?: string;
}

// Correlated on an explicit `ins_invoices`.`id` so they stay right in single-table selects too (Drizzle leaves select-list columns unqualified there).
const INVOICE_ID = sql.raw("`ins_invoices`.`id`");
const verifiedSum = sql<string>`(SELECT COALESCE(SUM(p.amount), 0) FROM ins_payments p WHERE p.invoice_id = ${INVOICE_ID} AND p.status = 'verified')`;
const refundSum = sql<string>`(SELECT COALESCE(SUM(r.amount), 0) FROM ins_refunds r WHERE r.invoice_id = ${INVOICE_ID})`;
const pendingCount = sql<string>`(SELECT COUNT(*) FROM ins_payments p WHERE p.invoice_id = ${INVOICE_ID} AND p.status = 'submitted')`;

function invoiceWhere(f: InvoiceFilters, today: string) {
  const kind = oneOf(INS_INVOICE_KINDS, f.kind);
  const status = oneOf(INVOICE_STATUS, f.status);
  const r = dayRange(f.from, f.to);
  return and(
    numId(f.vendor) ? eq(insInvoices.vendorId, numId(f.vendor)!) : undefined,
    kind ? eq(insInvoices.kind, kind) : undefined,
    f.status === "unpaid"
      ? inArray(insInvoices.status, ["due", "verifying"])
      : status === "overdue"
      ? and(eq(insInvoices.status, "due"), lt(insInvoices.dueOn, today))
      : status === "due"
        ? and(eq(insInvoices.status, "due"), gte(insInvoices.dueOn, today))
        : status
          ? eq(insInvoices.status, status)
          : undefined,
    // Billing period overlapping the chosen days.
    r.from ? gte(insInvoices.periodEnd, r.from) : undefined,
    r.to ? lte(insInvoices.periodStart, r.to) : undefined,
    f.q ? or(like(insInvoices.number, term(f.q)), like(insInvoices.description, term(f.q)), ...vendorSearch(f.q)) : undefined,
  );
}

const invoiceListCols = {
  id: insInvoices.id,
  number: insInvoices.number,
  kind: insInvoices.kind,
  description: insInvoices.description,
  periodStart: insInvoices.periodStart,
  periodEnd: insInvoices.periodEnd,
  amount: insInvoices.amount,
  gst: insInvoices.gst,
  total: insInvoices.total,
  status: insInvoices.status,
  dueOn: insInvoices.dueOn,
  paidAt: insInvoices.paidAt,
  createdAt: insInvoices.createdAt,
  ...V,
  verified: verifiedSum,
  refunded: refundSum,
  pending: pendingCount,
};

export async function listInsInvoices(f: InvoiceFilters, page?: number) {
  await requireStaff();
  const db = getDb();
  const today = istDate();
  const where = invoiceWhere(f, today);
  const [{ total }] = await db.select({ total: count() }).from(insInvoices).innerJoin(insVendors, eq(insVendors.id, insInvoices.vendorId)).where(where);
  const p = clampPage(page, total);
  const rows = await db
    .select(invoiceListCols)
    .from(insInvoices)
    .innerJoin(insVendors, eq(insVendors.id, insInvoices.vendorId))
    .where(where)
    .orderBy(desc(insInvoices.createdAt), desc(insInvoices.id))
    .limit(PAGE_SIZE)
    .offset((p - 1) * PAGE_SIZE);
  return { rows: rows.map((r) => ({ ...r, verified: n(r.verified), refunded: n(r.refunded), pending: n(r.pending), display: insInvoiceDisplayStatus(r, today) })), total, page: p };
}

export async function exportInsInvoices(f: InvoiceFilters) {
  await requireStaff();
  const today = istDate();
  const rows = await getDb()
    .select(invoiceListCols)
    .from(insInvoices)
    .innerJoin(insVendors, eq(insVendors.id, insInvoices.vendorId))
    .where(invoiceWhere(f, today))
    .orderBy(desc(insInvoices.createdAt), desc(insInvoices.id))
    .limit(20_000);
  return rows.map((r) => ({ ...r, verified: n(r.verified), refunded: n(r.refunded), pending: n(r.pending), display: insInvoiceDisplayStatus(r, today) }));
}

export async function getInsInvoice(id: number) {
  await requireStaff();
  const db = getDb();
  const [row] = await db.select({ i: insInvoices, v: insVendors }).from(insInvoices).innerJoin(insVendors, eq(insVendors.id, insInvoices.vendorId)).where(eq(insInvoices.id, id));
  if (!row) return null;
  const [payments, refunds, ad] = await Promise.all([
    db
      .select({ p: insPayments, verifier: users.name })
      .from(insPayments)
      .leftJoin(users, eq(users.id, insPayments.verifiedBy))
      .where(eq(insPayments.invoiceId, id))
      .orderBy(desc(insPayments.createdAt), desc(insPayments.id)),
    db.select({ r: insRefunds, by: users.name }).from(insRefunds).leftJoin(users, eq(users.id, insRefunds.createdBy)).where(eq(insRefunds.invoiceId, id)).orderBy(desc(insRefunds.refundedOn), desc(insRefunds.id)),
    row.i.adCampaignId
      ? db.select({ id: adCampaigns.id, name: adCampaigns.name, reference: adCampaigns.reference, placement: adPlacements.name, startsOn: adCampaigns.startsOn, endsOn: adCampaigns.endsOn }).from(adCampaigns).innerJoin(adPlacements, eq(adPlacements.id, adCampaigns.placementId)).where(eq(adCampaigns.id, row.i.adCampaignId))
      : Promise.resolve([]),
  ]);
  const history = await approvalsFor(
    "payment",
    payments.map((p) => p.p.id),
  );
  const verifiedTotal = payments.filter((p) => p.p.status === "verified").reduce((s, p) => s + p.p.amount, 0);
  const refundedTotal = refunds.reduce((s, r) => s + r.r.amount, 0);
  return { ...row, payments, refunds, ad: ad[0] ?? null, history, verifiedTotal, refundedTotal };
}

/* ── Payments ── */

export interface PaymentFilters {
  q?: string;
  vendor?: string;
  status?: string;
  method?: string;
  from?: string;
  to?: string;
}

const paymentCols = {
  p: insPayments,
  invoiceNumber: insInvoices.number,
  invoiceKind: insInvoices.kind,
  invoiceTotal: insInvoices.total,
  invoiceStatus: insInvoices.status,
  invoiceDue: insInvoices.dueOn,
  invoiceDescription: insInvoices.description,
  invoiceVerified: verifiedSum,
  ...V,
  verifier: users.name,
};

function paymentWhere(f: PaymentFilters) {
  const status = oneOf(PAYMENT_STATUS, f.status);
  const method = oneOf(["bank_transfer", "upi", "cheque"] as const, f.method);
  return and(
    numId(f.vendor) ? eq(insPayments.vendorId, numId(f.vendor)!) : undefined,
    status ? eq(insPayments.status, status) : undefined,
    method ? eq(insPayments.method, method) : undefined,
    ...dayWithin(insPayments.paidOn, dayRange(f.from, f.to)),
    f.q ? or(like(insPayments.utr, term(f.q)), like(insInvoices.number, term(f.q)), ...vendorSearch(f.q)) : undefined,
  );
}

const paymentQuery = () =>
  getDb()
    .select(paymentCols)
    .from(insPayments)
    .innerJoin(insInvoices, eq(insInvoices.id, insPayments.invoiceId))
    .innerJoin(insVendors, eq(insVendors.id, insPayments.vendorId))
    .leftJoin(users, eq(users.id, insPayments.verifiedBy));

export async function listInsPayments(f: PaymentFilters, page?: number) {
  await requireStaff();
  const db = getDb();
  const where = paymentWhere(f);
  const [queue, [{ total }]] = await Promise.all([
    paymentQuery().where(eq(insPayments.status, "submitted")).orderBy(asc(insPayments.createdAt), asc(insPayments.id)).limit(200),
    db.select({ total: count() }).from(insPayments).innerJoin(insInvoices, eq(insInvoices.id, insPayments.invoiceId)).innerJoin(insVendors, eq(insVendors.id, insPayments.vendorId)).where(where),
  ]);
  const p = clampPage(page, total);
  const rows = await paymentQuery()
    .where(where)
    .orderBy(desc(insPayments.createdAt), desc(insPayments.id))
    .limit(PAGE_SIZE)
    .offset((p - 1) * PAGE_SIZE);
  const fix = <T extends { invoiceVerified: string }>(r: T) => ({ ...r, invoiceVerified: n(r.invoiceVerified) });
  return { queue: queue.map(fix), rows: rows.map(fix), total, page: p };
}

export async function exportInsPayments(f: PaymentFilters) {
  await requireStaff();
  const rows = await paymentQuery().where(paymentWhere(f)).orderBy(desc(insPayments.paidOn), desc(insPayments.id)).limit(20_000);
  return rows.map((r) => ({ ...r, invoiceVerified: n(r.invoiceVerified) }));
}

/** The latest payments of any status (revenue page). */
export async function recentInsPayments(limit = 12) {
  await requireStaff();
  const rows = await paymentQuery().orderBy(desc(insPayments.createdAt), desc(insPayments.id)).limit(limit);
  return rows.map((r) => ({ ...r, invoiceVerified: n(r.invoiceVerified) }));
}

/* ── Refunds ── */

export async function listInsRefunds(f: { q?: string; vendor?: string; from?: string; to?: string }, page?: number) {
  await requireStaff();
  const db = getDb();
  const where = and(
    numId(f.vendor) ? eq(insRefunds.vendorId, numId(f.vendor)!) : undefined,
    ...dayWithin(insRefunds.refundedOn, dayRange(f.from, f.to)),
    f.q ? or(like(insRefunds.reference, term(f.q)), like(insRefunds.reason, term(f.q)), like(insInvoices.number, term(f.q)), ...vendorSearch(f.q)) : undefined,
  );
  const base = () => db.select({ total: count(), amount: sql<string>`COALESCE(SUM(${insRefunds.amount}), 0)` }).from(insRefunds).innerJoin(insInvoices, eq(insInvoices.id, insRefunds.invoiceId)).innerJoin(insVendors, eq(insVendors.id, insRefunds.vendorId));
  const [[agg]] = await Promise.all([base().where(where)]);
  const p = clampPage(page, agg?.total ?? 0);
  const rows = await db
    .select({ r: insRefunds, invoiceNumber: insInvoices.number, invoiceTotal: insInvoices.total, invoiceKind: insInvoices.kind, ...V, by: users.name, paymentUtr: insPayments.utr })
    .from(insRefunds)
    .innerJoin(insInvoices, eq(insInvoices.id, insRefunds.invoiceId))
    .innerJoin(insVendors, eq(insVendors.id, insRefunds.vendorId))
    .leftJoin(users, eq(users.id, insRefunds.createdBy))
    .leftJoin(insPayments, eq(insPayments.id, insRefunds.paymentId))
    .where(where)
    .orderBy(desc(insRefunds.refundedOn), desc(insRefunds.id))
    .limit(PAGE_SIZE)
    .offset((p - 1) * PAGE_SIZE);
  return { rows, total: agg?.total ?? 0, amount: n(agg?.amount), page: p };
}

export async function exportInsRefunds(range: DayRange) {
  await requireStaff();
  return getDb()
    .select({ r: insRefunds, invoiceNumber: insInvoices.number, invoiceKind: insInvoices.kind, ...V, by: users.name, paymentUtr: insPayments.utr })
    .from(insRefunds)
    .innerJoin(insInvoices, eq(insInvoices.id, insRefunds.invoiceId))
    .innerJoin(insVendors, eq(insVendors.id, insRefunds.vendorId))
    .leftJoin(users, eq(users.id, insRefunds.createdBy))
    .leftJoin(insPayments, eq(insPayments.id, insRefunds.paymentId))
    .where(and(...dayWithin(insRefunds.refundedOn, range)))
    .orderBy(desc(insRefunds.refundedOn), desc(insRefunds.id))
    .limit(20_000);
}

/** Paid invoices that still have money that could be refunded (verified − refunded > 0). */
export async function refundableInvoices(onlyId?: number) {
  await requireStaff();
  const rows = await getDb()
    .select({ id: insInvoices.id, number: insInvoices.number, total: insInvoices.total, kind: insInvoices.kind, ...V, verified: verifiedSum, refunded: refundSum })
    .from(insInvoices)
    .innerJoin(insVendors, eq(insVendors.id, insInvoices.vendorId))
    .where(and(eq(insInvoices.status, "paid"), onlyId ? eq(insInvoices.id, onlyId) : undefined))
    .orderBy(desc(insInvoices.paidAt), desc(insInvoices.id))
    .limit(500);
  return rows
    .map((r) => ({ id: r.id, number: r.number, total: r.total, kind: r.kind, vendor: vendorLabel(r), vendorRef: r.vendorRef, verified: n(r.verified), refunded: n(r.refunded), refundable: n(r.verified) - n(r.refunded) }))
    .filter((r) => r.refundable > 0);
}

/* ══ Reports ════════════════════════════════════════════════════ */

export async function getInsReports(range: DayRange) {
  await requireStaff();
  const db = getDb();
  const today = istDate();
  const [enquiries, quotes, renewals, campaignEvents, campaignEnquiries, adRows, ledger, products] = await Promise.all([
    db
      .select({
        id: insEnquiries.id,
        vendorId: insEnquiries.vendorId,
        productId: insEnquiries.productId,
        city: insEnquiries.city,
        state: insEnquiries.state,
        source: insEnquiries.source,
        intent: insEnquiries.intent,
        status: insEnquiries.status,
        verifiedAt: insEnquiries.conversionVerifiedAt,
        policyIssuedAt: insEnquiries.policyIssuedAt,
        createdAt: insEnquiries.createdAt,
      })
      .from(insEnquiries)
      .where(and(...within(insEnquiries.createdAt, range)))
      .limit(100_000),
    db
      .select({ id: insQuotes.id, enquiryId: insQuotes.enquiryId, vendorId: insQuotes.vendorId, status: insQuotes.status, validUntil: insQuotes.validUntil, viewedAt: insQuotes.viewedAt, submittedAt: insQuotes.submittedAt, enquiryCreated: insEnquiries.createdAt })
      .from(insQuotes)
      .innerJoin(insEnquiries, eq(insEnquiries.id, insQuotes.enquiryId))
      .where(and(ne(insQuotes.status, "draft"), ...within(insQuotes.createdAt, range)))
      .limit(100_000),
    db.select({ id: insRenewals.id, vendorId: insRenewals.vendorId, status: insRenewals.status, expiryDate: insRenewals.expiryDate, renewedAt: insRenewals.renewedAt }).from(insRenewals).limit(100_000),
    db
      .select({ refId: insEvents.refId, kind: insEvents.kind, n: count() })
      .from(insEvents)
      .where(and(inArray(insEvents.kind, ["campaign_view", "campaign_click"]), ...within(insEvents.createdAt, range)))
      .groupBy(insEvents.refId, insEvents.kind),
    db
      .select({ campaignId: insEnquiries.campaignId, n: count(), policies: sql<string>`SUM(${insEnquiries.status} = 'policy_issued' OR ${insEnquiries.conversionVerifiedAt} IS NOT NULL)` })
      .from(insEnquiries)
      .where(and(isNotNull(insEnquiries.campaignId), ...within(insEnquiries.createdAt, range)))
      .groupBy(insEnquiries.campaignId),
    db
      .select({
        id: adCampaigns.id,
        name: adCampaigns.name,
        reference: adCampaigns.reference,
        status: adCampaigns.status,
        house: adCampaigns.house,
        insVendorId: adCampaigns.insVendorId,
        partnerId: adCampaigns.partnerId,
        placement: adPlacements.name,
        startsOn: adCampaigns.startsOn,
        endsOn: adCampaigns.endsOn,
        impressions: sql<string>`COALESCE(SUM(${adStats.impressions}), 0)`,
        clicks: sql<string>`COALESCE(SUM(${adStats.clicks}), 0)`,
        enquiries: sql<string>`COALESCE(SUM(${adStats.enquiries}), 0)`,
      })
      .from(adStats)
      .innerJoin(adCampaigns, eq(adCampaigns.id, adStats.campaignId))
      .innerJoin(adPlacements, eq(adPlacements.id, adCampaigns.placementId))
      .where(and(...dayWithin(adStats.day, range)))
      .groupBy(adCampaigns.id),
    loadLedger(),
    db.select({ id: insProducts.id, name: insProducts.name, code: insProducts.code, category: insProducts.category, vendorId: insProducts.vendorId }).from(insProducts),
  ]);
  const vend = new Map(ledger.vendors.map((v) => [v.vendorId, v]));
  const vname = (id: number | null) => (id && vend.get(id) ? vendorLabel(vend.get(id)!) : id ? `Vendor #${id}` : "—");
  const prod = new Map(products.map((p) => [p.id, p]));
  const quoted = new Set(quotes.map((q) => q.enquiryId));
  const accepted = new Set(quotes.filter((q) => q.status === "accepted").map((q) => q.enquiryId));
  const reported = (e: (typeof enquiries)[number]) => e.status === "policy_issued" || Boolean(e.policyIssuedAt) || Boolean(e.verifiedAt);

  const group = <K extends string | number>(keyOf: (e: (typeof enquiries)[number]) => K | null) => {
    const m = new Map<K, { total: number; renewals: number; quoted: number; reported: number; verified: number }>();
    for (const e of enquiries) {
      const k = keyOf(e);
      if (k === null) continue;
      const g = m.get(k) ?? { total: 0, renewals: 0, quoted: 0, reported: 0, verified: 0 };
      g.total++;
      if (e.intent === "renewal") g.renewals++;
      if (quoted.has(e.id)) g.quoted++;
      if (reported(e)) g.reported++;
      if (e.verifiedAt) g.verified++;
      m.set(k, g);
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  };

  const byVendor = group((e) => e.vendorId).map(([id, g]) => ({ key: String(id), label: vname(id), sub: vend.get(id)?.vendorRef, href: `/admin/insurance/vendors/${id}`, ...g }));
  const byProduct = group((e) => e.productId ?? 0).map(([id, g]) => {
    const p = prod.get(id);
    return { key: String(id), label: p ? p.name : "Product removed", sub: p ? `${p.code} · ${vname(p.vendorId)}` : undefined, category: p?.category ?? null, ...g };
  });
  const byCategory = group((e) => (e.productId && prod.get(e.productId)?.category) || "unknown").map(([k, g]) => ({ key: k, ...g }));
  const byCity = group((e) => e.city?.trim() || "Not given").map(([k, g]) => ({ key: k, label: k, ...g }));
  const bySource = group((e) => e.source).map(([k, g]) => ({ key: k, ...g }));

  const funnel = {
    enquiries: enquiries.length,
    quoted: enquiries.filter((e) => quoted.has(e.id)).length,
    interested: enquiries.filter((e) => accepted.has(e.id) || e.status === "interested" || reported(e)).length,
    reported: enquiries.filter(reported).length,
    verified: enquiries.filter((e) => e.verifiedAt).length,
  };

  const qs = { sent: quotes.length, viewed: 0, accepted: 0, declined: 0, withdrawn: 0, expired: 0, open: 0 };
  for (const q of quotes) {
    const d = quoteDisplayStatus(q, today);
    if (q.viewedAt) qs.viewed++;
    if (d === "accepted") qs.accepted++;
    else if (d === "declined") qs.declined++;
    else if (d === "withdrawn") qs.withdrawn++;
    else if (d === "expired") qs.expired++;
    else qs.open++;
  }

  const open = renewals.filter((r) => INS_RENEWAL_OPEN.includes(r.status));
  const days = (d: string) => Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  const pipeline = {
    byStatus: INS_RENEWAL_STATUS.map((s) => ({ status: s, n: renewals.filter((r) => r.status === s).length })),
    buckets: [
      { key: "expired", label: "Expired, not renewed", n: open.filter((r) => days(r.expiryDate) < 0).length },
      { key: "7", label: "Due in 0–7 days", n: open.filter((r) => days(r.expiryDate) >= 0 && days(r.expiryDate) <= 7).length },
      { key: "15", label: "Due in 8–15 days", n: open.filter((r) => days(r.expiryDate) > 7 && days(r.expiryDate) <= 15).length },
      { key: "30", label: "Due in 16–30 days", n: open.filter((r) => days(r.expiryDate) > 15 && days(r.expiryDate) <= 30).length },
      { key: "45", label: "Due in 31–45 days", n: open.filter((r) => days(r.expiryDate) > 30 && days(r.expiryDate) <= 45).length },
      { key: "later", label: "Due later", n: open.filter((r) => days(r.expiryDate) > 45).length },
    ],
    renewedInRange: renewals.filter((r) => r.status === "renewed" && r.renewedAt && inIst(r.renewedAt, range)).length,
    open: open.length,
  };

  // Promotions: campaigns with activity in the period.
  const promoIds = [...new Set([...campaignEvents.map((e) => e.refId), ...campaignEnquiries.map((e) => e.campaignId)].filter((x): x is number => typeof x === "number"))];
  const promoRows = promoIds.length
    ? await db.select({ id: insCampaigns.id, title: insCampaigns.title, reference: insCampaigns.reference, vendorId: insCampaigns.vendorId, status: insCampaigns.status, startsAt: insCampaigns.startsAt, endsAt: insCampaigns.endsAt }).from(insCampaigns).where(inArray(insCampaigns.id, promoIds))
    : [];
  const promotions = promoRows
    .map((c) => {
      const views = campaignEvents.find((e) => e.refId === c.id && e.kind === "campaign_view")?.n ?? 0;
      const clicks = campaignEvents.find((e) => e.refId === c.id && e.kind === "campaign_click")?.n ?? 0;
      const enq = campaignEnquiries.find((e) => e.campaignId === c.id);
      return { ...c, vendor: vname(c.vendorId), views, clicks, enquiries: enq?.n ?? 0, policies: n(enq?.policies) };
    })
    .sort((a, b) => b.enquiries - a.enquiries || b.clicks - a.clicks || b.views - a.views);

  const ads = adRows
    .map((a) => ({ ...a, advertiser: a.house ? "MarchGear (house)" : a.insVendorId ? vname(a.insVendorId) : a.partnerId ? `Dealer partner #${a.partnerId}` : "—", impressions: n(a.impressions), clicks: n(a.clicks), enquiries: n(a.enquiries) }))
    .sort((a, b) => b.impressions - a.impressions);

  // Vendor league table.
  const money = summariseLedger(ledger, range, today);
  const collectedBy = new Map(money.byVendor.map((b) => [Number(b.key), b.collected]));
  const firstQuote = new Map<number, number>();
  for (const q of quotes) {
    if (!q.submittedAt) continue;
    const hours = (q.submittedAt.getTime() - q.enquiryCreated.getTime()) / 3_600_000;
    if (hours < 0) continue;
    const prev = firstQuote.get(q.enquiryId);
    if (prev === undefined || hours < prev) firstQuote.set(q.enquiryId, hours);
  }
  const vendorIds = [...new Set([...enquiries.map((e) => e.vendorId), ...quotes.map((q) => q.vendorId), ...collectedBy.keys()])];
  const league = vendorIds
    .map((id) => {
      const es = enquiries.filter((e) => e.vendorId === id);
      const qv = quotes.filter((q) => q.vendorId === id);
      const resp = es.map((e) => firstQuote.get(e.id)).filter((h): h is number => h !== undefined).sort((a, b) => a - b);
      return {
        id,
        name: vname(id),
        reference: vend.get(id)?.vendorRef ?? "",
        enquiries: es.length,
        quoted: es.filter((e) => quoted.has(e.id)).length,
        quotesSent: qv.length,
        accepted: qv.filter((q) => q.status === "accepted").length,
        reported: es.filter(reported).length,
        verified: es.filter((e) => e.verifiedAt).length,
        medianResponseHours: resp.length ? resp[Math.floor(resp.length / 2)] : null,
        collected: collectedBy.get(id) ?? 0,
      };
    })
    .sort((a, b) => b.verified - a.verified || b.reported - a.reported || b.enquiries - a.enquiries || b.collected - a.collected);

  return { byVendor, byProduct, byCategory, byCity, bySource, funnel, quotes: qs, pipeline, promotions, ads, league, total: enquiries.length };
}
export type InsReports = Awaited<ReturnType<typeof getInsReports>>;

/* ══ Audit log (ins_approvals + insurance/ad audit_log rows) ════ */

/** audit_log entities that belong to insurance or advertising. */
const auditScope = () =>
  or(
    like(auditLog.entity, "ins\\_%"),
    like(auditLog.entity, "ad\\_%"),
    like(auditLog.entity, "insur%"),
    like(auditLog.entity, "advert%"),
    and(eq(auditLog.entity, "content"), inArray(auditLog.entityId, ["insuranceSettings", "insurancePricing", "insurerPlans", "insurancePage", "insuranceGuides"])),
  );

/** Which vendor an audit row is about, where that can be worked out from its record. */
const auditVendor = sql<number | null>`(CASE ${auditLog.entity}
  WHEN 'ins_vendor' THEN ${auditLog.entityId} + 0
  WHEN 'ins_invoice' THEN (SELECT x.vendor_id FROM ins_invoices x WHERE x.id = ${auditLog.entityId})
  WHEN 'ins_payment' THEN (SELECT x.vendor_id FROM ins_payments x WHERE x.id = ${auditLog.entityId})
  WHEN 'ins_refund' THEN (SELECT x.vendor_id FROM ins_refunds x WHERE x.id = ${auditLog.entityId})
  WHEN 'ins_enquiry' THEN (SELECT x.vendor_id FROM ins_enquiries x WHERE x.id = ${auditLog.entityId})
  WHEN 'ins_quote' THEN (SELECT x.vendor_id FROM ins_quotes x WHERE x.id = ${auditLog.entityId})
  WHEN 'ins_campaign' THEN (SELECT x.vendor_id FROM ins_campaigns x WHERE x.id = ${auditLog.entityId})
  WHEN 'ins_ticket' THEN (SELECT x.vendor_id FROM ins_tickets x WHERE x.id = ${auditLog.entityId})
  WHEN 'ins_ticket_note' THEN (SELECT x.vendor_id FROM ins_tickets x WHERE x.id = ${auditLog.entityId})
  WHEN 'ins_product' THEN (SELECT x.vendor_id FROM ins_products x WHERE x.id = ${auditLog.entityId})
  WHEN 'ins_cover' THEN (SELECT x.vendor_id FROM ins_covers x WHERE x.id = ${auditLog.entityId})
  WHEN 'ins_renewal' THEN (SELECT x.vendor_id FROM ins_renewals x WHERE x.id = ${auditLog.entityId})
  WHEN 'ins_company' THEN (SELECT x.vendor_id FROM ins_companies x WHERE x.id = ${auditLog.entityId})
  WHEN 'ins_file' THEN (SELECT x.vendor_id FROM ins_files x WHERE x.id = ${auditLog.entityId})
  WHEN 'ins_change_request' THEN (SELECT x.vendor_id FROM ins_change_requests x WHERE x.id = ${auditLog.entityId})
  WHEN 'ad_campaign' THEN (SELECT x.ins_vendor_id FROM ad_campaigns x WHERE x.id = ${auditLog.entityId})
  WHEN 'ad_creative' THEN (SELECT c.ins_vendor_id FROM ad_creatives x JOIN ad_campaigns c ON c.id = x.campaign_id WHERE x.id = ${auditLog.entityId})
  ELSE NULL END)`;

export interface AuditFilters {
  q?: string;
  vendor?: string;
  /** "t:<approval target>" or "e:<audit entity>" */
  about?: string;
  side?: string;
  staff?: string;
  from?: string;
  to?: string;
}

export interface AuditEntry {
  key: string;
  source: "approval" | "audit";
  createdAt: Date;
  vendorId: number | null;
  vendorName: string | null;
  vendorRef: string | null;
  /** Approval target or audit entity. */
  about: string;
  aboutId: string | null;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  text: string | null;
  actorName: string | null;
  actorSide: "vendor" | "admin" | "system";
}

export async function listInsAudit(f: AuditFilters, page = 1) {
  await requireStaff();
  const db = getDb();
  const r = dayRange(f.from, f.to);
  const vendorId = numId(f.vendor);
  const staffId = numId(f.staff);
  const target = f.about?.startsWith("t:") ? oneOf(INS_APPROVAL_TARGETS, f.about.slice(2)) : undefined;
  const entity = f.about?.startsWith("e:") && /^[a-z_]{1,40}$/.test(f.about.slice(2)) ? f.about.slice(2) : undefined;
  const side = oneOf(["vendor", "admin", "system"] as const, f.side);
  // Audit rows are staff changes: skip them when filtering by a workflow or a non-staff side, and vice versa.
  const wantApprovals = !entity;
  const wantAudit = !target && (!side || side === "admin");

  const aWhere = and(
    vendorId ? eq(insApprovals.vendorId, vendorId) : undefined,
    target ? eq(insApprovals.target, target) : undefined,
    side ? eq(insApprovals.actorSide, side) : undefined,
    staffId ? eq(insApprovals.actorUserId, staffId) : undefined,
    ...within(insApprovals.createdAt, r),
    f.q ? or(like(insApprovals.remarks, term(f.q)), like(insApprovals.action, term(f.q)), ...vendorSearch(f.q)) : undefined,
  );
  const lWhere = and(
    auditScope(),
    entity ? eq(auditLog.entity, entity) : undefined,
    vendorId ? sql`${auditVendor} = ${vendorId}` : undefined,
    staffId ? eq(auditLog.userId, staffId) : undefined,
    ...within(auditLog.createdAt, r),
    f.q ? like(auditLog.summary, term(f.q)) : undefined,
  );

  const [[aCount], [lCount]] = await Promise.all([
    wantApprovals ? db.select({ total: count() }).from(insApprovals).innerJoin(insVendors, eq(insVendors.id, insApprovals.vendorId)).where(aWhere) : Promise.resolve([{ total: 0 }]),
    wantAudit ? db.select({ total: count() }).from(auditLog).where(lWhere) : Promise.resolve([{ total: 0 }]),
  ]);
  const total = aCount.total + lCount.total;
  const p = clampPage(page, total);
  const take = p * PAGE_SIZE;
  const [approvals, logs] = await Promise.all([
    wantApprovals
      ? db
          .select({ a: insApprovals, ...V, actorName: users.name })
          .from(insApprovals)
          .innerJoin(insVendors, eq(insVendors.id, insApprovals.vendorId))
          .leftJoin(users, eq(users.id, insApprovals.actorUserId))
          .where(aWhere)
          .orderBy(desc(insApprovals.createdAt), desc(insApprovals.id))
          .limit(take)
      : Promise.resolve([]),
    wantAudit
      ? db
          .select({ l: auditLog, actorName: users.name, vendorId: auditVendor })
          .from(auditLog)
          .leftJoin(users, eq(users.id, auditLog.userId))
          .where(lWhere)
          .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
          .limit(take)
      : Promise.resolve([]),
  ]);
  const vendorIds = [...new Set(logs.map((l) => (l.vendorId === null ? null : Number(l.vendorId))).filter((x): x is number => Boolean(x)))];
  const names = vendorIds.length ? await db.select(V).from(insVendors).where(inArray(insVendors.id, vendorIds)) : [];
  const nameOf = new Map(names.map((v) => [v.vendorId, v]));
  const merged: AuditEntry[] = [
    ...approvals.map(
      (x): AuditEntry => ({
        key: `a${x.a.id}`,
        source: "approval",
        createdAt: x.a.createdAt,
        vendorId: x.a.vendorId,
        vendorName: vendorLabel(x),
        vendorRef: x.vendorRef,
        about: x.a.target,
        aboutId: x.a.targetId === null ? null : String(x.a.targetId),
        action: x.a.action,
        fromStatus: x.a.fromStatus,
        toStatus: x.a.toStatus,
        text: x.a.remarks,
        actorName: x.actorName,
        actorSide: x.a.actorSide,
      }),
    ),
    ...logs.map((x): AuditEntry => {
      const vid = x.vendorId === null ? null : Number(x.vendorId) || null;
      const v = vid ? nameOf.get(vid) : undefined;
      return {
        key: `l${x.l.id}`,
        source: "audit",
        createdAt: x.l.createdAt,
        vendorId: vid,
        vendorName: v ? vendorLabel(v) : null,
        vendorRef: v?.vendorRef ?? null,
        about: x.l.entity,
        aboutId: x.l.entityId,
        action: x.l.action,
        fromStatus: null,
        toStatus: null,
        text: x.l.summary,
        actorName: x.actorName,
        actorSide: "admin",
      };
    }),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.key.localeCompare(a.key));
  return { rows: merged.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE), total, page: p };
}

/** Audit entities that actually appear in the log (for the filter). */
export async function auditEntities() {
  await requireStaff();
  const rows = await getDb().selectDistinct({ entity: auditLog.entity }).from(auditLog).where(auditScope());
  return rows.map((r) => r.entity).sort();
}

/* ══ Vendor support ═════════════════════════════════════════════ */

export const NEEDS_REPLY: TicketStatus[] = ["open", "awaiting_support"];

export interface TicketFilters {
  q?: string;
  status?: string;
  priority?: string;
  category?: string;
  vendor?: string;
}

export async function listInsTickets(f: TicketFilters, page?: number) {
  await requireStaff();
  const db = getDb();
  const status = f.status === "needs_reply" ? "needs_reply" : oneOf(TICKET_STATUS, f.status);
  const priority = oneOf(TICKET_PRIORITY, f.priority);
  const where = and(
    status === "needs_reply" ? inArray(insTickets.status, NEEDS_REPLY) : status ? eq(insTickets.status, status) : undefined,
    priority ? eq(insTickets.priority, priority) : undefined,
    f.category && /^[a-z_]{1,40}$/.test(f.category) ? eq(insTickets.category, f.category) : undefined,
    numId(f.vendor) ? eq(insTickets.vendorId, numId(f.vendor)!) : undefined,
    f.q ? or(like(insTickets.subject, term(f.q)), like(insTickets.reference, term(f.q)), ...vendorSearch(f.q)) : undefined,
  );
  const [[{ total }], byStatus, categories, vendors] = await Promise.all([
    db.select({ total: count() }).from(insTickets).innerJoin(insVendors, eq(insVendors.id, insTickets.vendorId)).where(where),
    db.select({ status: insTickets.status, priority: insTickets.priority, n: count() }).from(insTickets).groupBy(insTickets.status, insTickets.priority),
    db.selectDistinct({ category: insTickets.category }).from(insTickets),
    db.selectDistinct(V).from(insVendors).innerJoin(insTickets, eq(insTickets.vendorId, insVendors.id)),
  ]);
  const p = clampPage(page, total);
  const rows = await db
    .select({ t: insTickets, ...V, messages: count(insTicketMessages.id), last: max(insTicketMessages.createdAt), lastFromStaff: sql<string | null>`SUBSTRING_INDEX(GROUP_CONCAT(${insTicketMessages.fromStaff} ORDER BY ${insTicketMessages.createdAt} DESC, ${insTicketMessages.id} DESC), ',', 1)` })
    .from(insTickets)
    .innerJoin(insVendors, eq(insVendors.id, insTickets.vendorId))
    .leftJoin(insTicketMessages, eq(insTicketMessages.ticketId, insTickets.id))
    .where(where)
    .groupBy(insTickets.id)
    .orderBy(sql`FIELD(${insTickets.status}, 'open', 'awaiting_support', 'awaiting_dealer', 'resolved', 'closed')`, desc(insTickets.updatedAt), desc(insTickets.id))
    .limit(PAGE_SIZE)
    .offset((p - 1) * PAGE_SIZE);
  return {
    rows: rows.map((r) => ({ ...r, lastFromStaff: r.lastFromStaff === "1" })),
    total,
    page: p,
    byStatus,
    categories: categories.map((c) => c.category).sort(),
    vendors: vendors.map((v) => ({ value: String(v.vendorId), label: `${vendorLabel(v)} (${v.vendorRef})` })).sort((a, b) => a.label.localeCompare(b.label)),
  };
}

export async function getInsTicket(id: number) {
  await requireStaff();
  const db = getDb();
  const [row] = await db.select({ t: insTickets, v: insVendors }).from(insTickets).innerJoin(insVendors, eq(insVendors.id, insTickets.vendorId)).where(eq(insTickets.id, id));
  if (!row) return null;
  const [messages, opener, notes, [{ others }]] = await Promise.all([
    db
      .select({ id: insTicketMessages.id, fromStaff: insTicketMessages.fromStaff, body: insTicketMessages.body, attachments: insTicketMessages.attachments, createdAt: insTicketMessages.createdAt, author: users.name })
      .from(insTicketMessages)
      .leftJoin(users, eq(users.id, insTicketMessages.userId))
      .where(eq(insTicketMessages.ticketId, id))
      .orderBy(asc(insTicketMessages.createdAt), asc(insTicketMessages.id)),
    row.t.createdBy ? db.select({ name: users.name, email: users.email, phone: users.phone }).from(users).where(eq(users.id, row.t.createdBy)) : Promise.resolve([]),
    db
      .select({ id: auditLog.id, summary: auditLog.summary, createdAt: auditLog.createdAt, by: users.name })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.userId))
      .where(and(eq(auditLog.entity, "ins_ticket_note"), eq(auditLog.entityId, String(id))))
      .orderBy(desc(auditLog.createdAt), desc(auditLog.id)),
    db.select({ others: count() }).from(insTickets).where(eq(insTickets.vendorId, row.v.id)),
  ]);
  return { ...row, messages, opener: opener[0] ?? null, notes, others };
}

/* ── Misc ── */

/** Category label for revenue/report tables. */
export const PRODUCT_CATEGORIES = INS_PRODUCT_CATEGORIES;
