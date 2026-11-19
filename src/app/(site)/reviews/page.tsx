import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ExpertReview } from "@/types";
import { getCatalog } from "@/server/catalog";
import { IMG } from "@/data/images";
import { allArticles, featuredReviewPicks, RECOMMEND_THRESHOLD } from "@/data/editorial-extra";
import { formatDate, formatPriceRange } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Eyebrow } from "@/components/ui/section-heading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScoreBar, Stars } from "@/components/ui/rating";
import { Carousel } from "@/components/ui/carousel";
import { Reveal } from "@/components/ui/reveal";
import { ScoreDial } from "@/components/editorial/score-dial";
import { CategoryLabel, InitialsAvatar, StoryMeta, storyHref } from "@/components/editorial/primitives";
import { ExpertReviewsBrowser, type ReviewEntry } from "@/components/editorial/expert-reviews-browser";

export const metadata: Metadata = {
  title: "Expert car reviews",
  description:
    "Independent, road-tested reviews of every new car in India — scored out of ten on design, comfort, performance, technology and value.",
};

const byScore = (a: ExpertReview, b: ExpertReview) => b.score - a.score;

export default async function ReviewsPage() {
  const cat = await getCatalog();
  const { expertReviews, getExpertReview, ownerReviews, getCar, brandName, getAuthor } = cat;
  const entries: ReviewEntry[] = expertReviews.flatMap((r) => {
    const car = getCar(r.carSlug);
    if (!car) return [];
    return [
      {
        slug: r.slug,
        carSlug: r.carSlug,
        carName: car.name,
        brand: car.brand,
        brandLabel: brandName(car.brand),
        bodyType: car.bodyType,
        image: r.image,
        focus: car.focus,
        title: r.title,
        verdict: r.verdict,
        score: r.score,
        author: getAuthor(r.authorId).name,
        publishedOn: r.publishedOn,
      },
    ];
  });

  const picks = featuredReviewPicks.map(getExpertReview).filter((r): r is ExpertReview => !!r);
  const cover = [...picks].sort(byScore)[0] ?? [...expertReviews].sort(byScore)[0];
  const coverCar = getCar(cover.carSlug)!;
  const coverAuthor = getAuthor(cover.authorId);
  const rivals = coverCar.competitors.filter((s) => getCar(s)).slice(0, 2);

  const top = [...expertReviews].sort(byScore).slice(0, 10);
  const lastUpdated = [...expertReviews].map((r) => r.publishedOn).sort().at(-1)!;
  const features = allArticles(cat).filter((a) => a.category === "Expert Review" || a.category === "First Drive");

  const ownerAvg = ownerReviews.reduce((s, r) => s + r.rating, 0) / ownerReviews.length;
  const recommend = Math.round((ownerReviews.filter((r) => r.rating >= RECOMMEND_THRESHOLD).length / ownerReviews.length) * 100);

  return (
    <>
      <PageHeader
        eyebrow="Expert reviews"
        title={
          <>
            Road-tested. <span className="type-editorial">Honestly scored.</span>
          </>
        }
        description="Every car we review is driven on Indian roads by our own team, scored out of ten on five criteria and weighed against its closest rivals."
        crumbs={[{ label: "Reviews" }]}
      >
        <dl className="flex flex-wrap gap-x-12 gap-y-4 text-[13px]">
          <div>
            <dt className="text-muted">Cars tested</dt>
            <dd className="mt-1 type-h4 num">{expertReviews.length}</dd>
          </div>
          <div>
            <dt className="text-muted">Road testers</dt>
            <dd className="mt-1 type-h4 num">4</dd>
          </div>
          <div>
            <dt className="text-muted">Criteria</dt>
            <dd className="mt-1 type-h4">Design · Comfort · Performance · Tech · Value</dd>
          </div>
        </dl>
      </PageHeader>

      {/* Cover review */}
      <section aria-labelledby="cover-heading" className="container-x py-14 md:py-20">
        <article className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-center lg:gap-14">
          <Link
            href={`/cars/${coverCar.slug}#reviews`}
            tabIndex={-1}
            aria-hidden
            className="group/cover relative -mx-5 block aspect-[4/3] overflow-hidden bg-mist sm:mx-0 lg:col-span-7 lg:aspect-[5/4] xl:aspect-[4/3]"
          >
            <Image
              src={cover.image}
              alt=""
              fill
              preload
              sizes="(min-width: 1024px) 56vw, 100vw"
              className="object-cover transition-transform duration-[700ms] ease-[var(--ease-premium)] group-hover/cover:scale-[1.03]"
              style={{ objectPosition: coverCar.focus ?? "50% 55%" }}
            />
            <Badge tone="glass" className="absolute left-4 top-4 md:left-6 md:top-6">
              Cover review
            </Badge>
          </Link>

          <Reveal className="lg:col-span-5">
            <Eyebrow>Editor&apos;s pick · Highest rated</Eyebrow>
            <p className="type-eyebrow mt-8 text-muted">
              {brandName(coverCar.brand)} <span className="text-ink/25">/</span> {coverCar.bodyType}
            </p>
            <h2 id="cover-heading" className="type-h2 mt-3">
              {brandName(coverCar.brand)} {coverCar.name}
            </h2>
            <p className="mt-6 type-editorial text-[1.5rem] leading-[1.3] text-ink md:text-[1.75rem]">“{cover.verdict}”</p>

            <div className="mt-8 grid grid-cols-[auto_1fr] items-center gap-6 border-y border-line py-6 sm:gap-8">
              <div className="flex flex-col items-center gap-2">
                <ScoreDial score={cover.score} size={104} />
                <span className="text-[11px] text-muted">Expert score</span>
              </div>
              <div className="space-y-3">
                {cover.scores.map((s) => (
                  <ScoreBar key={s.label} label={s.label} value={s.value} />
                ))}
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <InitialsAvatar name={coverAuthor.name} size="sm" />
              <p className="text-[12.5px] leading-tight">
                <span className="block font-medium text-ink">{coverAuthor.name}</span>
                <span className="mt-0.5 block text-muted num">
                  {coverAuthor.role} · {formatDate(cover.publishedOn)}
                </span>
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button href={`/cars/${coverCar.slug}#reviews`} variant="dark" arrow>
                Read the full review
              </Button>
              {rivals.length > 0 && (
                <Button href={`/compare?cars=${[coverCar.slug, ...rivals].join(",")}`} variant="outline">
                  Compare with rivals
                </Button>
              )}
            </div>
          </Reveal>
        </article>
      </section>

      {/* Top ten */}
      <section aria-labelledby="ranking-heading" className="bg-ink py-20 text-white md:py-28">
        <div className="container-x grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10">
          <Reveal className="lg:col-span-4">
            <Eyebrow tone="light">The ranking</Eyebrow>
            <h2 id="ranking-heading" className="type-h2 mt-5 text-balance">
              The top ten, <span className="type-editorial">by the numbers</span>
            </h2>
            <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-white/60">
              The highest-scoring cars we have tested this year, across every price point and body style.
            </p>
            <p className="mt-8 text-[12px] text-white/40 num">Expert scores out of 10 · Updated {formatDate(lastUpdated)}</p>
          </Reveal>

          <ol className="lg:col-span-8 md:grid md:grid-flow-col md:grid-cols-2 md:grid-rows-5 md:gap-x-10">
            {top.map((r, i) => {
              const car = getCar(r.carSlug)!;
              return (
                <li key={r.slug} className="border-b border-white/10 first:border-t md:[&:nth-child(6)]:border-t">
                  <Link href={`/cars/${car.slug}#reviews`} className="group/rank flex items-center gap-4 py-5 md:gap-5">
                    <span
                      aria-hidden
                      className="w-11 shrink-0 font-display text-[2rem] font-semibold leading-none tracking-[-0.04em] text-white/25 transition-colors duration-[250ms] group-hover/rank:text-red num [font-stretch:112%] md:w-12 md:text-[2.25rem]"
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="relative hidden size-14 shrink-0 overflow-hidden bg-ink-3 sm:block">
                      <Image
                        src={car.images[0]}
                        alt=""
                        fill
                        sizes="56px"
                        className="object-cover opacity-80 transition-opacity duration-[400ms] group-hover/rank:opacity-100"
                        style={{ objectPosition: car.focus ?? "50% 55%" }}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">
                        {brandName(car.brand)} {car.name}
                      </span>
                      <span className="mt-1 block truncate text-[12.5px] text-white/50 num">
                        {car.bodyType} · {formatPriceRange(car.priceMin, car.priceMax)}
                      </span>
                    </span>
                    <span className="font-display text-[1.375rem] font-semibold tracking-[-0.02em] num">{r.score.toFixed(1)}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Every review */}
      <section aria-labelledby="all-reviews" className="container-x py-14 md:py-20">
        <div className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Eyebrow>Every car we&apos;ve tested</Eyebrow>
            <h2 id="all-reviews" className="type-h2 mt-5">
              All expert reviews
            </h2>
          </div>
          <p className="max-w-md text-[14.5px] leading-relaxed text-muted lg:text-right">
            Scores compare each car with its direct rivals, not the whole market — so a great hatchback can outscore a good limousine.
          </p>
        </div>
        <ExpertReviewsBrowser entries={entries} />
      </section>

      {/* Long reads */}
      <section aria-label="Comparisons and first drives" className="border-t border-line py-14 md:py-20">
        <div className="container-x">
          <Carousel
            label="comparisons and first drives"
            itemClassName="w-[84%] sm:w-[calc((100%-20px)/2)] lg:w-[calc((100%-40px)/3)]"
            headerSlot={
              <div>
                <Eyebrow>Long reads</Eyebrow>
                <h2 className="type-h2 mt-5 text-balance">
                  Comparisons &amp; <span className="type-editorial">first drives</span>
                </h2>
              </div>
            }
          >
            {features.map((a) => (
              <article key={a.slug} className="group/feat relative">
                <div className="relative aspect-[4/5] overflow-hidden bg-mist">
                  <Image
                    src={a.image}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 30vw, (min-width: 640px) 48vw, 84vw"
                    className="object-cover transition-transform duration-[700ms] ease-[var(--ease-premium)] group-hover/feat:scale-[1.04]"
                  />
                  <span className="absolute left-4 top-4">
                    <Badge tone="glass">{a.category}</Badge>
                  </span>
                </div>
                <div className="mt-6">
                  <h3 className="type-h3 text-balance">
                    <Link href={storyHref(a)} className="after:absolute after:inset-0 focus-visible:outline-none">
                      {a.title}
                    </Link>
                  </h3>
                  <p className="mt-3 line-clamp-2 text-[14.5px] leading-relaxed text-muted">{a.dek}</p>
                  <StoryMeta article={a} author={getAuthor(a.authorId)} className="mt-4" />
                </div>
              </article>
            ))}
          </Carousel>
          <div className="mt-2 flex flex-wrap gap-x-8 gap-y-3">
            <CategoryLabel category="Expert Review" />
            <CategoryLabel category="First Drive" />
          </div>
        </div>
      </section>

      {/* Owners CTA */}
      <section aria-labelledby="owners-cta" className="container-x pb-14 md:pb-20">
        <div className="grid grid-cols-1 overflow-hidden bg-mist lg:grid-cols-2">
          <div className="relative aspect-[16/10] lg:aspect-auto lg:min-h-[480px]">
            <Image src={IMG.driverView} alt="A driver's view through the windscreen on an open road" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
          </div>
          <div className="flex flex-col justify-center px-6 py-12 sm:px-10 md:px-14 lg:py-16">
            <Eyebrow>Owner reviews</Eyebrow>
            <h2 id="owners-cta" className="type-h2 mt-5 text-balance">
              Ask the people who <span className="type-editorial">already own one.</span>
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted">
              Thousands of kilometres, real fuel bills and honest gripes — moderated reviews from owners across India.
            </p>
            <dl className="mt-9 grid grid-cols-3 gap-4 border-t border-ink/10 pt-6">
              <div>
                <dt className="text-[12px] text-muted">Reviews</dt>
                <dd className="type-h3 mt-1 num">{ownerReviews.length}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted">Average</dt>
                <dd className="mt-1 flex flex-col gap-1.5">
                  <span className="type-h3 num">{ownerAvg.toFixed(1)}</span>
                  <Stars value={ownerAvg} size={12} />
                </dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted">Recommend</dt>
                <dd className="type-h3 mt-1 num">{recommend}%</dd>
              </div>
            </dl>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button href="/reviews/owners" variant="dark" arrow>
                Read owner reviews
              </Button>
              <Button href="/reviews/owners?car=mahindra-xev-9e" variant="outline">
                XEV 9e owners
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
