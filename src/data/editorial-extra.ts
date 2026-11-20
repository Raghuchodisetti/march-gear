import type { Article, ArticleCategory, Author, BodyType } from "@/types";
import type { Catalog } from "@/lib/catalog";

/* ──────────────────────────────────────────────────────────────
   Editorial helpers for /news, /reviews and /about. Every story,
   author profile and featured pick lives in the database (or a content
   block); these helpers only read the catalogue they're given.
   Client components import from this file, so it stays pure.
   ────────────────────────────────────────────────────────────── */

export const ARTICLE_CATEGORIES: ArticleCategory[] = [
  "News",
  "Expert Review",
  "First Drive",
  "Industry",
  "Electric",
  "Video",
  "Ownership",
];

export function isArticleCategory(value: string | null | undefined): value is ArticleCategory {
  return !!value && (ARTICLE_CATEGORIES as string[]).includes(value);
}

/** The Electric desk also collects any story tagged "Electric". */
export function inCategory(article: Article, category: ArticleCategory) {
  if (article.category === category) return true;
  return category === "Electric" && article.tags.includes("Electric");
}

export function storiesIn(category: ArticleCategory, cat: Catalog) {
  return cat.articles.filter((a) => inCategory(a, category));
}

/** Same category first, then by number of shared tags; newest breaks ties. */
export function relatedStories(article: Article, cat: Catalog, limit = 3) {
  return cat.articles
    .filter((a) => a.slug !== article.slug)
    .map((a) => ({
      a,
      score: (a.category === article.category ? 3 : 0) + a.tags.filter((t) => article.tags.includes(t)).length,
    }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score || (x.a.publishedOn < y.a.publishedOn ? 1 : -1))
    .slice(0, limit)
    .map((x) => x.a);
}

/** Tags that appear most across the archive. */
export function trendingTags(cat: Catalog): string[] {
  const counts = new Map<string, number>();
  for (const a of cat.articles) for (const t of a.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12)
    .map(([t]) => t);
}

/* ── People ─────────────────────────────────────────────────── */

/** An author's profile (edited in the admin panel). Missing fields stay undefined — render them only when set. */
export type AuthorProfile = Pick<Author, "bio" | "beat" | "base" | "joined">;

export function authorProfile(id: string, cat: Catalog): AuthorProfile {
  const a = cat.getAuthor(id);
  return { bio: a?.bio || undefined, beat: a?.beat || undefined, base: a?.base || undefined, joined: a?.joined || undefined };
}

/* ── Reviews ────────────────────────────────────────────────── */

export const REVIEW_BODY_TYPES: BodyType[] = ["SUV", "Sedan", "Hatchback", "MUV", "Coupe"];

/** The share of owner reviews that count as a recommendation. */
export const RECOMMEND_THRESHOLD = 4;
