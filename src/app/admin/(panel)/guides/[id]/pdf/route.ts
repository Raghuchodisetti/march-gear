import { deskUserFor } from "@/server/auth";
import { adminGuidePdf } from "@/server/guides";

/* Staff: any guide's stored PDF (drafts and hidden downloads included). */

export async function GET(_request: Request, ctx: RouteContext<"/admin/guides/[id]/pdf">) {
  const user = await deskUserFor("content");
  if (!user) return new Response("Sign in to the admin to view this file.", { status: 401, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const { id } = await ctx.params;
  const pdf = /^\d{1,10}$/.test(id) ? await adminGuidePdf(Number(id)) : null;
  if (!pdf) return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return new Response(new Uint8Array(pdf.data), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.data.length),
      "Content-Disposition": `inline; filename="${pdf.name.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
