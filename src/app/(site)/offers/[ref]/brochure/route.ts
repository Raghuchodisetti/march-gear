import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { partnerOffers, partners } from "@/db/schema";
import { offerDisplayStatus } from "@/partner/labels";
import { readPartnerFile } from "@/server/partner/files";

/**
 * The PDF brochure of a live public offer. Dealer files are private by default; a brochure attached
 * to an approved, running offer is meant for customers, so it is served here — and only while the
 * offer is live (approved, inside its window, dealership approved).
 */
export async function GET(_req: Request, { params }: RouteContext<"/offers/[ref]/brochure">) {
  const { ref } = await params;
  const notFound = () => new Response("Not found", { status: 404 });
  if (!/^OFF-[A-Z0-9]{6}$/.test(ref)) return notFound();
  const [row] = await getDb()
    .select({ o: partnerOffers })
    .from(partnerOffers)
    .innerJoin(partners, eq(partners.id, partnerOffers.partnerId))
    .where(and(eq(partnerOffers.reference, ref), eq(partners.status, "approved")));
  const brochure = row?.o.media.brochure;
  if (!row || !brochure || offerDisplayStatus(row.o) !== "active") return notFound();
  const file = await readPartnerFile(brochure.id);
  if (!file || file.partnerId !== row.o.partnerId) return notFound();
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(file.size),
      "Content-Disposition": `inline; filename="${file.filename}"`,
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      // A CSP `sandbox` stops the browser's built-in PDF viewer from opening the brochure — images only.
      ...(file.mime === "application/pdf" ? {} : { "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" }),
    },
  });
}
