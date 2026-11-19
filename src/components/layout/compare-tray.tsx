"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, GitCompareArrows, Plus, X } from "lucide-react";
import { getCar } from "@/data/cars";
import { brandName } from "@/data/brands";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { MAX_COMPARE, useCompare } from "@/components/providers/app-provider";

/** Pages that carry their own sticky bottom action bar on mobile. */
const HAS_BOTTOM_BAR = /^\/(cars|used-cars|electric-cars)\/[^/]+/;

export function CompareTray() {
  const pathname = usePathname();
  const { slugs, remove, clear } = useCompare();
  const [collapsed, setCollapsed] = useState(false);

  const cars = slugs.map(getCar).filter((c) => c !== undefined);
  const visible = cars.length > 0 && !pathname.startsWith("/compare");
  const href = `/compare?cars=${slugs.join(",")}`;
  const raised = HAS_BOTTOM_BAR.test(pathname);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className={cn(
            "fixed inset-x-0 z-[60] flex justify-center px-4 md:bottom-6",
            raised ? "bottom-[88px]" : "bottom-4",
          )}
        >
          {/* Mobile: compact pill */}
          <Link
            href={href}
            className="flex items-center gap-3 rounded-full bg-ink py-2 pl-2 pr-5 text-white shadow-lift md:hidden"
          >
            <span className="flex -space-x-2">
              {cars.map((c) => (
                <span key={c.slug} className="relative size-8 overflow-hidden rounded-full border-2 border-ink bg-ink-3">
                  <Image src={c.images[0]} alt="" fill sizes="32px" className="object-cover" />
                </span>
              ))}
            </span>
            <span className="text-[13px] font-medium">
              Compare <span className="num text-white/60">{cars.length}/{MAX_COMPARE}</span>
            </span>
          </Link>

          {/* Desktop: full tray */}
          <div className="hidden w-full max-w-4xl bg-ink text-white shadow-lift md:block">
            <div className="flex items-center justify-between gap-4 px-5 py-3">
              <button type="button" onClick={() => setCollapsed((c) => !c)} className="flex items-center gap-2.5 text-[13px] font-medium" aria-expanded={!collapsed}>
                <GitCompareArrows className="size-4 text-red" aria-hidden />
                Compare list <span className="text-white/50 num">{cars.length} of {MAX_COMPARE}</span>
                <ChevronDown aria-hidden className={cn("size-4 text-white/60 transition-transform duration-[350ms]", collapsed && "rotate-180")} />
              </button>
              <div className="flex items-center gap-2">
                <button type="button" onClick={clear} className="h-9 px-3 text-[13px] text-white/60 transition-colors hover:text-white">
                  Clear
                </button>
                <Link
                  href={href}
                  aria-disabled={cars.length < 2}
                  className={cn(
                    "inline-flex h-9 items-center rounded-[3px] px-4 text-[13px] font-medium transition-colors duration-[250ms]",
                    cars.length < 2 ? "pointer-events-none bg-white/10 text-white/40" : "bg-red text-white hover:bg-red-600",
                  )}
                >
                  {cars.length < 2 ? "Add one more to compare" : `Compare ${cars.length} cars`}
                </Link>
              </div>
            </div>
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: "auto" }}
                  exit={{ height: 0 }}
                  transition={{ duration: 0.4, ease: EASE }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-4 gap-px border-t border-white/10 bg-white/10">
                    {Array.from({ length: MAX_COMPARE }, (_, i) => {
                      const car = cars[i];
                      if (!car)
                        return (
                          <Link key={`empty-${i}`} href="/new-cars" className="flex h-20 items-center justify-center gap-2 bg-ink text-[12.5px] text-white/40 transition-colors hover:text-white">
                            <Plus className="size-4" aria-hidden /> Add a car
                          </Link>
                        );
                      return (
                        <div key={car.slug} className="group relative flex h-20 items-center gap-3 bg-ink px-3">
                          <span className="relative h-12 w-16 shrink-0 overflow-hidden bg-ink-3">
                            <Image src={car.images[0]} alt="" fill sizes="64px" className="object-cover" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[11px] text-white/50">{brandName(car.brand)}</span>
                            <span className="block truncate text-[13px] font-medium">{car.name}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => remove(car.slug)}
                            aria-label={`Remove ${car.name} from compare`}
                            className="absolute right-2 top-2 inline-flex size-6 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
