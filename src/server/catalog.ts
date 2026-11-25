import "server-only";
import { cache } from "react";
import { revalidateTag, unstable_cache } from "next/cache";
import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { createCatalog, encodeClientCatalog, toClientCatalog, type CatalogData, type ClientCatalogWire, type DealerProfile, type DealerReview } from "@/lib/catalog";
import { todayISO } from "@/server/validation";
import { BLOCKS, BLOCK_KEYS, type SiteContent } from "@/content/registry";
import type { Article, ArticleCategory, CarModel, OwnerReview, UsedCar } from "@/types";

/** Cache tag for everything the public site reads. Admin writes expire it. */
export const CATALOG_TAG = "catalog";

// `undefined` keeps optional fields out of the serialised payload.
const opt = <T,>(v: T | null | undefined) => (v ?? undefined) as T | undefined;

/** Everything from MySQL; content rows stay raw so they're validated against the current schemas on read. */
type CachedCatalog = Omit<CatalogData, "content"> & { contentRows: { key: string; data: unknown }[] };

async function loadCatalogData(): Promise<CachedCatalog> {
  const db = getDb();
  const [brandRows, carRows, variantRows, upcomingRows, dealerRows, dealerReviewRows, usedRows, authorRows, articleRows, ownerReviewRows, contentRows] =
    await Promise.all([
      db.select().from(s.brands).where(eq(s.brands.isActive, true)).orderBy(asc(s.brands.sortOrder), asc(s.brands.name)),
      db.select().from(s.cars).where(eq(s.cars.status, "published")).orderBy(asc(s.cars.sortOrder), asc(s.cars.id)),
      db.select().from(s.variants).orderBy(asc(s.variants.carId), asc(s.variants.sortOrder), asc(s.variants.price)),
      db.select().from(s.upcomingCars).where(eq(s.upcomingCars.status, "published")).orderBy(asc(s.upcomingCars.sortOrder)),
      db.select().from(s.dealers).where(eq(s.dealers.isActive, true)).orderBy(asc(s.dealers.sortOrder), asc(s.dealers.name)),
      db.select().from(s.dealerReviews).where(eq(s.dealerReviews.status, "approved")).orderBy(desc(s.dealerReviews.date)),
      db.select().from(s.usedCars).where(eq(s.usedCars.status, "active")).orderBy(desc(s.usedCars.postedOn), asc(s.usedCars.id)),
      db.select().from(s.authors).orderBy(asc(s.authors.createdAt), asc(s.authors.name)),
      db.select().from(s.articles).where(eq(s.articles.status, "published")).orderBy(desc(s.articles.publishedOn), desc(s.articles.id)),
      db.select().from(s.ownerReviews).where(eq(s.ownerReviews.status, "approved")).orderBy(desc(s.ownerReviews.date)),
      db.select({ key: s.siteContent.key, data: s.siteContent.data }).from(s.siteContent),
    ]);

  const brandSlugs = new Set(brandRows.map((b) => b.slug));

  const variantsByCar = new Map<number, CarModel["variants"]>();
  for (const v of variantRows) {
    const list = variantsByCar.get(v.carId) ?? [];
    list.push({ slug: v.slug, name: v.name, fuel: v.fuel, transmission: v.transmission, price: v.price, efficiency: v.efficiency, features: v.features });
    variantsByCar.set(v.carId, list);
  }

  const cars: CarModel[] = carRows
    // A car whose brand is hidden is hidden too.
    .filter((c) => brandSlugs.has(c.brand))
    .map((c) => ({
      ...c,
      // Pages read EV specs for every electric model; without them, list it by its other fuels only.
      fuelTypes: c.ev ? c.fuelTypes : c.fuelTypes.filter((f) => f !== "Electric"),
    }))
    .filter((c) => c.fuelTypes.length > 0)
    .map((c) => ({
      slug: c.slug,
      brand: c.brand,
      name: c.name,
      bodyType: c.bodyType,
      isLuxury: c.isLuxury,
      priceMin: c.priceMin,
      priceMax: c.priceMax,
      fuelTypes: c.fuelTypes,
      transmissions: c.transmissions,
      efficiency: c.efficiency,
      efficiencyValue: c.efficiencyValue,
      engine: c.engine,
      power: c.power,
      torque: c.torque,
      seats: c.seats,
      safetyRating: c.safetyRating,
      safetyAgency: c.safetyAgency as CarModel["safetyAgency"],
      airbags: c.airbags,
      bootSpace: c.bootSpace,
      groundClearance: c.groundClearance,
      fuelTank: opt(c.fuelTank),
      topSpeed: c.topSpeed,
      acceleration: c.acceleration,
      dimensions: c.dimensions,
      rating: c.rating,
      reviewCount: c.reviewCount,
      images: c.images,
      focus: opt(c.focus),
      colors: c.colors,
      tagline: c.tagline,
      overview: c.overview,
      highlights: c.highlights,
      pros: c.pros,
      cons: c.cons,
      features: c.features,
      variants: variantsByCar.get(c.id) ?? [],
      ev: opt(c.ev),
      expertScore: c.expertScore,
      expertVerdict: c.expertVerdict,
      competitors: c.competitors,
      trending: c.trending,
      launchedOn: opt(c.launchedOn),
      dataAsOf: opt(c.dataAsOf),
      priceCity: opt(c.priceCity),
    }));
  const carSlugs = new Set(cars.map((c) => c.slug));
  // Rivals may point at a car that was deleted or unpublished since.
  for (const c of cars) c.competitors = c.competitors.filter((slug) => carSlugs.has(slug));

  const dealerProfiles: Record<string, DealerProfile> = {};
  for (const d of dealerRows) if (d.profile) dealerProfiles[d.id] = d.profile;
  const dealerIds = new Set(dealerRows.map((d) => d.id));

  const usedCars: UsedCar[] = usedRows.map((c) => ({
    id: c.id,
    modelSlug: c.modelSlug && carSlugs.has(c.modelSlug) ? c.modelSlug : undefined,
    brand: c.brand,
    name: c.name,
    variant: c.variant,
    year: c.year,
    km: c.km,
    fuel: c.fuel,
    transmission: c.transmission,
    owners: c.owners,
    city: c.city,
    price: c.price,
    newPrice: opt(c.newPrice),
    bodyType: c.bodyType,
    images: c.images,
    focus: opt(c.focus),
    verified: c.verified,
    inspectionScore: c.inspectionScore,
    registration: c.registration,
    insurance: c.insurance,
    color: c.color,
    seller: { name: c.sellerName, type: c.sellerType, dealerId: opt(c.dealerId) },
    highlights: c.highlights,
    postedOn: c.postedOn,
  }));

  const articles: Article[] = articleRows.map((a) => ({
    slug: a.slug,
    title: a.title,
    dek: a.dek,
    category: a.category as ArticleCategory,
    authorId: a.authorId,
    publishedOn: a.publishedOn,
    readMinutes: a.readMinutes,
    image: a.image,
    body: a.body,
    pullQuote: opt(a.pullQuote),
    tags: a.tags,
    relatedCar: a.relatedCar && carSlugs.has(a.relatedCar) ? a.relatedCar : undefined,
    videoDuration: opt(a.videoDuration),
  }));

  const ownerReviews: OwnerReview[] = ownerReviewRows
    .filter((r) => carSlugs.has(r.carSlug))
    .map((r) => ({
      id: r.id,
      carSlug: r.carSlug,
      name: r.name,
      city: r.city,
      variant: r.variant,
      ownedFor: r.ownedFor,
      kmDriven: r.kmDriven,
      rating: r.rating,
      title: r.title,
      body: r.body,
      date: r.date,
      helpful: r.helpful,
      ratings: r.ratings,
    }));

  const dealerReviews: DealerReview[] = dealerReviewRows
    .filter((r) => dealerIds.has(r.dealerId))
    .map((r) => ({
      id: r.id,
      dealerId: r.dealerId,
      name: r.name,
      visit: r.visit as DealerReview["visit"],
      date: r.date,
      rating: r.rating,
      title: r.title,
      body: r.body,
      reply: opt(r.reply),
      repliedAt: opt(r.repliedAt?.toISOString()),
    }));

  return {
    brands: brandRows.map((b) => ({
      slug: b.slug,
      name: b.name,
      country: b.country,
      founded: b.founded,
      tagline: b.tagline,
      description: b.description,
      heroImage: b.heroImage,
      isLuxury: b.isLuxury,
    })),
    cars,
    upcoming: upcomingRows
      .filter((u) => brandSlugs.has(u.brand))
      .map((u) => ({
        slug: u.slug,
        brand: u.brand,
        name: u.name,
        bodyType: u.bodyType,
        fuel: u.fuel,
        expectedLaunch: u.expectedLaunch,
        priceMin: u.priceMin,
        priceMax: u.priceMax,
        image: u.image,
        teaser: u.teaser,
        highlights: u.highlights,
      })),
    dealers: dealerRows.map((d) => ({
      id: d.id,
      name: d.name,
      brand: d.brand,
      city: d.city,
      area: d.area,
      address: d.address,
      rating: d.rating,
      reviewCount: d.reviewCount,
      phone: d.phone,
      email: d.email,
      hours: d.hours,
      image: d.image,
      services: d.services,
      established: d.established,
      distanceKm: d.distanceKm,
      usedInventory: d.usedInventory,
    })),
    dealerProfiles,
    dealerReviews,
    usedCars,
    authors: authorRows.map((a) => ({ id: a.id, name: a.name, role: a.role, bio: opt(a.bio), beat: opt(a.beat), base: opt(a.base), joined: opt(a.joined) })),
    articles,
    ownerReviews,
    contentRows,
  };
}

