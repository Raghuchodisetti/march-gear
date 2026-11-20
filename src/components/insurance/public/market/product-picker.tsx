"use client";

import { useMemo, useState } from "react";
import { Check, Plus, Search, SlidersHorizontal } from "lucide-react";
import { Drawer } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PricingConfig } from "@/insurance/estimator";
import { INS_PRODUCT_CATEGORY_LABEL } from "@/insurance/labels";
import { EMPTY_FILTERS, estimateProduct, offersAddOn, productProblems, termLabel, type MarketFilters, type MarketProduct, type MarketVehicle } from "./engine";
import { FilterPanel, activeFilterCount, filterOptions, niceBounds } from "./filters";
import { CompanyLogo, inr } from "./ui";

/** The compare page's "add or remove plans" drawer: search, filters and the list of public plans. */
export function ProductPicker({
  open,
  onClose,
  products,
  selected,
  max,
  onToggle,
  vehicle,
  config,
  addOns,
  onAddOns,
}: {
  open: boolean;
  onClose: () => void;
  products: MarketProduct[];
  selected: string[];
  max: number;
  onToggle: (p: MarketProduct) => void;
  vehicle: MarketVehicle | null;
  config: PricingConfig;
  /** The add-ons chosen on the page (filter + estimate). */
  addOns: string[];
  onAddOns: (keys: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const [rest, setRest] = useState<Omit<MarketFilters, "addOns">>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const filters: MarketFilters = { ...rest, addOns };
  const setFilters = (f: MarketFilters) => {
    const { addOns: next, ...others } = f;
    setRest(others);
    if (next.join() !== addOns.join()) onAddOns(next);
  };

  const rows = useMemo(
    () =>
      products.map((p) => {
        const problems = vehicle ? productProblems(p, vehicle) : [];
        const est = vehicle && !problems.length ? estimateProduct(p, vehicle, { addOns }, config).estimate : null;
        return { p, problems, est };
      }),
    [products, vehicle, addOns, config],
  );
  const options = useMemo(() => filterOptions(products), [products]);
  const premiumBounds = useMemo(() => (vehicle ? niceBounds(rows.flatMap((r) => (r.est ? [r.est.total] : [])), 500) : null), [rows, vehicle]);
  const idvBounds = useMemo(() => (vehicle ? niceBounds(rows.flatMap((r) => (r.est && r.est.odYears > 0 ? [r.est.idv] : [])), 10000) : null), [rows, vehicle]);

  const needle = q.trim().toLowerCase();
  const list = rows
    .filter(({ p, est }) => {
      if (needle && !`${p.name} ${p.company.name} ${p.vendorName}`.toLowerCase().includes(needle)) return false;
      if (filters.providers.length && !filters.providers.includes(p.company.slug)) return false;
      if (filters.categories.length && !filters.categories.includes(p.category)) return false;
      if (filters.addOns.some((k) => !offersAddOn(p, k, vehicle))) return false;
      if (filters.premium && (!est || est.total < filters.premium[0] || est.total > filters.premium[1])) return false;
      if (filters.idv && (!est || est.odYears === 0 || est.idv < filters.idv[0] || est.idv > filters.idv[1])) return false;
      return true;
    })
    .sort((a, b) => Number(a.problems.length > 0) - Number(b.problems.length > 0) || (a.est?.total ?? 0) - (b.est?.total ?? 0));
  const count = activeFilterCount(filters);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Add or remove plans"
      className="sm:max-w-lg"
      footer={
        <div className="flex items-center justify-between gap-4">
          <p className="text-[12.5px] text-muted num">
            {selected.length} of {max} selected
          </p>
          <Button variant="dark" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      }
    >
      <div className="sticky top-0 z-10 space-y-3 border-b border-line bg-white px-5 py-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search plans or insurers"
            aria-label="Search plans or insurers"
            className="h-11 w-full rounded-[3px] border border-line bg-white pl-10 pr-3 text-[14px] outline-none transition-colors placeholder:text-muted/70 hover:border-ink/30 focus:border-ink"
          />
        </div>
        <button type="button" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} className="inline-flex items-center gap-2 text-[13px] font-medium text-ink hover:text-red">
          <SlidersHorizontal className="size-3.5" aria-hidden />
          {showFilters ? "Hide filters" : "Filters"}
          {count > 0 && <span className="rounded-full bg-ink px-1.5 text-[11px] text-white num">{count}</span>}
        </button>
      </div>
      {showFilters && (
        <div className="border-b border-line bg-mist/40 px-5 py-6">
          <FilterPanel value={filters} onChange={setFilters} options={options} premiumBounds={premiumBounds} idvBounds={idvBounds} addOnHint="Show plans that offer it (it's also added to the estimates)" />
        </div>
      )}
      <ul className="divide-y divide-line">
        {list.map(({ p, problems, est }) => {
          const on = selected.includes(p.reference);
          const full = !on && selected.length >= max;
          return (
            <li key={p.id} className="flex items-center gap-3 px-5 py-4">
              <CompanyLogo company={p.company} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-ink">{p.name}</p>
                <p className="truncate text-[12px] text-muted">
                  {p.company.name} · {INS_PRODUCT_CATEGORY_LABEL[p.category]} · {termLabel(p.pricing)}
                </p>
                {est && <p className="mt-0.5 text-[12px] font-medium text-ink num">{inr(est.total)} indicative</p>}
                {problems.length > 0 && <p className="mt-0.5 truncate text-[12px] text-red">Not for your car: {problems[0].toLowerCase()}</p>}
              </div>
              <button
                type="button"
                onClick={() => onToggle(p)}
                disabled={full}
                aria-pressed={on}
                title={full ? `You can compare up to ${max} plans` : undefined}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[3px] border px-3 text-[12.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                  on ? "border-ink bg-ink text-white" : "border-line text-ink hover:border-ink",
                )}
              >
                {on ? <Check className="size-3.5" aria-hidden /> : <Plus className="size-3.5" aria-hidden />}
                {on ? "Added" : "Add"}
              </button>
            </li>
          );
        })}
        {list.length === 0 && <li className="px-5 py-12 text-center text-[13.5px] text-muted">No plans match. Try a different search or clear the filters.</li>}
      </ul>
    </Drawer>
  );
}
