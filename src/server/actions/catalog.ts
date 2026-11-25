"use server";

import { randomInt } from "node:crypto";
import { z } from "zod";
import { and, eq, like, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { FUEL_TYPES } from "@/db/enums";
import { PUBLISH_STATUS, USED_STATUS, articles, authors, brands, cars, dealers, upcomingCars, usedCars, variants } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { requireStaff } from "@/server/auth";
import { expireCatalog } from "@/server/catalog";
import { invalid } from "@/server/validation";
import { isDuplicate, isInUse, isMissingParent } from "@/server/db-errors";
import { audit } from "@/server/audit";
import { LEGACY_BRANDS } from "@/lib/catalog";

/* ── Field rules ────────────────────────────────────────────── */

const text = (label: string, max = 200) => z.string({ error: `Enter the ${label}` }).trim().min(1, `Enter the ${label}`).max(max, "That's too long");
const optText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));
const num = (label: string, min = 0, max = 1e10) =>
  z.number({ error: `Enter the ${label}` }).min(min, `${label[0].toUpperCase()}${label.slice(1)} can't be below ${min}`).max(max, `${label[0].toUpperCase()}${label.slice(1)} can't exceed ${max}`);
const int = (label: string, min = 0, max = 2_000_000_000) => num(label, min, max).int("Use a whole number");
const optInt = (min = 0, max = 2_000_000_000) => z.number().int().min(min).max(max).nullish().transform((v) => v ?? null);
const slug = z
  .string({ error: "Enter a URL slug" })
  .trim()
  .min(1, "Enter a URL slug")
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only");
/** https:// or a site path — but not protocol-relative ("//host") or backslash ("/\host") URLs, which browsers treat as other hosts. */
const IMAGE_URL = /^(https:\/\/|\/(?![/\\]))/;
const url = z
  .string({ error: "Enter an image URL" })
  .trim()
  .min(1, "Enter an image URL")
  .max(500)
  .refine((v) => IMAGE_URL.test(v), "Use a full https:// URL or a /path on this site");
/** Optional text that stays a string ("" when empty) — for NOT NULL columns where "" means "not published". */
const blankText = (max = 200) => z.string().trim().max(max, "That's too long").default("");
const lines = z
  .array(z.string())
  .default([])
  .transform((a) => a.map((s) => s.trim()).filter(Boolean));
// Each entry is checked before blanks are dropped, so an error's index matches the row on screen.
const images = z
  .array(
    z
      .string()
      .trim()
      .max(500, "That URL is too long")
      .refine((v) => !v || IMAGE_URL.test(v), "Use a full https:// URL or a /path on this site"),
  )
  .transform((a) => a.filter(Boolean));
/** New-car models may be published without photos (the site shows a placeholder) until staff upload licensed ones. */
const optionalImages = images;
/** Used-car listings need at least one photo. */
const requiredImages = images.refine((a) => a.length > 0, "Add at least one photo");
const date = z.string({ error: "Choose a date" }).regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date");
const optDate = z
  .string()
  .nullish()
  .transform((v) => (v ? v : null))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable());
const bool = z.boolean().default(false);
const fuel = z.enum(FUEL_TYPES, { error: "Choose a fuel" });
const transmission = z.enum(["Manual", "Automatic", "AMT", "DCT", "CVT"], { error: "Choose a transmission" });
const bodyType = z.enum(["SUV", "Sedan", "Hatchback", "MUV", "Coupe"], { error: "Choose a body type" });
const publish = z.enum(PUBLISH_STATUS);

type Saved = ActionResult<{ id: string | number }>;

function done(path: string): void {
  expireCatalog();
  revalidatePath(path, "layout");
}

/** A brand's display name (including marques only sold pre-owned), for activity-log summaries. */
async function brandLabel(slug: string) {
  const [b] = await getDb().select({ name: brands.name }).from(brands).where(eq(brands.slug, slug));
  return b?.name ?? LEGACY_BRANDS[slug] ?? slug;
}
const verb = (isNew: boolean) => (isNew ? "Created" : "Updated");

