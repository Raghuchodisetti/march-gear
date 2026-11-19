"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { MessageSquare, PenLine, ThumbsUp } from "lucide-react";
import type { OwnerReview } from "@/types";
import { RECOMMEND_THRESHOLD } from "@/data/editorial-extra";
import { Chip } from "@/components/ui/chip";
import { SelectField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Stars } from "@/components/ui/rating";
import { EmptyState } from "@/components/ui/page-header";
import { useUI } from "@/components/providers/app-provider";
import { formatDate, formatKm } from "@/lib/format";
import { cn } from "@/lib/utils";
import { InitialsAvatar } from "./primitives";
import { WriteReviewModal, type CarOption } from "./write-review-modal";

type RatingFilter = "all" | "5" | "4" | "3";
type Sort = "helpful" | "newest" | "highest" | "lowest";

const RATING_CHIPS: { value: RatingFilter; label: string }[] = [
  { value: "all", label: "All ratings" },
  { value: "5", label: "5★" },
  { value: "4", label: "4★ & up" },
  { value: "3", label: "3★ & up" },
];

const SORTS: { value: Sort; label: string }[] = [
  { value: "helpful", label: "Most helpful" },
  { value: "newest", label: "Newest" },
  { value: "highest", label: "Highest rated" },
  { value: "lowest", label: "Lowest rated" },
];

const PAGE = 6;

