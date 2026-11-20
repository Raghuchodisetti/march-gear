"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Check, ChevronDown, GitCompareArrows, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RangeField } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { FILTER_ADDONS } from "@/insurance/covers";
import { INS_PRODUCT_CATEGORY_LABEL } from "@/insurance/labels";
import { formatNumber, formatPriceShort } from "@/lib/format";
import { termLabel, type MarketEstimate, type MarketProduct } from "./engine";
import { AddOnMark, CompanyLogo, Figure, IndicativeLabel, InfoTip, Tag, inr } from "./ui";

export interface QuoteCardProps {
  product: MarketProduct;
  est: MarketEstimate;
  detailsHref: string;
  /** Ad campaign id when this card is a sponsored listing. */
  sponsored?: { campaignId: number; href: string } | null;
  selected: boolean;
  selectDisabled: boolean;
  onSelect: (on: boolean) => void;
  inCompare: boolean;
  onCompare: () => void;
  onRequest: () => void;
  onIdv: (idv: number | null) => void;
  /** The running promotion this plan is part of. */
  promotion?: string | null;
}

/** One plan in the quote results: indicative premium, IDV (adjustable), cover, add-ons and actions. */
export function QuoteCard({ product: p, est, detailsHref, sponsored, selected, selectDisabled, onSelect, inCompare, onCompare, onRequest, onIdv, promotion }: QuoteCardProps) {
  const [idvOpen, setIdvOpen] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const e = est.estimate;
  const hasOd = e.odYears > 0;
  const keyAddOns = FILTER_ADDONS.map((f) => ({ std: f, line: est.addOns.find((l) => l.cover.key === f.key) }));
  const otherIncluded = est.addOns.filter((l) => l.status === "included" && !FILTER_ADDONS.some((f) => f.key === l.cover.key));
  const href = sponsored?.href ?? detailsHref;

  return (
    <article className={cn("border bg-white transition-colors duration-[250ms]", selected ? "border-ink" : "border-line hover:border-ink/25")} aria-label={`${p.name} by ${p.company.name}`}>
      {sponsored && (
        <div className="flex items-center justify-between gap-3 border-b border-line bg-mist/70 px-5 py-2 md:px-6">
          <Tag tone="outline">Sponsored</Tag>
          <span className="text-[11px] text-muted">Paid placement · shown first</span>
        </div>
      )}

      {/* Head */}
      <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:gap-8 md:p-6">
        <div className="flex min-w-0 gap-4">
          <CompanyLogo company={p.company} />
          <div className="min-w-0">
            <p className="truncate text-[12.5px] text-muted">{p.company.name}</p>
            <h3 className="type-h4 mt-0.5">
              <Link href={href} className="transition-colors hover:text-red">
                {p.name}
              </Link>
            </h3>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
              <Tag>{INS_PRODUCT_CATEGORY_LABEL[p.category]}</Tag>
              {promotion && (
                <Tag tone="red" className="max-w-full truncate" >
                  {promotion}
                </Tag>
              )}
              <span className="text-[12px] text-muted num">{termLabel(p.pricing)}</span>
            </div>
            {p.soldBy && <p className="mt-2 text-[11.5px] text-muted">Sold by {p.soldBy}</p>}
          </div>
        </div>
        <div className="flex items-end justify-between gap-4 border-t border-line pt-4 md:block md:border-0 md:pt-0 md:text-right">
          <div>
            <IndicativeLabel align="right" />
            <p className="mt-1 font-display text-[28px] font-semibold leading-none tracking-[-0.03em] text-ink [font-stretch:106%] num md:text-[30px]">{inr(e.total)}</p>
            <p className="mt-1.5 text-[11.5px] text-muted num">incl. {e.gstPct}% GST</p>
          </div>
          <Button size="sm" variant="primary" onClick={onRequest} className="md:mt-4 md:w-full">
            Request quote
          </Button>
        </div>
      </div>

      {/* Figures */}
      <dl className="grid grid-cols-2 gap-px border-y border-line bg-line sm:grid-cols-4">
        <div className="bg-white px-5 py-3.5 md:px-6">
          <dt className="flex items-center gap-1 text-[11.5px] text-muted">
            IDV
            <InfoTip label="What is IDV?" align="left">
              Insured declared value — roughly what the insurer pays if the car is stolen or written off. A higher IDV means a higher own-damage premium.
            </InfoTip>
          </dt>
          <dd className="mt-1 flex items-center gap-2">
            <span className="text-[14px] font-medium text-ink num">{hasOd ? formatPriceShort(e.idv) : "Not applicable"}</span>
            {hasOd && e.idvMax > e.idvMin && (
              <button
                type="button"
                onClick={() => setIdvOpen((v) => !v)}
                aria-expanded={idvOpen}
                className="inline-flex items-center gap-1 text-[12px] font-medium text-ink underline-offset-4 hover:text-red hover:underline"
              >
                <SlidersHorizontal className="size-3" aria-hidden />
                Adjust
              </button>
            )}
          </dd>
        </div>
        <div className="bg-white px-5 py-3.5 md:px-6">
          <Figure label="Cover" hint={p.coverage.thirdParty && p.coverage.tpPropertyLimit ? `TP property ${p.coverage.tpPropertyLimit}` : undefined}>
            {[p.coverage.ownDamage && "Own damage", p.coverage.thirdParty && "Third party"].filter(Boolean).join(" + ") || "—"}
          </Figure>
        </div>
        <div className="bg-white px-5 py-3.5 md:px-6">
          <Figure label="Deductible" hint={p.deductibles.voluntary.length ? `Voluntary from ${inr(Math.min(...p.deductibles.voluntary))}` : "Compulsory, per claim"}>
            {p.deductibles.compulsory ? inr(p.deductibles.compulsory) : "None"}
          </Figure>
        </div>
        <div className="bg-white px-5 py-3.5 md:px-6">
          <Figure label="Cashless garages" hint="As stated by the insurer">
            {p.garageCount ? formatNumber(p.garageCount) : "Not stated"}
          </Figure>
        </div>
      </dl>

      <AnimatePresence initial={false}>
        {idvOpen && hasOd && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: EASE }} className="overflow-hidden">
            <div className="grid grid-cols-1 gap-4 border-b border-line bg-mist/50 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end md:px-6">
              <RangeField
                label="Choose the IDV within this plan's band"
                value={e.idv}
                min={e.idvMin}
                max={e.idvMax}
                step={1000}
                onChange={(v) => onIdv(v)}
                format={(v) => inr(v)}
                minLabel={inr(e.idvMin)}
                maxLabel={inr(e.idvMax)}
              />
              <Button size="sm" variant="ghost" onClick={() => onIdv(null)}>
                Reset to suggested
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add-ons */}
      <div className="px-5 py-4 md:px-6">
        <p className="text-[11.5px] text-muted">Key add-ons</p>
        <ul className="mt-2.5 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
          {keyAddOns.map(({ std, line }) => (
            <li key={std.key} className="flex items-center justify-between gap-3 sm:justify-start">
              <span className="text-[12.5px] text-ink sm:min-w-36">{std.name}</span>
              <AddOnMark status={line ? line.status : "none"} premium={line?.premium} compact />
            </li>
          ))}
        </ul>
        {otherIncluded.length > 0 && <p className="mt-3 text-[12px] text-muted">Also included: {otherIncluded.map((l) => l.cover.name).join(", ")}</p>}
      </div>

      <AnimatePresence initial={false}>
        {breakdownOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: EASE }} className="overflow-hidden">
            <Breakdown est={est} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-line px-5 py-3.5 md:px-6">
        <label className={cn("inline-flex cursor-pointer items-center gap-2.5 text-[13px] font-medium text-ink", selectDisabled && !selected && "cursor-not-allowed opacity-45")}>
          <input type="checkbox" checked={selected} disabled={selectDisabled && !selected} onChange={(ev) => onSelect(ev.target.checked)} className="size-4 accent-[var(--color-red)]" />
          Select
        </label>
        <button type="button" onClick={() => setBreakdownOpen((v) => !v)} aria-expanded={breakdownOpen} className="inline-flex items-center gap-1 text-[13px] font-medium text-ink hover:text-red">
          Premium breakdown
          <ChevronDown className={cn("size-3.5 transition-transform duration-300", breakdownOpen && "rotate-180")} aria-hidden />
        </button>
        <span className="hidden flex-1 sm:block" />
        <button
          type="button"
          onClick={onCompare}
          aria-pressed={inCompare}
          className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors", inCompare ? "text-red" : "text-ink hover:text-red")}
        >
          {inCompare ? <Check className="size-3.5" aria-hidden /> : <GitCompareArrows className="size-3.5" aria-hidden />}
          {inCompare ? "In compare" : "Add to compare"}
        </button>
        <Link href={href} className="group/d inline-flex items-center gap-1 text-[13px] font-medium text-ink hover:text-red">
          Details
          <ArrowUpRight className="size-3.5 text-red transition-transform group-hover/d:-translate-y-0.5 group-hover/d:translate-x-0.5" aria-hidden />
        </Link>
      </div>
    </article>
  );
}

