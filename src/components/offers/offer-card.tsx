import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, CarFront, MapPin, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { Countdown } from "./countdown";
import { benefitList, discountHeadline, offerImage, type Benefit, type PublicOffer } from "./offer-utils";
import { OFFER_CATEGORY_LABEL } from "@/partner/labels";
import type { OfferCategory } from "@/partner/types";

/* The public offer card — used on /offers, dealer and car pages, and as the live preview in the dealer portal. */

export interface OfferCardData {
  href?: string;
  title: string;
  tagline: string;
  categoryLabel: string;
  headline: string;
  image: string;
  dealerName: string;
  dealerCity: string;
  startsAt: string;
  endsAt: string;
  vehicleLabel: string;
  locationLabel: string;
  benefits: Benefit[];
}

export const categoryLabel = (c: string) => OFFER_CATEGORY_LABEL[c as OfferCategory] ?? "Dealer offer";

export function toCardData(o: PublicOffer): OfferCardData {
  return {
    href: `/offers/${o.reference}`,
    title: o.title,
    tagline: o.tagline,
    categoryLabel: categoryLabel(o.category),
    headline: discountHeadline(o.discount),
    image: offerImage(o.media),
    dealerName: o.dealer.name,
    dealerCity: o.dealer.city,
    startsAt: o.startsAt,
    endsAt: o.endsAt,
    vehicleLabel: o.vehicleLabel,
    locationLabel: o.locationLabel,
    benefits: benefitList(o.discount),
  };
}

/** `priority` preloads the image (a page's hero); `eager` just skips lazy-loading (above-the-fold cards). */
export function OfferArt({ image, headline, className, sizes, priority, eager }: { image: string; headline: string; className?: string; sizes?: string; priority?: boolean; eager?: boolean }) {
  if (image)
    return (
      <Image
        src={image}
        alt=""
        fill
        sizes={sizes ?? "(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 92vw"}
        preload={priority}
        loading={!priority && eager ? "eager" : undefined}
        className={cn("object-cover transition-transform duration-[900ms] ease-[var(--ease-premium)] group-hover/offer:scale-[1.035]", className)}
      />
    );
  return (
    <div aria-hidden className={cn("absolute inset-0 overflow-hidden bg-ink", className)}>
      <div className="absolute -right-16 -top-24 size-72 rotate-12 bg-red/90" />
      <div className="absolute -right-6 top-24 h-px w-80 rotate-12 bg-white/25" />
      <p className="absolute bottom-5 left-5 max-w-[70%] font-display text-[22px] font-semibold leading-[1.05] tracking-[-0.02em] text-white">{headline}</p>
    </div>
  );
}

export function OfferCard({ offer, renderedAt, className, compact, priority }: { offer: OfferCardData; renderedAt: number; className?: string; compact?: boolean; priority?: boolean }) {
  const extra = offer.benefits.slice(0, compact ? 2 : 3);
  return (
    <article
      className={cn(
        "group/offer relative flex h-full min-w-0 flex-col overflow-hidden border border-line bg-white transition-[border-color,transform] duration-[500ms] ease-[var(--ease-premium)] hover:border-ink/25",
        className,
      )}
    >
      <div className={cn("relative overflow-hidden bg-mist", compact ? "aspect-[16/9]" : "aspect-[16/10]")}>
        {/* A grid of cards has no single LCP image (1 column on phones, 3 on desktop) — load the first ones eagerly instead of preloading them. */}
        <OfferArt image={offer.image} headline="" eager={priority} />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/55 via-transparent to-ink/10" />
        <div className="absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
          <span className="inline-flex h-6 items-center rounded-[2px] bg-white/92 px-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink backdrop-blur-sm">
            {offer.categoryLabel}
          </span>
          <span className="inline-flex h-6 items-center rounded-[2px] bg-ink/70 px-2 backdrop-blur-sm">
            <Countdown startsAt={offer.startsAt} endsAt={offer.endsAt} renderedAt={renderedAt} tone="light" compact />
          </span>
        </div>
        <p className="absolute bottom-3 left-4 right-4 truncate text-[12px] font-medium text-white/90">
          <Store aria-hidden className="mr-1.5 inline size-3.5 -translate-y-px" />
          {offer.dealerName}
          {offer.dealerCity && <span className="text-white/60"> · {offer.dealerCity}</span>}
        </p>
      </div>

      <div className={cn("flex flex-1 flex-col", compact ? "p-4" : "p-5")}>
        <p className={cn("font-display font-semibold leading-tight tracking-[-0.02em] text-red", compact ? "text-[18px]" : "text-[21px]")}>{offer.headline}</p>
        <h3 className={cn("mt-2 font-display font-semibold leading-snug tracking-[-0.01em] text-ink", compact ? "text-[15px]" : "text-[17px]")}>
          {offer.href ? (
            <Link href={offer.href} className="after:absolute after:inset-0 after:z-[1] focus-visible:outline-none">
              {offer.title || "Untitled offer"}
            </Link>
          ) : (
            offer.title || "Untitled offer"
          )}
        </h3>
        {!compact && offer.tagline && <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-muted">{offer.tagline}</p>}

        {extra.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {extra.map((b) => (
              <li key={b.key} className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-line px-2.5 py-1 text-[11.5px] text-ink/80">
                <span className="truncate">
                  {b.label}
                  {b.key !== "freeInsurance" && b.key !== "freeAccessories" && b.key !== "financeBenefit" ? ` · ${b.value}` : ""}
                </span>
              </li>
            ))}
            {offer.benefits.length > extra.length && <li className="inline-flex items-center px-1 text-[11.5px] text-muted">+{offer.benefits.length - extra.length} more</li>}
          </ul>
        )}

        <div className="mt-auto pt-5">
          <dl className="space-y-1.5 border-t border-line pt-4 text-[12.5px] text-muted">
            <div className="flex min-w-0 items-center gap-2">
              <dt className="sr-only">Vehicles</dt>
              <CarFront aria-hidden className="size-3.5 shrink-0 text-ink/50" />
              <dd className="truncate">{offer.vehicleLabel}</dd>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <dt className="sr-only">Valid at</dt>
              <MapPin aria-hidden className="size-3.5 shrink-0 text-ink/50" />
              <dd className="truncate">{offer.locationLabel}</dd>
            </div>
          </dl>
        </div>
        {offer.href && (
          <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-ink">
            View offer <ArrowUpRight aria-hidden className="size-4 text-red transition-transform duration-[250ms] group-hover/offer:-translate-y-0.5 group-hover/offer:translate-x-0.5" />
          </span>
        )}
      </div>
    </article>
  );
}
