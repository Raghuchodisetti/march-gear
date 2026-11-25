import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { media } from "@/db/schema";
import { MEDIA_THUMB_WIDTH } from "@/components/admin/media-shared";

/* Public: serves an uploaded image from the database. URLs are /media/<id>/<filename>;
   the bytes behind an id never change, so responses are cached for a year.
   `?w=960` (any width up to MEDIA_THUMB_WIDTH) asks for the smaller card rendition (imported catalogue photos have one); without
   one, the original is served. The image loader (src/lib/image-loader.ts) adds it for small sizes. */

const notFound = () =>
  new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=60", "X-Content-Type-Options": "nosniff" } });

/** True when an If-None-Match header lists this ETag (weak comparison, as for GET). */
function matches(header: string | null, etag: string) {
  if (!header) return false;
  if (header.trim() === "*") return true;
  const bare = etag.replace(/^W\//, "");
  return header.split(",").some((t) => t.trim().replace(/^W\//, "") === bare);
}

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
      createdAt: media.createdAt,
      thumbSize: sql<number | null>`LENGTH(${media.thumb})`.mapWith((v) => (v === null ? null : Number(v))),
    })
    .from(media)
    .where(eq(media.id, Number(id)))
    .limit(1);
  // The name is part of the identity, so a stale link to a reused id can't show the wrong picture.
  if (!meta || meta.filename !== name) return notFound();

  const thumb = wantsThumb && meta.thumbSize !== null && meta.thumbSize > 0;
  const etag = `"m${meta.id}-${meta.size.toString(36)}-${meta.createdAt.getTime().toString(36)}${thumb ? "-t" : ""}"`;
  const headers = new Headers({
    "Cache-Control": "public, max-age=31536000, immutable",
    ETag: etag,
    "Last-Modified": meta.createdAt.toUTCString(),
    "X-Content-Type-Options": "nosniff",
  });
  if (matches(request.headers.get("if-none-match"), etag)) return new Response(null, { status: 304, headers });

  // Only now load the bytes (a 304 never touches the blob).
  const [row] = thumb
    ? await db.select({ data: media.thumb }).from(media).where(eq(media.id, meta.id)).limit(1)
    : await db.select({ data: media.data }).from(media).where(eq(media.id, meta.id)).limit(1);
  if (!row?.data) return notFound();
  // Card renditions are always WebP (the importer makes them); originals keep their own type.
  headers.set("Content-Type", thumb ? "image/webp" : meta.mime);
  headers.set("Content-Length", String(row.data.length));
  headers.set("Content-Disposition", `inline; filename="${meta.filename}"`);
  return new Response(new Uint8Array(row.data), { status: 200, headers });
}
