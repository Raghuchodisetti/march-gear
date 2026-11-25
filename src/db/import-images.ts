/**
 * Loads the genuine, free-licensed catalogue photos (src/db/catalogue-data/images/<brand>.json — Wikimedia Commons
 * photos picked and checked by eye) into the media library and points each model at them.
 * Idempotent: run it again whenever an image file is added or corrected.
 *
 *   npm run db:import-images                         every image file
 *   npm run db:import-images -- --brand kia          one brand (repeat --brand, or kia,tata)
 *   npm run db:import-images -- --dry-run            validate and plan: nothing is downloaded or saved
 *   npm run db:import-images -- --prune              also delete imported photos that nothing on the site uses any more
 *   npm run db:import-images -- --dir <folder>       read image files from another folder (testing)
 *
 * For each model's photos, in order:
 * - a `media` row with the same source_url (the Commons file page) is reused, so nothing is downloaded twice; its
 *   credit fields are refreshed from the file (and its alt text filled in if it has none);
 * - otherwise the photo is downloaded (at most 2 requests a second, retried with backoff on 429/5xx), resized to at
 *   most 1600 px, converted to WebP (quality 78, lowered until it's under 850 KB) with a 960 px rendition for cards
 *   and thumbnails, and stored as <model>-<angle>-<n>.webp with its alt text and credits (author, licence, source page
 *   and the change note "Resized and converted to WebP").
 * Then `cars.images` becomes the model's photos in order (and `focus` is reset when they change).
 *
 * - Models under `missing` get no photos: the site shows its placeholder. That includes seeded models whose Unsplash
 *   stand-ins showed other cars.
 * - Only photos this importer manages are replaced: no photos, Unsplash stand-ins, or earlier imports. A model whose
 *   photos include anything else (a staff upload, another URL) is left alone and reported.
 * - Brands whose cover image is empty, an Unsplash stand-in or an earlier import get the first photo of their first
 *   model (lowest sort order) that has photos.
 * - A photo that fails is reported and skipped; the run carries on, and the next run retries it.
 * Editorial content (overview, verdict, ratings, …) is never touched.
 *
 * The running site caches the catalogue for up to an hour: save anything in /admin or restart `npm run dev`.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import sharp from "sharp";
import { asc, eq, isNotNull } from "drizzle-orm";
import { closeDb, getDb, type Database } from "./index";
import * as s from "./schema";
import { brandFileSchema } from "./catalogue-data/schema";
import { brandImagesSchema, type BrandImages, type CataloguePhoto } from "./catalogue-data/images-schema";
import { CREDIT_NOTE, isStockPhoto, mediaIdOf } from "@/lib/photo-credits";
import { MEDIA_THUMB_WIDTH } from "@/components/admin/media-shared";

/* ── Arguments ──────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const PRUNE = argv.includes("--prune");
const argValues = (flag: string) => argv.flatMap((a, i) => (a === flag && argv[i + 1] ? argv[i + 1].split(",") : [])).map((x) => x.trim()).filter(Boolean);
const ONLY = new Set(argValues("--brand"));
const ROOT = path.join(process.cwd(), "src", "db", "catalogue-data");
const DIR = argValues("--dir")[0] ?? path.join(ROOT, "images");
const BRANDS_DIR = path.join(ROOT, "brands");

/* ── Settings ───────────────────────────────────────────────── */

const USER_AGENT = "MarchGearCatalogue/1.0 (https://marchgear.in; hello@marchgear.in)";
/** At most 2 requests a second to Wikimedia. */
const REQUEST_GAP_MS = 500;
/** Waits before each retry of a 429/5xx or network error. */
const RETRY_DELAYS_MS = [2_000, 6_000, 15_000, 30_000];
const MAX_DOWNLOAD_BYTES = 60 * 1024 * 1024;
/** The photo as stored: fits 1600 × 1600 (so landscape photos are at most 1600 px wide). */
const MAX_SIDE = 1600;
/** Under the 1 MB max_allowed_packet with room for the other columns. */
const MAX_BYTES = 850 * 1024;
const QUALITIES = [78, 74, 70, 66, 62, 58, 54, 50];
/** The card/thumbnail rendition (media.thumb) — MEDIA_THUMB_WIDTH; src/lib/image-loader.ts asks for it. */
const THUMB_WIDTH = MEDIA_THUMB_WIDTH;
const THUMB_MAX_BYTES = 250 * 1024;
const THUMB_QUALITIES = [72, 66, 60, 54];

