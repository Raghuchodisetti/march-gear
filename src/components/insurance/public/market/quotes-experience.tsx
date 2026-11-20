"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Car, ChevronDown, Filter, GitCompareArrows, PencilLine, SearchX, X } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { SelectField } from "@/components/ui/field";
import { useUI } from "@/components/providers/app-provider";
import { AdImpression } from "@/components/ads/ad-impression";
import { adClickHref } from "@/ads/links";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import type { InsProductCategory } from "@/db/enums";
import type { PricingConfig } from "@/insurance/estimator";
import { INDICATIVE_NOTE, INS_PRODUCT_CATEGORY_LABEL } from "@/insurance/labels";
import { STANDARD_COVER_BY_KEY } from "@/insurance/covers";
import {
  EMPTY_FILTERS,
  SORT_LABEL,
  estimateProduct,
  offersAddOn,
  productProblems,
  vehicleAssumptions,
  vehicleFacts,
  vehicleQuery,
  type MarketEstimate,
  type MarketFilters,
  type MarketProduct,
  type MarketSponsored,
  type MarketVehicle,
  type SortKey,
} from "./engine";
import { FilterPanel, activeFilterCount, filterOptions, niceBounds } from "./filters";
import { QuoteCard } from "./quote-card";
import { RequestQuoteModal, type RequestItem } from "./request-quote";
import { useInsCompare } from "./compare-store";
import { trackInsurance } from "./track";
import { CompanyLogo } from "./ui";
import type { PublicCampaign } from "@/server/insurance/public";

export interface QuotesExperienceProps {
  products: MarketProduct[];
  vehicle: MarketVehicle;
  config: PricingConfig;
  sponsored: MarketSponsored[];
  maxRequests: number;
  initial: { providers: string[]; categories: InsProductCategory[]; addOns: string[]; sort: SortKey };
  attribution: { source: string; campaignId: number | null; adId: number | null };
  thisYear: number;
  /** The vehicle search form (rendered by the page) for "Edit vehicle". */
  editForm: ReactNode;
  /** The running promotion the customer arrived from (?campaign=). */
  campaign?: PublicCampaign | null;
}

interface Row {
  p: MarketProduct;
  est: MarketEstimate;
}

const SORTERS: Record<SortKey, (a: Row, b: Row) => number> = {
  premium: (a, b) => a.est.estimate.total - b.est.estimate.total,
  idv: (a, b) => b.est.estimate.idv - a.est.estimate.idv || a.est.estimate.total - b.est.estimate.total,
  garages: (a, b) => (b.p.garageCount ?? -1) - (a.p.garageCount ?? -1) || a.est.estimate.total - b.est.estimate.total,
};

function setList(url: URL, key: string, values: string[]) {
  if (values.length) url.searchParams.set(key, values.join(","));
  else url.searchParams.delete(key);
}

