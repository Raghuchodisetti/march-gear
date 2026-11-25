import { cardPhotoAlt } from "@/lib/image-alt";
import { CarImage } from "@/components/vehicle/car-image";
import { hasExpertScore } from "@/lib/specs";
import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { getCatalog } from "@/server/catalog";
import { formatDate, formatPriceRange } from "@/lib/format";
import { Reveal } from "@/components/ui/reveal";
import { Eyebrow, TextLink } from "@/components/ui/section-heading";
import { Button } from "@/components/ui/button";

export async function LatestLaunches() {
  const { latestLaunches, brandName } = await getCatalog();
  // The lead plus a short index — the catalogue dates every model's launch, so cap the list.
  const [lead, ...more] = latestLaunches();
  const rest = more.slice(0, 4);
  if (!lead) return null;
  const reviewed = [lead, ...rest].every(hasExpertScore);
  const leadTitle = `${brandName(lead.brand)} ${lead.name}`;
  const [day, month, year] = formatDate(lead.launchedOn!).split(" ");

  return (
    <section aria-labelledby="launches-title" className="py-14 md:py-20">
      <div className="container-x">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <Eyebrow>Latest launches</Eyebrow>
            <h2 id="launches-title" className="type-h2 mt-5 max-w-2xl text-balance">
              {reviewed ? (
                <>
                  Fresh off the stage, <span className="type-editorial">already</span> reviewed.
                </>
              ) : (
                <>
                  Fresh off the stage, <span className="type-editorial">in full</span> detail.
                </>
              )}
            </h2>
          </div>
          <TextLink href="/new-cars?sort=latest">All recent launches</TextLink>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
          {/* Lead launch — editorial feature */}
          <Reveal className="lg:col-span-8">
            <article className="group/lead relative">
              <Link href={`/cars/${lead.slug}`} className="relative block aspect-[16/10] overflow-hidden bg-ink">
                <CarImage
                  car={lead}
                  alt={lead.images[0] ? cardPhotoAlt(lead.images[0], leadTitle) : ""}
                  sizes="(min-width: 1024px) 60vw, 100vw"
                  className="object-cover transition-transform duration-[1200ms] ease-[var(--ease-premium)] group-hover/lead:scale-[1.03]"
                  style={{ objectPosition: lead.focus ?? "50% 60%" }}
                  placeholderClassName="pt-16 md:pt-10"
                />
                <div className="absolute left-0 top-0 bg-white px-5 py-4 text-ink md:px-7 md:py-5">
                  <p className="type-eyebrow text-red">Launched</p>
                  <p className="mt-2 font-display text-4xl font-semibold leading-none tracking-[-0.04em] num md:text-6xl">{day}</p>
                  <p className="mt-1 text-[13px] font-medium text-muted">
                    {month} {year}
                  </p>
                </div>
              </Link>
              <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-[1.2fr_1fr]">
                <div>
                  <p className="type-eyebrow text-muted">{brandName(lead.brand)}</p>
                  <h3 className="type-h1 mt-3">
                    <Link href={`/cars/${lead.slug}`} className="transition-colors hover:text-red">
                      {lead.name}
                    </Link>
                  </h3>
                  <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted">
                    {lead.overview.trim() ? `${lead.overview.split(". ").slice(0, 2).join(". ").replace(/\.$/, "")}.` : lead.tagline}
                  </p>
                </div>
                <div className="flex flex-col">
                  <ul className="space-y-3 border-t border-line pt-5">
                    {lead.highlights.slice(0, 3).map((h) => (
                      <li key={h} className="flex gap-3 text-[14px]">
                        <Check className="mt-0.5 size-4 shrink-0 text-red" aria-hidden />
                        {h}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 flex items-end justify-between gap-4 border-t border-line pt-5">
                    <div>
                      <p className="text-[12px] text-muted">{lead.priceCity ? `Ex-showroom ${lead.priceCity}` : "Starting price · indicative"}</p>
                      <p className="mt-1 text-xl font-semibold num">{formatPriceRange(lead.priceMin, lead.priceMax)}</p>
                    </div>
                    <Button href={`/cars/${lead.slug}`} variant="dark" size="sm" arrow>
                      View details<span className="sr-only"> of the {leadTitle}</span>
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          </Reveal>

          {/* Following launches — compact index */}
          <div className="lg:col-span-4">
            <p className="type-eyebrow border-b border-ink pb-4 text-ink">Also new this season</p>
            <ol>
              {rest.map((car, i) => (
                <li key={car.slug} className="border-b border-line">
                  <Reveal delay={0.08 * i}>
                    <Link href={`/cars/${car.slug}`} className="group/row grid grid-cols-[96px_1fr] gap-5 py-6">
                      <span className="relative aspect-square overflow-hidden bg-mist">
                        <CarImage car={car} alt="" sizes="96px" className="object-cover transition-transform duration-[700ms] ease-[var(--ease-premium)] group-hover/row:scale-110" />
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="text-[12px] text-muted num">{formatDate(car.launchedOn!)}</span>
                        <span className="mt-1 flex items-start justify-between gap-2">
                          <span className="type-h4 transition-colors group-hover/row:text-red">
                            {brandName(car.brand)} {car.name}
                          </span>
                          <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-muted transition-transform duration-[250ms] group-hover/row:-translate-y-0.5 group-hover/row:translate-x-0.5 group-hover/row:text-red" aria-hidden />
                        </span>
                        <span className="mt-auto pt-2 text-[14px] font-semibold num">{formatPriceRange(car.priceMin, car.priceMax)}</span>
                        <span className="mt-1 line-clamp-1 text-[12.5px] text-muted">{car.highlights[0] ?? car.tagline}</span>
                      </span>
                    </Link>
                  </Reveal>
                </li>
              ))}
            </ol>
            <Link
              href="/upcoming-cars"
              className="group/up mt-8 flex items-center justify-between bg-ink px-6 py-5 text-white transition-colors duration-[250ms] hover:bg-ink-3"
            >
              <span>
                <span className="type-eyebrow block text-white/55">Coming soon</span>
                <span className="mt-1.5 block font-medium">See the 2027 launch calendar</span>
              </span>
              <ArrowUpRight className="size-5 text-red transition-transform duration-[250ms] group-hover/up:-translate-y-0.5 group-hover/up:translate-x-0.5" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
