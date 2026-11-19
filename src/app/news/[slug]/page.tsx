import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import { allArticles, authorProfile, getStory, relatedStories } from "@/data/editorial-extra";
import { getAuthor } from "@/data/news";
import { getCar } from "@/data/cars";
import { brandName } from "@/data/brands";
import { formatDate } from "@/lib/format";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Eyebrow, TextLink } from "@/components/ui/section-heading";
import { CarCard } from "@/components/vehicle/car-card";
import { ReadingProgress } from "@/components/editorial/reading-progress";
import { ShareButtons } from "@/components/editorial/share-buttons";
import { VideoPlayer } from "@/components/editorial/video-player";
import { ScoreDial } from "@/components/editorial/score-dial";
import { NewsletterForm } from "@/components/editorial/newsletter-form";
import { CategoryLabel, InitialsAvatar, StoryMeta, shortTitle, storyHref, tagHref } from "@/components/editorial/primitives";

export function generateStaticParams() {
  return allArticles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata(props: PageProps<"/news/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const article = getStory(slug);
  if (!article) return { title: "Story not found" };
  const author = getAuthor(article.authorId);
  return {
    title: article.title,
    description: article.dek,
    authors: [{ name: author.name }],
    openGraph: {
      type: "article",
      title: article.title,
      description: article.dek,
      publishedTime: article.publishedOn,
      authors: [author.name],
      images: [{ url: article.image }],
    },
  };
}

export default async function ArticlePage(props: PageProps<"/news/[slug]">) {
  const { slug } = await props.params;
  const article = getStory(slug);
  if (!article) notFound();

  const author = getAuthor(article.authorId);
  const profile = authorProfile(article.authorId);
  const car = article.relatedCar ? getCar(article.relatedCar) : undefined;
  const carTitle = car ? `${brandName(car.brand)} ${car.name}` : "";
  const related = relatedStories(article, 3);
  const isVideo = article.category === "Video" && !!article.videoDuration;
  const quoteAfter = Math.floor((article.body.length - 1) / 2);

  return (
    <>
      <ReadingProgress>
        <header className="container-x pt-8">
          <Breadcrumbs items={[{ label: "News", href: "/news" }, { label: shortTitle(article.title) }]} />
          <div className="mt-10 max-w-5xl md:mt-16">
            <CategoryLabel category={article.category} />
            <h1 className="type-h1 mt-6 text-balance break-words">{article.title}</h1>
            <p className="type-lead mt-6 max-w-3xl text-muted">{article.dek}</p>
          </div>

          <div className="mt-10 flex flex-col gap-5 border-t border-line py-6 sm:flex-row sm:items-center sm:justify-between md:mt-12">
            <div className="flex items-center gap-3.5">
              <InitialsAvatar name={author.name} />
              <div className="leading-tight">
                <p className="text-[14px] font-medium">{author.name}</p>
                <p className="mt-1 text-[12.5px] text-muted">{author.role}</p>
              </div>
            </div>
            <dl className="flex gap-8 text-[12.5px] sm:gap-10">
              <div>
                <dt className="text-muted">Published</dt>
                <dd className="mt-1 font-medium num">
                  <time dateTime={article.publishedOn}>{formatDate(article.publishedOn)}</time>
                </dd>
              </div>
              <div>
                <dt className="text-muted">{isVideo ? "Running time" : "Reading time"}</dt>
                <dd className="mt-1 font-medium num">{isVideo ? article.videoDuration : `${article.readMinutes} min`}</dd>
              </div>
            </dl>
          </div>
        </header>

        <figure className="container-x">
          {isVideo ? (
            <VideoPlayer
              poster={article.image}
              title={article.title}
              duration={article.videoDuration!}
              preload
              sizes="(min-width: 1400px) 1304px, 100vw"
            />
          ) : (
            <div className="relative -mx-5 aspect-[4/3] overflow-hidden bg-mist sm:mx-0 md:aspect-[16/9]">
              <Image src={article.image} alt={article.title} fill preload sizes="(min-width: 1400px) 1304px, 100vw" className="object-cover" />
            </div>
          )}
          <figcaption className="mt-3 text-[12px] text-muted">
            {isVideo ? "Demo playback — this film is a simulated preview." : "Representative photography · March Gear"}
          </figcaption>
        </figure>

        <div className="container-x grid grid-cols-1 gap-16 py-14 md:py-20 lg:grid-cols-12 lg:gap-10">
          <article className="min-w-0 lg:col-span-8 xl:col-span-7 xl:col-start-2">
            <div className="max-w-[68ch] space-y-7 text-[17px] leading-[1.78] text-ink/85 md:text-[18px]">
              {article.body.map((paragraph, i) => (
                <Fragment key={i}>
                  <p
                    className={
                      i === 0
                        ? "text-ink first-letter:float-left first-letter:mr-3 first-letter:mt-[0.32rem] first-letter:font-display first-letter:text-[4.4rem] first-letter:font-semibold first-letter:leading-[0.78] first-letter:tracking-[-0.04em] first-letter:text-ink first-letter:[font-stretch:110%]"
                        : undefined
                    }
                  >
                    {paragraph}
                  </p>
                  {article.pullQuote && i === quoteAfter && (
                    <figure className="!my-14 md:!my-16">
                      <span aria-hidden className="block h-[2px] w-14 bg-red" />
                      <blockquote className="type-editorial mt-7 text-balance text-[2rem] leading-[1.12] text-ink md:text-[2.75rem]">
                        <p>“{article.pullQuote}”</p>
                      </blockquote>
                    </figure>
                  )}
                </Fragment>
              ))}
            </div>

            <div className="mt-14 max-w-[68ch]">
              <p className="type-eyebrow text-muted">Filed under</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {article.tags.map((tag) => (
                  <li key={tag}>
                    <Link
                      href={tagHref(tag)}
                      className="inline-flex h-9 items-center gap-1 rounded-full border border-line px-4 text-[13px] font-medium transition-colors duration-[250ms] hover:border-ink"
                    >
                      <span aria-hidden className="text-red">#</span>
                      {tag}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-[12px] text-muted">Editorial content is fictional and written for demonstration.</p>

              <ShareButtons title={article.title} className="mt-10 border-t border-line pt-8 lg:hidden" />

              <div className="mt-12 grid grid-cols-1 gap-5 border-y border-line py-8 sm:grid-cols-[auto_1fr] sm:gap-7">
                <InitialsAvatar name={author.name} size="xl" tone="ink" />
                <div>
                  <p className="type-eyebrow text-muted">Written by</p>
                  <p className="type-h4 mt-3">{author.name}</p>
                  <p className="mt-1 text-[13px] text-muted">
                    {author.role} · {profile.base}
                  </p>
                  <p className="mt-4 text-[14.5px] leading-relaxed text-ink/80">{profile.bio}</p>
                  <TextLink href="/about#team" className="mt-5">
                    Meet the editorial team
                  </TextLink>
                </div>
              </div>
            </div>
          </article>

          <aside className="lg:col-span-4 xl:col-span-3 xl:col-start-10" aria-label="About this story">
            <div className="space-y-10 lg:sticky lg:top-28">
              {car && (
                <div>
                  <h2 className="type-eyebrow text-muted">In this story</h2>
                  <CarCard car={car} className="mt-4" sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 30vw, 100vw" />
                  <Link
                    href={`/cars/${car.slug}#reviews`}
                    className="group/score mt-3 flex items-center gap-4 border border-line p-4 transition-colors duration-[400ms] hover:border-ink/25"
                  >
                    <ScoreDial score={car.expertScore} size={52} showMax={false} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] text-muted">March Gear expert score</span>
                      <span className="mt-0.5 block text-[14px] font-medium">Read the {carTitle} review</span>
                    </span>
                  </Link>
                </div>
              )}
              <ShareButtons title={article.title} className="hidden lg:block" />
              {!car && (
                <div className="border border-line p-6">
                  <p className="type-eyebrow text-muted">The Weekly Gear</p>
                  <p className="type-h4 mt-3">Stories like this, every Friday.</p>
                  <NewsletterForm className="mt-5" />
                </div>
              )}
            </div>
          </aside>
        </div>
      </ReadingProgress>

      {related.length > 0 && (
        <section aria-labelledby="keep-reading" className="border-t border-line py-20 md:py-28">
          <div className="container-x">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <Eyebrow>Keep reading</Eyebrow>
                <h2 id="keep-reading" className="type-h2 mt-5">
                  More from <span className="type-editorial">the journal</span>
                </h2>
              </div>
              <TextLink href="/news">All news &amp; media</TextLink>
            </div>
            <ul className="mt-12 grid grid-cols-1 border-t border-line md:mt-14 md:grid-cols-3 md:gap-10 md:border-t-0">
              {related.map((a) => (
                <li key={a.slug} className="border-b border-line md:border-b-0">
                  <article className="group/rel relative grid grid-cols-[1fr_104px] gap-5 py-6 md:block md:py-0">
                    <div className="relative order-last aspect-[4/3] self-start overflow-hidden bg-mist md:order-none md:aspect-[3/2]">
                      <Image
                        src={a.image}
                        alt=""
                        fill
                        sizes="(min-width: 768px) 30vw, 104px"
                        className="object-cover transition-transform duration-[700ms] ease-[var(--ease-premium)] group-hover/rel:scale-[1.04]"
                      />
                    </div>
                    <div className="min-w-0 md:mt-6">
                      <CategoryLabel category={a.category} />
                      <h3 className="type-h4 mt-3 text-pretty md:type-h3">
                        <Link href={storyHref(a)} className="after:absolute after:inset-0 focus-visible:outline-none">
                          {a.title}
                        </Link>
                      </h3>
                      <StoryMeta article={a} className="mt-3" />
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
