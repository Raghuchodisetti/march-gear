import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Cog, Fuel, Gauge, Zap } from "lucide-react";
import type { CarModel } from "@/types";
import { brandName } from "@/data/brands";
import { isElectric } from "@/data/cars";
import { formatPriceRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CompareToggle, WishlistButton } from "./toggles";

export function carHref(car: Pick<CarModel, "slug">) {
  return `/cars/${car.slug}`;
}

/** Short transmission summary: "MT / AT", "Automatic" or "Manual". */
export function transmissionSummary(car: CarModel) {
  const auto = car.transmissions.some((t) => t !== "Manual");
  const manual = car.transmissions.includes("Manual");
  if (auto && manual) return "MT / AT";
  return auto ? "Automatic" : "Manual";
}

/** Best claimed figure: "21.8 kmpl" or "489 km" for EVs. */
export function bestEfficiency(car: CarModel) {
  if (car.ev) return `${car.ev.rangeKm} km`;
  return car.efficiency.split("–").pop()!.trim();
}

export function fuelSummary(car: CarModel) {
  return car.fuelTypes.length > 2 ? `${car.fuelTypes[0]} + ${car.fuelTypes.length - 1}` : car.fuelTypes.join(" / ");
}

/**
 * The primary new-car card. The model name is a stretched link, so the whole
 * card is clickable while wishlist and compare remain independent controls.
 */
export function CarCard({
  car,
  className,
  priority = false,
  badge,
  sizes = "(min-width: 1280px) 25vw, (min-width: 768px) 40vw, 85vw",
}: {
  car: CarModel;
  className?: string;
  priority?: boolean;
  badge?: string;
  sizes?: string;
}) {
  const title = `${brandName(car.brand)} ${car.name}`;
  const ev = isElectric(car);
  const tag = badge ?? (car.launchedOn ? "New" : car.trending ? "Trending" : undefined);

  return (
    <article
      className={cn(
        "group/card relative flex h-full flex-col border border-line bg-white transition-[border-color] duration-[400ms] ease-[var(--ease-premium)] hover:border-ink/25",
        className,
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-mist">
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
          <div className="flex gap-1.5">
            {tag && <Badge tone={tag === "New" ? "red" : "glass"}>{tag}</Badge>}
            {ev && (
              <Badge tone="glass-dark">
                <Zap className="size-3" aria-hidden /> EV
              </Badge>
            )}
          </div>
          <WishlistButton id={car.slug} label={title} />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="type-eyebrow text-muted">{brandName(car.brand)}</p>
        <h3 className="type-h3 mt-2">
          <Link href={carHref(car)} className="after:absolute after:inset-0 focus-visible:outline-none">
            {car.name}
          </Link>
        </h3>
        <p className="mt-3 text-[15px] font-semibold num">{formatPriceRange(car.priceMin, car.priceMax)}</p>
        <p className="mt-0.5 text-[11.5px] text-muted">Ex-showroom · indicative</p>

        <dl className="mt-5 grid grid-cols-3 border-t border-line pt-4 text-[12.5px]">
          <SpecMini icon={<Fuel />} label="Fuel" value={fuelSummary(car)} />
          <SpecMini icon={<Cog />} label="Gearbox" value={transmissionSummary(car)} />
          <SpecMini icon={ev ? <Zap /> : <Gauge />} label={ev ? "Range" : "Mileage"} value={bestEfficiency(car)} />
        </dl>

        <div className="mt-auto flex items-center justify-between pt-5">
          <CompareToggle slug={car.slug} label={title} />
          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink">
            View details
            <ArrowRight aria-hidden className="size-3.5 text-red transition-transform duration-[250ms] group-hover/card:translate-x-0.5" />
          </span>
        </div>
      </div>
    </article>
  );
}

function SpecMini({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 border-l border-line pl-3 first:border-l-0 first:pl-0">
      <dt className="flex items-center gap-1 text-muted [&>svg]:size-3">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 truncate font-medium text-ink num" title={value}>
        {value}
      </dd>
    </div>
  );
}
