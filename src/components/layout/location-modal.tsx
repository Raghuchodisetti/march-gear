"use client";

import { useState } from "react";
import { Check, LocateFixed, Loader2, Search } from "lucide-react";
import { cities } from "@/data/cities";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/overlay";
import { useCity, useUI } from "@/components/providers/app-provider";

export function LocationModal() {
  const { locationOpen, setLocationOpen, toast } = useUI();
  const { city, setCity } = useCity();
  const [query, setQuery] = useState("");
  const [detecting, setDetecting] = useState(false);

  const close = () => {
    setLocationOpen(false);
    setQuery("");
  };

  const choose = (slug: string, name: string) => {
    setCity(slug);
    close();
    toast(`Showing prices and dealers for ${name}`, { tone: "success" });
  };

  const filtered = cities.filter((c) => `${c.name} ${c.state}`.toLowerCase().includes(query.trim().toLowerCase()));
  const popular = filtered.filter((c) => c.popular);
  const others = filtered.filter((c) => !c.popular);

  return (
    <Modal open={locationOpen} onClose={close} title="Choose your city" description="We'll tailor on-road prices, offers and dealers to your location." size="lg">
      <div className="p-6 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              data-autofocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your city"
              aria-label="Search your city"
              className="h-12 w-full rounded-[3px] border border-line pl-11 pr-4 text-[15px] outline-none transition-colors focus:border-ink"
            />
          </div>
          <button
            type="button"
            disabled={detecting}
            onClick={() => {
              setDetecting(true);
              window.setTimeout(() => {
                setDetecting(false);
                choose("bengaluru", "Bengaluru (demo detection)");
              }, 1100);
            }}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-[3px] border border-ink px-5 text-[14px] font-medium transition-colors hover:bg-ink hover:text-white disabled:opacity-60"
          >
            {detecting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LocateFixed className="size-4 text-red" aria-hidden />}
            {detecting ? "Detecting…" : "Use my location"}
          </button>
        </div>

        {popular.length > 0 && (
          <>
            <p className="type-eyebrow mt-8 text-muted">Popular cities</p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {popular.map((c) => {
                const selected = c.slug === city.slug;
                return (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => choose(c.slug, c.name)}
                    aria-pressed={selected}
                    className={cn(
                      "relative flex h-20 flex-col items-start justify-end border p-3 text-left transition-[border-color,background-color] duration-[250ms]",
                      selected ? "border-ink bg-ink text-white" : "border-line hover:border-ink/40",
                    )}
                  >
                    {selected && <Check className="absolute right-3 top-3 size-4 text-red" aria-hidden />}
                    <span className="font-display text-[15px] font-semibold tracking-[-0.01em]">{c.name}</span>
                    <span className={cn("text-[11.5px]", selected ? "text-white/60" : "text-muted")}>{c.state}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {others.length > 0 && (
          <>
            <p className="type-eyebrow mt-8 text-muted">Other cities</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {others.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => choose(c.slug, c.name)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-[13px] transition-colors duration-[250ms]",
                    c.slug === city.slug ? "border-ink bg-ink text-white" : "border-line hover:border-ink",
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </>
        )}

        {filtered.length === 0 && <p className="mt-8 text-center text-muted">We&apos;re not in “{query}” yet — try a nearby city.</p>}
      </div>
    </Modal>
  );
}
