import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowUpRight, BadgeCheck, CalendarRange, FileText, MapPin, PlayCircle, Store } from "lucide-react";
import { getCatalog } from "@/server/catalog";
import { publicOfferByRef } from "@/server/partner/offers";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Eyebrow } from "@/components/ui/section-heading";
import { Button } from "@/components/ui/button";
import { TrackView } from "@/components/portal/track";
import { Countdown } from "@/components/offers/countdown";
import { OfferEnquiryForm } from "@/components/offers/offer-enquiry-form";
import { categoryLabel } from "@/components/offers/offer-card";
import { benefitList, discountHeadline, formatIst, money, videoHost } from "@/components/offers/offer-utils";
import { fitDescription, fitTitle, pageMetadata } from "@/components/seo/metadata";

const fileSize = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** The offer if it's live right now (status, dealer and window re-checked against the database). */
const load = (ref: string) => publicOfferByRef(ref.toUpperCase());

export async function generateMetadata(props: PageProps<"/offers/[ref]">): Promise<Metadata> {
  const { ref } = await props.params;
  const offer = await load(ref);
  if (!offer) return { title: "Offer not found" };
  return pageMetadata({
    title: fitTitle([`${offer.title}: ${offer.dealer.name}, ${offer.dealer.city}`, `${offer.title}, ${offer.dealer.city}`, offer.title]),
    description: fitDescription(
      `${discountHeadline(offer.discount)} at ${offer.dealer.name}, ${offer.dealer.city}.`,
      offer.tagline,
      `Valid till ${formatIst(offer.endsAt, false)}.`,
    ),
    path: `/offers/${offer.reference}`,
    images: offer.media.desktopBanner ? [{ url: offer.media.desktopBanner, alt: offer.title }] : undefined,
  });
}

