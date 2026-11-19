import type { Metadata } from "next";
import Image from "next/image";
import { getCatalog } from "@/server/catalog";
import { FEATURED_BRAND, SEGMENTS } from "@/data/brands-listing";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { BrandMonogram, PageHeader } from "@/components/ui/page-header";
import { Reveal } from "@/components/ui/reveal";
import { Eyebrow, TextLink } from "@/components/ui/section-heading";
import { BrandDirectory } from "./_components/brand-directory";

export const metadata: Metadata = {
  title: "Car brands in India",
  description: "Every carmaker selling new cars in India — from everyday hatchbacks to Stuttgart sports cars. Compare line-ups, starting prices and electric models by brand.",
};

export default async function BrandsPage() {
  const { brandSummaries, brandSummary, getBrand, carsByBrand } = await getCatalog();
  const summaries = brandSummaries();
  const featuredBrand = getBrand(FEATURED_BRAND) ?? summaries[0].brand;
  const featured = brandSummary(featuredBrand);
  const featuredLine = carsByBrand(featuredBrand.slug);
  const totalModels = summaries.reduce((n, s) => n + s.models, 0);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Brands" }]}
        eyebrow="Brands"
        title={
          <>
            Every marque, <span className="type-editorial font-normal">one directory.</span>
          </>
        }
        description={`${summaries.length} manufacturers and ${totalModels} models on sale in India — browse a line-up, see where it starts and how much of it is already electric.`}
      />

      {/* ── Featured luxury marque ───────────────────────────── */}
      <section className="container-x pt-12 md:pt-16">
        <Reveal className="grid grid-cols-1 bg-ink text-white lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div className="relative aspect-[16/10] overflow-hidden lg:aspect-auto lg:min-h-[520px]">
            <Image
              src={featuredBrand.heroImage}
              alt={`${featuredBrand.name} — featured marque`}
              fill
              preload
              sizes="(min-width: 1024px) 58vw, 100vw"
              className="object-cover"
              style={{ objectPosition: "50% 60%" }}
            />
          </div>
          <div className="flex flex-col justify-between gap-12 p-6 sm:p-10 xl:p-14">
            <div>
              <div className="flex items-center justify-between gap-4">
                <Eyebrow tone="light">Featured marque</Eyebrow>
                <BrandMonogram name={featuredBrand.name} tone="dark" className="size-12 text-[17px]" />
              </div>
              <h2 className="type-h1 mt-8">{featuredBrand.name}</h2>
              <p className="type-editorial mt-3 text-[22px] text-white/75 md:text-[26px]">{featuredBrand.tagline}</p>
              <p className="mt-6 max-w-md text-[15px] leading-relaxed text-white/60">{featuredBrand.description}</p>
            </div>
            <div>
              <dl className="grid grid-cols-3 border-t border-white/15 pt-6">
                <div>
                  <dt className="text-[12px] text-white/50">On sale</dt>
                  <dd className="type-h3 mt-1 num">{featured.models}</dd>
                </div>
                <div className="border-l border-white/15 pl-4">
                  <dt className="text-[12px] text-white/50">From</dt>
                  <dd className="type-h3 mt-1 num">{featured.startingPrice ? formatPrice(featured.startingPrice) : "—"}</dd>
                </div>
                <div className="border-l border-white/15 pl-4">
                  <dt className="text-[12px] text-white/50">Electric</dt>
                  <dd className="type-h3 mt-1 num">{featured.evs}</dd>
                </div>
              </dl>
              <p className="mt-6 text-[13px] text-white/50">{featuredLine.map((c) => c.name).join(" · ")}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button href={`/brands/${featuredBrand.slug}`} variant="light" arrow>
                  Explore {featuredBrand.name}
                </Button>
                <Button href="/new-cars?body=luxury" variant="outline-light">
                  All luxury cars
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Directory ────────────────────────────────────────── */}
      <section aria-labelledby="directory-title" className="container-x py-14 md:py-20">
        <div className="mb-10 flex flex-col gap-4 md:mb-14 md:flex-row md:items-end md:justify-between">
          <div>
            <Eyebrow>A – Z</Eyebrow>
            <h2 id="directory-title" className="type-h2 mt-5">
              The directory
            </h2>
          </div>
          <p className="max-w-sm text-[14px] leading-relaxed text-muted">Starting prices are the lowest indicative ex-showroom figure across each brand&rsquo;s current line-up.</p>
        </div>
        <BrandDirectory summaries={summaries} segments={SEGMENTS} />
      </section>

      {/* ── Closing ──────────────────────────────────────────── */}
      <section className="border-t border-line">
        <div className="container-x flex flex-col gap-6 py-12 md:flex-row md:items-center md:justify-between md:py-16">
          <p className="type-h3 max-w-xl text-balance">Already know the body style you want? Start from the car instead.</p>
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <TextLink href="/new-cars">All new cars</TextLink>
            <TextLink href="/upcoming-cars">Upcoming launches</TextLink>
            <TextLink href="/compare">Compare cars</TextLink>
          </div>
        </div>
      </section>
    </>
  );
}
