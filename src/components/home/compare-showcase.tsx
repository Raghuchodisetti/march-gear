"use client";

import { cardPhotoAlt } from "@/lib/image-alt";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { ChevronDown, Plus, X } from "lucide-react";
import type { CarLite, CarModel } from "@/types";
import { isElectric } from "@/lib/catalog";
import { formatPriceRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { Stars } from "@/components/ui/rating";
import { Eyebrow } from "@/components/ui/section-heading";
import { Button } from "@/components/ui/button";
import { useCompare } from "@/components/providers/app-provider";
import { useCatalog } from "@/components/providers/catalog-provider";
import { useCarDetails } from "@/components/providers/car-details";
import { CarImage } from "@/components/vehicle/car-image";
import { NOT_PUBLISHED, known, powerBhp, topFigure } from "@/lib/specs";
import { SHOWCASE_DEFAULT } from "./showcase-defaults";

const MAX = 4;

const featureCount = (c?: CarModel) => (c ? c.features.reduce((n, g) => n + g.items.length, 0) : 0);
const dash = <span className="text-muted">{NOT_PUBLISHED}</span>;

/** A light catalogue model plus its full details once loaded (power and features aren't in the light shape). */
type ShowcaseCar = CarLite & { full?: CarModel };

interface Metric {
  label: string;
  value: (c: ShowcaseCar) => number;
  display: (c: ShowcaseCar) => React.ReactNode;
  /** Draw a proportional bar */
  bar?: boolean;
  higherIsBetter?: boolean;
}

const METRICS: Metric[] = [
  { label: "Engine", value: () => 0, display: (c) => c.engine },
  {
    // Shown as published (bhp, PS or kW); compared in bhp so mixed units rank fairly.
    label: "Power",
    value: (c) => powerBhp(c.full?.power) ?? 0,
    display: (c) => topFigure(c.full?.power)?.text ?? dash,
    bar: true,
    higherIsBetter: true,
  },
  {
    label: "Mileage / range",
    value: (c) => (isElectric(c) ? 0 : c.efficiencyValue),
    display: (c) => c.efficiency || dash,
  },
  {
    label: "Safety",
    value: (c) => c.safetyRating,
    display: (c) =>
      c.safetyRating ? (
        <span className="flex flex-col gap-1">
          <Stars value={c.safetyRating} size={13} />
          <span className="text-[11.5px] text-muted">{c.safetyAgency}</span>
        </span>
      ) : (
        <span className="text-muted">Not tested</span>
      ),
    higherIsBetter: true,
  },
  { label: "Features", value: (c) => featureCount(c.full), display: (c) => (c.full ? `${featureCount(c.full)} listed` : dash), bar: true, higherIsBetter: true },
  { label: "Boot space", value: (c) => c.bootSpace, display: (c) => (known(c.bootSpace) ? `${c.bootSpace} L` : dash), bar: true, higherIsBetter: true },
];

/** `initial`: full details of SHOWCASE_DEFAULT from the server; others load when picked. */
export function CompareShowcase({ initial }: { initial?: CarModel[] }) {
  const router = useRouter();
  const compare = useCompare();
  const { getCar, brandName } = useCatalog();
  const [slugs, setSlugs] = useState<string[]>(() => SHOWCASE_DEFAULT.filter((s) => getCar(s)));
  const [adding, setAdding] = useState(false);
  const details = useCarDetails(slugs, initial);
  const selected: ShowcaseCar[] = slugs
    .map(getCar)
    .filter((c): c is CarLite => Boolean(c))
    .map((c) => ({ ...c, full: details.get(c.slug) }));

  const replace = (i: number, slug: string) => setSlugs((prev) => prev.map((s, j) => (j === i ? slug : s)));
  const remove = (i: number) => setSlugs((prev) => prev.filter((_, j) => j !== i));
  const add = (slug: string) => {
    setSlugs((prev) => [...prev, slug].slice(0, MAX));
    setAdding(false);
  };

  const openFull = () => {
    compare.set(slugs);
    router.push(`/compare?cars=${slugs.join(",")}`);
  };

  const cols = selected.length + (selected.length < MAX ? 1 : 0);

  return (
    <section aria-labelledby="compare-title" className="bg-mist py-14 md:py-20">
      <div className="container-x">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <Eyebrow>Compare your favourites</Eyebrow>
            <h2 id="compare-title" className="type-h2 mt-5 text-balance">
              Line them up. Let the numbers do the talking.
            </h2>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-muted">
              Swap any car, add up to four, and watch the differences resolve in real time. The leader in each measure is marked in red.
            </p>
          </div>
          <Button variant="dark" arrow onClick={openFull} disabled={selected.length < 2}>
            Open full comparison
          </Button>
        </div>

        <div className="no-scrollbar -mx-5 mt-12 overflow-x-auto px-5 md:mx-0 md:px-0">
          <LayoutGroup>
            <div
              className="grid min-w-[680px] border border-line bg-white"
              style={{ gridTemplateColumns: `minmax(120px,0.7fr) repeat(${cols}, minmax(0,1fr))` }}
            >
              {/* Header row */}
              <div className="border-b border-line p-5">
                <p className="type-eyebrow text-muted">{selected.length} of {MAX} selected</p>
              </div>
              <AnimatePresence initial={false}>
                {selected.map((car, i) => (
                  <motion.div
                    key={`${car.slug}-${i}`}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5, ease: EASE }}
                    className="relative border-b border-l border-line p-4 md:p-5"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-mist">
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.div key={car.slug} className="absolute inset-0" initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6, ease: EASE }}>
                          <CarImage
                            car={car}
                            alt={car.images[0] ? cardPhotoAlt(car.images[0], `${brandName(car.brand)} ${car.name}`) : ""}
                            sizes="(min-width: 1024px) 22vw, 40vw"
                            className="object-cover"
                            style={{ objectPosition: car.focus ?? "50% 55%" }}
                          />
                        </motion.div>
                      </AnimatePresence>
                      {selected.length > 2 && (
                        <button
                          type="button"
                          onClick={() => remove(i)}
                          aria-label={`Remove ${car.name}`}
                          className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full bg-white/90 text-ink backdrop-blur-sm transition-colors hover:bg-white"
                        >
                          <X className="size-4" />
                        </button>
                      )}
                    </div>
                    <CarSelect value={car.slug} exclude={slugs} onChange={(s) => replace(i, s)} />
                    <p className="mt-1 text-[14px] font-semibold num">{formatPriceRange(car.priceMin, car.priceMax)}</p>
                  </motion.div>
                ))}
              </AnimatePresence>
              {selected.length < MAX && (
                <motion.div layout className="flex items-center justify-center border-b border-l border-line p-4">
                  {adding ? (
                    <div className="w-full">
                      <CarSelect value="" exclude={slugs} onChange={add} placeholder="Choose a car" autoOpen />
                      <button type="button" onClick={() => setAdding(false)} className="mt-2 text-[12px] text-muted hover:text-ink">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAdding(true)}
                      className="group flex aspect-[16/10] w-full flex-col items-center justify-center gap-3 border border-dashed border-ink/20 text-[13px] text-muted transition-colors hover:border-ink hover:text-ink"
                    >
                      <span className="inline-flex size-10 items-center justify-center rounded-full bg-mist transition-colors group-hover:bg-ink group-hover:text-white">
                        <Plus className="size-4" aria-hidden />
                      </span>
                      Add a car
                    </button>
                  )}
                </motion.div>
              )}

              {/* Metric rows */}
              {METRICS.map((m) => {
                const values = selected.map(m.value);
                const best = m.higherIsBetter ? Math.max(...values) : null;
                const max = Math.max(...values, 1);
                return (
                  <Row key={m.label} label={m.label} trailing={selected.length < MAX}>
                    {selected.map((car, i) => {
                      const v = values[i];
                      const isBest = best !== null && v === best && values.filter((x) => x === best).length === 1;
                      return (
                        <motion.div layout key={`${m.label}-${car.slug}-${i}`} className="border-l border-t border-line px-4 py-4 text-[14px] md:px-5">
                          <div className={cn("font-medium num", isBest && "text-red")}>{m.display(car)}</div>
                          {m.bar && (
                            <div className="mt-2.5 h-[3px] bg-mist">
                              <motion.div
                                className={cn("h-full", isBest ? "bg-red" : "bg-ink")}
                                initial={{ width: 0 }}
                                whileInView={{ width: `${(v / max) * 100}%` }}
                                viewport={{ once: false }}
                                transition={{ duration: 0.9, ease: EASE }}
                              />
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </Row>
                );
              })}
            </div>
          </LayoutGroup>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-[13px] text-muted">
          <p>Specifications are manufacturer-claimed figures; &ldquo;{NOT_PUBLISHED}&rdquo; means not published. Leader in each measure shown in red.</p>
          <Link href="/compare" className="font-medium text-ink underline-offset-4 hover:underline">
            Browse popular comparisons
          </Link>
        </div>
      </div>
    </section>
  );
}

function Row({ label, children, trailing }: { label: string; children: React.ReactNode; trailing: boolean }) {
  return (
    <>
      <div className="flex items-center border-t border-line px-5 py-4 text-[13px] text-muted">{label}</div>
      {children}
      {trailing && <div className="border-l border-t border-line" />}
    </>
  );
}

function CarSelect({
  value,
  onChange,
  exclude,
  placeholder,
  autoOpen,
}: {
  value: string;
  onChange: (slug: string) => void;
  exclude: string[];
  placeholder?: string;
  autoOpen?: boolean;
}) {
  const { brands, carsByBrand, getCar, brandName } = useCatalog();
  const current = value ? getCar(value) : undefined;
  return (
    <div className="group relative mt-4">
      <label className="sr-only" htmlFor={`cmp-${value || "new"}`}>
        Choose car
      </label>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0">
          {current ? (
            <>
              <span className="block truncate text-[11.5px] text-muted">{brandName(current.brand)}</span>
              <span className="type-h4 block truncate">{current.name}</span>
            </>
          ) : (
            <span className="type-h4 block">{placeholder}</span>
          )}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-hover:translate-y-0.5" aria-hidden />
      </div>
      <select
        id={`cmp-${value || "new"}`}
        value={value}
        autoFocus={autoOpen}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {!value && <option value="">{placeholder}</option>}
        {brands.map((b) => {
          const line = carsByBrand(b.slug).filter((c) => c.slug === value || !exclude.includes(c.slug));
          return line.length ? (
            <optgroup key={b.slug} label={b.name}>
              {line.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {brandName(c.brand)} {c.name}
                </option>
              ))}
            </optgroup>
          ) : null;
        })}
      </select>
    </div>
  );
}
