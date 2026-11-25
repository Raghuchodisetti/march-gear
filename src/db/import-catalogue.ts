/**
 * Loads the researched new-car catalogue (src/db/catalogue-data/brands/<brand>.json) into MySQL.
 * Idempotent — run it again whenever a brand file is added or corrected.
 *
 *   npm run db:import-catalogue                          every brand file
 *   npm run db:import-catalogue -- --brand kia           one brand (repeat --brand, or kia,tata)
 *   npm run db:import-catalogue -- --dry-run             do everything in a transaction, report, roll back
 *   npm run db:import-catalogue -- --dir <folder>        read brand files from another folder (testing)
 *
 * Only `brands`, `cars` and `variants` are written:
 * - Brands by slug. New brands get the researched copy and no hero image (the site shows a placeholder);
 *   existing brands keep their copy and image, and only an empty country / founding year is filled in.
 * - Cars by slug. Every factual field is refreshed from the research (prices, fuels, gearboxes, specs,
 *   safety, EV specs, colours, features, highlights, launch date, sources). Photos, ratings, scores,
 *   reviews, overview, verdict, pros/cons, trending and status are never touched. New models are
 *   published facts-only: no photos, no ratings, a factual tagline and price-overlap rivals.
 *   For facts-only models (no overview and no verdict) the tagline and rivals are recomputed each run.
 * - Variants by (car, slug); a variant whose name matches an existing one keeps its slug, so links survive.
 *   Variants no longer in the research are deleted unless something references them (dealer stock,
 *   dealer brand authorisations, offers, customer garages, insurance enquiries) — those are kept and reported.
 * - Models in the database that no research file lists are left alone and reported (possibly discontinued).
 *
 * The running site caches the catalogue for up to an hour: save anything in /admin or restart `npm run dev`.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { closeDb, getDb } from "./index";
import * as s from "./schema";
import { brandFileSchema, FUELS, TRANSMISSIONS, type BrandFile, type CatalogueModel } from "./catalogue-data/schema";
import type { BodyType, CarColor, Dimensions, EvSpec, FeatureGroup, FuelType, Transmission } from "@/types";
import { variantSlugOf } from "@/lib/catalog";

/* ── Arguments ──────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const argValues = (flag: string) => argv.flatMap((a, i) => (a === flag && argv[i + 1] ? argv[i + 1].split(",") : [])).map((x) => x.trim()).filter(Boolean);
const ONLY = new Set(argValues("--brand"));
const DIR = argValues("--dir")[0] ?? path.join(process.cwd(), "src", "db", "catalogue-data", "brands");

/* ── Helpers ────────────────────────────────────────────────── */

const NO_DIMENSIONS: Dimensions = { length: 0, width: 0, height: 0, wheelbase: 0 };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const nameKey = (v: string) => v.toLowerCase().replace(/\+/g, "plus").replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
const lakh = (n: number) => `₹${(n / 100_000).toFixed(2)} L`;

/** Same as the site's variantSlugOf, so the browser can rebuild most slugs instead of receiving them. */
const slugOf = variantSlugOf;

/** "Hyundai Creta" → "Creta" (the site always prints the brand before the model). */
function stripBrand(model: string, brandName: string) {
  const names = [brandName, brandName.split(/[\s-]/)[0]].filter((n) => n.length > 2);
  for (const n of names) {
    const re = new RegExp(`^${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s-]+`, "i");
    if (re.test(model) && model.replace(re, "").trim()) return model.replace(re, "").trim();
  }
  return model;
}

/** Brand styling in capitals ("CRETA N Line", "IONIQ 5") in the site's title case; short acronyms (GLA, XUV, EV) stay. */
const titleCaseWords = (name: string) => name.replace(/\b[A-Z]{4,}\b/g, (w) => w[0] + w.slice(1).toLowerCase());

