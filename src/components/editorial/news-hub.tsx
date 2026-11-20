"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, CalendarDays, Clock, Play, Search, X } from "lucide-react";
import type { Article, ArticleCategory } from "@/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { useCatalog } from "@/components/providers/catalog-provider";
import { storyHref, topicLabel } from "./primitives";

/** Topics in the order readers look for them. Values match ?category= links used across the site. */
const TOPICS: { value: "all" | ArticleCategory; label: string }[] = [
  { value: "all", label: "All stories" },
  { value: "News", label: topicLabel("News") },
  { value: "Expert Review", label: topicLabel("Expert Review") },
  { value: "First Drive", label: topicLabel("First Drive") },
  { value: "Electric", label: topicLabel("Electric") },
  { value: "Ownership", label: topicLabel("Ownership") },
  { value: "Industry", label: topicLabel("Industry") },
  { value: "Video", label: topicLabel("Video") },
];

const PAGE = 9;

function inTopic(a: Article, topic: string) {
  if (topic === "all") return true;
  if (a.category === topic) return true;
  return topic === "Electric" && a.tags.includes("Electric");
}

export function NewsHub({ stories }: { stories: Article[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const rawTopic = params.get("category") ?? "all";
  const topic = TOPICS.some((t) => t.value === rawTopic) ? rawTopic : "all";
  const tag = params.get("tag");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);

  const setTopic = (value: string) => {
    const next = new URLSearchParams(params.toString());
    next.delete("tag");
    if (value === "all") next.delete("category");
    else next.set("category", value);
    setShown(PAGE);
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  };
  const clearTag = () => {
    const next = new URLSearchParams(params.toString());
    next.delete("tag");
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return stories.filter((a) => {
      if (!inTopic(a, topic)) return false;
      if (tag && !a.tags.includes(tag)) return false;
      if (!q) return true;
      return `${a.title} ${a.dek} ${a.tags.join(" ")} ${topicLabel(a.category)}`.toLowerCase().includes(q);
    });
  }, [stories, topic, tag, query]);

  // A single top story on the default view; everything else is one simple grid with no repeats.
  const showTop = topic === "all" && !tag && !query.trim();
  const top = showTop ? results.find((a) => a.category !== "Video") : undefined;
  const rest = results.filter((a) => a !== top);
  const visible = rest.slice(0, shown);
  const videos = stories.filter((a) => a.category === "Video").slice(0, 3);

  return (
    <>
      <section aria-label="Stories" className="container-x pb-20 pt-8 md:pb-28 md:pt-10">
        {/* Find a story */}
        <div className="flex flex-col gap-5 border-b border-line pb-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
          <div role="tablist" aria-label="Topics" className="no-scrollbar -mx-5 flex min-w-0 gap-2 overflow-x-auto px-5 lg:mx-0 lg:flex-wrap lg:px-0">
            {TOPICS.map((t) => {
              const on = topic === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTopic(t.value)}
                  className={cn(
                    "inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-[14px] font-medium transition-[background-color,border-color,color] duration-[250ms]",
                    on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink/40",
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <div className="relative w-full shrink-0 lg:w-80">
            <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShown(PAGE);
              }}
              placeholder="Search news, e.g. Creta or mileage"
              aria-label="Search news"
              className="h-11 w-full rounded-full border border-line bg-white pl-11 pr-10 text-[14px] outline-none transition-colors placeholder:text-muted/80 hover:border-ink/30 focus:border-ink [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-mist hover:text-ink"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 text-[14px] text-muted" aria-live="polite">
          <span>
            {results.length === 0 ? "No stories found" : `${results.length} ${results.length === 1 ? "story" : "stories"}`}
            {topic !== "all" && ` in ${TOPICS.find((t) => t.value === topic)?.label}`}
            {query.trim() && ` for “${query.trim()}”`}
          </span>
          {tag && (
            <button type="button" onClick={clearTag} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-ink/20 px-3 text-[13px] font-medium text-ink hover:border-ink">
              About: {tag}
              <X aria-hidden className="size-3.5" />
            </button>
          )}
        </div>

        {top && <TopStory article={top} />}

        {results.length === 0 ? (
          <div className="mt-10 flex flex-col items-center border border-dashed border-line px-6 py-16 text-center">
            <p className="type-h3">We couldn&apos;t find a matching story</p>
            <p className="mt-2 max-w-md text-[15px] text-muted">Try a different word, or look at all stories.</p>
            <Button
              variant="dark"
              className="mt-6"
              onClick={() => {
                setQuery("");
                setTopic("all");
              }}
            >
              Show all stories
            </Button>
          </div>
        ) : (
          <>
            <ul className={cn("grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3", top ? "mt-14" : "mt-8")}>
              <AnimatePresence mode="popLayout" initial={false}>
                {visible.map((a, i) => (
                  <motion.li
                    key={a.slug}
                    layout="position"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    transition={{ duration: 0.4, ease: EASE }}
                  >
                    <StoryCard article={a} eager={!top && i < 2} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
            {rest.length > shown && (
              <div className="mt-12 flex justify-center">
                <Button variant="outline" onClick={() => setShown((n) => n + PAGE)}>
                  Show more stories
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      {showTop && videos.length > 0 && <VideoRow videos={videos} onAll={() => setTopic("Video")} />}
    </>
  );
}

/* ── Pieces ──────────────────────────────────────────────────── */

function Meta({ article, light }: { article: Article; light?: boolean }) {
  const video = article.category === "Video";
  return (
    <p className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]", light ? "text-white/60" : "text-muted")}>
      <span className="inline-flex items-center gap-1.5 num">
        <CalendarDays aria-hidden className="size-3.5" />
        {formatDate(article.publishedOn)}
      </span>
      <span className="inline-flex items-center gap-1.5 num">
        {video ? <Play aria-hidden className="size-3.5" /> : <Clock aria-hidden className="size-3.5" />}
        {video ? `${article.videoDuration} video` : `${article.readMinutes} min read`}
      </span>
    </p>
  );
}

function TopicPill({ category }: { category: ArticleCategory }) {
  return <span className="inline-flex h-6 items-center rounded-full bg-mist px-2.5 text-[12px] font-medium text-ink">{topicLabel(category)}</span>;
}

function TopStory({ article }: { article: Article }) {
  const { getAuthor } = useCatalog();
  const author = getAuthor(article.authorId);
  return (
    <article className="group/top relative mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center lg:gap-12">
      <Link href={storyHref(article)} tabIndex={-1} aria-hidden className="relative block aspect-[16/10] overflow-hidden bg-mist lg:col-span-7">
        <Image
          src={article.image}
          alt=""
          fill
          preload
          sizes="(min-width: 1024px) 58vw, 100vw"
          className="object-cover transition-transform duration-[900ms] ease-[var(--ease-premium)] group-hover/top:scale-[1.03]"
        />
      </Link>
      <div className="lg:col-span-5">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 items-center rounded-full bg-red px-2.5 text-[12px] font-semibold text-white">Top story</span>
          <TopicPill category={article.category} />
        </div>
        <h2 className="type-h2 mt-5 text-balance">
          <Link href={storyHref(article)} className="transition-colors hover:text-red">
            {article.title}
          </Link>
        </h2>
        <p className="mt-4 text-[16px] leading-relaxed text-muted">{article.dek}</p>
        <p className="mt-5 text-[14px]">
          By <span className="font-medium">{author.name}</span>
        </p>
        <div className="mt-2">
          <Meta article={article} />
        </div>
        <Button href={storyHref(article)} variant="dark" arrow className="mt-7">
          Read full story
        </Button>
      </div>
    </article>
  );
}

/** `eager`: the first cards are above the fold when there's no top story (filtered views). */
function StoryCard({ article, eager = false }: { article: Article; eager?: boolean }) {
  const video = article.category === "Video";
  return (
    <article className="group/card relative flex h-full flex-col">
      <div className="relative aspect-[16/10] overflow-hidden bg-mist">
        <Image
          src={article.image}
          alt=""
          fill
          loading={eager ? "eager" : undefined}
          sizes="(min-width: 1024px) 31vw, (min-width: 640px) 46vw, 100vw"
          className="object-cover transition-transform duration-[700ms] ease-[var(--ease-premium)] group-hover/card:scale-[1.04]"
        />
        {video && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="inline-flex size-14 items-center justify-center rounded-full bg-white/95 text-ink shadow-soft">
              <Play aria-hidden className="ml-0.5 size-5 fill-current" />
            </span>
          </span>
        )}
      </div>
      <div className="mt-5 flex flex-1 flex-col">
        <div>
          <TopicPill category={article.category} />
        </div>
        <h3 className="mt-3 text-[18px] font-semibold leading-snug tracking-[-0.01em]">
          <Link href={storyHref(article)} className="after:absolute after:inset-0 group-hover/card:text-red focus-visible:outline-none">
            {article.title.replace(/^Video: /, "")}
          </Link>
        </h3>
        <p className="mt-2 line-clamp-2 text-[14.5px] leading-relaxed text-muted">{article.dek}</p>
        <div className="mt-4">
          <Meta article={article} />
        </div>
        <span className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-medium">
          {video ? "Watch video" : "Read story"}
          <ArrowRight aria-hidden className="size-4 text-red transition-transform duration-[250ms] group-hover/card:translate-x-0.5" />
        </span>
      </div>
    </article>
  );
}

function VideoRow({ videos, onAll }: { videos: Article[]; onAll: () => void }) {
  return (
    <section aria-labelledby="videos-title" className="bg-ink py-16 text-white md:py-20">
      <div className="container-x">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="videos-title" className="type-h2">
              Watch car videos
            </h2>
            <p className="mt-2 text-[15px] text-white/60">Short films from our test drives and road trips.</p>
          </div>
          <button type="button" onClick={onAll} className="inline-flex items-center gap-1.5 text-[14px] font-medium text-white/80 hover:text-white">
            All videos <ArrowRight aria-hidden className="size-4 text-red" />
          </button>
        </div>
        <ul className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v) => (
            <li key={v.slug}>
              <Link href={storyHref(v)} className="group/vid block">
                <span className="relative block aspect-video overflow-hidden bg-ink-2">
                  <Image src={v.image} alt="" fill sizes="(min-width: 1024px) 31vw, (min-width: 640px) 46vw, 100vw" className="object-cover opacity-80 transition-[transform,opacity] duration-[700ms] group-hover/vid:scale-[1.04] group-hover/vid:opacity-95" />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="inline-flex size-14 items-center justify-center rounded-full bg-white text-ink transition-transform duration-[400ms] group-hover/vid:scale-110">
                      <Play aria-hidden className="ml-0.5 size-5 fill-current" />
                    </span>
                  </span>
                  <span className="absolute bottom-3 right-3 bg-ink/75 px-2 py-1 text-[12px] font-medium num">{v.videoDuration}</span>
                </span>
                <span className="mt-4 block text-[17px] font-semibold leading-snug group-hover/vid:text-white/80">{v.title.replace(/^Video: /, "")}</span>
                <span className="mt-2 block">
                  <Meta article={v} light />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function NewsHubSkeleton() {
  return (
    <div className="container-x pb-20 pt-8" aria-busy="true" aria-label="Loading stories">
      <div className="flex gap-2 overflow-hidden border-b border-line pb-6">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="skeleton h-10 w-28 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="skeleton aspect-[16/10] lg:col-span-7" />
        <div className="space-y-4 lg:col-span-5">
          <div className="skeleton h-6 w-32 rounded-full" />
          <div className="skeleton h-10 w-full" />
          <div className="skeleton h-10 w-4/5" />
          <div className="skeleton h-16 w-full" />
        </div>
      </div>
    </div>
  );
}
