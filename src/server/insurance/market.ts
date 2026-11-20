import "server-only";
import { and, desc, eq, gte, inArray, lte, notInArray } from "drizzle-orm";
import { getDb } from "@/db";
import { insCampaigns, insCompanies, insEnquiries, insEvents, insMembers, insProducts, insQuotes, insVendors } from "@/db/schema";
import type { InsLeadStatus, InsQuoteAuthorization, InsQuoteStatus, InsTrackKind, InsVendorCategory } from "@/db/enums";
import type { InsurerProfile, QuoteBreakdown, QuoteCoverLine } from "@/insurance/types";
import { publicProductWhere } from "@/server/insurance/public";

/* ──────────────────────────────────────────────────────────────
   Server helpers for the public marketplace: analytics events,
   the signed-in customer's quote requests and the customer's
   quote page (/insurance/quote/<token>).
   ────────────────────────────────────────────────────────────── */

/** Writes one analytics event. Callers have already checked the target. Never throws. */
export async function recordInsEvent(kind: InsTrackKind, vendorId: number, refId: number | null) {
  try {
    await getDb().insert(insEvents).values({ vendorId, kind, refId });
  } catch (err) {
    console.error("[insurance] event failed", err);
  }
}

const PRODUCT_KINDS: InsTrackKind[] = ["product_view", "quote_listing", "compare_add", "enquiry_cta", "document_download"];

/** Whether `refId` is a public thing that belongs to `vendorId` for this kind of event. */
export async function isTrackable(kind: InsTrackKind, vendorId: number, refId: number): Promise<boolean> {
  const db = getDb();
  if (PRODUCT_KINDS.includes(kind)) {
    const [row] = await db
      .select({ id: insProducts.id })
      .from(insProducts)
      .innerJoin(insVendors, eq(insVendors.id, insProducts.vendorId))
      .innerJoin(insCompanies, eq(insCompanies.id, insProducts.companyId))
      .where(and(publicProductWhere, eq(insProducts.id, refId), eq(insProducts.vendorId, vendorId)))
      .limit(1);
    return Boolean(row);
  }
  if (kind === "provider_view") {
    // The vendor sells at least one public product underwritten by this company.
    const [row] = await db
      .select({ id: insProducts.id })
      .from(insProducts)
      .innerJoin(insVendors, eq(insVendors.id, insProducts.vendorId))
      .innerJoin(insCompanies, eq(insCompanies.id, insProducts.companyId))
      .where(and(publicProductWhere, eq(insProducts.companyId, refId), eq(insProducts.vendorId, vendorId)))
      .limit(1);
    return Boolean(row);
  }
  if (kind === "campaign_view" || kind === "campaign_click") {
    const now = new Date();
    const [row] = await db
      .select({ id: insCampaigns.id })
      .from(insCampaigns)
      .innerJoin(insVendors, eq(insVendors.id, insCampaigns.vendorId))
      .where(
        and(
          eq(insCampaigns.id, refId),
          eq(insCampaigns.vendorId, vendorId),
          eq(insCampaigns.status, "approved"),
          lte(insCampaigns.startsAt, now),
          gte(insCampaigns.endsAt, now),
          eq(insVendors.status, "approved"),
        ),
      )
      .limit(1);
    return Boolean(row);
  }
  // quote_view is recorded by the quote page itself (only someone holding the share token sees it). Quote ids are
  // sequential, so a beacon for one would let anyone inflate another vendor's "quote links opened".
  return false;
}

/* ── The signed-in customer's requests ─────────────────────── */

export interface CustomerQuoteLink {
  reference: string;
  token: string;
  status: InsQuoteStatus;
  authorization: InsQuoteAuthorization;
  total: number;
  validUntil: string;
  viewedAt: string | null;
}

export interface CustomerRequest {
  id: number;
  reference: string;
  status: InsLeadStatus;
  createdAt: string;
  productName: string | null;
  productRef: string | null;
  companyName: string | null;
  companyLogo: string | null;
  vehicle: string;
  indicativePremium: number | null;
  quotes: CustomerQuoteLink[];
}