/* Variant name similarity, to carry an old variant's slug (and so its links) over to its researched twin. */
const GENERIC = new Set(["petrol", "diesel", "cng", "hybrid", "electric", "ev", "mt", "at", "amt", "ags", "dct", "dca", "dsg", "cvt", "ivt", "ecvt", "manual", "automatic", "kwh"]);
/** Words a researched name may add without changing the trim: engine, gearbox, drive and battery detail. */
const DETAIL = new Set(["turbo", "mpi", "gdi", "tgdi", "crdi", "tdi", "tsi", "tfsi", "awd", "rwd", "fwd", "lr", "mr", "sr", "cng", "icng", "edrive", "drive", "seater"]);
const tokens = (name: string) =>
  name
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/s-cng/g, "cng")
    .replace(/e-(cvt|drive)/g, "e$1")
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !GENERIC.has(t) && !/^\d$/.test(t));
/**
 * How well a researched variant name `b` continues an old name `a`: 0 unless it starts with the same trim word and
 * keeps every word of the old name (it may only add detail: "Era" → "Era MT", "ZXi AMT" → "ZXi AGS"), otherwise the
 * share of words in common. "Taycan Turbo S" → "Taycan Turbo" or "Accomplished+ S" → "Accomplished S" don't match.
 */
function similarity(a: string, b: string) {
  const x = tokens(a);
  const y = tokens(b);
  if (!x.length || !y.length || x[0] !== y[0]) return 0;
  const xs = new Set(x);
  const ys = new Set(y);
  if (![...xs].every((t) => ys.has(t))) return 0;
  // What the new name adds must be detail (a digit, or engine/drive words) — "Creative" → "Creative+" or "Premium" → "Premium(O)" is another trim.
  if (![...ys].filter((t) => !xs.has(t)).every((t) => /\d/.test(t) || DETAIL.has(t))) return 0;
  return xs.size / new Set([...xs, ...ys]).size;
}

const fmtNum = (n: number) => String(Number(n.toFixed(2)));

/** A published efficiency figure: "20.1 kmpl", "26.5 km/kg", "502 km". */
function parseEfficiency(v: string | null): { value: number; unit: "kmpl" | "km/kg" | "km" } | null {
  if (!v) return null;
  const m = v.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(kmpl|km\s*\/\s*l(?:itre)?|km\s*\/\s*kg|km)\b/i);
  if (!m) return null;
  const unit = /kg/i.test(m[2]) ? "km/kg" : /kmpl|\/\s*l/i.test(m[2]) ? "kmpl" : "km";
  return { value: Number(m[1]), unit };
}

const range = (values: number[], unit: string) => {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return lo === hi ? `${fmtNum(hi)} ${unit}` : `${fmtNum(lo)} – ${fmtNum(hi)} ${unit}`;
};

/** The model's display efficiency and its sort figure (best claimed kmpl, or km of range for EVs; 0 if none). */
function efficiencyOf(m: CatalogueModel): { efficiency: string; efficiencyValue: number } {
  const figures = m.variants.map((v) => ({ fuel: v.fuel, f: parseEfficiency(v.efficiency) }));
  const allElectric = m.variants.every((v) => v.fuel === "Electric");
  if (allElectric) {
    const km = [...figures.filter((x) => x.f?.unit === "km").map((x) => x.f!.value), ...(m.ev ? [m.ev.rangeKm] : [])];
    if (!km.length) return { efficiency: "", efficiencyValue: 0 };
    const best = Math.max(...km);
    return { efficiency: `Up to ${fmtNum(best)} km`, efficiencyValue: best };
  }
  const kmpl = figures.filter((x) => x.fuel !== "Electric" && x.f?.unit === "kmpl").map((x) => x.f!.value);
  const kmkg = figures.filter((x) => x.f?.unit === "km/kg").map((x) => x.f!.value);
  const parts: string[] = [];
  if (kmpl.length) parts.push(range(kmpl, "kmpl"));
  if (kmkg.length) parts.push(kmpl.length ? `${range(kmkg, "km/kg")} CNG` : range(kmkg, "km/kg"));
  const value = kmpl.length ? Math.max(...kmpl) : kmkg.length ? Math.max(...kmkg) : 0;
  return { efficiency: parts.join(" · ").slice(0, 60), efficiencyValue: value };
}

