"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Opt = { value: string; label: string; count: number };

/** City / brand / category filters for /offers. Each change navigates (the page filters on the server). */
export function OfferFilters({ city, brand, category, cities, brands, categories }: { city?: string; brand?: string; category?: string; cities: Opt[]; brands: Opt[]; categories: Opt[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const current = { city, brand, category };
  const go = (patch: Partial<typeof current>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...current, ...patch })) if (v) q.set(k, v);
    const s = q.toString();
    start(() => router.push(s ? `/offers?${s}` : "/offers", { scroll: false }));
  };
  const active = Boolean(city || brand || category);

  const select = (name: keyof typeof current, label: string, opts: Opt[]) => (
    <label className="relative block min-w-0 flex-1">
      <span className="sr-only">{label}</span>
      <select
        value={current[name] ?? ""}
        onChange={(e) => go({ [name]: e.target.value || undefined })}
        className={cn(
          "h-12 w-full cursor-pointer appearance-none rounded-[3px] border bg-white pl-4 pr-10 text-[14.5px] outline-none transition-colors duration-300 hover:border-ink/30 focus:border-ink",
          current[name] ? "border-ink text-ink" : "border-line text-ink/80",
        )}
      >
        <option value="">{label}</option>
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label} ({o.count})
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
    </label>
  );

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center" aria-busy={pending}>
      {select("city", "All cities", cities)}
      {select("brand", "All brands", brands)}
      {select("category", "All offer types", categories)}
      <div className="flex h-12 shrink-0 items-center gap-3 md:w-28 md:justify-end">
        {pending ? (
          <Loader2 aria-label="Updating" className="size-4 animate-spin text-muted" />
        ) : active ? (
          <button type="button" onClick={() => go({ city: undefined, brand: undefined, category: undefined })} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
            <X aria-hidden className="size-4" /> Clear filters
          </button>
        ) : null}
      </div>
    </div>
  );
}
