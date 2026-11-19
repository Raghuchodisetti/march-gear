"use client";

import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { SelectField } from "@/components/ui/field";

export interface ActiveFilter {
  key: string;
  label: string;
  onRemove: () => void;
}

export interface SortConfig {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

/** Removable chips for every applied filter, plus "Clear all". */
export function ActiveFilters({ items, onClear, className }: { items: ActiveFilter[]; onClear: () => void; className?: string }) {
  return (
    <AnimatePresence initial={false}>
      {items.length > 0 && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="overflow-hidden"
        >
          <div className={cn("relative flex flex-wrap items-center gap-2", className)}>
            <span className="mr-1 text-[12.5px] text-muted">Applied</span>
            <AnimatePresence initial={false} mode="popLayout">
              {items.map((item) => (
                <motion.button
                  layout
                  key={item.key}
                  type="button"
                  onClick={item.onRemove}
                  aria-label={`Remove filter: ${item.label}`}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-ink/15 bg-white pl-3 pr-2 text-[12.5px] font-medium text-ink transition-colors duration-[250ms] hover:border-ink"
                >
                  {item.label}
                  <X aria-hidden className="size-3.5 text-muted" />
                </motion.button>
              ))}
            </AnimatePresence>
            <motion.button
              layout
              type="button"
              onClick={onClear}
              className="ml-1 h-8 text-[12.5px] font-medium text-red underline-offset-[5px] hover:underline"
            >
              Clear all
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function SortSelect({ sort, className }: { sort: SortConfig; className?: string }) {
  return (
    <SelectField
      aria-label="Sort results"
      value={sort.value}
      onChange={(e) => sort.onChange(e.target.value)}
      options={sort.options}
      className={className}
    />
  );
}