const ordered = <T extends string>(order: readonly T[], values: T[]) => order.filter((x) => values.includes(x));

function seatsLabel(seats: number[]) {
  const u = [...new Set(seats)].sort((a, b) => a - b);
  if (u.length === 1) return `${u[0]} seats`;
  if (u.length === 2) return `${u[0]} or ${u[1]} seats`;
  return `${u[0]} – ${u[u.length - 1]} seats`;
}

/** A factual one-liner for models without editorial copy: "SUV · petrol, diesel · 5 seats". */
function factualTagline(m: CatalogueModel, fuels: FuelType[]) {
  const body = m.bodyStyle ?? m.bodyType;
  const fuelText = fuels.map((f) => (f === "CNG" ? "CNG" : f.toLowerCase())).join(", ");
  return [body, fuelText, seatsLabel(m.seats)].join(" · ").slice(0, 200);
}

const evSpecOf = (m: CatalogueModel): EvSpec | null =>
  m.ev
    ? {
        rangeKm: m.ev.rangeKm,
        batteryKwh: m.ev.batteryKwh,
        dcCharge: m.ev.dcCharge ?? "",
        acCharge: m.ev.acCharge ?? "",
        motorKw: m.ev.motorKw ?? 0,
        ...(m.ev.rangeStandard ? { rangeStandard: m.ev.rangeStandard } : {}),
      }
    : null;

/** The researched facts in the cars table's shape (NOT NULL columns get neutral "not published" values). */
function factsOf(m: CatalogueModel, file: BrandFile, brandName: string) {
  const prices = m.variants.map((v) => v.price);
  const fuelTypes = ordered<FuelType>(FUELS, m.variants.map((v) => v.fuel));
  const transmissions = ordered<Transmission>(TRANSMISSIONS, m.variants.map((v) => v.transmission));
  return {
    name: titleCaseWords(stripBrand(m.name, brandName)),
    bodyType: m.bodyType as BodyType,
    isLuxury: m.isLuxury,
    priceMin: Math.min(...prices),
    priceMax: Math.max(...prices),
    fuelTypes,
    transmissions,
    ...efficiencyOf(m),
    engine: m.engine,
    power: m.power ?? "",
    torque: m.torque ?? "",
    seats: [...new Set(m.seats)].sort((a, b) => a - b),
    safetyRating: m.safety?.rating ?? 0,
    safetyAgency: m.safety?.agency ?? "Not tested",
    airbags: m.airbags ?? 0,
    bootSpace: m.bootSpaceL ?? 0,
    groundClearance: m.groundClearanceMm ?? 0,
    fuelTank: m.fuelTankL ?? null,
    topSpeed: m.topSpeedKmh ?? 0,
    acceleration: m.acceleration ?? "",
    dimensions: m.dimensions ?? NO_DIMENSIONS,
    colors: m.colors as CarColor[],
    highlights: m.highlights,
    features: m.features as FeatureGroup[],
    ev: evSpecOf(m),
    launchedOn: m.launchedOn,
    sources: m.sources,
    dataAsOf: file.asOf,
    priceCity: file.priceCity,
  };
}
type Facts = ReturnType<typeof factsOf>;

/* ── Report ─────────────────────────────────────────────────── */

const report = {
  files: { read: 0, invalid: [] as string[] },
  brands: { inserted: [] as string[], updated: [] as string[], unchanged: 0 },
  cars: { inserted: [] as string[], updated: [] as string[], unchanged: 0, skipped: [] as string[], renamed: [] as string[] },
  variants: { inserted: 0, updated: 0, unchanged: 0, deleted: [] as string[], kept: [] as string[], matched: [] as string[] },
  rivals: { updated: 0 },
  notInResearch: [] as string[],
  brandFilesMissing: [] as string[],
  dataNotes: [] as string[],
};

