"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { Eyebrow, TextLink } from "@/components/ui/section-heading";
import { Countdown, useNow } from "./countdown";
import { OfferCard, type OfferCardData } from "./offer-card";

/*
 * Offer lists for statically rendered pages (dealer and car pages). The server sends live and
 * upcoming offers; the browser shows only those inside their window right now, so an offer
 * appears and disappears on time even while the page itself is cached.
 */

function useLive(offers: OfferCardData[], renderedAt: number) {
  const now = useNow(renderedAt);
  return offers.filter((o) => new Date(o.startsAt).getTime() <= now && now <= new Date(o.endsAt).getTime());
}

export function LiveOfferSection({
  offers,
  renderedAt,
  title,
  description,
  link,
}: {
  offers: OfferCardData[];
  renderedAt: number;
  title: string;
  description?: string;
  link?: { href: string; label: string };
}) {
  const live = useLive(offers, renderedAt);
  if (!live.length) return null;
  return (
    <section aria-labelledby="live-offers-title" className="border-b border-line bg-[#F6F6F6] py-14 md:py-20">
      <div className="container-x">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <Eyebrow>
              {live.length} live offer{live.length === 1 ? "" : "s"}
            </Eyebrow>
            <h2 id="live-offers-title" className="type-h2 mt-5 text-balance">
              {title}
            </h2>
            {description && <p className="mt-3 max-w-xl text-[15px] text-muted">{description}</p>}
          </div>
          {link && <TextLink href={link.href}>{link.label}</TextLink>}
        </div>
        <ul className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {live.map((o) => (
            <li key={o.href ?? o.title} className="min-w-0">
              <OfferCard offer={o} renderedAt={renderedAt} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Compact "dealer offers on this car" panel. */
export function LiveOfferPanel({ offers, renderedAt, title, link }: { offers: OfferCardData[]; renderedAt: number; title: string; link?: { href: string; label: string } }) {
  const live = useLive(offers, renderedAt);
  if (!live.length) return null;
  const shown = live.slice(0, 3);
  return (
    <section aria-labelledby="car-offers-title" className="container-x py-8 md:py-10">
      <div className="border border-line bg-white">
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red">
              <Sparkles aria-hidden className="size-4" />
            </span>
            <div className="min-w-0">
              <h2 id="car-offers-title" className="type-h4">
                {title}
              </h2>
              <p className="text-[12.5px] text-muted">
                {live.length} offer{live.length === 1 ? "" : "s"} from verified MarchGear dealer partners
              </p>
            </div>
          </div>
          {link && (
            <Link href={link.href} className="group/l inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-ink hover:underline">
              {link.label} <ArrowUpRight aria-hidden className="size-4 text-red transition-transform group-hover/l:-translate-y-0.5 group-hover/l:translate-x-0.5" />
            </Link>
          )}
        </div>
        <ul className="divide-y divide-line">
          {shown.map((o) => (
            <li key={o.href ?? o.title} className="group/row relative flex items-center gap-4 px-5 py-4 transition-colors duration-300 hover:bg-mist/50 md:px-6">
              <div className="relative hidden aspect-[4/3] w-24 shrink-0 overflow-hidden bg-ink sm:block">
                {o.image ? <Image src={o.image} alt="" fill sizes="96px" className="object-cover" /> : <span aria-hidden className="absolute -right-6 -top-8 size-16 rotate-12 bg-red" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-[16px] font-semibold leading-tight tracking-[-0.01em] text-red">{o.headline}</p>
                <p className="mt-1 truncate text-[14px] font-medium text-ink">
                  {o.href ? (
                    <Link href={o.href} className="after:absolute after:inset-0 focus-visible:outline-none">
                      {o.title}
                    </Link>
                  ) : (
                    o.title
                  )}
                </p>
                <p className="mt-0.5 truncate text-[12.5px] text-muted">
                  {o.dealerName}
                  {o.dealerCity ? ` · ${o.dealerCity}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Countdown startsAt={o.startsAt} endsAt={o.endsAt} renderedAt={renderedAt} />
                <ArrowUpRight aria-hidden className="size-4 text-ink/40 transition-colors group-hover/row:text-red" />
              </div>
            </li>
          ))}
        </ul>
        {live.length > shown.length && link && (
          <p className="border-t border-line px-5 py-3 text-[12.5px] text-muted md:px-6">
            +{live.length - shown.length} more — <Link href={link.href} className="font-medium text-ink underline-offset-4 hover:underline">see all</Link>
          </p>
        )}
      </div>
    </section>
  );
}