export function OwnerReviews({ reviews, cars }: { reviews: OwnerReview[]; cars: CarOption[] }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { toast } = useUI();

  const param = searchParams.get("car");
  const car = param && cars.some((c) => c.value === param) ? param : "";
  const carLabel = cars.find((c) => c.value === car)?.label;

  const [added, setAdded] = useState<OwnerReview[]>([]);
  const [voted, setVoted] = useState<string[]>([]);
  const [rating, setRating] = useState<RatingFilter>("all");
  const [sort, setSort] = useState<Sort>("helpful");
  const [writing, setWriting] = useState(false);
  const key = `${car}|${rating}|${sort}`;
  const [page, setPage] = useState({ key, limit: PAGE });
  const limit = page.key === key ? page.limit : PAGE;

  const setCar = (slug: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (slug) params.set("car", slug);
    else params.delete("car");
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  };

  const all = [...added, ...reviews];
  const forCar = all.filter((r) => !car || r.carSlug === car);
  const min = rating === "all" ? 0 : Number(rating);
  const matches = forCar.filter((r) => (rating === "5" ? r.rating === 5 : r.rating >= min));
  const mine = matches.filter((r) => r.id.startsWith("local-"));
  const rest = matches
    .filter((r) => !r.id.startsWith("local-"))
    .sort((a, b) => {
      if (sort === "newest") return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
      if (sort === "highest") return b.rating - a.rating || b.helpful - a.helpful;
      if (sort === "lowest") return a.rating - b.rating || b.helpful - a.helpful;
      return b.helpful - a.helpful;
    });
  const ordered = [...mine, ...rest];
  const visible = ordered.slice(0, limit);

  // Summary for the selected car (rating filter deliberately ignored)
  const count = forCar.length;
  const avg = count ? forCar.reduce((s, r) => s + r.rating, 0) / count : 0;
  const recommend = count ? Math.round((forCar.filter((r) => r.rating >= RECOMMEND_THRESHOLD).length / count) * 100) : 0;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: forCar.filter((r) => Math.round(r.rating) === n).length }));
  const sub = (k: keyof OwnerReview["ratings"]) => (count ? forCar.reduce((s, r) => s + r.ratings[k], 0) / count : 0);

  const mostReviewed = cars
    .map((c) => ({ ...c, n: all.filter((r) => r.carSlug === c.value).length }))
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label))
    .slice(0, 6);

  const publish = (review: OwnerReview) => {
    setAdded((list) => [review, ...list]);
    setRating("all");
    if (car && car !== review.carSlug) setCar(review.carSlug);
    toast("Your review has been published on this page", { tone: "success" });
  };

  const vote = (id: string) => {
    if (voted.includes(id)) return;
    setVoted((v) => [...v, id]);
  };

  return (
    <>
      {/* Summary */}
      <section aria-label="Rating summary" className="grid grid-cols-2 border-b border-line lg:grid-cols-12">
        <div className="col-span-2 border-b border-line py-8 lg:col-span-4 lg:border-b-0 lg:py-10 lg:pr-10">
          <p className="type-eyebrow text-muted">{carLabel ?? "All cars"}</p>
          <div className="mt-5 flex items-end gap-5">
            <p className="font-display text-[4.5rem] font-semibold leading-[0.85] tracking-[-0.04em] num [font-stretch:108%] md:text-[5.5rem]">
              {count ? avg.toFixed(1) : "—"}
            </p>
            <div className="pb-1.5">
              <Stars value={avg} size={18} />
              <p className="mt-2 text-[12.5px] text-muted">Average owner rating</p>
            </div>
          </div>
        </div>
        <div className="border-r border-line py-8 pr-6 lg:col-span-2 lg:border-l lg:px-8 lg:py-10">
          <p className="text-[12.5px] text-muted">Reviews</p>
          <p className="type-h2 mt-3 num">{count}</p>
          <p className="mt-2 text-[12px] text-muted">From verified owners</p>
        </div>
        <div className="py-8 pl-6 lg:col-span-2 lg:border-r lg:border-line lg:px-8 lg:py-10">
          <p className="text-[12.5px] text-muted">Would recommend</p>
          <p className="type-h2 mt-3 num">
            {recommend}
            <span className="text-[0.55em] text-muted">%</span>
          </p>
          <p className="mt-2 text-[12px] text-muted">Rated {RECOMMEND_THRESHOLD}★ or above</p>
        </div>
        <div className="col-span-2 border-t border-line py-8 lg:col-span-4 lg:border-t-0 lg:py-10 lg:pl-10">
          <p className="sr-only">Rating distribution</p>
          <ul className="space-y-2">
            {dist.map(({ n, c }) => (
              <li key={n} className="grid grid-cols-[28px_1fr_28px] items-center gap-3 text-[12.5px]">
                <span className="text-muted num">{n}★</span>
                <span className="h-[3px] bg-line" aria-hidden>
                  <span className="block h-full bg-ink transition-[width] duration-700" style={{ width: `${count ? (c / count) * 100 : 0}%` }} />
                </span>
                <span className="text-right num">{c}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-5 grid grid-cols-4 gap-3 border-t border-line pt-4 text-[11.5px]">
            {(["exterior", "comfort", "performance", "value"] as const).map((k) => (
              <div key={k} className="min-w-0">
                <dt className="truncate capitalize text-muted">{k}</dt>
                <dd className="mt-0.5 font-medium num">{count ? sub(k).toFixed(1) : "—"}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Toolbar */}
      <div className="mt-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-5 md:flex-row md:items-end">
          <SelectField
            label="Car"
            placeholder="All cars"
            options={cars.map(({ value, label }) => ({ value, label }))}
            value={car}
            onChange={(e) => setCar(e.target.value)}
            className="md:w-72"
          />
          <div role="group" aria-label="Filter by rating" className="no-scrollbar -mx-5 flex min-w-0 gap-2 overflow-x-auto px-5 pb-1.5 md:mx-0 md:px-0">
            {RATING_CHIPS.map((c) => (
              <Chip key={c.value} selected={rating === c.value} onClick={() => setRating(c.value)}>
                {c.label}
              </Chip>
            ))}
          </div>
        </div>
        <div className="flex items-end gap-3">
          <SelectField
            label="Sort by"
            options={SORTS}
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="min-w-0 flex-1 lg:w-48 lg:flex-none"
          />
          <Button variant="primary" onClick={() => setWriting(true)} icon={<PenLine className="size-4" aria-hidden />} className="h-12 shrink-0">
            Write a review
          </Button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-10">
        <div className="min-w-0 lg:col-span-8">
          <h2 className="sr-only">Reviews</h2>
          <p className="border-b border-line pb-4 text-[13px] text-muted" aria-live="polite">
            <span className="num">{ordered.length}</span> {ordered.length === 1 ? "review" : "reviews"}
            {carLabel && <> for {carLabel}</>} · {SORTS.find((s) => s.value === sort)?.label.toLowerCase()}
          </p>

          {visible.length > 0 ? (
            <>
              <ol>
                {visible.map((r) => (
                  <li key={r.id}>
                    <ReviewCard
                      review={r}
                      carLabel={cars.find((c) => c.value === r.carSlug)?.label ?? r.carSlug}
                      voted={voted.includes(r.id)}
                      onVote={() => vote(r.id)}
                    />
                  </li>
                ))}
              </ol>
              {ordered.length > visible.length && (
                <div className="mt-10 flex flex-col items-center gap-3">
                  <Button variant="outline" onClick={() => setPage({ key, limit: limit + PAGE })}>
                    Show more reviews
                  </Button>
                  <p className="text-[12.5px] text-muted num">
                    {visible.length} of {ordered.length}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="mt-8">
              <EmptyState
                icon={<MessageSquare className="size-6" />}
                title={forCar.length === 0 && carLabel ? `No reviews for the ${carLabel} yet` : "No reviews match these filters"}
                description={
                  forCar.length === 0 && carLabel
                    ? "Own one? Be the first to tell other buyers what it's really like."
                    : "Try a different rating, or see reviews for every car."
                }
                action={
                  <div className="flex flex-col gap-3 sm:flex-row">
                    {forCar.length === 0 && carLabel ? (
                      <Button variant="primary" onClick={() => setWriting(true)}>
                        Write the first review
                      </Button>
                    ) : null}
                    <Button
                      variant="outline"
                      onClick={() => {
                        setRating("all");
                        setCar("");
                      }}
                    >
                      Show all reviews
                    </Button>
                  </div>
                }
              />
            </div>
          )}
        </div>

        <aside className="lg:col-span-4" aria-label="Browse by model">
          <div className="space-y-10 lg:sticky lg:top-28">
            <div className="hidden lg:block">
              <p className="type-eyebrow text-muted">Most reviewed</p>
              <ul className="mt-5 border-t border-line">
                {mostReviewed.map((c) => (
                  <li key={c.value} className="border-b border-line">
                    <button
                      type="button"
                      onClick={() => setCar(car === c.value ? "" : c.value)}
                      aria-pressed={car === c.value}
                      className={cn(
                        "flex w-full items-center justify-between gap-4 py-3.5 text-left text-[14px] transition-colors duration-[250ms]",
                        car === c.value ? "font-medium text-ink" : "text-ink/75 hover:text-ink",
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <span aria-hidden className={cn("h-px w-3 transition-colors", car === c.value ? "bg-red" : "bg-ink/20")} />
                        {c.label}
                      </span>
                      <span className="text-[12px] text-muted num">{c.n}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-ink p-7 text-white md:p-8">
              <p className="type-eyebrow text-white/50">Own a car?</p>
              <p className="type-h3 mt-4 text-balance">
                Tell the next buyer <span className="type-editorial">what it&apos;s really like.</span>
              </p>
              <p className="mt-3 text-[14px] leading-relaxed text-white/60">Five minutes, five stars and your honest opinion. Every review is read by a person.</p>
              <Button variant="light" className="mt-7" onClick={() => setWriting(true)} arrow>
                Write a review
              </Button>
            </div>

            <p className="text-[12px] leading-relaxed text-muted">
              Reviews are moderated for abuse and personal data only — we never edit opinions. Read our{" "}
              <Link href="/terms#user-content" className="text-ink underline underline-offset-4 hover:text-red">
                community guidelines
              </Link>
              .
            </p>
          </div>
        </aside>
      </div>

      <WriteReviewModal open={writing} onClose={() => setWriting(false)} cars={cars} defaultCar={car || undefined} onSubmit={publish} />
    </>
  );
}

function ReviewCard({ review, carLabel, voted, onVote }: { review: OwnerReview; carLabel: string; voted: boolean; onVote: () => void }) {
  const local = review.id.startsWith("local-");
  const helpful = review.helpful + (voted ? 1 : 0);
  return (
    <article className="grid grid-cols-1 gap-6 border-b border-line py-8 md:grid-cols-[200px_1fr] md:gap-10 md:py-10">
      <header className="flex items-start gap-4 md:flex-col md:gap-5">
        <InitialsAvatar name={review.name} size="lg" tone={local ? "ink" : "mist"} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium">{review.name}</p>
          <p className="mt-0.5 text-[12.5px] text-muted">{review.city}</p>
          <dl className="mt-4 hidden space-y-3 text-[12.5px] md:block">
            <div>
              <dt className="text-muted">Owns</dt>
              <dd className="mt-0.5">
                <Link href={`/cars/${review.carSlug}`} className="font-medium text-ink underline-offset-4 hover:text-red hover:underline">
                  {carLabel}
                </Link>
                <span className="block text-muted">{review.variant}</span>
              </dd>
            </div>
            <div>
              <dt className="text-muted">Owned for</dt>
              <dd className="mt-0.5 text-ink">{review.ownedFor}</dd>
            </div>
            {review.kmDriven > 0 && (
              <div>
                <dt className="text-muted">Driven</dt>
                <dd className="mt-0.5 text-ink num">{formatKm(review.kmDriven)}</dd>
              </div>
            )}
          </dl>
        </div>
      </header>

      <div className="min-w-0">
        {/* Mobile ownership line */}
        <p className="-mt-2 mb-5 text-[12.5px] text-muted md:hidden">
          <Link href={`/cars/${review.carSlug}`} className="font-medium text-ink underline-offset-4 hover:underline">
            {carLabel}
          </Link>{" "}
          {review.variant} · {review.ownedFor}
          {review.kmDriven > 0 && <> · <span className="num">{formatKm(review.kmDriven)}</span></>}
        </p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Stars value={review.rating} size={15} />
          <span className="text-[13px] font-semibold num">{review.rating.toFixed(1)}</span>
          <span className="text-[12.5px] text-muted num">· {formatDate(review.date)}</span>
          {local && <Badge tone="ink">Your review</Badge>}
        </div>
        <h3 className="type-h4 mt-4 text-pretty md:text-[1.25rem]">{review.title}</h3>
        <p className="mt-3 max-w-[64ch] text-[15px] leading-[1.7] text-ink/80">{review.body}</p>

        <dl className="mt-7 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
          {(["exterior", "comfort", "performance", "value"] as const).map((k) => (
            <div key={k}>
              <dt className="flex items-baseline justify-between text-[12px] capitalize text-muted">
                {k}
                <span className="font-medium text-ink num">{review.ratings[k]}</span>
              </dt>
              <dd className="mt-2 flex gap-0.5" aria-label={`${review.ratings[k]} out of 5`}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <span key={i} aria-hidden className={cn("h-[3px] flex-1", i <= review.ratings[k] ? "bg-ink" : "bg-line")} />
                ))}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-7 flex items-center gap-4">
          <button
            type="button"
            onClick={onVote}
            disabled={voted}
            aria-pressed={voted}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full border px-4 text-[12.5px] font-medium transition-[background-color,border-color,color] duration-[250ms] disabled:cursor-default",
              voted ? "border-ink bg-ink text-white" : "border-line text-ink hover:border-ink",
            )}
          >
            <ThumbsUp className={cn("size-3.5", voted && "text-red")} aria-hidden />
            Helpful <span className="num opacity-70">({helpful})</span>
          </button>
          {voted && <span className="text-[12px] text-muted">Thanks for your feedback</span>}
        </div>
      </div>
    </article>
  );
}

/** Suspense fallback for the owner-review browser. */
export function OwnerReviewsSkeleton() {
  return (
    <div aria-hidden>
      <div className="grid grid-cols-2 gap-8 border-b border-line py-10 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-3">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton h-12 w-24" />
          </div>
        ))}
      </div>
      <div className="mt-10 flex flex-wrap gap-3">
        <div className="skeleton h-12 w-72 max-w-full" />
        <div className="skeleton h-9 w-24 rounded-full" />
        <div className="skeleton h-9 w-24 rounded-full" />
      </div>
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className="grid grid-cols-1 gap-6 border-b border-line py-10 md:grid-cols-[200px_1fr] lg:w-2/3">
          <div className="flex gap-4">
            <div className="skeleton size-14 rounded-full" />
            <div className="skeleton h-4 w-28" />
          </div>
          <div className="space-y-3">
            <div className="skeleton h-4 w-32" />
            <div className="skeleton h-6 w-3/4" />
            <div className="skeleton h-16 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
