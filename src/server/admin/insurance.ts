import "server-only";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, like, ne, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { getDb } from "@/db";
import {
  INS_COVER_STATUS,
  INS_PRODUCT_CATEGORIES,
  INS_PRODUCT_STATUS,
  INS_VENDOR_CATEGORIES,
  INS_VENDOR_STATUS,
  adCampaigns,
  adCreatives,
  insApprovals,
  insBranches,
  insCampaigns,
  insChangeRequests,
  insCompanies,
  insCovers,
  insEnquiries,
  insFiles,
  insInvoices,
  insMembers,
  insPayments,
  insProducts,
  insQuotes,
  insRefunds,
  insVendors,
  partners,
  users,
} from "@/db/schema";
import type { InsApprovalTarget, InsCoverStatus, InsCoverType, InsProductStatus, InsVendorStatus } from "@/db/enums";
import { INS_REQUIRED_DOCUMENTS } from "@/insurance/application";
import { parseEngineCc, pricingConfigFrom } from "@/insurance/estimator";
import { INS_DOC_KIND_LABEL, INS_LEAD_OPEN } from "@/insurance/labels";
import type { InsurerApplication } from "@/insurance/types";
import { PATTERNS } from "@/partner/application";
import { requireStaff } from "@/server/auth";
import { getCatalog } from "@/server/catalog";
import { publicProductWhere } from "@/server/insurance/public";
import { insInvoiceDisplayStatus } from "@/server/insurance/billing";
import { maskAccount } from "@/server/partner/crypto";
import { todayISO } from "@/server/validation";
import {
  INS_KYC_DOC_KINDS,
  INS_PRODUCT_DECIDED,
  INS_PRODUCT_QUEUE,
  INS_PRODUCT_WITH_VENDOR,
  INS_VENDOR_DECIDED,
  INS_VENDOR_QUEUE,
  INS_VENDOR_WITH_VENDOR,
  daysUntil,
  insVendorName,
  type InsHistoryEntry,
} from "@/components/admin/insurance/ui";

/* ──────────────────────────────────────────────────────────────
   Read side of the insurance administration (/admin/insurance).
   Every function re-checks staff access. File bytes and bank
   account numbers never leave this module: files are listed
   without their data and account numbers come back masked.
   ────────────────────────────────────────────────────────────── */

export const INS_VENDORS_PAGE_SIZE = 20;
export const INS_PRODUCTS_PAGE_SIZE = 20;
export const INS_COVERS_PAGE_SIZE = 40;
export const INS_COMPANIES_PAGE_SIZE = 30;

const owner = alias(users, "owner");
const actor = alias(users, "actor");
const decider = alias(users, "decider");