/* ── Helpers ────────────────────────────────────────────────── */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const kb = (n: number) => `${Math.round(n / 1024)} KB`;
const mb = (n: number) => `${(n / (1024 * 1024)).toFixed(1)} MB`;

/** Commons page URLs compare equal however they were written (spaces/underscores, percent-encoding). */
function pageKey(url: string) {
  let u = url.trim();
  try {
    u = decodeURI(u);
  } catch {
    /* keep as written */
  }
  return u.replace(/ /g, "_").replace(/^http:/, "https:");
}

let nextSlot = 0;
/** Spaces request starts at least REQUEST_GAP_MS apart. */
async function throttle() {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + REQUEST_GAP_MS;
  if (wait) await sleep(wait);
}

async function download(url: string): Promise<Buffer> {
  for (let attempt = 0; ; attempt++) {
    await throttle();
    let res: Response;
    try {
      res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "image/*" }, redirect: "follow", signal: AbortSignal.timeout(90_000) });
    } catch (e) {
      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw new Error(`network error: ${(e as Error).message}`);
    }
    if (res.ok) {
      const type = res.headers.get("content-type") ?? "";
      if (!type.startsWith("image/")) {
        await res.body?.cancel();
        throw new Error(`not an image (Content-Type ${type || "missing"})`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_DOWNLOAD_BYTES) throw new Error(`download is ${mb(buf.length)} — over the ${mb(MAX_DOWNLOAD_BYTES)} limit`);
      return buf;
    }
    await res.body?.cancel();
    if ((res.status === 429 || res.status >= 500) && attempt < RETRY_DELAYS_MS.length) {
      const after = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(after) && after > 0 ? Math.min(after * 1000, 120_000) : RETRY_DELAYS_MS[attempt]);
      continue;
    }
    throw new Error(`HTTP ${res.status}${res.status === 404 ? " (file renamed or deleted on Commons?)" : ""}`);
  }
}

/** WebP at the highest quality in `qualities` that fits under `maxBytes`. */
async function encode(input: Buffer, box: { width: number; height?: number }, qualities: number[], maxBytes: number) {
  const pipeline = sharp(input, { failOn: "error", limitInputPixels: 150_000_000 })
    .rotate() // honour EXIF orientation
    .resize({ width: box.width, height: box.height, fit: "inside", withoutEnlargement: true });
  for (const quality of qualities) {
    const { data, info } = await pipeline.clone().webp({ quality, effort: 5, smartSubsample: true }).toBuffer({ resolveWithObject: true });
    if (data.length < maxBytes) return { data, width: info.width, height: info.height, quality };
  }
  throw new Error(`still over ${kb(maxBytes)} at WebP quality ${qualities[qualities.length - 1]}`);
}

/* ── Report ─────────────────────────────────────────────────── */

const report = {
  files: { read: 0, invalid: [] as string[] },
  photos: { downloaded: 0, downloadedBytes: 0, reused: 0, creditsUpdated: 0, thumbsRebuilt: 0, failed: [] as string[], planned: 0 },
  models: {
    updated: [] as string[],
    unchanged: 0,
    placeholder: [] as string[],
    staff: [] as string[],
    notInDb: [] as string[],
    unknown: [] as string[],
    unaccounted: [] as string[],
    allFailed: [] as string[],
  },
  legacy: [] as string[],
  brands: { changed: [] as string[], kept: [] as string[] },
  orphans: [] as string[],
  pruned: 0,
};

