"use client";

import { useId, type KeyboardEvent, type ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";

export interface TabItem {
  value: string;
  label: ReactNode;
  count?: number;
}

/**
 * Keyboard support for any role="tablist" (ARIA tabs pattern): arrow keys move to the next/previous tab
 * and select it (by clicking it), Home/End jump to the ends. Vertical lists also take Up/Down
 * (and keep Left/Right, as some of them lay out as a horizontal row on phones).
 */
export function onTablistKeyDown(e: KeyboardEvent<HTMLElement>) {
  const vertical = e.currentTarget.getAttribute("aria-orientation") === "vertical";
  const prev = vertical ? ["ArrowUp", "ArrowLeft"] : ["ArrowLeft"];
  const next = vertical ? ["ArrowDown", "ArrowRight"] : ["ArrowRight"];
  if (![...prev, ...next, "Home", "End"].includes(e.key)) return;
  const tabs = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]:not([disabled])'));
  const i = tabs.indexOf(document.activeElement as HTMLElement);
  if (i < 0) return;
  e.preventDefault();
  const n = tabs.length;
  const to = e.key === "Home" ? 0 : e.key === "End" ? n - 1 : next.includes(e.key) ? (i + 1) % n : (i - 1 + n) % n;
  tabs[to].focus();
  tabs[to].click();
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
  const hasSelected = items.some((t) => t.value === value);
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onTablistKeyDown}
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
            // Only the selected tab sits in the Tab order; arrow keys reach the rest.
            tabIndex={active || (!hasSelected && item === items[0]) ? 0 : -1}
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
              <span className={cn("ml-1.5 text-xs num", active && (tone === "dark" ? "text-red-600" : "text-red-400"))}>{item.count}</span>
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
