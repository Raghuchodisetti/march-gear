"use client";

import Image from "next/image";
import { cardPhotoAlt } from "@/lib/image-alt";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Link2, MapPin, MoveHorizontal, Plus, X } from "lucide-react";
import type { CarModel } from "@/types";
import { formatPrice, formatPriceRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { Button, IconButton } from "@/components/ui/button";
import { useIsClient } from "@/components/ui/overlay";
import { Eyebrow, SectionHeading } from "@/components/ui/section-heading";
import { MAX_COMPARE, useCity, useCompare, useUI } from "@/components/providers/app-provider";
import { useCatalog } from "@/components/providers/catalog-provider";
import { carHref } from "@/components/vehicle/card-utils";
import { useQueryState } from "@/components/listing/use-query-state";
import { bestCells, buildGroups, rowDiffers, type SpecGroup, type SpecRow } from "./compare-rows";
import { CarPicker } from "./car-picker";
import { CompareSkeleton } from "./compare-skeleton";
import { PopularComparisonsSection } from "./popular-comparisons";

/* Shared column template: label + 4 slots on desktop; on mobile the label
   becomes a caption row and only filled slots (+1 "add") take a column. */
const GRID =
  "grid grid-cols-[repeat(var(--m),minmax(150px,1fr))] md:grid-cols-[168px_repeat(4,minmax(160px,1fr))] lg:grid-cols-[208px_repeat(4,minmax(0,1fr))]";
const MIN_W = "min-w-[calc(var(--m)*150px)] md:min-w-[808px] lg:min-w-0";
const HEADER_H = 73;

function sanitize(list: readonly string[], getCar: (slug: string) => CarModel | undefined) {
  return Array.from(new Set(list.map((s) => s.trim()).filter((s) => getCar(s) !== undefined))).slice(0, MAX_COMPARE);
}

export function CompareExperience() {
  const isClient = useIsClient();
  const { params, update } = useQueryState();
  const { slugs, set } = useCompare();
  const { city } = useCity();
  const { openEnquiry, toast, setLocationOpen } = useUI();
  const { getCar, brandName, onRoadPrice } = useCatalog();

  /* ── Source of truth: ?cars= when present, otherwise the compare store ── */
  const urlRaw = params.get("cars");
  const urlSlugs = useMemo(() => (urlRaw === null ? null : sanitize(urlRaw.split(","), getCar)), [urlRaw, getCar]);
  const active = useMemo(() => urlSlugs ?? sanitize(slugs, getCar), [urlSlugs, slugs, getCar]);
  const selected = useMemo(() => active.map((s) => getCar(s)).filter((c): c is CarModel => c !== undefined), [active, getCar]);
  const filled = selected.length;

  // URL → store: whenever the query string changes (first load, shared links, popular comparisons).
  const lastUrl = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (urlRaw === lastUrl.current) return;
    lastUrl.current = urlRaw;
    if (!urlSlugs) return;
    if (urlSlugs.join(",") !== slugs.join(",")) set(urlSlugs);
    // Normalise hand-edited links: drop unknown or duplicate slugs.
    if (urlRaw !== null && urlSlugs.join(",") !== urlRaw) update((p) => (urlSlugs.length ? p.set("cars", urlSlugs.join(",")) : p.delete("cars")));
  }, [urlRaw, urlSlugs, slugs, set, update]);

  // Store → URL: landing on /compare with no query mirrors the saved list into the URL.
  useEffect(() => {
    if (urlRaw === null && slugs.length > 0) update((p) => p.set("cars", sanitize(slugs, getCar).join(",")));
  }, [urlRaw, slugs, update, getCar]);

  const commit = useCallback(
    (next: string[]) => {
      const clean = sanitize(next, getCar);
      update((p) => (clean.length ? p.set("cars", clean.join(",")) : p.delete("cars")));
      set(clean);
    },
    [update, set, getCar],
  );

  /* ── UI state ── */
  const [pickerOpen, setPickerOpen] = useState(false);
  const [highlight, setHighlight] = useState(false);
  const [hideCommon, setHideCommon] = useState(false);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [showBar, setShowBar] = useState(false);

  const groups = useMemo(() => buildGroups(selected, { slug: city.slug, name: city.name }, onRoadPrice), [selected, city.slug, city.name, onRoadPrice]);
  const comparable = filled >= 2;
  const allRows = groups.flatMap((g) => g.rows);
  const diffCount = comparable ? allRows.filter(rowDiffers).length : 0;

  const slots: (CarModel | null)[] = Array.from({ length: MAX_COMPARE }, (_, i) => selected[i] ?? null);
  const layoutKey = slots.map((s) => s?.slug ?? "_").join("|");
  const vars = { "--m": Math.max(1, Math.min(MAX_COMPARE, filled + (filled < MAX_COMPARE ? 1 : 0))) } as CSSProperties;

  /* ── Sticky compact header: shown once the slot cards scroll away ── */
  const cardsRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const hasTable = isClient && filled > 0;

  useEffect(() => {
    if (!hasTable) return;
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const cards = cardsRef.current;
        const end = endRef.current;
        if (!cards || !end) return;
        setShowBar(cards.getBoundingClientRect().bottom < HEADER_H + 24 && end.getBoundingClientRect().top > HEADER_H + 160);
      });
    };
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [hasTable]);

  const attachBar = useCallback((el: HTMLDivElement | null) => {
    barRef.current = el;
    if (el && bodyRef.current) el.scrollLeft = bodyRef.current.scrollLeft;
  }, []);

  /* ── Actions ── */
  const add = (slug: string) => {
    commit([...active, slug]);
    setPickerOpen(false);
  };
  const remove = (car: CarModel) => {
    commit(active.filter((s) => s !== car.slug));
    toast(`${car.name} removed from comparison`);
  };
  const testDrive = (car: CarModel) => openEnquiry({ kind: "test-drive", subject: `${brandName(car.brand)} ${car.name}`, detail: `From ${formatPrice(car.priceMin)} · ex-showroom`, carSlug: car.slug });
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast("Comparison link copied", { tone: "success" });
    } catch {
      toast("Couldn't copy automatically — copy the link from the address bar", { tone: "error" });
    }
  };
  const toggleGroup = (id: string) => setCollapsed((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  const picker = <CarPicker open={pickerOpen} onClose={() => setPickerOpen(false)} selected={active} onPick={add} max={MAX_COMPARE} />;

  if (!isClient) return <CompareSkeleton />;

  /* ── Empty state ── */
  if (filled === 0) {
    return (
      <>
        <section className="container-x pb-20 pt-8 md:pb-28 md:pt-12">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
            {Array.from({ length: MAX_COMPARE }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPickerOpen(true)}
                className="group/slot flex aspect-[4/5] flex-col items-center justify-center gap-4 border border-dashed border-ink/20 text-ink transition-colors duration-[400ms] hover:border-ink md:aspect-[4/3]"
              >
                <span className="flex size-12 items-center justify-center rounded-full border border-ink/20 transition-colors duration-[250ms] group-hover/slot:border-ink group-hover/slot:bg-ink group-hover/slot:text-white">
                  <Plus aria-hidden className="size-5" />
                </span>
                <span className="text-[13px] font-medium">Add car {i + 1}</span>
              </button>
            ))}
          </div>
          <p className="mt-6 max-w-xl text-[14px] leading-relaxed text-muted">
            Choose up to four new cars. We&rsquo;ll line up price, performance, efficiency, space, safety and every feature — and flag the best value in each row.
          </p>
        </section>
        <PopularComparisonsSection
          heading={<SectionHeading eyebrow="Popular comparisons" title="Or start with a classic rivalry" description="Tap a pairing to load it instantly. You can swap cars in and out afterwards." />}
        />
        {picker}
      </>
    );
  }

  /* ── Comparison ── */
  return (
    <>
      <section className="container-x pb-16 pt-8 md:pb-24 md:pt-12">
        {/* Controls */}
        <div className="flex flex-col gap-4 border-y border-line py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
            <Switch checked={highlight} onChange={setHighlight} disabled={!comparable} label="Highlight differences" />
            <Switch checked={hideCommon} onChange={setHideCommon} disabled={!comparable} label="Hide common specs" />
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px]">
            <span className="text-muted num" aria-live="polite">
              {comparable ? `${diffCount} of ${allRows.length} specs differ` : "Add one more car to see differences"}
            </span>
            <button type="button" onClick={() => setLocationOpen(true)} className="inline-flex items-center gap-1.5 font-medium transition-colors hover:text-red">
              <MapPin aria-hidden className="size-3.5" />
              On-road: {city.name}
            </button>
            <button type="button" onClick={share} className="inline-flex items-center gap-1.5 font-medium transition-colors hover:text-red">
              <Link2 aria-hidden className="size-3.5" />
              Share
            </button>
            {filled < MAX_COMPARE && (
              <button type="button" onClick={() => setPickerOpen(true)} className="inline-flex items-center gap-1.5 font-medium transition-colors hover:text-red">
                <Plus aria-hidden className="size-3.5" />
                Add car
              </button>
            )}
            <button type="button" onClick={() => commit([])} className="font-medium text-muted transition-colors hover:text-red">
              Clear all
            </button>
          </div>
        </div>

        {filled >= 2 && (
          <p className="mt-5 flex items-center gap-2 text-[12px] text-muted md:hidden">
            <MoveHorizontal aria-hidden className="size-3.5" /> Swipe sideways to see every column
          </p>
        )}

        {/* Table */}
        <div
          ref={bodyRef}
          onScroll={(e) => {
            if (barRef.current) barRef.current.scrollLeft = e.currentTarget.scrollLeft;
          }}
          className="relative mt-6 snap-x snap-proximity overflow-x-auto overscroll-x-contain md:mt-8 md:snap-none"
        >
          <div className={MIN_W} style={vars}>
            {/* Slot cards */}
            <div ref={cardsRef} className={cn(GRID, "relative pb-10")}>
              <div className="hidden flex-col justify-end pb-1 pr-6 md:sticky md:left-0 md:z-10 md:flex md:bg-white">
                <Eyebrow className="text-muted">Comparing</Eyebrow>
                <p className="mt-4 font-display text-[44px] font-semibold leading-none tracking-[-0.045em] [font-stretch:108%] num">
                  {filled}
                  <span className="text-ink/50">/{MAX_COMPARE}</span>
                </p>
                <p className="mt-4 text-[12px] leading-relaxed text-muted">Ex-showroom and on-road prices are indicative demo data.</p>
              </div>
              <AnimatePresence mode="popLayout" initial={false}>
                {slots.map((car, i) =>
                  car ? (
                    <motion.div
                      key={car.slug}
                      layout="position"
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.25 } }}
                      transition={{ duration: 0.55, ease: EASE }}
                      className="min-w-0 snap-start border-l border-line px-3 md:px-5"
                    >
                      <SlotCard car={car} onRemove={() => remove(car)} onTestDrive={() => testDrive(car)} />
                    </motion.div>
                  ) : (
                    <motion.div
                      key={`empty-${i}`}
                      layout="position"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.15 } }}
                      transition={{ duration: 0.4, ease: EASE }}
                      className={cn("min-w-0 snap-start border-l border-line px-3 md:px-5", i > filled && "hidden md:block")}
                    >
                      <button
                        type="button"
                        onClick={() => setPickerOpen(true)}
                        className="group/add flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 border border-dashed border-ink/20 text-[13px] font-medium text-muted transition-colors duration-[400ms] hover:border-ink hover:text-ink"
                      >
                        <span className="flex size-10 items-center justify-center rounded-full border border-current transition-colors duration-[250ms] group-hover/add:bg-ink group-hover/add:text-white">
                          <Plus aria-hidden className="size-4" />
                        </span>
                        Add a car
                      </button>
                      <p className="mt-4 text-[12px] text-muted">Slot {i + 1} of {MAX_COMPARE}</p>
                    </motion.div>
                  ),
                )}
              </AnimatePresence>
            </div>

            {/* Spec groups */}
            {groups.map((group) => (
              <GroupView
                key={group.id}
                group={group}
                slots={slots}
                filled={filled}
                layoutKey={layoutKey}
                comparable={comparable}
                highlight={highlight}
                hideCommon={hideCommon}
                collapsed={collapsed.includes(group.id)}
                onToggle={() => toggleGroup(group.id)}
              />
            ))}
            <div ref={endRef} />
          </div>
        </div>

        <p className="mt-8 max-w-3xl text-[12px] leading-relaxed text-muted">
          Specifications are manufacturer-claimed figures and may vary by variant. The red marker flags the strongest figure in rows where more is better (or less, for price and acceleration). All prices are indicative demo data, not quotes.
        </p>
      </section>

      <PopularComparisonsSection
        exclude={active.join(",")}
        heading={<SectionHeading eyebrow="Popular comparisons" title="More rivalries worth settling" action={{ label: "Browse all new cars", href: "/new-cars" }} />}
      />

      {/* Compact sticky header */}
      <AnimatePresence>
        {showBar && hasTable && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="fixed inset-x-0 top-[73px] z-40 border-b border-line bg-white/95 backdrop-blur-md"
          >
            <div className="container-x">
              <div ref={attachBar} className="overflow-hidden">
                <div className={cn(GRID, MIN_W)} style={vars}>
                  <div className="hidden items-center pr-5 md:sticky md:left-0 md:z-10 md:flex md:bg-white">
                    <Switch checked={highlight} onChange={setHighlight} disabled={!comparable} label="Differences" small />
                  </div>
                  {slots.map((car, i) =>
                    car ? (
                      <div key={car.slug} className="flex min-w-0 items-center gap-3 border-l border-line px-3 py-3 md:px-5">
                        <span className="relative hidden h-9 w-12 shrink-0 overflow-hidden bg-mist sm:block">
                          <Image src={car.images[0]} alt="" fill sizes="48px" className="object-cover" style={{ objectPosition: car.focus ?? "50% 55%" }} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold">{car.name}</span>
                          <span className="block truncate text-[11.5px] text-muted num">{formatPrice(car.priceMin)} onwards</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => remove(car)}
                          aria-label={`Remove ${car.name} from comparison`}
                          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-mist hover:text-ink"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div key={`empty-${i}`} className={cn("flex items-center border-l border-line px-3 py-3 md:px-5", i > filled && "hidden md:flex")}>
                        <button type="button" onClick={() => setPickerOpen(true)} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-ink">
                          <Plus aria-hidden className="size-3.5" /> Add a car
                        </button>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {picker}
    </>
  );
}

/* ── Pieces ──────────────────────────────────────────────────── */

function SlotCard({ car, onRemove, onTestDrive }: { car: CarModel; onRemove: () => void; onTestDrive: () => void }) {
  const { brandName } = useCatalog();
  const title = `${brandName(car.brand)} ${car.name}`;
  return (
    <div>
      <div className="relative aspect-[4/3] overflow-hidden bg-mist">
        <Image
          src={car.images[0]}
          alt={cardPhotoAlt(car.images[0], title)}
          fill
          sizes="(min-width: 1024px) 20vw, (min-width: 768px) 22vw, 45vw"
          className="object-cover"
          style={{ objectPosition: car.focus ?? "50% 55%" }}
        />
        <IconButton tone="glass" size="sm" onClick={onRemove} aria-label={`Remove ${title} from comparison`} className="absolute right-2 top-2">
          <X className="size-4" />
        </IconButton>
      </div>
      <p className="type-eyebrow mt-4 truncate text-muted">{brandName(car.brand)}</p>
      <h3 className="type-h4 mt-2">
        <Link href={carHref(car)} className="transition-colors duration-[250ms] hover:text-red">
          {car.name}
        </Link>
      </h3>
      <p className="mt-2 text-[14px] font-semibold num">{formatPriceRange(car.priceMin, car.priceMax)}</p>
      <p className="mt-0.5 text-[11px] text-muted">Ex-showroom · indicative</p>
      <div className="mt-5 flex flex-col gap-2">
        <Button size="sm" variant="outline" href={carHref(car)} className="w-full">
          View car
        </Button>
        <Button size="sm" variant="dark" onClick={onTestDrive} className="w-full">
          <span className="lg:hidden">Test drive</span>
          <span className="hidden lg:inline">Book test drive</span>
        </Button>
      </div>
    </div>
  );
}

function GroupView({
  group,
  slots,
  filled,
  layoutKey,
  comparable,
  highlight,
  hideCommon,
  collapsed,
  onToggle,
}: {
  group: SpecGroup;
  slots: (CarModel | null)[];
  filled: number;
  layoutKey: string;
  comparable: boolean;
  highlight: boolean;
  hideCommon: boolean;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const rows = hideCommon && comparable ? group.rows.filter(rowDiffers) : group.rows;
  const hidden = group.rows.length - rows.length;

  return (
    <div className="mt-10 md:mt-14">
      <button type="button" onClick={onToggle} aria-expanded={!collapsed} className="group/gh flex w-full items-center border-b border-ink pb-3.5 text-left">
        <span className="sticky left-0 flex items-center gap-3 bg-white pr-4">
          <span aria-hidden className="h-px w-6 bg-red" />
          <span className="type-eyebrow">{group.title}</span>
          <span className="text-[12px] text-muted num">{hidden > 0 ? `${rows.length} of ${group.rows.length}` : rows.length}</span>
          <ChevronDown aria-hidden className={cn("size-4 text-muted transition-transform duration-[350ms] group-hover/gh:text-ink", collapsed && "-rotate-90")} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="rows"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="overflow-clip"
          >
            <AnimatePresence initial={false}>
              {rows.map((r) => (
                <RowView key={r.id} row={r} slots={slots} filled={filled} layoutKey={layoutKey} comparable={comparable} highlight={highlight} />
              ))}
            </AnimatePresence>
            {rows.length === 0 && (
              <p className="sticky left-0 w-max py-5 text-[13px] text-muted">Identical across every car — {hidden} common {hidden === 1 ? "spec" : "specs"} hidden.</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RowView({
  row,
  slots,
  filled,
  layoutKey,
  comparable,
  highlight,
}: {
  row: SpecRow;
  slots: (CarModel | null)[];
  filled: number;
  layoutKey: string;
  comparable: boolean;
  highlight: boolean;
}) {
  const differs = comparable && rowDiffers(row);
  const best = comparable ? bestCells(row) : new Set<number>();
  const marked = highlight && differs;
  const dim = highlight && comparable && !differs;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      className="overflow-clip"
    >
      <div className={cn(GRID, "border-b border-line transition-colors duration-[400ms]", marked && "bg-mist")}>
        {/* Mobile caption */}
        <div className="col-span-full pt-3.5 md:hidden">
          <span className={cn("sticky left-0 inline-flex items-center gap-2 pl-3 text-[12px] font-medium", marked ? "text-ink" : "text-muted", dim && "opacity-40")}>
            {marked && <span aria-hidden className="size-1.5 rounded-full bg-red" />}
            {row.label}
          </span>
        </div>
        {/* Desktop label */}
        <div className={cn("hidden py-4 pr-5 transition-opacity duration-[400ms] md:sticky md:left-0 md:z-10 md:block", marked ? "md:bg-mist" : "md:bg-white", dim && "opacity-40")}>
          <p className={cn("flex items-start gap-2 text-[13.5px]", marked ? "font-medium text-ink" : "text-muted")}>
            {marked && <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-red" />}
            {row.label}
          </p>
          {row.hint && <p className="mt-1 text-[11.5px] leading-snug text-muted">{row.hint}</p>}
        </div>
        {slots.map((car, i) =>
          car ? (
            <motion.div
              key={car.slug}
              layout="position"
              layoutDependency={layoutKey}
              initial={{ opacity: 0 }}
              animate={{ opacity: dim ? 0.4 : 1 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="min-w-0 border-l border-line px-3 pb-3.5 pt-1.5 text-[14px] md:px-5 md:py-4"
            >
              <div className={cn("flex items-start gap-2", best.has(i) && "font-semibold")}>
                {best.has(i) && (
                  <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-red" title="Best in this comparison">
                    <span className="sr-only">Best in this comparison:</span>
                  </span>
                )}
                <div className="min-w-0 flex-1 break-words num">{row.cells[i]?.display}</div>
              </div>
            </motion.div>
          ) : (
            <div key={`empty-${i}`} className={cn("border-l border-line", i > filled && "hidden md:block")} />
          ),
        )}
      </div>
    </motion.div>
  );
}

function Switch({ checked, onChange, label, disabled, small }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; small?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("inline-flex items-center gap-3 font-medium text-ink disabled:cursor-not-allowed disabled:opacity-40", small ? "text-[12px]" : "text-[13px]")}
    >
      <span aria-hidden className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors duration-[250ms]", checked ? "bg-red" : "bg-ink/15")}>
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-white transition-transform duration-[250ms] ease-[var(--ease-premium)]",
            checked ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </span>
      {label}
    </button>
  );
}