/* ── Database ───────────────────────────────────────────────── */

const pool = () => (getDb() as Database & { $client: Pool }).$client;

interface ImportedRow {
  id: number;
  filename: string;
  sourceUrl: string;
  alt: string | null;
  author: string | null;
  authorUrl: string | null;
  license: string | null;
  licenseUrl: string | null;
  creditNote: string | null;
}

const urlOf = (r: { id: number; filename: string }) => `/media/${r.id}/${r.filename}`;

async function loadImported() {
  const rows = await getDb()
    .select({
      id: s.media.id,
      filename: s.media.filename,
      sourceUrl: s.media.sourceUrl,
      alt: s.media.alt,
      author: s.media.author,
      authorUrl: s.media.authorUrl,
      license: s.media.license,
      licenseUrl: s.media.licenseUrl,
      creditNote: s.media.creditNote,
    })
    .from(s.media)
    .where(isNotNull(s.media.sourceUrl))
    .orderBy(asc(s.media.id));
  const bySource = new Map<string, ImportedRow>();
  for (const r of rows) if (!bySource.has(pageKey(r.sourceUrl!))) bySource.set(pageKey(r.sourceUrl!), r as ImportedRow);
  return { bySource, ids: new Set(rows.map((r) => r.id)) };
}

/** Stored through mysql2's binary protocol: Drizzle sends Buffers as hex text, which would double them past the 1 MB packet. */
async function insertPhoto(p: CataloguePhoto, filename: string, img: { data: Buffer; width: number; height: number }, thumb: Buffer) {
  const [res] = await pool().execute<ResultSetHeader>(
    "INSERT INTO `media` (`filename`, `mime`, `size`, `width`, `height`, `alt`, `data`, `source_url`, `author`, `author_url`, `license`, `license_url`, `credit_note`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [filename, "image/webp", img.data.length, img.width, img.height, p.alt.slice(0, 300), img.data, p.pageUrl, p.author.slice(0, 160), p.authorUrl, p.license, p.licenseUrl, CREDIT_NOTE],
  );
  // A second statement, so each packet carries one image.
  await pool().execute("UPDATE `media` SET `thumb` = ? WHERE `id` = ?", [thumb, res.insertId]);
  return res.insertId;
}

/** The pixel width in a WebP file's header, or null. */
function webpWidth(buf: Buffer | null) {
  if (!buf || buf.length < 30 || buf.toString("latin1", 0, 4) !== "RIFF" || buf.toString("latin1", 8, 12) !== "WEBP") return null;
  const chunk = buf.toString("latin1", 12, 16);
  if (chunk === "VP8 ") return buf.readUInt16LE(26) & 0x3fff;
  if (chunk === "VP8L") return 1 + (((buf[22] & 0x3f) << 8) | buf[21]);
  if (chunk === "VP8X") return 1 + buf.readUIntLE(24, 3);
  return null;
}

/**
 * (Re)builds the card rendition of imported photos that have none or one of another width (e.g. after THUMB_WIDTH
 * changed), from the stored photo. Reads only the first bytes of each rendition to check it.
 */
async function refreshThumbs() {
  const [rows] = await pool().query<RowDataPacket[]>("SELECT `id`, `width`, SUBSTRING(`thumb`, 1, 40) AS head FROM `media` WHERE `source_url` IS NOT NULL");
  let rebuilt = 0;
  for (const r of rows as { id: number; width: number | null; head: Buffer | null }[]) {
    const expected = Math.min(THUMB_WIDTH, r.width ?? THUMB_WIDTH);
    if (webpWidth(r.head) === expected) continue;
    const [[row]] = await pool().query<RowDataPacket[]>("SELECT `data` FROM `media` WHERE `id` = ?", [r.id]);
    try {
      const thumb = await encode(row.data as Buffer, { width: THUMB_WIDTH }, THUMB_QUALITIES, THUMB_MAX_BYTES);
      await pool().execute("UPDATE `media` SET `thumb` = ? WHERE `id` = ?", [thumb.data, r.id]);
      rebuilt++;
    } catch (e) {
      report.photos.failed.push(`media ${r.id}: couldn't rebuild its card rendition — ${(e as Error).message}`);
    }
  }
  report.photos.thumbsRebuilt = rebuilt;
}

