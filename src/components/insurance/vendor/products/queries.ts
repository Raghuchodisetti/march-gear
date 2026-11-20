import "server-only";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, like, ne, or, sql, type SQL } from "drizzle-orm";
import type { AnyMySqlColumn } from "drizzle-orm/mysql-core";
import { getDb } from "@/db";
import { insApprovals, insCompanies, insCovers, insEnquiries, insEvents, insProducts, insQuotes, users } from "@/db/schema";
import type { InsProductCategory, InsProductStatus } from "@/db/enums";
import type { VendorRow } from "@/server/insurance/context";
import type { HistoryEntry } from "@/components/insurance/vendor/approvals/shared";
import { PRODUCT_TABS, publicProductHref, type CompanyOption, type CoverOption, type ProductListRow, type ProductSort, type ProductTab } from "./shared";

/* Read models for /insurance-vendor/products. Every query is scoped by the vendor. */

export type ProductRow = typeof insProducts.$inferSelect;
export const PRODUCT_PAGE_SIZE = 20;

/*
 * Correlated counts per product. Written with explicit table aliases: Drizzle leaves column names
 * unqualified in the select list of single-table queries, which would bind them to the subquery's table.
 */
const PRODUCT_ID = sql.raw("`ins_products`.`id`");
export const productViewsSql = (vendorId: number) =>
  sql<number>`(select count(*) from \`ins_events\` ev where ev.\`vendor_id\` = ${vendorId} and ev.\`kind\` = 'product_view' and ev.\`ref_id\` = ${PRODUCT_ID})`;
export const productEnquiriesSql = (vendorId: number, memberId?: number | null) =>
  memberId
    ? sql<number>`(select count(*) from \`ins_enquiries\` en where en.\`vendor_id\` = ${vendorId} and en.\`product_id\` = ${PRODUCT_ID} and en.\`assigned_member_id\` = ${memberId})`
    : sql<number>`(select count(*) from \`ins_enquiries\` en where en.\`vendor_id\` = ${vendorId} and en.\`product_id\` = ${PRODUCT_ID})`;
const viewsOf = (vendorId: number) => productViewsSql(vendorId);
const enquiriesOf = (vendorId: number) => productEnquiriesSql(vendorId);

export async function listProducts(
  vendor: Pick<VendorRow, "id" | "status">,
  f: { tab: ProductTab; category?: InsProductCategory; q?: string; sort: ProductSort; dir: "asc" | "desc"; page: number },
) {
  const db = getDb();
  const vid = vendor.id;
  const statuses = PRODUCT_TABS.find((t) => t.value === f.tab)?.statuses ?? [];
  const search = f.q
    ? or(like(insProducts.name, `%${f.q}%`), like(insProducts.code, `%${f.q}%`), like(insProducts.reference, `%${f.q}%`), like(insProducts.uin, `%${f.q}%`), like(insProducts.tagline, `%${f.q}%`))
    : undefined;
  const base = and(eq(insProducts.vendorId, vid), f.category ? eq(insProducts.category, f.category) : undefined, search);
  const where = and(base, statuses.length ? inArray(insProducts.status, [...statuses]) : undefined);
  const views = viewsOf(vid);
  const enquiries = enquiriesOf(vid);
  const order: SQL[] = (() => {
    const d = (x: SQL | AnyMySqlColumn) => (f.dir === "asc" ? asc(x) : desc(x));
    if (f.sort === "name") return [d(insProducts.name)];
    if (f.sort === "created") return [d(insProducts.createdAt)];
    if (f.sort === "views") return [d(views), desc(insProducts.updatedAt)];
    if (f.sort === "enquiries") return [d(enquiries), desc(insProducts.updatedAt)];
    return [d(insProducts.updatedAt)];
  })();

  const [rows, [{ total }], byStatus] = await Promise.all([
    db
      .select({
        p: {
          id: insProducts.id,
          reference: insProducts.reference,
          code: insProducts.code,
          name: insProducts.name,
          category: insProducts.category,
          status: insProducts.status,
          adminRemarks: insProducts.adminRemarks,
          submittedAt: insProducts.submittedAt,
          updatedAt: insProducts.updatedAt,
        },
        companyName: insCompanies.name,
        views,
        enquiries,
      })
      .from(insProducts)
      .leftJoin(insCompanies, eq(insCompanies.id, insProducts.companyId))
      .where(where)
      .orderBy(...order, desc(insProducts.id))
      .limit(PRODUCT_PAGE_SIZE)
      .offset((f.page - 1) * PRODUCT_PAGE_SIZE),
    db.select({ total: count() }).from(insProducts).where(where),
    db.select({ status: insProducts.status, n: count() }).from(insProducts).where(base).groupBy(insProducts.status),
  ]);

  const statusCounts = new Map(byStatus.map((r) => [r.status, Number(r.n)]));
  const tabCounts = Object.fromEntries(
    PRODUCT_TABS.map((t) => [t.value, t.statuses.length ? t.statuses.reduce((s, st) => s + (statusCounts.get(st) ?? 0), 0) : [...statusCounts.values()].reduce((a, b) => a + b, 0)]),
  ) as Record<ProductTab, number>;

  const list: ProductListRow[] = rows.map(({ p, companyName, views: v, enquiries: e }) => ({
    id: p.id,
    reference: p.reference,
    code: p.code,
    name: p.name,
    category: p.category,
    status: p.status,
    companyName: companyName ?? "—",
    adminRemarks: p.adminRemarks,
    views: Number(v) || 0,
    enquiries: Number(e) || 0,
    everSubmitted: Boolean(p.submittedAt),
    updatedAt: p.updatedAt.toISOString(),
    publicHref: p.status === "published" && vendor.status === "approved" ? publicProductHref(p.reference) : null,
  }));
  return { rows: list, total: Number(total), tabCounts };
}