/* ── Variant references (never delete what something points at) ─ */

type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** "carSlug/variantSlug" → where it's used. */
async function variantReferences(db: Db | Tx) {
  const refs = new Map<string, string[]>();
  const add = (car: string | null | undefined, variant: string | null | undefined, where: string) => {
    if (!car || !variant) return;
    const key = `${car}/${variant}`;
    const list = refs.get(key) ?? [];
    if (!list.includes(where)) list.push(where);
    refs.set(key, list);
  };
  const [vehicles, authorisations, offers, garages, enquiries] = await Promise.all([
    db.select({ modelSlug: s.partnerVehicles.modelSlug, kind: s.partnerVehicles.kind, used: s.partnerVehicles.used }).from(s.partnerVehicles).where(isNotNull(s.partnerVehicles.modelSlug)),
    db.select({ variants: s.partnerBrands.variants }).from(s.partnerBrands),
    db.select({ scope: s.partnerOffers.scope }).from(s.partnerOffers),
    db.select({ model: s.customerVehicles.model, variant: s.customerVehicles.variant }).from(s.customerVehicles).where(isNotNull(s.customerVehicles.variant)),
    db.select({ model: s.insEnquiries.model, variant: s.insEnquiries.variant }).from(s.insEnquiries).where(isNotNull(s.insEnquiries.variant)),
  ]);
  for (const v of vehicles) if (v.kind === "new" && v.used && "variantSlug" in v.used) add(v.modelSlug, v.used.variantSlug, "dealer stock");
  for (const a of authorisations) for (const key of a.variants ?? []) add(key.split("/")[0], key.split("/")[1], "dealer brand authorisation");
  for (const o of offers) for (const key of o.scope?.variants ?? []) add(key.split("/")[0], key.split("/")[1], "dealer offer");
  for (const g of garages) add(g.model, g.variant, "customer garage");
  for (const e of enquiries) add(e.model, e.variant, "insurance enquiry");
  return refs;
}

/* ── Import one brand ───────────────────────────────────────── */

