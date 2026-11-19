"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Cog, Fuel, Gauge, ShieldCheck, Users, Zap } from "lucide-react";
import type { CarModel } from "@/types";
import { isElectric } from "@/lib/catalog";
import { formatPriceRange } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { RatingInline } from "@/components/ui/rating";
import { useCatalog } from "@/components/providers/catalog-provider";
import { bestEfficiency, carHref, fuelSummary, transmissionSummary } from "@/components/vehicle/card-utils";
import { CompareToggle, WishlistButton } from "@/components/vehicle/toggles";

/**
 * List-view row: a horizontal, magazine-style entry with a spec strip and a
 * price column. On mobile it collapses to a dense thumbnail + text row.
 */
export function CarRow({ car }: { car: CarModel }) {
  const { brandName } = useCatalog();
  const brand = brandName(car.brand);
  const title = `${brand} ${car.name}`;
  const ev = isElectric(car);
  const tag = car.launchedOn ? "New" : car.trending ? "Trending" : undefined;
  const seats = car.seats.length > 1 ? `${car.seats[0]}–${car.seats[car.seats.length - 1]}` : String(car.seats[0]);

  return (
    <article className="group/row relative grid grid-cols-[116px_minmax(0,1fr)] gap-4 border-b border-line py-5 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-6 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)_auto] md:gap-8 md:py-8">
      <div className="relative aspect-[4/3] self-start overflow-hidden bg-mist">
        <Image
          src={car.images[0]}
          alt={title}
          fill
          sizes="(min-width: 768px) 300px, (min-width: 640px) 200px, 116px"
          className="object-cover transition-transform duration-[700ms] ease-[var(--ease-premium)] group-hover/row:scale-[1.04]"
          style={{ objectPosition: car.focus ?? "50% 55%" }}
        />
        {tag && (
          <div className="absolute left-2.5 top-2.5 hidden sm:block">
            <Badge tone={tag === "New" ? "red" : "glass"}>{tag}</Badge>
          </div>
        )}
      </div>

      <div className="min-w-0 self-center md:self-start">
        <p className="type-eyebrow flex items-center gap-2 text-muted">
          {brand}
          {ev && (
            <span className="inline-flex items-center gap-0.5 text-ink">
              <Zap aria-hidden className="size-3" /> EV
            </span>
          )}
        </p>
        <h3 className="type-h3 mt-2">
          <Link href={carHref(car)} className="after:absolute after:inset-0 focus-visible:outline-none">
            {car.name}
          </Link>
        </h3>
        <p className="mt-2 hidden max-w-lg text-[14px] text-muted md:block">{car.tagline}</p>
        <p className="mt-1.5 text-[14px] font-semibold num md:hidden">{formatPriceRange(car.priceMin, car.priceMax)}</p>

        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] md:mt-6">
          <RowSpec icon={<Fuel />} label="Fuel" value={fuelSummary(car)} />
          <RowSpec icon={<Cog />} label="Gearbox" value={transmissionSummary(car)} className="hidden sm:flex" />
          <RowSpec icon={ev ? <Zap /> : <Gauge />} label={ev ? "Range" : "Mileage"} value={bestEfficiency(car)} />
          <RowSpec icon={<Users />} label="Seats" value={seats} className="hidden md:flex" />
          <RowSpec
            icon={<ShieldCheck />}
            label="Safety"
            value={car.safetyRating > 0 ? `${car.safetyRating}★ ${car.safetyAgency.replace(" NCAP", "")}` : "Not rated"}
            className="hidden lg:flex"
          />
        </dl>

        <div className="mt-4 sm:mt-5 md:hidden">
          <CompareToggle slug={car.slug} label={title} />
        </div>
      </div>

      <div className="hidden min-w-[190px] flex-col items-end justify-between text-right md:flex">
        <div>
          <p className="type-h4 num">{formatPriceRange(car.priceMin, car.priceMax)}</p>
          <p className="mt-1 text-[11.5px] text-muted">Ex-showroom · indicative</p>
          <RatingInline value={car.rating} count={car.reviewCount} className="mt-3" />
        </div>
        <div className="flex items-center gap-4">
          <CompareToggle slug={car.slug} label={title} />
          <WishlistButton id={car.slug} label={title} tone="outline" />
        </div>
        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium">
          View details
          <ArrowRight aria-hidden className="size-3.5 text-red transition-transform duration-[250ms] group-hover/row:translate-x-0.5" />
        </span>
      </div>
    </article>
  );
}

function RowSpec({ icon, label, value, className }: { icon: React.ReactNode; label: string; value: string; className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${className ?? ""}`}>
      <dt className="flex items-center text-muted [&>svg]:size-3.5">
        {icon}
        <span className="sr-only">{label}</span>
      </dt>
      <dd className="font-medium text-ink num">{value}</dd>
    </div>
  );
}
