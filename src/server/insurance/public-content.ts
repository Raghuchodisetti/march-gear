import "server-only";
import { cache } from "react";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { insCompanies, insCovers, insProducts, insVendors } from "@/db/schema";
import { getCatalog } from "@/server/catalog";
import { getPublicProviders, publicProductWhere } from "@/server/insurance/public";
import type { Article } from "@/types";

/* ──────────────────────────────────────────────────────────────
   Extra read helpers for the public insurance content pages
   (/insurance, /insurance/add-ons, /insurance/claims,
   /insurance/articles). Same public rules as public.ts:
   products must pass `publicProductWhere`, covers must be
   approved, providers come from getPublicProviders().
   ────────────────────────────────────────────────────────────── */

export interface AddOnOffers {
  /** Public products in total. */
  total: number;
  /** Standard cover key → number of public products offering it (included or optional). */
  byKey: Record<string, number>;
}

/** How many public products offer each standard add-on (by the approved cover's key). */
export const getAddOnOffers = cache(async (): Promise<AddOnOffers> => {
  const db = getDb();
  const products = await db
    .select({ id: insProducts.id, vendorId: insProducts.vendorId, addOns: insProducts.addOns })
    .from(insProducts)
    .innerJoin(insVendors, eq(insVendors.id, insProducts.vendorId))
    .innerJoin(insCompanies, eq(insCompanies.id, insProducts.companyId))
    .where(publicProductWhere);
  const coverIds = [...new Set(products.flatMap((p) => (Array.isArray(p.addOns) ? p.addOns.map((a) => a.coverId) : [])))].filter(Number.isInteger);
  const byKey: Record<string, number> = {};
  if (coverIds.length) {
    const covers = await db
      .select({ id: insCovers.id, key: insCovers.key, vendorId: insCovers.vendorId })
      .from(insCovers)
      .where(and(inArray(insCovers.id, coverIds), eq(insCovers.status, "approved"), eq(insCovers.type, "addon")));
    const coverById = new Map(covers.map((c) => [c.id, c]));
    for (const p of products) {
      const keys = new Set<string>();
      for (const a of Array.isArray(p.addOns) ? p.addOns : []) {
        const c = coverById.get(a.coverId);
        // A product may only use its own vendor's covers; anything else is ignored.
        if (c && c.vendorId === p.vendorId && c.key !== "custom") keys.add(c.key);
      }
      for (const k of keys) byKey[k] = (byKey[k] ?? 0) + 1;
    }
  }
  return { total: products.length, byKey };
});

export interface ClaimContact {
  id: number;
  slug: string;
  name: string;
  logo: string | null;
  claimsPhone: string | null;
  claimsEmail: string | null;
  supportPhone: string | null;
  /** The insurer's own claim steps (one per line), when it has published them. */
  process: string[];
}

/** Claim contacts of the insurers that have public products (empty until insurers are onboarded). */
export const getClaimContacts = cache(async (): Promise<ClaimContact[]> => {
  const providers = await getPublicProviders();
  if (!providers.length) return [];
  const rows = await getDb()
    .select({ id: insCompanies.id, claimsPhone: insCompanies.claimsPhone, claimsEmail: insCompanies.claimsEmail, supportPhone: insCompanies.supportPhone })
    .from(insCompanies)
    .where(and(inArray(insCompanies.id, providers.map((p) => p.id)), eq(insCompanies.isActive, true)));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return providers
    .filter((p) => byId.has(p.id))
    .map((p) => {
      const r = byId.get(p.id)!;
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        logo: p.logo,
        claimsPhone: r.claimsPhone || null,
        claimsEmail: r.claimsEmail || null,
        supportPhone: r.supportPhone || null,
        process: (p.claimInfo?.process ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 8),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
});

/* ── Editorial articles about insurance ─────────────────────── */

/** Words that make an article about insurance when they appear in its title, standfirst or tags. */
const STRONG =
  /\b(insurance|insurer|insured|insure|claim (settlement|process|form)|(make|making|file|filing|insurance) an? claim|no[- ]claim|NCB|IDV|premium (rates?|hikes?)|zero[- ]dep(reciation)?|third[- ]party (cover|liability|insurance)|own[- ]damage|engine protection|return to invoice)\b/i;
/** In the body we only count unambiguous insurance terms (not "premium SUV" or a "claimed" range). */
const BODY = /\b(insurance|insurer|insured|no[- ]claim bonus|NCB|IDV|zero[- ]depreciation|engine[- ]protection|third[- ]party cover|own[- ]damage)\b/gi;

export interface InsuranceArticle {
  article: Article;
  /** Why it's listed: "Headline" when the title/standfirst/tags are about insurance, otherwise "Mentions insurance". */
  match: "headline" | "mention";
}

/** Published editorial articles related to insurance, most relevant first, then newest. */
export const getInsuranceArticles = cache(async (): Promise<InsuranceArticle[]> => {
  const { articles } = await getCatalog();
  const scored = articles
    .map((article) => {
      const head = [article.title, article.dek, ...(article.tags ?? [])].join(" · ");
      const headline = /insurance/i.test(article.category) || STRONG.test(head);
      const mentions = (article.body ?? []).join(" ").match(BODY)?.length ?? 0;
      const score = (headline ? 10 : 0) + Math.min(mentions, 5);
      return { article, score, match: (headline ? "headline" : "mention") as InsuranceArticle["match"] };
    })
    .filter((x) => x.score > 0);
  return scored
    .sort((a, b) => b.score - a.score || (a.article.publishedOn < b.article.publishedOn ? 1 : -1))
    .map(({ article, match }) => ({ article, match }));
});
