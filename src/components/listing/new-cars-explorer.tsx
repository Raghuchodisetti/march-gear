"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Cog, Droplet, Fuel, Gauge, LayoutGrid, Leaf, List, RotateCcw, Search, Users, Wind, X, Zap } from "lucide-react";
import type { CarModel, CategorySlug, FuelType } from "@/types";
import { BUDGETS, carCategories, cars, inBudget } from "@/data/cars";
import { brandName, brands, getBrand } from "@/data/brands";
import { categories } from "@/data/categories";
import { EASE } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/page-header";
import { TextLink } from "@/components/ui/section-heading";
import { CarCard } from "@/components/vehicle/car-card";
import { CarRow } from "./car-row";
import { type ActiveFilter } from "./filter-ui";
import { BrandTiles, FilterBar, IconTiles, ImageTiles, ValueTiles, summarise, type Facet } from "./filter-bar";
import { ListingHeader } from "./listing-header";
import { BrandPicker, BrandRail } from "./brand-picker";
import { readList, toggleValue, useQueryState, writeList } from "./use-query-state";

/* ── Filter model ────────────────────────────────────────────── */

const BODY_SLUGS = ["suv", "sedan", "hatchback", "muv", "luxury", "electric"] as const;
const FUEL_SLUGS = ["petrol", "diesel", "cng", "hybrid", "electric"] as const;
const TRANSMISSION_SLUGS = ["manual", "automatic"] as const;
const BUDGET_SLUGS = BUDGETS.map((b) => b.slug);
const BRAND_SLUGS = brands.map((b) => b.slug);

const FUEL_MAP: Record<(typeof FUEL_SLUGS)[number], FuelType> = {
  petrol: "Petrol",
  diesel: "Diesel",
  cng: "CNG",
  hybrid: "Hybrid",
  electric: "Electric",
};

const FUEL_ICON = { petrol: Fuel, diesel: Droplet, cng: Wind, hybrid: Leaf, electric: Zap } as const;

const SORTS = [
  { value: "popular", label: "Popularity" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "latest", label: "Latest launches" },
  { value: "efficiency", label: "Mileage / range" },
];

interface Filters {
  q: string;
  body: string[];
  budget: string[];
  fuel: string[];
  transmission: string[];
  brand: string[];
  seats: boolean;
  sort: string;
}

type FacetKey = "body" | "budget" | "fuel" | "transmission" | "brand" | "seats";

/** Any of these in the URL means the visitor wants results, not the brand chooser. */
const LISTING_PARAMS = ["q", "body", "budget", "fuel", "transmission", "brand", "seats", "sort", "show"];
const FILTER_PARAMS = ["q", "body", "budget", "fuel", "transmission", "brand", "seats"];

const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

function readFilters(params: URLSearchParams): Filters {
  const sort = params.get("sort") ?? "popular";
  return {
    q: (params.get("q") ?? "").trim(),
    body: readList(params, "body", BODY_SLUGS),
    budget: readList(params, "budget", BUDGET_SLUGS),
    fuel: readList(params, "fuel", FUEL_SLUGS),
    transmission: readList(params, "transmission", TRANSMISSION_SLUGS),
    brand: readList(params, "brand", BRAND_SLUGS),
    seats: Number(params.get("seats")) >= 7,
    sort: SORTS.some((s) => s.value === sort) ? sort : "popular",
  };
}

function matches(car: CarModel, f: Filters, skip?: FacetKey) {
  if (f.q) {
    const hay = `${brandName(car.brand)} ${car.name} ${car.bodyType} ${car.fuelTypes.join(" ")}`.toLowerCase();
    if (!f.q.toLowerCase().split(/\s+/).every((t) => hay.includes(t))) return false;
  }
  if (skip !== "body" && f.body.length && !carCategories(car).some((c) => f.body.includes(c))) return false;
  if (skip !== "budget" && f.budget.length && !f.budget.some((b) => inBudget(car, b))) return false;
  if (skip !== "fuel" && f.fuel.length && !f.fuel.some((x) => car.fuelTypes.includes(FUEL_MAP[x as keyof typeof FUEL_MAP]))) return false;
  if (skip !== "transmission" && f.transmission.length) {
    const manual = car.transmissions.includes("Manual");
    const auto = car.transmissions.some((t) => t !== "Manual");
    if (!f.transmission.some((t) => (t === "manual" ? manual : auto))) return false;
  }
  if (skip !== "brand" && f.brand.length && !f.brand.includes(car.brand)) return false;
  if (skip !== "seats" && f.seats && Math.max(...car.seats) < 7) return false;
  return true;
}

