import "server-only";
import { and, count, desc, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { insCompanies, insEnquiries, insProducts, insQuotes, insVendors } from "@/db/schema";
import type { InsIntent, InsLeadStatus, InsQuoteAuthorization, InsVendorCategory } from "@/db/enums";
import { quoteDisplayStatus } from "@/insurance/labels";
import { todayISO } from "@/server/validation";
import { istDate } from "@/components/portal/billing/shared";
import { policyExpiryFromIssue } from "@/components/customer/garage/shared";
import { CUSTOMER_QUOTE_STATUS, customerEnquiryStatus, type CustomerQuoteState, type CustomerStatus } from "@/components/customer/insurance/status";

/* ──────────────────────────────────────────────────────────────
   The customer's insurance (/account/insurance): their quote
   requests (ins_enquiries.user_id — never matched by mobile or
   email), the quotes vendors sent them and the policies vendors
   reported. Customer-safe fields only: no vendor timeline
   (ins_enquiry_events), assignees, follow-ups or internal notes.
   ────────────────────────────────────────────────────────────── */

export type { CustomerQuoteState, CustomerStatus };
export { CUSTOMER_QUOTE_STATUS, customerEnquiryStatus };

export interface CustomerInsuranceRequest {
  id: number;
  reference: string;
  intent: InsIntent;
  status: CustomerStatus;
  rawStatus: InsLeadStatus;
  createdAt: string;
  productName: string | null;
  /** Set when the product is still public (/insurance/products/<ref>). */
  productRef: string | null;
  insurer: string | null;
  insurerShort: string | null;
  insurerLogo: string | null;
  /** The intermediary that sold it, when it isn't the insurer itself. */
  soldBy: string | null;
  vehicle: string;
  regNumber: string | null;
  /** What the customer was shown when asking (always indicative). */
  indicativePremium: number | null;
  quoteCount: number;
}

export interface CustomerInsuranceQuote {
  reference: string;
  token: string;
  enquiryReference: string;
  status: CustomerQuoteState;
  authorization: InsQuoteAuthorization;
  insurerQuoteRef: string | null;
  total: number;
  idv: number;
  validUntil: string;
  submittedAt: string | null;
  productName: string | null;
  insurer: string | null;
  soldBy: string | null;
  vehicle: string;
}

export interface CustomerPolicy {
  enquiryReference: string;
  productName: string | null;
  insurer: string | null;
  soldBy: string | null;
  vehicle: string;
  regNumber: string | null;
  policyNumber: string | null;
  /** As reported by the vendor. */
  premium: number | null;
  issuedOn: string;
  /** Estimated: issue date + 1 year − 1 day. */
  endsOn: string;
  verified: boolean;
}

export interface CustomerInsurance {
  requests: CustomerInsuranceRequest[];
  quotes: CustomerInsuranceQuote[];
  policies: CustomerPolicy[];
  /** True when there are more requests than shown. */
  truncated: boolean;
}

const REQUEST_LIMIT = 50;

const seller = (v: { category: InsVendorCategory | null; brandName: string | null; legalName: string | null }) =>
  v.category && v.category !== "insurer" ? v.brandName || v.legalName || "A registered intermediary" : null;

const vehicleOf = (e: { brandName: string | null; modelName: string | null; variantName: string | null; year: number | null }) =>
  [e.brandName, e.modelName, e.variantName].filter(Boolean).join(" ") + (e.year ? ` · ${e.year}` : "");

/** Everything on /account/insurance for one customer. */
export async function getCustomerInsurance(userId: number, today: string = todayISO()): Promise<CustomerInsurance> {
  const db = getDb();
  const rows = await db
    .select({
      e: {
        id: insEnquiries.id,
        reference: insEnquiries.reference,
        intent: insEnquiries.intent,
        status: insEnquiries.status,
        createdAt: insEnquiries.createdAt,
        brandName: insEnquiries.brandName,
        modelName: insEnquiries.modelName,
        variantName: insEnquiries.variantName,
        year: insEnquiries.year,
        regNumber: insEnquiries.regNumber,
        indicativePremium: insEnquiries.indicativePremium,
        policyIssuedAt: insEnquiries.policyIssuedAt,
        policyNumber: insEnquiries.policyNumber,
        policyPremium: insEnquiries.policyPremium,
        conversionVerifiedAt: insEnquiries.conversionVerifiedAt,
      },
      product: { name: insProducts.name, reference: insProducts.reference, status: insProducts.status },
      company: { name: insCompanies.name, shortName: insCompanies.shortName, logo: insCompanies.logo, isActive: insCompanies.isActive },
      vendor: { category: insVendors.category, brandName: insVendors.brandName, legalName: insVendors.legalName, status: insVendors.status },
    })
    .from(insEnquiries)
    .innerJoin(insVendors, eq(insVendors.id, insEnquiries.vendorId))
    .leftJoin(insProducts, eq(insProducts.id, insEnquiries.productId))
    .leftJoin(insCompanies, eq(insCompanies.id, insEnquiries.companyId))
    .where(eq(insEnquiries.userId, userId))
    .orderBy(desc(insEnquiries.createdAt), desc(insEnquiries.id))
    .limit(REQUEST_LIMIT + 1);

  const truncated = rows.length > REQUEST_LIMIT;
  const list = rows.slice(0, REQUEST_LIMIT);
  const quoteRows = list.length
    ? await db
        .select({
          enquiryId: insQuotes.enquiryId,
          reference: insQuotes.reference,
          token: insQuotes.shareToken,
          status: insQuotes.status,
          authorization: insQuotes.authorization,
          insurerQuoteRef: insQuotes.insurerQuoteRef,
          total: insQuotes.total,
          idv: insQuotes.idv,
          validUntil: insQuotes.validUntil,
          viewedAt: insQuotes.viewedAt,
          submittedAt: insQuotes.submittedAt,
        })
        .from(insQuotes)
        .where(and(inArray(insQuotes.enquiryId, list.map((r) => r.e.id)), ne(insQuotes.status, "draft")))
        .orderBy(desc(insQuotes.submittedAt), desc(insQuotes.id))
    : [];

  const byId = new Map(list.map((r) => [r.e.id, r]));
  const requests: CustomerInsuranceRequest[] = list.map(({ e, product, company, vendor }) => ({
    id: e.id,
    reference: e.reference,
    intent: e.intent,
    status: customerEnquiryStatus(e.status, Boolean(e.conversionVerifiedAt)),
    rawStatus: e.status,
    createdAt: e.createdAt.toISOString(),
    productName: product?.name ?? null,
    productRef: product && product.status === "published" && vendor.status === "approved" && company?.isActive ? product.reference : null,
    insurer: company?.name ?? null,
    insurerShort: company?.shortName ?? null,
    insurerLogo: company?.logo ?? null,
    soldBy: seller(vendor),
    vehicle: vehicleOf(e),
    regNumber: e.regNumber,
    indicativePremium: e.indicativePremium,
    quoteCount: quoteRows.filter((q) => q.enquiryId === e.id).length,
  }));

  const quotes: CustomerInsuranceQuote[] = quoteRows.map((q) => {
    const r = byId.get(q.enquiryId)!;
    return {
      reference: q.reference,
      token: q.token,
      enquiryReference: r.e.reference,
      status: quoteDisplayStatus({ status: q.status, validUntil: q.validUntil, viewedAt: q.viewedAt }, today),
      authorization: q.authorization,
      insurerQuoteRef: q.authorization === "insurer_authorised" ? q.insurerQuoteRef : null,
      total: q.total,
      idv: q.idv,
      validUntil: q.validUntil,
      submittedAt: q.submittedAt?.toISOString() ?? null,
      productName: r.product?.name ?? null,
      insurer: r.company?.name ?? null,
      soldBy: seller(r.vendor),
      vehicle: vehicleOf(r.e),
    };
  });

  const policies: CustomerPolicy[] = list
    .filter((r) => r.e.status === "policy_issued")
    .map(({ e, product, company, vendor }) => {
      const issuedOn = istDate(e.policyIssuedAt ?? e.createdAt);
      return {
        enquiryReference: e.reference,
        productName: product?.name ?? null,
        insurer: company?.name ?? null,
        soldBy: seller(vendor),
        vehicle: vehicleOf(e),
        regNumber: e.regNumber,
        policyNumber: e.policyNumber,
        premium: e.policyPremium,
        issuedOn,
        endsOn: policyExpiryFromIssue(issuedOn),
        verified: Boolean(e.conversionVerifiedAt),
      };
    });

  return { requests, quotes, policies, truncated };
}

export interface CustomerInsuranceSummary {
  /** Quote requests sent, all time. */
  requests: number;
  /** Quotes sent to the customer that are still valid and waiting for their answer. */
  quotesReady: number;
  /** Policies issued (reported by the vendor or verified by staff). */
  policies: number;
  /** The latest three requests. */
  latest: { reference: string; title: string; status: CustomerStatus; href: string }[];
}

/** Counts and the latest requests, for the account overview. */
export async function getCustomerInsuranceSummary(userId: number): Promise<CustomerInsuranceSummary> {
  const db = getDb();
  const today = todayISO();
  const [[totals], [policies], ready, latest] = await Promise.all([
    db.select({ n: count() }).from(insEnquiries).where(eq(insEnquiries.userId, userId)),
    db
      .select({ n: count() })
      .from(insEnquiries)
      .where(and(eq(insEnquiries.userId, userId), eq(insEnquiries.status, "policy_issued"))),
    db
      .select({ token: insQuotes.shareToken, enquiryId: insQuotes.enquiryId, validUntil: insQuotes.validUntil })
      .from(insQuotes)
      .innerJoin(insEnquiries, eq(insEnquiries.id, insQuotes.enquiryId))
      .where(and(eq(insEnquiries.userId, userId), eq(insQuotes.status, "submitted")))
      .orderBy(desc(insQuotes.submittedAt), desc(insQuotes.id)),
    db
      .select({
        id: insEnquiries.id,
        reference: insEnquiries.reference,
        status: insEnquiries.status,
        verifiedAt: insEnquiries.conversionVerifiedAt,
        brandName: insEnquiries.brandName,
        modelName: insEnquiries.modelName,
        productName: insProducts.name,
        companyName: insCompanies.name,
      })
      .from(insEnquiries)
      .leftJoin(insProducts, eq(insProducts.id, insEnquiries.productId))
      .leftJoin(insCompanies, eq(insCompanies.id, insEnquiries.companyId))
      .where(eq(insEnquiries.userId, userId))
      .orderBy(desc(insEnquiries.createdAt), desc(insEnquiries.id))
      .limit(3),
  ]);
  const valid = ready.filter((q) => q.validUntil >= today);
  return {
    requests: totals.n,
    quotesReady: valid.length,
    policies: policies.n,
    latest: latest.map((r) => {
      const quote = valid.find((q) => q.enquiryId === r.id);
      const car = [r.brandName, r.modelName].filter(Boolean).join(" ");
      return {
        reference: r.reference,
        title: [r.productName ?? "Insurance quote request", r.companyName].filter(Boolean).join(" · ") + (car ? ` — ${car}` : ""),
        status: customerEnquiryStatus(r.status, Boolean(r.verifiedAt)),
        href: quote ? `/insurance/quote/${quote.token}` : `/account/insurance#${r.reference}`,
      };
    }),
  };
}

/** Garage prefill from one of the customer's issued policies (by enquiry reference), or null. */
export async function getPolicyForGarage(userId: number, reference: string) {
  if (!/^[A-Z0-9-]{4,16}$/.test(reference)) return null;
  const [row] = await getDb()
    .select({
      reference: insEnquiries.reference,
      brand: insEnquiries.brand,
      brandName: insEnquiries.brandName,
      model: insEnquiries.model,
      modelName: insEnquiries.modelName,
      variant: insEnquiries.variant,
      variantName: insEnquiries.variantName,
      year: insEnquiries.year,
      fuel: insEnquiries.fuel,
      regNumber: insEnquiries.regNumber,
      city: insEnquiries.city,
      state: insEnquiries.state,
      policyNumber: insEnquiries.policyNumber,
      policyIssuedAt: insEnquiries.policyIssuedAt,
      createdAt: insEnquiries.createdAt,
      insurer: insCompanies.name,
    })
    .from(insEnquiries)
    .leftJoin(insCompanies, eq(insCompanies.id, insEnquiries.companyId))
    .where(and(eq(insEnquiries.userId, userId), eq(insEnquiries.reference, reference), eq(insEnquiries.status, "policy_issued")));
  if (!row) return null;
  const issuedOn = istDate(row.policyIssuedAt ?? row.createdAt);
  return { ...row, issuedOn, insuranceExpiry: policyExpiryFromIssue(issuedOn) };
}
