"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowUpRight, Car, Check, Download, Link2, MoveHorizontal, PencilLine, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { useUI } from "@/components/providers/app-provider";
import { useCatalog } from "@/components/providers/catalog-provider";
import { AdImpression } from "@/components/ads/ad-impression";
import { adClickHref } from "@/ads/links";
import { cn } from "@/lib/utils";
import { formatNumber, formatPriceShort } from "@/lib/format";
import type { PricingConfig } from "@/insurance/estimator";
import type { InsuranceSearch } from "@/insurance/types";
import { isSearchReady } from "@/insurance/search";
import { FILTER_ADDONS, STANDARD_COVER_BY_KEY } from "@/insurance/covers";
import { INDICATIVE_NOTE, INS_PRODUCT_CATEGORY_LABEL } from "@/insurance/labels";
import { eligibilitySummary, pricingBasisLabel } from "./display";
import {
  estimateProduct,
  productProblems,
  resolveVehicle,
  termLabel,
  vehicleFacts,
  vehicleQuery,
  type MarketEstimate,
  type MarketProduct,
  type MarketSponsored,
} from "./engine";
import { MAX_COMPARE, setCompareRefs, useInsCompare } from "./compare-store";
import { ProductPicker } from "./product-picker";
import { RequestQuoteModal, type RequestItem } from "./request-quote";
import { trackInsurance } from "./track";
import { AddOnMark, CompanyLogo, IndicativeLabel, Switch, Tag, fileSize, inr } from "./ui";
import { VehiclePicker, blankSearch } from "./vehicle-picker";

export interface CompareExperienceProps {
  products: MarketProduct[];
  initialRefs: string[];
  initialSearch: InsuranceSearch;
  initialAddOns: string[];
  config: PricingConfig;
  sponsored: MarketSponsored | null;
  maxRequests: number;
  today: string;
  attribution: { source: string; campaignId: number | null; adId: number | null };
}

interface Col {
  p: MarketProduct;
  problems: string[];
  est: MarketEstimate | null;
}

interface Row {
  id: string;
  label: ReactNode;
  hint?: string;
  /** Comparable value per column (for "highlight differences"). */
  keys: string[];
  cells: ReactNode[];
}

const yes = (text: ReactNode) => (
  <span className="inline-flex items-start gap-2">
    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-ink text-white">
      <Check className="size-2.5" strokeWidth={3} aria-hidden />
    </span>
    <span>{text}</span>
  </span>
);
const no = (text: ReactNode = "Not covered") => (
  <span className="inline-flex items-center gap-2 text-muted">
    <span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-line">
      <X className="size-2.5" aria-hidden />
    </span>
    {text}
  </span>
);

