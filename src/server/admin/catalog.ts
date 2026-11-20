import "server-only";
import { and, asc, count, desc, eq, like, or, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { USED_STATUS, articles, authors, brands, cars, dealers, upcomingCars, usedCars, variants, type UsedStatus } from "@/db/schema";
import type { SiteContent } from "@/content/registry";
import { contentForm } from "@/server/admin/content";
import { LEGACY_BRANDS } from "@/lib/catalog";
import type { FormValues, Option } from "@/components/admin/fields";
import { requireStaff } from "@/server/auth";
import { todayISO } from "@/server/validation";

const term = (q: string) => `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;

/* ── Options for selects ────────────────────────────────────── */

export async function brandOptions({ legacy = false, multi = false } = {}): Promise<Option[]> {
  const rows = await getDb().select({ value: brands.slug, label: brands.name }).from(brands).orderBy(asc(brands.name));
  const extra = Object.entries(LEGACY_BRANDS)
    .filter(([value]) => (value === "multi-brand" ? multi : legacy) && !rows.some((r) => r.value === value))
    .map(([value, label]) => ({ value, label: value === "multi-brand" ? "Multi-brand dealer" : `${label} (pre-owned only)` }));
  return [...rows, ...extra];
}

/** Whether a brand is shown on the site (a hidden brand hides its cars too). */
export async function isBrandVisible(slug: string) {
  await requireStaff();
  const [b] = await getDb().select({ isActive: brands.isActive }).from(brands).where(eq(brands.slug, slug));
  return Boolean(b?.isActive);
}

export async function carOptions(): Promise<Option[]> {
  const rows = await getDb()
    .select({ value: cars.slug, name: cars.name, brand: brands.name })
    .from(cars)
    .innerJoin(brands, eq(brands.slug, cars.brand))
    .orderBy(asc(brands.name), asc(cars.name));
  return rows.map((r) => ({ value: r.value, label: `${r.brand} ${r.name}` }));
}

export async function dealerOptions(): Promise<Option[]> {
  const rows = await getDb().select({ value: dealers.id, name: dealers.name, city: dealers.city }).from(dealers).orderBy(asc(dealers.name));
  return rows.map((r) => ({ value: r.value, label: `${r.name}, ${r.city}` }));
}

export async function authorOptions(): Promise<Option[]> {
  return getDb().select({ value: authors.id, label: authors.name }).from(authors).orderBy(asc(authors.name));
}

/** Cities from the `cities` content block, by name (dealers and used cars store the city name). Read fresh, not from the public catalogue cache. */
export async function cityOptions(): Promise<Option[]> {
  const { items } = (await contentForm("cities")).values as SiteContent["cities"];
  return [...items].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.name, label: c.name }));
}

/* ── Lists ──────────────────────────────────────────────────── */

export async function listBrands() {
  await requireStaff();
  const db = getDb();
  const [rows, counts] = await Promise.all([
    db.select().from(brands).orderBy(asc(brands.sortOrder), asc(brands.name)),
    db.select({ brand: cars.brand, n: count() }).from(cars).groupBy(cars.brand),
  ]);
  const byBrand = new Map(counts.map((c) => [c.brand, c.n]));
  return rows.map((b) => ({ ...b, models: byBrand.get(b.slug) ?? 0 }));
}

export async function listCars(q?: string, brand?: string) {
  await requireStaff();
  const db = getDb();
  const conds: SQL[] = [];
  if (q) conds.push(or(like(cars.name, term(q)), like(cars.slug, term(q)))!);
  if (brand) conds.push(eq(cars.brand, brand));
  const [rows, variantCounts] = await Promise.all([
    db
      .select({
        id: cars.id,
        slug: cars.slug,
        name: cars.name,
        brand: brands.name,
        bodyType: cars.bodyType,
        priceMin: cars.priceMin,
        priceMax: cars.priceMax,
        status: cars.status,
        trending: cars.trending,
        images: cars.images,
      })
      .from(cars)
      .innerJoin(brands, eq(brands.slug, cars.brand))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(asc(brands.name), asc(cars.sortOrder), asc(cars.name)),
    db.select({ carId: variants.carId, n: count() }).from(variants).groupBy(variants.carId),
  ]);
  const vc = new Map(variantCounts.map((v) => [v.carId, v.n]));
  return rows.map(({ images, ...r }) => ({ ...r, image: images[0], variants: vc.get(r.id) ?? 0 }));
}

export async function listUpcoming() {
  await requireStaff();
  return getDb()
    .select({ id: upcomingCars.id, slug: upcomingCars.slug, name: upcomingCars.name, brand: brands.name, expectedLaunch: upcomingCars.expectedLaunch, status: upcomingCars.status, image: upcomingCars.image, priceMin: upcomingCars.priceMin, priceMax: upcomingCars.priceMax })
    .from(upcomingCars)
    .innerJoin(brands, eq(brands.slug, upcomingCars.brand))
    .orderBy(asc(upcomingCars.sortOrder), asc(upcomingCars.name));
}

export async function listUsedCars(q?: string, status?: string) {
  await requireStaff();
  const conds: SQL[] = [];
  if (q) conds.push(or(like(usedCars.name, term(q)), like(usedCars.id, term(q)), like(usedCars.city, term(q)), like(usedCars.variant, term(q)))!);
  if (status && (USED_STATUS as readonly string[]).includes(status)) conds.push(eq(usedCars.status, status as UsedStatus));
  return getDb()
    .select()
    .from(usedCars)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(usedCars.postedOn), desc(usedCars.createdAt));
}

export async function listDealers() {
  await requireStaff();
  return getDb().select().from(dealers).orderBy(asc(dealers.sortOrder), asc(dealers.name));
}

export async function listArticles(q?: string) {
  await requireStaff();
  return getDb()
    .select({ id: articles.id, slug: articles.slug, title: articles.title, category: articles.category, status: articles.status, publishedOn: articles.publishedOn, image: articles.image, author: authors.name })
    .from(articles)
    .innerJoin(authors, eq(authors.id, articles.authorId))
    .where(q ? or(like(articles.title, term(q)), like(articles.slug, term(q))) : undefined)
    .orderBy(desc(articles.publishedOn), desc(articles.id));
}

export async function listAuthors() {
  await requireStaff();
  const db = getDb();
  const [rows, counts] = await Promise.all([
    db.select().from(authors).orderBy(asc(authors.name)),
    db.select({ authorId: articles.authorId, n: count() }).from(articles).groupBy(articles.authorId),
  ]);
  const by = new Map(counts.map((c) => [c.authorId, c.n]));
  return rows.map((a) => ({ ...a, stories: by.get(a.id) ?? 0 }));
}

/* ── Single records → form values ───────────────────────────── */

export async function brandForm(id: number): Promise<FormValues | null> {
  await requireStaff();
  const [b] = await getDb().select().from(brands).where(eq(brands.id, id));
  if (!b) return null;
  return b;
}

export async function carForm(id: number): Promise<FormValues | null> {
  await requireStaff();
  const db = getDb();
  const [c] = await db.select().from(cars).where(eq(cars.id, id));
  if (!c) return null;
  const vs = await db.select().from(variants).where(eq(variants.carId, id)).orderBy(asc(variants.sortOrder), asc(variants.price));
  return {
    ...c,
    seats: c.seats.map(String),
    launchedOn: c.launchedOn ?? "",
    focus: c.focus ?? "",
    variants: vs.map(({ name, slug, fuel, transmission, price, efficiency, features }) => ({ name, slug, fuel, transmission, price, efficiency, features })),
  };
}

export async function upcomingForm(id: number): Promise<FormValues | null> {
  await requireStaff();
  const [u] = await getDb().select().from(upcomingCars).where(eq(upcomingCars.id, id));
  return u ?? null;
}

export async function usedForm(id: string): Promise<FormValues | null> {
  await requireStaff();
  const [u] = await getDb().select().from(usedCars).where(eq(usedCars.id, id));
  if (!u) return null;
  return { ...u, modelSlug: u.modelSlug ?? "", dealerId: u.dealerId ?? "", focus: u.focus ?? "" };
}

export async function dealerForm(id: string): Promise<FormValues | null> {
  await requireStaff();
  const [d] = await getDb().select().from(dealers).where(eq(dealers.id, id));
  return d ?? null;
}

export async function articleForm(id: number): Promise<FormValues | null> {
  await requireStaff();
  const [a] = await getDb().select().from(articles).where(eq(articles.id, id));
  if (!a) return null;
  return { ...a, pullQuote: a.pullQuote ?? "", relatedCar: a.relatedCar ?? "", videoDuration: a.videoDuration ?? "" };
}

export async function authorForm(id: string): Promise<FormValues | null> {
  await requireStaff();
  const [a] = await getDb().select().from(authors).where(eq(authors.id, id));
  return a ?? null;
}

/* ── Defaults for "new" forms ───────────────────────────────── */

export const NEW_DEFAULTS: Record<"brand" | "car" | "upcoming" | "used" | "dealer" | "article" | "author", () => FormValues> = {
  brand: () => ({ isActive: true, sortOrder: 100 }),
  car: () => ({ status: "draft", sortOrder: 100, safetyAgency: "Not tested", rating: 0, reviewCount: 0, expertScore: 7, airbags: 6, safetyRating: 0, seats: ["5"], ev: null }),
  upcoming: () => ({ status: "draft", sortOrder: 100 }),
  used: () => ({ status: "draft", postedOn: todayISO(), owners: 1, inspectionScore: 0, sellerType: "Dealer" }),
  dealer: () => ({ isActive: true, sortOrder: 100, rating: 0, reviewCount: 0, distanceKm: 0, profile: null }),
  article: () => ({ status: "draft", publishedOn: todayISO(), readMinutes: 4, category: "News" }),
  author: () => ({}),
};
