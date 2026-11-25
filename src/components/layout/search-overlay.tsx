"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, CornerDownLeft, Search, X } from "lucide-react";
import type { Catalog } from "@/lib/catalog";
import { formatPrice, formatPriceRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { useDialogBehaviour, useIsClient } from "@/components/ui/overlay";
import { useUI } from "@/components/providers/app-provider";
import { useCatalog } from "@/components/providers/catalog-provider";

interface Result {
  id: string;
  group: "New cars" | "Used cars" | "Brands" | "Stories";
  title: string;
  meta: string;
  href: string;
  image?: string;
}

const POPULAR = [
  { label: "SUVs under ₹15 lakh", href: "/new-cars?body=suv&budget=8-15" },
  { label: "Electric cars", href: "/electric-cars" },
  { label: "7-seaters", href: "/new-cars?seats=7" },
  { label: "Automatic hatchbacks", href: "/new-cars?body=hatchback&transmission=automatic" },
  { label: "Verified used cars", href: "/used-cars?verified=1" },
  { label: "Upcoming launches", href: "/upcoming-cars" },
];

function search(query: string, { cars, usedCars, brands, articles, brandName }: Catalog): Result[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const terms = q.split(/\s+/);
  const match = (hay: string) => terms.every((t) => hay.toLowerCase().includes(t));

  const newCars: Result[] = cars
    .filter((c) => match(`${brandName(c.brand)} ${c.name} ${c.bodyType} ${c.fuelTypes.join(" ")}`))
    .slice(0, 5)
    .map((c) => ({
      id: `car-${c.slug}`,
      group: "New cars",
      title: `${brandName(c.brand)} ${c.name}`,
      meta: `${c.bodyType} · ${formatPriceRange(c.priceMin, c.priceMax)}`,
      href: `/cars/${c.slug}`,
      image: c.images[0],
    }));

  const used: Result[] = usedCars
    .filter((c) => match(`${brandName(c.brand)} ${c.name} ${c.variant} ${c.city} ${c.year}`))
    .slice(0, 3)
    .map((c) => ({
      id: `used-${c.id}`,
      group: "Used cars",
      title: `${c.year} ${brandName(c.brand)} ${c.name}`,
      meta: `${c.city} · ${formatPrice(c.price)}`,
      href: `/used-cars/${c.id}`,
      image: c.images[0],
    }));

  const brandHits: Result[] = brands
    .filter((b) => match(b.name))
    .slice(0, 3)
    .map((b) => ({ id: `brand-${b.slug}`, group: "Brands", title: b.name, meta: b.tagline, href: `/brands/${b.slug}` }));

  const stories: Result[] = articles
    .filter((a) => match(`${a.title} ${a.tags.join(" ")} ${a.category}`))
    .slice(0, 3)
    .map((a) => ({ id: `story-${a.slug}`, group: "Stories", title: a.title, meta: a.category, href: `/news/${a.slug}`, image: a.image }));

  return [...newCars, ...brandHits, ...used, ...stories];
}

export function SearchOverlay() {
  const { searchOpen, setSearchOpen } = useUI();
  const isClient = useIsClient();
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const catalog = useCatalog();
  const { cars, brandName } = catalog;

  const close = () => {
    setSearchOpen(false);
    setQuery("");
    setCursor(0);
  };
  useDialogBehaviour(searchOpen, close, panel);

  const results = useMemo(() => search(query, catalog), [query, catalog]);
  const groups = useMemo(() => {
    const map = new Map<string, Result[]>();
    results.forEach((r) => map.set(r.group, [...(map.get(r.group) ?? []), r]));
    return Array.from(map.entries());
  }, [results]);

  const go = (href: string) => {
    close();
    router.push(href);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(results.length - 1, c + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[cursor]) go(results[cursor].href);
      else if (query.trim()) go(`/new-cars?q=${encodeURIComponent(query.trim())}`);
    }
  };

  if (!isClient) return null;
  let flatIndex = -1;

  return createPortal(
    <AnimatePresence>
      {searchOpen && (
        <div className="fixed inset-0 z-[85]">
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-ink/50 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={close}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            tabIndex={-1}
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="relative max-h-[100dvh] overflow-y-auto bg-white shadow-lift outline-none"
          >
            <div className="container-x py-5 md:py-8">
              <div className="flex items-center gap-4 border-b-2 border-ink pb-4">
                <Search className="size-6 shrink-0" aria-hidden />
                <input
                  data-autofocus
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setCursor(0);
                  }}
                  onKeyDown={onKeyDown}
                  placeholder="Search a model, brand, city or story"
                  aria-label="Search March Gear"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-controls="search-results"
                  aria-expanded={results.length > 0}
                  aria-activedescendant={results[cursor] ? `search-option-${results[cursor].id}` : undefined}
                  className="min-w-0 flex-1 bg-transparent font-display text-2xl font-medium tracking-[-0.02em] outline-none placeholder:text-muted md:text-4xl"
                />
                <button type="button" onClick={close} aria-label="Close search" className="inline-flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-mist">
                  <X className="size-5" />
                </button>
              </div>

              <p className="sr-only" aria-live="polite">
                {query.trim().length < 2 ? "" : results.length ? `${results.length} result${results.length === 1 ? "" : "s"}. Use the up and down arrows to choose, Enter to open.` : "No matches."}
              </p>

              {query.trim().length < 2 ? (
                <div className="grid grid-cols-1 gap-10 py-8 md:grid-cols-[1fr_1.2fr]">
                  <div>
                    <p className="type-eyebrow text-muted">Popular searches</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {POPULAR.map((p) => (
                        <Link key={p.href} href={p.href} onClick={close} className="rounded-full border border-line px-4 py-2 text-[13px] transition-colors hover:border-ink hover:bg-ink hover:text-white">
                          {p.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="type-eyebrow text-muted">Trending models</p>
                    <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {cars
                        .filter((c) => c.trending)
                        .slice(0, 6)
                        .map((c) => (
                          <li key={c.slug}>
                            <Link href={`/cars/${c.slug}`} onClick={close} className="group flex items-center gap-3 p-2 transition-colors hover:bg-mist">
                              <span className="relative size-12 shrink-0 overflow-hidden bg-mist">
                                <Image src={c.images[0]} alt="" fill sizes="48px" className="object-cover" />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-[14px] font-medium">
                                  {brandName(c.brand)} {c.name}
                                </span>
                                <span className="block text-[12px] text-muted num">{formatPriceRange(c.priceMin, c.priceMax)}</span>
                              </span>
                            </Link>
                          </li>
                        ))}
                    </ul>
                  </div>
                </div>
              ) : results.length === 0 ? (
                <div className="py-14 text-center">
                  <p className="type-h3">No matches for “{query}”</p>
                  <p className="mt-2 text-muted">Try a brand, model or body type — or browse all cars.</p>
                  <Link href="/new-cars" onClick={close} className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline">
                    Browse all new cars <ArrowUpRight className="size-4 text-red" />
                  </Link>
                </div>
              ) : (
                <div id="search-results" className="grid grid-cols-1 gap-8 py-8 md:grid-cols-2" role="listbox" aria-label="Search results">
                  {groups.map(([group, items]) => (
                    <div key={group} role="group" aria-labelledby={`search-group-${group.replace(/\W+/g, "-")}`}>
                      <p id={`search-group-${group.replace(/\W+/g, "-")}`} className="type-eyebrow text-muted">
                        {group}
                      </p>
                      <ul role="none" className="mt-3">
                        {items.map((r) => {
                          flatIndex += 1;
                          const idx = flatIndex;
                          const activeRow = idx === cursor;
                          return (
                            <li key={r.id} role="none">
                              <Link
                                id={`search-option-${r.id}`}
                                role="option"
                                aria-selected={activeRow}
                                tabIndex={-1}
                                href={r.href}
                                onClick={close}
                                onMouseEnter={() => setCursor(idx)}
                                className={cn("flex items-center gap-3 px-2 py-2.5 transition-colors", activeRow && "bg-mist")}
                              >
                                {r.image ? (
                                  <span className="relative size-12 shrink-0 overflow-hidden bg-mist">
                                    <Image src={r.image} alt="" fill sizes="48px" className="object-cover" />
                                  </span>
                                ) : (
                                  <span className="flex size-12 shrink-0 items-center justify-center bg-mist font-display text-sm font-semibold">{r.title.slice(0, 2)}</span>
                                )}
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[14px] font-medium">{r.title}</span>
                                  <span className="block truncate text-[12px] text-muted">{r.meta}</span>
                                </span>
                                {activeRow && <CornerDownLeft className="size-4 shrink-0 text-muted" aria-hidden />}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              <div className="hidden items-center gap-5 border-t border-line pt-4 text-[12px] text-muted md:flex">
                <span><kbd className="rounded-[3px] bg-mist px-1.5 py-0.5">↑</kbd> <kbd className="rounded-[3px] bg-mist px-1.5 py-0.5">↓</kbd> to navigate</span>
                <span><kbd className="rounded-[3px] bg-mist px-1.5 py-0.5">Enter</kbd> to open</span>
                <span><kbd className="rounded-[3px] bg-mist px-1.5 py-0.5">Esc</kbd> to close</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
