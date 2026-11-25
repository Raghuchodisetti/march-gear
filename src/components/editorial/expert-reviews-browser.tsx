"use client";

import Image from "next/image";
import { cardPhotoAlt } from "@/lib/image-alt";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, SearchX } from "lucide-react";
import type { BodyType } from "@/types";
import { REVIEW_BODY_TYPES } from "@/data/editorial-extra";
import { Chip } from "@/components/ui/chip";
import { SelectField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/page-header";
import { formatDate } from "@/lib/format";
import { ScoreDial } from "./score-dial";

export interface ReviewEntry {
  slug: string;
  carSlug: string;
  carName: string;
  brand: string;
  brandLabel: string;
  bodyType: BodyType;
  image: string;
  focus?: string;
  title: string;
  verdict: string;
  score: number;
  author: string;
  publishedOn: string;
}

type Sort = "score" | "newest" | "name";
const PAGE = 8;

const BODY_LABEL: Record<BodyType, string> = {
  SUV: "SUVs",
  Sedan: "Sedans",
  Hatchback: "Hatchbacks",
  MUV: "MUVs",
  Coupe: "Coupés",
};

export function ExpertReviewsBrowser({ entries }: { entries: ReviewEntry[] }) {
  const [body, setBody] = useState<BodyType | "all">("all");
  const [brand, setBrand] = useState("");
  const [sort, setSort] = useState<Sort>("score");
  const key = `${body}|${brand}|${sort}`;
  const [page, setPage] = useState({ key, limit: PAGE });
  const limit = page.key === key ? page.limit : PAGE;

  const brandOptions = Array.from(new Map(entries.map((e) => [e.brand, e.brandLabel])).entries())
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([value, label]) => ({ value, label: `${label} (${entries.filter((e) => e.brand === value).length})` }));

  const filtered = entries
    .filter((e) => (body === "all" || e.bodyType === body) && (!brand || e.brand === brand))
    .sort((a, b) => {
      if (sort === "newest") return a.publishedOn < b.publishedOn ? 1 : a.publishedOn > b.publishedOn ? -1 : b.score - a.score;
      if (sort === "name") return `${a.brandLabel} ${a.carName}`.localeCompare(`${b.brandLabel} ${b.carName}`);
      return b.score - a.score;
    });
  const visible = filtered.slice(0, limit);
  const clear = () => {
    setBody("all");
    setBrand("");
  };

  return (
    <div>
      <div className="flex flex-col gap-6 border-b border-line pb-6 xl:flex-row xl:items-end xl:justify-between">
        <div role="group" aria-label="Filter by body type" className="no-scrollbar -mx-5 flex min-w-0 gap-2 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0">
          <Chip selected={body === "all"} onClick={() => setBody("all")}>
            All
          </Chip>
          {REVIEW_BODY_TYPES.map((b) => {
            const count = entries.filter((e) => e.bodyType === b).length;
            if (!count) return null;
            return (
              <Chip key={b} selected={body === b} onClick={() => setBody(b)}>
                {BODY_LABEL[b]} <span className="text-[11.5px] opacity-75 num">{count}</span>
              </Chip>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex sm:gap-4">
          <SelectField
            aria-label="Filter by brand"
            placeholder="All brands"
            options={brandOptions}
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="sm:w-56"
          />
          <SelectField
            aria-label="Sort reviews"
            options={[
              { value: "score", label: "Highest score" },
              { value: "newest", label: "Most recent" },
              { value: "name", label: "A – Z" },
            ]}
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="sm:w-48"
          />
        </div>
      </div>

      <p className="mt-5 text-[13px] text-muted" aria-live="polite">
        <span className="num">{filtered.length}</span> {filtered.length === 1 ? "review" : "reviews"}
        {body !== "all" && <> · {BODY_LABEL[body]}</>}
        {brand && <> · {entries.find((e) => e.brand === brand)?.brandLabel}</>}
      </p>

      {visible.length > 0 ? (
        <>
          <ol className="mt-2">
            {visible.map((e) => (
              <li key={e.slug}>
                <ReviewRow entry={e} />
              </li>
            ))}
          </ol>
          {filtered.length > visible.length && (
            <div className="mt-12 flex flex-col items-center gap-3">
              <Button variant="outline" onClick={() => setPage({ key, limit: limit + PAGE })}>
                Show more reviews
              </Button>
              <p className="text-[12.5px] text-muted num">
                {visible.length} of {filtered.length}
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="mt-8">
          <EmptyState
            icon={<SearchX className="size-6" />}
            title="No reviews match"
            description="We haven't reviewed that combination yet. Clear the filters to see every car we've tested."
            action={
              <Button variant="dark" onClick={clear}>
                Clear filters
              </Button>
            }
          />
        </div>
      )}
    </div>
  );
}

function ReviewRow({ entry }: { entry: ReviewEntry }) {
  const href = `/cars/${entry.carSlug}#reviews`;
  return (
    <article className="group/rv relative grid grid-cols-[96px_1fr_auto] items-start gap-4 border-b border-line py-6 sm:grid-cols-[200px_1fr_auto] sm:gap-8 md:py-8 lg:grid-cols-[240px_1fr_auto]">
      <div className="relative aspect-[4/3] overflow-hidden bg-mist">
        <Image
          src={entry.image}
          alt={cardPhotoAlt(entry.image, `${entry.brandLabel} ${entry.carName}`)}
          fill
          sizes="(min-width: 1024px) 240px, (min-width: 640px) 200px, 96px"
          className="object-cover transition-transform duration-[700ms] ease-[var(--ease-premium)] group-hover/rv:scale-[1.05]"
          style={{ objectPosition: entry.focus ?? "50% 55%" }}
        />
      </div>
      <div className="min-w-0">
        <p className="type-eyebrow text-muted">
          {entry.brandLabel} <span className="text-ink/25">/</span> {entry.bodyType}
        </p>
        <h3 className="type-h4 mt-2 sm:type-h3">
          <Link href={href} className="after:absolute after:inset-0 stretched-focus">
            {entry.carName}
          </Link>
        </h3>
        <p className="mt-1.5 hidden text-[15px] font-medium text-ink/80 sm:block">{entry.title}</p>
        <p className="mt-3 hidden max-w-2xl text-[14.5px] leading-relaxed text-muted sm:line-clamp-2">{entry.verdict}</p>
        <p className="mt-3 text-[12.5px] text-muted">
          <span className="text-ink">{entry.author}</span> · <span className="num">{formatDate(entry.publishedOn)}</span>
        </p>
      </div>
      <div className="flex flex-col items-end gap-4">
        <ScoreDial score={entry.score} size={46} showMax={false} className="sm:hidden" />
        <ScoreDial score={entry.score} size={80} className="hidden sm:inline-flex" />
        <span className="hidden items-center gap-1 text-[12.5px] font-medium text-ink opacity-0 transition-opacity duration-[400ms] group-hover/rv:opacity-100 md:inline-flex">
          Read <ArrowUpRight className="size-3.5 text-red" aria-hidden />
        </span>
      </div>
      <p className="col-span-3 line-clamp-2 text-[14px] leading-relaxed text-muted sm:hidden">
        <span className="font-medium text-ink">{entry.title}.</span> {entry.verdict}
      </p>
    </article>
  );
}