export async function getProductRow(vendorId: number, id: number) {
  const [row] = await getDb()
    .select()
    .from(insProducts)
    .where(and(eq(insProducts.id, id), eq(insProducts.vendorId, vendorId)))
    .limit(1);
  return row ?? null;
}

/** Views, enquiries, quotes and reported policies for one product. */
export async function productStats(vendorId: number, productId: number) {
  const db = getDb();
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [[views], [views30], [enq], [enq30], [quotes], [issued]] = await Promise.all([
    db.select({ n: count() }).from(insEvents).where(and(eq(insEvents.vendorId, vendorId), eq(insEvents.kind, "product_view"), eq(insEvents.refId, productId))),
    db.select({ n: count() }).from(insEvents).where(and(eq(insEvents.vendorId, vendorId), eq(insEvents.kind, "product_view"), eq(insEvents.refId, productId), gte(insEvents.createdAt, since))),
    db.select({ n: count() }).from(insEnquiries).where(and(eq(insEnquiries.vendorId, vendorId), eq(insEnquiries.productId, productId))),
    db.select({ n: count() }).from(insEnquiries).where(and(eq(insEnquiries.vendorId, vendorId), eq(insEnquiries.productId, productId), gte(insEnquiries.createdAt, since))),
    db.select({ n: count() }).from(insQuotes).where(and(eq(insQuotes.vendorId, vendorId), eq(insQuotes.productId, productId), isNotNull(insQuotes.submittedAt))),
    db.select({ n: count() }).from(insEnquiries).where(and(eq(insEnquiries.vendorId, vendorId), eq(insEnquiries.productId, productId), isNotNull(insEnquiries.policyIssuedAt))),
  ]);
  return { views: views.n, views30: views30.n, enquiries: enq.n, enquiries30: enq30.n, quotes: quotes.n, policies: issued.n };
}

/** The vendor-visible approval history of one product (staff internal notes excluded). */
export async function productHistory(vendorId: number, id: number): Promise<HistoryEntry[]> {
  const rows = await getDb()
    .select({ a: insApprovals, actorName: users.name })
    .from(insApprovals)
    .leftJoin(users, eq(users.id, insApprovals.actorUserId))
    .where(and(eq(insApprovals.vendorId, vendorId), eq(insApprovals.target, "product"), eq(insApprovals.targetId, id), ne(insApprovals.action, "internal_note")))
    .orderBy(desc(insApprovals.createdAt), desc(insApprovals.id))
    .limit(100);
  return rows.map(({ a, actorName }) => ({
    id: a.id,
    target: "product",
    targetId: a.targetId,
    action: a.action,
    fromStatus: a.fromStatus,
    toStatus: a.toStatus,
    remarks: a.remarks,
    actorSide: a.actorSide,
    actorName: a.actorSide === "vendor" ? actorName : null,
    createdAt: a.createdAt.toISOString(),
  }));
}

/** The vendor's coverage items and add-on covers, for the product form. */
export async function coverOptions(vendorId: number): Promise<CoverOption[]> {
  const rows = await getDb()
    .select({
      id: insCovers.id,
      type: insCovers.type,
      key: insCovers.key,
      name: insCovers.name,
      description: insCovers.description,
      status: insCovers.status,
      pricing: insCovers.pricing,
      maxVehicleAgeYears: insCovers.maxVehicleAgeYears,
      fuels: insCovers.fuels,
    })
    .from(insCovers)
    .where(eq(insCovers.vendorId, vendorId))
    .orderBy(asc(insCovers.type), asc(insCovers.name))
    .limit(500);
  return rows.map((r) => ({ ...r, fuels: r.fuels ?? [] }));
}

/**
 * Who can underwrite this vendor's products: an insurer is locked to its own company (linked by
 * MarchGear staff); intermediaries choose from the active companies staff have added.
 */
export async function companyOptions(vendor: Pick<VendorRow, "id" | "category">, includeId?: number): Promise<CompanyOption[]> {
  const db = getDb();
  const cols = { id: insCompanies.id, name: insCompanies.name, shortName: insCompanies.shortName, isActive: insCompanies.isActive, garageCount: insCompanies.garageCount, garageNote: insCompanies.garageNote };
  const rows =
    vendor.category === "insurer"
      ? await db
          .select(cols)
          .from(insCompanies)
          .where(or(eq(insCompanies.vendorId, vendor.id), includeId ? eq(insCompanies.id, includeId) : undefined))
          .orderBy(desc(insCompanies.isActive), asc(insCompanies.name))
          .limit(5)
      : await db
          .select(cols)
          .from(insCompanies)
          .where(or(eq(insCompanies.isActive, true), includeId ? eq(insCompanies.id, includeId) : undefined))
          .orderBy(asc(insCompanies.name))
          .limit(300);
  return rows.map(({ garageCount, garageNote, ...c }) => ({
    ...c,
    garages: garageCount ? [`${garageCount.toLocaleString("en-IN")} garages`, garageNote].filter(Boolean).join(" · ") : garageNote || null,
  }));
}

/** Quick counts by status (dashboard, approvals). */
export async function productStatusCounts(vendorId: number) {
  const rows = await getDb().select({ status: insProducts.status, n: count() }).from(insProducts).where(eq(insProducts.vendorId, vendorId)).groupBy(insProducts.status);
  const out: Partial<Record<InsProductStatus, number>> = {};
  for (const r of rows) out[r.status] = Number(r.n);
  return out;
}