async function importBrand(tx: Tx, file: BrandFile, refs: Map<string, string[]>, factsOnlySlugs: Set<string>, researchedSlugs: Set<string>) {
  const b = file.brand;
  const [existingBrand] = await tx.select().from(s.brands).where(eq(s.brands.slug, b.slug));
  let brandName = b.name;
  if (!existingBrand) {
    const sorts = await tx.select({ sort: s.brands.sortOrder }).from(s.brands);
    const maxSort = sorts.reduce((m, r) => Math.max(m, r.sort), 0);
    await tx.insert(s.brands).values({
      slug: b.slug,
      name: b.name,
      country: b.country,
      founded: b.founded ?? 0,
      tagline: b.tagline,
      description: b.description,
      heroImage: "",
      isLuxury: b.isLuxury,
      isActive: true,
      sortOrder: Math.max(maxSort + 1, 100),
    });
    report.brands.inserted.push(b.slug);
  } else {
    brandName = existingBrand.name;
    const patch: Partial<typeof s.brands.$inferInsert> = {};
    if (!existingBrand.country.trim()) patch.country = b.country;
    if (!existingBrand.founded && b.founded) patch.founded = b.founded;
    if (Object.keys(patch).length) {
      await tx.update(s.brands).set(patch).where(eq(s.brands.id, existingBrand.id));
      report.brands.updated.push(`${b.slug} (${Object.keys(patch).join(", ")})`);
    } else report.brands.unchanged++;
  }

  const existingCars = await tx.select().from(s.cars);
  const bySlug = new Map(existingCars.map((c) => [c.slug, c]));
  const brandCars = existingCars.filter((c) => c.brand === b.slug);
  const maxSort = existingCars.reduce((m, c) => Math.max(m, c.sortOrder), 0);
  let nextSort = Math.max(maxSort + 1, 100);

  for (const m of file.models) {
    const facts = factsOf(m, file, brandName);
    const existing = bySlug.get(m.slug);
    if (existing && existing.brand !== b.slug) {
      report.cars.skipped.push(`${m.slug}: already in the database under brand "${existing.brand}"`);
      continue;
    }
    if (!existing) {
      // Same model under another slug (e.g. "maruti-suzuki-swift" vs "maruti-swift") would make a duplicate page.
      // Models the research lists under their own slug are being refreshed (and may be renamed), so they don't count.
      const twin = brandCars.find((c) => nameKey(c.name) === nameKey(facts.name) && c.slug !== m.slug && !researchedSlugs.has(c.slug));
      if (twin) {
        report.cars.skipped.push(`${m.slug}: "${facts.name}" already exists as ${twin.slug} — use that slug in ${b.slug}.json`);
        continue;
      }
    }

    let carId: number;
    if (!existing) {
      const [res] = await tx.insert(s.cars).values({
        slug: m.slug,
        brand: b.slug,
        ...facts,
        rating: 0,
        reviewCount: 0,
        images: [],
        focus: null,
        tagline: factualTagline(m, facts.fuelTypes),
        overview: "",
        pros: [],
        cons: [],
        expertScore: 0,
        expertVerdict: "",
        competitors: [],
        trending: false,
        status: "published",
        sortOrder: nextSort++,
      });
      carId = res.insertId;
      factsOnlySlugs.add(m.slug);
      report.cars.inserted.push(m.slug);
    } else {
      carId = existing.id;
      const factsOnly = !existing.overview.trim() && !existing.expertVerdict.trim();
      if (factsOnly) factsOnlySlugs.add(m.slug);
      // Same name in other styling ("Nexon EV" / "Nexon.ev", "Creta" / "CRETA") keeps the site's spelling.
      const name = nameKey(existing.name) === nameKey(facts.name) ? existing.name : facts.name;
      const next: Partial<Facts> & { tagline?: string } = { ...facts, name, ...(factsOnly ? { tagline: factualTagline(m, facts.fuelTypes) } : {}) };
      const changed = (Object.keys(next) as (keyof typeof next)[]).filter((k) => !same(existing[k as keyof typeof existing] ?? null, next[k] ?? null));
      if (changed.length) {
        await tx.update(s.cars).set(next).where(eq(s.cars.id, carId));
        report.cars.updated.push(`${m.slug} (${changed.length > 6 ? `${changed.length} fields` : changed.join(", ")})`);
        if (existing.name !== name) report.cars.renamed.push(`${m.slug}: "${existing.name}" → "${name}"`);
      } else report.cars.unchanged++;
    }

    await importVariants(tx, carId, m, refs);
  }
}

