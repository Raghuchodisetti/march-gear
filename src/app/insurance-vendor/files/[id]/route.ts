import type { NextRequest } from "next/server";
import { backOfficeUser } from "@/server/auth";
import { getInsurerContext } from "@/server/insurance/context";
import { privateFileHeaders, readInsurerFile } from "@/server/insurance/files";

/** A private insurance vendor file — only for that vendor's members and MarchGear staff. */
export async function GET(req: NextRequest, { params }: RouteContext<"/insurance-vendor/files/[id]">) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return new Response("Not found", { status: 404 });
  // MarchGear admins or staff with this section (their own sign-ins), or a member of the vendor (insurance portal sign-in) — each login has its own session.
  const staff = await backOfficeUser("insurance");
  const ctx = staff ? null : await getInsurerContext();
  if (!staff && !ctx) return new Response("Sign in to view this file.", { status: 401 });

  const file = await readInsurerFile(Number(id));
  if (!file) return new Response("Not found", { status: 404 });
  // Same 404 as a missing file, so ids of other vendors' documents can't be probed.
  if (!staff && ctx?.vendor.id !== file.vendorId) return new Response("Not found", { status: 404 });

  const download = req.nextUrl.searchParams.get("download") === "1";
  return new Response(new Uint8Array(file.data), { headers: privateFileHeaders(file, download) });
}
