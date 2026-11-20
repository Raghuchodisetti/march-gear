import "server-only";
import { cache } from "react";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { insCampaigns, insCompanies, insCovers, insProducts, insVendors } from "@/db/schema";
import type { InsCampaignType, InsProductCategory } from "@/db/enums";
import type { CompanyClaimInfo, FileRef, InsurerProfile } from "@/insurance/types";
import { INS_VENDOR_CATEGORY_SHORT } from "@/insurance/labels";
import { getSponsoredListings } from "@/server/ads/serve";
import type { MarketCover, MarketDocument, MarketProduct, MarketSponsored } from "@/components/insurance/public/market/engine";

/* ──────────────────────────────────────────────────────────────
   What the public insurance pages may show. Everything here
   applies the approval rules — call these, not raw queries:

   - product  : status "published" AND vendor "approved" AND company active
   - provider : company active (listed when it has ≥1 public product)
   - cover    : status "approved" (and used by a public product)
   - campaign : status "approved", now within startsAt…endsAt, vendor "approved"
   - claim figures: only when claim_info.verified
   ────────────────────────────────────────────────────────────── */

/** Conditions every public product query must include. */
export const publicProductWhere = and(eq(insProducts.status, "published"), eq(insVendors.status, "approved"), eq(insCompanies.isActive, true));

/** Claim info with figures removed unless staff verified them (the process steps are always shown). */
export function publicClaimInfo(c: CompanyClaimInfo | null): CompanyClaimInfo | null {
  if (!c) return null;
  return c.verified ? c : { ...c, settlementRatio: null, year: "", source: "", verifiedAt: null, verifiedBy: null };
}

export interface PublicProvider {
  id: number;
  slug: string;
  name: string;
  shortName: string | null;
  logo: string | null;
  about: string | null;
  garageCount: number | null;
  garageNote: string | null;
  claimInfo: CompanyClaimInfo | null;
  productCount: number;
  categories: InsProductCategory[];
}

/** Active insurance companies with at least one public product, most products first. */
export const getPublicProviders = cache(async (): Promise<PublicProvider[]> => {
  const rows = await getDb()
    .select({ company: insCompanies, category: insProducts.category })
    .from(insProducts)
    .innerJoin(insVendors, eq(insVendors.id, insProducts.vendorId))
    .innerJoin(insCompanies, eq(insCompanies.id, insProducts.companyId))
    .where(publicProductWhere);
  const byId = new Map<number, PublicProvider>();
  for (const { company: c, category } of rows) {
    const p =
      byId.get(c.id) ??
      ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        shortName: c.shortName,
        logo: c.logo,
        about: c.about,
        garageCount: c.garageCount,
        garageNote: c.garageNote,
        claimInfo: publicClaimInfo(c.claimInfo),
        productCount: 0,
        categories: [],
      } satisfies PublicProvider);
    p.productCount += 1;
    if (!p.categories.includes(category)) p.categories.push(category);
    byId.set(c.id, p);
  }
  return [...byId.values()].sort((a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name));
});

export interface PublicCampaign {
  id: number;
  reference: string;
  title: string;
  summary: string;
  type: InsCampaignType;
  banner: string | null;
  ctaLabel: string | null;
  endsAt: string;
  vendorId: number;
  vendorName: string;
  /** Product ids the campaign promotes (public ones only — filter with getPublicProductRefs()). */
  productIds: number[];
}

/** Approved promotional campaigns running now, from approved vendors. Ending soonest first. */
export const getActiveCampaigns = cache(async (limit = 6): Promise<PublicCampaign[]> => {
  const now = new Date();
  const rows = await getDb()
    .select({ c: insCampaigns, brandName: insVendors.brandName, legalName: insVendors.legalName })
    .from(insCampaigns)
    .innerJoin(insVendors, eq(insVendors.id, insCampaigns.vendorId))
    .where(and(eq(insCampaigns.status, "approved"), lte(insCampaigns.startsAt, now), gte(insCampaigns.endsAt, now), eq(insVendors.status, "approved")))
    .orderBy(insCampaigns.endsAt)
    .limit(limit);
  return rows.map(({ c, brandName, legalName }) => ({
    id: c.id,
    reference: c.reference,
    title: c.title,
    summary: c.summary,
    type: c.type,
    banner: c.banner,
    ctaLabel: c.ctaLabel,
    endsAt: c.endsAt.toISOString(),
    vendorId: c.vendorId,
    vendorName: brandName || legalName || "Insurer",
    productIds: c.productIds,
  }));
});

