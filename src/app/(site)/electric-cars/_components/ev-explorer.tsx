"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BatteryLow, CarFront, Mountain, RotateCcw, Users } from "lucide-react";
import type { CarLite } from "@/types";
import { BUDGETS, inBudget } from "@/lib/catalog";
import { EASE } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/page-header";
import { EvCard } from "@/components/listing/ev-card";
import { dcMinutes } from "@/components/listing/ev-utils";
import { type ActiveFilter } from "@/components/listing/filter-ui";
import { FilterBar, IconTiles, ValueTiles, summarise, type Facet as BarFacet } from "@/components/listing/filter-bar";
import { readList, toggleValue, useQueryState, writeList } from "@/components/listing/use-query-state";
import { useCatalog } from "@/components/providers/catalog-provider";

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

function read(params: URLSearchParams, bodyTypes: string[]): EvFilters {
  const range = Number(params.get("range"));
  const sort = params.get("sort") ?? "popular";
  return {
    budget: readList(params, "budget", BUDGETS.map((b) => b.slug)),
    body: readList(params, "body", bodyTypes.map((b) => b.toLowerCase())),
    range: RANGE_STEPS.includes(range) ? range : 0,
    sort: SORTS.some((s) => s.value === sort) ? sort : "popular",
  };
}

function matches(car: CarLite, f: EvFilters, skip?: Facet) {
  if (skip !== "budget" && f.budget.length && !f.budget.some((b) => inBudget(car, b))) return false;
  if (skip !== "body" && f.body.length && !f.body.includes(car.bodyType.toLowerCase())) return false;
  if (skip !== "range" && f.range && (car.ev?.rangeKm ?? 0) < f.range) return false;
  return true;
}

function sortEvs(list: CarLite[], sort: string) {
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

const PAGE_SIZE = 18;

export function EvExplorer() {
  const { params, update } = useQueryState();
  const { electricCars } = useCatalog();
  const { evs, maxRange, bodyTypes } = useMemo(() => {
    const list = electricCars();
    return {
      evs: list,
      maxRange: Math.max(...list.map((c) => c.ev?.rangeKm ?? 0)),
      bodyTypes: Array.from(new Set(list.map((c) => c.bodyType))),
    };
  }, [electricCars]);
  const f = useMemo(() => read(params, bodyTypes), [params, bodyTypes]);
  const results = useMemo(() => sortEvs(evs.filter((c) => matches(c, f)), f.sort), [evs, f]);
  // A page of cards at a time; filters start over from the first page.
  const pageKey = params.toString();
  const [paging, setPaging] = useState({ key: pageKey, shown: PAGE_SIZE });
  const shown = paging.key === pageKey ? paging.shown : PAGE_SIZE;
  const count = (skip: Facet, test: (c: CarLite) => boolean) => evs.filter((c) => matches(c, f, skip) && test(c)).length;

  const toggle = (key: "budget" | "body", value: string) => update((p) => writeList(p, key, toggleValue(f[key], value)));
  const setRange = (value: number) => update((p) => (value ? p.set("range", String(value)) : p.delete("range")));
  const clearAll = () => update((p) => ["budget", "body", "range"].forEach((k) => p.delete(k)));

  const budgetOptions = BUDGETS.map((b) => ({ value: b.slug, label: b.label, count: count("budget", (c) => inBudget(c, b.slug)) }));
  const bodyOptions = bodyTypes.map((b) => ({ value: b.toLowerCase(), label: b === "MUV" ? "MUV / crossover" : b, count: count("body", (c) => c.bodyType === b) }));
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
            options={rangeOptions.map((o) => ({ ...o, hint: o.value === "0" ? `${evs.length} models` : undefined }))}
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
            {results.slice(0, shown).map((car) => (
              <motion.div
                key={car.slug}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.2 } }}
                transition={{ duration: 0.4, ease: EASE }}
              >
                <EvCard car={car} maxRange={maxRange} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
      {results.length > shown && (
        <div className="mt-12 flex flex-col items-center gap-3">
          <Button variant="outline" onClick={() => setPaging({ key: pageKey, shown: shown + PAGE_SIZE })}>
            Show {Math.min(PAGE_SIZE, results.length - shown)} more
          </Button>
          <p className="text-[12.5px] text-muted num">
            Showing {shown} of {results.length}
          </p>
        </div>
      )}
    </FilterBar>
  );
}