/** Every /media/<id>/ referenced from any text column outside the media table (cars, brands, articles, content, ads, …). */
async function referencedMediaIds() {
  const [cols] = await pool().query<RowDataPacket[]>(
    "SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME <> 'media' AND DATA_TYPE IN ('varchar', 'char', 'text', 'mediumtext', 'longtext', 'json')",
  );
  const ids = new Set<number>();
  for (const { t, c } of cols as { t: string; c: string }[]) {
    const [rows] = await pool().query<RowDataPacket[]>(`SELECT \`${c}\` AS v FROM \`${t}\` WHERE \`${c}\` LIKE '%/media/%'`);
    for (const r of rows) for (const m of String(r.v).matchAll(/\/media\/(\d{1,10})\//g)) ids.add(Number(m[1]));
  }
  return ids;
}

/* ── Reading the image files ────────────────────────────────── */

function readFiles() {
  if (!existsSync(DIR)) return [];
  const out: BrandImages[] = [];
  for (const f of readdirSync(DIR).filter((x) => x.endsWith(".json")).sort()) {
    const slug = f.replace(/\.json$/, "");
    if (ONLY.size && !ONLY.has(slug)) continue;
    let parsed;
    try {
      parsed = brandImagesSchema.safeParse(JSON.parse(readFileSync(path.join(DIR, f), "utf8")));
    } catch (e) {
      report.files.invalid.push(`${f}: not valid JSON — ${(e as Error).message}`);
      continue;
    }
    if (!parsed.success) {
      const first = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`);
      report.files.invalid.push(`${f}: ${parsed.error.issues.length} schema error(s) — ${first.join("; ")}`);
      continue;
    }
    const img = parsed.data;
    const catalogueFile = path.join(BRANDS_DIR, `${img.brand}.json`);
    if (img.brand !== slug || !existsSync(catalogueFile)) {
      report.files.invalid.push(`${f}: brand "${img.brand}" must match the file name and a catalogue file brands/${img.brand}.json`);
      continue;
    }
    // Cross-check with the researched catalogue, as validate-images.ts does: unknown slugs are skipped, unaccounted ones reported.
    const catalogue = brandFileSchema.safeParse(JSON.parse(readFileSync(catalogueFile, "utf8")));
    if (catalogue.success) {
      const slugs = new Set(catalogue.data.models.map((m) => m.slug));
      for (const key of ["models", "missing"] as const) {
        for (const m of Object.keys(img[key])) {
          if (slugs.has(m)) continue;
          report.models.unknown.push(`${img.brand}/${m}: not a model in brands/${img.brand}.json — skipped`);
          delete img[key][m];
        }
      }
      for (const m of slugs) if (!(m in img.models) && !(m in img.missing)) report.models.unaccounted.push(`${img.brand}/${m}`);
    }
    report.files.read++;
    out.push(img);
  }
  return out;
}

/* ── Import ─────────────────────────────────────────────────── */

type CarRow = { id: number; slug: string; brand: string; images: string[]; focus: string | null; sortOrder: number; status: string };

async function main() {
  const files = readFiles();
  if (ONLY.size) for (const b of ONLY) if (!files.some((f) => f.brand === b)) report.files.invalid.push(`--brand ${b}: no valid ${b}.json in ${path.relative(process.cwd(), DIR) || DIR}`);
  const db = getDb();
  console.log(`${DRY ? "Dry run — nothing will be downloaded or saved. " : ""}Importing photos for ${files.length} brand file(s) from ${path.relative(process.cwd(), DIR) || DIR}…`);

  const imported = await loadImported();
  const carRows: CarRow[] = await db
    .select({ id: s.cars.id, slug: s.cars.slug, brand: s.cars.brand, images: s.cars.images, focus: s.cars.focus, sortOrder: s.cars.sortOrder, status: s.cars.status })
    .from(s.cars)
    .orderBy(asc(s.cars.sortOrder), asc(s.cars.id));
  const carsBySlug = new Map(carRows.map((c) => [c.slug, c]));

  /** No photos, Unsplash stand-ins or earlier imports — photos this importer may replace. */
  const managed = (images: string[]) =>
    images.every((u) => {
      const id = mediaIdOf(u);
      return isStockPhoto(u) || (id !== null && imported.ids.has(id));
    });
  const legacyNote = (car: CarRow, outcome: string) => {
    if (car.images.some(isStockPhoto)) report.legacy.push(`${car.slug}: ${car.images.length} Unsplash stand-in(s) → ${outcome}`);
  };

  for (const file of files) {
    console.log(`\n${file.brand}: ${Object.keys(file.models).length} model(s) with photos, ${Object.keys(file.missing).length} without`);

    for (const [slug, photos] of Object.entries(file.models)) {
      const car = carsBySlug.get(slug);
      if (!car) {
        report.models.notInDb.push(`${slug} — run \`npm run db:import-catalogue\` first`);
        continue;
      }
      if (car.brand !== file.brand) {
        report.models.notInDb.push(`${slug} — in the database under brand "${car.brand}", not ${file.brand}`);
        continue;
      }
      if (!managed(car.images)) {
        report.models.staff.push(`${slug} (${car.images.length} photo(s) added in the admin — left alone)`);
        continue;
      }

      const urls: string[] = [];
      for (const [i, p] of photos.entries()) {
        const existing = imported.bySource.get(pageKey(p.pageUrl));
        if (existing) {
          report.photos.reused++;
          urls.push(urlOf(existing));
          // The file is the source of truth for credits; alt text only fills a gap (staff may have refined it).
          const credit = { author: p.author.slice(0, 160), authorUrl: p.authorUrl, license: p.license, licenseUrl: p.licenseUrl, creditNote: CREDIT_NOTE };
          const patch: Partial<typeof s.media.$inferInsert> = {};
          for (const k of Object.keys(credit) as (keyof typeof credit)[]) if (existing[k] !== credit[k]) Object.assign(patch, { [k]: credit[k] });
          if (!existing.alt) patch.alt = p.alt.slice(0, 300);
          if (Object.keys(patch).length) {
            report.photos.creditsUpdated++;
            if (!DRY) await db.update(s.media).set(patch).where(eq(s.media.id, existing.id));
            Object.assign(existing, patch);
          }
          continue;
        }
        const filename = `${slug}-${p.angle}-${i + 1}.webp`.slice(0, 200);
        if (DRY) {
          report.photos.planned++;
          urls.push(`/media/new/${filename}`);
          continue;
        }
        try {
          const original = await download(p.downloadUrl);
          const img = await encode(original, { width: MAX_SIDE, height: MAX_SIDE }, QUALITIES, MAX_BYTES);
          const thumb = await encode(original, { width: THUMB_WIDTH }, THUMB_QUALITIES, THUMB_MAX_BYTES);
          const id = await insertPhoto(p, filename, img, thumb.data);
          const row: ImportedRow = { id, filename, sourceUrl: p.pageUrl, alt: p.alt, author: p.author, authorUrl: p.authorUrl, license: p.license, licenseUrl: p.licenseUrl, creditNote: CREDIT_NOTE };
          imported.bySource.set(pageKey(p.pageUrl), row);
          imported.ids.add(id);
          urls.push(urlOf(row));
          report.photos.downloaded++;
          report.photos.downloadedBytes += img.data.length + thumb.data.length;
          console.log(`  ✓ ${filename}  ${img.width}×${img.height} q${img.quality} ${kb(img.data.length)} (+${kb(thumb.data.length)} card)  ← ${p.file}`);
        } catch (e) {
          report.photos.failed.push(`${slug} #${i + 1} ${p.file}: ${(e as Error).message}`);
          console.log(`  ✗ ${slug} #${i + 1} ${p.file}: ${(e as Error).message}`);
        }
      }

      if (!urls.length) {
        report.models.allFailed.push(slug);
        continue;
      }
      if (same(urls, car.images)) {
        report.models.unchanged++;
        continue;
      }
      legacyNote(car, `${urls.length} genuine photo(s)`);
      report.models.updated.push(`${slug} (${car.images.length} → ${urls.length} photo(s))`);
      if (!DRY) await db.update(s.cars).set({ images: urls, focus: null }).where(eq(s.cars.id, car.id));
      car.images = urls;
      car.focus = null;
    }

    for (const [slug, reason] of Object.entries(file.missing)) {
      const car = carsBySlug.get(slug);
      if (!car || car.brand !== file.brand || car.images.length === 0) continue;
      if (!managed(car.images)) {
        report.models.staff.push(`${slug} (listed as missing, but has ${car.images.length} photo(s) added in the admin — left alone)`);
        continue;
      }
      legacyNote(car, `placeholder (${reason})`);
      report.models.placeholder.push(`${slug}: ${reason}`);
      if (!DRY) await db.update(s.cars).set({ images: [], focus: null }).where(eq(s.cars.id, car.id));
      car.images = [];
      car.focus = null;
    }

    await brandCover(file.brand, carRows, imported.ids);
  }

  if (!DRY) await refreshThumbs();

  // Imported photos nothing uses any more (a picker replaced or dropped them). Only checked on a full, real run.
  if (!DRY && !ONLY.size) {
    const used = await referencedMediaIds();
    const orphans = [...imported.bySource.values()].filter((r) => !used.has(r.id));
    report.orphans = orphans.map((r) => `${urlOf(r)}  ← ${r.sourceUrl}`);
    if (PRUNE && orphans.length) {
      for (const r of orphans) await db.delete(s.media).where(eq(s.media.id, r.id));
      report.pruned = orphans.length;
    }
  }

  await printReport(carRows);
}

