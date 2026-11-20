import type { NextRequest } from "next/server";
import { getSessionUser, isStaff } from "@/server/auth";
import { getInsurerContext } from "@/server/insurance/context";
import { privateFileHeaders, readInsurerFile } from "@/server/insurance/files";

/** A private insurance vendor file — only for that vendor's members and MarchGear staff. */
export async function GET(req: NextRequest, { params }: RouteContext<"/insurance-vendor/files/[id]">) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return new Response("Not found", { status: 404 });
  const user = await getSessionUser();
  if (!user) return new Response("Sign in to view this file.", { status: 401 });

  const file = await readInsurerFile(Number(id));
  if (!file) return new Response("Not found", { status: 404 });
  if (!isStaff(user.role)) {
    const ctx = await getInsurerContext();
    // Same 404 as a missing file, so ids of other vendors' documents can't be probed.
    if (!ctx || ctx.vendor.id !== file.vendorId) return new Response("Not found", { status: 404 });
  }

  const download = req.nextUrl.searchParams.get("download") === "1";
  return new Response(new Uint8Array(file.data), { headers: privateFileHeaders(file, download) });
}
