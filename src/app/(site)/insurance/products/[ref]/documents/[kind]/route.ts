import type { NextRequest } from "next/server";
import { after } from "next/server";
import { getPublicProductDocument } from "@/server/insurance/public";
import { privateFileHeaders, readInsurerFile } from "@/server/insurance/files";
import { recordInsEvent } from "@/server/insurance/market";
import { HOUR, allowFromIp } from "@/server/rate-limit";

/**
 * A public product's brochure or policy wording. Vendor files are private (ins_files); these two are
 * meant for customers, so they're served here — only while the product is public (published, vendor
 * approved, company active). ?download=1 saves instead of opening. Counts a document_download.
 */
export async function GET(req: NextRequest, { params }: RouteContext<"/insurance/products/[ref]/documents/[kind]">) {
  const { ref, kind } = await params;
  const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  if (kind !== "brochure" && kind !== "wording") return notFound();
  const doc = await getPublicProductDocument(ref, kind);
  if (!doc) return notFound();
  const file = await readInsurerFile(doc.fileId);
  // Only the vendor's own upload of that exact kind — never a KYC, tie-up letter or other private file.
  if (!file || file.vendorId !== doc.vendorId || file.kind !== (kind === "wording" ? "policy_wording" : "brochure")) return notFound();

  if (await allowFromIp(`ins-doc:${doc.productId}:${kind}`, 30, HOUR)) after(() => recordInsEvent("document_download", doc.vendorId, doc.productId));
  const download = req.nextUrl.searchParams.get("download") === "1";
  return new Response(new Uint8Array(file.data), { headers: privateFileHeaders(file, download, "public, max-age=300") });
}