/** Number of public products per category (for the category pages' "N plans listed"). */
export const getPublicCategoryCounts = cache(async (): Promise<Partial<Record<InsProductCategory, number>>> => {
  const rows = await getDb()
    .select({ category: insProducts.category })
    .from(insProducts)
    .innerJoin(insVendors, eq(insVendors.id, insProducts.vendorId))
    .innerJoin(insCompanies, eq(insCompanies.id, insProducts.companyId))
    .where(publicProductWhere);
  const out: Partial<Record<InsProductCategory, number>> = {};
  for (const r of rows) out[r.category] = (out[r.category] ?? 0) + 1;
  return out;
});

/* ──────────────────────────────────────────────────────────────
   Public products, provider profiles and sponsored listings for
   the marketplace pages (/insurance/quotes, /compare, /providers,
   /products). Covers are joined in only when "approved" and owned
   by the product's vendor; documents expose metadata only (the
   files are served by /insurance/products/<ref>/documents/<kind>).
   ────────────────────────────────────────────────────────────── */

const vendorDisplayName = (v: { brandName: string | null; legalName: string | null }) => v.brandName || v.legalName || "Insurer";
const docMeta = (f: FileRef | null): MarketDocument | null => (f ? { filename: f.filename, size: f.size, mime: f.mime } : null);

function toMarketCover(c: typeof insCovers.$inferSelect): MarketCover {
  return {
    id: c.id,
    key: c.key,
    name: c.name,
    description: c.description,
    eligibility: c.eligibility,
    maxVehicleAgeYears: c.maxVehicleAgeYears,
    fuels: c.fuels,
    exclusions: c.exclusions,
    limits: c.limits,
    pricing: c.pricing,
  };
}

/** Every public product with its approved covers, newest first. Deduplicated per request. */
export const getPublicProducts = cache(async (): Promise<MarketProduct[]> => {
  const db = getDb();
  const rows = await db
    .select({
      p: insProducts,
      company: {
        id: insCompanies.id,
        slug: insCompanies.slug,
        name: insCompanies.name,
        shortName: insCompanies.shortName,
        logo: insCompanies.logo,
        garageCount: insCompanies.garageCount,
        garageNote: insCompanies.garageNote,
        vendorId: insCompanies.vendorId,
      },
      vendor: { brandName: insVendors.brandName, legalName: insVendors.legalName, category: insVendors.category },
    })
    .from(insProducts)
    .innerJoin(insVendors, eq(insVendors.id, insProducts.vendorId))
    .innerJoin(insCompanies, eq(insCompanies.id, insProducts.companyId))
    .where(publicProductWhere)
    .orderBy(desc(insProducts.publishedAt), desc(insProducts.id));
  if (!rows.length) return [];

  const coverIds = [...new Set(rows.flatMap(({ p }) => [...(p.coverage.coverIds ?? []), ...(p.addOns ?? []).map((a) => a.coverId)]))].filter(
    (n) => Number.isInteger(n) && n > 0,
  );
  const covers = coverIds.length
    ? await db
        .select()
        .from(insCovers)
        .where(and(inArray(insCovers.id, coverIds), eq(insCovers.status, "approved")))
    : [];
  const coverById = new Map(covers.map((c) => [c.id, c]));
  const own = (id: number, vendorId: number) => {
    const c = coverById.get(id);
    return c && c.vendorId === vendorId ? c : undefined;
  };

  return rows.map(({ p, company, vendor }): MarketProduct => {
    const name = vendorDisplayName(vendor);
    const isInsurer = company.vendorId === p.vendorId;
    return {
      id: p.id,
      reference: p.reference,
      vendorId: p.vendorId,
      vendorName: name,
      vendorCategory: vendor.category,
      soldBy: isInsurer ? null : `${name}${vendor.category ? ` · ${INS_VENDOR_CATEGORY_SHORT[vendor.category]}` : ""}`,
      company: { id: company.id, slug: company.slug, name: company.name, shortName: company.shortName, logo: company.logo },
      name: p.name,
      uin: p.uin,
      category: p.category,
      tagline: p.tagline,
      description: p.description,
      eligibility: p.eligibility,
      coverage: {
        ownDamage: p.coverage.ownDamage,
        thirdParty: p.coverage.thirdParty,
        paOwnerDriver: p.coverage.paOwnerDriver,
        tpPropertyLimit: p.coverage.tpPropertyLimit,
        highlights: p.coverage.highlights ?? [],
      },
      coverageItems: (p.coverage.coverIds ?? [])
        .map((id) => own(id, p.vendorId))
        .filter((c): c is NonNullable<typeof c> => Boolean(c) && c!.type === "coverage")
        .map(toMarketCover),
      addOns: (p.addOns ?? []).flatMap((a) => {
        const c = own(a.coverId, p.vendorId);
        return c && c.type === "addon" ? [{ ...toMarketCover(c), included: a.included }] : [];
      }),
      pricing: p.pricing,
      deductibles: p.deductibles,
      garageCount: p.garageCount ?? company.garageCount,
      garageNote: company.garageNote,
      exclusions: p.exclusions ?? [],
      documents: { brochure: docMeta(p.documents?.brochure ?? null), wording: docMeta(p.documents?.wording ?? null) },
      terms: p.terms,
      publishedAt: p.publishedAt?.toISOString() ?? null,
    };
  });
});

