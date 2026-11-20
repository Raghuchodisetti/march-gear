import "server-only";
import { and, count, desc, eq, gte, inArray, isNotNull, isNull, like, lt, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { insCompanies, insCovers, insEnquiries, insProducts, insQuotes, users } from "@/db/schema";
import { INS_QUOTE_AUTHORIZATION, type InsQuoteAuthorization } from "@/db/enums";
import { pricingConfigFrom, type PricingConfig } from "@/insurance/estimator";
import { quoteDisplayStatus } from "@/insurance/labels";
import { getCatalog } from "@/server/catalog";
import { vendorName, type InsurerContext } from "@/server/insurance/context";
import { enquiryEvents, istStart, quoteScope } from "@/server/insurance/crm";
import { addDays, istDate } from "@/components/portal/billing/shared";
import { vehicleLine } from "@/components/insurance/vendor/crm/shared";
import type { BuilderAddOn, BuilderCover, BuilderProduct } from "@/components/insurance/vendor/quotes/pricing";
import { vehicleFromCatalog, type VehicleResult, type VehicleSpec } from "@/components/insurance/vendor/quotes/vehicle";
import type { QuoteDisplay, QuoteListItem, QuoteView } from "@/components/insurance/vendor/quotes/types";
import type { BuilderEnquiry } from "@/components/insurance/vendor/quotes/quote-builder";

/* ──────────────────────────────────────────────────────────────
   Vendor quote builder: the rates, the customer's car from the
   catalogue, the vendor's quotable products (approved/published,
   approved covers only) and quote lists. Scoped to the vendor.
   ────────────────────────────────────────────────────────────── */

/** The admin's rates (insurancePricing block) over the estimator defaults (e.g. the NCB slabs, which aren't editable). */
export async function pricingConfig(): Promise<PricingConfig> {
  return pricingConfigFrom((await getCatalog()).content.insurancePricing);
}

export async function insuranceSettings() {
  return (await getCatalog()).content.insuranceSettings;
}

/** The car as the estimator needs it, from the catalogue variant — or why it can't be priced. */
export async function resolveVehicle(spec: VehicleSpec): Promise<VehicleResult> {
  return vehicleFromCatalog(await getCatalog(), spec);
}

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Best catalogue match for a car known only by its names (manually added renewals). */
export async function matchCatalogVehicle(names: { brandName: string | null; modelName: string | null; variantName: string | null }) {
  const { brands, cars } = await getCatalog();
  const brand = brands.find((b) => norm(b.name) === norm(names.brandName) || norm(b.slug) === norm(names.brandName));
  const pool = brand ? cars.filter((c) => c.brand === brand.slug) : cars;
  const model = norm(names.modelName);
  const car = pool.find((c) => norm(c.name) === model || norm(`${brand?.name ?? ""}${c.name}`) === model) ?? pool.find((c) => model && (model.endsWith(norm(c.name)) || norm(c.name).endsWith(model)));
  const variant = car?.variants.find((v) => norm(v.name) === norm(names.variantName));
  return { brand: car?.brand ?? brand?.slug ?? "", model: car?.slug ?? "", variant: variant?.slug ?? "" };
}

/** The vendor's approved and published products with their approved covers. */
export async function builderProducts(vendorId: number): Promise<BuilderProduct[]> {
  const db = getDb();
  const rows = await db
    .select({ p: insProducts, companyName: insCompanies.name })
    .from(insProducts)
    .innerJoin(insCompanies, eq(insCompanies.id, insProducts.companyId))
    .where(and(eq(insProducts.vendorId, vendorId), inArray(insProducts.status, ["approved", "published"])))
    .orderBy(sql`${insProducts.status} = 'published' DESC`, insProducts.name);
  const coverIds = [...new Set(rows.flatMap((r) => [...(r.p.coverage.coverIds ?? []), ...(r.p.addOns ?? []).map((a) => a.coverId)]))];
  const covers = coverIds.length
    ? await db
        .select()
        .from(insCovers)
        .where(and(eq(insCovers.vendorId, vendorId), inArray(insCovers.id, coverIds), eq(insCovers.status, "approved")))
    : [];
  const byId = new Map(covers.map((c) => [c.id, c]));
  const toCover = (c: (typeof covers)[number]): BuilderCover => ({
    coverId: c.id,
    key: c.key,
    name: c.name,
    description: c.description,
    pricing: c.pricing,
    maxVehicleAgeYears: c.maxVehicleAgeYears,
    fuels: c.fuels ?? [],
  });
  return rows.map(({ p, companyName }) => {
    const coverageItems = (p.coverage.coverIds ?? []).map((id) => byId.get(id)).filter((c): c is NonNullable<typeof c> => Boolean(c && c.type === "coverage")).map(toCover);
    const addOns: BuilderAddOn[] = (p.addOns ?? []).flatMap((a) => {
      const c = byId.get(a.coverId);
      return c && c.type === "addon" ? [{ ...toCover(c), included: a.included }] : [];
    });
    const listed = (p.coverage.coverIds ?? []).length + (p.addOns ?? []).length;
    return {
      id: p.id,
      reference: p.reference,
      name: p.name,
      code: p.code,
      uin: p.uin,
      category: p.category,
      status: p.status,
      companyName,
      eligibility: p.eligibility,
      coverage: p.coverage,
      pricing: p.pricing,
      deductibles: p.deductibles,
      addOns,
      coverageItems,
      unapprovedCovers: Math.max(0, listed - coverageItems.length - addOns.length),
      exclusions: p.exclusions ?? [],
      terms: p.terms,
    };
  });
}

/* ── Quote lists ───────────────────────────────────────────── */

export const QUOTE_DISPLAY_FILTERS = ["draft", "submitted", "viewed", "accepted", "declined", "expired", "withdrawn"] as const satisfies readonly QuoteDisplay[];

export interface QuoteFilters {
  q?: string;
  status?: QuoteDisplay;
  auth?: InsQuoteAuthorization;
  product?: number;
  from?: string;
  to?: string;
  enquiry?: number;
}

type Params = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const day = (v: string | string[] | undefined) => {
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) ? s : undefined;
};
const posInt = (v: string | string[] | undefined) => {
  const n = Number.parseInt(str(v) ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export function parseQuoteFilters(sp: Params): QuoteFilters {
  const status = str(sp.status);
  const auth = str(sp.auth);
  return {
    q: str(sp.q)?.slice(0, 100),
    status: (QUOTE_DISPLAY_FILTERS as readonly string[]).includes(status ?? "") ? (status as QuoteDisplay) : undefined,
    auth: (INS_QUOTE_AUTHORIZATION as readonly string[]).includes(auth ?? "") ? (auth as InsQuoteAuthorization) : undefined,
    product: posInt(sp.product),
    from: day(sp.from),
    to: day(sp.to),
    enquiry: posInt(sp.enquiry),
  };
}

export const quoteFilterParams = (f: QuoteFilters): Record<string, string | undefined> => ({
  q: f.q,
  status: f.status,
  auth: f.auth,
  product: f.product ? String(f.product) : undefined,
  from: f.from,
  to: f.to,
  enquiry: f.enquiry ? String(f.enquiry) : undefined,
});

/** SQL for a displayed status (sent / viewed / expired are derived from dates). */
function displayWhere(s: QuoteDisplay, today: string): SQL {
  switch (s) {
    case "submitted":
      return and(eq(insQuotes.status, "submitted"), isNull(insQuotes.viewedAt), gte(insQuotes.validUntil, today))!;
    case "viewed":
      return and(eq(insQuotes.status, "submitted"), isNotNull(insQuotes.viewedAt), gte(insQuotes.validUntil, today))!;
    case "expired":
      return and(eq(insQuotes.status, "submitted"), lt(insQuotes.validUntil, today))!;
    default:
      return eq(insQuotes.status, s);
  }
}

function quoteWhere(ctx: InsurerContext, f: QuoteFilters, opts: { ignoreStatus?: boolean } = {}): SQL {
  const parts: (SQL | undefined)[] = [quoteScope(ctx)];
  if (f.q) {
    const q = `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const digits = f.q.replace(/\D/g, "");
    parts.push(or(like(insQuotes.reference, q), like(insEnquiries.reference, q), like(insEnquiries.name, q), like(insQuotes.insurerQuoteRef, q), digits.length >= 3 ? like(insEnquiries.mobile, `%${digits}%`) : undefined));
  }
  if (f.status && !opts.ignoreStatus) parts.push(displayWhere(f.status, istDate()));
  if (f.auth) parts.push(eq(insQuotes.authorization, f.auth));
  if (f.product) parts.push(eq(insQuotes.productId, f.product));
  if (f.enquiry) parts.push(eq(insQuotes.enquiryId, f.enquiry));
  if (f.from) parts.push(gte(insQuotes.createdAt, istStart(f.from)));
  if (f.to) parts.push(lt(insQuotes.createdAt, istStart(addDays(f.to, 1))));
  return and(...parts)!;
}

function quoteSelect() {
  return getDb()
    .select({ q: insQuotes, e: insEnquiries, productName: insProducts.name })
    .from(insQuotes)
    .innerJoin(insEnquiries, eq(insEnquiries.id, insQuotes.enquiryId))
    .leftJoin(insProducts, eq(insProducts.id, insQuotes.productId));
}

type SelectedQuote = Awaited<ReturnType<ReturnType<typeof quoteSelect>["where"]>>[number];

function toQuoteItem({ q, e, productName }: SelectedQuote, today: string): QuoteListItem {
  return {
    id: q.id,
    reference: q.reference,
    status: q.status,
    display: quoteDisplayStatus(q, today),
    authorization: q.authorization,
    insurerQuoteRef: q.insurerQuoteRef,
    total: q.total,
    idv: q.idv,
    validUntil: q.validUntil,
    createdAt: q.createdAt.toISOString(),
    submittedAt: q.submittedAt?.toISOString() ?? null,
    viewedAt: q.viewedAt?.toISOString() ?? null,
    respondedAt: q.respondedAt?.toISOString() ?? null,
    product: q.productId && productName ? { id: q.productId, name: productName } : null,
    enquiry: { id: e.id, reference: e.reference, name: e.name, mobile: e.mobile, regNumber: e.regNumber, vehicle: vehicleLine(e) },
  };
}

export async function queryQuotes(ctx: InsurerContext, f: QuoteFilters, page: { limit: number; offset: number }) {
  const today = istDate();
  const where = quoteWhere(ctx, f);
  const [rows, [{ total }]] = await Promise.all([
    quoteSelect().where(where).orderBy(desc(insQuotes.updatedAt), desc(insQuotes.id)).limit(page.limit).offset(page.offset),
    getDb().select({ total: count() }).from(insQuotes).innerJoin(insEnquiries, eq(insEnquiries.id, insQuotes.enquiryId)).where(where),
  ]);
  return { rows: rows.map((r) => toQuoteItem(r, today)), total };
}

/** Quotes per displayed status for the current filters (ignoring the status filter). */
export async function quoteCounts(ctx: InsurerContext, f: QuoteFilters) {
  const today = istDate();
  const base = quoteWhere(ctx, f, { ignoreStatus: true });
  const entries = await Promise.all(
    QUOTE_DISPLAY_FILTERS.map(async (s) => {
      const [{ n }] = await getDb()
        .select({ n: count() })
        .from(insQuotes)
        .innerJoin(insEnquiries, eq(insEnquiries.id, insQuotes.enquiryId))
        .where(and(base, displayWhere(s, today)));
      return [s, Number(n)] as const;
    }),
  );
  const counts = Object.fromEntries(entries) as Record<QuoteDisplay, number>;
  return { counts, total: Object.values(counts).reduce((a, b) => a + b, 0) };
}

/** One quote with its enquiry, product, vendor and timeline — or null when out of scope. */
export async function getQuoteView(ctx: InsurerContext, id: number): Promise<QuoteView | null> {
  const today = istDate();
  const [row] = await quoteSelect().where(and(quoteScope(ctx), eq(insQuotes.id, id)));
  if (!row) return null;
  const { q, e } = row;
  const db = getDb();
  const [[product], [creator], events] = await Promise.all([
    q.productId
      ? db
          .select({ id: insProducts.id, name: insProducts.name, code: insProducts.code, uin: insProducts.uin, category: insProducts.category, companyName: insCompanies.name, exclusions: insProducts.exclusions })
          .from(insProducts)
          .leftJoin(insCompanies, eq(insCompanies.id, insProducts.companyId))
          .where(and(eq(insProducts.id, q.productId), eq(insProducts.vendorId, ctx.vendor.id)))
      : Promise.resolve([]),
    q.createdBy ? db.select({ name: users.name }).from(users).where(eq(users.id, q.createdBy)) : Promise.resolve([]),
    enquiryEvents(e.id, 500),
  ]);
  const profile = ctx.vendor.profile;
  return {
    ...toQuoteItem(row, today),
    coverage: q.coverage,
    breakdown: q.breakdown,
    notes: q.notes,
    terms: q.terms,
    shareToken: q.shareToken,
    updatedAt: q.updatedAt.toISOString(),
    createdBy: creator?.name ?? null,
    enquiry: {
      ...toQuoteItem(row, today).enquiry,
      email: e.email,
      city: e.city,
      status: e.status,
      year: e.year,
      fuel: e.fuel,
      isNew: e.vehicleIsNew,
    },
    productDetail: product ? { ...product, exclusions: product.exclusions ?? [] } : null,
    vendor: {
      name: vendorName(ctx.vendor),
      reference: ctx.vendor.reference,
      supportPhone: profile?.supportPhone ?? "",
      supportEmail: profile?.supportEmail ?? "",
      website: profile?.website ?? "",
    },
    // The enquiry's timeline rows about this quote (or quote events from the public page that name it).
    events: events.filter((ev) => ev.kind === "quote" && (Number(ev.meta?.quoteId) === q.id || ev.body.includes(q.reference))),
  };
}

/** The enquiry as the builder needs it; a car known only by name is matched to the catalogue. */
export async function builderEnquiry(e: typeof insEnquiries.$inferSelect): Promise<BuilderEnquiry> {
  let spec = { brand: e.brand ?? "", model: e.model ?? "", variant: e.variant ?? "" };
  if (!spec.model || !spec.variant) {
    const m = await matchCatalogVehicle({ brandName: e.brandName, modelName: e.modelName, variantName: e.variantName });
    spec = { brand: spec.brand || m.brand, model: spec.model || m.model, variant: spec.variant || m.variant };
  }
  return {
    id: e.id,
    reference: e.reference,
    name: e.name,
    mobile: e.mobile,
    email: e.email,
    regNumber: e.regNumber,
    city: e.city,
    state: e.state,
    intent: e.intent,
    policyStatus: e.policyStatus,
    policyExpiry: e.policyExpiry,
    previousInsurer: e.previousInsurer,
    claimedLastYear: e.claimedLastYear,
    ncbPct: e.ncbPct,
    addOns: e.addOns ?? [],
    idv: e.estimate?.idv ?? e.idv ?? null,
    productId: e.productId,
    vehicle: { ...spec, year: e.year, isNew: e.vehicleIsNew },
  };
}
