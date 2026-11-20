"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, MapPin } from "lucide-react";
import type { Variant } from "@/types";
import { formatINR, formatPrice, formatPriceShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { Chip } from "@/components/ui/chip";
import { DemoNote } from "@/components/ui/badge";
import { useUI } from "@/components/providers/app-provider";
import { useCatalog } from "@/components/providers/catalog-provider";
import { useCarDetail } from "./context";
import { sortedVariants } from "./utils";

type GearFilter = "all" | "manual" | "automatic";

const isAuto = (v: Variant) => v.transmission !== "Manual";

/** Variants & prices: filterable table on desktop, stacked rows on mobile. */
export function VariantsTable() {
  const { car, ev, city, variant: selected, setVariant } = useCarDetail();
  const { onRoadPrice } = useCatalog();
  const { setLocationOpen } = useUI();
  const [fuel, setFuel] = useState<string>("all");
  const [gear, setGear] = useState<GearFilter>("all");

  const all = useMemo(() => sortedVariants(car), [car]);
  const fuels = useMemo(() => Array.from(new Set(all.map((v) => v.fuel))), [all]);
  const hasManual = all.some((v) => !isAuto(v));
  const hasAuto = all.some(isAuto);

  const rows = all.filter(
    (v) => (fuel === "all" || v.fuel === fuel) && (gear === "all" || (gear === "automatic" ? isAuto(v) : !isAuto(v))),
  );
  const effLabel = ev ? "Range" : "Mileage";

  return (
    <div>
      <div className="flex flex-col gap-5 border-b border-line pb-6 md:flex-row md:items-center md:justify-between">
        <div className="no-scrollbar -mx-5 flex min-w-0 gap-2 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0">
          {fuels.length > 1 && (
            <>
              <Chip selected={fuel === "all"} onClick={() => setFuel("all")}>
                All fuels
              </Chip>
              {fuels.map((f) => (
                <Chip key={f} selected={fuel === f} onClick={() => setFuel(fuel === f ? "all" : f)}>
                  {f}
                </Chip>
              ))}
            </>
          )}
          {fuels.length > 1 && hasManual && hasAuto && <span aria-hidden className="mx-1 w-px shrink-0 self-stretch bg-line" />}
          {hasManual && hasAuto && (
            <>
              <Chip selected={gear === "all"} onClick={() => setGear("all")}>
                Any gearbox
              </Chip>
              <Chip selected={gear === "manual"} onClick={() => setGear(gear === "manual" ? "all" : "manual")}>
                Manual
              </Chip>
              <Chip selected={gear === "automatic"} onClick={() => setGear(gear === "automatic" ? "all" : "automatic")}>
                Automatic
              </Chip>
            </>
          )}
          {fuels.length <= 1 && !(hasManual && hasAuto) && (
            <p className="text-[13px] text-muted">
              Every variant: {all[0].fuel} · {all[0].transmission}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setLocationOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 self-start text-[13px] font-medium md:self-auto"
        >
          <MapPin aria-hidden className="size-3.5 text-red" />
          On-road prices for <span className="underline decoration-ink/25 underline-offset-4">{city.name}</span>
        </button>
      </div>

      <p className="mt-4 text-[12.5px] text-muted" aria-live="polite">
        Showing <span className="num text-ink">{rows.length}</span> of <span className="num">{all.length}</span> variants · select a dot to price that
        variant across this page
      </p>

      {/* Desktop table */}
      <div className="mt-6 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] border-collapse text-left text-[14px]">
          <caption className="sr-only">
            {car.name} variants with ex-showroom and on-road prices in {city.name}
          </caption>
          <thead>
            <tr className="border-b border-ink text-[11px] uppercase tracking-[0.14em] text-muted">
              <th scope="col" className="w-10 py-3 font-semibold">
                <span className="sr-only">Select</span>
              </th>
              <th scope="col" className="py-3 pr-4 font-semibold">Variant</th>
              <th scope="col" className="py-3 pr-4 font-semibold">Fuel</th>
              <th scope="col" className="py-3 pr-4 font-semibold">Transmission</th>
              <th scope="col" className="py-3 pr-4 font-semibold">{effLabel}</th>
              <th scope="col" className="py-3 pr-4 text-right font-semibold">Ex-showroom</th>
              <th scope="col" className="py-3 pr-4 text-right font-semibold">On-road · {city.name}</th>
              <th scope="col" className="w-12 py-3">
                <span className="sr-only">Details</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {rows.map((v) => {
                const isSel = v.slug === selected.slug;
                return (
                  <motion.tr
                    key={v.slug}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className={cn("group border-b border-line transition-colors duration-[250ms]", isSel ? "bg-mist" : "hover:bg-mist/60")}
                  >
                    <td className="py-4 pl-1">
                      <SelectDot selected={isSel} name={v.name} onSelect={() => setVariant(v.slug)} />
                    </td>
                    <td className="py-4 pr-4">
                      <Link href={`/cars/${car.slug}/${v.slug}`} className="font-medium hover:text-red">
                        {v.name}
                      </Link>
                      <p className="mt-1 line-clamp-1 text-[12px] text-muted">{v.features.join(" · ")}</p>
                    </td>
                    <td className="py-4 pr-4">{v.fuel}</td>
                    <td className="py-4 pr-4">{v.transmission}</td>
                    <td className="py-4 pr-4 num">{v.efficiency}</td>
                    <td className="py-4 pr-4 text-right num">{formatPrice(v.price)}</td>
                    <td className="py-4 pr-4 text-right font-semibold num">{formatINR(onRoadPrice(v.price, city.slug, ev))}</td>
                    <td className="py-4 text-right">
                      <Link
                        href={`/cars/${car.slug}/${v.slug}`}
                        aria-label={`${v.name} details`}
                        className="inline-flex size-9 items-center justify-center rounded-full border border-line transition-colors duration-[250ms] group-hover:border-ink hover:bg-ink hover:text-white"
                      >
                        <ArrowRight aria-hidden className="size-4" />
                      </Link>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked rows */}
      <ul className="mt-4 divide-y divide-line border-y border-line md:hidden">
        {rows.map((v) => {
          const isSel = v.slug === selected.slug;
          return (
            <li key={v.slug} className={cn("flex gap-3 py-5", isSel && "-mx-5 bg-mist px-5")}>
              <div className="pt-0.5">
                <SelectDot selected={isSel} name={v.name} onSelect={() => setVariant(v.slug)} />
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/cars/${car.slug}/${v.slug}`} className="flex items-start justify-between gap-3">
                  <span className="text-[15px] font-medium leading-snug">{v.name}</span>
                  <ArrowRight aria-hidden className="mt-0.5 size-4 shrink-0 text-red" />
                </Link>
                <p className="mt-1 text-[12.5px] text-muted">
                  {v.fuel} · {v.transmission} · {v.efficiency}
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-[11px] text-muted">Ex-showroom</dt>
                    <dd className="text-[14px] num">{formatPriceShort(v.price)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted">On-road · {city.name}</dt>
                    <dd className="text-[14px] font-semibold num">{formatPriceShort(onRoadPrice(v.price, city.slug, ev))}</dd>
                  </div>
                </dl>
              </div>
            </li>
          );
        })}
      </ul>

      {rows.length === 0 && (
        <div className="border-b border-line py-10 text-center">
          <p className="text-[15px]">No variant matches that combination.</p>
          <button
            type="button"
            onClick={() => {
              setFuel("all");
              setGear("all");
            }}
            className="mt-3 text-[13px] font-medium text-red underline-offset-4 hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}

      <DemoNote className="mt-5 block">
        Ex-showroom and on-road prices are indicative demo figures. On-road includes registration, insurance and handling.
      </DemoNote>
    </div>
  );
}

function SelectDot({ selected, name, onSelect }: { selected: boolean; name: string; onSelect: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={selected ? `${name} is priced across this page` : `Price ${name} across this page`}
      onClick={onSelect}
      className={cn(
        "inline-flex size-5 items-center justify-center rounded-full border transition-colors duration-[250ms]",
        selected ? "border-red" : "border-ink/25 hover:border-ink",
      )}
    >
      <span className={cn("size-2.5 rounded-full transition-transform duration-[250ms]", selected ? "scale-100 bg-red" : "scale-0 bg-ink")} />
    </button>
  );
}