export function QuotesExperience({ products, vehicle, config, sponsored, maxRequests, initial, attribution, thisYear, editForm, campaign }: QuotesExperienceProps) {
  const { toast } = useUI();
  const compare = useInsCompare();
  const [filters, setFilters] = useState<MarketFilters>({ ...EMPTY_FILTERS, providers: initial.providers, categories: initial.categories, addOns: initial.addOns });
  const [sort, setSort] = useState<SortKey>(initial.sort);
  const [idvs, setIdvs] = useState<Record<number, number>>({});
  const [selected, setSelected] = useState<number[]>([]);
  const [request, setRequest] = useState<RequestItem[]>([]);
  const [requestOpen, setRequestOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);

  const { eligible, excluded } = useMemo(() => {
    const eligible: MarketProduct[] = [];
    const excluded: { p: MarketProduct; reasons: string[] }[] = [];
    for (const p of products) {
      const reasons = productProblems(p, vehicle);
      if (reasons.length) excluded.push({ p, reasons });
      else eligible.push(p);
    }
    return { eligible, excluded };
  }, [products, vehicle]);

  const rows = useMemo<Row[]>(() => eligible.map((p) => ({ p, est: estimateProduct(p, vehicle, { addOns: filters.addOns, idv: idvs[p.id] ?? null }, config) })), [eligible, vehicle, filters.addOns, idvs, config]);
  const options = useMemo(() => filterOptions(eligible), [eligible]);
  const premiumBounds = useMemo(() => niceBounds(rows.map((r) => r.est.estimate.total), 500), [rows]);
  const idvBounds = useMemo(() => niceBounds(rows.filter((r) => r.est.estimate.odYears > 0).map((r) => r.est.estimate.idv), 10000), [rows]);

  const visible = useMemo(() => {
    const f = filters;
    return rows
      .filter(({ p, est }) => {
        if (f.providers.length && !f.providers.includes(p.company.slug)) return false;
        if (f.categories.length && !f.categories.includes(p.category)) return false;
        if (f.addOns.some((k) => !offersAddOn(p, k, vehicle))) return false;
        if (f.premium && (est.estimate.total < f.premium[0] || est.estimate.total > f.premium[1])) return false;
        if (f.idv && (est.estimate.odYears === 0 || est.estimate.idv < f.idv[0] || est.estimate.idv > f.idv[1])) return false;
        return true;
      })
      .sort(SORTERS[sort]);
  }, [rows, filters, sort, vehicle]);

  const sponsoredRows = useMemo(
    () => sponsored.flatMap((s) => {
      const row = visible.find((r) => r.p.id === s.productId);
      return row ? [{ ...row, campaignId: s.campaignId }] : [];
    }),
    [sponsored, visible],
  );
  const organic = visible.filter((r) => !sponsoredRows.some((s) => s.p.id === r.p.id));

  // Keep the shareable parts of the view in the URL (no server round trip).
  useEffect(() => {
    const url = new URL(window.location.href);
    setList(url, "addons", filters.addOns);
    setList(url, "provider", filters.providers);
    setList(url, "type", filters.categories);
    if (sort === "premium") url.searchParams.delete("sort");
    else url.searchParams.set("sort", sort);
    if (url.href !== window.location.href) window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, [filters.addOns, filters.providers, filters.categories, sort]);

  // One "listed in quote results" event per eligible plan per page load.
  const listed = useRef(new Set<number>());
  useEffect(() => {
    for (const p of eligible.slice(0, 40)) {
      if (listed.current.has(p.id)) continue;
      listed.current.add(p.id);
      trackInsurance("quote_listing", p.vendorId, p.id);
    }
  }, [eligible]);

  const extra = new URLSearchParams();
  if (filters.addOns.length) extra.set("addons", filters.addOns.join(","));
  if (attribution.campaignId) extra.set("campaign", String(attribution.campaignId));
  if (attribution.adId) extra.set("ad", String(attribution.adId));
  extra.set("src", attribution.source);
  const vq = vehicleQuery(vehicle.search);
  const detailsHref = (p: MarketProduct) => `/insurance/products/${p.reference}?${vq}&${extra.toString()}`;
  const compareHref = `/insurance/compare?products=${compare.refs.join(",")}&${vq}${filters.addOns.length ? `&addons=${filters.addOns.join(",")}` : ""}`;

  const totalFor = (id: number) => rows.find((r) => r.p.id === id)?.est.estimate.total ?? null;
  const openRequest = (items: RequestItem[]) => {
    setRequest(items);
    setRequestOpen(true);
  };
  const toggleSelect = (p: MarketProduct, on: boolean) => {
    if (!on) return setSelected((s) => s.filter((x) => x !== p.id));
    if (selected.length >= maxRequests) {
      toast(`You can ask up to ${maxRequests} insurers at once.`, { tone: "error" });
      return;
    }
    setSelected((s) => [...s, p.id]);
  };
  const toggleCompare = (p: MarketProduct) => {
    const r = compare.toggle(p.reference);
    if (r === "full") toast(`You can compare up to ${compare.max} plans. Remove one first.`, { tone: "error" });
    else if (r === "added") {
      trackInsurance("compare_add", p.vendorId, p.id);
      toast(`Added ${p.name} to compare`, { action: compare.refs.length >= 1 ? { label: "Compare now", href: `/insurance/compare?products=${[...compare.refs, p.reference].join(",")}&${vq}` } : undefined });
    }
  };
  const sponsoredFor = (id: number) => sponsoredRows.find((s) => s.p.id === id)?.campaignId ?? null;
  const selectedItems: RequestItem[] = selected.flatMap((id) => {
    const p = eligible.find((x) => x.id === id);
    return p ? [{ product: p, total: totalFor(id), sponsoredCampaignId: sponsoredFor(id) }] : [];
  });

  const cardFor = (r: Row, sponsoredCampaign: number | null) => (
    <QuoteCard
      product={r.p}
      est={r.est}
      detailsHref={detailsHref(r.p)}
      sponsored={sponsoredCampaign ? { campaignId: sponsoredCampaign, href: adClickHref(sponsoredCampaign) } : null}
      promotion={campaign && campaign.vendorId === r.p.vendorId && (campaign.productIds.length === 0 || campaign.productIds.includes(r.p.id)) ? "Promotion" : null}
      selected={selected.includes(r.p.id)}
      selectDisabled={selected.length >= maxRequests}
      onSelect={(on) => toggleSelect(r.p, on)}
      inCompare={compare.refs.includes(r.p.reference)}
      onCompare={() => toggleCompare(r.p)}
      onRequest={() => openRequest([{ product: r.p, total: r.est.estimate.total, sponsoredCampaignId: sponsoredCampaign }])}
      onIdv={(v) =>
        setIdvs((cur) => {
          const next = { ...cur };
          if (v === null) delete next[r.p.id];
          else next[r.p.id] = v;
          return next;
        })
      }
    />
  );

  const filterCount = activeFilterCount(filters);
  const assumptions = vehicleAssumptions(vehicle);
  const panel = <FilterPanel value={filters} onChange={setFilters} options={options} premiumBounds={premiumBounds} idvBounds={idvBounds} />;
  const showBar = selected.length > 0 || compare.refs.length > 0;

  return (
    <>
      {/* Header + vehicle summary */}
      <section className="border-b border-line">
        <div className="container-x pb-8 pt-8 md:pb-10 md:pt-10">
          <Breadcrumbs items={[{ label: "Insurance", href: "/insurance" }, { label: "Quotes" }]} />
          <div className="mt-8 flex flex-col gap-3 md:mt-10">
            <p className="type-eyebrow inline-flex items-center gap-3 text-ink">
              <span aria-hidden className="h-px w-6 bg-red" />
              Indicative premiums
            </p>
            <h1 className="type-h2 text-balance">
              {eligible.length ? (
                <>
                  {eligible.length} plan{eligible.length === 1 ? "" : "s"} for your <span className="type-editorial font-normal">{vehicle.title}</span>
                </>
              ) : (
                <>
                  Plans for your <span className="type-editorial font-normal">{vehicle.title}</span>
                </>
              )}
            </h1>
          </div>

          <div className="mt-8 flex flex-col gap-4 rounded-[3px] bg-ink px-5 py-4 text-white md:flex-row md:items-center md:justify-between md:px-6">
            <div className="flex min-w-0 items-center gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10">
                <Car className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold">
                  {vehicle.title}
                  <span className="ml-2 font-normal text-white/55">{vehicle.isNew ? "· new policy" : `· ${vehicle.search.intent === "renewal" ? "renewal" : "new policy"}`}</span>
                </p>
                <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px] text-white/65 num">
                  {vehicleFacts(vehicle).map((f) => (
                    <span key={f}>{f}</span>
                  ))}
                </p>
              </div>
            </div>
            <Button variant="outline-light" size="sm" onClick={() => setEditOpen(true)} icon={<PencilLine className="size-3.5" aria-hidden />} className="self-start md:self-auto">
              Edit vehicle
            </Button>
          </div>
          {assumptions.length > 0 && (
            <ul className="mt-3 space-y-0.5 text-[12px] text-muted">
              {assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="container-x py-8 md:py-12 lg:grid lg:grid-cols-[264px_minmax(0,1fr)] lg:gap-12">
        <aside className="hidden lg:block">
          <div className="sticky top-[140px] max-h-[calc(100dvh-160px)] overflow-y-auto pb-6 pr-2">{panel}</div>
        </aside>

        <div className="min-w-0">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-line pb-4">
            <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setFiltersOpen(true)} icon={<Filter className="size-3.5" aria-hidden />}>
              Filters{filterCount ? ` (${filterCount})` : ""}
            </Button>
            <p className="text-[13px] text-muted num" aria-live="polite">
              {eligible.length ? `Showing ${visible.length} of ${eligible.length} plans` : "No plans to show"}
            </p>
            <span className="flex-1" />
            <SelectField
              aria-label="Sort plans"
              className="w-[200px] [&_select]:h-9 [&_select]:text-[13px]"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              options={(Object.keys(SORT_LABEL) as SortKey[]).map((k) => ({ value: k, label: SORT_LABEL[k] }))}
            />
          </div>

          {filterCount > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {filters.addOns.map((k) => (
                <ActiveChip key={k} onClear={() => setFilters({ ...filters, addOns: filters.addOns.filter((x) => x !== k) })}>
                  {STANDARD_COVER_BY_KEY[k]?.name ?? k}
                </ActiveChip>
              ))}
              {filters.categories.map((c) => (
                <ActiveChip key={c} onClear={() => setFilters({ ...filters, categories: filters.categories.filter((x) => x !== c) })}>
                  {INS_PRODUCT_CATEGORY_LABEL[c]}
                </ActiveChip>
              ))}
              {filters.providers.map((s) => (
                <ActiveChip key={s} onClear={() => setFilters({ ...filters, providers: filters.providers.filter((x) => x !== s) })}>
                  {options.providers.find((p) => p.slug === s)?.name ?? s}
                </ActiveChip>
              ))}
              {filters.premium && <ActiveChip onClear={() => setFilters({ ...filters, premium: null })}>Premium range</ActiveChip>}
              {filters.idv && <ActiveChip onClear={() => setFilters({ ...filters, idv: null })}>IDV range</ActiveChip>}
              <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="px-2 text-[12.5px] font-medium text-muted hover:text-red">
                Clear all
              </button>
            </div>
          )}

          {campaign && (
            <div className="mt-5 flex flex-col gap-1 border-l-2 border-red bg-mist/70 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Promotion · {campaign.vendorName}</p>
              <p className="text-[14px] font-medium text-ink">{campaign.title}</p>
              <p className="text-[12.5px] text-muted">{campaign.summary} Plans in this promotion are marked. Terms are the provider&apos;s.</p>
            </div>
          )}

          <p className="mt-5 text-[12px] leading-relaxed text-muted">{INDICATIVE_NOTE}</p>

          {/* Results */}
          <div className="mt-6 space-y-5">
            {sponsoredRows.map((r) => (
              <AdImpression key={`ad-${r.campaignId}`} campaignId={r.campaignId}>
                {cardFor(r, r.campaignId)}
              </AdImpression>
            ))}
            <AnimatePresence initial={false} mode="popLayout">
              {organic.map((r) => (
                <motion.div key={r.p.id} layout="position" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, ease: EASE }}>
                  {cardFor(r, null)}
                </motion.div>
              ))}
            </AnimatePresence>

            {visible.length === 0 && (
              <div className="flex flex-col items-center border border-dashed border-line px-6 py-16 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-mist">
                  <SearchX className="size-5" aria-hidden />
                </span>
                {products.length === 0 ? (
                  <>
                    <h2 className="type-h3 mt-5">No plans are listed yet</h2>
                    <p className="mt-2 max-w-md text-[14px] text-muted">Insurers are still joining MarchGear. Check back soon, or read our guides while you wait.</p>
                    <Button href="/insurance" variant="outline" size="sm" className="mt-6">
                      Back to insurance
                    </Button>
                  </>
                ) : eligible.length === 0 ? (
                  <>
                    <h2 className="type-h3 mt-5">None of the listed plans cover this car</h2>
                    <p className="mt-2 max-w-md text-[14px] text-muted">See why below, or try a different car or policy situation.</p>
                    <Button variant="outline" size="sm" className="mt-6" onClick={() => setEditOpen(true)}>
                      Edit vehicle
                    </Button>
                  </>
                ) : (
                  <>
                    <h2 className="type-h3 mt-5">No plans match these filters</h2>
                    <p className="mt-2 max-w-md text-[14px] text-muted">Try removing an add-on or widening the premium range.</p>
                    <Button variant="outline" size="sm" className="mt-6" onClick={() => setFilters(EMPTY_FILTERS)}>
                      Clear filters
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Plans that don't fit */}
          {excluded.length > 0 && (
            <div className="mt-10 border-t border-line">
              <button type="button" onClick={() => setShowExcluded((v) => !v)} aria-expanded={showExcluded} className="flex w-full items-center justify-between gap-4 py-5 text-left">
                <span className="text-[14px] font-medium text-ink">
                  {excluded.length} plan{excluded.length === 1 ? " doesn't" : "s don't"} cover this car
                </span>
                <ChevronDown className={cn("size-4 text-muted transition-transform duration-300", showExcluded && "rotate-180")} aria-hidden />
              </button>
              <AnimatePresence initial={false}>
                {showExcluded && (
                  <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: EASE }} className="divide-y divide-line overflow-hidden border-t border-line">
                    {excluded.map(({ p, reasons }) => (
                      <li key={p.id} className="flex gap-4 py-4">
                        <CompanyLogo company={p.company} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-medium text-ink">
                            <Link href={`/insurance/products/${p.reference}`} className="hover:text-red">
                              {p.name}
                            </Link>
                            <span className="font-normal text-muted"> · {p.company.name}</span>
                          </p>
                          <ul className="mt-1 text-[12.5px] text-muted">
                            {reasons.map((r) => (
                              <li key={r}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </section>

      {/* Selection / compare bar */}
      <AnimatePresence>
        {showBar && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur-md"
          >
            <div className="container-x flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                {compare.refs.length > 0 ? (
                  <>
                    <GitCompareArrows className="size-4 shrink-0 text-ink" aria-hidden />
                    <span className="text-[13px] text-ink num">
                      {compare.refs.length} of {compare.max} in compare
                    </span>
                    <Link href={compareHref} className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink hover:text-red">
                      Compare <ArrowRight className="size-3.5" aria-hidden />
                    </Link>
                    <button type="button" onClick={compare.clear} className="text-[12.5px] text-muted hover:text-red">
                      Clear
                    </button>
                  </>
                ) : (
                  <span className="text-[13px] text-muted">Tick up to {maxRequests} plans to ask for quotes in one go.</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {selected.length > 0 && (
                  <button type="button" onClick={() => setSelected([])} className="text-[12.5px] text-muted hover:text-red">
                    Unselect
                  </button>
                )}
                <Button size="sm" variant="primary" disabled={selected.length === 0} onClick={() => openRequest(selectedItems)} className="flex-1 sm:flex-none">
                  {selected.length ? `Request ${selected.length} quote${selected.length === 1 ? "" : "s"}` : "Request quotes"}
                  <span className="text-white/70 num">
                    {selected.length}/{maxRequests}
                  </span>
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {showBar && <div aria-hidden className="h-28 sm:h-16" />}

      <Drawer open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters" footer={<Button className="w-full" variant="dark" onClick={() => setFiltersOpen(false)}>{`Show ${visible.length} plan${visible.length === 1 ? "" : "s"}`}</Button>}>
        <div className="px-5 py-6">{panel}</div>
      </Drawer>

      <Drawer open={editOpen} onClose={() => setEditOpen(false)} title="Edit your car">
        <div className="px-5 py-6">{editForm}</div>
      </Drawer>

      <RequestQuoteModal
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        items={request}
        search={vehicle.search}
        addOns={filters.addOns}
        idv={idvs}
        source={attribution.source}
        campaignId={attribution.campaignId}
        adCampaignId={attribution.adId}
        thisYear={thisYear}
        maxAgeYears={config.maxVehicleAgeYears}
        onDone={() => setSelected([])}
      />
    </>
  );
}

function ActiveChip({ children, onClear }: { children: ReactNode; onClear: () => void }) {
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-white pl-3.5 pr-1.5 text-[12.5px] font-medium text-ink">
      {children}
      <button type="button" onClick={onClear} aria-label="Remove filter" className="inline-flex size-5 items-center justify-center rounded-full text-muted hover:bg-mist hover:text-ink">
        <X className="size-3" aria-hidden />
      </button>
    </span>
  );
}
