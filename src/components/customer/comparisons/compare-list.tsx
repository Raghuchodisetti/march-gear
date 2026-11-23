"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import { GitCompareArrows, Plus, Smartphone, X } from "lucide-react";
import type { CarModel } from "@/types";
import { formatPriceRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCompare, useUI, useUser } from "@/components/providers/app-provider";
import { useCatalog } from "@/components/providers/catalog-provider";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/portal/profile/kit";
import { PopularComparisons } from "@/components/compare/popular-comparisons";

/* /account/comparisons: the compare list (kept in this browser) and quick sets built from saved cars. */

const compareHref = (slugs: string[]) => `/compare?cars=${slugs.join(",")}`;

function Thumb({ car, className }: { car: CarModel; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden bg-mist", className)}>
      <Image src={car.images[0]} alt="" fill sizes="160px" className="object-cover" style={{ objectPosition: car.focus ?? "50% 55%" }} />
    </div>
  );
}

/** The compare list from this browser, with open / remove / clear. */
export function CurrentCompare() {
  const { ready } = useUser();
  const { slugs, remove, clear, max } = useCompare();
  const { getCar, brandName } = useCatalog();
  const { toast } = useUI();
  const [confirm, setConfirm] = useState(false);
  const list = slugs.map(getCar).filter((c): c is CarModel => c !== undefined);

  if (!ready) {
    return (
      <div aria-busy="true" aria-label="Loading your compare list" className="border border-line bg-white p-5 md:p-6">
        <div className="skeleton h-4 w-40" />
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton aspect-[4/3]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section aria-labelledby="compare-now" className="border border-line bg-white">
      <header className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
        <div className="min-w-0">
          <h2 id="compare-now" className="text-[15px] font-semibold tracking-[-0.01em]">
            Your compare list
          </h2>
          <p className="mt-0.5 text-[12.5px] text-muted">
            <span className="num">{list.length}</span> of {max} cars · kept in this browser
          </p>
        </div>
        {list.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setConfirm(true)} className="inline-flex h-9 items-center rounded-[3px] px-3 text-[13px] font-medium text-muted transition-colors hover:bg-mist hover:text-red">
              Clear list
            </button>
            {list.length >= 2 ? (
              <Button href={compareHref(list.map((c) => c.slug))} variant="primary" size="sm" arrow>
                Open comparison
              </Button>
            ) : (
              <Button href="/new-cars" variant="outline" size="sm" icon={<Plus aria-hidden className="size-4" />}>
                Add another car
              </Button>
            )}
          </div>
        )}
      </header>

      {list.length === 0 ? (
        <div className="flex flex-col items-start gap-5 px-5 py-8 sm:flex-row sm:items-center md:px-6">
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-mist">
            <GitCompareArrows aria-hidden className="size-5 text-ink/70" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-semibold">Nothing to compare yet</p>
            <p className="mt-1 max-w-lg text-[13px] leading-relaxed text-muted">
              Tick &ldquo;Compare&rdquo; on up to {max} cars and line them up spec for spec — price, safety, efficiency and features. Or start from your saved cars below.
            </p>
          </div>
          <Button href="/compare" variant="dark" size="sm" arrow>
            Start a comparison
          </Button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 xl:grid-cols-4">
          {list.map((car) => {
            const title = `${brandName(car.brand)} ${car.name}`;
            return (
              <li key={car.slug} className="relative flex items-center gap-3 bg-white p-4 xl:flex-col xl:items-stretch">
                <Thumb car={car} className="aspect-[4/3] w-24 shrink-0 xl:w-full" />
                <div className="min-w-0 flex-1">
                  <Link href={`/cars/${car.slug}`} className="block truncate text-[14px] font-semibold transition-colors hover:text-red">
                    {title}
                  </Link>
                  <p className="mt-0.5 text-[12.5px] text-muted num">{formatPriceRange(car.priceMin, car.priceMax)}</p>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${title} from compare`}
                  onClick={() => {
                    remove(car.slug);
                    toast(`Removed ${title} from compare`);
                  }}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-mist hover:text-red xl:absolute xl:right-5 xl:top-5 xl:bg-white/90 xl:backdrop-blur-sm"
                >
                  <X aria-hidden className="size-4" />
                </button>
              </li>
            );
          })}
          {Array.from({ length: max - list.length }, (_, i) => (
            <li key={`slot-${i}`} className="hidden bg-white p-4 xl:block">
              <Link href="/new-cars" className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 border border-dashed border-line text-[12.5px] font-medium text-muted transition-colors hover:border-ink/30 hover:text-ink">
                <Plus aria-hidden className="size-4" /> Add a car
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="flex items-center gap-2 border-t border-line px-5 py-3 text-[12px] text-muted md:px-6">
        <Smartphone aria-hidden className="size-3.5 shrink-0" />
        The compare list lives in this browser, so it may differ on your other devices. Your saved cars are kept on your account.
      </p>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Clear your compare list?"
        body={`${list.length} ${list.length === 1 ? "car" : "cars"} will be removed from the list in this browser. Your saved cars aren't affected.`}
        confirm="Clear list"
        onConfirm={() => {
          clear();
          setConfirm(false);
          toast("Compare list cleared");
        }}
      />
    </section>
  );
}

export interface QuickSet {
  key: string;
  title: string;
  note: string;
  slugs: string[];
}

/** Ready-made comparisons from the customer's saved cars. */
export function QuickSets({ sets }: { sets: QuickSet[] }) {
  const router = useRouter();
  const { set } = useCompare();
  const { getCar, brandName } = useCatalog();
  const { toast } = useUI();

  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {sets.map((s) => {
        const cars = s.slugs.map(getCar).filter((c): c is CarModel => c !== undefined);
        if (cars.length < 2) return null;
        return (
          <li key={s.key} className="flex min-w-0 flex-col border border-line bg-white">
            <div className="relative flex h-32 gap-px bg-line sm:h-40">
              {cars.map((c, i) => (
                <Fragment key={c.slug}>
                  <Thumb car={c} className="h-full min-w-0 flex-1" />
                  {i < cars.length - 1 && (
                    <span
                      aria-hidden
                      className="absolute top-1/2 z-10 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[10px] font-semibold uppercase tracking-[0.08em]"
                      style={{ left: `${((i + 1) / cars.length) * 100}%` }}
                    >
                      vs
                    </span>
                  )}
                </Fragment>
              ))}
            </div>
            <div className="flex flex-1 flex-col p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{s.title}</p>
              <p className="mt-2 text-[15px] font-semibold leading-snug tracking-[-0.01em]">{cars.map((c) => `${brandName(c.brand)} ${c.name}`).join(" vs ")}</p>
              <p className="mt-1.5 text-[12.5px] text-muted">{s.note}</p>
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
                <Button
                  variant="dark"
                  size="sm"
                  arrow
                  onClick={() => {
                    set(cars.map((c) => c.slug));
                    router.push(compareHref(cars.map((c) => c.slug)));
                  }}
                >
                  Compare these
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    set(cars.map((c) => c.slug));
                    toast(`Compare list set to ${cars.length} cars`, { tone: "success", action: { label: "Compare now", href: compareHref(cars.map((c) => c.slug)) } });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  Use as my list
                </Button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Editors' starting points, for customers with nothing saved yet. */
export function StarterComparisons() {
  return <PopularComparisons className="md:grid-cols-2" />;
}
