import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { and, asc, inArray, isNotNull, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { media } from "@/db/schema";
import { mediaIdOf, type CreditMap, type PhotoCredit } from "@/lib/photo-credits";
import { CATALOG_TAG } from "@/server/catalog";

/* ──────────────────────────────────────────────────────────────
   Credits for the third-party photos in the media library (rows
   with a source_url — the Wikimedia Commons photos the image
   importer loads). One query for all of them, cached with the
   catalogue (same tag, so admin saves expire both); pages then
   look up the photos they show. Credits never travel in the client
   catalogue — only to the pages that print them.
   ────────────────────────────────────────────────────────────── */

/** Credited media rows (metadata only — never the blobs), optionally narrowed. */
async function queryCredits(where?: SQL): Promise<PhotoCredit[]> {
  const rows = await getDb()
    .select({
      id: media.id,
      filename: media.filename,
      alt: media.alt,
      author: media.author,
      authorUrl: media.authorUrl,
      license: media.license,
      licenseUrl: media.licenseUrl,
      sourceUrl: media.sourceUrl,
      note: media.creditNote,
    })
    .from(media)
    .where(and(isNotNull(media.sourceUrl), where))
    .orderBy(asc(media.id));
  return rows.map((r) => ({
    url: `/media/${r.id}/${r.filename}`,
    alt: r.alt,
    author: r.author?.trim() || "Unknown author",
    authorUrl: r.authorUrl,
    license: r.license?.trim() || "See the source page",
    licenseUrl: r.licenseUrl,
    sourceUrl: r.sourceUrl!,
    note: r.note,
  }));
}

const loadCredits = unstable_cache(() => queryCredits(), ["photo-credits", "v1"], { tags: [CATALOG_TAG], revalidate: 3600 });

/** Every credited photo by id — deduplicated per request. */
const creditIndex = cache(async () => new Map((await loadCredits()).map((c) => [mediaIdOf(c.url)!, c])));

/** The credits of the given photo URLs (those that have one), keyed by URL. */
export async function creditsFor(urls: (string | null | undefined)[]): Promise<CreditMap> {
  const index = await creditIndex();
  const out: CreditMap = {};
  for (const url of urls) {
    if (!url) continue;
    const id = mediaIdOf(url);
    const credit = id === null ? undefined : index.get(id);
    // The URL's file name must match too, as /media/<id>/<name> itself requires.
    if (credit && credit.url === url) out[url] = credit;
  }
  return out;
}

/** The credit of one photo URL, or null. */
export async function creditFor(url: string | null | undefined) {
  return url ? ((await creditsFor([url]))[url] ?? null) : null;
}

/** Uncached, for the admin (which must show the database as it is): the credits of these photo URLs. */
export async function creditsForAdmin(urls: string[]): Promise<CreditMap> {
  const ids = [...new Set(urls.map(mediaIdOf).filter((id): id is number => id !== null))];
  if (!ids.length) return {};
  const rows = await queryCredits(inArray(media.id, ids));
  const wanted = new Set(urls);
  return Object.fromEntries(rows.filter((r) => wanted.has(r.url)).map((r) => [r.url, r]));
}