/** Saved blocks win; anything unsaved (or no longer valid after a schema change) falls back to the defaults. */
function loadContent(rows: { key: string; data: unknown }[]): SiteContent {
  const saved = new Map(rows.map((r) => [r.key, r.data]));
  const out: Record<string, unknown> = {};
  for (const key of BLOCK_KEYS) {
    const block = BLOCKS[key];
    if (!saved.has(key)) {
      out[key] = block.defaults;
      continue;
    }
    const parsed = block.schema.safeParse(saved.get(key));
    if (!parsed.success) console.warn(`[content] "${key}" in the database doesn't match its schema — using defaults.`);
    out[key] = parsed.success ? parsed.data : block.defaults;
  }
  return out as SiteContent;
}

/**
 * Bump when the shape of CatalogData changes. Together with the block list and the
 * deployment's commit, it keys the cache — `unstable_cache` entries outlive deployments,
 * and an entry in an old shape would otherwise crash every page after an upgrade.
 */
const CATALOG_SHAPE_VERSION = 4;
const CACHE_KEY = ["catalog-data", `v${CATALOG_SHAPE_VERSION}`, BLOCK_KEYS.join(","), process.env.VERCEL_GIT_COMMIT_SHA ?? "local"];

/** Raw catalogue data, cached across requests until an admin edit expires it. */
const getCachedCatalog = unstable_cache(loadCatalogData, CACHE_KEY, { tags: [CATALOG_TAG], revalidate: 3600 });

/**
 * Raw catalogue data, cached across requests until an admin edit expires it.
 * Content blocks are parsed per request, so a block whose shape changed in code
 * can never be served from the cache in its old shape.
 */
export const getCatalogData = cache(async (): Promise<CatalogData> => {
  const { contentRows, ...data } = await getCachedCatalog();
  // Scheduled stories: published but dated in the future stay hidden until their day (IST).
  const today = todayISO();
  return { ...data, articles: data.articles.filter((a) => a.publishedOn <= today), content: loadContent(contentRows) };
});

/** The catalogue with lookup helpers — deduplicated per request. */
export const getCatalog = cache(async () => createCatalog(await getCatalogData()));

/**
 * The catalogue for <CatalogProvider>: every model as CarLite in the compact wire format, so pages don't ship the
 * full catalogue to the browser (≈1.5 MB → ≈0.4 MB with the researched catalogue).
 */
export const getClientCatalogData = cache(async (): Promise<ClientCatalogWire> => encodeClientCatalog(toClientCatalog(await getCatalogData())));

/** Call after any admin change to catalogue or editorial data. */
export function expireCatalog() {
  revalidateTag(CATALOG_TAG, { expire: 0 });
}
