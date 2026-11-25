import "server-only";
import type { Pool, ResultSetHeader } from "mysql2/promise";
import { and, count, desc, eq, like, lt, or, sql, type SQL } from "drizzle-orm";
import { getDb, type Database } from "@/db";
import { articles, brands, cars, dealers, media, siteContent, upcomingCars, usedCars, users } from "@/db/schema";
import { BLOCKS, isBlockKey } from "@/content/registry";
import { requireStaff } from "@/server/auth";
import { MEDIA_PAGE_SIZE, MEDIA_THUMB_MAX_BYTES, MEDIA_THUMB_WIDTH, MEDIA_TYPES, mediaUrl, type MediaItem, type MediaMime, type MediaPage, type MediaUsage } from "@/components/admin/media-shared";

const term = (q: string) => `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;

/* ── Reading ────────────────────────────────────────────────── */

// Metadata only — never the blobs.
const columns = {
  id: media.id,
  filename: media.filename,
  mime: media.mime,
  size: media.size,
  width: media.width,
  height: media.height,
  alt: media.alt,
  createdAt: media.createdAt,
  uploader: users.name,
  sourceUrl: media.sourceUrl,
  author: media.author,
  authorUrl: media.authorUrl,
  license: media.license,
  licenseUrl: media.licenseUrl,
  creditNote: media.creditNote,
  hasThumb: sql<number>`(${media.thumb} IS NOT NULL)`.mapWith(Number),
};

type Row = {
  id: number;
  filename: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  createdAt: Date;
  uploader: string | null;
  sourceUrl: string | null;
  author: string | null;
  authorUrl: string | null;
  license: string | null;
  licenseUrl: string | null;
  creditNote: string | null;
  hasThumb: number;
};

const toItem = ({ sourceUrl, author, authorUrl, license, licenseUrl, creditNote, hasThumb, ...r }: Row): MediaItem => ({
  ...r,
  url: mediaUrl(r.id, r.filename),
  createdAt: r.createdAt.toISOString(),
  hasThumb: Boolean(hasThumb),
  credit: sourceUrl ? { author: author ?? "Unknown", authorUrl, license: license ?? "See source", licenseUrl, sourceUrl, note: creditNote, hasThumb: Boolean(hasThumb) } : null,
});

/** Newest first, `limit` at a time; `before` is the last id of the previous page. */
export async function listMedia({ q, before, limit = MEDIA_PAGE_SIZE }: { q?: string; before?: number; limit?: number } = {}): Promise<MediaPage> {
  await requireStaff();
  const db = getDb();
  const query = q?.trim();
  const search = query
    ? or(like(media.filename, term(query)), like(media.alt, term(query)), like(media.author, term(query)), ...(/^\d{1,10}$/.test(query) ? [eq(media.id, Number(query))] : []))
    : undefined;
  const conds: (SQL | undefined)[] = [search, before ? lt(media.id, before) : undefined];
  const [rows, [{ total }]] = await Promise.all([
    db
      .select(columns)
      .from(media)
      .leftJoin(users, eq(users.id, media.createdBy))
      .where(and(...conds))
      .orderBy(desc(media.id))
      .limit(limit + 1),
    db.select({ total: count() }).from(media).where(search),
  ]);
  const page = rows.slice(0, limit);
  return { items: page.map(toItem), nextCursor: rows.length > limit ? page[page.length - 1].id : null, total };
}

export async function getMediaItem(id: number): Promise<MediaItem | null> {
  await requireStaff();
  const [row] = await getDb().select(columns).from(media).leftJoin(users, eq(users.id, media.createdBy)).where(eq(media.id, id)).limit(1);
  return row ? toItem(row) : null;
}

/**
 * Records whose image fields reference /media/<id>/. A plain LIKE on the stored text — the
 * trailing slash keeps /media/1/ from matching /media/12/.
 */
export async function mediaUsage(id: number): Promise<MediaUsage[]> {
  await requireStaff();
  const db = getDb();
  const pattern = `%/media/${id}/%`;
  const [carRows, usedRows, articleRows, brandRows, dealerRows, upcomingRows, contentRows] = await Promise.all([
    db.select({ id: cars.id, name: cars.name }).from(cars).where(like(cars.images, pattern)),
    db.select({ id: usedCars.id, name: usedCars.name, year: usedCars.year }).from(usedCars).where(like(usedCars.images, pattern)),
    db.select({ id: articles.id, title: articles.title }).from(articles).where(or(like(articles.image, pattern), like(articles.body, pattern))),
    db.select({ id: brands.id, name: brands.name }).from(brands).where(like(brands.heroImage, pattern)),
    db.select({ id: dealers.id, name: dealers.name }).from(dealers).where(like(dealers.image, pattern)),
    db.select({ id: upcomingCars.id, name: upcomingCars.name }).from(upcomingCars).where(like(upcomingCars.image, pattern)),
    db.select({ key: siteContent.key }).from(siteContent).where(like(siteContent.data, pattern)),
  ]);
  return [
    ...brandRows.map((r) => ({ kind: "Brand", label: r.name, href: `/admin/brands/${r.id}` })),
    ...carRows.map((r) => ({ kind: "New car", label: r.name, href: `/admin/cars/${r.id}` })),
    ...upcomingRows.map((r) => ({ kind: "Upcoming car", label: r.name, href: `/admin/upcoming/${r.id}` })),
    ...usedRows.map((r) => ({ kind: "Used car", label: `${r.year} ${r.name}`, href: `/admin/used-cars/${encodeURIComponent(r.id)}` })),
    ...dealerRows.map((r) => ({ kind: "Dealer", label: r.name, href: `/admin/showrooms/${encodeURIComponent(r.id)}` })),
    ...articleRows.map((r) => ({ kind: "News story", label: r.title, href: `/admin/news/${r.id}` })),
    ...contentRows.map((r) => ({ kind: "Site content", label: isBlockKey(r.key) ? BLOCKS[r.key].title : r.key, href: `/admin/content/${encodeURIComponent(r.key)}` })),
  ];
}

/* ── Writing ────────────────────────────────────────────────── */

/**
 * Stores an upload. The caller must already have checked the user is staff.
 *
 * Goes through mysql2's binary protocol (`execute`) rather than Drizzle: Drizzle sends
 * queries as text, where a Buffer is written as hex — doubling it — so a 900 KB image
 * would blow the server's 1 MB max_allowed_packet. A prepared statement sends raw bytes.
 */
export async function insertMedia(
  file: { filename: string; mime: MediaMime; data: Buffer; width: number | null; height: number | null; thumb?: Buffer | null; alt?: string | null },
  userId: number,
) {
  const pool = (getDb() as Database & { $client: Pool }).$client;
  const [res] = await pool.execute<ResultSetHeader>(
    "INSERT INTO `media` (`filename`, `mime`, `size`, `width`, `height`, `alt`, `data`, `thumb`, `created_by`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [file.filename, file.mime, file.data.length, file.width, file.height, file.alt ?? null, file.data, cardCopy({ width: file.width }, file.thumb), userId],
  );
  return res.insertId;
}

/**
 * The browser-made card copy of an upload (a smaller WebP/JPEG, MEDIA_THUMB_WIDTH wide), if it really is one —
 * otherwise null, and the full image is served everywhere. Served at /media/<id>/<name>?w=960 (see the media route).
 */
export function cardCopy(main: { width: number | null }, thumb: Buffer | null | undefined): Buffer | null {
  if (!thumb?.length || thumb.length > MEDIA_THUMB_MAX_BYTES) return null;
  const info = sniffImage(thumb);
  if (!info || (info.mime !== "image/webp" && info.mime !== "image/jpeg") || !info.width || info.width > MEDIA_THUMB_WIDTH) return null;
  return main.width && info.width >= main.width ? null : thumb;
}

export async function setMediaAlt(id: number, alt: string | null) {
  await requireStaff();
  const res = await getDb().update(media).set({ alt }).where(eq(media.id, id));
  return res[0].affectedRows > 0;
}

export async function removeMedia(id: number) {
  await requireStaff();
  const res = await getDb().delete(media).where(eq(media.id, id));
  return res[0].affectedRows > 0;
}

/* ── File checks ────────────────────────────────────────────── */

export interface SniffedImage {
  mime: MediaMime;
  width: number | null;
  height: number | null;
}

const ascii = (buf: Buffer, start: number, end: number) => buf.toString("latin1", start, end);

/** Identifies an image by its leading bytes (never by its name or declared type) and reads its size. */
export function sniffImage(buf: Buffer): SniffedImage | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ...jpegSize(buf) };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    const ok = buf.length >= 24 && ascii(buf, 12, 16) === "IHDR";
    return { mime: "image/png", width: ok ? buf.readUInt32BE(16) : null, height: ok ? buf.readUInt32BE(20) : null };
  }
  const head = ascii(buf, 0, 6);
  if (head === "GIF87a" || head === "GIF89a") return { mime: "image/gif", width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  if (ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 12) === "WEBP") return { mime: "image/webp", ...webpSize(buf) };
  if (ascii(buf, 4, 8) === "ftyp" && isAvif(buf)) return { mime: "image/avif", ...avifSize(buf) };
  return null;
}

const none = { width: null, height: null };

function jpegSize(buf: Buffer) {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) return none;
    const marker = buf[i + 1];
    if (marker === 0xff) {
      i++; // fill byte
      continue;
    }
    // Start-of-frame markers carry the dimensions (C4 DHT, C8 JPG and CC DAC are not frames).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2; // markers without a length
      continue;
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return none;
}

function webpSize(buf: Buffer) {
  if (buf.length < 30) return none;
  const chunk = ascii(buf, 12, 16);
  if (chunk === "VP8 " && buf[23] === 0x9d && buf[24] === 0x01 && buf[25] === 0x2a) {
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === "VP8L" && buf[20] === 0x2f) {
    const [b0, b1, b2, b3] = [buf[21], buf[22], buf[23], buf[24]];
    return { width: 1 + (((b1 & 0x3f) << 8) | b0), height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) };
  }
  if (chunk === "VP8X") return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
  return none;
}

function isAvif(buf: Buffer) {
  const end = Math.min(buf.readUInt32BE(0), buf.length, 256);
  const brands = [ascii(buf, 8, 12)];
  for (let i = 16; i + 4 <= end; i += 4) brands.push(ascii(buf, i, i + 4));
  return brands.includes("avif") || brands.includes("avis");
}

/** Largest `ispe` (image spatial extent) box near the start of the file — the primary image, not a tile or alpha plane. */
function avifSize(buf: Buffer) {
  const scan = buf.subarray(0, Math.min(buf.length, 64 * 1024));
  let best: { width: number; height: number } | null = null;
  for (let i = scan.indexOf("ispe", 0, "latin1"); i !== -1 && i + 16 <= scan.length; i = scan.indexOf("ispe", i + 4, "latin1")) {
    const width = scan.readUInt32BE(i + 8);
    const height = scan.readUInt32BE(i + 12);
    if (!best || width * height > best.width * best.height) best = { width, height };
  }
  return best ?? none;
}

/** A URL-safe file name with the extension that matches the real type: "My Photo (1).JPG" → "my-photo-1.webp". */
export function safeFilename(name: string, mime: MediaMime) {
  const base =
    name
      .replace(/\.[^.]*$/, "")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80)
      .replace(/-+$/, "") || "image";
  return `${base}.${MEDIA_TYPES[mime]}`;
}