/** The estimate line by line. */
export function Breakdown({ est, className }: { est: MarketEstimate; className?: string }) {
  const e = est.estimate;
  const rows: [string, number, string?][] = [];
  if (e.odYears > 0) rows.push([`Own damage (${e.odYears} yr)`, e.od]);
  if (e.ncbDiscount) rows.push([`No-claim bonus (${e.ncbPct}%)`, -e.ncbDiscount]);
  if (e.tpYears > 0) rows.push([`Third-party liability (${e.tpYears} yr)`, e.tp]);
  if (e.pa) rows.push(["Owner-driver personal accident", e.pa]);
  for (const a of e.addOns) rows.push([`${a.name}${a.included ? " (included)" : ""}`, a.premium]);
  return (
    <div className={cn("border-t border-line bg-mist/40 px-5 py-5 md:px-6", className)}>
      <table className="w-full max-w-lg text-[13px]">
        <caption className="sr-only">Indicative premium breakdown</caption>
        <tbody>
          {rows.map(([label, v]) => (
            <tr key={label}>
              <th scope="row" className="py-1 pr-4 text-left font-normal text-muted">
                {label}
              </th>
              <td className={cn("py-1 text-right num", v < 0 ? "text-ink" : "text-ink")}>{v < 0 ? `− ${inr(-v)}` : inr(v)}</td>
            </tr>
          ))}
          <tr className="border-t border-line">
            <th scope="row" className="pt-2 pr-4 text-left font-medium text-ink">
              Net premium
            </th>
            <td className="pt-2 text-right font-medium num">{inr(e.net)}</td>
          </tr>
          <tr>
            <th scope="row" className="py-1 pr-4 text-left font-normal text-muted">
              GST ({e.gstPct}%)
            </th>
            <td className="py-1 text-right num">{inr(e.gst)}</td>
          </tr>
          <tr className="border-t border-ink">
            <th scope="row" className="pt-2 pr-4 text-left font-semibold text-ink">
              Indicative total
            </th>
            <td className="pt-2 text-right font-semibold num">{inr(e.total)}</td>
          </tr>
        </tbody>
      </table>
      {e.notes.length > 0 && (
        <ul className="mt-4 space-y-1 text-[11.5px] leading-relaxed text-muted">
          {e.notes.map((n) => (
            <li key={n}>· {n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
