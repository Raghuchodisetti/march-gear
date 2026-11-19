import Link from "next/link";
import { getCatalog } from "@/server/catalog";
import { allArticles } from "@/data/editorial-extra";
import { Eyebrow } from "@/components/ui/section-heading";
import { Button } from "@/components/ui/button";
import { CategoryLabel, StoryMeta, storyHref } from "@/components/editorial/primitives";

/** Shown when /news/[slug] does not match a story. */
export default async function StoryNotFound() {
  const cat = await getCatalog();
  const latest = allArticles(cat).slice(0, 3);
  return (
    <section className="container-x py-14 md:py-20">
      <div className="max-w-2xl">
        <Eyebrow>Story not found</Eyebrow>
        <h1 className="type-h1 mt-5 text-balance">
          This page has <span className="type-editorial">moved on.</span>
        </h1>
        <p className="type-lead mt-6 text-muted">The story you were looking for may have been renamed or retired. Here is what we&apos;ve published most recently.</p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Button href="/news" variant="dark" arrow>
            Go to News &amp; Media
          </Button>
          <Button href="/reviews" variant="outline">
            Expert reviews
          </Button>
        </div>
      </div>
      <ul className="mt-16 border-t border-line">
        {latest.map((a) => (
          <li key={a.slug} className="relative border-b border-line py-6">
            <CategoryLabel category={a.category} />
            <h2 className="type-h4 mt-3">
              <Link href={storyHref(a)} className="after:absolute after:inset-0 hover:text-ink/70 focus-visible:outline-none">
                {a.title}
              </Link>
            </h2>
            <StoryMeta article={a} author={cat.getAuthor(a.authorId)} className="mt-2" />
          </li>
        ))}
      </ul>
    </section>
  );
}
