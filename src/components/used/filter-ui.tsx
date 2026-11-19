"use client";

import { cn } from "@/lib/utils";

/** Shared building blocks for listing filters (used cars, dealers). */

export function ClearAllButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-[13px] font-medium text-muted underline decoration-line underline-offset-4 transition-colors duration-[250ms] hover:text-ink hover:decoration-ink",
        className,
      )}
    >
      Clear all
    </button>
  );
}
