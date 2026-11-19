"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bell, CalendarClock, Check, Droplet, Fuel, Leaf, RotateCcw, Wind, Zap } from "lucide-react";
import type { UpcomingCar } from "@/types";
import { upcomingCars } from "@/data/upcoming";
import { brandName } from "@/data/brands";
import { formatMonth, formatPriceRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/page-header";
import { useUI } from "@/components/providers/app-provider";
import { type ActiveFilter } from "@/components/listing/filter-ui";
import { BrandTiles, FilterBar, IconTiles, summarise, type Facet } from "@/components/listing/filter-bar";
import { readList, toggleValue, useQueryState, writeList } from "@/components/listing/use-query-state";

/** Fixed "today" for relative labels — never computed from the clock during render. */
const REFERENCE_MONTH = "2026-11";

const FUELS = Array.from(new Set(upcomingCars.map((c) => c.fuel)));
const BRANDS = Array.from(new Set(upcomingCars.map((c) => c.brand))).sort((a, b) => brandName(a).localeCompare(brandName(b)));
const NEXT_UP = [...upcomingCars].sort((a, b) => a.expectedLaunch.localeCompare(b.expectedLaunch))[0]?.slug;

const SORTS = [
  { value: "soonest", label: "Soonest first" },
  { value: "latest", label: "Furthest out first" },
];

function monthsFromReference(month: string) {
  const [ry, rm] = REFERENCE_MONTH.split("-").map(Number);
  const [y, m] = month.split("-").map(Number);
  return (y - ry) * 12 + (m - rm);
}

function relativeLabel(month: string) {
  const n = monthsFromReference(month);
  if (n <= 0) return "This month";
  if (n === 1) return "Next month";
  return `In ${n} months`;
}

export function UpcomingTimeline() {
  const { params, update } = useQueryState();
  const fuel = useMemo(() => readList(params, "fuel", FUELS.map((f) => f.toLowerCase())), [params]);
  const brand = useMemo(() => readList(params, "brand", BRANDS), [params]);
  const sort = params.get("sort") === "latest" ? "latest" : "soonest";
  const [notified, setNotified] = useState<string[]>([]);
  const { toast } = useUI();

  const fuelOk = (c: UpcomingCar) => !fuel.length || fuel.includes(c.fuel.toLowerCase());
  const brandOk = (c: UpcomingCar) => !brand.length || brand.includes(c.brand);
  const results = upcomingCars.filter((c) => fuelOk(c) && brandOk(c));

  const byMonth = new Map<string, UpcomingCar[]>();
  [...results]
    .sort((a, b) => (sort === "soonest" ? a.expectedLaunch.localeCompare(b.expectedLaunch) : b.expectedLaunch.localeCompare(a.expectedLaunch)))
    .forEach((c) => byMonth.set(c.expectedLaunch, [...(byMonth.get(c.expectedLaunch) ?? []), c]));
  const groups = Array.from(byMonth, ([month, items]) => ({ month, items }));

  const toggle = (key: "fuel" | "brand", value: string) => update((p) => writeList(p, key, toggleValue(key === "fuel" ? fuel : brand, value)));
  const clearAll = () => update((p) => ["fuel", "brand"].forEach((k) => p.delete(k)));

  const notify = (car: UpcomingCar) => {
    const title = `${brandName(car.brand)} ${car.name}`;
    const on = notified.includes(car.slug);
    setNotified((list) => (on ? list.filter((s) => s !== car.slug) : [...list, car.slug]));
    toast(on ? `Launch alert removed for the ${title}` : `We'll let you know the moment the ${title} launches`, { tone: on ? "default" : "success" });
  };

  const fuelOptions = FUELS.map((f) => ({ value: f.toLowerCase(), label: f, count: upcomingCars.filter((c) => brandOk(c) && c.fuel === f).length }));
  const brandOptions = BRANDS.map((b) => ({ value: b, label: brandName(b), count: upcomingCars.filter((c) => fuelOk(c) && c.brand === b).length }));

  const active: ActiveFilter[] = [
    ...fuel.map((v) => ({ key: `fuel-${v}`, label: fuelOptions.find((o) => o.value === v)?.label ?? v, onRemove: () => toggle("fuel", v) })),
    ...brand.map((v) => ({ key: `brand-${v}`, label: brandName(v), onRemove: () => toggle("brand", v) })),
  ];

  const FUEL_ICONS: Record<string, typeof Zap> = { electric: Zap, petrol: Fuel, diesel: Droplet, hybrid: Leaf, cng: Wind };
  const facets: Facet[] = [
    {
      key: "fuel",
      label: "Fuel",
      activeCount: fuel.length,
      summary: summarise(fuelOptions.filter((o) => fuel.includes(o.value)).map((o) => o.label)),
      onClear: () => update((p) => p.delete("fuel")),
      content: (
        <IconTiles
          columns={3}
          options={fuelOptions.map((o) => ({ ...o, icon: FUEL_ICONS[o.value] ?? Fuel, hint: `${o.count} expected` }))}
          selected={fuel}
          onToggle={(v) => toggle("fuel", v)}
        />
      ),
    },
    {
      key: "brand",
      label: "Brand",
      activeCount: brand.length,
      summary: summarise(brandOptions.filter((o) => brand.includes(o.value)).map((o) => o.label)),
      onClear: () => update((p) => p.delete("brand")),
      content: (
        <>
          <BrandTiles options={brandOptions} selected={brand} onToggle={(v) => toggle("brand", v)} />
          <p className="mt-5 text-[12.5px] text-muted">
            Launch windows and prices are speculative, compiled from industry reporting, and shown as indicative mock data for this demo.
          </p>
        </>
      ),
    },
  ];

  return (
    <FilterBar
      facets={facets}
      activeFilters={active}
      onClearAll={clearAll}
      resultCount={results.length}
      noun={["expected launch", "expected launches"]}
      sort={{ value: sort, options: SORTS, onChange: (v) => update((p) => (v === "soonest" ? p.delete("sort") : p.set("sort", v))) }}
    >
      {groups.length === 0 ? (
        <EmptyState
          icon={<CalendarClock aria-hidden className="size-6" />}
          title="Nothing scheduled for that combination"
          description="No launches match these filters yet. Clear them to see the full calendar."
          action={
            <Button variant="dark" onClick={clearAll} icon={<RotateCcw aria-hidden className="size-4" />}>
              Show all launches
            </Button>
          }
        />
      ) : (
        <div className="relative space-y-14 md:space-y-20">
          <AnimatePresence mode="popLayout" initial={false}>
            {groups.map((g) => (
              <motion.section
                key={g.month}
                layout
                aria-labelledby={`month-${g.month}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                transition={{ duration: 0.45, ease: EASE }}
                className="grid grid-cols-1 gap-6 md:grid-cols-[120px_minmax(0,1fr)] md:gap-10"
              >
                <header className="flex items-baseline gap-3 border-b border-line pb-4 md:block md:border-b-0 md:pb-0">
                  <h2 id={`month-${g.month}`} className="font-display text-[30px] font-semibold leading-none tracking-[-0.035em] [font-stretch:108%] md:text-[44px]">
                    {formatMonth(g.month).split(" ")[0]}
                    <span className="ml-2 text-[0.55em] font-medium text-muted num md:ml-0 md:mt-2 md:block">{formatMonth(g.month).split(" ")[1]}</span>
                  </h2>
                  <p className="type-eyebrow ml-auto text-red md:ml-0 md:mt-5">{relativeLabel(g.month)}</p>
                </header>

                <ol className="relative border-l border-line">
                  {g.items.map((car) => (
                    <li key={car.slug} className="relative pb-12 pl-6 last:pb-0 sm:pl-8 md:pl-10">
                      <span
                        aria-hidden
                        className={cn(
                          "absolute -left-[5px] top-1.5 size-[9px] rounded-full border-2",
                          car.slug === NEXT_UP ? "border-red bg-red" : "border-ink bg-white",
                        )}
                      />
                      <UpcomingEntry car={car} nextUp={car.slug === NEXT_UP} notified={notified.includes(car.slug)} onNotify={() => notify(car)} />
                    </li>
                  ))}
                </ol>
              </motion.section>
            ))}
          </AnimatePresence>
        </div>
      )}
    </FilterBar>
  );
}

function UpcomingEntry({ car, nextUp, notified, onNotify }: { car: UpcomingCar; nextUp: boolean; notified: boolean; onNotify: () => void }) {
  const title = `${brandName(car.brand)} ${car.name}`;
  return (
    <article className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] sm:gap-8">
      <div className="relative aspect-[4/3] self-start overflow-hidden bg-mist">
        <Image
          src={car.image}
          alt={`${title} — representative image`}
          fill
          sizes="(min-width: 1280px) 340px, (min-width: 640px) 36vw, 90vw"
          className="object-cover"
        />
        <div className="absolute left-3 top-3 flex gap-1.5">
          {nextUp && <Badge tone="red">Next up</Badge>}
          <Badge tone={car.fuel === "Electric" ? "glass-dark" : "glass"}>
            {car.fuel === "Electric" && <Zap aria-hidden className="size-3" />}
            {car.fuel}
          </Badge>
        </div>
      </div>

      <div className="min-w-0">
        <p className="type-eyebrow text-muted">
          {brandName(car.brand)} · {car.bodyType}
        </p>
        <h3 className="type-h3 mt-2">{car.name}</h3>
        <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-muted">{car.teaser}</p>
        <ul className="mt-5 space-y-2">
          {car.highlights.map((h) => (
            <li key={h} className="flex gap-3 text-[13.5px] text-ink">
              <span aria-hidden className="mt-[10px] h-px w-3 shrink-0 bg-red" />
              {h}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-line pt-5">
          <div>
            <p className="text-[16px] font-semibold num">{formatPriceRange(car.priceMin, car.priceMax)}</p>
            <p className="mt-0.5 text-[11.5px] text-muted">Expected · indicative mock data</p>
          </div>
          <Button
            size="sm"
            variant={notified ? "dark" : "outline"}
            aria-pressed={notified}
            onClick={onNotify}
            icon={notified ? <Check aria-hidden className="size-4" /> : <Bell aria-hidden className="size-4" />}
            aria-label={notified ? `Notified for ${title}. Tap to cancel the alert` : `Notify me when the ${title} launches`}
          >
            {notified ? "Notified" : "Notify me"}
          </Button>
        </div>
      </div>
    </article>
  );
}
