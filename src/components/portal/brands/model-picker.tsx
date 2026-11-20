"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronDown, Search } from "lucide-react";
import type { BrandAuthStatus } from "@/db/enums";
import { BRAND_STATUS_LABEL, BRAND_STATUS_TONE } from "@/partner/labels";
import { formatPrice, formatPriceRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import { saveBrandModelsAction } from "@/server/actions/partner-brands";
import { Badge } from "@/components/portal/ui";
import { useCatalog } from "@/components/providers/catalog-provider";
import { useUI } from "@/components/providers/app-provider";
import { BrandLogo, hasBrandLogo } from "@/components/ui/brand-logo";
import { Button } from "@/components/ui/button";
import { Check2 } from "@/components/portal/profile/kit";

export interface BrandLineup {
  id: number;
  brand: string;
  status: BrandAuthStatus;
  models: string[];
  variants: string[];
}

const key = (car: string, variant: string) => `${car}/${variant}`;

export function ModelPicker({ lineups, initialBrand }: { lineups: BrandLineup[]; initialBrand?: string }) {
  const router = useRouter();
  const { toast } = useUI();
  const { carsByBrand, brandName } = useCatalog();
  const [active, setActive] = useState(lineups.find((l) => l.brand === initialBrand)?.id ?? lineups[0]?.id);
  const [drafts, setDrafts] = useState(() => Object.fromEntries(lineups.map((l) => [l.id, { models: l.models, variants: l.variants }])));
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const saved = useMemo(() => Object.fromEntries(lineups.map((l) => [l.id, JSON.stringify({ models: [...l.models].sort(), variants: [...l.variants].sort() })])), [lineups]);
  const isDirty = (id: number) => JSON.stringify({ models: [...drafts[id].models].sort(), variants: [...drafts[id].variants].sort() }) !== saved[id];
  const dirtyIds = lineups.filter((l) => isDirty(l.id)).map((l) => l.id);

  const lineup = lineups.find((l) => l.id === active);
  const cars = lineup ? carsByBrand(lineup.brand) : [];
  const shown = cars.filter((c) => !q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase()));
  const draft = lineup ? drafts[lineup.id] : { models: [], variants: [] };

  const update = (fn: (d: { models: string[]; variants: string[] }) => { models: string[]; variants: string[] }) => lineup && setDrafts((all) => ({ ...all, [lineup.id]: fn(all[lineup.id]) }));
  const toggleModel = (slug: string, on: boolean) => {
    const car = cars.find((c) => c.slug === slug)!;
    update((d) => ({
      models: on ? [...new Set([...d.models, slug])] : d.models.filter((m) => m !== slug),
      // Selecting a model selects all its variants; you can untick the ones you don't stock.
      variants: on ? [...new Set([...d.variants, ...car.variants.map((v) => key(slug, v.slug))])] : d.variants.filter((v) => !v.startsWith(`${slug}/`)),
    }));
    if (on) setOpen(slug);
  };
  const toggleVariant = (car: string, variant: string, on: boolean) =>
    update((d) => {
      const variants = on ? [...new Set([...d.variants, key(car, variant)])] : d.variants.filter((v) => v !== key(car, variant));
      const models = variants.some((v) => v.startsWith(`${car}/`)) ? [...new Set([...d.models, car])] : d.models;
      return { models, variants };
    });
  const all = (on: boolean) => update(() => (on ? { models: cars.map((c) => c.slug), variants: cars.flatMap((c) => c.variants.map((v) => key(c.slug, v.slug))) } : { models: [], variants: [] }));

  const save = async () => {
    setBusy(true);
    let failed = false;
    try {
      for (const id of dirtyIds) {
        const res = await saveBrandModelsAction({ id, ...drafts[id] });
        if (!res.ok) {
          failed = true;
          toast(res.error ?? "Couldn't save the line-up.", { tone: "error" });
          break;
        }
      }
      if (!failed) toast(dirtyIds.length > 1 ? "Line-ups saved." : "Line-up saved.", { tone: "success" });
      router.refresh();
    } catch {
      toast("Couldn't reach the server. Please try again.", { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  if (!lineup) return null;
  const selectedModels = draft.models.length;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <nav aria-label="Brands" className="min-w-0">
        <ul className="no-scrollbar flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {lineups.map((l) => {
            const on = l.id === active;
            const d = drafts[l.id];
            return (
              <li key={l.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setActive(l.id);
                    setQ("");
                    setOpen(null);
                  }}
                  aria-current={on ? "true" : undefined}
                  className={cn("flex w-full items-center gap-3 border bg-white px-3 py-2.5 text-left transition-colors duration-300", on ? "border-ink" : "border-line hover:border-ink/30")}
                >
                  <span className="flex h-9 w-12 shrink-0 items-center justify-center">
                    {hasBrandLogo(l.brand) ? <BrandLogo slug={l.brand} className="max-h-full" /> : <span className="text-[12px] font-semibold">{brandName(l.brand).slice(0, 3)}</span>}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 whitespace-nowrap text-[13.5px] font-medium">
                      {brandName(l.brand)}
                      {isDirty(l.id) && <span aria-label="Unsaved changes" className="size-1.5 rounded-full bg-red" />}
                    </span>
                    <span className="block whitespace-nowrap text-[11.5px] text-muted num">
                      {d.models.length} {d.models.length === 1 ? "model" : "models"} · {d.variants.length} {d.variants.length === 1 ? "variant" : "variants"}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <section className="min-w-0 border border-line bg-white">
        <header className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-[16px] font-semibold">{brandName(lineup.brand)}</h2>
            <Badge tone={BRAND_STATUS_TONE[lineup.status]}>{BRAND_STATUS_LABEL[lineup.status]}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <label className="relative block min-w-0 flex-1 sm:w-56 sm:flex-none">
              <span className="sr-only">Search models</span>
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search models" className="h-9 w-full rounded-[3px] border border-line pl-9 pr-3 text-[13px] outline-none focus:border-ink" />
            </label>
            <button type="button" onClick={() => all(selectedModels < cars.length)} className="h-9 shrink-0 rounded-[3px] px-2.5 text-[12.5px] font-medium text-muted hover:bg-mist hover:text-ink">
              {selectedModels < cars.length ? "Select all" : "Clear all"}
            </button>
          </div>
        </header>
        {lineup.status === "pending" && <p className="border-b border-line bg-mist/60 px-5 py-2.5 text-[12.5px] text-muted">This brand is still in review. You can prepare your line-up now — it&apos;s used once MarchGear approves the authorisation.</p>}

        {cars.length === 0 ? (
          <p className="px-5 py-14 text-center text-[13.5px] text-muted">MarchGear&apos;s catalogue has no current models for {brandName(lineup.brand)} yet.</p>
        ) : shown.length === 0 ? (
          <p className="px-5 py-14 text-center text-[13.5px] text-muted">No models match “{q}”.</p>
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((c) => {
              const picked = draft.models.includes(c.slug);
              const vCount = draft.variants.filter((v) => v.startsWith(`${c.slug}/`)).length;
              const expanded = open === c.slug;
              return (
                <li key={c.slug}>
                  <div className="flex items-center gap-3 px-5 py-3.5">
                    <Check2 checked={picked} onChange={(on) => toggleModel(c.slug, on)} label={<span className="sr-only">Sell the {c.name}</span>} />
                    <span className="relative hidden h-11 w-16 shrink-0 overflow-hidden bg-mist sm:block">
                      {c.images[0] && <Image src={c.images[0]} alt="" fill sizes="64px" className="object-cover" />}
                    </span>
                    <button type="button" onClick={() => setOpen(expanded ? null : c.slug)} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left">
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-medium">{c.name}</span>
                        <span className="block truncate text-[12px] text-muted">
                          {c.bodyType} · {formatPriceRange(c.priceMin, c.priceMax)}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-[12px] text-muted">
                        <span className="num">
                          {picked ? `${vCount}/${c.variants.length}` : c.variants.length} variants
                        </span>
                        <ChevronDown aria-hidden className={cn("size-4 transition-transform duration-300", expanded && "rotate-180")} />
                      </span>
                    </button>
                  </div>
                  {expanded && (
                    <div className="animate-rise border-t border-line bg-[#fbfbfb] px-5 py-4 sm:pl-[5.5rem]">
                      <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
                        {c.variants.map((v) => (
                          <Check2
                            key={v.slug}
                            checked={draft.variants.includes(key(c.slug, v.slug))}
                            onChange={(on) => toggleVariant(c.slug, v.slug, on)}
                            label={v.name}
                            hint={`${v.fuel} · ${v.transmission} · ${formatPrice(v.price)}`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <footer className="sticky bottom-0 flex flex-col gap-3 border-t border-line bg-white/95 px-5 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12.5px] text-muted">
            {dirtyIds.length ? `Unsaved changes in ${dirtyIds.map((id) => brandName(lineups.find((l) => l.id === id)!.brand)).join(", ")}.` : "Your line-up is saved. It's used when you list new cars and target offers."}
          </p>
          <div className="flex gap-2">
            {dirtyIds.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setDrafts(Object.fromEntries(lineups.map((l) => [l.id, { models: l.models, variants: l.variants }])))} disabled={busy}>
                Discard
              </Button>
            )}
            <Button variant="dark" size="sm" onClick={save} disabled={busy || dirtyIds.length === 0}>
              {busy ? "Saving…" : "Save line-up"}
            </Button>
          </div>
        </footer>
      </section>
    </div>
  );
}
