import type { NextRequest } from "next/server";
import { getCatalog } from "@/server/catalog";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX = 12;

/**
 * Full catalogue models on demand: GET /api/catalog/cars?slugs=a,b. The browser's catalogue holds
 * every model in its light shape (CarLite); tools that let you pick any car (compare, the home
 * showcase, dealer stock) fetch the full details of the ones picked. Public, cacheable data.
 */
export async function GET(req: NextRequest) {
  const slugs = [...new Set((req.nextUrl.searchParams.get("slugs") ?? "").split(",").map((s) => s.trim()))].filter((s) => s.length <= 120 && SLUG.test(s)).slice(0, MAX);
  const cat = await getCatalog();
  const cars = slugs.map((s) => cat.getCar(s)).filter((c) => c !== undefined);
  return Response.json({ cars }, { headers: { "Cache-Control": "public, max-age=120, stale-while-revalidate=600" } });
}
