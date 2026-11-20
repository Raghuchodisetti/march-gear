import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { media } from "@/db/schema";

/* Creative images are /media/<id>/<filename> URLs. Vendors may only use their own uploads. */

const MEDIA_URL = /^\/media\/(\d{1,10})\/([^/?#\s]{1,200})$/;

export const mediaRef = (url: string | null | undefined) => {
  const m = MEDIA_URL.exec(url ?? "");
  return m ? { id: Number(m[1]), filename: decodeURIComponent(m[2]) } : null;
};

/** True when every URL is an image in the media library (and, with `vendorId`, uploaded by that vendor). */
export async function mediaUsable(urls: string[], vendorId?: number) {
  const refs = urls.map(mediaRef);
  if (refs.some((r) => !r)) return false;
  const ids = [...new Set(refs.map((r) => r!.id))];
  const rows = await getDb()
    .select({ id: media.id, filename: media.filename, mime: media.mime })
    .from(media)
    .where(and(inArray(media.id, ids), vendorId !== undefined ? eq(media.insVendorId, vendorId) : undefined));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return refs.every((r) => {
    const row = byId.get(r!.id);
    return row && row.filename === r!.filename && row.mime.startsWith("image/");
  });
}

/** Pixel sizes of creative images, for the review screen. */
export async function mediaSizes(urls: (string | null)[]) {
  const refs = urls.map(mediaRef).filter((r): r is NonNullable<typeof r> => r !== null);
  const out = new Map<string, { width: number | null; height: number | null; size: number }>();
  if (!refs.length) return out;
  const rows = await getDb()
    .select({ id: media.id, filename: media.filename, width: media.width, height: media.height, size: media.size })
    .from(media)
    .where(inArray(media.id, [...new Set(refs.map((r) => r.id))]));
  for (const r of rows) out.set(`/media/${r.id}/${r.filename}`, { width: r.width, height: r.height, size: r.size });
  return out;
}
