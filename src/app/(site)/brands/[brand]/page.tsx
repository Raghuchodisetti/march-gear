import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight, Clock, MapPin, Star } from "lucide-react";
import type { Article, Brand } from "@/types";
import type { Catalog } from "@/lib/catalog";
import { getCatalog } from "@/server/catalog";
import { formatDate, formatMonth, formatPriceRange } from "@/lib/format";
import { Badge, DemoNote } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { BrandMonogram } from "@/components/ui/page-header";
import { Counter, Reveal } from "@/components/ui/reveal";
import { Eyebrow, SectionHeading, TextLink } from "@/components/ui/section-heading";
import { EnquiryButton } from "@/components/listing/enquiry-button";
import { BrandModels } from "./_components/brand-models";

export async function generateStaticParams() {
  const { brands } = await getCatalog();
  return brands.map((b) => ({ brand: b.slug }));
}

export async function generateMetadata(props: PageProps<"/brands/[brand]">): Promise<Metadata> {
  const { brand: slug } = await props.params;
  const cat = await getCatalog();
  const brand = cat.getBrand(slug);
  if (!brand) return { title: "Brand not found" };
  const line = cat.carsByBrand(brand.slug);
  return {
    title: `${brand.name} cars in India — models, prices & dealers`,
    description: `${brand.tagline}. Explore ${line.length} ${brand.name} ${line.length === 1 ? "model" : "models"} on sale in India, upcoming launches, latest stories and dealers.`,
  };
}

function storiesFor(brand: Brand, cat: Catalog): Article[] {
  const names = new Set([brand.name.toLowerCase(), brand.name.split(" ")[0].toLowerCase()]);
  return cat.articles
    .filter((a) => a.tags.some((t) => names.has(t.toLowerCase())) || (a.relatedCar && cat.getCar(a.relatedCar)?.brand === brand.slug))
    .sort((a, b) => b.publishedOn.localeCompare(a.publishedOn));
}

/** Count-up friendly split of a rupee amount: 6.49 → "Lakh", 1.7 → "Cr". */
function priceParts(amount: number) {
  const crore = amount >= 10_000_000;
  const value = crore ? amount / 10_000_000 : amount / 100_000;
  const rounded = Number(value.toFixed(2));
  const decimals = Number.isInteger(rounded) ? 0 : Number.isInteger(rounded * 10) ? 1 : 2;
  return { value: rounded, decimals, suffix: crore ? " Cr" : " L" };
}