export function CompareExperience({ products, initialRefs, initialSearch, initialAddOns, config, sponsored, maxRequests, today, attribution }: CompareExperienceProps) {
  const catalog = useCatalog();
  const { toast } = useUI();
  const stored = useInsCompare().refs;
  const known = (refs: string[]) => refs.filter((r) => products.some((p) => p.reference === r)).slice(0, MAX_COMPARE);
  // null = nothing in the URL and not edited yet → fall back to the list remembered on this device.
  const [chosen, setChosen] = useState<string[] | null>(initialRefs.length ? known(initialRefs) : null);
  const refs = chosen ?? known(stored);
  const [search, setSearch] = useState<InsuranceSearch>(initialSearch);
  const [draft, setDraft] = useState<InsuranceSearch>(isSearchReady(initialSearch) ? initialSearch : blankSearch());
  const [carOpen, setCarOpen] = useState(!isSearchReady(initialSearch));
  // The car panel sits above the table: bring it into view (it may already be open) and put focus in it.
  const openCarPanel = () => {
    setCarOpen(true);
    requestAnimationFrame(() => {
      const panel = document.getElementById("compare-car");
      panel?.scrollIntoView({ behavior: "smooth", block: "start" });
      panel?.querySelector<HTMLElement>("select:not(:disabled), input:not(:disabled), button:not(:disabled)")?.focus({ preventScroll: true });
    });
  };
  const [addOns, setAddOns] = useState<string[]>(initialAddOns);
  const [highlight, setHighlight] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [request, setRequest] = useState<RequestItem[]>([]);
  const [requestOpen, setRequestOpen] = useState(false);

  const vehicle = useMemo(() => resolveVehicle(search, catalog, config, today), [search, catalog, config, today]);
  const cols = useMemo<Col[]>(
    () =>
      refs.flatMap((ref) => {
        const p = products.find((x) => x.reference === ref);
        if (!p) return [];
        const problems = vehicle ? productProblems(p, vehicle) : [];
        const est = vehicle && !vehicle.tooOld && !problems.length ? estimateProduct(p, vehicle, { addOns }, config) : null;
        return [{ p, problems, est }];
      }),
    [refs, products, vehicle, addOns, config],
  );

  // Remember the list on this device when it came from the URL.
  useEffect(() => {
    if (initialRefs.length) setCompareRefs(known(initialRefs));
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the URL shareable: ?products=…&<car>&addons=…
  useEffect(() => {
    const q = new URLSearchParams();
    if (refs.length) q.set("products", refs.join(","));
    if (isSearchReady(search)) for (const [k, v] of new URLSearchParams(vehicleQuery(search))) q.set(k, v);
    if (addOns.length) q.set("addons", addOns.join(","));
    for (const k of ["src", "campaign", "ad"]) {
      const v = new URLSearchParams(window.location.search).get(k);
      if (v) q.set(k, v);
    }
    const next = `${window.location.pathname}${q.size ? `?${q.toString()}` : ""}`;
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", next);
  }, [refs, search, addOns]);

  const commit = (next: string[]) => {
    const list = known(next);
    setChosen(list);
    setCompareRefs(list);
  };
  const toggle = (p: MarketProduct) => {
    if (refs.includes(p.reference)) return commit(refs.filter((r) => r !== p.reference));
    if (refs.length >= MAX_COMPARE) {
      toast(`You can compare up to ${MAX_COMPARE} plans. Remove one first.`, { tone: "error" });
      return;
    }
    trackInsurance("compare_add", p.vendorId, p.id);
    commit([...refs, p.reference]);
  };
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast("Link copied", { tone: "success" });
    } catch {
      toast("Couldn't copy — copy the address bar instead.", { tone: "error" });
    }
  };
  const applyCar = () => {
    if (!isSearchReady(draft)) {
      toast("Choose your car's brand and model.", { tone: "error" });
      return;
    }
    setSearch(draft);
    setCarOpen(false);
  };
  const openRequest = (items: Col[]) => {
    setRequest(items.map((c) => ({ product: c.p, total: c.est?.estimate.total ?? null, sponsoredCampaignId: sponsored && c.p.id === sponsored.productId ? sponsored.campaignId : null })));
    setRequestOpen(true);
  };

  const sponsoredProduct = sponsored ? (products.find((p) => p.id === sponsored.productId && !refs.includes(p.reference)) ?? null) : null;
  const eligibleCols = cols.filter((c) => !c.problems.length);

  /* ── Rows ── */
  const per = (fn: (c: Col) => ReactNode): ReactNode[] => cols.map(fn);
  const addOnKeys = useMemo(() => {
    const keys = new Map<string, string>();
    for (const f of FILTER_ADDONS) keys.set(f.key, f.name);
    for (const c of cols) for (const a of c.p.addOns) if (!keys.has(a.key === "custom" ? `c${a.id}` : a.key)) keys.set(a.key === "custom" ? `c${a.id}` : a.key, a.name);
    return [...keys.entries()];
  }, [cols]);

  const groups: { id: string; title: string; rows: Row[] }[] = [
    {
      id: "price",
      title: "Price",
      rows: [
        {
          id: "premium",
          label: <IndicativeLabel align="left" className="text-[13.5px] font-normal" />,
          hint: "Incl. GST, for your car",
          keys: cols.map((c) => String(c.est?.estimate.total ?? c.problems.join() ?? "")),
          cells: per((c) =>
            !vehicle ? (
              <button type="button" onClick={openCarPanel} className="text-left text-[13px] font-medium text-ink underline underline-offset-4 hover:text-red">
                Add your car to see it
              </button>
            ) : c.est ? (
              <span>
                <span className="block font-display text-[22px] font-semibold leading-none tracking-[-0.02em] num">{inr(c.est.estimate.total)}</span>
                <span className="mt-1 block text-[11.5px] text-muted num">
                  Net {inr(c.est.estimate.net)} + GST {inr(c.est.estimate.gst)}
                </span>
              </span>
            ) : (
              <span className="text-[13px] text-red">Not for your car — {(c.problems[0] ?? (vehicle.tooOld ? "too old to estimate" : "")).toLowerCase()}</span>
            ),
          ),
        },
        {
          id: "idv",
          label: "IDV",
          hint: "Insured declared value",
          keys: cols.map((c) => (c.est ? `${c.est.estimate.idv}` : c.p.pricing.odYears ? "?" : "na")),
          cells: per((c) =>
            c.p.pricing.odYears === 0 ? (
              <span className="text-muted">Not applicable</span>
            ) : c.est ? (
              <span>
                <span className="font-medium num">{formatPriceShort(c.est.estimate.idv)}</span>
                <span className="mt-0.5 block text-[11.5px] text-muted num">
                  Adjustable {formatPriceShort(c.est.estimate.idvMin)} – {formatPriceShort(c.est.estimate.idvMax)}
                </span>
              </span>
            ) : (
              <span className="text-muted num">
                {c.p.pricing.idvMinPct}% to +{c.p.pricing.idvMaxPct}% of the suggested IDV
              </span>
            ),
          ),
        },
      ],
    },
    {
      id: "cover",
      title: "Cover",
      rows: [
        {
          id: "od",
          label: "Own damage",
          keys: cols.map((c) => (c.p.coverage.ownDamage ? `y${c.p.pricing.odYears}` : "n")),
          cells: per((c) => (c.p.coverage.ownDamage && c.p.pricing.odYears > 0 ? yes(`${c.p.pricing.odYears} year${c.p.pricing.odYears === 1 ? "" : "s"}`) : no())),
        },
        {
          id: "tp",
          label: "Third-party liability",
          keys: cols.map((c) => (c.p.coverage.thirdParty ? `y${c.p.pricing.tpYears}${c.p.coverage.tpPropertyLimit}` : "n")),
          cells: per((c) =>
            c.p.coverage.thirdParty && c.p.pricing.tpYears > 0
              ? yes(
                  <>
                    {c.p.pricing.tpYears} year{c.p.pricing.tpYears === 1 ? "" : "s"}
                    {c.p.coverage.tpPropertyLimit && <span className="block text-[11.5px] text-muted">Property damage up to {c.p.coverage.tpPropertyLimit}</span>}
                  </>,
                )
              : no(),
          ),
        },
        {
          id: "pa",
          label: "Owner-driver PA cover",
          keys: cols.map((c) => c.p.coverage.paOwnerDriver),
          cells: per((c) => (c.p.coverage.paOwnerDriver === "included" ? yes("Included") : c.p.coverage.paOwnerDriver === "optional" ? <AddOnMark status="optional" premium={config.paOwnerDriver} /> : no("Not offered"))),
        },
        {
          id: "items",
          label: "Covered events",
          keys: cols.map((c) => c.p.coverageItems.map((i) => i.key).sort().join()),
          cells: per((c) =>
            c.p.coverageItems.length ? (
              <ul className="space-y-1">
                {c.p.coverageItems.map((i) => (
                  <li key={i.id}>{i.name}</li>
                ))}
              </ul>
            ) : (
              <span className="text-muted">As per the policy wording</span>
            ),
          ),
        },
        {
          id: "deductible",
          label: "Deductibles",
          hint: "What you pay per claim",
          keys: cols.map((c) => `${c.p.deductibles.compulsory}|${c.p.deductibles.voluntary.join()}`),
          cells: per((c) => (
            <span>
              <span className="font-medium num">{c.p.deductibles.compulsory ? inr(c.p.deductibles.compulsory) : "None"}</span> <span className="text-muted">compulsory</span>
              {c.p.deductibles.voluntary.length > 0 && <span className="mt-0.5 block text-[11.5px] text-muted num">Voluntary: {c.p.deductibles.voluntary.map((v) => inr(v)).join(", ")}</span>}
            </span>
          )),
        },
      ],
    },
    {
      id: "addons",
      title: "Add-on covers",
      rows: addOnKeys.map(([key, name]) => {
        const cell = (c: Col): { key: string; node: ReactNode } => {
          const a = c.p.addOns.find((x) => (x.key === "custom" ? `c${x.id}` : x.key) === key);
          if (!a) return { key: "none", node: <AddOnMark status="none" /> };
          const line = c.est?.addOns.find((l) => l.cover.id === a.id);
          if (line) return { key: line.status, node: <AddOnMark status={line.status} premium={line.premium} /> };
          if (a.included) return { key: "included", node: <AddOnMark status="included" /> };
          return {
            key: "optional",
            node: (
              <span className="inline-flex items-center gap-1.5 text-[12.5px]">
                <span className="flex size-4 items-center justify-center rounded-full border border-ink/30 text-[10px]">+</span>
                Optional · {pricingBasisLabel(a.pricing)}
              </span>
            ),
          };
        };
        const cs = cols.map(cell);
        return { id: `a-${key}`, label: name, hint: STANDARD_COVER_BY_KEY[key]?.summary, keys: cs.map((x) => x.key), cells: cs.map((x) => x.node) };
      }),
    },
    {
      id: "service",
      title: "Service and terms",
      rows: [
        {
          id: "garages",
          label: "Cashless garages",
          hint: "As stated by the insurer",
          keys: cols.map((c) => String(c.p.garageCount ?? "")),
          cells: per((c) => <span className="num">{c.p.garageCount ? formatNumber(c.p.garageCount) : <span className="text-muted">Not stated</span>}</span>),
        },
        {
          id: "term",
          label: "Policy duration",
          keys: cols.map((c) => termLabel(c.p.pricing)),
          cells: per((c) => <span className="num">{termLabel(c.p.pricing)}</span>),
        },
        {
          id: "type",
          label: "Policy type",
          keys: cols.map((c) => c.p.category),
          cells: per((c) => INS_PRODUCT_CATEGORY_LABEL[c.p.category]),
        },
        {
          id: "seller",
          label: "Underwritten by",
          keys: cols.map((c) => `${c.p.company.id}|${c.p.soldBy ?? ""}`),
          cells: per((c) => (
            <span>
              <Link href={`/insurance/providers/${c.p.company.slug}`} className="hover:text-red">
                {c.p.company.name}
              </Link>
              {c.p.soldBy && <span className="mt-0.5 block text-[11.5px] text-muted">Sold by {c.p.soldBy}</span>}
            </span>
          )),
        },
      ],
    },
    {
      id: "eligibility",
      title: "Eligibility",
      rows: [
        ...(vehicle
          ? [
              {
                id: "fits",
                label: "Your car",
                keys: cols.map((c) => (c.problems.length ? "n" : "y")),
                cells: per((c) => (c.problems.length ? <span className="text-red">{c.problems.join("; ")}</span> : yes("Covers your car"))),
              } satisfies Row,
            ]
          : []),
        {
          id: "who",
          label: "Who it's for",
          keys: cols.map((c) => JSON.stringify(c.p.eligibility)),
          cells: per((c) => (
            <ul className="space-y-1 text-[12.5px]">
              {eligibilitySummary(c.p.eligibility).map((e) => (
                <li key={e.label}>
                  <span className="text-muted">{e.label}:</span> {e.value}
                </li>
              ))}
            </ul>
          )),
        },
      ],
    },
    {
      id: "exclusions",
      title: "Exclusions and documents",
      rows: [
        {
          id: "excl",
          label: "Main exclusions",
          keys: cols.map((c) => c.p.exclusions.join("|")),
          cells: per((c) =>
            c.p.exclusions.length ? (
              <ul className="list-disc space-y-1 pl-4 text-[12.5px] marker:text-muted">
                {c.p.exclusions.slice(0, 6).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : (
              <span className="text-muted">See the policy wording</span>
            ),
          ),
        },
        {
          id: "docs",
          label: "Documents",
          keys: cols.map((c) => `${Boolean(c.p.documents.brochure)}${Boolean(c.p.documents.wording)}`),
          cells: per((c) =>
            c.p.documents.brochure || c.p.documents.wording ? (
              <ul className="space-y-1.5">
                {(["brochure", "wording"] as const).map((k) => {
                  const d = c.p.documents[k];
                  return d ? (
                    <li key={k}>
                      <a href={`/insurance/products/${c.p.reference}/documents/${k}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink hover:text-red">
                        <Download className="size-3.5" aria-hidden />
                        {k === "brochure" ? "Brochure" : "Policy wording"} <span className="font-normal text-muted">{fileSize(d.size)}</span>
                      </a>
                    </li>
                  ) : null;
                })}
              </ul>
            ) : (
              <span className="text-muted">Not uploaded</span>
            ),
          ),
        },
      ],
    },
  ];

  const comparable = cols.length >= 2;
  const differs = (r: Row) => comparable && new Set(r.keys).size > 1;
  const diffCount = groups.flatMap((g) => g.rows).filter(differs).length;
  const slots = Math.min(MAX_COMPARE, Math.max(2, cols.length + (cols.length < MAX_COMPARE ? 1 : 0)));
  const empties = slots - cols.length;
  const minWidth = `calc(var(--lc) + ${slots} * var(--cw))`;

  return (
    <>
      {/* Car + add-ons */}
      <section id="compare-car" className="container-x scroll-mt-32 pt-8 md:pt-10">
        {vehicle && !carOpen ? (
          <div className="flex flex-col gap-4 rounded-[3px] bg-ink px-5 py-4 text-white md:flex-row md:items-center md:justify-between md:px-6">
            <div className="flex min-w-0 items-center gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10">
                <Car className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold">{vehicle.title}</p>
                <p className="mt-0.5 flex flex-wrap gap-x-3 text-[12.5px] text-white/65 num">
                  {vehicleFacts(vehicle).map((f) => (
                    <span key={f}>{f}</span>
                  ))}
                </p>
              </div>
            </div>
            <Button variant="outline-light" size="sm" onClick={() => setCarOpen(true)} icon={<PencilLine className="size-3.5" aria-hidden />} className="self-start md:self-auto">
              Change car
            </Button>
          </div>
        ) : (
          <div className="border border-line bg-white p-5 md:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="type-h4">{vehicle ? "Change your car" : "Add your car to see indicative premiums"}</h2>
                <p className="mt-1 max-w-xl text-[13px] text-muted">Premiums and IDV depend on the car, its age and your no-claim bonus. Nothing is saved until you ask for a quote.</p>
              </div>
              {vehicle && (
                <button type="button" onClick={() => setCarOpen(false)} className="text-[13px] font-medium text-muted hover:text-red">
                  Cancel
                </button>
              )}
            </div>
            <div className="mt-6">
              <VehiclePicker value={draft} onChange={setDraft} thisYear={Number(today.slice(0, 4))} maxAgeYears={config.maxVehicleAgeYears} layout="grid" />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button variant="dark" onClick={applyCar} disabled={!isSearchReady(draft)}>
                Show premiums
              </Button>
              {vehicle && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearch(blankSearch());
                    setDraft(blankSearch());
                  }}
                >
                  Remove car
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
          <p className="shrink-0 text-[12.5px] font-medium text-ink">Include add-ons in the estimate:</p>
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0">
            {FILTER_ADDONS.map((a) => {
              const on = addOns.includes(a.key);
              return (
                <Chip key={a.key} selected={on} showCheck onClick={() => setAddOns(on ? addOns.filter((k) => k !== a.key) : [...addOns, a.key])}>
                  {a.name}
                </Chip>
              );
            })}
          </div>
        </div>
      </section>

      <section className="container-x pb-16 pt-8 md:pb-24">
        {/* Controls */}
        <div className="flex flex-col gap-4 border-y border-line py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Switch className="w-auto" checked={highlight} onChange={setHighlight} disabled={!comparable} label="Highlight differences" />
            <span className="text-[12.5px] text-muted num" aria-live="polite">
              {comparable ? `${diffCount} rows differ` : cols.length === 1 ? "Add one more plan to see differences" : ""}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
            <button type="button" onClick={() => setPickerOpen(true)} className="inline-flex items-center gap-1.5 font-medium hover:text-red">
              <Plus className="size-3.5" aria-hidden /> Add or remove plans
            </button>
            {cols.length > 0 && (
              <button type="button" onClick={share} className="inline-flex items-center gap-1.5 font-medium hover:text-red">
                <Link2 className="size-3.5" aria-hidden /> Copy link
              </button>
            )}
            {cols.length > 0 && (
              <button type="button" onClick={() => commit([])} className="font-medium text-muted hover:text-red">
                Clear all
              </button>
            )}
            {eligibleCols.length > 1 && (
              <Button size="sm" variant="primary" onClick={() => openRequest(eligibleCols.slice(0, maxRequests))}>
                Request {Math.min(eligibleCols.length, maxRequests)} quotes
              </Button>
            )}
          </div>
        </div>

        {cols.length === 0 ? (
          <div className="mt-8 flex flex-col items-center border border-dashed border-line px-6 py-16 text-center">
            <h2 className="type-h3">Pick plans to compare</h2>
            <p className="mt-2 max-w-md text-[14px] text-muted">Line up to {MAX_COMPARE} plans: premium, IDV, cover, add-ons, garages, exclusions and documents side by side.</p>
            <Button className="mt-6" variant="dark" onClick={() => setPickerOpen(true)} disabled={products.length === 0} icon={<Plus className="size-4" aria-hidden />}>
              {products.length ? "Choose plans" : "No plans listed yet"}
            </Button>
          </div>
        ) : (
          <>
            <p className="mt-5 flex items-center gap-2 text-[12px] text-muted md:hidden">
              <MoveHorizontal className="size-3.5" aria-hidden /> Swipe sideways to see every plan
            </p>
            <div className="relative mt-4 overflow-x-auto overscroll-x-contain md:mt-8 [--cw:200px] [--lc:128px] md:[--cw:240px] md:[--lc:200px]">
              <table className="w-full table-fixed border-separate border-spacing-0 text-[13.5px]" style={{ minWidth }}>
                <colgroup>
                  <col style={{ width: "var(--lc)" }} />
                  {Array.from({ length: slots }, (_, i) => (
                    <col key={i} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col" className="sticky left-0 z-20 bg-white pb-6 pr-3 text-left align-bottom md:pr-6">
                      <span className="type-eyebrow text-muted">Comparing</span>
                      <span className="mt-3 block font-display text-[36px] font-semibold leading-none tracking-[-0.04em] num">
                        {cols.length}
                        <span className="text-ink/50">/{MAX_COMPARE}</span>
                      </span>
                    </th>
                    {cols.map((c) => (
                      <th key={c.p.id} scope="col" className="border-l border-line px-3 pb-6 text-left align-top font-normal md:px-5">
                        <div className="flex items-start justify-between gap-2">
                          <CompanyLogo company={c.p.company} />
                          <button type="button" onClick={() => toggle(c.p)} aria-label={`Remove ${c.p.name}`} className="inline-flex size-8 items-center justify-center rounded-full text-muted hover:bg-mist hover:text-ink">
                            <X className="size-4" aria-hidden />
                          </button>
                        </div>
                        <p className="mt-3 truncate text-[12px] text-muted">{c.p.company.name}</p>
                        <p className="mt-0.5 text-[15px] font-semibold leading-snug text-ink">
                          <Link href={`/insurance/products/${c.p.reference}${isSearchReady(search) ? `?${vehicleQuery(search)}` : ""}`} className="hover:text-red">
                            {c.p.name}
                          </Link>
                        </p>
                        <Tag className="mt-2">{INS_PRODUCT_CATEGORY_LABEL[c.p.category]}</Tag>
                        <Button size="sm" variant={c.problems.length ? "outline" : "primary"} className="mt-4 w-full" disabled={c.problems.length > 0} onClick={() => openRequest([c])}>
                          Request quote
                        </Button>
                      </th>
                    ))}
                    {Array.from({ length: empties }, (_, i) => (
                      <th key={`e${i}`} scope="col" className="border-l border-line px-3 pb-6 align-top md:px-5">
                        <button
                          type="button"
                          onClick={() => setPickerOpen(true)}
                          className="flex h-[150px] w-full flex-col items-center justify-center gap-2 border border-dashed border-ink/20 text-[13px] font-medium text-muted transition-colors hover:border-ink hover:text-ink"
                        >
                          <Plus className="size-4" aria-hidden />
                          Add a plan
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                {groups.map((g) => (
                  <tbody key={g.id}>
                    <tr>
                      <th colSpan={slots + 1} scope="colgroup" className="border-b border-ink pb-3 pt-10 text-left">
                        <span className="sticky left-0 inline-flex items-center gap-3 bg-white pr-4">
                          <span aria-hidden className="h-px w-6 bg-red" />
                          <span className="type-eyebrow">{g.title}</span>
                        </span>
                      </th>
                    </tr>
                    {g.rows.map((r) => {
                      const marked = highlight && differs(r);
                      return (
                        <tr key={r.id} className={cn(marked && "bg-mist/70")}>
                          <th scope="row" className={cn("sticky left-0 z-10 border-b border-line py-4 pr-3 text-left align-top font-normal md:pr-6", marked ? "bg-[#f8f8f8]" : "bg-white")}>
                            <span className={cn("flex items-start gap-2 text-[13px]", marked ? "font-medium text-ink" : "text-muted")}>
                              {marked && <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-red" />}
                              <span className="min-w-0">{r.label}</span>
                            </span>
                            {r.hint && <span className="mt-1 hidden text-[11px] leading-snug text-muted md:block">{r.hint}</span>}
                          </th>
                          {r.cells.map((cell, i) => (
                            <td key={cols[i]?.p.id ?? i} className="break-words border-b border-l border-line px-3 py-4 align-top text-ink md:px-5">
                              {cell}
                            </td>
                          ))}
                          {Array.from({ length: empties }, (_, i) => (
                            <td key={`e${i}`} className="border-b border-l border-line" />
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                ))}
              </table>
            </div>
          </>
        )}

        {sponsoredProduct && sponsored && (
          <AdImpression campaignId={sponsored.campaignId} className="mt-10">
            <aside aria-label="Sponsored suggestion" className="flex flex-col gap-4 border border-line bg-white p-5 sm:flex-row sm:items-center md:p-6">
              <CompanyLogo company={sponsoredProduct.company} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Tag tone="outline">Sponsored</Tag>
                  <span className="text-[11.5px] text-muted">Suggested plan · paid placement</span>
                </div>
                <p className="mt-2 text-[15px] font-semibold text-ink">{sponsoredProduct.name}</p>
                <p className="text-[12.5px] text-muted">
                  {sponsoredProduct.company.name} · {INS_PRODUCT_CATEGORY_LABEL[sponsoredProduct.category]}
                  {sponsoredProduct.tagline ? ` · ${sponsoredProduct.tagline}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Button size="sm" variant="outline" onClick={() => toggle(sponsoredProduct)} disabled={refs.length >= MAX_COMPARE}>
                  Add to compare
                </Button>
                <Link href={adClickHref(sponsored.campaignId)} className="inline-flex items-center gap-1 text-[13px] font-medium text-ink hover:text-red">
                  Details <ArrowUpRight className="size-3.5 text-red" aria-hidden />
                </Link>
              </div>
            </aside>
          </AdImpression>
        )}

        <p className="mt-8 max-w-3xl text-[12px] leading-relaxed text-muted">
          {INDICATIVE_NOTE} Cover details are as listed by each insurer or intermediary and approved by MarchGear; the policy wording decides what&apos;s covered.
        </p>
      </section>

      <ProductPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        products={products}
        selected={refs}
        max={MAX_COMPARE}
        onToggle={toggle}
        vehicle={vehicle}
        config={config}
        addOns={addOns}
        onAddOns={setAddOns}
      />

      <RequestQuoteModal
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        items={request}
        search={vehicle ? search : null}
        addOns={addOns}
        source={attribution.source}
        campaignId={attribution.campaignId}
        adCampaignId={attribution.adId}
        thisYear={Number(today.slice(0, 4))}
        maxAgeYears={config.maxVehicleAgeYears}
      />
    </>
  );
}