/** Sets an importer-managed brand cover to the first photo of the brand's first model (lowest sort order) with photos. */
async function brandCover(brandSlug: string, carRows: CarRow[], importedIds: Set<number>) {
  const db = getDb();
  const [brand] = await db.select({ id: s.brands.id, heroImage: s.brands.heroImage }).from(s.brands).where(eq(s.brands.slug, brandSlug));
  if (!brand) return;
  const current = brand.heroImage.trim();
  const currentId = mediaIdOf(current);
  const isManaged = !current || isStockPhoto(current) || (currentId !== null && importedIds.has(currentId));
  // Published models first, in the site's order; the first photo must be a genuine (imported) one, and a front view
  // makes the better cover, so the first model that leads with one wins (otherwise simply the first model with photos).
  const candidates = carRows
    .filter((c) => c.brand === brandSlug && c.images.length > 0 && (c.images[0].startsWith("/media/new/") || importedIds.has(mediaIdOf(c.images[0]) ?? -1)))
    .sort((a, b) => Number(b.status === "published") - Number(a.status === "published"));
  const pick = candidates.find((c) => /-front-\d+\.webp$/.test(c.images[0])) ?? candidates[0];
  if (!isManaged) {
    if (pick) report.brands.kept.push(`${brandSlug}: cover added in the admin — left alone`);
    return;
  }
  if (!pick) {
    if (current) report.brands.kept.push(`${brandSlug}: no model has genuine photos yet — cover left as is (${isStockPhoto(current) ? "Unsplash stand-in" : current})`);
    return;
  }
  const next = pick.images[0];
  if (next === current) return;
  report.brands.changed.push(`${brandSlug}: ${current ? (isStockPhoto(current) ? "Unsplash stand-in" : current) : "none"} → ${pick.slug} photo 1 (${next})`);
  if (!DRY) await db.update(s.brands).set({ heroImage: next }).where(eq(s.brands.id, brand.id));
}