function sortCars(list: CarModel[], sort: string) {
  const out = [...list];
  switch (sort) {
    case "price-asc":
      return out.sort((a, b) => a.priceMin - b.priceMin);
    case "price-desc":
      return out.sort((a, b) => b.priceMin - a.priceMin);
    case "latest":
      return out.sort((a, b) => (b.launchedOn ?? "").localeCompare(a.launchedOn ?? "") || b.rating - a.rating);
    case "efficiency":
      return out.sort((a, b) => b.efficiencyValue - a.efficiencyValue);
    default:
      return out.sort((a, b) => Number(Boolean(b.trending)) - Number(Boolean(a.trending)) || b.rating - a.rating);
  }
}

/* ── Adaptive title ──────────────────────────────────────────── */

const BODY_NOUN: Record<CategorySlug, string> = {
  suv: "SUVs",
  sedan: "sedans",
  hatchback: "hatchbacks",
  muv: "MUVs",
  luxury: "luxury cars",
  electric: "electric cars",
};

const FUEL_WORD: Record<string, string> = { petrol: "petrol", diesel: "diesel", cng: "CNG", hybrid: "hybrid", electric: "electric" };

const BUDGET_PHRASE: Record<string, string> = {
  "under-8": "under ₹8 Lakh",
  "8-15": "between ₹8 and 15 Lakh",
  "15-25": "between ₹15 and 25 Lakh",
  "25-50": "between ₹25 and 50 Lakh",
  "50-1cr": "between ₹50 Lakh and 1 Crore",
  "above-1cr": "above ₹1 Crore",
};

function buildTitle(f: Filters) {
  const words: string[] = [];
  if (f.brand.length === 1) words.push(brandName(f.brand[0]));
  if (f.seats) words.push("7-seater");
  if (f.transmission.length === 1) words.push(f.transmission[0]);
  const body = f.body as CategorySlug[];
  const evBody = body.length === 1 && body[0] === "electric";
  if (f.fuel.length === 1 && !(evBody && f.fuel[0] === "electric")) words.push(FUEL_WORD[f.fuel[0]]);
  if (body.length === 1) words.push(BODY_NOUN[body[0]]);
  else if (body.length === 2) words.push(`${BODY_NOUN[body[0]]} & ${BODY_NOUN[body[1]]}`);
  else words.push("cars");
  if (f.budget.length === 1) words.push(BUDGET_PHRASE[f.budget[0]]);

  let title = words.join(" ");
  if (f.q) title = title === "cars" ? `Results for “${f.q}”` : `${title} matching “${f.q}”`;
  else if (title === "cars") title = "All new cars";
  return title.charAt(0).toUpperCase() + title.slice(1);
}

/* ── Component ───────────────────────────────────────────────── */

