"use client";

import { ArrowUpRight, LayoutGrid } from "lucide-react";
import type { Brand, CarLite } from "@/types";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RevealGroup, RevealItem } from "@/components/ui/reveal";
import { BrandMark } from "@/components/ui/brand-logo";
import { useCatalog } from "@/components/providers/catalog-provider";

function brandStats(brand: Brand, carsByBrand: (brand: string) => CarLite[]) {
  const models = carsByBrand(brand.slug);
  return {
    count: models.length,
    from: models.length ? Math.min(...models.map((c) => c.priceMin)) : 0,
    names: models.map((c) => c.name),
  };
}

/** Step one of /new-cars: choose a marque. */
export function BrandPicker({ onSelect, onShowAll }: { onSelect: (slug: string) => void; onShowAll: () => void }) {
  const { brands, cars, carsByBrand } = useCatalog();
  const groups: { title: string; note: string; list: Brand[] }[] = [
    { title: "Mainstream", note: "Everyday cars, SUVs and EVs", list: brands.filter((b) => !b.isLuxury) },
    { title: "Luxury & performance", note: "Premium marques", list: brands.filter((b) => b.isLuxury) },
  ];

  return (
    <section aria-label="Choose a brand" className="container-x pb-20 pt-10 md:pb-28 md:pt-14">
      {groups.map((group, gi) => (
        <div key={group.title} className={cn(gi > 0 && "mt-16 md:mt-20")}>
          <div className="flex items-baseline justify-between gap-6 border-b border-ink pb-4">
            <h2 className="type-h3">{group.title}</h2>
            <p className="text-[13px] text-muted">
              {group.note} · <span className="num">{group.list.length}</span> brands
            </p>
          </div>
          <RevealGroup className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4" gap={0.04}>
            {group.list.map((brand) => {
              const s = brandStats(brand, carsByBrand);
              return (
                <RevealItem key={brand.slug}>
                  <button
                    type="button"
                    onClick={() => onSelect(brand.slug)}
                    className="group/brand flex h-full w-full flex-col border border-line bg-white text-left transition-[border-color] duration-[400ms] ease-[var(--ease-premium)] hover:border-ink"
                  >
                    <span className="relative flex h-32 items-center justify-center bg-mist transition-[background-color] duration-[400ms] ease-[var(--ease-premium)] group-hover/brand:bg-white md:h-36">
                      <BrandMark
                        slug={brand.slug}
                        name={brand.name}
                        logoClassName="transition-transform duration-[600ms] ease-[var(--ease-premium)] group-hover/brand:scale-110"
                        className="bg-white transition-transform duration-[600ms] ease-[var(--ease-premium)] group-hover/brand:scale-110"
                      />
                      <span aria-hidden className="absolute left-3 top-3 text-[11px] font-medium text-muted num">
                        {s.count} {s.count === 1 ? "model" : "models"}
                      </span>
                      <ArrowUpRight
                        aria-hidden
                        className="absolute right-3 top-3 size-4 text-muted opacity-0 transition-[opacity,color] duration-[400ms] group-hover/brand:text-red group-hover/brand:opacity-100"
                      />
                    </span>
                    <span className="flex flex-1 flex-col p-4 md:p-5">
                      <span className="type-h4 block text-[15px] leading-snug md:text-lg">
                        {brand.name}
                        <span className="sr-only">
                          , {s.count} {s.count === 1 ? "model" : "models"},
                        </span>
                      </span>
                      <span className="mt-1 block text-[12.5px] text-muted">
                        from <span className="font-medium text-ink num">{formatPrice(s.from)}</span>
                      </span>
                      <span className="mt-1 hidden truncate text-[12px] text-muted md:block">{s.names.join(" · ")}</span>
                    </span>
                  </button>
                </RevealItem>
              );
            })}
          </RevealGroup>
        </div>
      ))}

      <div className="mt-16 flex flex-col items-start justify-between gap-5 bg-mist px-6 py-7 md:flex-row md:items-center md:px-10">
        <div>
          <p className="type-h4">Not sure which brand yet?</p>
          <p className="mt-1 text-[14px] text-muted">Browse every model side by side and filter by budget, body type or fuel.</p>
        </div>
        <button
          type="button"
          onClick={onShowAll}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[3px] bg-ink px-5 text-sm font-medium text-white transition-colors duration-[250ms] hover:bg-ink-3"
        >
          <LayoutGrid aria-hidden className="size-4" />
          Browse all {cars.length} models
        </button>
      </div>
    </section>
  );
}
