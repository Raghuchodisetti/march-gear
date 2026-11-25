/* ──────────────────────────────────────────────────────────────
   Canonical origin and indexing switch — shared by the root
   metadata, robots.txt, the sitemap, JSON-LD and OG images.
   Safe in client components too: only NEXT_PUBLIC_* and NODE_ENV
   are read, and both are inlined at build time.
   ────────────────────────────────────────────────────────────── */

/** The live domain. www. is redirected to it (next.config.mjs). */
export const PRODUCTION_ORIGIN = "https://marchgear.in";

/**
 * Canonical origin, no trailing slash: NEXT_PUBLIC_SITE_URL, else the live domain in production builds,
 * else the local dev server. Canonicals, og:url, the sitemap and structured data all use it.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || (process.env.NODE_ENV === "production" ? PRODUCTION_ORIGIN : "http://localhost:3000")
).replace(/\/+$/, "");

/**
 * Whether search engines may index this deployment. Vercel preview deployments (VERCEL_ENV=preview) are
 * kept out of search (robots.txt "Disallow: /" and a noindex meta); production and self-hosted builds are open.
 * Server-only (VERCEL_ENV isn't inlined into client bundles) — read it in metadata, robots and the sitemap.
 */
export const INDEXABLE = process.env.VERCEL_ENV ? process.env.VERCEL_ENV === "production" : true;

export const SITE_NAME = "MarchGear";
export const SITE_LOCALE = "en_IN";

/** "/cars/x" → "https://marchgear.in/cars/x" ("/" → the bare origin). Absolute URLs pass through. */
export function absoluteUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const clean = `/${path.replace(/^\/+/, "")}`;
  return clean === "/" ? SITE_URL : `${SITE_URL}${clean}`;
}
