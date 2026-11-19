"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Check, Plus, Search } from "lucide-react";
import type { CarModel } from "@/types";
import { formatPriceRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/ui/chip";
import { Modal } from "@/components/ui/overlay";
import { useCatalog } from "@/components/providers/catalog-provider";

/** Modal car chooser: search, brand chips and a thumbnail list. Suggests rivals of the cars already chosen. */
export function CarPicker({
  open,
  onClose,
  selected,
  onPick,
  max,
}: {
  open: boolean;
  onClose: () => void;
  selected: string[];
  onPick: (slug: string) => void;
  max: number;
}) {
  const { cars, brands, brandName } = useCatalog();
  const brandsWithCars = useMemo(() => brands.filter((b) => cars.some((c) => c.brand === b.slug)), [brands, cars]);
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("");
  const [wasOpen, setWasOpen] = useState(open);

  // Start fresh every time the picker opens.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setBrand("");
    }
  }

  const q = query.trim().toLowerCase();
  const matches = cars.filter((c) => {
    if (brand && c.brand !== brand) return false;
    if (!q) return true;
    const hay = `${brandName(c.brand)} ${c.name} ${c.bodyType}`.toLowerCase();
    return q.split(/\s+/).every((t) => hay.includes(t));
  });

  // With no query, lead with rivals of the cars already in the comparison.
  const rivals = !q && !brand ? Array.from(new Set(selected.flatMap((s) => cars.find((c) => c.slug === s)?.competitors ?? []))).filter((s) => !selected.includes(s)) : [];
  const suggested = rivals.map((s) => cars.find((c) => c.slug === s)).filter((c): c is CarModel => c !== undefined);
  const rest = matches.filter((c) => !rivals.includes(c.slug));

  return (
    <Modal open={open} onClose={onClose} title="Add a car to compare" description={`${selected.length} of ${max} slots filled`} size="lg">
      <div className="sticky top-0 z-10 border-b border-line bg-white px-5 pb-4 pt-5 sm:px-8">
        {/* TextField's `prefix` collides with the native string `prefix` attribute, so the icon is laid out here. */}
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            data-autofocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by model or brand"
            aria-label="Search cars"
            className="h-12 w-full rounded-[3px] border border-line bg-white pl-11 pr-4 text-[15px] text-ink outline-none transition-[border-color] duration-[250ms] placeholder:text-muted/70 hover:border-ink/30 focus:border-ink"
          />
        </div>
        <div className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5 sm:-mx-8 sm:px-8">
          <Chip selected={brand === ""} onClick={() => setBrand("")} className="h-8 px-3 text-[12.5px]">
            All brands
          </Chip>
          {brandsWithCars.map((b) => (
            <Chip key={b.slug} selected={brand === b.slug} onClick={() => setBrand(brand === b.slug ? "" : b.slug)} className="h-8 px-3 text-[12.5px]">
              {b.name}
            </Chip>
          ))}
        </div>
      </div>

      <div className="px-2 py-3 sm:px-4">
        {suggested.length > 0 && (
          <PickerSection title="Suggested rivals" items={suggested} selected={selected} onPick={onPick} full={selected.length >= max} />
        )}
        {rest.length > 0 ? (
          <PickerSection title={suggested.length ? "All cars" : `${rest.length} ${rest.length === 1 ? "car" : "cars"}`} items={rest} selected={selected} onPick={onPick} full={selected.length >= max} />
        ) : (
          suggested.length === 0 && <p className="px-4 py-12 text-center text-[14px] text-muted">No cars match &ldquo;{query}&rdquo;. Try a brand or model name.</p>
        )}
      </div>
    </Modal>
  );
}

function PickerSection({ title, items, selected, onPick, full }: { title: string; items: CarModel[]; selected: string[]; onPick: (slug: string) => void; full: boolean }) {
  const { brandName } = useCatalog();
  return (
    <div className="py-2">
      <p className="type-eyebrow px-3 pb-2 pt-3 text-muted">{title}</p>
      <ul>
        {items.map((c) => {
          const added = selected.includes(c.slug);
          return (
            <li key={c.slug}>
              <button
                type="button"
                disabled={added || full}
                onClick={() => onPick(c.slug)}
                className="group/pick flex w-full items-center gap-4 rounded-[3px] px-3 py-2.5 text-left transition-colors duration-[250ms] enabled:hover:bg-mist disabled:cursor-default"
              >
                <span className="relative h-12 w-16 shrink-0 overflow-hidden bg-mist">
                  <Image src={c.images[0]} alt="" fill sizes="64px" className="object-cover" style={{ objectPosition: c.focus ?? "50% 55%" }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-medium uppercase tracking-[0.12em] text-muted">{brandName(c.brand)}</span>
                  <span className="mt-0.5 block truncate text-[15px] font-medium">{c.name}</span>
                </span>
                <span className="hidden text-[13px] text-muted num sm:block">{formatPriceRange(c.priceMin, c.priceMax)}</span>
                <span
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-colors",
                    added ? "bg-mist text-muted" : full ? "text-muted/60" : "border border-ink/15 text-ink group-hover/pick:border-ink group-hover/pick:bg-ink group-hover/pick:text-white",
                  )}
                >
                  {added ? <Check aria-hidden className="size-3.5" /> : <Plus aria-hidden className="size-3.5" />}
                  {added ? "Added" : "Add"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