const term = (q: string) => `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
const pageOf = (page: number | undefined, total: number, size: number) => Math.min(Math.max(1, page ?? 1), Math.max(1, Math.ceil(total / size)));
const isOneOf = <T extends string>(list: readonly T[], v: string | undefined): v is T => !!v && (list as readonly string[]).includes(v);
const vendorNameSql = sql<string>`coalesce(nullif(${insVendors.brandName}, ''), nullif(${insVendors.legalName}, ''), ${insVendors.reference})`;
const DAY = 86_400_000;

/*
 * Correlated subqueries below are written in plain SQL with their own aliases and refer to the outer
 * table by name (ins_vendors.id / ins_companies.id): Drizzle leaves columns unqualified in single-table
 * selects, and an unqualified `id` inside a subquery would bind to the subquery's own table.
 */

/* ── Approval history ───────────────────────────────────────── */

const historyColumns = {
  id: insApprovals.id,
  vendorId: insApprovals.vendorId,
  target: insApprovals.target,
  targetId: insApprovals.targetId,
  action: insApprovals.action,
  fromStatus: insApprovals.fromStatus,
  toStatus: insApprovals.toStatus,
  remarks: insApprovals.remarks,
  actorSide: insApprovals.actorSide,
  actorName: actor.name,
  createdAt: insApprovals.createdAt,
  vendorRef: insVendors.reference,
  vendorName: vendorNameSql,
};
type HistoryRow = { id: number; vendorId: number; target: InsApprovalTarget; targetId: number | null; action: string; fromStatus: string | null; toStatus: string | null; remarks: string | null; actorSide: "vendor" | "admin" | "system"; actorName: string | null; createdAt: Date; vendorRef: string; vendorName: string };

function historyQuery(where: SQL | undefined, limit?: number) {
  const q = getDb()
    .select(historyColumns)
    .from(insApprovals)
    .innerJoin(insVendors, eq(insVendors.id, insApprovals.vendorId))
    .leftJoin(actor, eq(actor.id, insApprovals.actorUserId))
    .where(where)
    .orderBy(desc(insApprovals.createdAt), desc(insApprovals.id));
  return limit ? q.limit(limit) : q;
}

/** Adds the product / cover / document / company each entry is about (and where to open it). */
export async function withInsTargetLabels(rows: HistoryRow[]): Promise<InsHistoryEntry[]> {
  const ids = (t: InsApprovalTarget) => [...new Set(rows.filter((r) => r.target === t && r.targetId).map((r) => r.targetId!))];
  const db = getDb();
  const [prods, covers, docs, comps, camps, ads, pays] = await Promise.all([
    ids("product").length ? db.select({ id: insProducts.id, label: sql<string>`concat(${insProducts.reference}, ' · ', ${insProducts.name})` }).from(insProducts).where(inArray(insProducts.id, ids("product"))) : Promise.resolve([]),
    ids("cover").length ? db.select({ id: insCovers.id, name: insCovers.name, type: insCovers.type }).from(insCovers).where(inArray(insCovers.id, ids("cover"))) : Promise.resolve([]),
    ids("document").length ? db.select({ id: insFiles.id, kind: insFiles.kind }).from(insFiles).where(inArray(insFiles.id, ids("document"))) : Promise.resolve([]),
    ids("company").length ? db.select({ id: insCompanies.id, label: insCompanies.name }).from(insCompanies).where(inArray(insCompanies.id, ids("company"))) : Promise.resolve([]),
    ids("campaign").length ? db.select({ id: insCampaigns.id, label: sql<string>`concat(${insCampaigns.reference}, ' · ', ${insCampaigns.title})` }).from(insCampaigns).where(inArray(insCampaigns.id, ids("campaign"))) : Promise.resolve([]),
    ids("ad_campaign").length ? db.select({ id: adCampaigns.id, label: sql<string>`concat(${adCampaigns.reference}, ' · ', ${adCampaigns.name})` }).from(adCampaigns).where(inArray(adCampaigns.id, ids("ad_campaign"))) : Promise.resolve([]),
    ids("payment").length ? db.select({ id: insPayments.id, label: sql<string>`concat(${insInvoices.number}, ' · ', ${insPayments.utr})` }).from(insPayments).innerJoin(insInvoices, eq(insInvoices.id, insPayments.invoiceId)).where(inArray(insPayments.id, ids("payment"))) : Promise.resolve([]),
  ]);
  const label = new Map<string, { label: string; href?: string }>();
  for (const p of prods) label.set(`product:${p.id}`, { label: p.label });
  for (const c of covers) label.set(`cover:${c.id}`, { label: c.name, href: `/admin/insurance/${c.type === "addon" ? "add-ons" : "coverage"}?review=${c.id}` });
  for (const d of docs) label.set(`document:${d.id}`, { label: INS_DOC_KIND_LABEL[d.kind as keyof typeof INS_DOC_KIND_LABEL] ?? d.kind });
  for (const c of comps) label.set(`company:${c.id}`, { label: c.label });
  for (const c of camps) label.set(`campaign:${c.id}`, { label: c.label });
  for (const a of ads) label.set(`ad_campaign:${a.id}`, { label: a.label });
  for (const p of pays) label.set(`payment:${p.id}`, { label: p.label });
  return rows.map((r) => {
    const l = r.targetId ? label.get(`${r.target}:${r.targetId}`) : undefined;
    return { ...r, targetLabel: l?.label ?? null, href: l?.href ?? null };
  });
}

/* ── Catalogue cars for indicative estimates ────────────────── */

export interface EstimateCar {
  slug: string;
  name: string;
  brand: string;
  brandName: string;
  bodyType: string;
  isLuxury: boolean;
  engineCc: number | null;
  motorKw: number | null;
  variants: { slug: string; name: string; fuel: string; price: number }[];
}

/** Catalogue cars with their variants' ex-showroom prices — for the sample estimate and the pricing calculator. */
export async function estimateCars(): Promise<EstimateCar[]> {
  await requireStaff();
  const catalog = await getCatalog();
  return catalog.cars
    .filter((c) => c.variants.length > 0)
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      brand: c.brand,
      brandName: catalog.brandName(c.brand),
      bodyType: c.bodyType,
      isLuxury: c.isLuxury,
      engineCc: parseEngineCc(c.engine),
      motorKw: c.ev?.motorKw ?? null,
      variants: c.variants.map((v) => ({ slug: v.slug, name: v.name, fuel: v.fuel, price: v.price })),
    }))
    .sort((a, b) => a.brandName.localeCompare(b.brandName) || a.name.localeCompare(b.name));
}

/* ── Dashboard ──────────────────────────────────────────────── */

const IST_DAY = (col: SQL | unknown) => sql<string>`date_format(convert_tz(${col}, '+00:00', '+05:30'), '%Y-%m-%d')`;

export async function insuranceDashboard() {
  await requireStaff();
  const db = getDb();
  const now = new Date();
  const since = new Date(now.getTime() - 84 * DAY); // 12 weeks
  const [
    vendorStatus,
    productStatus,
    [live],
    [enquiries],
    [enquiries30],
    [quotesSubmitted],
    [quoted],
    [interested],
    [reported],
    [verified],
    invoiceSums,
    refundSums,
    vendorQueue,
    productQueue,
    coverQueue,
    [coverCount],
    campaignQueue,
    [campaignCount],
    adQueue,
    [adCount],
    creativeQueue,
    [creativeCount],
    paymentQueue,
    [paymentCount],
    recent,
    enqDays,
    quoteDays,
    policyDays,
  ] = await Promise.all([
    db.select({ status: insVendors.status, n: count() }).from(insVendors).groupBy(insVendors.status),
    db.select({ status: insProducts.status, n: count() }).from(insProducts).groupBy(insProducts.status),
    db.select({ n: count() }).from(insProducts).innerJoin(insVendors, eq(insVendors.id, insProducts.vendorId)).innerJoin(insCompanies, eq(insCompanies.id, insProducts.companyId)).where(publicProductWhere),
    db.select({ n: count() }).from(insEnquiries),
    db.select({ n: count() }).from(insEnquiries).where(gte(insEnquiries.createdAt, new Date(now.getTime() - 30 * DAY))),
    db.select({ n: count() }).from(insQuotes).where(isNotNull(insQuotes.submittedAt)),
    db.select({ n: sql<number>`count(distinct ${insQuotes.enquiryId})`.mapWith(Number) }).from(insQuotes).where(isNotNull(insQuotes.submittedAt)),
    db.select({ n: count() }).from(insEnquiries).where(inArray(insEnquiries.status, ["interested", "policy_issued"])),
    db.select({ n: count() }).from(insEnquiries).where(and(isNotNull(insEnquiries.policyIssuedAt), isNull(insEnquiries.conversionVerifiedAt))),
    db.select({ n: count() }).from(insEnquiries).where(isNotNull(insEnquiries.conversionVerifiedAt)),
    db.select({ id: insInvoices.id, kind: insInvoices.kind, status: insInvoices.status, dueOn: insInvoices.dueOn, total: insInvoices.total }).from(insInvoices).where(ne(insInvoices.status, "void")),
    db.select({ kind: insInvoices.kind, n: sql<number>`coalesce(sum(${insRefunds.amount}), 0)`.mapWith(Number) }).from(insRefunds).innerJoin(insInvoices, eq(insInvoices.id, insRefunds.invoiceId)).groupBy(insInvoices.kind),
    db
      .select({ id: insVendors.id, reference: insVendors.reference, status: insVendors.status, category: insVendors.category, name: vendorNameSql, city: insVendors.city, submittedAt: insVendors.submittedAt, createdAt: insVendors.createdAt })
      .from(insVendors)
      .where(inArray(insVendors.status, INS_VENDOR_QUEUE))
      .orderBy(sql`${insVendors.submittedAt} is null`, asc(insVendors.submittedAt), asc(insVendors.id))
      .limit(6),
    db
      .select({ id: insProducts.id, reference: insProducts.reference, name: insProducts.name, category: insProducts.category, submittedAt: insProducts.submittedAt, createdAt: insProducts.createdAt, vendorName: vendorNameSql })
      .from(insProducts)
      .innerJoin(insVendors, eq(insVendors.id, insProducts.vendorId))
      .where(inArray(insProducts.status, INS_PRODUCT_QUEUE))
      .orderBy(sql`${insProducts.submittedAt} is null`, asc(insProducts.submittedAt), asc(insProducts.id))
      .limit(6),
    db
      .select({ id: insCovers.id, name: insCovers.name, type: insCovers.type, submittedAt: insCovers.submittedAt, createdAt: insCovers.createdAt, vendorName: vendorNameSql })
      .from(insCovers)
      .innerJoin(insVendors, eq(insVendors.id, insCovers.vendorId))
      .where(eq(insCovers.status, "pending_approval"))
      .orderBy(sql`${insCovers.submittedAt} is null`, asc(insCovers.submittedAt), asc(insCovers.id))
      .limit(6),
    db.select({ n: count() }).from(insCovers).where(eq(insCovers.status, "pending_approval")),
    db
      .select({ id: insCampaigns.id, reference: insCampaigns.reference, title: insCampaigns.title, submittedAt: insCampaigns.submittedAt, createdAt: insCampaigns.createdAt, vendorName: vendorNameSql })
      .from(insCampaigns)
      .innerJoin(insVendors, eq(insVendors.id, insCampaigns.vendorId))
      .where(eq(insCampaigns.status, "pending_approval"))
      .orderBy(sql`${insCampaigns.submittedAt} is null`, asc(insCampaigns.submittedAt), asc(insCampaigns.id))
      .limit(6),
    db.select({ n: count() }).from(insCampaigns).where(eq(insCampaigns.status, "pending_approval")),
    db
      .select({
        id: adCampaigns.id,
        reference: adCampaigns.reference,
        name: adCampaigns.name,
        submittedAt: adCampaigns.submittedAt,
        createdAt: adCampaigns.createdAt,
        house: adCampaigns.house,
        advertiser: sql<string | null>`coalesce(nullif(${insVendors.brandName}, ''), nullif(${insVendors.legalName}, ''), nullif(${partners.tradeName}, ''), ${partners.legalName})`,
      })
      .from(adCampaigns)
      .leftJoin(insVendors, eq(insVendors.id, adCampaigns.insVendorId))
      .leftJoin(partners, eq(partners.id, adCampaigns.partnerId))
      .where(eq(adCampaigns.status, "pending_approval"))
      .orderBy(sql`${adCampaigns.submittedAt} is null`, asc(adCampaigns.submittedAt), asc(adCampaigns.id))
      .limit(6),
    db.select({ n: count() }).from(adCampaigns).where(eq(adCampaigns.status, "pending_approval")),
    db
      .select({ id: adCreatives.id, name: adCreatives.name, createdAt: adCreatives.createdAt, campaignId: adCampaigns.id, campaignName: adCampaigns.name })
      .from(adCreatives)
      .innerJoin(adCampaigns, eq(adCampaigns.id, adCreatives.campaignId))
      .where(eq(adCreatives.status, "pending"))
      .orderBy(asc(adCreatives.createdAt), asc(adCreatives.id))
      .limit(6),
    db.select({ n: count() }).from(adCreatives).where(eq(adCreatives.status, "pending")),
    db
      .select({ id: insPayments.id, amount: insPayments.amount, utr: insPayments.utr, method: insPayments.method, createdAt: insPayments.createdAt, invoiceNumber: insInvoices.number, vendorName: vendorNameSql })
      .from(insPayments)
      .innerJoin(insInvoices, eq(insInvoices.id, insPayments.invoiceId))
      .innerJoin(insVendors, eq(insVendors.id, insPayments.vendorId))
      .where(eq(insPayments.status, "submitted"))
      .orderBy(asc(insPayments.createdAt), asc(insPayments.id))
      .limit(6),
    db.select({ n: count() }).from(insPayments).where(eq(insPayments.status, "submitted")),
    historyQuery(ne(insApprovals.action, "internal_note"), 12),
    db.select({ day: IST_DAY(insEnquiries.createdAt), n: count() }).from(insEnquiries).where(gte(insEnquiries.createdAt, since)).groupBy(IST_DAY(insEnquiries.createdAt)),
    db.select({ day: IST_DAY(insQuotes.submittedAt), n: count() }).from(insQuotes).where(gte(insQuotes.submittedAt, since)).groupBy(IST_DAY(insQuotes.submittedAt)),
    db.select({ day: IST_DAY(insEnquiries.policyIssuedAt), n: count() }).from(insEnquiries).where(gte(insEnquiries.policyIssuedAt, since)).groupBy(IST_DAY(insEnquiries.policyIssuedAt)),
  ]);

  const vStatus = Object.fromEntries(INS_VENDOR_STATUS.map((s) => [s, 0])) as Record<InsVendorStatus, number>;
  for (const r of vendorStatus) vStatus[r.status] = r.n;
  const pStatus = Object.fromEntries(INS_PRODUCT_STATUS.map((s) => [s, 0])) as Record<InsProductStatus, number>;
  for (const r of productStatus) pStatus[r.status] = r.n;
  const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

  // Money, as on the revenue page: collected = verified payments − refunds; outstanding = what's still owed on
  // unpaid invoices (due, overdue, payment being verified), part-payments deducted.
  const today = todayISO();
  const verifiedRows = await getDb()
    .select({ invoiceId: insPayments.invoiceId, kind: insInvoices.kind, paid: sql<number>`coalesce(sum(${insPayments.amount}), 0)`.mapWith(Number) })
    .from(insPayments)
    .innerJoin(insInvoices, eq(insInvoices.id, insPayments.invoiceId))
    .where(eq(insPayments.status, "verified"))
    .groupBy(insPayments.invoiceId, insInvoices.kind);
  const paidOn = new Map(verifiedRows.map((r) => [r.invoiceId, r.paid]));
  const money = { advertising: { paid: 0, outstanding: 0, overdue: 0, refunds: 0 }, all: { paid: 0, outstanding: 0, overdue: 0, refunds: 0 } };
  for (const r of verifiedRows) for (const bucket of r.kind === "advertising" ? [money.advertising, money.all] : [money.all]) bucket.paid += r.paid;
  for (const inv of invoiceSums) {
    if (inv.status !== "due" && inv.status !== "verifying") continue;
    const balance = Math.max(0, inv.total - (paidOn.get(inv.id) ?? 0));
    const shown = insInvoiceDisplayStatus(inv, today);
    for (const bucket of inv.kind === "advertising" ? [money.advertising, money.all] : [money.all]) {
      bucket.outstanding += balance;
      if (shown === "overdue") bucket.overdue += balance;
    }
  }
  for (const r of refundSums) {
    money.all.refunds += r.n;
    if (r.kind === "advertising") money.advertising.refunds += r.n;
  }

  // Weekly buckets (IST), oldest first, ending today.
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const end = new Date(Date.parse(`${today}T00:00:00Z`) - (11 - i) * 7 * DAY);
    const start = new Date(end.getTime() - 6 * DAY);
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  });
  const bucket = (rows: { day: string | null; n: number }[]) =>
    weeks.map((w) => rows.filter((r) => r.day && r.day >= w.from && r.day <= w.to).reduce((a, r) => a + r.n, 0));
  const trend = { weeks, enquiries: bucket(enqDays), quotes: bucket(quoteDays), policies: bucket(policyDays) };

  return {
    now: now.getTime(),
    vendors: { status: vStatus, total: sum(vStatus), pending: INS_VENDOR_QUEUE.reduce((a, s) => a + vStatus[s], 0), withVendor: INS_VENDOR_WITH_VENDOR.reduce((a, s) => a + vStatus[s], 0) },
    products: { status: pStatus, total: sum(pStatus), pending: INS_PRODUCT_QUEUE.reduce((a, s) => a + pStatus[s], 0), live: live.n },
    enquiries: { total: enquiries.n, last30: enquiries30.n },
    quotesSubmitted: quotesSubmitted.n,
    funnel: [
      { key: "enquiries", label: "Quote requests", value: enquiries.n },
      { key: "quoted", label: "Quoted by the vendor", value: quoted.n },
      { key: "interested", label: "Customer interested", value: interested.n },
      { key: "reported", label: "Policy issued (reported + verified)", value: reported.n + verified.n },
      { key: "verified", label: "Verified by MarchGear", value: verified.n },
    ],
    conversions: { reported: reported.n, verified: verified.n },
    money,
    queues: {
      vendors: { count: vStatus.submitted + vStatus.pending_approval + vStatus.under_review, rows: vendorQueue },
      products: { count: INS_PRODUCT_QUEUE.reduce((a, s) => a + pStatus[s], 0), rows: productQueue },
      covers: { count: coverCount.n, rows: coverQueue },
      campaigns: { count: campaignCount.n, rows: campaignQueue },
      ads: { count: adCount.n + creativeCount.n, campaigns: adCount.n, creatives: creativeCount.n, rows: adQueue, creativeRows: creativeQueue },
      payments: { count: paymentCount.n, rows: paymentQueue },
    },
    recent: await withInsTargetLabels(recent as HistoryRow[]),
    trend,
  };
}

/* ── Vendors list ───────────────────────────────────────────── */

export interface InsVendorFilters {
  q?: string;
  /** A vendor status, or "queue" (waiting for us) / "with_vendor" (waiting for the vendor). */
  status?: string;
  category?: string;
  state?: string;
  plan?: string;
  sort?: string;
  page?: number;
}

export const INS_VENDOR_SORTS = { newest: "Newest first", waiting: "Longest waiting", name: "Name A–Z", updated: "Recently updated", licence: "Licence expiry" } as const;

function vendorWhere(f: InsVendorFilters, withStatus = true) {
  const conds: SQL[] = [];
  if (withStatus) {
    if (f.status === "queue") conds.push(inArray(insVendors.status, INS_VENDOR_QUEUE));
    else if (f.status === "with_vendor") conds.push(inArray(insVendors.status, INS_VENDOR_WITH_VENDOR));
    else if (isOneOf(INS_VENDOR_STATUS, f.status)) conds.push(eq(insVendors.status, f.status));
  }
  if (isOneOf(INS_VENDOR_CATEGORIES, f.category)) conds.push(eq(insVendors.category, f.category));
  if (f.state) conds.push(eq(insVendors.state, f.state));
  if (f.plan) conds.push(eq(insVendors.plan, f.plan));
  if (f.q) {
    const t = term(f.q);
    conds.push(or(like(insVendors.legalName, t), like(insVendors.brandName, t), like(insVendors.reference, t), like(insVendors.gst, t), like(insVendors.licenceNumber, t), like(insVendors.city, t), like(owner.email, t), like(owner.name, t))!);
  }
  return conds.length ? and(...conds) : undefined;
}

export async function listInsVendors(f: InsVendorFilters) {
  await requireStaff();
  const db = getDb();
  const w = vendorWhere(f);
  const [[{ total }], counts, states] = await Promise.all([
    db.select({ total: count() }).from(insVendors).innerJoin(owner, eq(owner.id, insVendors.ownerUserId)).where(w),
    // Tab counts respect the other filters (category, state, plan, search) but not the status.
    db.select({ status: insVendors.status, n: count() }).from(insVendors).innerJoin(owner, eq(owner.id, insVendors.ownerUserId)).where(vendorWhere(f, false)).groupBy(insVendors.status),
    db.selectDistinct({ state: insVendors.state }).from(insVendors).where(isNotNull(insVendors.state)).orderBy(asc(insVendors.state)),
  ]);
  const page = pageOf(f.page, total, INS_VENDORS_PAGE_SIZE);
  const order =
    f.sort === "name"
      ? [sql`coalesce(nullif(${insVendors.brandName}, ''), nullif(${insVendors.legalName}, ''), ${owner.name})`, asc(insVendors.id)]
      : f.sort === "updated"
        ? [desc(insVendors.updatedAt), desc(insVendors.id)]
        : f.sort === "licence"
          ? [sql`${insVendors.licenceValidUntil} is null`, asc(insVendors.licenceValidUntil), asc(insVendors.id)]
          : f.sort === "waiting"
            ? [sql`${insVendors.status} in ('submitted', 'pending_approval', 'under_review') desc`, sql`${insVendors.submittedAt} is null`, asc(insVendors.submittedAt), asc(insVendors.id)]
            : [desc(insVendors.createdAt), desc(insVendors.id)];
  const rows = await db
    .select({
      id: insVendors.id,
      reference: insVendors.reference,
      status: insVendors.status,
      category: insVendors.category,
      legalName: insVendors.legalName,
      brandName: insVendors.brandName,
      city: insVendors.city,
      state: insVendors.state,
      licenceNumber: insVendors.licenceNumber,
      licenceValidUntil: insVendors.licenceValidUntil,
      plan: insVendors.plan,
      planStatus: insVendors.planStatus,
      step: insVendors.step,
      submittedAt: insVendors.submittedAt,
      approvedAt: insVendors.approvedAt,
      createdAt: insVendors.createdAt,
      ownerName: owner.name,
      ownerEmail: owner.email,
      published: sql<number>`(select count(*) from ins_products p where p.vendor_id = ins_vendors.id and p.status = 'published')`.mapWith(Number),
      pendingItems: sql<number>`((select count(*) from ins_products p where p.vendor_id = ins_vendors.id and p.status in ('submitted', 'pending_approval')) + (select count(*) from ins_covers c where c.vendor_id = ins_vendors.id and c.status = 'pending_approval') + (select count(*) from ins_change_requests r where r.vendor_id = ins_vendors.id and r.status = 'pending'))`.mapWith(Number),
    })
    .from(insVendors)
    .innerJoin(owner, eq(owner.id, insVendors.ownerUserId))
    .where(w)
    .orderBy(...order)
    .limit(INS_VENDORS_PAGE_SIZE)
    .offset((page - 1) * INS_VENDORS_PAGE_SIZE);
  const byStatus = Object.fromEntries(INS_VENDOR_STATUS.map((s) => [s, 0])) as Record<InsVendorStatus, number>;
  for (const c of counts) byStatus[c.status] = c.n;
  return { rows: rows.map((r) => ({ ...r, name: insVendorName(r) })), total, page, byStatus, states: states.map((s) => s.state!).filter(Boolean), now: Date.now(), today: todayISO() };
}

/* ── One vendor ─────────────────────────────────────────────── */

const fileColumns = {
  id: insFiles.id,
  kind: insFiles.kind,
  filename: insFiles.filename,
  mime: insFiles.mime,
  size: insFiles.size,
  status: insFiles.status,
  remarks: insFiles.remarks,
  createdAt: insFiles.createdAt,
};
export type InsFileRow = { id: number; kind: string; filename: string; mime: string; size: number; status: "pending" | "verified" | "rejected"; remarks: string | null; createdAt: Date };

/** The application as the browser may see it: no account number, only the mask. */
function safeApplication(app: InsurerApplication): InsurerApplication {
  const stored = app.bank?.accountNumber ?? "";
  return { ...app, bank: { ...app.bank, accountNumber: "", accountMasked: stored ? maskAccount(stored) : (app.bank?.accountMasked ?? "") } };
}

/** Bank values in change requests are encrypted — the browser only sees them masked. */
const isSecretPath = (path: string) => path === "bank.accountNumber";
function safeFields(fields: Record<string, { from: string; to: string }>) {
  return Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, isSecretPath(k) ? { from: v?.from ? maskAccount(String(v.from)) : "", to: v?.to ? maskAccount(String(v.to)) : "" } : { from: String(v?.from ?? ""), to: String(v?.to ?? "") }]),
  );
}

export async function getInsVendorDetail(id: number) {
  await requireStaff();
  const db = getDb();
  const [row] = await db
    .select({
      vendor: insVendors,
      owner: { id: owner.id, name: owner.name, email: owner.email, phone: owner.phone, isActive: owner.isActive, createdAt: owner.createdAt },
      deciderName: decider.name,
    })
    .from(insVendors)
    .innerJoin(owner, eq(owner.id, insVendors.ownerUserId))
    .leftJoin(decider, eq(decider.id, insVendors.decidedBy))
    .where(eq(insVendors.id, id));
  if (!row) return null;
  const v = row.vendor;
  const requester = alias(users, "requester");
  const [members, branches, files, products, coverRows, enquiryRows, [quotes], invoices, refunds, [paymentsPending], history, changes, linkedCompanies, freeCompanies] = await Promise.all([
    db
      .select({ id: insMembers.id, role: insMembers.role, isActive: insMembers.isActive, permissions: insMembers.permissions, createdAt: insMembers.createdAt, userId: users.id, name: users.name, email: users.email, phone: users.phone, userActive: users.isActive })
      .from(insMembers)
      .innerJoin(users, eq(users.id, insMembers.userId))
      .where(eq(insMembers.vendorId, id))
      .orderBy(asc(insMembers.id)),
    db.select().from(insBranches).where(eq(insBranches.vendorId, id)).orderBy(desc(insBranches.isPrimary), asc(insBranches.id)),
    db.select(fileColumns).from(insFiles).where(eq(insFiles.vendorId, id)).orderBy(desc(insFiles.createdAt), desc(insFiles.id)),
    db
      .select({ id: insProducts.id, reference: insProducts.reference, name: insProducts.name, category: insProducts.category, status: insProducts.status, updatedAt: insProducts.updatedAt, submittedAt: insProducts.submittedAt, companyName: insCompanies.name, companyActive: insCompanies.isActive })
      .from(insProducts)
      .innerJoin(insCompanies, eq(insCompanies.id, insProducts.companyId))
      .where(eq(insProducts.vendorId, id))
      .orderBy(desc(insProducts.updatedAt)),
    db.select({ type: insCovers.type, status: insCovers.status, n: count() }).from(insCovers).where(eq(insCovers.vendorId, id)).groupBy(insCovers.type, insCovers.status),
    db
      .select({ status: insEnquiries.status, n: count(), reported: sql<number>`sum(${insEnquiries.policyIssuedAt} is not null and ${insEnquiries.conversionVerifiedAt} is null)`.mapWith(Number), verified: sql<number>`sum(${insEnquiries.conversionVerifiedAt} is not null)`.mapWith(Number), recent: sql<number>`sum(${insEnquiries.createdAt} >= utc_timestamp() - interval 30 day)`.mapWith(Number) })
      .from(insEnquiries)
      .where(eq(insEnquiries.vendorId, id))
      .groupBy(insEnquiries.status),
    db.select({ n: count() }).from(insQuotes).where(and(eq(insQuotes.vendorId, id), isNotNull(insQuotes.submittedAt))),
    db.select({ id: insInvoices.id, number: insInvoices.number, kind: insInvoices.kind, description: insInvoices.description, total: insInvoices.total, status: insInvoices.status, dueOn: insInvoices.dueOn, createdAt: insInvoices.createdAt }).from(insInvoices).where(eq(insInvoices.vendorId, id)).orderBy(desc(insInvoices.createdAt), desc(insInvoices.id)),
    db.select({ n: sql<number>`coalesce(sum(${insRefunds.amount}), 0)`.mapWith(Number) }).from(insRefunds).where(eq(insRefunds.vendorId, id)),
    db.select({ n: count() }).from(insPayments).where(and(eq(insPayments.vendorId, id), eq(insPayments.status, "submitted"))),
    historyQuery(eq(insApprovals.vendorId, id)),
    db
      .select({ id: insChangeRequests.id, fields: insChangeRequests.fields, status: insChangeRequests.status, remarks: insChangeRequests.remarks, createdAt: insChangeRequests.createdAt, decidedAt: insChangeRequests.decidedAt, requestedBy: requester.name, decidedBy: decider.name })
      .from(insChangeRequests)
      .leftJoin(requester, eq(requester.id, insChangeRequests.requestedBy))
      .leftJoin(decider, eq(decider.id, insChangeRequests.decidedBy))
      .where(eq(insChangeRequests.vendorId, id))
      .orderBy(sql`${insChangeRequests.status} = 'pending' desc`, desc(insChangeRequests.createdAt)),
    db.select({ id: insCompanies.id, name: insCompanies.name, slug: insCompanies.slug, isActive: insCompanies.isActive, logo: insCompanies.logo }).from(insCompanies).where(eq(insCompanies.vendorId, id)),
    db.select({ id: insCompanies.id, name: insCompanies.name, slug: insCompanies.slug, isActive: insCompanies.isActive }).from(insCompanies).where(isNull(insCompanies.vendorId)).orderBy(asc(insCompanies.name)),
  ]);
  const app = v.application;
  const today = todayISO();
  const labelled = await withInsTargetLabels(history as HistoryRow[]);
  const fileRows = files as InsFileRow[];

  const enquiryTotal = enquiryRows.reduce((a, r) => a + r.n, 0);
  const enquiry = {
    total: enquiryTotal,
    open: enquiryRows.filter((r) => INS_LEAD_OPEN.includes(r.status)).reduce((a, r) => a + r.n, 0),
    last30: enquiryRows.reduce((a, r) => a + (r.recent || 0), 0),
    quotes: quotes.n,
    reported: enquiryRows.reduce((a, r) => a + (r.reported || 0), 0),
    verified: enquiryRows.reduce((a, r) => a + (r.verified || 0), 0),
    byStatus: Object.fromEntries(enquiryRows.map((r) => [r.status, r.n])) as Record<string, number>,
  };
  // The revenue page's rules: collected = verified payments − refunds; outstanding = what's still owed on unpaid invoices.
  const verified = await db
    .select({ invoiceId: insPayments.invoiceId, paid: sql<number>`coalesce(sum(${insPayments.amount}), 0)`.mapWith(Number) })
    .from(insPayments)
    .where(and(eq(insPayments.vendorId, id), eq(insPayments.status, "verified")))
    .groupBy(insPayments.invoiceId);
  const paidOn = new Map(verified.map((r) => [r.invoiceId, r.paid]));
  const billing = { collected: verified.reduce((a, r) => a + r.paid, 0), outstanding: 0, overdue: 0, refunds: refunds[0]?.n ?? 0, paymentsPending: paymentsPending.n };
  for (const inv of invoices) {
    if (inv.status !== "due" && inv.status !== "verifying") continue;
    const balance = Math.max(0, inv.total - (paidOn.get(inv.id) ?? 0));
    billing.outstanding += balance;
    if (insInvoiceDisplayStatus(inv, today) === "overdue") billing.overdue += balance;
  }
  billing.collected -= billing.refunds;

  const catalog = await getCatalog();
  const plan = catalog.content.insurerPlans.plans.find((p) => p.id === v.plan) ?? null;

  return {
    vendor: { ...v, application: safeApplication(app) },
    name: insVendorName(v),
    owner: row.owner,
    deciderName: row.deciderName,
    members,
    branches,
    files: fileRows,
    products,
    covers: coverRows,
    enquiry,
    billing,
    invoices: invoices.slice(0, 12).map((i) => ({ ...i, shown: insInvoiceDisplayStatus(i, today) })),
    invoiceCount: invoices.length,
    history: labelled,
    notes: labelled.filter((h) => h.action === "internal_note"),
    // The vendor's reason is on their "submitted"/"requested" entry for the request.
    changes: changes.map((c) => ({ ...c, fields: safeFields(c.fields), reason: history.find((h) => h.target === "profile_change" && h.targetId === c.id && (h.action === "submitted" || h.action === "requested"))?.remarks ?? null })),
    linkedCompanies,
    freeCompanies,
    plan,
    checklist: buildInsChecklist(app, fileRows, branches.length, today),
    hasBankNumber: Boolean(app.bank?.accountNumber),
    resubmitted: INS_VENDOR_QUEUE.includes(v.status) && history.some((h) => h.target === "vendor" && (h.toStatus === "changes_requested" || h.toStatus === "documents_required")),
    today,
    now: Date.now(),
  };
}
export type InsVendorDetail = NonNullable<Awaited<ReturnType<typeof getInsVendorDetail>>>;

export interface InsChecklistItem {
  key: "contact" | "company" | "registration" | "regulatory" | "branches" | "bank" | "documents";
  label: string;
  ok: boolean;
  /** Not passed, but not a blocker either (amber). */
  warn?: boolean;
  detail: string;
}

/** The application's required documents with the file that currently stands for each. */
export function requiredInsDocuments(app: InsurerApplication, files: InsFileRow[]) {
  return INS_REQUIRED_DOCUMENTS.map((d) => {
    const ref = app.documents?.[d.key] ?? null;
    const file = (ref && files.find((f) => f.id === ref.id)) || files.find((f) => f.kind === d.kind) || null;
    return { key: d.key, kind: d.kind, label: d.label, file };
  });
}

/** What a reviewer checks before approving a vendor application. */
export function buildInsChecklist(app: InsurerApplication, files: InsFileRow[], branchCount: number, today = todayISO()): InsChecklistItem[] {
  const c = app.contact ?? { mobileVerified: false, emailVerified: false };
  const co = app.company ?? ({} as InsurerApplication["company"]);
  const reg = app.registration ?? ({} as InsurerApplication["registration"]);
  const rg = app.regulatory ?? ({ representative: {} } as InsurerApplication["regulatory"]);
  const bank = app.bank ?? ({} as InsurerApplication["bank"]);

  const companyMissing = [
    !co.legalName && "legal name",
    !co.brandName && "brand name",
    !co.businessType && "business type",
    !co.address && "address",
    !co.city && "city",
    !co.state && "state",
    !PATTERNS.pin.test(co.pin ?? "") && "valid PIN",
  ].filter(Boolean) as string[];

  const gst = (reg.gstin ?? "").toUpperCase();
  const pan = (reg.pan ?? "").toUpperCase();
  const gstOk = PATTERNS.gst.test(gst);
  const panOk = PATTERNS.pan.test(pan);
  const panInGst = gstOk && panOk && gst.slice(2, 12) === pan;
  const regIssues = [!gst ? "GSTIN missing" : !gstOk && "GSTIN format invalid", !pan ? "PAN missing" : !panOk && "PAN format invalid", gstOk && panOk && !panInGst && "PAN doesn't match the GSTIN", !reg.cin && "CIN / registration number missing"].filter(Boolean) as string[];

  const rep = rg.representative ?? { name: "", mobile: "", email: "" };
  const validity = rg.licenceValidUntil ? daysUntil(rg.licenceValidUntil, today) : null;
  const regulatoryMissing = [!rg.category && "category", !rg.registrationType && "registration type", !rg.licenceNumber && "licence number", !rg.licenceValidUntil && "licence validity", !(rep.name && rep.mobile && rep.email) && "representative details"].filter(Boolean) as string[];
  const expired = validity !== null && validity < 0;
  const expiringSoon = validity !== null && validity >= 0 && validity <= 60;

  const branches = branchCount || app.branches?.length || 0;
  const primary = branchCount ? true : (app.branches ?? []).some((b) => b.isPrimary);

  const proof = (bank.proof && files.find((f) => f.id === bank.proof!.id)) || files.find((f) => f.kind === "bank_proof") || null;
  const bankIssues = [!bank.holder && "account holder", !bank.bankName && "bank name", !bank.accountNumber && "account number", !PATTERNS.ifsc.test((bank.ifsc ?? "").toUpperCase()) && "valid IFSC", !proof && "bank proof"].filter(Boolean) as string[];

  const docs = requiredInsDocuments(app, files);
  const missing = docs.filter((d) => !d.file);
  const verified = docs.filter((d) => d.file?.status === "verified");
  const rejected = docs.filter((d) => d.file?.status === "rejected");

  return [
    {
      key: "contact",
      label: "Contact verified",
      ok: Boolean(c.mobileVerified && c.emailVerified),
      warn: true,
      detail: c.mobileVerified && c.emailVerified ? "Mobile and email verified by OTP" : `${c.mobileVerified ? "Mobile verified" : "Mobile not verified"} · ${c.emailVerified ? "email verified" : "email not verified"}`,
    },
    { key: "company", label: "Company details", ok: companyMissing.length === 0, detail: companyMissing.length ? `Missing: ${companyMissing.join(", ")}` : `${co.legalName} · ${co.city}, ${co.state}` },
    { key: "registration", label: "Business registration", ok: regIssues.length === 0, detail: regIssues.length ? regIssues.join(" · ") : `${gst} · PAN matches the GSTIN` },
    {
      key: "regulatory",
      label: "Regulatory authorisation",
      ok: regulatoryMissing.length === 0 && !expired && !expiringSoon,
      warn: regulatoryMissing.length === 0 && expiringSoon,
      detail: regulatoryMissing.length ? `Missing: ${regulatoryMissing.join(", ")}` : expired ? `Licence ${rg.licenceNumber} expired ${Math.abs(validity!)} days ago` : expiringSoon ? `Licence ${rg.licenceNumber} expires in ${validity} days` : `Licence ${rg.licenceNumber}, valid ${validity} more days`,
    },
    { key: "branches", label: "Branch offices", ok: branches > 0 && primary, detail: branches ? `${branches} branch${branches === 1 ? "" : "es"}${primary ? "" : " · no primary branch"}` : "No branch added" },
    { key: "bank", label: "Banking details", ok: bankIssues.length === 0, detail: bankIssues.length ? `Missing: ${bankIssues.join(", ")}` : `${(bank.ifsc ?? "").toUpperCase()} · account and proof on file` },
    {
      key: "documents",
      label: "Documents",
      ok: missing.length === 0 && verified.length === docs.length,
      warn: missing.length === 0 && rejected.length === 0,
      detail: missing.length ? `${missing.length} of ${docs.length} missing` : `${verified.length} of ${docs.length} verified${rejected.length ? ` · ${rejected.length} rejected` : ""}`,
    },
  ];
}

/* ── Vendor verification queue ──────────────────────────────── */

export async function insVendorQueue(view: "review" | "vendor" | "decided") {
  await requireStaff();
  const db = getDb();
  const statuses = view === "vendor" ? INS_VENDOR_WITH_VENDOR : view === "decided" ? INS_VENDOR_DECIDED : INS_VENDOR_QUEUE;
  const [rows, counts] = await Promise.all([
    db
      .select({
        id: insVendors.id,
        reference: insVendors.reference,
        status: insVendors.status,
        category: insVendors.category,
        legalName: insVendors.legalName,
        brandName: insVendors.brandName,
        city: insVendors.city,
        application: insVendors.application,
        submittedAt: insVendors.submittedAt,
        updatedAt: insVendors.updatedAt,
        createdAt: insVendors.createdAt,
        branches: sql<number>`(select count(*) from ins_branches b where b.vendor_id = ins_vendors.id)`.mapWith(Number),
        resubmitted: sql<number>`exists(select 1 from ins_approvals a where a.vendor_id = ins_vendors.id and a.target = 'vendor' and a.to_status in ('changes_requested', 'documents_required'))`.mapWith(Number),
      })
      .from(insVendors)
      .where(inArray(insVendors.status, statuses))
      .orderBy(...(view === "decided" ? [desc(insVendors.updatedAt)] : [sql`${insVendors.submittedAt} is null`, asc(insVendors.submittedAt), asc(insVendors.id)]))
      .limit(view === "decided" ? 30 : 100),
    db.select({ status: insVendors.status, n: count() }).from(insVendors).where(inArray(insVendors.status, [...INS_VENDOR_QUEUE, ...INS_VENDOR_WITH_VENDOR])).groupBy(insVendors.status),
  ]);
  const ids = rows.map((r) => r.id);
  const files = ids.length ? await db.select({ ...fileColumns, vendorId: insFiles.vendorId }).from(insFiles).where(and(inArray(insFiles.vendorId, ids), inArray(insFiles.kind, [...INS_KYC_DOC_KINDS]))).orderBy(desc(insFiles.createdAt), desc(insFiles.id)) : [];
  const today = todayISO();
  const n = (list: InsVendorStatus[]) => counts.filter((c) => list.includes(c.status)).reduce((a, c) => a + c.n, 0);
  return {
    rows: rows.map(({ application, ...r }) => ({
      ...r,
      name: insVendorName({ ...r, application }),
      resubmitted: Boolean(r.resubmitted) && INS_VENDOR_QUEUE.includes(r.status),
      checklist: buildInsChecklist(application, files.filter((f) => f.vendorId === r.id) as InsFileRow[], r.branches, today),
    })),
    counts: { review: n(INS_VENDOR_QUEUE), vendor: n(INS_VENDOR_WITH_VENDOR) },
    now: Date.now(),
  };
}

/* ── Insurance companies ────────────────────────────────────── */

export async function listInsCompanies(f: { q?: string; status?: string; page?: number }) {
  await requireStaff();
  const db = getDb();
  const conds: SQL[] = [];
  if (f.status === "active") conds.push(eq(insCompanies.isActive, true));
  if (f.status === "inactive") conds.push(eq(insCompanies.isActive, false));
  if (f.status === "verified") conds.push(sql`json_extract(${insCompanies.claimInfo}, '$.verified') = true`);
  if (f.q) {
    const t = term(f.q);
    conds.push(or(like(insCompanies.name, t), like(insCompanies.slug, t), like(insCompanies.shortName, t), like(insCompanies.headquarters, t), like(insCompanies.regulatorRegNo, t))!);
  }
  const w = conds.length ? and(...conds) : undefined;
  const [[{ total }], [{ all }], [{ active }]] = await Promise.all([
    db.select({ total: count() }).from(insCompanies).where(w),
    db.select({ all: count() }).from(insCompanies),
    db.select({ active: count() }).from(insCompanies).where(eq(insCompanies.isActive, true)),
  ]);
  const page = pageOf(f.page, total, INS_COMPANIES_PAGE_SIZE);
  const rows = await db
    .select({
      id: insCompanies.id,
      slug: insCompanies.slug,
      name: insCompanies.name,
      shortName: insCompanies.shortName,
      logo: insCompanies.logo,
      headquarters: insCompanies.headquarters,
      claimInfo: insCompanies.claimInfo,
      isActive: insCompanies.isActive,
      updatedAt: insCompanies.updatedAt,
      vendorId: insCompanies.vendorId,
      vendorName: sql<string | null>`(select coalesce(nullif(v.brand_name, ''), nullif(v.legal_name, ''), v.reference) from ins_vendors v where v.id = ins_companies.vendor_id)`,
      products: sql<number>`(select count(*) from ins_products p where p.company_id = ins_companies.id)`.mapWith(Number),
      published: sql<number>`(select count(*) from ins_products p where p.company_id = ins_companies.id and p.status = 'published')`.mapWith(Number),
    })
    .from(insCompanies)
    .where(w)
    .orderBy(desc(insCompanies.isActive), asc(insCompanies.name))
    .limit(INS_COMPANIES_PAGE_SIZE)
    .offset((page - 1) * INS_COMPANIES_PAGE_SIZE);
  return { rows, total, page, counts: { all, active, inactive: all - active } };
}

export async function getInsCompany(id: number) {
  await requireStaff();
  const db = getDb();
  const [company] = await db.select().from(insCompanies).where(eq(insCompanies.id, id));
  if (!company) return null;
  const verifier = alias(users, "verifier");
  const [products, verifiedBy] = await Promise.all([
    db
      .select({ id: insProducts.id, reference: insProducts.reference, name: insProducts.name, status: insProducts.status, category: insProducts.category, vendorId: insProducts.vendorId, vendorName: vendorNameSql })
      .from(insProducts)
      .innerJoin(insVendors, eq(insVendors.id, insProducts.vendorId))
      .where(eq(insProducts.companyId, id))
      .orderBy(desc(insProducts.updatedAt)),
    company.claimInfo?.verifiedBy ? db.select({ name: verifier.name }).from(verifier).where(eq(verifier.id, company.claimInfo.verifiedBy)) : Promise.resolve([]),
  ]);
  return { company, products, verifiedByName: verifiedBy[0]?.name ?? null };
}
export type InsCompanyDetail = NonNullable<Awaited<ReturnType<typeof getInsCompany>>>;

/** Insurer-category vendors a company can be linked to, and which company each already has. */
export async function insurerVendorOptions() {
  await requireStaff();
  const rows = await getDb()
    .select({ id: insVendors.id, reference: insVendors.reference, status: insVendors.status, name: vendorNameSql, companyId: sql<number | null>`(select c.id from ins_companies c where c.vendor_id = ins_vendors.id limit 1)` })
    .from(insVendors)
    .where(and(eq(insVendors.category, "insurer"), ne(insVendors.status, "draft")))
    .orderBy(asc(vendorNameSql));
  return rows;
}

/* ── Products ───────────────────────────────────────────────── */

export interface InsProductFilters {
  /** A product status, or "queue" / "with_vendor". */
  status?: string;
  category?: string;
  vendor?: number;
  company?: number;
  q?: string;
  page?: number;
}

function productWhere(f: InsProductFilters, withStatus = true) {
  const conds: SQL[] = [];
  if (withStatus) {
    if (f.status === "queue") conds.push(inArray(insProducts.status, INS_PRODUCT_QUEUE));
    else if (f.status === "with_vendor") conds.push(inArray(insProducts.status, INS_PRODUCT_WITH_VENDOR));
    else if (isOneOf(INS_PRODUCT_STATUS, f.status)) conds.push(eq(insProducts.status, f.status));
  }
  if (isOneOf(INS_PRODUCT_CATEGORIES, f.category)) conds.push(eq(insProducts.category, f.category));
  if (f.vendor) conds.push(eq(insProducts.vendorId, f.vendor));
  if (f.company) conds.push(eq(insProducts.companyId, f.company));
  if (f.q) {
    const t = term(f.q);
    conds.push(or(like(insProducts.reference, t), like(insProducts.name, t), like(insProducts.code, t), like(insProducts.uin, t), like(insVendors.brandName, t), like(insVendors.legalName, t), like(insCompanies.name, t))!);
  }
  return conds.length ? and(...conds) : undefined;
}

const productListColumns = {
  id: insProducts.id,
  reference: insProducts.reference,
  code: insProducts.code,
  name: insProducts.name,
  category: insProducts.category,
  status: insProducts.status,
  coverage: insProducts.coverage,
  addOns: insProducts.addOns,
  submittedAt: insProducts.submittedAt,
  updatedAt: insProducts.updatedAt,
  createdAt: insProducts.createdAt,
  publishedAt: insProducts.publishedAt,
  vendorId: insVendors.id,
  vendorRef: insVendors.reference,
  vendorName: vendorNameSql,
  vendorStatus: insVendors.status,
  companyId: insCompanies.id,
  companyName: insCompanies.name,
  companyActive: insCompanies.isActive,
};

/** How many covers each product uses, and how many of those aren't approved yet. */
async function coverReadiness<T extends { id: number; vendorId: number; coverage: { coverIds: number[] }; addOns: { coverId: number }[] }>(rows: T[]) {
  const ids = [...new Set(rows.flatMap((r) => [...(r.coverage?.coverIds ?? []), ...(r.addOns ?? []).map((a) => a.coverId)]))];
  const covers = ids.length ? await getDb().select({ id: insCovers.id, vendorId: insCovers.vendorId, status: insCovers.status }).from(insCovers).where(inArray(insCovers.id, ids)) : [];
  const byId = new Map(covers.map((c) => [c.id, c]));
  return rows.map(({ coverage, addOns, ...r }) => {
    const used = [...new Set([...(coverage?.coverIds ?? []), ...(addOns ?? []).map((a) => a.coverId)])];
    const statuses = used.map((id) => {
      const c = byId.get(id);
      return c && c.vendorId === r.vendorId ? c.status : ("missing" as const);
    });
    return { ...r, covers: used.length, coversPending: statuses.filter((s) => s === "pending_approval").length, coversBlocked: statuses.filter((s) => s !== "approved" && s !== "pending_approval").length };
  });
}

export async function listInsProducts(f: InsProductFilters) {
  await requireStaff();
  const db = getDb();
  const w = productWhere(f);
  const from = () => db.select({ n: count() }).from(insProducts).innerJoin(insVendors, eq(insVendors.id, insProducts.vendorId)).innerJoin(insCompanies, eq(insCompanies.id, insProducts.companyId));
  const [[{ n: total }], counts] = await Promise.all([
    from().where(w),
    db.select({ status: insProducts.status, n: count() }).from(insProducts).innerJoin(insVendors, eq(insVendors.id, insProducts.vendorId)).innerJoin(insCompanies, eq(insCompanies.id, insProducts.companyId)).where(productWhere(f, false)).groupBy(insProducts.status),
  ]);
  const page = pageOf(f.page, total, INS_PRODUCTS_PAGE_SIZE);
  const queueFirst = f.status === "queue";
  const rows = await db
    .select(productListColumns)
    .from(insProducts)
    .innerJoin(insVendors, eq(insVendors.id, insProducts.vendorId))
    .innerJoin(insCompanies, eq(insCompanies.id, insProducts.companyId))
    .where(w)
    .orderBy(...(queueFirst ? [sql`${insProducts.submittedAt} is null`, asc(insProducts.submittedAt), asc(insProducts.id)] : [desc(insProducts.updatedAt), desc(insProducts.id)]))
    .limit(INS_PRODUCTS_PAGE_SIZE)
    .offset((page - 1) * INS_PRODUCTS_PAGE_SIZE);
  const byStatus = Object.fromEntries(INS_PRODUCT_STATUS.map((s) => [s, 0])) as Record<InsProductStatus, number>;
  for (const c of counts) byStatus[c.status] = c.n;
  return { rows: await coverReadiness(rows), total, page, byStatus, now: Date.now() };
}

export async function insProductQueue(view: "review" | "vendor" | "decided") {
  await requireStaff();
  const db = getDb();
  const statuses = view === "vendor" ? INS_PRODUCT_WITH_VENDOR : view === "decided" ? INS_PRODUCT_DECIDED : INS_PRODUCT_QUEUE;
  const [rows, counts] = await Promise.all([
    db
      .select(productListColumns)
      .from(insProducts)
      .innerJoin(insVendors, eq(insVendors.id, insProducts.vendorId))
      .innerJoin(insCompanies, eq(insCompanies.id, insProducts.companyId))
      .where(inArray(insProducts.status, statuses))
      .orderBy(...(view === "decided" ? [desc(insProducts.updatedAt), desc(insProducts.id)] : [sql`${insProducts.submittedAt} is null`, asc(insProducts.submittedAt), asc(insProducts.id)]))
      .limit(view === "decided" ? 40 : 100),
    db.select({ status: insProducts.status, n: count() }).from(insProducts).where(inArray(insProducts.status, [...INS_PRODUCT_QUEUE, ...INS_PRODUCT_WITH_VENDOR])).groupBy(insProducts.status),
  ]);
  const n = (list: InsProductStatus[]) => counts.filter((c) => list.includes(c.status)).reduce((a, c) => a + c.n, 0);
  return { rows: await coverReadiness(rows), counts: { review: n(INS_PRODUCT_QUEUE), vendor: n(INS_PRODUCT_WITH_VENDOR) }, now: Date.now() };
}

export async function insProductFilterOptions() {
  await requireStaff();
  const db = getDb();
  const [vendors, companies] = await Promise.all([
    db.select({ id: insVendors.id, name: vendorNameSql, reference: insVendors.reference }).from(insVendors).where(sql`exists(select 1 from ins_products p where p.vendor_id = ins_vendors.id)`).orderBy(asc(vendorNameSql)).limit(500),
    db.select({ id: insCompanies.id, name: insCompanies.name }).from(insCompanies).orderBy(asc(insCompanies.name)).limit(500),
  ]);
  return { vendors: vendors.map((v) => ({ value: String(v.id), label: v.name })), companies: companies.map((c) => ({ value: String(c.id), label: c.name })) };
}

export async function getInsProductReview(id: number) {
  await requireStaff();
  const db = getDb();
  const [row] = await db
    .select({ product: insProducts, vendorName: vendorNameSql, vendorRef: insVendors.reference, vendorStatus: insVendors.status, vendorCategory: insVendors.category, vendorPlan: insVendors.plan, company: { id: insCompanies.id, name: insCompanies.name, slug: insCompanies.slug, isActive: insCompanies.isActive, logo: insCompanies.logo, vendorId: insCompanies.vendorId }, createdByName: users.name })
    .from(insProducts)
    .innerJoin(insVendors, eq(insVendors.id, insProducts.vendorId))
    .innerJoin(insCompanies, eq(insCompanies.id, insProducts.companyId))
    .leftJoin(users, eq(users.id, insProducts.createdBy))
    .where(eq(insProducts.id, id));
  if (!row) return null;
  const p = row.product;
  const coverIds = [...new Set([...(p.coverage?.coverIds ?? []), ...(p.addOns ?? []).map((a) => a.coverId)])];
  const docIds = [p.documents?.brochure?.id, p.documents?.wording?.id, p.documents?.tieUp?.id].filter((x): x is number => typeof x === "number");
  const [covers, docs, history, [published]] = await Promise.all([
    coverIds.length ? db.select().from(insCovers).where(inArray(insCovers.id, coverIds)) : Promise.resolve([]),
    docIds.length ? db.select(fileColumns).from(insFiles).where(and(inArray(insFiles.id, docIds), eq(insFiles.vendorId, p.vendorId))) : Promise.resolve([]),
    historyQuery(and(eq(insApprovals.target, "product"), eq(insApprovals.targetId, id))),
    db.select({ n: count() }).from(insProducts).where(and(eq(insProducts.vendorId, p.vendorId), eq(insProducts.status, "published"))),
  ]);
  // Only the vendor's own covers count — anything else is treated as missing.
  const own = covers.filter((c) => c.vendorId === p.vendorId);
  const coverById = new Map(own.map((c) => [c.id, c]));
  const catalog = await getCatalog();
  const plan = catalog.content.insurerPlans.plans.find((x) => x.id === row.vendorPlan) ?? null;
  const missing = coverIds.filter((cid) => !coverById.has(cid));
  return {
    product: p,
    vendor: { id: p.vendorId, name: row.vendorName, reference: row.vendorRef, status: row.vendorStatus, category: row.vendorCategory, plan: row.vendorPlan },
    company: row.company,
    createdByName: row.createdByName,
    coverage: (p.coverage?.coverIds ?? []).map((cid) => coverById.get(cid)).filter((c): c is NonNullable<typeof c> => Boolean(c)),
    addOns: (p.addOns ?? []).map((a) => ({ ...a, cover: coverById.get(a.coverId) ?? null })).filter((a) => a.cover),
    missingCovers: missing,
    docs: docs as InsFileRow[],
    history: await withInsTargetLabels(history as HistoryRow[]),
    publishedCount: published.n,
    plan,
    pricingConfig: { ...pricingConfigFrom(catalog.content.insurancePricing), disclaimer: catalog.content.insurancePricing.disclaimer },
    brandNames: Object.fromEntries((p.eligibility?.brands ?? []).map((b) => [b, catalog.brandName(b)])),
    modelNames: Object.fromEntries((p.eligibility?.models ?? []).map((m) => [m, catalog.getCar(m)?.name ?? m])),
  };
}
export type InsProductReview = NonNullable<Awaited<ReturnType<typeof getInsProductReview>>>;

/* ── Coverage items and add-ons ─────────────────────────────── */

export interface InsCoverFilters {
  status?: string;
  vendor?: number;
  key?: string;
  q?: string;
  page?: number;
}

export async function listInsCovers(type: InsCoverType, f: InsCoverFilters) {
  await requireStaff();
  const db = getDb();
  const conds: SQL[] = [eq(insCovers.type, type)];
  const base = [...conds];
  if (f.status === "all") {
    // every status
  } else if (isOneOf(INS_COVER_STATUS, f.status)) conds.push(eq(insCovers.status, f.status));
  else conds.push(eq(insCovers.status, "pending_approval"));
  const facet: SQL[] = [];
  if (f.vendor) facet.push(eq(insCovers.vendorId, f.vendor));
  if (f.key && /^[a-z0-9_]{1,40}$/.test(f.key)) facet.push(eq(insCovers.key, f.key));
  if (f.q) {
    const t = term(f.q);
    facet.push(or(like(insCovers.name, t), like(insCovers.description, t), like(insVendors.brandName, t), like(insVendors.legalName, t))!);
  }
  const w = and(...conds, ...facet);
  const [[{ total }], counts, keys, vendors] = await Promise.all([
    db.select({ total: count() }).from(insCovers).innerJoin(insVendors, eq(insVendors.id, insCovers.vendorId)).where(w),
    db.select({ status: insCovers.status, n: count() }).from(insCovers).innerJoin(insVendors, eq(insVendors.id, insCovers.vendorId)).where(and(...base, ...facet)).groupBy(insCovers.status),
    db.selectDistinct({ key: insCovers.key }).from(insCovers).where(eq(insCovers.type, type)).orderBy(asc(insCovers.key)),
    db.selectDistinct({ id: insVendors.id, name: vendorNameSql }).from(insCovers).innerJoin(insVendors, eq(insVendors.id, insCovers.vendorId)).where(eq(insCovers.type, type)).orderBy(asc(vendorNameSql)),
  ]);
  const page = pageOf(f.page, total, INS_COVERS_PAGE_SIZE);
  const rows = await db
    .select({ cover: insCovers, vendorName: vendorNameSql, vendorRef: insVendors.reference, vendorStatus: insVendors.status })
    .from(insCovers)
    .innerJoin(insVendors, eq(insVendors.id, insCovers.vendorId))
    .where(w)
    .orderBy(sql`${insCovers.status} = 'pending_approval' desc`, sql`${insCovers.submittedAt} is null`, asc(insCovers.submittedAt), desc(insCovers.updatedAt), asc(insCovers.id))
    .limit(INS_COVERS_PAGE_SIZE)
    .offset((page - 1) * INS_COVERS_PAGE_SIZE);
  const byStatus = Object.fromEntries(INS_COVER_STATUS.map((s) => [s, 0])) as Record<InsCoverStatus, number>;
  for (const c of counts) byStatus[c.status] = c.n;
  return {
    rows: await withCoverProducts(rows),
    total,
    page,
    byStatus,
    keys: keys.map((k) => k.key),
    vendors: vendors.map((v) => ({ value: String(v.id), label: v.name })),
    now: Date.now(),
  };
}

type CoverJoin = { cover: typeof insCovers.$inferSelect; vendorName: string; vendorRef: string; vendorStatus: InsVendorStatus };

/** Adds the products (of the same vendor) that use each cover. */
async function withCoverProducts(rows: CoverJoin[]) {
  const vendorIds = [...new Set(rows.map((r) => r.cover.vendorId))];
  const products = vendorIds.length
    ? await getDb().select({ id: insProducts.id, reference: insProducts.reference, name: insProducts.name, status: insProducts.status, vendorId: insProducts.vendorId, coverage: insProducts.coverage, addOns: insProducts.addOns }).from(insProducts).where(inArray(insProducts.vendorId, vendorIds))
    : [];
  return rows.map((r) => ({
    ...r.cover,
    vendorName: r.vendorName,
    vendorRef: r.vendorRef,
    vendorStatus: r.vendorStatus,
    products: products
      .filter((p) => p.vendorId === r.cover.vendorId && ((p.coverage?.coverIds ?? []).includes(r.cover.id) || (p.addOns ?? []).some((a) => a.coverId === r.cover.id)))
      .map((p) => ({ id: p.id, reference: p.reference, name: p.name, status: p.status, included: (p.coverage?.coverIds ?? []).includes(r.cover.id) || (p.addOns ?? []).some((a) => a.coverId === r.cover.id && a.included) })),
  }));
}

/** One cover in the same shape as the list rows (for a review link to a cover on another page of the list). */
export async function getInsCoverRow(id: number) {
  await requireStaff();
  const rows = await getDb()
    .select({ cover: insCovers, vendorName: vendorNameSql, vendorRef: insVendors.reference, vendorStatus: insVendors.status })
    .from(insCovers)
    .innerJoin(insVendors, eq(insVendors.id, insCovers.vendorId))
    .where(eq(insCovers.id, id));
  return (await withCoverProducts(rows))[0] ?? null;
}
export type InsCoverRow = Awaited<ReturnType<typeof listInsCovers>>["rows"][number];
