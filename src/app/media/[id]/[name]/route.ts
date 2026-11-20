import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { media } from "@/db/schema";

/* Public: serves an uploaded image from the database. URLs are /media/<id>/<filename>;
   the bytes behind an id never change, so responses are cached for a year. */

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
  const db = getDb();
  const [meta] = await db
    .select({ id: media.id, filename: media.filename, mime: media.mime, size: media.size, createdAt: media.createdAt })
    .from(media)
    .where(eq(media.id, Number(id)))
    .limit(1);
  // The name is part of the identity, so a stale link to a reused id can't show the wrong picture.
  if (!meta || meta.filename !== name) return notFound();

  const etag = `"m${meta.id}-${meta.size.toString(36)}-${meta.createdAt.getTime().toString(36)}"`;
  const headers = new Headers({
    "Cache-Control": "public, max-age=31536000, immutable",
    ETag: etag,
    "Last-Modified": meta.createdAt.toUTCString(),
    "X-Content-Type-Options": "nosniff",
  });
  if (matches(request.headers.get("if-none-match"), etag)) return new Response(null, { status: 304, headers });

  // Only now load the bytes (a 304 never touches the blob).
  const [row] = await db.select({ data: media.data }).from(media).where(eq(media.id, meta.id)).limit(1);
  if (!row) return notFound();
  headers.set("Content-Type", meta.mime);
  headers.set("Content-Length", String(row.data.length));
  headers.set("Content-Disposition", `inline; filename="${meta.filename}"`);
  return new Response(new Uint8Array(row.data), { status: 200, headers });
}