async function printReport(carRows: CarRow[]) {
  const r = report;
  const list = (title: string, items: string[], max = 80) => {
    if (!items.length) return;
    console.log(`\n${title} (${items.length}):`);
    for (const x of items.slice(0, max)) console.log(`  · ${x}`);
    if (items.length > max) console.log(`  … and ${items.length - max} more`);
  };
  list("Files skipped", r.files.invalid);
  list("Photos that failed (the model keeps the rest; the next run retries)", r.photos.failed);
  list("Models where every photo failed — left as they were", r.models.allFailed);
  list("Models not in the database", r.models.notInDb);
  list("Model slugs not in the catalogue file", r.models.unknown);
  list("Catalogue models the image file doesn't mention — left as they were", r.models.unaccounted, 40);
  list("Models with photos added in the admin — left alone", r.models.staff);
  list("Models given photos", r.models.updated, 300);
  list("Models set to the placeholder (in `missing`)", r.models.placeholder, 300);
  list("Seeded models whose Unsplash stand-ins were replaced or removed", r.legacy, 100);
  list("Brand covers changed", r.brands.changed);
  list("Brand covers left alone", r.brands.kept);
  list(PRUNE ? "Unused imported photos deleted" : "Imported photos nothing uses any more (run with --prune to delete them)", r.orphans);

  const published = carRows.filter((c) => c.status === "published");
  const genuine = published.filter((c) => c.images.length > 0 && c.images.every((u) => !isStockPhoto(u)));
  const stock = published.filter((c) => c.images.some(isStockPhoto));
  const imageFiles = new Set(existsSync(DIR) ? readdirSync(DIR).map((f) => f.replace(/\.json$/, "")) : []);
  list(
    "Published models still showing Unsplash stand-ins (staff decide: add photos in the admin, clear them or unpublish)",
    stock.map((c) => `${c.slug}: ${imageFiles.has(c.brand) ? `not listed in images/${c.brand}.json (not in the researched catalogue?)` : `no images/${c.brand}.json yet`}`),
  );
  const [[storage]] = await pool().query<RowDataPacket[]>(
    "SELECT COUNT(*) AS n, COALESCE(SUM(`size`), 0) AS bytes, COALESCE(SUM(LENGTH(`thumb`)), 0) AS thumbs FROM `media` WHERE `source_url` IS NOT NULL",
  );
  console.log(`
Summary${DRY ? " (dry run — nothing downloaded or saved)" : ""}:
  image files   ${r.files.read} valid, ${r.files.invalid.length} skipped
  photos        ${DRY ? `${r.photos.planned} to download` : `${r.photos.downloaded} downloaded (${mb(r.photos.downloadedBytes)})`}, ${r.photos.reused} reused (${r.photos.creditsUpdated} credit update(s)), ${r.photos.failed.length} failed${r.photos.thumbsRebuilt ? `, ${r.photos.thumbsRebuilt} card rendition(s) rebuilt` : ""}
  models        ${r.models.updated.length} given photos, ${r.models.placeholder.length} set to the placeholder, ${r.models.unchanged} unchanged, ${r.models.staff.length} left alone (admin photos), ${r.models.notInDb.length} not in the database
  legacy        ${r.legacy.length} seeded model(s) lost their Unsplash stand-ins
  brands        ${r.brands.changed.length} cover(s) changed
  site now      ${genuine.length} of ${published.length} published models have genuine photos${stock.length ? `, ${stock.length} still show Unsplash stand-ins (listed above)` : ""}
  storage       ${storage.n} imported photo(s) in MySQL: ${mb(Number(storage.bytes))} + ${mb(Number(storage.thumbs))} card renditions${r.pruned ? ` · ${r.pruned} unused deleted` : ""}`);
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
