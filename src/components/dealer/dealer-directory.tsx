"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Clock, List, Map as MapIcon, MapPin, Navigation, Search, SearchX } from "lucide-react";
import type { Dealer } from "@/types";
import { dealers } from "@/data/dealers";
import { brandName } from "@/data/brands";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Segmented, SelectField, TextField } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/page-header";
import { RatingInline } from "@/components/ui/rating";
import { useUI } from "@/components/providers/app-provider";
import { ClearAllButton } from "@/components/used/filter-ui";
import { DealerMap } from "./dealer-map";
import { dealerBrandLabel } from "./dealer-utils";

const DEALER_CITIES = Array.from(new Set(dealers.map((d) => d.city))).sort();
const DEALER_BRANDS = Array.from(new Set(dealers.map((d) => d.brand))).sort((a, b) =>
  a === "multi-brand" ? 1 : b === "multi-brand" ? -1 : brandName(a).localeCompare(brandName(b)),
);
const SORTS = [
  { value: "nearest", label: "Nearest first" },
  { value: "rating", label: "Highest rated" },
] as const;
type DealerSort = (typeof SORTS)[number]["value"];

interface DealerFilters {
  city: string;
  brand: string[];
  sort: DealerSort;
}

function parse(params: { get(name: string): string | null }): DealerFilters {
  const city = params.get("city") ?? "";
  return {
    city: DEALER_CITIES.find((c) => c.toLowerCase() === city.toLowerCase()) ?? "",
    brand: (params.get("brand") ?? "")
      .split(",")
      .map((b) => b.trim().toLowerCase())
      .filter((b) => DEALER_BRANDS.includes(b)),
    sort: params.get("sort") === "rating" ? "rating" : "nearest",
  };
}

function serialize(f: DealerFilters) {
  const p = new URLSearchParams();
  if (f.city) p.set("city", f.city);
  if (f.brand.length) p.set("brand", f.brand.join(","));
  if (f.sort !== "nearest") p.set("sort", f.sort);
  return p.toString();
}

