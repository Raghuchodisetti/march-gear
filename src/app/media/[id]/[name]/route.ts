import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { media } from "@/db/schema";
import { MEDIA_THUMB_WIDTH } from "@/components/admin/media-shared";
import { sniffImage } from "@/server/admin/media";
import { cloudUrl, readCloudFile } from "@/server/media-store";

/* Public: an uploaded image. URLs are /media/<id>/<filename>; the bytes behind an id never change, so responses
   (and redirects) are cached for a year. `?w=960` (any width up to MEDIA_THUMB_WIDTH) asks for the smaller card copy;
   the image loader (src/lib/image-loader.ts) adds it for small sizes.
   Images in the database are served from here. Images in the cloud folder (src/server/media-store.ts) redirect to
   MEDIA_CLOUD_URL, or — without one (local development) — are read from MEDIA_CLOUD_DIR. */

const notFound = () =>
  new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=60", "X-Content-Type-Options": "nosniff" } });

/** True when an If-None-Match header lists this ETag (weak comparison, as for GET). */
function matches(header: string | null, etag: string) {
  if (!header) return false;
  if (header.trim() === "*") return true;
  const bare = etag.replace(/^W\//, "");
  return header.split(",").some((t) => t.trim().replace(/^W\//, "") === bare);
}

const YEAR = "public, max-age=31536000, immutable";

export async function GET(request: Request, ctx: RouteContext<"/media/[id]/[name]">) {
  const { id, name } = await ctx.params;
  if (!/^\d{1,10}$/.test(id)) return notFound();
  const w = Number(new URL(request.url).searchParams.get("w"));
  const wantsThumb = w > 0 && w <= MEDIA_THUMB_WIDTH;
  const db = getDb();
  const [meta] = await db
    .select({
      id: media.id,
      filename: media.filename,
      mime: media.mime,
      size: media.size,
      storage: media.storage,
      createdAt: media.createdAt,
      thumbSize: sql<number | null>`LENGTH(${media.thumb})`.mapWith((v) => (v === null ? null : Number(v))),
    })
    .from(media)
    .where(eq(media.id, Number(id)))
    .limit(1);
  // The name is part of the identity, so a stale link to a reused id can't show the wrong picture.
  if (!meta || meta.filename !== name) return notFound();

  const cloud = meta.storage === "cloud";
  // Cloud images always have a card copy file; database images may not (older uploads, GIFs).
  const thumb = wantsThumb && (cloud || (meta.thumbSize !== null && meta.thumbSize > 0));

  if (cloud) {
    const url = cloudUrl(meta.id, meta.filename, thumb);
    if (url) return new Response(null, { status: 308, headers: { Location: url, "Cache-Control": YEAR } });
  }

  const etag = `"m${meta.id}-${meta.size.toString(36)}-${meta.createdAt.getTime().toString(36)}${thumb ? "-t" : ""}"`;
  const headers = new Headers({ "Cache-Control": YEAR, ETag: etag, "Last-Modified": meta.createdAt.toUTCString(), "X-Content-Type-Options": "nosniff" });
  if (matches(request.headers.get("if-none-match"), etag)) return new Response(null, { status: 304, headers });

  // Only now load the bytes (a 304 never touches them).
  let data: Buffer | null;
  if (cloud) {
    data = await readCloudFile(meta.id, meta.filename, thumb);
    if (!data) console.error(`[media] ${meta.id}/${meta.filename} is in the cloud folder, but neither MEDIA_CLOUD_URL nor a readable MEDIA_CLOUD_DIR is set`);
  } else {
    const [row] = thumb
      ? await db.select({ data: media.thumb }).from(media).where(eq(media.id, meta.id)).limit(1)
      : await db.select({ data: media.data }).from(media).where(eq(media.id, meta.id)).limit(1);
    data = row?.data ?? null;
  }
  if (!data) return notFound();
  // A card copy is WebP or JPEG (or the image itself); the original keeps its own type.
  headers.set("Content-Type", thumb ? (sniffImage(data)?.mime ?? meta.mime) : meta.mime);
  headers.set("Content-Length", String(data.length));
  headers.set("Content-Disposition", `inline; filename="${meta.filename}"`);
  return new Response(new Uint8Array(data), { status: 200, headers });
}