export default async function BrandPage(props: PageProps<"/brands/[brand]">) {
  const { brand: slug } = await props.params;
  const cat = await getCatalog();
  const brand = cat.getBrand(slug);
  if (!brand) notFound();

  const line = cat.carsByBrand(brand.slug).sort((a, b) => a.priceMin - b.priceMin);
  const summary = cat.brandSummary(brand);
  const upcoming = cat.upcoming.filter((c) => c.brand === brand.slug).sort((a, b) => a.expectedLaunch.localeCompare(b.expectedLaunch));
  const stories = storiesFor(brand, cat).slice(0, 4);
  const brandDealers = cat.dealers.filter((d) => d.brand === brand.slug);
  const others = cat.brands.filter((b) => b.slug !== brand.slug);
  const price = summary.startingPrice ? priceParts(summary.startingPrice) : null;
  const [lead, ...moreStories] = stories;

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-ink text-white">
        <Image src={brand.heroImage} alt="" fill preload sizes="100vw" className="-z-10 animate-kenburns object-cover opacity-55" style={{ objectPosition: "50% 60%" }} />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/55 to-ink/15" />
        <div className="container-x flex min-h-[600px] flex-col pb-14 pt-10 md:min-h-[680px] md:pb-20 md:pt-14">
          <Breadcrumbs items={[{ label: "Brands", href: "/brands" }, { label: brand.name }]} tone="light" />
          <Reveal className="mt-auto max-w-4xl pt-20">
            <div className="flex items-center gap-4">
              <BrandMonogram name={brand.name} tone="dark" className="size-12 text-[17px] md:size-14 md:text-[19px]" />
              <Eyebrow tone="light">
                {brand.country} · Since {brand.founded}
              </Eyebrow>
            </div>
            <h1 className="type-display mt-8 text-balance break-words">{brand.name}</h1>
            <p className="type-editorial mt-4 text-[24px] text-white/85 md:text-[32px]">{brand.tagline}</p>
            <p className="type-lead mt-6 max-w-2xl text-white/65">{brand.description}</p>
            <div className="mt-10 flex flex-wrap gap-3">
              {line.length > 0 && (
                <Button href="#models" variant="light" arrow>
                  Explore {line.length} {line.length === 1 ? "model" : "models"}
                </Button>
              )}
              <EnquiryButton kind="test-drive" subject={`${brand.name} test drive`} detail="Choose a model and we'll confirm a slot" variant="outline-light">
                Book a test drive
              </EnquiryButton>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────── */}
      <section className="bg-ink text-white" aria-label={`${brand.name} at a glance`}>
        <div className="container-x">
          <dl className="grid grid-cols-2 border-t border-white/15 lg:grid-cols-4">
            <BrandStat label="Models on sale">
              <Counter to={summary.models} />
            </BrandStat>
            <BrandStat label="Starting ex-showroom" note="Indicative">
              {price ? <Counter to={price.value} decimals={price.decimals} prefix="₹" suffix={price.suffix} /> : "—"}
            </BrandStat>
            <BrandStat label="Electric models">
              <Counter to={summary.evs} />
            </BrandStat>
            <BrandStat label="Founded">
              <span>{brand.founded}</span>
            </BrandStat>
          </dl>
        </div>
      </section>

      {/* ── Models ───────────────────────────────────────────── */}
      <section id="models" className="scroll-mt-24 py-14 md:py-20">
        <div className="container-x">
          <SectionHeading
            eyebrow="The line-up"
            title={`${brand.name} models on sale`}
            description="Prices are indicative ex-showroom figures for demonstration and vary by city and variant."
          >
            {line.length > 1 && <TextLink href={`/compare?cars=${line.slice(0, 4).map((c) => c.slug).join(",")}`}>Compare the line-up</TextLink>}
          </SectionHeading>
          <div className="mt-12 md:mt-16">
            {line.length > 0 ? (
              <BrandModels cars={line} />
            ) : (
              <p className="border border-dashed border-line px-6 py-14 text-center text-muted">No {brand.name} models are on sale right now.</p>
            )}
          </div>
        </div>
      </section>

      {/* ── Upcoming ─────────────────────────────────────────── */}
      {upcoming.length > 0 && (
        <section className="bg-mist py-14 md:py-20">
          <div className="container-x">
            <SectionHeading
              eyebrow="On the horizon"
              title={`Coming soon from ${brand.name}`}
              action={{ label: "Full launch calendar", href: `/upcoming-cars?brand=${brand.slug}` }}
            />
            <ul className="mt-12 border-t border-ink/10 md:mt-16">
              {upcoming.map((car) => (
                <li key={car.slug} className="border-b border-ink/10">
                  <Link
                    href={`/upcoming-cars?brand=${brand.slug}`}
                    className="group/up grid grid-cols-1 gap-5 py-8 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-8 md:grid-cols-[280px_minmax(0,1fr)_auto] md:items-center md:gap-12"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-white">
                      <Image
                        src={car.image}
                        alt={`${brand.name} ${car.name} — representative image`}
                        fill
                        sizes="(min-width: 768px) 280px, (min-width: 640px) 200px, 92vw"
                        className="object-cover transition-transform duration-[700ms] ease-[var(--ease-premium)] group-hover/up:scale-[1.04]"
                      />
                    </div>
                    <div className="min-w-0">
                      <Badge tone="outline">Expected {formatMonth(car.expectedLaunch)}</Badge>
                      <h3 className="type-h3 mt-4">{car.name}</h3>
                      <p className="mt-2 max-w-xl text-[14.5px] leading-relaxed text-muted">{car.teaser}</p>
                    </div>
                    <div className="flex items-end justify-between gap-6 sm:col-span-2 md:col-span-1 md:block md:text-right">
                      <div>
                        <p className="text-[16px] font-semibold num">{formatPriceRange(car.priceMin, car.priceMax)}</p>
                        <p className="mt-0.5 text-[11.5px] text-muted">Expected · indicative</p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium md:mt-5">
                        Set an alert
                        <ArrowRight aria-hidden className="size-3.5 text-red transition-transform duration-[250ms] group-hover/up:translate-x-0.5" />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── Stories ──────────────────────────────────────────── */}
      {lead && (
        <section className="py-14 md:py-20">
          <div className="container-x">
            <SectionHeading eyebrow="Stories" title={`The latest on ${brand.name}`} action={{ label: "All stories", href: "/news" }} />
            <div className={`mt-12 grid grid-cols-1 gap-10 md:mt-16 ${moreStories.length ? "lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16" : ""}`}>
              <Link href={`/news/${lead.slug}`} className={`group/story block ${moreStories.length ? "" : "md:grid md:grid-cols-2 md:items-center md:gap-12"}`}>
                <div className="relative aspect-[16/10] overflow-hidden bg-mist">
                  <Image
                    src={lead.image}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 55vw, 100vw"
                    className="object-cover transition-transform duration-[700ms] ease-[var(--ease-premium)] group-hover/story:scale-[1.03]"
                  />
                </div>
                <div className="mt-6 md:mt-0">
                  <p className={`type-eyebrow text-red ${moreStories.length ? "md:mt-6" : ""}`}>{lead.category}</p>
                  <h3 className="type-h2 mt-4 text-balance">{lead.title}</h3>
                  <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">{lead.dek}</p>
                  <p className="mt-5 flex items-center gap-2 text-[12.5px] text-muted num">
                    {formatDate(lead.publishedOn)} <span aria-hidden>·</span> <Clock aria-hidden className="size-3.5" /> {lead.readMinutes} min read
                  </p>
                </div>
              </Link>
              {moreStories.length > 0 && (
                <ul className="border-t border-line">
                  {moreStories.map((a) => (
                    <li key={a.slug} className="border-b border-line">
                      <Link href={`/news/${a.slug}`} className="group/story grid grid-cols-[minmax(0,1fr)_96px] gap-5 py-6 sm:grid-cols-[minmax(0,1fr)_128px]">
                        <div className="min-w-0">
                          <p className="type-eyebrow text-muted">{a.category}</p>
                          <h3 className="type-h4 mt-3 text-balance transition-colors group-hover/story:text-red">{a.title}</h3>
                          <p className="mt-3 text-[12.5px] text-muted num">{formatDate(a.publishedOn)}</p>
                        </div>
                        <div className="relative aspect-square overflow-hidden bg-mist">
                          <Image src={a.image} alt="" fill sizes="128px" className="object-cover" />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Dealers ──────────────────────────────────────────── */}
      <section className="border-t border-line py-14 md:py-20">
        <div className="container-x grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-20">
          <div>
            <Eyebrow>Where to buy</Eyebrow>
            <h2 className="type-h2 mt-5 text-balance">{brand.name} showrooms</h2>
            <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-muted">
              Authorised partners for sales, test drives and service. Dealer details are fictional demo listings.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button href="/dealers" variant="outline" arrow>
                All dealers
              </Button>
            </div>
          </div>

          {brandDealers.length > 0 ? (
            <ul className="grid grid-cols-1 border-t border-line md:grid-cols-2">
              {brandDealers.map((d) => (
                <li key={d.id} className="border-b border-line md:odd:pr-8 md:even:border-l md:even:pl-8">
                  <Link href={`/dealers/${d.id}`} className="group/dealer flex h-full flex-col py-7">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="type-h4">{d.name}</h3>
                      <ArrowUpRight aria-hidden className="size-4 shrink-0 text-red transition-transform duration-[250ms] group-hover/dealer:-translate-y-0.5 group-hover/dealer:translate-x-0.5" />
                    </div>
                    <p className="mt-2 flex items-center gap-1.5 text-[13.5px] text-muted">
                      <MapPin aria-hidden className="size-3.5" />
                      {d.area}, {d.city}
                    </p>
                    <p className="mt-1 text-[13px] text-muted">{d.hours}</p>
                    <p className="mt-5 flex items-center gap-1.5 text-[13px]">
                      <Star aria-hidden className="size-3.5 fill-ink text-ink" strokeWidth={0} />
                      <span className="font-semibold num">{d.rating.toFixed(1)}</span>
                      <span className="text-muted num">({d.reviewCount.toLocaleString("en-IN")} reviews)</span>
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col justify-between gap-8 border border-line p-6 sm:p-10">
              <div>
                <p className="type-h3">We&rsquo;re onboarding {brand.name} showrooms.</p>
                <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-muted">
                  Leave your number and a {brand.name} specialist will call back with the nearest authorised dealer, current offers and test-drive slots.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <EnquiryButton kind="callback" subject={`${brand.name} dealer callback`}>
                  Request a callback
                </EnquiryButton>
                <DemoNote>Demo — no call will be placed</DemoNote>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Other brands ─────────────────────────────────────── */}
      <section className="border-t border-line py-14 md:py-20">
        <div className="container-x">
          <div className="flex items-end justify-between gap-6">
            <h2 className="type-h3">Other brands</h2>
            <TextLink href="/brands">All brands</TextLink>
          </div>
          <ul className="no-scrollbar -mx-5 mt-8 flex gap-3 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0">
            {others.map((b) => (
              <li key={b.slug} className="shrink-0">
                <Link
                  href={`/brands/${b.slug}`}
                  className="group/other flex h-14 items-center gap-4 border border-line pr-5 text-[14px] font-medium transition-colors duration-[250ms] hover:border-ink"
                >
                  <BrandMonogram name={b.name} className="h-full w-14 text-[15px] transition-colors duration-[250ms] group-hover/other:bg-ink group-hover/other:text-white" />
                  {b.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

function BrandStat({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-white/15 py-7 even:border-l even:pl-5 [&:nth-child(n+3)]:border-b-0 lg:border-b-0 lg:border-l lg:py-10 lg:pl-8 lg:first:border-l-0 lg:first:pl-0">
      <dt className="text-[12.5px] text-white/55">
        {label}
        {note && <span className="ml-2 text-white/35">{note}</span>}
      </dt>
      <dd className="mt-2 font-display text-[32px] font-semibold leading-none tracking-[-0.035em] [font-stretch:108%] num md:text-[48px]">{children}</dd>
    </div>
  );
}
