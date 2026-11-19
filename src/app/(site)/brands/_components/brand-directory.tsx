"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Zap } from "lucide-react";
import type { BrandSegment, BrandSummary } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { EASE } from "@/lib/motion";
import { Tabs } from "@/components/ui/tabs";
import { BrandMonogram } from "@/components/ui/page-header";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/** Segment tabs, an A–Z jump rail and letter-grouped brand tiles. */
export function BrandDirectory({ summaries, segments }: { summaries: BrandSummary[]; segments: { value: BrandSegment; label: string }[] }) {
  const [segment, setSegment] = useState<BrandSegment>("all");
  const visible = summaries.filter((s) => s.segments.includes(segment));

  const groups = new Map<string, BrandSummary[]>();
  visible.forEach((s) => {
    const letter = s.brand.name[0].toUpperCase();
    groups.set(letter, [...(groups.get(letter) ?? []), s]);
  });

  return (
    <div>
      <div className="flex min-w-0 flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <Tabs
          ariaLabel="Brand segments"
          value={segment}
          onChange={(v) => setSegment(v as BrandSegment)}
          items={segments.map((s) => ({ value: s.value, label: s.label, count: summaries.filter((x) => x.segments.includes(s.value)).length }))}
          className="min-w-0 lg:border-b-0"
        />
        <nav aria-label="Jump to letter" className="no-scrollbar -mx-5 flex min-w-0 overflow-x-auto px-5 md:mx-0 md:px-0 lg:pb-3.5">
          {ALPHABET.map((l) =>
            groups.has(l) ? (
              <a
                key={l}
                href={`#brands-${l}`}
                className="inline-flex size-8 shrink-0 items-center justify-center text-[13px] font-semibold text-ink transition-colors hover:text-red"
              >
                {l}
              </a>
            ) : (
              <span key={l} aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center text-[13px] text-ink/20">
                {l}
              </span>
            ),
          )}
        </nav>
      </div>

      <div className="relative mt-2 border-b border-line lg:mt-0">
        <AnimatePresence mode="popLayout" initial={false}>
          {Array.from(groups, ([letter, items]) => (
            <motion.section
              key={`${segment}-${letter}`}
              id={`brands-${letter}`}
              aria-label={`Brands starting with ${letter}`}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: EASE }}
              className="grid scroll-mt-28 grid-cols-1 gap-6 border-t border-line py-8 md:grid-cols-[96px_minmax(0,1fr)] md:gap-10 md:py-10 lg:grid-cols-[160px_minmax(0,1fr)]"
            >
              <p aria-hidden className="font-display text-[44px] font-semibold leading-[0.85] tracking-[-0.05em] [font-stretch:115%] md:text-[72px]">
                {letter}
              </p>
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((s) => (
                  <li key={s.brand.slug}>
                    <BrandTile summary={s} />
                  </li>
                ))}
              </ul>
            </motion.section>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function BrandTile({ summary }: { summary: BrandSummary }) {
  const { brand, models, evs, startingPrice } = summary;
  return (
    <Link
      href={`/brands/${brand.slug}`}
      className="group/brand flex h-full flex-col justify-between gap-10 border border-line bg-white p-6 transition-[border-color,background-color] duration-[400ms] ease-[var(--ease-premium)] hover:border-ink/30"
    >
      <div className="flex items-start justify-between gap-4">
        <BrandMonogram
          name={brand.name}
          className="size-14 text-[19px] transition-colors duration-[400ms] group-hover/brand:bg-ink group-hover/brand:text-white"
        />
        <span className="flex items-center gap-2">
          {brand.isLuxury && <span className="type-eyebrow text-muted">Luxury</span>}
          <ArrowUpRight
            aria-hidden
            className="size-5 text-red opacity-0 transition-[opacity,transform] duration-[250ms] group-hover/brand:-translate-y-0.5 group-hover/brand:translate-x-0.5 group-hover/brand:opacity-100"
          />
        </span>
      </div>
      <div>
        <h3 className="type-h3">{brand.name}</h3>
        <p className="mt-1 text-[13px] text-muted">
          {brand.country} · Est. <span className="num">{brand.founded}</span>
        </p>
        <dl className="mt-5 flex items-baseline justify-between gap-4 border-t border-line pt-4 text-[13px]">
          <div className="flex items-baseline gap-3">
            <dt className="sr-only">Models on sale</dt>
            <dd className="font-medium num">
              {models} {models === 1 ? "model" : "models"}
            </dd>
            {evs > 0 && (
              <>
                <dt className="sr-only">Electric models</dt>
                <dd className="inline-flex items-center gap-0.5 text-muted num">
                  <Zap aria-hidden className="size-3" />
                  {evs} EV
                </dd>
              </>
            )}
          </div>
          {startingPrice !== undefined && (
            <div className="text-right">
              <dt className="inline text-muted">from </dt>
              <dd className="inline font-semibold num">{formatPrice(startingPrice)}</dd>
            </div>
          )}
        </dl>
      </div>
    </Link>
  );
}
