"use client";

import { cardPhotoAlt } from "@/lib/image-alt";
import { CarImage } from "@/components/vehicle/car-image";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import type { CarLite } from "@/types";
import { useCatalog } from "@/components/providers/catalog-provider";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

/** The "comparisons" content block, minus cars that aren't in the catalogue (deleted, unpublished or mistyped slugs). */
function usePopularComparisons(exclude?: string) {
  const { getCar, content } = useCatalog();
  return content.comparisons.items
    .map((p, i) => {
      const models = p.cars.map(getCar).filter((c): c is CarLite => c !== undefined);
      return { ...p, id: `${i}-${p.theme}`, models, cars: models.map((c) => c.slug) };
    })
    .filter((p) => p.models.length >= 2 && p.cars.join(",") !== exclude);
}

/** A bordered page section around the cards — renders nothing when no comparison has two published cars. */
export function PopularComparisonsSection({ heading, exclude }: { heading: ReactNode; exclude?: string }) {
  const items = usePopularComparisons(exclude);
  if (items.length === 0) return null;
  return (
    <section className="border-t border-line py-14 md:py-20">
      <div className="container-x">
        {heading}
        <PopularComparisons exclude={exclude} className="mt-12 md:mt-16" />
      </div>
    </section>
  );
}

/** Curated comparison starters. Each card links to /compare?cars=… so it is shareable. */
export function PopularComparisons({ exclude, className }: { exclude?: string; className?: string }) {
  const { brandName } = useCatalog();
  const items = usePopularComparisons(exclude);

  return (
    <ul className={cn("grid grid-cols-1 gap-5 md:grid-cols-2", className)}>
      {items.map((p) => {
        const low = Math.min(...p.models.map((c) => c.priceMin));
        const high = Math.max(...p.models.map((c) => c.priceMin));
        return (
          <li key={p.id}>
            <Link
              href={`/compare?cars=${p.cars.join(",")}`}
              className="group/pc flex h-full flex-col border border-line bg-white transition-[border-color] duration-[400ms] ease-[var(--ease-premium)] hover:border-ink/30"
            >
              <div className="relative flex gap-px bg-line">
                {p.models.map((c, i) => (
                  <Fragment key={c.slug}>
                    <div className="relative aspect-[4/3] flex-1 overflow-hidden bg-mist">
                      <CarImage
                        car={c}
                        alt={c.images[0] ? cardPhotoAlt(c.images[0], `${brandName(c.brand)} ${c.name}`) : ""}
                        sizes="(min-width: 768px) 16vw, 33vw"
                        className="object-cover transition-transform duration-[700ms] ease-[var(--ease-premium)] group-hover/pc:scale-[1.05]"
                        style={{ objectPosition: c.focus ?? "50% 55%" }}
                      />
                    </div>
                    {i < p.models.length - 1 && (
                      <span
                        aria-hidden
                        className="absolute top-1/2 z-10 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[11px] font-semibold uppercase tracking-[0.08em] text-ink"
                        style={{ left: `${((i + 1) / p.models.length) * 100}%` }}
                      >
                        vs
                      </span>
                    )}
                  </Fragment>
                ))}
              </div>
              <div className="flex flex-1 flex-col p-6 md:p-7">
                <p className="type-eyebrow text-muted">{p.theme}</p>
                <h3 className="type-h3 mt-3 text-balance">
                  {p.models.map((c, i) => (
                    <Fragment key={c.slug}>
                      {i > 0 && <span className="type-editorial font-normal text-muted"> vs </span>}
                      {c.name}
                    </Fragment>
                  ))}
                </h3>
                <p className="mt-3 text-[14px] leading-relaxed text-muted">{p.note}</p>
                <div className="mt-auto flex items-center justify-between gap-4 pt-6">
                  <span className="text-[12.5px] text-muted num">
                    From {formatPrice(low)}
                    {high !== low && ` – ${formatPrice(high)}`}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-medium">
                    Compare now
                    <ArrowRight aria-hidden className="size-3.5 text-red transition-transform duration-[250ms] group-hover/pc:translate-x-0.5" />
                  </span>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