const recordId = z.coerce.number().int().positive();

/* Record ids arrive from the client (bound to the action), so check them like any other input. null = create. */
const numericId = recordId.nullable();
const stringId = z.string().min(1).max(64).nullable();
const BAD_ID = { ok: false, error: "Invalid record." } as const;
const GONE = { ok: false, error: "This record no longer exists." } as const;

/* ── Brands ─────────────────────────────────────────────────── */

const brandSchema = z.object({
  name: text("name", 80),
  slug,
  country: text("country", 60),
  // 0 = not known (researched brands without a published founding year).
  founded: z.union([z.literal(0), int("founding year", 1800, 2100)], { error: "Enter a year between 1800 and 2100, or 0 if unknown" }),
  tagline: text("tagline", 160),
  description: text("description", 4000),
  // Optional: brands without a licensed hero photo show a plain graphite hero.
  heroImage: z
    .string()
    .trim()
    .max(500)
    .refine((v) => !v || IMAGE_URL.test(v), "Use a full https:// URL or a /path on this site")
    .default(""),
  isLuxury: bool,
  isActive: bool,
  sortOrder: int("sort order", -100000, 100000),
});

export async function saveBrandAction(recordKey: unknown, input: unknown): Promise<Saved> {
  const me = await requireStaff("catalogue");
  const rid = numericId.safeParse(recordKey);
  if (!rid.success) return BAD_ID;
  const id = rid.data;
  const parsed = brandSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const db = getDb();
  try {
    if (id) {
      const found = await db.transaction(async (tx) => {
        const [before] = await tx.select({ slug: brands.slug }).from(brands).where(eq(brands.id, id));
        // mysql2 reports matched rows (FOUND_ROWS), so an unchanged save still counts as found.
        const [res] = await tx.update(brands).set(parsed.data).where(eq(brands.id, id));
        if (!res.affectedRows || !before) return false;
        // Cars and launches follow via ON UPDATE CASCADE; used cars and dealers store the slug as text.
        if (before.slug !== parsed.data.slug) {
          await tx.update(usedCars).set({ brand: parsed.data.slug }).where(eq(usedCars.brand, before.slug));
          await tx.update(dealers).set({ brand: parsed.data.slug }).where(eq(dealers.brand, before.slug));
        }
        return true;
      });
      if (!found) return GONE;
      done("/admin/brands");
      await audit(me.id, "update", "brand", id, `Updated brand “${parsed.data.name}”`);
      return { ok: true, id };
    }
    const [res] = await db.insert(brands).values(parsed.data);
    done("/admin/brands");
    await audit(me.id, "create", "brand", res.insertId, `Created brand “${parsed.data.name}”`);
    return { ok: true, id: res.insertId };
  } catch (err) {
    if (isDuplicate(err)) return { ok: false, fieldErrors: { slug: "Another brand already uses this slug." } };
    throw err;
  }
}

export async function deleteBrandAction(id: unknown): Promise<ActionResult> {
  const me = await requireStaff("catalogue");
  const rid = recordId.safeParse(id);
  if (!rid.success) return { ok: false, error: "Invalid brand" };
  const [before] = await getDb().select({ name: brands.name }).from(brands).where(eq(brands.id, rid.data));
  try {
    await getDb().delete(brands).where(eq(brands.id, rid.data));
  } catch (err) {
    if (isInUse(err)) return { ok: false, error: "This brand still has cars or upcoming launches. Move or delete them first — or just hide the brand." };
    throw err;
  }
  done("/admin/brands");
  if (before) await audit(me.id, "delete", "brand", rid.data, `Deleted brand “${before.name}”`);
  return { ok: true };
}

/* ── New cars ───────────────────────────────────────────────── */

