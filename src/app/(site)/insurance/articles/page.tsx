import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Newspaper } from "lucide-react";
import { IMG } from "@/data/images";
import { formatDate } from "@/lib/format";
import { getCatalog } from "@/server/catalog";
import { getInsuranceArticles } from "@/server/insurance/public-content";
import { Button } from "@/components/ui/button";
import { CategoryAd, LandingHero, RelatedGuides } from "@/components/insurance/public/landing";
import { storyHref, topicLabel } from "@/components/editorial/primitives";

export const metadata: Metadata = {
  title: "Insurance stories — from the MarchGear newsroom",
  description: "Editorial articles and ownership stories from MarchGear that cover car insurance, claims and protecting your car.",
  alternates: { canonical: "/insurance/articles" },
};

export default async function InsuranceArticlesPage() {
  const [{ content, getAuthor }, matches] = await Promise.all([getCatalog(), getInsuranceArticles()]);
  const page = content.insurancePage.pages.articles;
  const guides = content.insuranceGuides.guides.slice(0, 3);
  const [lead, ...rest] = matches;

  return (
    <>
      <LandingHero hero={page} image={IMG.cityTaillights} imageFocus="50% 50%" crumb="Articles" />
      <CategoryAd />

      <section aria-label="Articles" className="py-14 md:py-20">
        <div className="container-x">
          {lead ? (
            <>
              <Link href={storyHref(lead.article)} className="group grid grid-cols-1 items-center gap-8 border-b border-line pb-12 lg:grid-cols-12 lg:gap-12">
                <div className="relative aspect-[16/10] overflow-hidden bg-ink lg:col-span-7">
                  <Image src={lead.article.image} alt="" fill preload sizes="(min-width: 1024px) 55vw, 100vw" className="object-cover transition-transform duration-[900ms] ease-[var(--ease-premium)] group-hover:scale-[1.04]" />
                </div>
                <div className="lg:col-span-5">
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
                    <span className="font-semibold uppercase tracking-[0.14em] text-red">{topicLabel(lead.article.category)}</span>
                    <span className="num">{formatDate(lead.article.publishedOn)}</span>
                    <span>{getAuthor(lead.article.authorId).name}</span>
                  </p>
                  <h2 className="type-h2 mt-4 text-balance transition-colors duration-[250ms] group-hover:text-red">{lead.article.title}</h2>
                  <p className="mt-4 text-[15.5px] leading-relaxed text-muted">{lead.article.dek}</p>
                  <span className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-medium">
                    Read the story
                    <ArrowUpRight aria-hidden className="size-4 text-red transition-transform duration-[250ms] group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
              {rest.length > 0 && (
                <ul className="mt-12 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.slice(0, 24).map(({ article }) => (
                    <li key={article.slug}>
                      <Link href={storyHref(article)} className="group block">
                        <div className="relative aspect-[16/10] overflow-hidden bg-ink">
                          <Image src={article.image} alt="" fill sizes="(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-[900ms] ease-[var(--ease-premium)] group-hover:scale-[1.04]" />
                        </div>
                        <p className="mt-5 flex items-center gap-3 text-[11.5px] text-muted">
                          <span className="font-semibold uppercase tracking-[0.14em] text-red">{topicLabel(article.category)}</span>
                          <span className="num">{formatDate(article.publishedOn)}</span>
                        </p>
                        <h3 className="mt-2 text-[18px] font-semibold leading-snug transition-colors duration-[250ms] group-hover:text-red">{article.title}</h3>
                        <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-muted">{article.dek}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-12 flex items-start gap-2 text-[12.5px] leading-relaxed text-muted">
                <Newspaper aria-hidden className="mt-0.5 size-4 shrink-0" />
                Stories are picked automatically when their headline, standfirst, tags or text talk about insurance. For step-by-step explanations, see our guides.
              </p>
            </>
          ) : (
            <div className="grid grid-cols-1 border border-line lg:grid-cols-12">
              <div className="p-8 sm:p-12 lg:col-span-7">
                <span className="inline-flex size-12 items-center justify-center rounded-full bg-mist">
                  <BookOpen aria-hidden className="size-5" />
                </span>
                <h2 className="type-h3 mt-6">No insurance stories yet</h2>
                <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-muted">
                  Our newsroom hasn&apos;t published an insurance story recently. The guides cover the essentials — IDV, the no-claim bonus, add-ons, claims and renewals — in plain language.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button href="/insurance/guides" arrow>
                    Read the guides
                  </Button>
                  <Button href="/news" variant="outline">
                    All news
                  </Button>
                </div>
              </div>
              <div className="relative hidden min-h-64 bg-ink lg:col-span-5 lg:block">
                <Image src={IMG.navScreen} alt="" fill sizes="40vw" className="object-cover opacity-80" />
              </div>
            </div>
          )}
        </div>
      </section>
      <RelatedGuides guides={guides} title="Insurance guides" />
    </>
  );
}
