"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUI } from "@/components/providers/app-provider";

/** A search-field lookalike that opens the global search overlay. */
export function SearchLauncher({ label = "Search cars, brands and stories", className }: { label?: string; className?: string }) {
  const { setSearchOpen } = useUI();
  return (
    <button
      type="button"
      onClick={() => setSearchOpen(true)}
      className={cn(
        "group/search flex h-13 w-full items-center gap-3 rounded-[3px] border border-ink/15 bg-white px-4 text-left text-[15px] text-muted transition-[border-color,color] duration-[250ms] hover:border-ink hover:text-ink sm:max-w-sm",
        className,
      )}
    >
      <Search aria-hidden className="size-4 shrink-0 text-ink" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <kbd className="hidden rounded-[2px] border border-line px-1.5 py-0.5 font-mono text-[11px] text-muted sm:inline-block">/</kbd>
    </button>
  );
}
