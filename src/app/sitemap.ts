import type { MetadataRoute } from "next";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { getCatalog } from "@/server/catalog";
import { liveOffers } from "@/server/partner/offers";
import { getPublicProducts, getPublicProviders } from "@/server/insurance/public";
import { INDEXABLE, absoluteUrl } from "@/components/seo/site";

/*
 * sitemap.xml — every public, indexable URL. One file: the catalogue is a few hundred URLs, far below the
 * 50,000-per-file limit; split it with generateSitemaps() if used-car or offer inventory ever gets near that.
 *
 * Only what the public pages would show is listed: active brands, published cars (and their variants),
 * active dealers, active used listings, published articles dated today or earlier, live offers, public
 * insurance products and their providers, and the insurance guides. Private areas (account, portals,
 * quote links) and query variants are never listed. lastModified comes from the rows' updated_at.
 */

// Rebuilt at most hourly (admin edits also expire the catalogue cache it reads).
export const revalidate = 3600;

type Entry = MetadataRoute.Sitemap[number];
type Freq = Entry["changeFrequency"];

const latest = (...dates: (Date | string | null | undefined)[]) => {
  const times = dates.map((d) => (d ? new Date(d).getTime() : NaN)).filter((t) => Number.isFinite(t));
  return times.length ? new Date(Math.max(...times)) : undefined;
};