async function importVariants(tx: Tx, carId: number, m: CatalogueModel, refs: Map<string, string[]>) {
  const current = await tx.select().from(s.variants).where(eq(s.variants.carId, carId));
  const byName = new Map(current.map((v) => [nameKey(v.name), v]));
  const claimed = new Set<string>();
  const sorted = [...m.variants].sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
  const keepIds = new Set<number>();

  // Existing variants whose name no longer appears keep their slug on their closest researched twin
  // (same fuel and gearbox, same trim name first, most words in common), so dealer stock, garages and
  // enquiries that point at them follow the real variant instead of a stale row.
  const exact = new Set(sorted.filter((rv) => byName.has(nameKey(rv.name))).map((rv) => rv.name));
  const usedSlugs = new Set(sorted.flatMap((rv) => (byName.has(nameKey(rv.name)) ? [byName.get(nameKey(rv.name))!.slug] : [])));
  // Only variants something points at: an unreferenced old variant is simply removed.
  const orphans = current.filter((v) => !usedSlugs.has(v.slug) && refs.has(`${m.slug}/${v.slug}`));
  const pairs = orphans
    .flatMap((v) =>
      sorted
        .filter((rv) => !exact.has(rv.name) && rv.fuel === v.fuel && rv.transmission === v.transmission)
        .map((rv) => ({ v, rv, score: similarity(v.name, rv.name) })),
    )
    .filter((x) => x.score >= 0.34)
    .sort((a, b) => b.score - a.score || Math.abs(a.rv.price - a.v.price) - Math.abs(b.rv.price - b.v.price));
  const fuzzy = new Map<string, (typeof current)[number]>();
  const taken = new Set<number>();
  for (const { v, rv } of pairs) {
    if (taken.has(v.id) || fuzzy.has(rv.name)) continue;
    taken.add(v.id);
    fuzzy.set(rv.name, v);
  }

  for (const [i, rv] of sorted.entries()) {
    // A variant with the same name keeps its slug (and so its links); so does the closest twin of a renamed one; otherwise slugify the name.
    const twin = byName.get(nameKey(rv.name)) ?? fuzzy.get(rv.name);
    if (twin && fuzzy.get(rv.name) === twin) report.variants.matched.push(`${m.slug}/${twin.slug}: "${twin.name}" → "${rv.name}"`);
    let slug = twin && !claimed.has(twin.slug) ? twin.slug : slugOf(rv.name);
    if (claimed.has(slug)) {
      let n = 2;
      while (claimed.has(`${slug}-${n}`)) n++;
      slug = `${slug}-${n}`;
    }
    claimed.add(slug);
    const row = { slug, name: rv.name, fuel: rv.fuel as FuelType, transmission: rv.transmission as Transmission, price: rv.price, efficiency: rv.efficiency ?? "", features: rv.features, sortOrder: i };
    const found = current.find((v) => v.slug === slug);
    if (found) {
      keepIds.add(found.id);
      if ((Object.keys(row) as (keyof typeof row)[]).every((k) => same(found[k], row[k]))) report.variants.unchanged++;
      else {
        await tx.update(s.variants).set(row).where(eq(s.variants.id, found.id));
        report.variants.updated++;
      }
    } else {
      const [res] = await tx.insert(s.variants).values({ ...row, carId });
      keepIds.add(res.insertId);
      report.variants.inserted++;
    }
  }

  const stale = current.filter((v) => !keepIds.has(v.id));
  const del: number[] = [];
  let tail = sorted.length;
  for (const v of stale) {
    const usedBy = refs.get(`${m.slug}/${v.slug}`);
    if (usedBy) {
      report.variants.kept.push(`${m.slug}/${v.slug} "${v.name}" ${lakh(v.price)} — used by ${usedBy.join(", ")}`);
      if (v.sortOrder !== tail) await tx.update(s.variants).set({ sortOrder: tail }).where(eq(s.variants.id, v.id));
      tail++;
    } else {
      del.push(v.id);
      report.variants.deleted.push(`${m.slug}/${v.slug}`);
    }
  }
  if (del.length) await tx.delete(s.variants).where(and(eq(s.variants.carId, carId), inArray(s.variants.id, del)));
}

/* ── Rivals for facts-only models: same body type, most price overlap ─ */

