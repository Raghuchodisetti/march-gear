"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Cog, Fuel, Gauge, MapPin } from "lucide-react";
import type { UsedCar } from "@/types";
import { formatINR, formatKm, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { VerifiedBadge } from "@/components/ui/badge";
import { useCatalog } from "@/components/providers/catalog-provider";
import { WishlistButton } from "./toggles";
import { usedEmi, usedHref, usedTitle } from "./card-utils";

export function UsedCarCard({
  car,
  className,
  priority = false,
  sizes = "(min-width: 1280px) 25vw, (min-width: 768px) 40vw, 85vw",
}: {
  car: UsedCar;
  className?: string;
  /** Mark the first row of a listing so its photo isn't lazy-loaded */
  priority?: boolean;
  sizes?: string;
}) {
  const { brandName } = useCatalog();
  const title = usedTitle(car, brandName);
  return (
    <article
      className={cn(
        "group/card relative flex h-full flex-col border border-line bg-white transition-[border-color] duration-[400ms] ease-[var(--ease-premium)] hover:border-ink/25",
        className,
      )}
    >
      <div className="relative aspect-[3/2] overflow-hidden bg-mist">
        <Image
          src={car.images[0]}
          alt={title}
          fill
          sizes={sizes}
          preload={priority}
          className="object-cover transition-transform duration-[700ms] ease-[var(--ease-premium)] group-hover/card:scale-[1.04]"
          style={{ objectPosition: car.focus ?? "50% 55%" }}
        />
        <div className="absolute inset-x-3 top-3 flex items-start justify-between">
          {car.verified ? <VerifiedBadge /> : <span />}
          <WishlistButton kind="used" id={car.id} label={title} />
        </div>
        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 bg-ink/70 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
          <MapPin className="size-3" aria-hidden /> {car.city}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-[12px] text-muted num">
          {car.year} · {car.owners === 1 ? "1st owner" : `${car.owners} owners`}
        </p>
        <h3 className="type-h4 mt-1.5">
          <Link href={usedHref(car)} className="after:absolute after:inset-0 focus-visible:outline-none">
            {brandName(car.brand)} {car.name}
          </Link>
        </h3>
        <p className="mt-0.5 truncate text-[13px] text-muted">{car.variant}</p>

        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-ink/80">
          <li className="inline-flex items-center gap-1.5 num">
            <Gauge className="size-3.5 text-muted" aria-hidden /> {formatKm(car.km)}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Fuel className="size-3.5 text-muted" aria-hidden /> {car.fuel}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Cog className="size-3.5 text-muted" aria-hidden /> {car.transmission}
          </li>
        </ul>

        <div className="mt-auto pt-5">
          <div className="flex items-end justify-between border-t border-line pt-4">
            <div>
              <p className="text-lg font-semibold num">{formatPrice(car.price)}</p>
              <p className="text-[11.5px] text-muted num">EMI from {formatINR(usedEmi(car.price))}/mo</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium">
              View
              <ArrowRight aria-hidden className="size-3.5 text-red transition-transform duration-[250ms] group-hover/card:translate-x-0.5" />
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
