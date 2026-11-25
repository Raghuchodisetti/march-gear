import type { Metadata } from "next";
import { SITE_LOCALE, SITE_NAME } from "./site";

/* ──────────────────────────────────────────────────────────────
   One helper for every public page's metadata, so each page gets
   the same set: title + description, a canonical URL (query
   variants — filters, sorting, search — all point at the clean
   path), and Open Graph / Twitter tags with og:url, site name and
   the en_IN locale. URLs are relative; metadataBase (root layout)
   makes them absolute.
   ────────────────────────────────────────────────────────────── */

export type OgImage = { url: string; width?: number; height?: number; alt?: string };

/** The branded default share card (src/app/opengraph-image.tsx). */
export const DEFAULT_OG_IMAGE: OgImage = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "MarchGear — research, compare and buy cars in India",
};

/** The insurance section's share card (src/app/og/insurance/route.tsx). */
export const INSURANCE_OG_IMAGE: OgImage = {
  url: "/og/insurance",
  width: 1200,
  height: 630,
  alt: "Car insurance on MarchGear — compare cover, then request quotes",
};

/** An Unsplash photo resized and cropped to the 1200×630 share-card shape (raw Unsplash URLs are full-size originals). */
export function shareImage(src: string, alt: string): OgImage {
  if (!/^https:\/\/images\.unsplash\.com\//.test(src)) return { url: src, alt };
  const url = new URL(src);
  url.searchParams.set("w", "1200");
  url.searchParams.set("h", "630");
  url.searchParams.set("fit", "crop");
  url.searchParams.set("crop", "entropy");
  url.searchParams.set("auto", "format");
  url.searchParams.set("q", "80");
  return { url: url.toString(), width: 1200, height: 630, alt };
}

interface PageSeo {
  /** Page title without the brand — the root template appends " · MarchGear". Keep it under ~48 characters. */
  title: string;
  /** 70–160 characters. */
  description: string;
  /** Clean path of the page ("/new-cars"), used for the canonical URL and og:url. */
  path: string;
  /**
   * Share images. Default: the branded site card. Pass `"segment"` when the route segment has its own
   * opengraph-image file — Next only applies a file image when the page doesn't set `openGraph.images`.
   */
  images?: OgImage[] | "segment";
  /** Open Graph type. */
  type?: "website" | "article";
  /** Use the title as-is, without the site-name template (the home page). */
  absoluteTitle?: boolean;
  /** Extra Open Graph fields for articles. */
  article?: { publishedTime?: string; modifiedTime?: string; authors?: string[]; section?: string; tags?: string[] };
  /** Keep the page out of search results (still followable). */
  noindex?: boolean;
}

export function pageMetadata({ title, description, path, images, type = "website", absoluteTitle, article, noindex }: PageSeo): Metadata {
  const ogImages = images === "segment" ? undefined : (images ?? [DEFAULT_OG_IMAGE]);
  const openGraph: NonNullable<Metadata["openGraph"]> = {
    title,
    description,
    url: path,
    siteName: SITE_NAME,
    locale: SITE_LOCALE,
    ...(type === "article" ? { type: "article", ...article } : { type: "website" }),
    // Leaving the key out (not `undefined`) is what lets a segment's opengraph-image file apply.
    ...(ogImages ? { images: ogImages } : {}),
  };
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph,
    // Title, description and image are filled in from openGraph.
    twitter: { card: "summary_large_image" },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

/** Room for a page title before the " · MarchGear" suffix, keeping the full title within ~60 characters. */
export const TITLE_MAX = 48;

/** Cut on a word boundary and add an ellipsis. */
function clipWords(text: string, max: number) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:—–-]+$/, "")}…`;
}

/** The first candidate that fits the title budget, else the last one clipped. Order candidates most → least descriptive. */
export function fitTitle(candidates: string[], max = TITLE_MAX) {
  const list = candidates.map((c) => c.replace(/\s+/g, " ").trim()).filter(Boolean);
  return list.find((c) => c.length <= max) ?? clipWords(list[list.length - 1] ?? "", max);
}

/**
 * Sentences joined while they fit 160 characters. An array is a set of alternatives, longest first: the first
 * that still fits is used. A first sentence that alone is too long is clipped.
 */
export function fitDescription(...sentences: (string | string[] | false | null | undefined)[]) {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  let out = "";
  for (const item of sentences) {
    const options = (Array.isArray(item) ? item : [item]).filter((s): s is string => Boolean(s && s.trim())).map(norm);
    if (!options.length) continue;
    const fit = options.find((o) => (out ? `${out} ${o}` : o).length <= 160);
    if (fit) out = out ? `${out} ${fit}` : fit;
    else if (!out) out = clipWords(options[options.length - 1], 160);
  }
  return out;
}

/** For private or utility pages (sign-in, saved cars, quote links): never indexed, links not followed. */
export const PRIVATE_ROBOTS: Metadata["robots"] = { index: false, follow: false, nocache: true };
