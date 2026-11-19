"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, SlidersHorizontal, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { Counter } from "@/components/ui/reveal";
import { BrandMonogram } from "@/components/ui/page-header";
import { ActiveFilters, SortSelect, type ActiveFilter, type SortConfig } from "./filter-ui";

/* ──────────────────────────────────────────────────────────────
   Visual filter bar: pills across the top of the results, each
   opening a picture-led panel. Replaces the checkbox sidebar.
   ────────────────────────────────────────────────────────────── */

export interface Facet {
  key: string;
  label: string;
  /** Short description of the current selection, e.g. "SUVs, MUVs" */
  summary?: string;
  activeCount: number;
  content: ReactNode;
  onClear?: () => void;
}

export function FilterBar({
  facets,
  activeFilters,
  onClearAll,
  resultCount,
  noun = ["car", "cars"],
  sort,
  toolbar,
  children,
  className,
}: {
  facets: Facet[];
  activeFilters: ActiveFilter[];
  onClearAll: () => void;
  resultCount: number;
  noun?: [string, string];
  sort?: SortConfig;
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const word = resultCount === 1 ? noun[0] : noun[1];
  const current = facets.find((f) => f.key === open);
  const totalActive = activeFilters.length;

  // Close the desktop panel on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!bar.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (key: string) => {
    // Desktop: inline panel. Mobile: bottom sheet.
    if (window.matchMedia("(min-width: 768px)").matches) setOpen((o) => (o === key ? null : key));
    else {
      setOpen(key);
      setSheet(true);
    }
  };

  return (
    <div className={className}>
      <div ref={bar} className="sticky top-[73px] z-30 border-y border-line bg-white/95 backdrop-blur-md">
        <div className="container-x flex items-center gap-3 py-3">
          <div className="no-scrollbar -ml-1 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1 pl-1">
            <span className="mr-1 hidden items-center gap-2 text-[13px] font-medium text-muted lg:inline-flex">
              <SlidersHorizontal aria-hidden className="size-4" />
              Filter
            </span>
            {facets.map((f) => {
              const on = f.activeCount > 0;
              const expanded = open === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  aria-expanded={expanded}
                  aria-haspopup="dialog"
                  onClick={() => pick(f.key)}
                  className={cn(
                    "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-[13.5px] font-medium transition-[background-color,border-color,color,box-shadow] duration-[250ms]",
                    on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink/40",
                    expanded && !on && "border-ink shadow-[0_0_0_1px_var(--color-ink)]",
                  )}
                >
                  <span className="whitespace-nowrap">{f.label}</span>
                  {on && f.summary && <span className="max-w-[11rem] truncate font-normal text-white/70">· {f.summary}</span>}
                  <ChevronDown aria-hidden className={cn("size-3.5 shrink-0 transition-transform duration-[350ms]", expanded && "rotate-180", on ? "text-white/70" : "text-muted")} />
                </button>
              );
            })}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {toolbar}
            {sort && <SortSelect sort={sort} className="hidden w-52 lg:block" />}
          </div>
        </div>

        {/* Desktop panel */}
        <AnimatePresence>
          {current && !sheet && (
            <motion.div
              key="panel"
              role="dialog"
              aria-label={`${current.label} filter`}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.18 } }}
              transition={{ duration: 0.35, ease: EASE }}
              className="absolute inset-x-0 top-full hidden border-b border-line bg-white shadow-[0_24px_48px_-24px_rgb(17_17_17/0.2)] md:block"
            >
              <div className="container-x py-8">
                <div className="mb-6 flex items-baseline justify-between gap-6">
                  <p className="type-h3">{current.label}</p>
                  <button type="button" onClick={() => setOpen(null)} aria-label="Close" className="-mr-2 inline-flex size-9 items-center justify-center rounded-full hover:bg-mist">
                    <X className="size-4" />
                  </button>
                </div>
                {current.content}
                <div className="mt-8 flex items-center justify-between gap-4 border-t border-line pt-5">
                  <button
                    type="button"
                    onClick={current.onClear}
                    disabled={!current.onClear || current.activeCount === 0}
                    className="text-[13px] font-medium text-muted underline-offset-4 transition-colors hover:text-ink hover:underline disabled:pointer-events-none disabled:opacity-40"
                  >
                    Clear {current.label.toLowerCase()}
                  </button>
                  <Button variant="dark" size="sm" onClick={() => setOpen(null)}>
                    Show {resultCount} {word}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="container-x pb-20 pt-8 md:pb-28 md:pt-10">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <p className="flex items-baseline gap-2">
            <Counter to={resultCount} duration={0.8} className="font-display text-[32px] font-semibold leading-none tracking-[-0.03em] num" />
            <span aria-hidden className="text-[14px] text-muted">
              {word}
            </span>
            <span className="sr-only" aria-live="polite">
              {resultCount} {word} found
            </span>
          </p>
          {sort && <SortSelect sort={sort} className="w-full sm:w-56 lg:hidden" />}
        </div>
        <ActiveFilters items={activeFilters} onClear={onClearAll} className="pt-4" />
        <div className="mt-8">{children}</div>
      </div>

      {/* Mobile sheet: every facet stacked, current one first */}
      <Drawer
        open={sheet}
        onClose={() => {
          setSheet(false);
          setOpen(null);
        }}
        side="bottom"
        title={totalActive > 0 ? `Filters (${totalActive})` : "Filters"}
        footer={
          <div className="flex gap-3 pb-[env(safe-area-inset-bottom)]">
            <Button variant="outline" onClick={onClearAll} disabled={totalActive === 0}>
              Clear all
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setSheet(false);
                setOpen(null);
              }}
            >
              Show {resultCount} {word}
            </Button>
          </div>
        }
      >
        <div className="divide-y divide-line px-5">
          {[...facets].sort((a, b) => Number(b.key === open) - Number(a.key === open)).map((f) => (
            <section key={f.key} className="py-6">
              <p className="type-h4 mb-4">{f.label}</p>
              {f.content}
            </section>
          ))}
        </div>
      </Drawer>
    </div>
  );
}

