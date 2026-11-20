import type { NextRequest } from "next/server";
import { getSessionUser, isStaff } from "@/server/auth";
import { getPartnerContext } from "@/server/partner/context";
import { readPartnerFile } from "@/server/partner/files";

/** A private dealer file — only for that dealership's members and MarchGear staff. */
export async function GET(req: NextRequest, { params }: RouteContext<"/dealer/files/[id]">) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return new Response("Not found", { status: 404 });
  const user = await getSessionUser();
  if (!user) return new Response("Sign in to view this file.", { status: 401 });

  const file = await readPartnerFile(Number(id));
  if (!file) return new Response("Not found", { status: 404 });
  if (!isStaff(user.role)) {
    const ctx = await getPartnerContext();
    // Same 404 as a missing file, so ids of other dealers' documents can't be probed.
    if (!ctx || ctx.partner.id !== file.partnerId) return new Response("Not found", { status: 404 });
  }

  const download = req.nextUrl.searchParams.get("download") === "1";
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(file.size),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${file.filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      // Images: lock the response down completely. PDFs open in the browser's own sandboxed viewer,
      // which a CSP `sandbox` would block — so they only get nosniff + a strict type.
      ...(file.mime === "application/pdf" ? {} : { "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" }),
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}
