"use client";

import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, BadgeCheck, Car, CarFront, Cog, Droplet, Fuel, Gauge, Leaf, Mountain, SearchX, Users, Wind, Zap } from "lucide-react";
import Link from "next/link";
import { formatKm } from "@/lib/format";
import { EASE } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { RangeField, SelectField } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/page-header";
import { Eyebrow } from "@/components/ui/section-heading";
import { UsedCarCard } from "@/components/vehicle/used-car-card";
import { useCatalog } from "@/components/providers/catalog-provider";
import { BrandTiles, FilterBar, IconTiles, ValueTiles, summarise, type Facet } from "@/components/listing/filter-bar";
import {
  EMPTY_FILTERS,
  KM_MAX,
  KM_MIN,
  KM_STEP,
  OWNER_OPTIONS,
  USED_BUDGETS,
  USED_SORTS,
  activeChips,
  applyUsedFilters,
  facetCount,
  matches,
  parseUsedFilters,
  serializeUsedFilters,
  usedFacets,
  type ListKey,
  type UsedFacets,
  type UsedFilters,
  type UsedSort,
} from "./filters";

const yearOptionsFor = (facets: UsedFacets) =>
  Array.from({ length: facets.yearMax - facets.yearMin + 1 }, (_, i) => {
    const y = String(facets.yearMax - i);
    return { value: y, label: y };
  });

type Commit = (patch: Partial<UsedFilters>) => void;

/**
 * Used-car listing: URL-synced filters, a sticky sidebar on desktop and a
 * bottom-sheet filter drawer on mobile.
 */
export function UsedListing() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { usedCars, brandName } = useCatalog();
  const inventory = useMemo(() => usedFacets(usedCars, brandName), [usedCars, brandName]);
  const paramsKey = params.toString();
  const urlFilters = parseUsedFilters(params, inventory);

  // Optimistic copy so rapid taps build on each other while the URL catches up.
  const [optimistic, setOptimistic] = useState<{ base: string; next: UsedFilters } | null>(null);
  const filters = optimistic && optimistic.base === paramsKey ? optimistic.next : urlFilters;

  const [kmDraft, setKmDraft] = useState<number | null>(null);
  const kmTimer = useRef<number | undefined>(undefined);

  const commit: Commit = (patch) => {
    const next = { ...filters, ...patch };
    setOptimistic({ base: paramsKey, next });
    const qs = serializeUsedFilters(next);
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });
  useEffect(() => {
    const timer = kmTimer;
    return () => window.clearTimeout(timer.current);
  }, []);

  const onKm = (value: number) => {
    setKmDraft(value);
    window.clearTimeout(kmTimer.current);
    kmTimer.current = window.setTimeout(() => {
      commitRef.current({ km: value >= KM_MAX ? null : value });
      setKmDraft(null);
    }, 320);
  };

  const effective: UsedFilters = kmDraft === null ? filters : { ...filters, km: kmDraft >= KM_MAX ? null : kmDraft };
  const results = applyUsedFilters(usedCars, effective);
  const chips = activeChips(filters, brandName);
  const clearAll = () => commit({ ...EMPTY_FILTERS, sort: filters.sort });
  const count = results.length;
  const cityLabel = filters.city.length === 1 ? ` in ${filters.city[0]}` : "";

  const sort = {
    value: filters.sort,
    options: USED_SORTS.map((x) => ({ value: x.value, label: x.label })),
    onChange: (v: string) => commit({ sort: v as UsedSort }),
  };

  return (
    <UsedFilterBar
      filters={effective}
      inventory={inventory}
      commit={commit}
      kmValue={kmDraft ?? filters.km ?? KM_MAX}
      onKm={onKm}
      activeFilters={chips.map((chip) => ({ key: chip.id, label: chip.label, onRemove: () => commit(chip.patch) }))}
      onClearAll={clearAll}
      resultCount={count}
      noun={[`car${cityLabel}`, `cars${cityLabel}`]}
      sort={sort}
    >
      {count === 0 ? (
        <EmptyState
          icon={<SearchX className="size-6" aria-hidden />}
          title="No cars match these filters"
          description="Try widening the budget or kilometre range, or remove a filter or two. New verified cars are listed every day."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={clearAll}>Clear all filters</Button>
              <Button variant="outline" href="/sell-car">
                Sell your car instead
              </Button>
            </div>
          }
        />
      ) : (
        <ul className="relative grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 sm:gap-y-5 lg:grid-cols-3 3xl:grid-cols-4">
          <AnimatePresence mode="popLayout" initial={false}>
            {results.flatMap((car, i) => {
              const items = [
                <motion.li
                  key={car.id}
                  layout="position"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.2 } }}
                  transition={{ duration: 0.5, ease: EASE }}
                >
                  <UsedCarCard car={car} priority={i < 2} sizes="(min-width: 1440px) 24vw, (min-width: 1024px) 31vw, (min-width: 640px) 46vw, 100vw" />
                </motion.li>,
              ];
              if (i === 6 && count > 8) {
                items.push(
                  <motion.li key="valuation-promo" layout="position" transition={{ duration: 0.5, ease: EASE }}>
                    <ValuationPromo />
                  </motion.li>,
                );
              }
              return items;
            })}
          </AnimatePresence>
        </ul>
      )}
    </UsedFilterBar>
  );
}