async function recomputeRivals(tx: Tx, factsOnlySlugs: Set<string>) {
  const rows = await tx
    .select({ id: s.cars.id, slug: s.cars.slug, bodyType: s.cars.bodyType, priceMin: s.cars.priceMin, priceMax: s.cars.priceMax, overview: s.cars.overview, expertVerdict: s.cars.expertVerdict, competitors: s.cars.competitors, status: s.cars.status })
    .from(s.cars);
  const published = rows.filter((r) => r.status === "published");
  // Compare on a log scale (₹10 L vs ₹12 L is as close as ₹1 Cr vs ₹1.2 Cr); a single price counts as ±3%.
  // Overlapping bands rank by overlap ÷ union; bands that just miss (under 20% apart) rank after them, nearest first.
  const band = (r: { priceMin: number; priceMax: number }) => [Math.log(r.priceMin * 0.97), Math.log(r.priceMax * 1.03)] as const;
  const NEAR = Math.log(1.2);
  for (const car of rows) {
    const isFactsOnly = factsOnlySlugs.has(car.slug) || (!car.overview.trim() && !car.expertVerdict.trim());
    if (!isFactsOnly) continue;
    const [a0, a1] = band(car);
    const rivals = published
      .filter((o) => o.slug !== car.slug && o.bodyType === car.bodyType)
      .map((o) => {
        const [b0, b1] = band(o);
        const overlap = Math.min(a1, b1) - Math.max(a0, b0);
        const union = Math.max(a1, b1) - Math.min(a0, b0);
        return { slug: o.slug, score: overlap > 0 ? overlap / union : overlap / NEAR };
      })
      .filter((x) => x.score > -1)
      .sort((x, y) => y.score - x.score || x.slug.localeCompare(y.slug))
      .slice(0, 4)
      .map((x) => x.slug);
    if (!same(rivals, car.competitors)) {
      await tx.update(s.cars).set({ competitors: rivals }).where(eq(s.cars.id, car.id));
      report.rivals.updated++;
    }
  }
}

/* ── Main ───────────────────────────────────────────────────── */

class DryRun extends Error {}