/** Searchable dealer directory with a schematic map. Filters sync to the URL. */
export function DealerDirectory() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const paramsKey = params.toString();
  const [optimistic, setOptimistic] = useState<{ base: string; next: DealerFilters } | null>(null);
  const filters = optimistic && optimistic.base === paramsKey ? optimistic.next : parse(params);

  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map">("list");

  const commit = (patch: Partial<DealerFilters>) => {
    const next = { ...filters, ...patch };
    setOptimistic({ base: paramsKey, next });
    const qs = serialize(next);
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const q = query.trim().toLowerCase();
  const results = dealers
    .filter((d) => !filters.city || d.city === filters.city)
    .filter((d) => filters.brand.length === 0 || filters.brand.includes(d.brand))
    .filter((d) => !q || [d.name, d.area, d.address, d.city, brandName(d.brand)].some((s) => s.toLowerCase().includes(q)))
    .sort((a, b) => (filters.sort === "rating" ? b.rating - a.rating || b.reviewCount - a.reviewCount : a.distanceKm - b.distanceKm));

  const hasFilters = Boolean(filters.city || filters.brand.length || q);
  const clearAll = () => {
    setQuery("");
    commit({ city: "", brand: [] });
  };
  const toggleBrand = (b: string) =>
    commit({ brand: filters.brand.includes(b) ? filters.brand.filter((x) => x !== b) : [...filters.brand, b] });

  return (
    <div className="container-x pb-20 md:pb-28">
      {/* Search bar */}
      <div className="grid grid-cols-1 gap-3 border-b border-line pb-6 md:grid-cols-[220px_minmax(0,1fr)_200px]">
        <SelectField
          aria-label="City"
          value={filters.city}
          onChange={(e) => commit({ city: e.target.value })}
          placeholder="All cities"
          options={DEALER_CITIES.map((c) => ({ value: c, label: c }))}
        />
        {/* TextField's `prefix` is typed as the native string attribute, so the icon is overlaid here;
            a blank prefix still gives the input its left padding. */}
        <div className="relative">
          <TextField
            type="search"
            aria-label="Search dealers"
            placeholder="Search by dealer, area or address"
            prefix=" "
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
        </div>
        <SelectField
          aria-label="Sort dealers"
          value={filters.sort}
          onChange={(e) => commit({ sort: e.target.value as DealerSort })}
          options={SORTS.map((s) => ({ value: s.value, label: s.label }))}
        />
      </div>

      {/* Brand chips */}
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 py-5 md:-mx-0 md:flex-wrap md:px-0" role="group" aria-label="Filter by brand">
        <Chip selected={filters.brand.length === 0} onClick={() => commit({ brand: [] })}>
          All brands
        </Chip>
        {DEALER_BRANDS.map((b) => (
          <Chip key={b} selected={filters.brand.includes(b)} onClick={() => toggleBrand(b)} showCheck>
            {brandName(b)}
          </Chip>
        ))}
      </div>

      {/* Count + view toggle */}
      <div className="flex items-center justify-between gap-4 border-t border-line pt-6">
        <h2 className="flex min-w-0 items-baseline gap-2.5" aria-live="polite">
          <span className="type-h2 num">{results.length}</span>
          <span className="truncate text-[15px] text-muted">
            {results.length === 1 ? "showroom" : "showrooms"}
            {filters.city ? ` in ${filters.city}` : " across India"}
          </span>
        </h2>
        <div className="flex shrink-0 items-center gap-4">
          {hasFilters && <ClearAllButton onClick={clearAll} className="hidden sm:inline" />}
          <Segmented
            ariaLabel="View"
            className="lg:hidden"
            value={view}
            onChange={setView}
            options={[
              {
                value: "list",
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <List className="size-3.5" aria-hidden /> List
                  </span>
                ),
              },
              {
                value: "map",
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <MapIcon className="size-3.5" aria-hidden /> Map
                  </span>
                ),
              },
            ]}
          />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] xl:grid-cols-[minmax(0,1fr)_minmax(0,500px)] xl:gap-12">
        <div className={cn("min-w-0", view === "map" && "max-lg:hidden")}>
          {results.length === 0 ? (
            <EmptyState
              icon={<SearchX className="size-6" aria-hidden />}
              title="No showrooms match"
              description="Try another city, clear the brand filter or search for a different area."
              action={<Button onClick={clearAll}>Clear filters</Button>}
            />
          ) : (
            <ol className="space-y-5">
              {results.map((d, i) => (
                <DealerCard key={d.id} dealer={d} index={i} active={activeId === d.id} onActive={setActiveId} />
              ))}
            </ol>
          )}
        </div>

        <div className={cn("min-w-0", view === "list" && "max-lg:hidden")}>
          <div className="lg:sticky lg:top-[96px]">
            <DealerMap
              dealers={results}
              activeId={activeId}
              onActive={setActiveId}
              locationLabel={filters.city ? `You · ${filters.city}` : "You"}
            />
            {/* Compact legend — the list on mobile map view, a key on desktop */}
            <ol className="mt-4 divide-y divide-line border-y border-line lg:hidden">
              {results.map((d, i) => (
                <li key={d.id}>
                  <Link href={`/dealers/${d.id}`} className="flex items-center gap-3 py-3.5 text-[14px]">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-white num">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{d.name}</span>
                    <span className="shrink-0 text-[12.5px] text-muted num">{d.distanceKm} km</span>
                  </Link>
                </li>
              ))}
            </ol>
            <p className="mt-4 hidden text-[12.5px] leading-relaxed text-muted lg:block">
              Hover a showroom to find it on the map. Distances are approximate, from the centre of your selected area.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DealerCard({
  dealer,
  index,
  active,
  onActive,
}: {
  dealer: Dealer;
  index: number;
  active: boolean;
  onActive: (id: string | null) => void;
}) {
  const { openEnquiry } = useUI();
  const href = `/dealers/${dealer.id}`;
  return (
    <li>
      <article
        onMouseEnter={() => onActive(dealer.id)}
        onMouseLeave={() => onActive(null)}
        onFocusCapture={() => onActive(dealer.id)}
        onBlurCapture={() => onActive(null)}
        className={cn(
          "group/card grid grid-cols-1 border bg-white transition-[border-color] duration-[400ms] ease-[var(--ease-premium)] sm:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)]",
          active ? "border-ink" : "border-line hover:border-ink/25",
        )}
      >
        <div className="relative aspect-[16/10] overflow-hidden bg-mist sm:aspect-auto sm:min-h-[232px]">
          <Image
            src={dealer.image}
            alt={`${dealer.name} showroom, ${dealer.area}`}
            fill
            sizes="(min-width: 1280px) 250px, (min-width: 640px) 220px, 100vw"
            className="object-cover transition-transform duration-[700ms] ease-[var(--ease-premium)] group-hover/card:scale-[1.04]"
          />
          <span
            aria-hidden
            className={cn(
              "absolute left-3 top-3 flex size-7 items-center justify-center rounded-full text-[11.5px] font-semibold text-white ring-2 ring-white transition-colors duration-[250ms] num",
              active ? "bg-red" : "bg-ink",
            )}
          >
            {index + 1}
          </span>
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 bg-ink/70 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm num">
            <Navigation className="size-3" aria-hidden /> {dealer.distanceKm} km away
          </span>
        </div>

        <div className="flex min-w-0 flex-col p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="type-eyebrow text-muted">{dealerBrandLabel(dealer)}</p>
            <RatingInline value={dealer.rating} count={dealer.reviewCount} />
          </div>
          <h3 className="type-h3 mt-3">
            <Link href={href} className="transition-colors duration-[250ms] hover:text-red">
              {dealer.name}
            </Link>
          </h3>
          <p className="mt-2 flex items-start gap-1.5 text-[13.5px] text-ink/80">
            <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden />
            {dealer.area}, {dealer.city}
          </p>
          <p className="mt-1 flex items-start gap-1.5 text-[13px] text-muted">
            <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {dealer.hours}
          </p>
          <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Services">
            {dealer.services.slice(0, 3).map((s) => (
              <li key={s} className="bg-mist px-2.5 py-1 text-[11.5px] font-medium text-ink/80">
                {s}
              </li>
            ))}
          </ul>
          <div className="mt-auto flex flex-wrap gap-2 pt-6">
            <Button
              size="sm"
              variant="dark"
              onClick={() => openEnquiry({ kind: "contact-dealer", subject: dealer.name, detail: `${dealer.area}, ${dealer.city}` })}
            >
              Contact dealer
            </Button>
            <Button size="sm" variant="outline" href={href} arrow>
              View showroom
            </Button>
          </div>
        </div>
      </article>
    </li>
  );
}