export default async function OfferPage(props: PageProps<"/offers/[ref]">) {
  // Offers start and end by the minute — always render at request time.
  await connection();
  const { ref } = await props.params;
  const offer = await load(ref);
  if (!offer) notFound();
  const cat = await getCatalog();
  const renderedAt = new Date().getTime();

  const benefits = benefitList(offer.discount);
  const headline = discountHeadline(offer.discount);
  const covered =
    offer.scope.allModels || !offer.scope.models.length
      ? offer.scope.vehicleType === "used"
        ? []
        : offer.brands.flatMap((b) => cat.carsByBrand(b))
      : offer.scope.models.map((m) => cat.getCar(m)).filter((c) => c !== undefined);
  const variantNames = offer.scope.variants
    .map((v) => {
      const [car, variant] = v.split("/");
      const c = cat.getCar(car);
      const x = c?.variants.find((y) => y.slug === variant);
      return c && x ? `${c.name} ${x.name}` : null;
    })
    .filter((v): v is string => Boolean(v));
  const conditions = [
    offer.discount.minPurchase && { label: "Purchase condition", value: offer.discount.minPurchase },
    offer.discount.maxDiscount && { label: "Maximum benefit", value: money(offer.discount.maxDiscount) },
    offer.limitedStock && { label: "Limited stock", value: `${offer.limitedStock.toLocaleString("en-IN")} units` },
    offer.maxRedemptions && { label: "Limited redemptions", value: `First ${offer.maxRedemptions.toLocaleString("en-IN")} customers` },
    { label: "Vehicles", value: offer.scope.vehicleType === "used" ? "Pre-owned cars" : offer.scope.vehicleType === "both" ? "New and pre-owned cars" : "New cars" },
  ].filter((c): c is { label: string; value: string } => Boolean(c));
  const desktop = offer.media.desktopBanner || offer.media.mobileBanner;
  const mobile = offer.media.mobileBanner || offer.media.desktopBanner;
  const video = offer.media.videoUrl ? videoHost(offer.media.videoUrl) : "";

  return (
    <>
      <TrackView partnerId={offer.partnerId} kind="offer_view" refId={offer.id} />

      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-ink text-white">
        {desktop && (
          <picture>
            <source media="(max-width: 639px)" srcSet={mobile} />
            {/* Dealer-uploaded banner, served as-is from /media (art-directed for mobile). */}
            <img decoding="async" src={desktop} alt="" className="absolute inset-0 -z-10 size-full animate-kenburns object-cover opacity-60" />
          </picture>
        )}
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/55 to-ink/20" />
        <div className="container-x pb-12 pt-8 md:pb-16 md:pt-10">
          <Breadcrumbs
            tone="light"
            items={[
              { label: "Dealer offers", href: "/offers" },
              { label: offer.dealer.city, href: `/offers?city=${encodeURIComponent(offer.dealer.city)}` },
              { label: offer.title },
            ]}
          />
          <div className="mt-20 flex flex-col gap-10 md:mt-32 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 max-w-3xl animate-rise">
              <Eyebrow tone="light">{categoryLabel(offer.category)}</Eyebrow>
              <h1 className="type-h1 mt-5 text-balance">{offer.title}</h1>
              {offer.tagline && <p className="type-lead mt-5 max-w-2xl text-white/75">{offer.tagline}</p>}
              <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 text-[14px] text-white/70">
                <Link href={`/dealers/${offer.dealer.id}`} className="inline-flex items-center gap-1.5 font-medium text-white hover:underline">
                  <Store aria-hidden className="size-4" /> {offer.dealer.name}
                </Link>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin aria-hidden className="size-4" /> {offer.locationLabel}
                </span>
                <Countdown startsAt={offer.startsAt} endsAt={offer.endsAt} renderedAt={renderedAt} tone="light" className="text-[14px]" />
              </div>
            </div>
            <div className="shrink-0 animate-rise border-l-2 border-red pl-5 [animation-delay:150ms]">
              <p className="type-eyebrow text-white/60">The offer</p>
              <p className="mt-2 max-w-xs font-display text-[30px] font-semibold leading-[1.05] tracking-[-0.025em] md:text-[36px]">{headline}</p>
              <Button href="#get-offer" size="lg" className="mt-6" arrow>
                Get this offer
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section aria-labelledby="benefits-title" className="border-b border-line">
        <div className="container-x py-10 md:py-12">
          <h2 id="benefits-title" className="sr-only">
            Benefits
          </h2>
          <dl className="grid grid-cols-1 gap-px overflow-hidden border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((b) => (
              <div key={b.key} className="min-w-0 bg-white p-5">
                <dt className="text-[12px] text-muted">{b.label}</dt>
                <dd className="mt-1.5 break-words font-display text-[19px] font-semibold leading-snug tracking-[-0.01em]">{b.value}</dd>
              </div>
            ))}
            <div className="min-w-0 bg-white p-5">
              <dt className="text-[12px] text-muted">Valid</dt>
              <dd className="mt-1.5 text-[14px] font-medium leading-snug">
                {formatIst(offer.startsAt)} – {formatIst(offer.endsAt)}
                <span className="block text-[12px] font-normal text-muted">India Standard Time · ends automatically</span>
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="py-14 md:py-20">
        <div className="container-x grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="min-w-0 space-y-14 lg:col-span-7 xl:col-span-8">
            <div>
              <Eyebrow>About the offer</Eyebrow>
              <p className="type-lead mt-6 whitespace-pre-line text-ink/80">{offer.description}</p>
            </div>

            <div>
              <h2 className="type-h3">Eligible vehicles</h2>
              <p className="mt-2 text-[14px] text-muted">{offer.vehicleLabel}</p>
              {covered.length > 0 && (
                <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {covered.slice(0, 12).map((c) => (
                    <li key={c.slug}>
                      <Link href={`/cars/${c.slug}`} className="group/car flex items-center gap-4 border border-line p-3 transition-colors duration-300 hover:border-ink/30">
                        <span className="relative aspect-[4/3] w-20 shrink-0 overflow-hidden bg-mist">
                          <Image src={c.images[0]} alt="" fill sizes="80px" className="object-cover" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12px] text-muted">{cat.brandName(c.brand)}</span>
                          <span className="block truncate text-[15px] font-medium">{c.name}</span>
                        </span>
                        <ArrowUpRight aria-hidden className="size-4 shrink-0 text-ink/40 transition-colors group-hover/car:text-red" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {variantNames.length > 0 && <p className="mt-4 text-[13px] text-muted">Variants: {variantNames.join(", ")}</p>}
            </div>

            <div>
              <h2 className="type-h3">Where it&apos;s valid</h2>
              <p className="mt-2 text-[14px] text-muted">{offer.locationLabel}</p>
              {offer.branches.length > 0 && (
                <ul className="mt-5 divide-y divide-line border-y border-line">
                  {offer.branches.map((b) => (
                    <li key={`${b.name}-${b.address}`} className="flex gap-3 py-4">
                      <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-red" />
                      <div className="min-w-0">
                        <p className="text-[14.5px] font-medium">{b.name}</p>
                        <p className="text-[13px] text-muted">{b.address}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h2 className="type-h3">Conditions</h2>
              <dl className="mt-5 grid grid-cols-1 border-t border-line sm:grid-cols-2">
                {conditions.map((c) => (
                  <div key={c.label} className="border-b border-line py-4 sm:odd:pr-6">
                    <dt className="text-[12px] text-muted">{c.label}</dt>
                    <dd className="mt-1 text-[14.5px]">{c.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {offer.media.gallery.length > 0 && (
              <div>
                <h2 className="type-h3">Gallery</h2>
                <ul className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
                  {offer.media.gallery.map((src) => (
                    <li key={src} className="relative aspect-[4/3] overflow-hidden bg-mist">
                      <Image src={src} alt="" fill sizes="(min-width: 768px) 25vw, 45vw" className="object-cover" />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(video || offer.media.brochure) && (
              <div className="flex flex-col gap-3 sm:flex-row">
                {video && (
                  <a href={offer.media.videoUrl} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-center gap-4 border border-line p-4 transition-colors hover:border-ink/30">
                    <PlayCircle aria-hidden className="size-8 shrink-0 text-red" />
                    <span className="min-w-0">
                      <span className="block text-[14.5px] font-medium">Watch the promotional video</span>
                      <span className="block text-[12.5px] text-muted">Opens on {video} in a new tab</span>
                    </span>
                  </a>
                )}
                {offer.media.brochure && (
                  <a href={`/offers/${offer.reference}/brochure`} target="_blank" rel="noopener" className="flex flex-1 items-center gap-4 border border-line p-4 transition-colors hover:border-ink/30">
                    <FileText aria-hidden className="size-8 shrink-0 text-red" />
                    <span className="min-w-0">
                      <span className="block text-[14.5px] font-medium">Download the brochure</span>
                      <span className="block text-[12.5px] text-muted">{fileSize(offer.media.brochure.size)}</span>
                    </span>
                  </a>
                )}
              </div>
            )}

            <div>
              <h2 className="type-h3">Terms &amp; conditions</h2>
              <p className="mt-5 whitespace-pre-line text-[14px] leading-relaxed text-muted">{offer.terms}</p>
              <p className="mt-6 inline-flex items-start gap-2 text-[12.5px] text-muted">
                <BadgeCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-red" />
                Reviewed by MarchGear before publishing. The dealership sets and honours the offer — offer reference {offer.reference}.
              </p>
            </div>
          </div>

          <aside id="get-offer" className="scroll-mt-28 lg:col-span-5 xl:col-span-4">
            <div className="border border-line bg-white lg:sticky lg:top-28">
              <OfferEnquiryForm
                offer={{
                  reference: offer.reference,
                  title: offer.title,
                  headline,
                  dealerId: offer.dealer.id,
                  dealerName: offer.dealer.name,
                  dealerCity: offer.dealer.city,
                  startsAt: offer.startsAt,
                  endsAt: offer.endsAt,
                }}
                models={covered.map((c) => ({ slug: c.slug, name: `${cat.brandName(c.brand)} ${c.name}` }))}
                renderedAt={renderedAt}
              />
              <div className="flex items-center justify-between gap-3 border-t border-line bg-mist/60 px-6 py-4 text-[13px]">
                <span className="inline-flex min-w-0 items-center gap-2 text-muted">
                  <CalendarRange aria-hidden className="size-4 shrink-0" />
                  <span className="truncate">Till {formatIst(offer.endsAt, false)}</span>
                </span>
                <Link href={`/dealers/${offer.dealer.id}`} className="shrink-0 font-medium text-ink underline-offset-4 hover:underline">
                  View showroom
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
