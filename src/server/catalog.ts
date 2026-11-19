import "server-only";
import { cache } from "react";
import { revalidateTag, unstable_cache } from "next/cache";
import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { createCatalog, type CatalogData, type DealerProfile, type DealerReview } from "@/lib/catalog";
import type { Article, ArticleCategory, CarModel, OwnerReview, UsedCar } from "@/types";

/** Cache tag for everything the public site reads. Admin writes expire it. */
export const CATALOG_TAG = "catalog";

// `undefined` keeps optional fields out of the serialised payload.
const opt = <T,>(v: T | null | undefined) => (v ?? undefined) as T | undefined;

async function loadCatalogData(): Promise<CatalogData> {
  const db = getDb();
  const [brandRows, carRows, variantRows, upcomingRows, dealerRows, dealerReviewRows, usedRows, authorRows, articleRows, ownerReviewRows] =
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
    authors: authorRows.map((a) => ({ id: a.id, name: a.name, role: a.role })),
    articles,
    ownerReviews,
  };
}

/** Raw catalogue data, cached across requests until an admin edit expires it. */
export const getCatalogData = unstable_cache(loadCatalogData, ["catalog-data-v1"], { tags: [CATALOG_TAG], revalidate: 3600 });

/** The catalogue with lookup helpers — deduplicated per request. */
export const getCatalog = cache(async () => createCatalog(await getCatalogData()));

/** Call after any admin change to catalogue or editorial data. */
export function expireCatalog() {
  revalidateTag(CATALOG_TAG, { expire: 0 });
}
