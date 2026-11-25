/* ──────────────────────────────────────────────────────────────
   Credits for third-party photos: the free-licensed Wikimedia
   Commons photos loaded by `npm run db:import-images` into the
   media library. Their licences (CC BY, CC BY-SA) require the
   author, the licence and a link to it, the source, and — for
   CC BY-SA — an indication of what we changed. Client-safe.
   ────────────────────────────────────────────────────────────── */

export interface PhotoCredit {
  /** "/media/<id>/<filename>" — the photo as the site uses it. */
  url: string;
  /** What the photo shows (from the picker's file; staff may refine it in the media library). */
  alt: string | null;
  author: string;
  authorUrl: string | null;
  /** "CC BY-SA 4.0", "CC0", "Public domain". */
  license: string;
  licenseUrl: string | null;
  /** The photo's page at its source (the Commons file page). */
  sourceUrl: string;
  /** What we changed, e.g. "Resized and converted to WebP". */
  note: string | null;
}

/** Credits keyed by photo URL. Only third-party photos have one. */
export type CreditMap = Record<string, PhotoCredit>;

/** The note the image importer stores for every photo it processes. */
export const CREDIT_NOTE = "Resized and converted to WebP";

/** Where the full list lives (linked from the footer and every credit line). */
export const PHOTO_CREDITS_PATH = "/photo-credits";

const MEDIA_URL = /^\/media\/(\d{1,10})\/([^/?#]+)/;

/** The media id in a "/media/<id>/<filename>" URL, or null for anything else. */
export function mediaIdOf(url: string): number | null {
  const m = MEDIA_URL.exec(url);
  return m ? Number(m[1]) : null;
}

/** Seeded Unsplash stock photos (often of another car; see src/lib/image-alt.ts). */
export const isStockPhoto = (url: string) => /^https:\/\/(images|plus)\.unsplash\.com\//.test(url);

export type PhotoAngle = "front" | "rear" | "side" | "interior" | "detail";

/** The view an imported photo shows, from its file name ("<model>-<angle>-<n>.webp"); null when unknown. */
export function photoAngle(url: string): PhotoAngle | null {
  const name = MEDIA_URL.exec(url)?.[2];
  const m = name && /-(front|rear|side|interior|detail)-\d+\.[a-z0-9]+$/i.exec(name);
  return m ? (m[1].toLowerCase() as PhotoAngle) : null;
}

/**
 * The first photo showing one of `angles` (in order of preference), for blocks that need a particular view; undefined
 * when none does. Only imported photos are tagged — check `hasAngles` first and keep the old fallbacks otherwise.
 */
export function pickPhoto(images: string[], ...angles: PhotoAngle[]) {
  const tags = images.map(photoAngle);
  for (const a of angles) {
    const i = tags.indexOf(a);
    if (i !== -1) return images[i];
  }
  return undefined;
}

/** True when the photos name their views (imported catalogue photos). */
export const hasAngles = (images: string[]) => images.some((u) => photoAngle(u) !== null);

/** "Wikimedia Commons" for Commons pages, otherwise the source's host name. */
export function sourceName(sourceUrl: string) {
  try {
    const host = new URL(sourceUrl).hostname.replace(/^www\./, "");
    return /(^|\.)wikimedia\.org$/.test(host) ? "Wikimedia Commons" : host;
  } catch {
    return "source";
  }
}

/** The change note in a credit line's short form: "Resized and converted to WebP" → "resized". */
export function changeLabel(note: string | null) {
  if (!note) return null;
  if (/^resized\b/i.test(note)) return "resized";
  return note.charAt(0).toLowerCase() + note.slice(1);
}
