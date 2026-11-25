import { publicGuidePdf } from "@/server/guides";

/* The original PDF of a published guide, when its page offers it as a download. */

const notFound = () => new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=60", "X-Content-Type-Options": "nosniff" } });

export async function GET(_request: Request, ctx: RouteContext<"/guides/[slug]/pdf">) {
  const { slug } = await ctx.params;
  const pdf = await publicGuidePdf(slug);
  if (!pdf) return notFound();
  return new Response(new Uint8Array(pdf.data), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.data.length),
      // Inline, so it opens in the browser's viewer; the name is used when it's saved.
      "Content-Disposition": `inline; filename="${pdf.name.replace(/"/g, "")}"`,
      // A replaced PDF keeps the same URL, so revalidate rather than cache for long.
      "Cache-Control": "public, max-age=300, must-revalidate",
      "Last-Modified": pdf.updatedAt.toUTCString(),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
