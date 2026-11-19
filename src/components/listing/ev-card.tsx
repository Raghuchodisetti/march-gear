"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, BatteryCharging, PlugZap, Zap } from "lucide-react";
import type { CarModel } from "@/types";
import { formatPrice } from "@/lib/format";
import { EASE } from "@/lib/motion";
import { Badge } from "@/components/ui/badge";
import { CompareToggle, WishlistButton } from "@/components/vehicle/toggles";
import { useCatalog } from "@/components/providers/catalog-provider";
import { evHref } from "./ev-utils";

/**
 * EV-first card: the claimed range is the headline, drawn against a thin bar
 * scaled to the longest-range EV on sale; battery and DC charge sit beneath.
 */
export function EvCard({ car, maxRange, priority = false }: { car: CarModel; maxRange: number; priority?: boolean }) {
  const { brandName } = useCatalog();
  const ev = car.ev;
  const title = `${brandName(car.brand)} ${car.name}`;
  if (!ev) return null;
  const share = Math.min(1, ev.rangeKm / maxRange);
  const [dcTime, dcWindow] = ev.dcCharge.split(" (");

  return (
    <article className="group/ev relative flex h-full flex-col border border-line bg-white transition-[border-color] duration-[400ms] ease-[var(--ease-premium)] hover:border-ink/25">
      <div className="relative aspect-[16/10] overflow-hidden bg-mist">
        <Image
          src={car.images[0]}
          alt={title}
          fill
          preload={priority}
          sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 92vw"
          className="object-cover transition-transform duration-[700ms] ease-[var(--ease-premium)] group-hover/ev:scale-[1.04]"
          style={{ objectPosition: car.focus ?? "50% 55%" }}
        />
        <div className="absolute inset-x-3 top-3 flex items-start justify-between">
          <Badge tone="glass-dark">
            <Zap aria-hidden className="size-3" /> {ev.motorKw} kW
          </Badge>
          <WishlistButton id={car.slug} label={title} />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="type-eyebrow text-muted">{brandName(car.brand)}</p>
            <h3 className="type-h3 mt-2">
              <Link href={evHref(car)} className="after:absolute after:inset-0 focus-visible:outline-none">
                {car.name}
              </Link>
            </h3>
          </div>
          <p className="shrink-0 text-right text-[14px] font-semibold num">
            {formatPrice(car.priceMin)}
            <span className="mt-0.5 block text-[11px] font-normal text-muted">onwards · indicative</span>
          </p>
        </div>

        <div className="mt-7">
          <div className="flex items-end justify-between gap-3">
            <p className="leading-none">
              <span className="font-display text-[44px] font-semibold tracking-[-0.045em] [font-stretch:108%] num">{ev.rangeKm}</span>
              <span className="ml-1.5 text-[14px] font-medium text-muted">km</span>
            </p>
            <p className="pb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Claimed range</p>
          </div>
          <RangeBar share={share} label={`${ev.rangeKm} km of ${maxRange} km, the longest range on sale`} />
        </div>

        <dl className="mt-6 grid grid-cols-2 border-t border-line pt-4 text-[12.5px]">
          <div className="min-w-0 pr-4">
            <dt className="flex items-center gap-1.5 text-muted">
              <BatteryCharging aria-hidden className="size-3.5" /> Battery
            </dt>
            <dd className="mt-1 text-[15px] font-medium text-ink num">{ev.batteryKwh} kWh</dd>
          </div>
          <div className="min-w-0 border-l border-line pl-4">
            <dt className="flex items-center gap-1.5 text-muted">
              <PlugZap aria-hidden className="size-3.5" /> DC fast charge
            </dt>
            <dd className="mt-1 text-[15px] font-medium text-ink num">
              {dcTime}
              {dcWindow && <span className="ml-1 text-[11.5px] font-normal text-muted">({dcWindow}</span>}
            </dd>
          </div>
        </dl>

        <div className="mt-auto flex items-center justify-between pt-6">
          <CompareToggle slug={car.slug} label={title} />
          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink">
            EV details
            <ArrowRight aria-hidden className="size-3.5 text-red transition-transform duration-[250ms] group-hover/ev:translate-x-0.5" />
          </span>
        </div>
      </div>
    </article>
  );
}

/** Thin range bar that draws in once when scrolled into view. */
export function RangeBar({ share, label, tone = "dark" }: { share: number; label: string; tone?: "dark" | "light" }) {
  return (
    <div role="img" aria-label={label} className={`relative mt-4 h-[2px] w-full ${tone === "dark" ? "bg-line" : "bg-white/15"}`}>
      <motion.div
        className="absolute inset-y-0 left-0 w-full origin-left bg-red"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: share }}
        viewport={{ once: true, amount: 0.8 }}
        transition={{ duration: 1.1, ease: EASE }}
      />
      {/* quarter ticks, like an instrument scale */}
      {[0.25, 0.5, 0.75].map((t) => (
        <span key={t} aria-hidden className={`absolute -top-[3px] h-2 w-px ${tone === "dark" ? "bg-line" : "bg-white/20"}`} style={{ left: `${t * 100}%` }} />
      ))}
    </div>
  );
}
