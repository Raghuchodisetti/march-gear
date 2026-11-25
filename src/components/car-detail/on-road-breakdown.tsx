"use client";

import { MapPin } from "lucide-react";
import { motion } from "motion/react";
import { formatINR, formatPriceShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { DemoNote } from "@/components/ui/badge";
import { useCity, useUI } from "@/components/providers/app-provider";
import { useCatalog } from "@/components/providers/catalog-provider";
import { onRoadBreakdown } from "./utils";

/** On-road price build-up for the chosen city, plus a city-by-city ladder. */
export function OnRoadBreakdown({ exShowroom, ev, variantName }: { exShowroom: number; ev: boolean; variantName: string }) {
  const { city, setCity } = useCity();
  const { setLocationOpen, toast } = useUI();
  const { cities, onRoadPrice } = useCatalog();
  const b = onRoadBreakdown(exShowroom, onRoadPrice(exShowroom, city.slug, ev), ev);

  const lines = [
    { key: "ex", label: "Ex-showroom price", note: "Before taxes collected at registration", value: b.exShowroom, swatch: "bg-ink" },
    {
      key: "tax",
      label: ev ? "Registration (EV road-tax waiver)" : "RTO & road tax",
      note: ev ? `Most states waive road tax on EVs` : `${city.state} registration and lifetime road tax`,
      value: b.roadTax,
      swatch: "bg-red",
    },
    { key: "ins", label: "Insurance", note: "First-year comprehensive with zero depreciation", value: b.insurance, swatch: "bg-ink/40" },
    { key: "other", label: "Handling & other charges", note: "FASTag, number plates, logistics", value: b.other, swatch: "bg-ink/15" },
  ];

  const ladder = cities
    .filter((c) => c.popular || c.slug === city.slug)
    .map((c) => ({ city: c, total: onRoadPrice(exShowroom, c.slug, ev) }))
    .sort((a, b2) => a.total - b2.total);
  const cheapest = ladder[0]?.total ?? b.total;

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10">
      <div className="min-w-0 lg:col-span-7">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink pb-5">
          <div>
            <p className="text-[12.5px] text-muted">On-road price in</p>
            <p className="type-h3 mt-1">{city.name}</p>
          </div>
          <button
            type="button"
            onClick={() => setLocationOpen(true)}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium underline decoration-ink/25 underline-offset-4 hover:decoration-ink"
          >
            <MapPin aria-hidden className="size-3.5 text-red" />
            Change city
          </button>
        </div>

        <div className="mt-6 flex h-3 w-full overflow-hidden" role="img" aria-label="Share of each charge in the on-road price">
          {lines.map((l) => (
            <motion.span
              key={`${l.key}-${city.slug}`}
              className={cn("h-full", l.swatch)}
              initial={{ width: 0 }}
              animate={{ width: `${(l.value / b.total) * 100}%` }}
              transition={{ duration: 0.9, ease: EASE }}
            />
          ))}
        </div>

        <dl className="mt-6">
          {lines.map((l) => (
            <div key={l.key} className="flex items-start justify-between gap-6 border-b border-line py-4">
              <dt className="flex min-w-0 gap-3">
                <span aria-hidden className={cn("mt-1.5 size-2.5 shrink-0", l.swatch)} />
                <span className="min-w-0">
                  <span className="block text-[14px] font-medium">{l.label}</span>
                  <span className="block text-[12px] text-muted">{l.note}</span>
                </span>
              </dt>
              <dd className="shrink-0 text-right text-[15px] num">{formatINR(l.value)}</dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-6 py-5">
            <dt className="text-[15px] font-semibold">On-road price · {variantName}</dt>
            <dd className="type-h3 shrink-0 num">{formatINR(b.total)}</dd>
          </div>
        </dl>
        <DemoNote>Indicative estimate. Actual road tax, registration and insurance depend on your state&apos;s rules, ownership type and the insurer — confirm the final on-road price with the dealer.</DemoNote>
      </div>

      <div className="min-w-0 lg:col-span-5">
        <div className="bg-mist p-6 md:p-8">
          <h3 className="type-h4">Across major cities</h3>
          <p className="mt-1 text-[13px] text-muted">Select a city to update every price on the page.</p>
          <ul className="mt-6 divide-y divide-ink/10 border-y border-ink/10">
            {ladder.map(({ city: c, total }) => {
              const active = c.slug === city.slug;
              return (
                <li key={c.slug}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      if (active) return;
                      setCity(c.slug);
                      toast(`Showing prices for ${c.name}`, { tone: "success" });
                    }}
                    className={cn("flex w-full items-center justify-between gap-4 py-3.5 text-left transition-colors duration-[250ms]", active ? "text-ink" : "text-ink/70 hover:text-ink")}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", active ? "bg-red" : "bg-transparent")} />
                      <span className={cn("truncate text-[14px]", active && "font-semibold")}>{c.name}</span>
                    </span>
                    <span className="flex shrink-0 items-baseline gap-3">
                      {total > cheapest && <span className="hidden text-[11.5px] text-muted sm:inline num">+{formatPriceShort(total - cheapest)}</span>}
                      <span className={cn("text-[14px] num", active && "font-semibold")}>{formatPriceShort(total)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