function readFiles() {
  const files = readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
  const out: BrandFile[] = [];
  const modelOwner = new Map<string, string>();
  for (const f of files) {
    const slug = f.replace(/\.json$/, "");
    let parsed;
    try {
      parsed = brandFileSchema.safeParse(JSON.parse(readFileSync(path.join(DIR, f), "utf8")));
    } catch (e) {
      report.files.invalid.push(`${f}: not valid JSON — ${(e as Error).message}`);
      continue;
    }
    if (!parsed.success) {
      const first = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`);
      report.files.invalid.push(`${f}: ${parsed.error.issues.length} schema error(s) — ${first.join("; ")}`);
      continue;
    }
    if (parsed.data.brand.slug !== slug) {
      report.files.invalid.push(`${f}: brand slug is "${parsed.data.brand.slug}" — the file must be named ${parsed.data.brand.slug}.json`);
      continue;
    }
    // Model slugs are global: a slug claimed by an earlier file is dropped from this one.
    const models = parsed.data.models.filter((m) => {
      const owner = modelOwner.get(m.slug);
      if (owner) {
        report.cars.skipped.push(`${m.slug}: listed in both ${owner}.json and ${slug}.json — kept the first`);
        return false;
      }
      modelOwner.set(m.slug, slug);
      return true;
    });
    report.files.read++;
    if (!ONLY.size || ONLY.has(slug)) out.push({ ...parsed.data, models });
  }
  return { files: out, allModelSlugs: new Set(modelOwner.keys()), fileBrands: new Set(files.map((f) => f.replace(/\.json$/, ""))) };
}

function dataChecks(files: BrandFile[]) {
  for (const f of files) {
    for (const m of f.models) {
      const prices = m.variants.map((v) => v.price);
      if (Math.max(...prices) > Math.min(...prices) * 6) report.dataNotes.push(`${m.slug}: variant prices span over 6× — check for a typo`);
      if (m.variants.some((v) => v.fuel === "Electric") && m.variants.some((v) => v.fuel !== "Electric")) report.dataNotes.push(`${m.slug}: mixes electric and fuel variants in one model`);
      const slugs = new Map<string, number>();
      for (const v of m.variants) slugs.set(slugOf(v.name), (slugs.get(slugOf(v.name)) ?? 0) + 1);
      const clashes = [...slugs].filter(([, n]) => n > 1).map(([sl]) => sl);
      if (clashes.length) report.dataNotes.push(`${m.slug}: variant names that differ only in punctuation (${clashes.join(", ")}) — given -2/-3 suffixes`);
    }
  }
}

async function main() {
  const { files, allModelSlugs, fileBrands } = readFiles();
  if (ONLY.size) for (const b of ONLY) if (!files.some((f) => f.brand.slug === b)) report.files.invalid.push(`--brand ${b}: no valid ${b}.json in ${DIR}`);
  dataChecks(files);
  const db = getDb();
  console.log(`${DRY ? "Dry run — nothing will be saved. " : ""}Importing ${files.length} brand file(s) from ${path.relative(process.cwd(), DIR) || DIR}…`);

  const factsOnlySlugs = new Set<string>();
  const refs = await variantReferences(db);

  const run = async (tx: Tx) => {
    for (const file of files) await importBrand(tx, file, refs, factsOnlySlugs, allModelSlugs);
    await recomputeRivals(tx, factsOnlySlugs);
    if (DRY) throw new DryRun();
  };
  try {
    if (DRY) await db.transaction(run);
    else {
      // One transaction per brand, then one for the rivals (which span brands).
      for (const file of files) await db.transaction((tx) => importBrand(tx, file, refs, factsOnlySlugs, allModelSlugs));
      await db.transaction((tx) => recomputeRivals(tx, factsOnlySlugs));
    }
  } catch (e) {
    if (!(e instanceof DryRun)) throw e;
  }

  // Models the research doesn't list (they may be discontinued — staff decide).
  const dbCars = await db.select({ slug: s.cars.slug, brand: s.cars.brand, status: s.cars.status }).from(s.cars);
  for (const c of dbCars) {
    if (allModelSlugs.has(c.slug)) continue;
    if (ONLY.size && !ONLY.has(c.brand)) continue;
    if (fileBrands.has(c.brand)) report.notInResearch.push(`${c.slug} (${c.status})`);
    else if (!report.brandFilesMissing.includes(c.brand)) report.brandFilesMissing.push(c.brand);
  }

  printReport();
}

function printReport() {
  const r = report;
  const list = (title: string, items: string[], max = 60) => {
    if (!items.length) return;
    console.log(`\n${title} (${items.length}):`);
    for (const x of items.slice(0, max)) console.log(`  · ${x}`);
    if (items.length > max) console.log(`  … and ${items.length - max} more`);
  };
  list("Files skipped", r.files.invalid);
  list("Models skipped", r.cars.skipped);
  list("Data to check", r.dataNotes);
  list("Model names changed", r.cars.renamed);
  list("Variants renamed in the research — the closest new variant keeps the old slug (check these)", r.variants.matched);
  list("Variants kept although no longer in the research (referenced elsewhere — staff decide)", r.variants.kept);
  list("Variants deleted (no longer in the research, not referenced)", r.variants.deleted, 40);
  list("In the database but in no research file — left untouched (discontinued?)", r.notInResearch);
  if (r.brandFilesMissing.length) console.log(`\nBrands with no research file yet (their models were not checked): ${r.brandFilesMissing.join(", ")}`);
  console.log(`
Summary${DRY ? " (dry run — rolled back)" : ""}:
  brand files   ${r.files.read} valid, ${r.files.invalid.length} skipped
  brands        ${r.brands.inserted.length} inserted, ${r.brands.updated.length} updated, ${r.brands.unchanged} unchanged${r.brands.inserted.length ? `\n                new: ${r.brands.inserted.join(", ")}` : ""}
  models        ${r.cars.inserted.length} inserted, ${r.cars.updated.length} updated, ${r.cars.unchanged} unchanged, ${r.cars.skipped.length} skipped, ${r.notInResearch.length} not in research
  variants      ${r.variants.inserted} inserted, ${r.variants.updated} updated, ${r.variants.unchanged} unchanged, ${r.variants.deleted.length} deleted, ${r.variants.kept.length} kept (referenced)
  rivals        ${r.rivals.updated} facts-only model(s) got new computed rivals`);
  if (!DRY)
    console.log(`
The running site caches the catalogue for up to an hour. To see the changes now, save any record in /admin
(e.g. open a car and press Save) or restart \`npm run dev\`.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(closeDb);
