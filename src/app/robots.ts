import type { MetadataRoute } from "next";
import { INDEXABLE, absoluteUrl } from "@/components/seo/site";

/**
 * robots.txt. Production (and self-hosted builds): the public site is open; the portals, account area,
 * sign-in, APIs, private quote links and ad click-throughs are closed, as are internal search results.
 * Filter/sort variants (?body=, ?city=, ?sort=…) stay crawlable — every page declares its clean URL as
 * canonical, which consolidates them. Vercel preview deployments are closed entirely (see INDEXABLE).
 *
 * Robots rules are prefix matches, so "/dealer" alone would also block "/dealers": the portal is
 * matched as "/dealer$" + "/dealer/".
 */
export default function robots(): MetadataRoute.Robots {
  if (!INDEXABLE) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/staff",
        "/dealer$",
        "/dealer/",
        "/insurance-vendor",
        "/account",
        "/login",
        "/wishlist",
        "/api/",
        "/insurance/quote/",
        "/ads/click/",
        // Internal search results.
        "/*?q=",
        "/*&q=",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
