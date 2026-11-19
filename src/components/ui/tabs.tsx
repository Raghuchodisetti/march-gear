"use client";

import { useId, type ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";

export interface TabItem {
  value: string;
  label: ReactNode;
  count?: number;
}

/** Underline tabs with an animated red indicator. Controlled. */
export function Tabs({
  items,
  value,
  onChange,
  className,
  tone = "dark",
  size = "md",
  ariaLabel,
}: {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  tone?: "dark" | "light";
  size?: "sm" | "md";
  ariaLabel?: string;
}) {
  const id = useId();
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "no-scrollbar flex gap-7 overflow-x-auto border-b",
        tone === "dark" ? "border-line" : "border-white/15",
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "relative shrink-0 whitespace-nowrap pb-3.5 font-medium transition-colors duration-[250ms]",
              size === "md" ? "text-[15px]" : "text-[13px]",
              tone === "dark"
                ? active
                  ? "text-ink"
                  : "text-muted hover:text-ink"
                : active
                  ? "text-white"
                  : "text-white/50 hover:text-white",
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span className={cn("ml-1.5 text-xs num", active ? "text-red" : "opacity-60")}>{item.count}</span>
            )}
            {active && (
              <motion.span
                layoutId={`tab-indicator-${id}`}
                className="absolute inset-x-0 -bottom-px h-[2px] bg-red"
                transition={{ duration: 0.4, ease: EASE }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