/** One public product by its reference (PRD-XXXXXX), or null. */
export async function getPublicProduct(reference: string): Promise<MarketProduct | null> {
  if (!/^PRD-[A-Z0-9]{6}$/.test(reference)) return null;
  return (await getPublicProducts()).find((p) => p.reference === reference) ?? null;
}

/** Live sponsored listings whose product is public (in the order the ad server returned them). */
export async function getPublicSponsored(limit = 2): Promise<MarketSponsored[]> {
  let listings: { campaignId: number; productId: number }[] = [];
  try {
    listings = await getSponsoredListings("insurance_sponsored_listing", limit);
  } catch (err) {
    console.error("[insurance] sponsored listings failed", err);
    return [];
  }
  const ids = new Set((await getPublicProducts()).map((p) => p.id));
  const seen = new Set<number>();
  return listings.filter((l) => ids.has(l.productId) && !seen.has(l.productId) && seen.add(l.productId));
}

export interface PublicCompanyProfile {
  id: number;
  slug: string;
  name: string;
  shortName: string | null;
  logo: string | null;
  about: string | null;
  website: string | null;
  regulatorRegNo: string | null;
  headquarters: string | null;
  establishedYear: number | null;
  garageCount: number | null;
  garageNote: string | null;
  claimInfo: CompanyClaimInfo | null;
  supportPhone: string | null;
  claimsPhone: string | null;
  claimsEmail: string | null;
  /** The insurer's own vendor profile contacts (when the insurer is an approved vendor). */
  vendorContacts: Pick<InsurerProfile, "supportPhone" | "supportEmail" | "claimsPhone" | "claimsEmail" | "supportHours" | "website"> | null;
  products: MarketProduct[];
}

/** An active insurance company's public profile with its public products, or null. */
export const getPublicCompany = cache(async (slug: string): Promise<PublicCompanyProfile | null> => {
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug)) return null;
  const [row] = await getDb()
    .select({ c: insCompanies, vendorStatus: insVendors.status, vendorProfile: insVendors.profile })
    .from(insCompanies)
    .leftJoin(insVendors, eq(insVendors.id, insCompanies.vendorId))
    .where(and(eq(insCompanies.slug, slug), eq(insCompanies.isActive, true)))
    .limit(1);
  if (!row) return null;
  const { c } = row;
  const profile = row.vendorStatus === "approved" ? row.vendorProfile : null;
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    shortName: c.shortName,
    logo: c.logo,
    about: c.about,
    website: c.website,
    regulatorRegNo: c.regulatorRegNo,
    headquarters: c.headquarters,
    establishedYear: c.establishedYear,
    garageCount: c.garageCount,
    garageNote: c.garageNote,
    claimInfo: publicClaimInfo(c.claimInfo),
    supportPhone: c.supportPhone,
    claimsPhone: c.claimsPhone,
    claimsEmail: c.claimsEmail,
    vendorContacts: profile
      ? {
          supportPhone: profile.supportPhone,
          supportEmail: profile.supportEmail,
          claimsPhone: profile.claimsPhone,
          claimsEmail: profile.claimsEmail,
          supportHours: profile.supportHours,
          website: profile.website,
        }
      : null,
    products: (await getPublicProducts()).filter((p) => p.company.id === c.id),
  };
});

/** A public product's brochure or policy wording (the ins_files id), only while the product is public. */
export async function getPublicProductDocument(reference: string, kind: "brochure" | "wording"): Promise<{ fileId: number; vendorId: number; productId: number } | null> {
  if (!/^PRD-[A-Z0-9]{6}$/.test(reference)) return null;
  const [row] = await getDb()
    .select({ id: insProducts.id, vendorId: insProducts.vendorId, documents: insProducts.documents })
    .from(insProducts)
    .innerJoin(insVendors, eq(insVendors.id, insProducts.vendorId))
    .innerJoin(insCompanies, eq(insCompanies.id, insProducts.companyId))
    .where(and(publicProductWhere, eq(insProducts.reference, reference)))
    .limit(1);
  const ref = row?.documents?.[kind];
  return row && ref ? { fileId: ref.id, vendorId: row.vendorId, productId: row.id } : null;
}