const variantSchema = z.object({
  name: text("variant name", 120),
  slug,
  fuel,
  transmission,
  price: int("price", 1),
  // "" when the maker doesn't publish a figure for the variant.
  efficiency: blankText(40),
  features: lines,
});

const carSchema = z
  .object({
    name: text("model name", 120),
    slug,
    brand: text("brand", 80),
    bodyType,
    status: publish,
    launchedOn: optDate,
    tagline: text("tagline"),
    // Empty for facts-only models (researched data, no editorial copy yet): the site then hides the editorial sections.
    overview: blankText(8000),
    isLuxury: bool,
    trending: bool,
    sortOrder: int("sort order", -100000, 100000),
    priceMin: int("starting price", 1),
    priceMax: int("top price", 1),
    fuelTypes: z.array(fuel).min(1, "Pick at least one fuel type"),
    transmissions: z.array(transmission).min(1, "Pick at least one transmission"),
    efficiency: blankText(60),
    efficiencyValue: num("efficiency figure", 0, 5000),
    engine: text("engine", 160),
    // Specs the maker doesn't publish are "" / 0 and show as "—" on the site.
    power: blankText(80),
    torque: blankText(80),
    seats: z.array(z.coerce.number().int().min(1).max(12)).min(1, "Pick the seating"),
    safetyRating: int("star rating", 0, 5),
    safetyAgency: z.enum(["Bharat NCAP", "Global NCAP", "Euro NCAP", "ASEAN NCAP", "Not tested"]),
    airbags: int("airbag count", 0, 16),
    bootSpace: int("boot space", 0, 5000),
    groundClearance: int("ground clearance", 0, 1000),
    fuelTank: optInt(0, 500),
    topSpeed: int("top speed", 0, 500),
    acceleration: blankText(40),
    // All four 0 = dimensions not published.
    dimensions: z
      .object({
        length: int("length", 0, 8000),
        width: int("width", 0, 3000),
        height: int("height", 0, 3000),
        wheelbase: int("wheelbase", 0, 5000),
      })
      .refine((d) => [d.length, d.width, d.height, d.wheelbase].every((n) => n === 0) || (d.length >= 1000 && d.width >= 1000 && d.height >= 800 && d.wheelbase >= 1000), {
        message: "Enter all four dimensions in mm, or leave all four at 0 if they aren't published",
      }),
    // Same key order as EvSpec, so re-saving unchanged specs stores identical JSON.
    ev: z
      .object({
        rangeKm: int("range", 1, 2000),
        batteryKwh: num("battery size", 1, 300),
        dcCharge: blankText(60),
        acCharge: blankText(60),
        motorKw: int("motor output", 0, 2000),
        rangeStandard: z
          .string()
          .trim()
          .max(30)
          .nullish()
          .transform((v) => v || undefined),
      })
      .nullable(),
    images: optionalImages,
    focus: optText(40),
    colors: z.array(z.object({ name: text("colour name", 60), hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #1A2B3C") })),
    variants: z.array(variantSchema).min(1, "Add at least one variant"),
    features: z.array(z.object({ group: z.enum(["Comfort", "Infotainment", "Safety", "Exterior", "Interior", "Performance"]), items: lines })),
    highlights: lines,
    pros: lines,
    cons: lines,
    expertScore: num("expert score", 0, 10),
    expertVerdict: blankText(8000),
    rating: num("owner rating", 0, 5),
    reviewCount: int("review count", 0),
    competitors: z.array(z.string().max(120)).default([]),
  })
  .superRefine((c, ctx) => {
    if (c.priceMax < c.priceMin) ctx.addIssue({ code: "custom", path: ["priceMax"], message: "Top price must be at least the starting price" });
    // The public site reads range/battery for every electric model, so they can't be missing.
    if (c.fuelTypes.includes("Electric") && !c.ev) ctx.addIssue({ code: "custom", path: ["ev"], message: "Add the electric specs for an EV" });
    const seen = new Set<string>();
    c.variants.forEach((v, i) => {
      if (seen.has(v.slug)) ctx.addIssue({ code: "custom", path: ["variants", i, "slug"], message: "Each variant needs its own slug" });
      seen.add(v.slug);
    });
  });

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

/** Owner reviews follow a slug change via ON UPDATE CASCADE; these store it as text or inside JSON. */
async function renameCarReferences(tx: Tx, from: string, to: string) {
  await tx.update(usedCars).set({ modelSlug: to }).where(eq(usedCars.modelSlug, from));
  await tx.update(articles).set({ relatedCar: to }).where(eq(articles.relatedCar, from));
  const rivals = await tx.select({ id: cars.id, competitors: cars.competitors }).from(cars).where(like(cars.competitors, `%"${from}"%`));
  for (const r of rivals) {
    await tx
      .update(cars)
      .set({ competitors: r.competitors.map((c) => (c === from ? to : c)) })
      .where(eq(cars.id, r.id));
  }
}

export async function saveCarAction(recordKey: unknown, input: unknown): Promise<Saved> {
  const me = await requireStaff("catalogue");
  const rid = numericId.safeParse(recordKey);
  if (!rid.success) return BAD_ID;
  const id = rid.data;
  const parsed = carSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { variants: variantRows, competitors, ...car } = parsed.data;
  const db = getDb();
  const [brand] = await db.select({ slug: brands.slug, name: brands.name }).from(brands).where(eq(brands.slug, car.brand));
  if (!brand) return { ok: false, fieldErrors: { brand: "Choose a brand" } };
  const values = { ...car, competitors: competitors.filter((s) => s !== car.slug), features: car.features.filter((g) => g.items.length) };

  try {
    const carId = await db.transaction(async (tx) => {
      let cid = id;
      if (cid) {
        const [before] = await tx.select({ slug: cars.slug }).from(cars).where(eq(cars.id, cid));
        const [res] = await tx.update(cars).set(values).where(eq(cars.id, cid));
        if (!res.affectedRows || !before) return null;
        if (before.slug !== values.slug) await renameCarReferences(tx, before.slug, values.slug);
      } else cid = (await tx.insert(cars).values(values))[0].insertId;
      await tx.delete(variants).where(eq(variants.carId, cid));
      await tx.insert(variants).values(variantRows.map((v, i) => ({ ...v, carId: cid!, sortOrder: i })));
      return cid;
    });
    if (!carId) return GONE;
    done("/admin/cars");
    await audit(me.id, id ? "update" : "create", "car", carId, `${verb(!id)} car “${brand.name} ${car.name}”`);
    return { ok: true, id: carId };
  } catch (err) {
    if (isDuplicate(err)) return { ok: false, fieldErrors: { slug: "Another car already uses this slug." } };
    throw err;
  }
}

export async function deleteCarAction(id: unknown): Promise<ActionResult> {
  const me = await requireStaff("catalogue");
  const rid = recordId.safeParse(id);
  if (!rid.success) return { ok: false, error: "Invalid car" };
  const [before] = await getDb().select({ name: cars.name, brand: cars.brand }).from(cars).where(eq(cars.id, rid.data));
  await getDb().delete(cars).where(eq(cars.id, rid.data));
  done("/admin/cars");
  if (before) await audit(me.id, "delete", "car", rid.data, `Deleted car “${await brandLabel(before.brand)} ${before.name}”`);
  return { ok: true };
}

/* ── Upcoming launches ──────────────────────────────────────── */

const upcomingSchema = z
  .object({
    name: text("model name", 120),
    slug,
    brand: text("brand", 80),
    status: publish,
    bodyType,
    fuel,
    expectedLaunch: text("expected launch", 40),
    sortOrder: int("sort order", -100000, 100000),
    priceMin: int("price from", 1),
    priceMax: int("price to", 1),
    image: url,
    teaser: text("teaser", 4000),
    highlights: lines,
  })
  .refine((u) => u.priceMax >= u.priceMin, { path: ["priceMax"], message: "Must be at least the price from" });

export async function saveUpcomingAction(recordKey: unknown, input: unknown): Promise<Saved> {
  const me = await requireStaff("catalogue");
  const rid = numericId.safeParse(recordKey);
  if (!rid.success) return BAD_ID;
  let id = rid.data;
  const parsed = upcomingSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const db = getDb();
  try {
    if (id) {
      const [res] = await db.update(upcomingCars).set(parsed.data).where(eq(upcomingCars.id, id));
      if (!res.affectedRows) return GONE;
    } else id = (await db.insert(upcomingCars).values(parsed.data))[0].insertId;
  } catch (err) {
    if (isDuplicate(err)) return { ok: false, fieldErrors: { slug: "Another launch already uses this slug." } };
    if (isMissingParent(err)) return { ok: false, fieldErrors: { brand: "Choose a brand" } };
    throw err;
  }
  done("/admin/upcoming");
  await audit(me.id, rid.data ? "update" : "create", "upcoming", id, `${verb(!rid.data)} upcoming launch “${await brandLabel(parsed.data.brand)} ${parsed.data.name}”`);
  return { ok: true, id };
}

export async function deleteUpcomingAction(id: unknown): Promise<ActionResult> {
  const me = await requireStaff("catalogue");
  const rid = recordId.safeParse(id);
  if (!rid.success) return { ok: false, error: "Invalid launch" };
  const [before] = await getDb().select({ name: upcomingCars.name, brand: upcomingCars.brand }).from(upcomingCars).where(eq(upcomingCars.id, rid.data));
  await getDb().delete(upcomingCars).where(eq(upcomingCars.id, rid.data));
  done("/admin/upcoming");
  if (before) await audit(me.id, "delete", "upcoming", rid.data, `Deleted upcoming launch “${await brandLabel(before.brand)} ${before.name}”`);
  return { ok: true };
}

/* ── Used cars ──────────────────────────────────────────────── */

const usedSchema = z.object({
  status: z.enum(USED_STATUS),
  postedOn: date,
  price: int("asking price", 1),
  newPrice: optInt(1),
  verified: bool,
  inspectionScore: int("inspection score", 0, 100),
  brand: text("brand", 80),
  modelSlug: optText(120),
  name: text("model name", 120),
  variant: text("variant", 120),
  year: int("year", 1990, 2100),
  km: int("kilometres", 0, 2_000_000),
  fuel,
  transmission,
  bodyType,
  owners: int("number of owners", 1, 10),
  color: text("colour", 60),
  city: text("city", 64),
  registration: text("registration", 40),
  insurance: text("insurance", 80),
  highlights: lines,
  images: requiredImages,
  focus: optText(40),
  sellerType: z.enum(["Dealer", "Individual"]),
  sellerName: text("seller name", 120),
  dealerId: optText(64),
});

export async function saveUsedCarAction(recordKey: unknown, input: unknown): Promise<Saved> {
  const me = await requireStaff("catalogue");
  const rid = stringId.safeParse(recordKey);
  if (!rid.success) return BAD_ID;
  let id = rid.data;
  const parsed = usedSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const db = getDb();
  try {
    if (id) {
      const [res] = await db.update(usedCars).set(parsed.data).where(eq(usedCars.id, id));
      if (!res.affectedRows) return GONE;
    } else {
      id = `uc-${Date.now().toString(36).slice(-4)}${randomInt(36 ** 3).toString(36).padStart(3, "0")}`;
      await db.insert(usedCars).values({ ...parsed.data, id });
    }
  } catch (err) {
    if (isMissingParent(err)) return { ok: false, fieldErrors: { dealerId: "That dealer no longer exists — choose another." } };
    throw err;
  }
  done("/admin/used-cars");
  const u = parsed.data;
  await audit(me.id, rid.data ? "update" : "create", "used_car", id, `${verb(!rid.data)} used car “${u.year} ${await brandLabel(u.brand)} ${u.name} ${u.variant}” (${id})`);
  return { ok: true, id };
}

export async function deleteUsedCarAction(id: unknown): Promise<ActionResult> {
  const me = await requireStaff("catalogue");
  const rid = z.string().min(1).max(64).safeParse(id);
  if (!rid.success) return { ok: false, error: "Invalid listing" };
  const [before] = await getDb().select({ year: usedCars.year, brand: usedCars.brand, name: usedCars.name }).from(usedCars).where(eq(usedCars.id, rid.data));
  await getDb().delete(usedCars).where(eq(usedCars.id, rid.data));
  done("/admin/used-cars");
  if (before) await audit(me.id, "delete", "used_car", rid.data, `Deleted used car “${before.year} ${await brandLabel(before.brand)} ${before.name}” (${rid.data})`);
  return { ok: true };
}

/* ── Dealers ────────────────────────────────────────────────── */

const dealerSchema = z.object({
  name: text("name", 120),
  id: slug,
  brand: text("brand", 80),
  city: text("city", 64),
  area: text("area", 120),
  established: int("year", 1900, 2100),
  address: text("address", 300),
  phone: text("phone", 30),
  email: z.string().trim().max(190).email("Enter a valid email address"),
  hours: text("opening hours", 120),
  image: url,
  services: lines,
  rating: num("rating", 0, 5),
  reviewCount: int("review count", 0),
  distanceKm: num("distance", 0, 500),
  sortOrder: int("sort order", -100000, 100000),
  usedInventory: bool,
  isActive: bool,
  // Same key order as DealerProfileData, so re-saving an unchanged profile stores identical JSON.
  profile: z
    .object({
      about: text("about text", 4000),
      facilities: lines,
      showroomArea: text("showroom area", 40),
      serviceBays: int("service bays", 0, 500),
      languages: lines,
      bearing: int("bearing", 0, 359),
    })
    .nullable(),
});

export async function saveDealerAction(recordKey: unknown, input: unknown): Promise<Saved> {
  const me = await requireStaff("catalogue");
  const rid = stringId.safeParse(recordKey);
  if (!rid.success) return BAD_ID;
  const id = rid.data;
  const parsed = dealerSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const db = getDb();
  try {
    if (id) {
      const [res] = await db.update(dealers).set(parsed.data).where(eq(dealers.id, id));
      if (!res.affectedRows) return GONE;
    } else await db.insert(dealers).values(parsed.data);
  } catch (err) {
    if (isDuplicate(err)) return { ok: false, fieldErrors: { id: "Another dealer already uses this ID." } };
    throw err;
  }
  done("/admin/showrooms");
  await audit(me.id, id ? "update" : "create", "dealer", parsed.data.id, `${verb(!id)} dealer “${parsed.data.name}”`);
  return { ok: true, id: parsed.data.id };
}

export async function deleteDealerAction(id: unknown): Promise<ActionResult> {
  const me = await requireStaff("catalogue");
  const rid = z.string().min(1).max(64).safeParse(id);
  if (!rid.success) return { ok: false, error: "Invalid dealer" };
  const [before] = await getDb().select({ name: dealers.name }).from(dealers).where(eq(dealers.id, rid.data));
  await getDb().delete(dealers).where(eq(dealers.id, rid.data));
  done("/admin/showrooms");
  if (before) await audit(me.id, "delete", "dealer", rid.data, `Deleted dealer “${before.name}”`);
  return { ok: true };
}

/* ── Articles & authors ─────────────────────────────────────── */

const articleSchema = z.object({
  title: text("headline", 255),
  slug,
  category: z.enum(["News", "Expert Review", "First Drive", "Industry", "Electric", "Video", "Ownership"]),
  dek: text("standfirst", 1000),
  body: lines.pipe(z.array(z.string()).min(1, "Write the story")),
  pullQuote: optText(1000),
  status: publish,
  publishedOn: date,
  authorId: text("author", 64),
  readMinutes: int("reading time", 1, 60),
  image: url,
  relatedCar: optText(120),
  videoDuration: optText(16),
  tags: lines,
});

export async function saveArticleAction(recordKey: unknown, input: unknown): Promise<Saved> {
  const me = await requireStaff("content");
  const rid = numericId.safeParse(recordKey);
  if (!rid.success) return BAD_ID;
  let id = rid.data;
  const parsed = articleSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const db = getDb();
  try {
    if (id) {
      const [res] = await db.update(articles).set(parsed.data).where(eq(articles.id, id));
      if (!res.affectedRows) return GONE;
    } else id = (await db.insert(articles).values(parsed.data))[0].insertId;
  } catch (err) {
    if (isDuplicate(err)) return { ok: false, fieldErrors: { slug: "Another story already uses this slug." } };
    if (isMissingParent(err)) return { ok: false, fieldErrors: { authorId: "Choose an author" } };
    throw err;
  }
  done("/admin/news");
  await audit(me.id, rid.data ? "update" : "create", "article", id, `${verb(!rid.data)} story “${parsed.data.title}”`);
  return { ok: true, id };
}

export async function deleteArticleAction(id: unknown): Promise<ActionResult> {
  const me = await requireStaff("content");
  const rid = recordId.safeParse(id);
  if (!rid.success) return { ok: false, error: "Invalid story" };
  const [before] = await getDb().select({ title: articles.title }).from(articles).where(eq(articles.id, rid.data));
  await getDb().delete(articles).where(eq(articles.id, rid.data));
  done("/admin/news");
  if (before) await audit(me.id, "delete", "article", rid.data, `Deleted story “${before.title}”`);
  return { ok: true };
}

const authorSchema = z.object({
  name: text("name", 120),
  id: slug.max(64),
  role: text("role", 120),
  bio: optText(2000),
  beat: optText(160),
  base: optText(80),
  joined: optInt(1950, 2100),
});

export async function saveAuthorAction(recordKey: unknown, input: unknown): Promise<Saved> {
  const me = await requireStaff("content");
  const rid = stringId.safeParse(recordKey);
  if (!rid.success) return BAD_ID;
  const id = rid.data;
  const parsed = authorSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const db = getDb();
  if (!id || id !== parsed.data.id) {
    const [taken] = await db
      .select({ id: authors.id })
      .from(authors)
      .where(id ? and(eq(authors.id, parsed.data.id), ne(authors.id, id)) : eq(authors.id, parsed.data.id));
    if (taken) return { ok: false, fieldErrors: { id: "Another author already uses this ID." } };
  }
  try {
    if (id) {
      const [res] = await db.update(authors).set(parsed.data).where(eq(authors.id, id));
      if (!res.affectedRows) return GONE;
    } else await db.insert(authors).values(parsed.data);
  } catch (err) {
    // Two saves racing for the same new ID.
    if (isDuplicate(err)) return { ok: false, fieldErrors: { id: "Another author already uses this ID." } };
    throw err;
  }
  done("/admin/authors");
  await audit(me.id, id ? "update" : "create", "author", parsed.data.id, `${verb(!id)} author “${parsed.data.name}”`);
  return { ok: true, id: parsed.data.id };
}

export async function deleteAuthorAction(id: unknown): Promise<ActionResult> {
  const me = await requireStaff("content");
  const rid = z.string().min(1).max(64).safeParse(id);
  if (!rid.success) return { ok: false, error: "Invalid author" };
  const [before] = await getDb().select({ name: authors.name }).from(authors).where(eq(authors.id, rid.data));
  try {
    await getDb().delete(authors).where(eq(authors.id, rid.data));
  } catch (err) {
    if (isInUse(err)) return { ok: false, error: "This author still has stories. Reassign them first." };
    throw err;
  }
  done("/admin/authors");
  if (before) await audit(me.id, "delete", "author", rid.data, `Deleted author “${before.name}”`);
  return { ok: true };
}