/** updated_at per key, for lastModified. */
async function timestamps() {
  const db = getDb();
  const [brands, cars, upcoming, dealers, used, articles, products, companies, offers, content] = await Promise.all([
    db.select({ k: s.brands.slug, t: s.brands.updatedAt }).from(s.brands),
    db.select({ k: s.cars.slug, t: s.cars.updatedAt }).from(s.cars),
    db.select({ k: s.upcomingCars.slug, t: s.upcomingCars.updatedAt }).from(s.upcomingCars),
    db.select({ k: s.dealers.id, t: s.dealers.updatedAt }).from(s.dealers),
    db.select({ k: s.usedCars.id, t: s.usedCars.updatedAt }).from(s.usedCars),
    db.select({ k: s.articles.slug, t: s.articles.updatedAt }).from(s.articles),
    db.select({ k: s.insProducts.reference, t: s.insProducts.updatedAt }).from(s.insProducts),
    db.select({ k: s.insCompanies.slug, t: s.insCompanies.updatedAt }).from(s.insCompanies),
    db.select({ k: s.partnerOffers.reference, t: s.partnerOffers.updatedAt }).from(s.partnerOffers),
    db.select({ k: s.siteContent.key, t: s.siteContent.updatedAt }).from(s.siteContent),
  ]);
  const map = (rows: { k: string; t: Date }[]) => new Map(rows.map((r) => [r.k, r.t]));
  return {
    brand: map(brands),
    car: map(cars),
    upcoming: map(upcoming),
    dealer: map(dealers),
    used: map(used),
    article: map(articles),
    product: map(products),
    company: map(companies),
    offer: map(offers),
    content: map(content),
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!INDEXABLE) return [];

  const [cat, t, offers, products, providers] = await Promise.all([getCatalog(), timestamps(), liveOffers(), getPublicProducts(), getPublicProviders()]);
  const { brands, cars, upcoming, dealers, usedCars, articles, content } = cat;
  const entry = (path: string, lastModified: Date | undefined, changeFrequency: Freq, priority: number, images?: (string | undefined)[]): Entry => ({
    url: absoluteUrl(path),
    ...(lastModified ? { lastModified } : {}),
    changeFrequency,
    priority,
    ...(images?.some(Boolean) ? { images: images.filter((i): i is string => Boolean(i)).map(absoluteUrl) } : {}),
  });

  const carsUpdated = latest(...cars.map((c) => t.car.get(c.slug)));
  const usedUpdated = latest(...usedCars.map((c) => t.used.get(c.id)));
  const newsUpdated = latest(...articles.map((a) => t.article.get(a.slug) ?? a.publishedOn));
  const dealersUpdated = latest(...dealers.map((d) => t.dealer.get(d.id)));
  const offersUpdated = latest(...offers.map((o) => t.offer.get(o.reference)));
  const productsUpdated = latest(...products.map((p) => t.product.get(p.reference)));
  const block = (key: string) => t.content.get(key);
  // Policies carry their own "last updated" date; a later edit of the block counts too.
  const legalUpdated = latest(content.legal.updated, block("legal"));
  const cookiesUpdated = latest(content.cookiePolicy.updated, block("cookiePolicy"));
  const refundUpdated = latest(content.refundPolicy.updated, block("refundPolicy"));
  const evs = cars.filter((c) => c.fuelTypes.includes("Electric") && c.ev);
  const guides = content.insuranceGuides.guides;
  const insuranceUpdated = latest(productsUpdated, block("insurancePage"), block("insuranceSettings"));

  const staticPages: Entry[] = [
    entry("/", latest(carsUpdated, usedUpdated, newsUpdated, block("homeHero")), "daily", 1),
    // New cars
    entry("/new-cars", carsUpdated, "daily", 0.9),
    entry("/brands", latest(...brands.map((b) => t.brand.get(b.slug))), "weekly", 0.8),
    entry("/electric-cars", latest(...evs.map((c) => t.car.get(c.slug))), "weekly", 0.8),
    entry("/upcoming-cars", latest(...upcoming.map((u) => t.upcoming.get(u.slug))), "weekly", 0.7),
    entry("/compare", carsUpdated, "weekly", 0.7),
    entry("/offers", offersUpdated, "daily", 0.7),
    // Used cars
    entry("/used-cars", usedUpdated, "daily", 0.9),
    entry("/sell-car", block("sell"), "monthly", 0.6),
    entry("/dealers", dealersUpdated, "weekly", 0.7),
    // Research
    entry("/reviews", latest(carsUpdated, block("reviewsFeatured")), "weekly", 0.7),
    entry("/reviews/owners", undefined, "weekly", 0.6),
    entry("/news", newsUpdated, "daily", 0.8),
    entry("/pdi-check", latest(block("pdiPage"), block("pdiPlans")), "monthly", 0.6),
    // Tools
    entry("/tools", block("toolRates"), "monthly", 0.6),
    entry("/tools/emi-calculator", block("toolRates"), "monthly", 0.6),
    entry("/tools/car-loan", block("toolRates"), "monthly", 0.5),
    entry("/tools/ownership-cost", block("toolRates"), "monthly", 0.5),
    entry("/tools/mileage-calculator", undefined, "monthly", 0.5),
    entry("/tools/ev-vs-petrol", block("toolRates"), "monthly", 0.5),
    entry("/tools/car-valuation", undefined, "monthly", 0.5),
    // Insurance
    entry("/insurance", insuranceUpdated, "weekly", 0.8),
    entry("/insurance/quotes", productsUpdated, "weekly", 0.6),
    entry("/insurance/compare", productsUpdated, "weekly", 0.6),
    entry("/insurance/providers", latest(productsUpdated, ...providers.map((p) => t.company.get(p.slug))), "weekly", 0.6),
    entry("/insurance/new-car", insuranceUpdated, "monthly", 0.6),
    entry("/insurance/renewal", insuranceUpdated, "monthly", 0.6),
    entry("/insurance/used-car", insuranceUpdated, "monthly", 0.5),
    entry("/insurance/ev", insuranceUpdated, "monthly", 0.5),
    entry("/insurance/types", insuranceUpdated, "monthly", 0.5),
    entry("/insurance/add-ons", insuranceUpdated, "monthly", 0.5),
    entry("/insurance/claims", insuranceUpdated, "monthly", 0.5),
    entry("/insurance/guides", block("insuranceGuides"), "monthly", 0.5),
    entry("/insurance/articles", newsUpdated, "weekly", 0.4),
    // Company & legal
    entry("/about", block("about"), "yearly", 0.4),
    entry("/contact", block("site"), "yearly", 0.4),
    entry("/privacy", legalUpdated, "yearly", 0.2),
    entry("/terms", legalUpdated, "yearly", 0.2),
    entry("/cookies", cookiesUpdated, "yearly", 0.2),
    entry("/refund-policy", refundUpdated, "yearly", 0.2),
  ];

  return [
    ...staticPages,
    ...brands.map((b) => entry(`/brands/${b.slug}`, latest(t.brand.get(b.slug), ...cars.filter((c) => c.brand === b.slug).map((c) => t.car.get(c.slug))), "weekly", 0.7, [b.heroImage])),
    ...cars.map((c) => entry(`/cars/${c.slug}`, t.car.get(c.slug), "weekly", 0.9, [c.images[0]])),
    ...cars.flatMap((c) => c.variants.map((v) => entry(`/cars/${c.slug}/${v.slug}`, t.car.get(c.slug), "monthly", 0.6))),
    ...evs.map((c) => entry(`/electric-cars/${c.slug}`, t.car.get(c.slug), "weekly", 0.7, [c.images[0]])),
    ...usedCars.map((c) => entry(`/used-cars/${c.id}`, t.used.get(c.id), "daily", 0.6, [c.images[0]])),
    ...dealers.map((d) => entry(`/dealers/${d.id}`, t.dealer.get(d.id), "weekly", 0.6, [d.image])),
    ...articles.map((a) => entry(`/news/${a.slug}`, latest(t.article.get(a.slug), a.publishedOn), "monthly", 0.7, [a.image])),
    ...offers.map((o) => entry(`/offers/${o.reference}`, t.offer.get(o.reference), "daily", 0.5)),
    ...providers.map((p) => entry(`/insurance/providers/${p.slug}`, latest(t.company.get(p.slug), productsUpdated), "weekly", 0.5)),
    ...products.map((p) => entry(`/insurance/products/${p.reference}`, latest(t.product.get(p.reference), p.publishedAt), "weekly", 0.5)),
    ...guides.map((g) => entry(`/insurance/guides/${g.slug}`, block("insuranceGuides"), "monthly", 0.5, [g.image || undefined])),
  ];
}
