"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BatteryLow, CarFront, Mountain, RotateCcw, Users } from "lucide-react";
import type { CarModel } from "@/types";
import { BUDGETS, electricCars, inBudget } from "@/data/cars";
import { EASE } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/page-header";
import { EvCard } from "@/components/listing/ev-card";
import { dcMinutes } from "@/components/listing/ev-utils";
import { type ActiveFilter } from "@/components/listing/filter-ui";
import { FilterBar, IconTiles, ValueTiles, summarise, type Facet as BarFacet } from "@/components/listing/filter-bar";
import { readList, toggleValue, useQueryState, writeList } from "@/components/listing/use-query-state";

const EVS = electricCars();
const MAX_RANGE = Math.max(...EVS.map((c) => c.ev?.rangeKm ?? 0));
const BODY_TYPES = Array.from(new Set(EVS.map((c) => c.bodyType)));
const RANGE_STEPS = [400, 450, 500, 600];

const SORTS = [
  { value: "popular", label: "Popularity" },
  { value: "range", label: "Longest range" },
  { value: "charging", label: "Fastest DC charging" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

interface EvFilters {
  budget: string[];
  body: string[];
  range: number;
  sort: string;
}

type Facet = "budget" | "body" | "range";

function read(params: URLSearchParams): EvFilters {
  const range = Number(params.get("range"));
  const sort = params.get("sort") ?? "popular";
  return {
    budget: readList(params, "budget", BUDGETS.map((b) => b.slug)),
    body: readList(params, "body", BODY_TYPES.map((b) => b.toLowerCase())),
    range: RANGE_STEPS.includes(range) ? range : 0,
    sort: SORTS.some((s) => s.value === sort) ? sort : "popular",
  };
}

function matches(car: CarModel, f: EvFilters, skip?: Facet) {
  if (skip !== "budget" && f.budget.length && !f.budget.some((b) => inBudget(car, b))) return false;
  if (skip !== "body" && f.body.length && !f.body.includes(car.bodyType.toLowerCase())) return false;
  if (skip !== "range" && f.range && (car.ev?.rangeKm ?? 0) < f.range) return false;
  return true;
}

function sortEvs(list: CarModel[], sort: string) {
  const out = [...list];
  switch (sort) {
    case "range":
      return out.sort((a, b) => (b.ev?.rangeKm ?? 0) - (a.ev?.rangeKm ?? 0));
    case "charging":
      return out.sort((a, b) => dcMinutes(a) - dcMinutes(b));
    case "price-asc":
      return out.sort((a, b) => a.priceMin - b.priceMin);
    case "price-desc":
      return out.sort((a, b) => b.priceMin - a.priceMin);
    default:
      return out.sort((a, b) => Number(Boolean(b.trending)) - Number(Boolean(a.trending)) || b.rating - a.rating);
  }
}

export function EvExplorer() {
  const { params, update } = useQueryState();
  const f = useMemo(() => read(params), [params]);
  const results = useMemo(() => sortEvs(EVS.filter((c) => matches(c, f)), f.sort), [f]);
  const count = (skip: Facet, test: (c: CarModel) => boolean) => EVS.filter((c) => matches(c, f, skip) && test(c)).length;

  const toggle = (key: "budget" | "body", value: string) => update((p) => writeList(p, key, toggleValue(f[key], value)));
  const setRange = (value: number) => update((p) => (value ? p.set("range", String(value)) : p.delete("range")));
  const clearAll = () => update((p) => ["budget", "body", "range"].forEach((k) => p.delete(k)));

  const budgetOptions = BUDGETS.map((b) => ({ value: b.slug, label: b.label, count: count("budget", (c) => inBudget(c, b.slug)) }));
  const bodyOptions = BODY_TYPES.map((b) => ({ value: b.toLowerCase(), label: b === "MUV" ? "MUV / crossover" : b, count: count("body", (c) => c.bodyType === b) }));
  const rangeOptions = [
    { value: "0", label: "Any range" },
    ...RANGE_STEPS.map((r) => ({ value: String(r), label: `${r}+ km`, count: count("range", (c) => (c.ev?.rangeKm ?? 0) >= r) })),
  ];

  const active: ActiveFilter[] = [
    ...f.budget.map((v) => ({ key: `budget-${v}`, label: BUDGETS.find((b) => b.slug === v)?.label ?? v, onRemove: () => toggle("budget", v) })),
    ...(f.range ? [{ key: "range", label: `${f.range}+ km range`, onRemove: () => setRange(0) }] : []),
    ...f.body.map((v) => ({ key: `body-${v}`, label: bodyOptions.find((o) => o.value === v)?.label ?? v, onRemove: () => toggle("body", v) })),
  ];

  const facets: BarFacet[] = [
    {
      key: "range",
      label: "Range",
      activeCount: f.range ? 1 : 0,
      summary: f.range ? `${f.range}+ km` : undefined,
      onClear: () => setRange(0),
      content: (
        <>
          <ValueTiles
            options={rangeOptions.map((o) => ({ ...o, hint: o.value === "0" ? `${EVS.length} models` : undefined }))}
            selected={[String(f.range)]}
            onToggle={(v) => setRange(Number(v))}
          />
          <p className="mt-4 text-[12.5px] text-muted">Real-world range is typically 20–30% lower than the claimed (MIDC) figure.</p>
        </>
      ),
    },
    {
      key: "budget",
      label: "Budget",
      activeCount: f.budget.length,
      summary: summarise(budgetOptions.filter((o) => f.budget.includes(o.value)).map((o) => o.label)),
      onClear: () => update((p) => p.delete("budget")),
      content: <ValueTiles options={budgetOptions} selected={f.budget} onToggle={(v) => toggle("budget", v)} />,
    },
    {
      key: "body",
      label: "Body type",
      activeCount: f.body.length,
      summary: summarise(bodyOptions.filter((o) => f.body.includes(o.value)).map((o) => o.label)),
      onClear: () => update((p) => p.delete("body")),
      content: (
        <IconTiles
          columns={3}
          options={bodyOptions.map((o) => ({ ...o, icon: o.value === "suv" ? Mountain : o.value === "sedan" ? CarFront : Users }))}
          selected={f.body}
          onToggle={(v) => toggle("body", v)}
        />
      ),
    },
  ];

  return (
    <FilterBar
      facets={facets}
      activeFilters={active}
      onClearAll={clearAll}
      resultCount={results.length}
      noun={["electric car", "electric cars"]}
      sort={{ value: f.sort, options: SORTS, onChange: (v) => update((p) => (v === "popular" ? p.delete("sort") : p.set("sort", v))) }}
    >
      {results.length === 0 ? (
        <EmptyState
          icon={<BatteryLow aria-hidden className="size-6" />}
          title="No EVs go that far — yet"
          description="Loosen the range or budget filters, or see which long-range electric cars are launching soon."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="dark" onClick={clearAll} icon={<RotateCcw aria-hidden className="size-4" />}>
                Reset filters
              </Button>
              <Button variant="outline" href="/upcoming-cars">
                Upcoming EVs
              </Button>
            </div>
          }
        />
      ) : (
        <div className="relative grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-4">
          <AnimatePresence mode="popLayout" initial={false}>
            {results.map((car) => (
              <motion.div
                key={car.slug}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.2 } }}
                transition={{ duration: 0.4, ease: EASE }}
              >
                <EvCard car={car} maxRange={MAX_RANGE} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </FilterBar>
  );
}