export function NewCarsExplorer() {
  const { params, update } = useQueryState();
  const f = useMemo(() => readFilters(params), [params]);
  const [view, setView] = useState<"grid" | "list">("grid");

  const results = useMemo(() => sortCars(cars.filter((c) => matches(c, f)), f.sort), [f]);
  const count = (skip: FacetKey, test: (c: CarModel) => boolean) => cars.filter((c) => matches(c, f, skip) && test(c)).length;

  const setList = (key: string, list: string[]) => update((p) => writeList(p, key, list));
  const toggle = (key: "body" | "budget" | "fuel" | "transmission" | "brand", value: string) => setList(key, toggleValue(f[key], value));
  const clearAll = () =>
    update((p) => {
      FILTER_PARAMS.forEach((k) => p.delete(k));
      p.set("show", "all");
    });

  /* Brand-first browsing */
  const picking = !LISTING_PARAMS.some((k) => params.has(k));
  const chooseBrand = (slug: string) => {
    update((p) => {
      p.delete("show");
      p.set("brand", slug);
    });
    scrollToTop();
  };
  const backToBrands = () => {
    update((p) => LISTING_PARAMS.forEach((k) => p.delete(k)));
    scrollToTop();
  };
  const showAll = () => {
    update((p) => p.set("show", "all"));
    scrollToTop();
  };
  const singleBrand = f.brand.length === 1 ? getBrand(f.brand[0]) : undefined;

  /* Facets */
  const bodyOptions = categories.map((c) => ({ value: c.slug, label: c.plural, count: count("body", (car) => carCategories(car).includes(c.slug)) }));
  const budgetOptions = BUDGETS.map((b) => ({ value: b.slug, label: b.label, count: count("budget", (car) => inBudget(car, b.slug)) }));
  const fuelOptions = FUEL_SLUGS.map((x) => ({ value: x, label: FUEL_MAP[x], count: count("fuel", (car) => car.fuelTypes.includes(FUEL_MAP[x])) }));
  const transmissionOptions = [
    { value: "manual", label: "Manual", count: count("transmission", (car) => car.transmissions.includes("Manual")) },
    { value: "automatic", label: "Automatic", count: count("transmission", (car) => car.transmissions.some((t) => t !== "Manual")) },
  ];
  const brandOptions = brands
    .map((b) => ({ value: b.slug, label: b.name, count: count("brand", (car) => car.brand === b.slug) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const sevenSeatCount = count("seats", (car) => Math.max(...car.seats) >= 7);

  /* Applied chips */
  const active: ActiveFilter[] = [
    ...(f.q ? [{ key: "q", label: `“${f.q}”`, onRemove: () => update((p) => p.delete("q")) }] : []),
    ...f.body.map((v) => ({ key: `body-${v}`, label: bodyOptions.find((o) => o.value === v)?.label ?? v, onRemove: () => toggle("body", v) })),
    ...f.budget.map((v) => ({ key: `budget-${v}`, label: BUDGETS.find((b) => b.slug === v)?.label ?? v, onRemove: () => toggle("budget", v) })),
    ...f.fuel.map((v) => ({ key: `fuel-${v}`, label: FUEL_MAP[v as keyof typeof FUEL_MAP], onRemove: () => toggle("fuel", v) })),
    ...f.transmission.map((v) => ({ key: `tr-${v}`, label: v === "manual" ? "Manual" : "Automatic", onRemove: () => toggle("transmission", v) })),
    ...f.brand.map((v) => ({ key: `brand-${v}`, label: brandName(v), onRemove: () => toggle("brand", v) })),
    ...(f.seats ? [{ key: "seats", label: "7+ seats", onRemove: () => update((p) => p.delete("seats")) }] : []),
  ];

  const labelsFor = (opts: { value: string; label: string }[], sel: string[]) => opts.filter((o) => sel.includes(o.value)).map((o) => o.label);
  const clearKey = (key: string) => () => update((p) => p.delete(key));

  const facets: Facet[] = [
    {
      key: "budget",
      label: "Budget",
      activeCount: f.budget.length,
      summary: summarise(labelsFor(budgetOptions, f.budget)),
      onClear: clearKey("budget"),
      content: <ValueTiles options={budgetOptions} selected={f.budget} onToggle={(v) => toggle("budget", v)} />,
    },
    {
      key: "body",
      label: "Body type",
      activeCount: f.body.length,
      summary: summarise(labelsFor(bodyOptions, f.body)),
      onClear: clearKey("body"),
      content: (
        <ImageTiles
          options={bodyOptions.map((o) => {
            const cat = categories.find((c) => c.slug === o.value);
            return { ...o, image: cat?.image, imageFocus: cat?.focus };
          })}
          selected={f.body}
          onToggle={(v) => toggle("body", v)}
        />
      ),
    },
    {
      key: "fuel",
      label: "Fuel",
      activeCount: f.fuel.length,
      summary: summarise(labelsFor(fuelOptions, f.fuel)),
      onClear: clearKey("fuel"),
      content: (
        <IconTiles options={fuelOptions.map((o) => ({ ...o, icon: FUEL_ICON[o.value as keyof typeof FUEL_ICON] }))} selected={f.fuel} onToggle={(v) => toggle("fuel", v)} />
      ),
    },
    {
      key: "transmission",
      label: "Gearbox",
      activeCount: f.transmission.length + (f.seats ? 1 : 0),
      summary: summarise([...labelsFor(transmissionOptions, f.transmission), ...(f.seats ? ["7+ seats"] : [])]),
      onClear: () => update((p) => {
        p.delete("transmission");
        p.delete("seats");
      }),
      content: (
        <IconTiles
          columns={3}
          options={[
            { ...transmissionOptions[0], icon: Cog, hint: `${transmissionOptions[0].count} available · clutch & stick` },
            { ...transmissionOptions[1], icon: Gauge, hint: `${transmissionOptions[1].count} available · AT, CVT, DCT, AMT` },
            { value: "seats7", label: "7 or more seats", count: sevenSeatCount, icon: Users },
          ]}
          selected={[...f.transmission, ...(f.seats ? ["seats7"] : [])]}
          onToggle={(v) => (v === "seats7" ? update((p) => (f.seats ? p.delete("seats") : p.set("seats", "7"))) : toggle("transmission", v))}
        />
      ),
    },
    {
      key: "brand",
      label: "Brand",
      activeCount: f.brand.length,
      summary: summarise(labelsFor(brandOptions, f.brand)),
      onClear: clearKey("brand"),
      content: <BrandTiles options={brandOptions} selected={f.brand} onToggle={(v) => toggle("brand", v)} />,
    },
  ];


  if (picking) {
    return (
      <>
        <ListingHeader
          crumbs={[{ label: "New cars" }]}
          eyebrow="New cars"
          title="Choose a brand"
          description={`Start with the marque you have in mind — we'll show every model it sells in India. ${brands.length} brands, ${cars.length} models.`}
          aside={
            <div className="hidden flex-col items-end gap-3 lg:flex">
              <TextLink href="/compare">Compare side by side</TextLink>
              <TextLink href="/upcoming-cars">Upcoming launches</TextLink>
            </div>
          }
        >
        </ListingHeader>
        <BrandPicker onSelect={chooseBrand} onShowAll={showAll} />
      </>
    );
  }

  return (
    <>
      <ListingHeader
        crumbs={singleBrand ? [{ label: "New cars", href: "/new-cars" }, { label: singleBrand.name }] : [{ label: "New cars" }]}
        eyebrow={singleBrand ? `${singleBrand.name} · ${singleBrand.country}` : "New cars"}
        title={buildTitle(f)}
        description={
          singleBrand?.description ??
          "Every model on sale in India, with indicative ex-showroom prices, claimed efficiency and safety ratings in one place."
        }
        aside={
          <div className="hidden flex-col items-end gap-3 lg:flex">
            {singleBrand ? (
              <TextLink href={`/brands/${singleBrand.slug}`}>About {singleBrand.name}</TextLink>
            ) : (
              <TextLink href="/compare">Compare side by side</TextLink>
            )}
            <TextLink href="/upcoming-cars">Upcoming launches</TextLink>
          </div>
        }
      >
        {f.brand.length > 0 && <BrandRail selected={f.brand} onSelect={chooseBrand} onAllBrands={backToBrands} />}
      </ListingHeader>

      <FilterBar
        facets={facets}
        activeFilters={active}
        onClearAll={clearAll}
        resultCount={results.length}
        sort={{ value: f.sort, options: SORTS, onChange: (v) => update((p) => (v === "popular" ? p.delete("sort") : p.set("sort", v))) }}
        toolbar={
          <div className="flex items-center gap-3">
          <div className="hidden w-56 xl:block">
            <SearchBox value={f.q} onCommit={(q) => update((p) => (q ? p.set("q", q) : p.delete("q")))} />
          </div>
          <Segmented
            ariaLabel="Result layout"
            value={view}
            onChange={setView}
            options={[
              {
                value: "grid",
                label: (
                  <span className="flex items-center gap-1.5">
                    <LayoutGrid aria-hidden className="size-4" />
                    <span className="sr-only md:not-sr-only">Grid</span>
                  </span>
                ),
              },
              {
                value: "list",
                label: (
                  <span className="flex items-center gap-1.5">
                    <List aria-hidden className="size-4" />
                    <span className="sr-only md:not-sr-only">List</span>
                  </span>
                ),
              },
            ]}
          />
          </div>
        }
      >
        {results.length === 0 ? (
          <EmptyState
            icon={<Search className="size-6" aria-hidden />}
            title="Nothing matches that combination"
            description="Try widening your budget or removing a filter. Every model on sale is a single tap away."
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <Button variant="dark" onClick={clearAll} icon={<RotateCcw aria-hidden className="size-4" />}>
                  Reset all filters
                </Button>
                <Button variant="outline" href="/upcoming-cars">
                  See upcoming cars
                </Button>
              </div>
            }
          />
        ) : view === "grid" ? (
          <div className="relative grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-4">
            <AnimatePresence mode="popLayout" initial={false}>
              {results.flatMap((car, i) => {
                const card = (
                  <motion.div key={car.slug} layout {...itemMotion}>
                    <CarCard car={car} priority={i < 2} />
                  </motion.div>
                );
                return i === 11 && results.length > 12
                  ? [
                      card,
                      <motion.div key="interstitial" layout {...itemMotion} className="col-span-full">
                        <Interstitial />
                      </motion.div>,
                    ]
                  : [card];
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div className="relative border-t border-line md:border-t-0">
            <AnimatePresence mode="popLayout" initial={false}>
              {results.map((car) => (
                <motion.div key={car.slug} layout {...itemMotion}>
                  <CarRow car={car} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </FilterBar>
    </>
  );
}

const itemMotion = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.2 } },
  transition: { duration: 0.4, ease: EASE },
} as const;

/** A quiet editorial break inside long result grids. */
function Interstitial() {
  return (
    <div className="col-span-full grid grid-cols-1 gap-6 bg-ink px-6 py-8 text-white sm:px-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-10 md:px-10 md:py-10">
      <div>
        <p className="type-eyebrow text-white/50">Shortlisted a few?</p>
        <p className="type-h3 mt-3 max-w-xl text-balance">
          Put up to four cars side by side — <span className="type-editorial text-white/80">every spec, every rupee.</span>
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button variant="light" href="/compare" arrow>
          Open compare
        </Button>
        <Button variant="outline-light" href="/tools/emi-calculator">
          EMI calculator
        </Button>
      </div>
    </div>
  );
}

/** Search input that commits to the URL after a short pause. */
function SearchBox({ value, onCommit }: { value: string; onCommit: (q: string) => void }) {
  const [text, setText] = useState(value);
  const [synced, setSynced] = useState(value);

  // Follow external changes (Clear all, chip removal, menu links).
  if (value !== synced) {
    setSynced(value);
    setText(value);
  }

  useEffect(() => {
    const next = text.trim();
    if (next === value) return;
    const id = window.setTimeout(() => onCommit(next), 300);
    return () => window.clearTimeout(id);
  }, [text, value, onCommit]);

  return (
    <div className="relative">
      <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Model or brand"
        aria-label="Search new cars by model or brand"
        className="h-10 w-full rounded-full border border-line bg-white pl-10 pr-9 text-[14px] text-ink outline-none transition-[border-color] duration-[250ms] placeholder:text-muted/70 hover:border-ink/30 focus:border-ink [&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <button
          type="button"
          onClick={() => setText("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-mist hover:text-ink"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