/** The customer's latest enquiries (by user id), each with its quotes the vendor has sent (never drafts or withdrawn ones). */
export async function getCustomerRequests(userId: number, limit = 20): Promise<CustomerRequest[]> {
  const db = getDb();
  const rows = await db
    .select({
      e: {
        id: insEnquiries.id,
        reference: insEnquiries.reference,
        status: insEnquiries.status,
        createdAt: insEnquiries.createdAt,
        brandName: insEnquiries.brandName,
        modelName: insEnquiries.modelName,
        variantName: insEnquiries.variantName,
        regNumber: insEnquiries.regNumber,
        indicativePremium: insEnquiries.indicativePremium,
      },
      productName: insProducts.name,
      productRef: insProducts.reference,
      companyName: insCompanies.name,
      companyLogo: insCompanies.logo,
    })
    .from(insEnquiries)
    .leftJoin(insProducts, eq(insProducts.id, insEnquiries.productId))
    .leftJoin(insCompanies, eq(insCompanies.id, insEnquiries.companyId))
    .where(eq(insEnquiries.userId, userId))
    .orderBy(desc(insEnquiries.createdAt), desc(insEnquiries.id))
    .limit(limit);
  if (!rows.length) return [];
  const quotes = await db
    .select({
      enquiryId: insQuotes.enquiryId,
      reference: insQuotes.reference,
      token: insQuotes.shareToken,
      status: insQuotes.status,
      authorization: insQuotes.authorization,
      total: insQuotes.total,
      validUntil: insQuotes.validUntil,
      viewedAt: insQuotes.viewedAt,
    })
    .from(insQuotes)
    .where(and(inArray(insQuotes.enquiryId, rows.map((r) => r.e.id)), notInArray(insQuotes.status, ["draft", "withdrawn"])))
    .orderBy(desc(insQuotes.submittedAt), desc(insQuotes.id));
  return rows.map(({ e, ...r }) => ({
    id: e.id,
    reference: e.reference,
    status: e.status,
    createdAt: e.createdAt.toISOString(),
    productName: r.productName,
    productRef: r.productRef,
    companyName: r.companyName,
    companyLogo: r.companyLogo,
    vehicle: [e.brandName, e.modelName, e.variantName].filter(Boolean).join(" ") + (e.regNumber ? ` · ${e.regNumber}` : ""),
    indicativePremium: e.indicativePremium,
    quotes: quotes
      .filter((q) => q.enquiryId === e.id)
      .map(({ enquiryId: _e, viewedAt, ...q }) => {
        void _e;
        return { ...q, viewedAt: viewedAt?.toISOString() ?? null };
      }),
  }));
}

/* ── The customer's quote page ──────────────────────────────── */

export interface PublicQuote {
  id: number;
  reference: string;
  token: string;
  vendorId: number;
  enquiryId: number;
  status: InsQuoteStatus;
  authorization: InsQuoteAuthorization;
  insurerQuoteRef: string | null;
  idv: number;
  coverage: QuoteCoverLine[];
  breakdown: QuoteBreakdown;
  total: number;
  validUntil: string;
  notes: string | null;
  terms: string | null;
  viewedAt: Date | null;
  submittedAt: Date | null;
  respondedAt: Date | null;
  enquiry: {
    reference: string;
    name: string;
    vehicle: string;
    regNumber: string | null;
    fuel: string | null;
    year: number | null;
    vehicleIsNew: boolean;
    city: string | null;
    intent: string;
    ncbPct: number;
  };
  product: { name: string; reference: string; category: string; public: boolean } | null;
  company: { name: string; slug: string; logo: string | null; isActive: boolean; supportPhone: string | null; claimsPhone: string | null; claimsEmail: string | null; website: string | null } | null;
  vendor: { name: string; category: InsVendorCategory | null; profile: InsurerProfile | null; isInsurer: boolean };
}