/* ── Visual option sets ──────────────────────────────────────── */

export interface TileOption {
  value: string;
  label: string;
  count?: number;
  /** Photo for "image" tiles */
  image?: string;
  imageFocus?: string;
  icon?: LucideIcon;
  hint?: string;
}

function SelectedMark() {
  return (
    <span aria-hidden className="absolute right-2.5 top-2.5 inline-flex size-5 items-center justify-center rounded-full bg-red text-white">
      <Check className="size-3" strokeWidth={3} />
    </span>
  );
}

/** Photographic tiles — body types, categories. */
export function ImageTiles({ options, selected, onToggle }: { options: TileOption[]; selected: readonly string[]; onToggle: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {options.map((o) => {
        const on = selected.includes(o.value);
        const disabled = !on && o.count === 0;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onToggle(o.value)}
            className={cn(
              "group/tile relative overflow-hidden text-left outline-offset-2 transition-opacity disabled:opacity-35",
              on ? "ring-2 ring-ink" : "ring-1 ring-line hover:ring-ink/40",
            )}
          >
            <span className="relative block aspect-[4/3] overflow-hidden bg-mist">
              {o.image && (
                <Image
                  src={o.image}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 16vw, (min-width: 640px) 30vw, 45vw"
                  className="object-cover transition-transform duration-[700ms] ease-[var(--ease-premium)] group-hover/tile:scale-[1.06]"
                  style={{ objectPosition: o.imageFocus ?? "50% 55%" }}
                />
              )}
              <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />
              <span className="absolute inset-x-3 bottom-2.5 text-white">
                <span className="block font-display text-[15px] font-semibold tracking-[-0.01em]">{o.label}</span>
                {o.count !== undefined && <span className="text-[11.5px] text-white/70 num">{o.count} available</span>}
              </span>
            </span>
            {on && <SelectedMark />}
          </button>
        );
      })}
    </div>
  );
}

/** Icon tiles — fuel, gearbox, seating. */
export function IconTiles({ options, selected, onToggle, columns = 5 }: { options: TileOption[]; selected: readonly string[]; onToggle: (v: string) => void; columns?: number }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3", columns >= 5 ? "sm:grid-cols-3 lg:grid-cols-5" : columns === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
      {options.map((o) => {
        const on = selected.includes(o.value);
        const disabled = !on && o.count === 0;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onToggle(o.value)}
            className={cn(
              "relative flex min-h-[104px] flex-col justify-between border p-4 text-left transition-[background-color,border-color] duration-[250ms] disabled:opacity-35",
              on ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/40 hover:bg-mist/50",
            )}
          >
            {Icon && (
              <span className={cn("inline-flex size-10 items-center justify-center rounded-full", on ? "bg-white/10" : "bg-mist")}>
                <Icon aria-hidden className={cn("size-[18px]", on ? "text-white" : "text-ink")} />
              </span>
            )}
            <span className="mt-4 block">
              <span className="block text-[15px] font-medium">{o.label}</span>
              <span className={cn("block text-[12px] num", on ? "text-white/60" : "text-muted")}>
                {o.hint ?? (o.count !== undefined ? `${o.count} available` : "")}
              </span>
            </span>
            {on && <SelectedMark />}
          </button>
        );
      })}
    </div>
  );
}

/** Large typographic tiles — price bands, ranges, years. */
export function ValueTiles({ options, selected, onToggle }: { options: TileOption[]; selected: readonly string[]; onToggle: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {options.map((o) => {
        const on = selected.includes(o.value);
        const disabled = !on && o.count === 0;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onToggle(o.value)}
            className={cn(
              "relative flex min-h-[96px] flex-col justify-between border p-4 text-left transition-[background-color,border-color] duration-[250ms] disabled:opacity-35",
              on ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/40 hover:bg-mist/50",
            )}
          >
            <span className="font-display text-[18px] font-semibold leading-tight tracking-[-0.02em] num">{o.label}</span>
            <span className={cn("mt-3 block text-[12px] num", on ? "text-white/60" : "text-muted")}>
              {o.hint ?? (o.count !== undefined ? `${o.count} ${o.count === 1 ? "match" : "matches"}` : "")}
            </span>
            {on && <SelectedMark />}
          </button>
        );
      })}
    </div>
  );
}

/** Brand marks with counts. */
export function BrandTiles({ options, selected, onToggle }: { options: TileOption[]; selected: readonly string[]; onToggle: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
      {options.map((o) => {
        const on = selected.includes(o.value);
        const disabled = !on && o.count === 0;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onToggle(o.value)}
            className={cn(
              "relative flex items-center gap-3 border p-3 text-left transition-[background-color,border-color] duration-[250ms] disabled:opacity-35",
              on ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/40",
            )}
          >
            <BrandMonogram name={o.label} className={cn("size-9 shrink-0 text-[12px]", on && "bg-white/15 text-white")} />
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-medium">{o.label}</span>
              {o.count !== undefined && <span className={cn("block text-[11.5px] num", on ? "text-white/60" : "text-muted")}>{o.count}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Summary helper: "SUVs" / "SUVs, MUVs" / "SUVs +2". */
export function summarise(labels: string[]) {
  if (labels.length === 0) return undefined;
  if (labels.length <= 2) return labels.join(", ");
  return `${labels[0]} +${labels.length - 1}`;
}
