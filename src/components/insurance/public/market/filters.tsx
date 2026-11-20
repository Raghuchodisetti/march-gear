"use client";

import type { InsProductCategory } from "@/db/enums";
import { FILTER_ADDONS } from "@/insurance/covers";
import { INS_PRODUCT_CATEGORY_LABEL } from "@/insurance/labels";
import { formatPriceShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EMPTY_FILTERS, type MarketFilters, type MarketProduct } from "./engine";
import { CheckRow, DualRange, Switch } from "./ui";

/* The marketplace filter panel (quotes results and the compare picker). */

export interface FilterOptions {
  providers: { slug: string; name: string; count: number }[];
  categories: { value: InsProductCategory; label: string; count: number }[];
}

export function filterOptions(products: MarketProduct[]): FilterOptions {
  const providers = new Map<string, { slug: string; name: string; count: number }>();
  const categories = new Map<InsProductCategory, number>();
  for (const p of products) {
    const cur = providers.get(p.company.slug) ?? { slug: p.company.slug, name: p.company.name, count: 0 };
    cur.count += 1;
    providers.set(p.company.slug, cur);
    categories.set(p.category, (categories.get(p.category) ?? 0) + 1);
  }
  return {
    providers: [...providers.values()].sort((a, b) => a.name.localeCompare(b.name)),
    categories: [...categories.entries()].map(([value, count]) => ({ value, label: INS_PRODUCT_CATEGORY_LABEL[value], count })),
  };
}

export const activeFilterCount = (f: MarketFilters) => f.providers.length + f.categories.length + f.addOns.length + (f.premium ? 1 : 0) + (f.idv ? 1 : 0);

const toggle = <T,>(list: T[], v: T, on: boolean) => (on ? [...new Set([...list, v])] : list.filter((x) => x !== v));

/** Round a range outwards to a "nice" step. */
export function niceBounds(values: number[], step: number): [number, number] | null {
  if (!values.length) return null;
  const lo = Math.floor(Math.min(...values) / step) * step;
  const hi = Math.ceil(Math.max(...values) / step) * step;
  return [lo, Math.max(hi, lo + step)];
}

export function FilterPanel({
  value,
  onChange,
  options,
  premiumBounds,
  idvBounds,
  addOnHint = "Show plans that offer it, and add it to the estimate",
  className,
}: {
  value: MarketFilters;
  onChange: (next: MarketFilters) => void;
  options: FilterOptions;
  /** null when no car is chosen (premium and IDV need one). */
  premiumBounds: [number, number] | null;
  idvBounds: [number, number] | null;
  addOnHint?: string;
  className?: string;
}) {
  const set = (patch: Partial<MarketFilters>) => onChange({ ...value, ...patch });
  const count = activeFilterCount(value);
  return (
    <div className={cn("space-y-8", className)}>
      <section aria-labelledby="flt-addons">
        <div className="flex items-baseline justify-between">
          <h3 id="flt-addons" className="type-eyebrow text-ink">
            Add-ons
          </h3>
          {count > 0 && (
            <button type="button" onClick={() => onChange(EMPTY_FILTERS)} className="text-[12px] font-medium text-muted underline-offset-4 hover:text-red hover:underline">
              Reset all
            </button>
          )}
        </div>
        <p className="mt-2 text-[11.5px] leading-snug text-muted">{addOnHint}</p>
        <div className="mt-4 space-y-3.5">
          {FILTER_ADDONS.map((a) => (
            <Switch key={a.key} label={a.name} checked={value.addOns.includes(a.key)} onChange={(on) => set({ addOns: toggle(value.addOns, a.key, on) })} />
          ))}
        </div>
      </section>

      {options.categories.length > 0 && (
        <section aria-labelledby="flt-type">
          <h3 id="flt-type" className="type-eyebrow text-ink">
            Policy type
          </h3>
          <div className="mt-3">
            {options.categories.map((c) => (
              <CheckRow key={c.value} checked={value.categories.includes(c.value)} onChange={(on) => set({ categories: toggle(value.categories, c.value, on) })} count={c.count}>
                {c.label}
              </CheckRow>
            ))}
          </div>
        </section>
      )}

      {options.providers.length > 0 && (
        <section aria-labelledby="flt-provider">
          <h3 id="flt-provider" className="type-eyebrow text-ink">
            Insurer
          </h3>
          <div className="mt-3 max-h-64 overflow-y-auto pr-1">
            {options.providers.map((p) => (
              <CheckRow key={p.slug} checked={value.providers.includes(p.slug)} onChange={(on) => set({ providers: toggle(value.providers, p.slug, on) })} count={p.count}>
                {p.name}
              </CheckRow>
            ))}
          </div>
        </section>
      )}

      <section aria-label="Premium and IDV" className="space-y-7">
        {premiumBounds ? (
          <DualRange
            label="Indicative premium"
            min={premiumBounds[0]}
            max={premiumBounds[1]}
            step={500}
            value={value.premium}
            onChange={(premium) => set({ premium })}
            format={(n) => formatPriceShort(n)}
          />
        ) : (
          <p className="text-[12px] leading-relaxed text-muted">Add your car to filter by premium and IDV.</p>
        )}
        {idvBounds && (
          <DualRange label="IDV" min={idvBounds[0]} max={idvBounds[1]} step={10000} value={value.idv} onChange={(idv) => set({ idv })} format={(n) => formatPriceShort(n)} />
        )}
      </section>
    </div>
  );
}