/** A quote by its share token — null for unknown tokens, drafts and withdrawn quotes. */
export async function getQuoteByToken(token: string): Promise<PublicQuote | null> {
  if (!/^[A-Za-z0-9_-]{16,48}$/.test(token)) return null;
  const db = getDb();
  const [row] = await db
    .select({ q: insQuotes, e: insEnquiries, vendor: { brandName: insVendors.brandName, legalName: insVendors.legalName, category: insVendors.category, profile: insVendors.profile } })
    .from(insQuotes)
    .innerJoin(insEnquiries, eq(insEnquiries.id, insQuotes.enquiryId))
    .innerJoin(insVendors, eq(insVendors.id, insQuotes.vendorId))
    .where(eq(insQuotes.shareToken, token))
    .limit(1);
  if (!row || row.q.status === "draft" || row.q.status === "withdrawn") return null;
  const { q, e } = row;

  const productId = q.productId ?? e.productId;
  const [product] = productId
    ? await db
        .select({ p: { name: insProducts.name, reference: insProducts.reference, category: insProducts.category, status: insProducts.status, companyId: insProducts.companyId } })
        .from(insProducts)
        .where(eq(insProducts.id, productId))
        .limit(1)
    : [];
  const companyId = product?.p.companyId ?? e.companyId;
  const [company] = companyId ? await db.select().from(insCompanies).where(eq(insCompanies.id, companyId)).limit(1) : [];
  const [isPublic] = productId
    ? await db
        .select({ id: insProducts.id })
        .from(insProducts)
        .innerJoin(insVendors, eq(insVendors.id, insProducts.vendorId))
        .innerJoin(insCompanies, eq(insCompanies.id, insProducts.companyId))
        .where(and(publicProductWhere, eq(insProducts.id, productId)))
        .limit(1)
    : [];

  return {
    id: q.id,
    reference: q.reference,
    token: q.shareToken,
    vendorId: q.vendorId,
    enquiryId: q.enquiryId,
    status: q.status,
    authorization: q.authorization,
    insurerQuoteRef: q.insurerQuoteRef,
    idv: q.idv,
    coverage: q.coverage ?? [],
    breakdown: q.breakdown,
    total: q.total,
    validUntil: q.validUntil,
    notes: q.notes,
    terms: q.terms,
    viewedAt: q.viewedAt,
    submittedAt: q.submittedAt,
    respondedAt: q.respondedAt,
    enquiry: {
      reference: e.reference,
      name: e.name,
      vehicle: [e.brandName, e.modelName, e.variantName].filter(Boolean).join(" "),
      regNumber: e.regNumber,
      fuel: e.fuel,
      year: e.year,
      vehicleIsNew: e.vehicleIsNew,
      city: e.city,
      intent: e.intent,
      ncbPct: e.ncbPct,
    },
    product: product ? { name: product.p.name, reference: product.p.reference, category: product.p.category, public: Boolean(isPublic) } : null,
    company: company
      ? {
          name: company.name,
          slug: company.slug,
          logo: company.logo,
          isActive: company.isActive,
          supportPhone: company.supportPhone,
          claimsPhone: company.claimsPhone,
          claimsEmail: company.claimsEmail,
          website: company.website,
        }
      : null,
    vendor: {
      name: row.vendor.brandName || row.vendor.legalName || "Insurer",
      category: row.vendor.category,
      profile: row.vendor.profile,
      isInsurer: Boolean(company && company.vendorId === q.vendorId),
    },
  };
}

/** Whether this user works for the vendor (their own views of a customer link aren't the customer's). */
export async function isVendorMember(userId: number, vendorId: number) {
  const [m] = await getDb()
    .select({ id: insMembers.id })
    .from(insMembers)
    .where(and(eq(insMembers.userId, userId), eq(insMembers.vendorId, vendorId), eq(insMembers.isActive, true)))
    .limit(1);
  return Boolean(m);
}