/* ── Visual facets ────────────────────────────────────────────── */

const FUEL_ICON: Record<string, typeof Fuel> = { Petrol: Fuel, Diesel: Droplet, CNG: Wind, Hybrid: Leaf, Electric: Zap };
const BODY_ICON: Record<string, typeof Fuel> = { SUV: Mountain, Sedan: CarFront, Hatchback: Car, MUV: Users, Coupe: Gauge };

function UsedFilterBar({
  filters,
  inventory,
  commit,
  kmValue,
  onKm,
  ...bar
}: {
  filters: UsedFilters;
  /** Facets present in the inventory */
  inventory: UsedFacets;
  commit: Commit;
  kmValue: number;
  onKm: (value: number) => void;
} & Omit<ComponentProps<typeof FilterBar>, "facets">) {
  const { usedCars, brandName } = useCatalog();
  const yearOptions = yearOptionsFor(inventory);
  const toggle = (key: ListKey, value: string) => {
    const current = filters[key];
    commit({ [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value] });
  };
  const verifiedCount = usedCars.filter((c) => matches(c, { ...filters, verified: true })).length;
  const moreCount = (filters.yearFrom || filters.yearTo ? 1 : 0) + (filters.km ? 1 : 0) + (filters.owners ? 1 : 0);
  const budgetLabel = USED_BUDGETS.find((b) => b.slug === filters.budget)?.label;

  const facets: Facet[] = [
    {
      key: "verified",
      label: "Verified",
      activeCount: filters.verified ? 1 : 0,
      summary: filters.verified ? "Only" : undefined,
      onClear: () => commit({ verified: false }),
      content: (
        <IconTiles
          columns={3}
          options={[{ value: "verified", label: "Verified cars only", icon: BadgeCheck, hint: `200-point inspected · ${verifiedCount} available` }]}
          selected={filters.verified ? ["verified"] : []}
          onToggle={() => commit({ verified: !filters.verified })}
        />
      ),
    },
    {
      key: "city",
      label: "City",
      activeCount: filters.city.length,
      summary: summarise(filters.city),
      onClear: () => commit({ city: [] }),
      content: (
        <ValueTiles
          options={inventory.cities.map((city) => ({ value: city, label: city, count: facetCount(usedCars, filters, "city", city) }))}
          selected={filters.city}
          onToggle={(v) => toggle("city", v)}
        />
      ),
    },
    {
      key: "budget",
      label: "Budget",
      activeCount: filters.budget ? 1 : 0,
      summary: budgetLabel,
      onClear: () => commit({ budget: "" }),
      content: (
        <ValueTiles
          options={USED_BUDGETS.map((b) => ({ value: b.slug, label: b.label, count: usedCars.filter((c) => matches(c, { ...filters, budget: b.slug })).length }))}
          selected={filters.budget ? [filters.budget] : []}
          onToggle={(v) => commit({ budget: filters.budget === v ? "" : v })}
        />
      ),
    },
    {
      key: "body",
      label: "Body type",
      activeCount: filters.body.length,
      summary: summarise(filters.body),
      onClear: () => commit({ body: [] }),
      content: (
        <IconTiles
          options={inventory.bodies.map((b) => ({ value: b, label: b === "Coupe" ? "Coupé" : b, icon: BODY_ICON[b] ?? Car, count: facetCount(usedCars, filters, "body", b) }))}
          selected={filters.body}
          onToggle={(v) => toggle("body", v)}
        />
      ),
    },
    {
      key: "brand",
      label: "Brand",
      activeCount: filters.brand.length,
      summary: summarise(filters.brand.map(brandName)),
      onClear: () => commit({ brand: [] }),
      content: (
        <BrandTiles
          options={inventory.brands.map((b) => ({ value: b, label: brandName(b), count: facetCount(usedCars, filters, "brand", b) }))}
          selected={filters.brand}
          onToggle={(v) => toggle("brand", v)}
        />
      ),
    },
    {
      key: "fuel",
      label: "Fuel & gearbox",
      activeCount: filters.fuel.length + filters.transmission.length,
      summary: summarise([...filters.fuel, ...filters.transmission]),
      onClear: () => commit({ fuel: [], transmission: [] }),
      content: (
        <div className="space-y-6">
          <IconTiles
            options={inventory.fuels.map((f) => ({ value: f, label: f, icon: FUEL_ICON[f] ?? Fuel, count: facetCount(usedCars, filters, "fuel", f) }))}
            selected={filters.fuel}
            onToggle={(v) => toggle("fuel", v)}
          />
          <IconTiles
            options={inventory.transmissions.map((t) => ({
              value: t,
              label: t,
              icon: t === "Manual" ? Cog : Gauge,
              count: facetCount(usedCars, filters, "transmission", t),
            }))}
            selected={filters.transmission}
            onToggle={(v) => toggle("transmission", v)}
          />
        </div>
      ),
    },
    {
      key: "more",
      label: "Year & km",
      activeCount: moreCount,
      summary: moreCount ? `${moreCount} set` : undefined,
      onClear: () => commit({ yearFrom: null, yearTo: null, km: null, owners: null }),
      content: (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-10">
          <div>
            <p className="mb-3 text-[13px] font-medium">Model year</p>
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                aria-label="Model year from"
                placeholder="From any"
                value={filters.yearFrom ? String(filters.yearFrom) : ""}
                onChange={(e) => {
                  const v = e.target.value ? Number(e.target.value) : null;
                  commit({ yearFrom: v, yearTo: v && filters.yearTo && filters.yearTo < v ? null : filters.yearTo });
                }}
                options={yearOptions}
              />
              <SelectField
                aria-label="Model year to"
                placeholder="To any"
                value={filters.yearTo ? String(filters.yearTo) : ""}
                onChange={(e) => {
                  const v = e.target.value ? Number(e.target.value) : null;
                  commit({ yearTo: v, yearFrom: v && filters.yearFrom && filters.yearFrom > v ? null : filters.yearFrom });
                }}
                options={yearOptions}
              />
            </div>
          </div>
          <RangeField
            label="Kilometres driven up to"
            value={kmValue}
            min={KM_MIN}
            max={KM_MAX}
            step={KM_STEP}
            onChange={onKm}
            format={(v) => (v >= KM_MAX ? "Any" : formatKm(v))}
            minLabel={formatKm(KM_MIN)}
            maxLabel="Any"
          />
          <div>
            <p className="mb-3 text-[13px] font-medium">Ownership</p>
            <div className="flex flex-wrap gap-2">
              {OWNER_OPTIONS.map((o) => {
                const on = filters.owners === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => commit({ owners: on ? null : o.value })}
                    className={
                      on
                        ? "h-11 rounded-full border border-ink bg-ink px-5 text-[13.5px] font-medium text-white"
                        : "h-11 rounded-full border border-line bg-white px-5 text-[13.5px] font-medium text-ink transition-colors hover:border-ink/40"
                    }
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ),
    },
  ];

  return <FilterBar facets={facets} {...bar} />;
}

/* ── Inline promo tile ────────────────────────────────────────── */

function ValuationPromo() {
  return (
    <aside className="group/promo relative flex h-full min-h-[360px] flex-col justify-between bg-ink p-7 text-white">
      <Eyebrow tone="light">Selling too?</Eyebrow>
      <div>
        <p className="type-h3 text-balance">
          Know what your car is worth <span className="type-editorial">before</span> you buy the next one.
        </p>
        <p className="mt-4 text-[14px] leading-relaxed text-white/60">
          An indicative market value in under a minute, then a guaranteed offer after a free inspection.
        </p>
        <Link
          href="/tools/car-valuation"
          className="mt-7 inline-flex items-center gap-2 text-[14px] font-medium text-white after:absolute after:inset-0"
        >
          Get a free valuation
          <ArrowUpRight aria-hidden className="size-4 text-red transition-transform duration-[250ms] group-hover/promo:-translate-y-0.5 group-hover/promo:translate-x-0.5" />
        </Link>
      </div>
    </aside>
  );
}
