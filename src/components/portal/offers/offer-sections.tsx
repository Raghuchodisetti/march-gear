"use client";

import { useMemo, useState } from "react";
import { Building2, CalendarClock, CarFront, Globe2, Info, Layers, Map as MapIcon, MapPin, Plus, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Segmented, SelectField } from "@/components/ui/field";
import { DocumentUploader, ImageUploader } from "@/components/portal/uploader";
import { OFFER_CATEGORIES } from "@/db/enums";
import { OFFER_CATEGORY_LABEL } from "@/partner/labels";
import { INDIAN_STATES, addDays, benefitList, discountHeadline, durationDays, formatIst, fromIstParts, istDay, totalSavings, money, videoHost } from "@/components/offers/offer-utils";
import type { EditorOptions, OfferInput, OfferTemplateView } from "./offer-input";
import { Area, Chip, ChoiceCard, CountField, ErrorNote, Input, MoneyField, PercentField, SectionCard, Toggle } from "./offer-fields";
import { Callout } from "./offer-ui";

export interface SectionProps {
  input: OfferInput;
  update: (fn: (d: OfferInput) => OfferInput) => void;
  err: (path: string) => string | undefined;
  options: EditorOptions;
}

/* ── A · Basic information ──────────────────────────────────── */

export function BasicsSection({ input, update, err, standardTerms }: SectionProps & { standardTerms: string }) {
  const set = <K extends keyof OfferInput>(k: K, v: OfferInput[K]) => update((d) => ({ ...d, [k]: v }));
  return (
    <div className="space-y-6">
      <SectionCard title="Offer identity" description="How customers recognise the offer on MarchGear.">
        <Input label="Offer title" value={input.title} onChange={(v) => set("title", v)} maxLength={160} placeholder="e.g. Diwali Dhamaka — save up to ₹85,000 on the Creta" error={err("title")} />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Input
            label="Campaign name"
            value={input.campaignName}
            onChange={(v) => set("campaignName", v)}
            maxLength={160}
            counter={false}
            placeholder="e.g. Diwali 2026"
            hint="Groups related offers on your campaign calendar."
            error={err("campaignName")}
          />
          <SelectField
            label="Category"
            placeholder="Choose a category"
            value={input.category}
            onChange={(e) => set("category", e.target.value as OfferInput["category"])}
            options={OFFER_CATEGORIES.map((c) => ({ value: c, label: OFFER_CATEGORY_LABEL[c] }))}
            error={err("category")}
          />
        </div>
        <Input label="Tagline" value={input.tagline} onChange={(v) => set("tagline", v)} maxLength={200} placeholder="One line that sells it" hint="Shown under the title on cards and the offer page." error={err("tagline")} />
        <Area
          label="Description"
          value={input.description}
          onChange={(v) => set("description", v)}
          rows={5}
          maxLength={4000}
          placeholder="What the customer gets, who it's for and why now."
          error={err("description")}
        />
      </SectionCard>

      <SectionCard
        title="Terms & conditions"
        description="Shown in full on the offer page. Be specific about eligibility and exclusions."
        action={
          !input.terms.trim() ? (
            <button type="button" onClick={() => set("terms", standardTerms)} className="inline-flex h-9 items-center gap-1.5 rounded-[3px] border border-line px-3 text-[13px] font-medium hover:border-ink">
              <Sparkles aria-hidden className="size-4 text-red" /> Insert standard terms
            </button>
          ) : undefined
        }
      >
        <Area label="Terms" value={input.terms} onChange={(v) => set("terms", v)} rows={9} maxLength={6000} placeholder="• Valid on retail purchases…" error={err("terms")} />
      </SectionCard>
    </div>
  );
}

/* ── B · Vehicle selection ──────────────────────────────────── */

export function VehiclesSection({ input, update, err, options }: SectionProps) {
  const scope = input.scope;
  const setScope = (patch: Partial<OfferInput["scope"]>) => update((d) => ({ ...d, scope: { ...d.scope, ...patch } }));
  const used = scope.vehicleType === "used";
  const pool = used ? options.catalogueBrands : options.brands.filter((b) => b.authorised);
  const pending = used ? [] : options.brands.filter((b) => !b.authorised);
  const selectedBrands = scope.brands.filter((b) => pool.some((p) => p.slug === b));

  const toggleBrand = (slug: string) => {
    if (scope.brands.includes(slug)) {
      const brand = pool.find((b) => b.slug === slug);
      const models = new Set(brand?.models.map((m) => m.slug));
      setScope({ brands: scope.brands.filter((b) => b !== slug), models: scope.models.filter((m) => !models.has(m)), variants: scope.variants.filter((v) => !models.has(v.split("/")[0])) });
    } else setScope({ brands: [...scope.brands, slug] });
  };
  const toggleModel = (brand: string, slug: string) => {
    if (scope.models.includes(slug)) setScope({ models: scope.models.filter((m) => m !== slug), variants: scope.variants.filter((v) => !v.startsWith(`${slug}/`)) });
    else setScope({ models: [...scope.models, slug], brands: scope.brands.includes(brand) ? scope.brands : [...scope.brands, brand] });
  };
  const toggleVariant = (model: string, variant: string) => {
    const key = `${model}/${variant}`;
    setScope({ variants: scope.variants.includes(key) ? scope.variants.filter((v) => v !== key) : [...scope.variants, key] });
  };

  return (
    <div className="space-y-6">
      <SectionCard title="Vehicle type" description="New-car offers need an approved brand authorisation. Pre-owned offers can cover any brand.">
        <Segmented
          className="flex w-full max-w-md"
          ariaLabel="Vehicle type"
          value={scope.vehicleType}
          onChange={(v) => {
            if (v === scope.vehicleType) return;
            // Pre-owned draws from the whole catalogue; new needs authorised brands — reset picks only when the list changes.
            setScope((v === "used") !== used ? { vehicleType: v, brands: [], models: [], variants: [] } : { vehicleType: v });
          }}
          options={[
            { value: "new", label: "New cars" },
            { value: "used", label: "Pre-owned" },
            { value: "both", label: "New & pre-owned" },
          ]}
        />
        <ErrorNote>{err("scope.vehicleType")}</ErrorNote>
        {pending.length > 0 && (
          <Callout tone="blue" icon={<Info />}>
            {pending.map((b) => b.name).join(", ")} {pending.length === 1 ? "is" : "are"} awaiting brand authorisation — you can add {pending.length === 1 ? "it" : "them"} once MarchGear approves.
          </Callout>
        )}
      </SectionCard>

      <SectionCard title="Coverage" description="Apply the offer to everything you sell, or pick models and variants.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2" role="radiogroup" aria-label="Coverage">
          <ChoiceCard name="coverage" checked={scope.allModels} onSelect={() => setScope({ allModels: true, models: [], variants: [] })} icon={<Layers />} title="All models" description={used ? "Every pre-owned car you list" : `Every model of ${pool.length === 1 ? pool[0].name : "your authorised brands"}`} />
          <ChoiceCard name="coverage" checked={!scope.allModels} onSelect={() => setScope({ allModels: false })} icon={<CarFront />} title="Selected models" description="Choose models, and optionally specific variants" />
        </div>

        {pool.length === 0 ? (
          <p className="text-[13.5px] text-muted">No authorised brands yet — choose Pre-owned, or add a brand under Brands.</p>
        ) : (
          <div>
            <p className="mb-2 text-[12.5px] font-medium">
              {scope.allModels ? "Limit to brands" : "Brands"}
              <span className="font-normal text-muted">{scope.allModels ? " (optional — leave empty for all)" : ""}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {pool.map((b) => (
                <Chip key={b.slug} active={scope.brands.includes(b.slug)} onClick={() => toggleBrand(b.slug)}>
                  {b.name}
                </Chip>
              ))}
            </div>
            <ErrorNote>{err("scope.brands")}</ErrorNote>
          </div>
        )}

        {!scope.allModels && (
          <div className="space-y-4">
            {selectedBrands.length === 0 && <p className="rounded-[3px] border border-dashed border-line px-4 py-6 text-center text-[13px] text-muted">Pick a brand above to choose its models.</p>}
            {selectedBrands.map((slug) => {
              const brand = pool.find((b) => b.slug === slug)!;
              const all = brand.models.every((m) => scope.models.includes(m.slug));
              return (
                <div key={slug} className="rounded-[4px] border border-line">
                  <div className="flex items-center justify-between gap-3 border-b border-line bg-[#F6F6F6] px-4 py-2.5">
                    <p className="text-[13.5px] font-semibold">{brand.name}</p>
                    {brand.models.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          all
                            ? setScope({ models: scope.models.filter((m) => !brand.models.some((x) => x.slug === m)), variants: scope.variants.filter((v) => !brand.models.some((x) => v.startsWith(`${x.slug}/`))) })
                            : setScope({ models: [...new Set([...scope.models, ...brand.models.map((m) => m.slug)])] })
                        }
                        className="text-[12.5px] font-medium text-ink underline-offset-4 hover:underline"
                      >
                        {all ? "Clear" : "Select all"}
                      </button>
                    )}
                  </div>
                  <div className="space-y-4 p-4">
                    {brand.models.length === 0 && <p className="text-[13px] text-muted">No catalogue models for this brand yet.</p>}
                    <div className="flex flex-wrap gap-2">
                      {brand.models.map((m) => (
                        <Chip key={m.slug} active={scope.models.includes(m.slug)} onClick={() => toggleModel(slug, m.slug)}>
                          {m.name}
                        </Chip>
                      ))}
                    </div>
                    {brand.models
                      .filter((m) => scope.models.includes(m.slug) && m.variants.length > 1)
                      .map((m) => {
                        const mine = scope.variants.filter((v) => v.startsWith(`${m.slug}/`));
                        return (
                          <div key={m.slug} className="border-t border-line pt-3">
                            <p className="mb-2 text-[12px] font-medium text-muted">{m.name} variants</p>
                            <div className="flex flex-wrap gap-1.5">
                              <Chip active={mine.length === 0} onClick={() => setScope({ variants: scope.variants.filter((v) => !v.startsWith(`${m.slug}/`)) })}>
                                All variants
                              </Chip>
                              {m.variants.map((v) => (
                                <Chip key={v.slug} active={mine.includes(`${m.slug}/${v.slug}`)} onClick={() => toggleVariant(m.slug, v.slug)}>
                                  {v.name}
                                </Chip>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              );
            })}
            <ErrorNote>{err("scope.models") ?? err("scope.variants")}</ErrorNote>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ── C · Discount configuration ─────────────────────────────── */

export function DiscountSection({ input, update, err }: SectionProps) {
  const dc = input.discount;
  const set = (patch: Partial<OfferInput["discount"]>) => update((d) => ({ ...d, discount: { ...d.discount, ...patch } }));
  const benefits = benefitList(dc);
  const total = totalSavings(dc);
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden border border-ink bg-ink px-5 py-5 text-white md:px-6">
        <div aria-hidden className="absolute -right-10 -top-16 size-40 rotate-12 bg-red/80" />
        <p className="relative type-eyebrow text-white/55">Customers will see</p>
        <p className="relative mt-2 font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] md:text-[30px]">{benefits.length ? discountHeadline(dc) : "Add a benefit"}</p>
        <p className="relative mt-1 text-[13px] text-white/60">
          {benefits.length} benefit{benefits.length === 1 ? "" : "s"}
          {total > 0 ? ` · rupee benefits worth up to ${money(total)}` : ""}
          {dc.maxDiscount ? ` (capped at ${money(dc.maxDiscount)})` : ""}
        </p>
      </div>
      <ErrorNote>{err("discount.benefits")}</ErrorNote>

      <SectionCard title="Price benefits" description="Straight discounts on the price. Use whole rupees.">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <MoneyField label="Flat discount" value={dc.flat} onChange={(v) => set({ flat: v })} error={err("discount.flat")} />
          <PercentField label="Percentage discount" value={dc.percentage} onChange={(v) => set({ percentage: v })} error={err("discount.percentage")} hint="Up to 50%." />
          <MoneyField label="Cash discount" value={dc.cash} onChange={(v) => set({ cash: v })} error={err("discount.cash")} />
        </div>
      </SectionCard>

      <SectionCard title="Bonuses" description="Extra value for specific customers.">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <MoneyField label="Exchange bonus" value={dc.exchangeBonus} onChange={(v) => set({ exchangeBonus: v })} error={err("discount.exchangeBonus")} hint="When a car is traded in." />
          <MoneyField label="Corporate bonus" value={dc.corporateBonus} onChange={(v) => set({ corporateBonus: v })} error={err("discount.corporateBonus")} hint="For eligible employees." />
          <MoneyField label="Loyalty bonus" value={dc.loyaltyBonus} onChange={(v) => set({ loyaltyBonus: v })} error={err("discount.loyaltyBonus")} hint="For existing owners." />
        </div>
      </SectionCard>

      <SectionCard title="Free extras & finance">
        <Toggle checked={dc.freeInsurance} onChange={(v) => set({ freeInsurance: v })} label="Free insurance" description="The dealership covers the insurance premium — describe the cover in the terms." />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Input label="Free accessories" optional value={dc.freeAccessories} onChange={(v) => set({ freeAccessories: v })} maxLength={300} counter={false} placeholder="e.g. Floor mats, mud flaps and a dash cam" error={err("discount.freeAccessories")} />
          <Input label="Finance benefits" optional value={dc.financeBenefit} onChange={(v) => set({ financeBenefit: v })} maxLength={300} counter={false} placeholder="e.g. Rates from 8.25% p.a., zero processing fee" error={err("discount.financeBenefit")} />
        </div>
      </SectionCard>

      <SectionCard title="Limits & conditions">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <MoneyField label="Maximum discount" value={dc.maxDiscount} onChange={(v) => set({ maxDiscount: v })} error={err("discount.maxDiscount")} hint="Caps the total benefit per car. Leave empty for no cap." />
          <Input label="Minimum purchase conditions" optional value={dc.minPurchase} onChange={(v) => set({ minPurchase: v })} maxLength={300} counter={false} placeholder="e.g. Valid on ex-showroom prices above ₹10 lakh" error={err("discount.minPurchase")} />
        </div>
      </SectionCard>
    </div>
  );
}

/* ── D · Validity ───────────────────────────────────────────── */

export function ValiditySection({ input, update, err, template, renderedAt }: SectionProps & { template: OfferTemplateView | null; renderedAt: number }) {
  const set = (patch: Partial<OfferInput>) => update((d) => ({ ...d, ...patch }));
  const start = fromIstParts(input.startDate, input.startTime);
  const end = fromIstParts(input.endDate, input.endTime);
  const today = istDay(renderedAt);
  const presets = useMemo(() => {
    const from = input.startDate || addDays(today, 1);
    const monthEnd = (() => {
      const [y, m] = from.split("-").map(Number);
      return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    })();
    return [
      { label: "7 days", end: addDays(from, 6) },
      { label: "15 days", end: addDays(from, 14) },
      { label: "30 days", end: addDays(from, 29) },
      { label: "Till month end", end: monthEnd },
      { label: "Till year end", end: `${from.slice(0, 4)}-12-31` },
    ];
  }, [input.startDate, today]);

  return (
    <div className="space-y-6">
      <SectionCard title="Offer window" description="Enter dates and times in India Standard Time (IST). Approved offers go live and expire on their own.">
        {template?.dateNote && (
          <Callout tone="blue" icon={<CalendarClock />} title={`${template.name} template`}>
            {template.dateNote}
          </Callout>
        )}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
            <Input label="Starts on" type="date" value={input.startDate} onChange={(v) => set({ startDate: v })} error={err("startsAt")} />
            <Input label="Time" type="time" value={input.startTime} onChange={(v) => set({ startTime: v })} />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
            <Input label="Ends on" type="date" value={input.endDate} onChange={(v) => set({ endDate: v })} error={err("endsAt")} />
            <Input label="Time" type="time" value={input.endTime} onChange={(v) => set({ endTime: v })} />
          </div>
        </div>
        <div>
          <p className="mb-2 text-[12.5px] font-medium">Quick length</p>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <Chip key={p.label} active={input.endDate === p.end && input.endTime === "23:59"} onClick={() => set({ startDate: input.startDate || addDays(today, 1), endDate: p.end, endTime: "23:59" })}>
                {p.label}
              </Chip>
            ))}
          </div>
        </div>
        {start && end && end > start && (
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[4px] border border-line bg-line sm:grid-cols-3">
            {[
              { label: "Duration", value: `${durationDays(start, end)} day${durationDays(start, end) === 1 ? "" : "s"}` },
              { label: "Goes live", value: start.getTime() < renderedAt ? "As soon as it's approved" : formatIst(start) },
              { label: "Expires automatically", value: formatIst(end) },
            ].map((s) => (
              <div key={s.label} className="bg-white px-4 py-3">
                <p className="text-[11.5px] text-muted">{s.label}</p>
                <p className="mt-0.5 text-[14px] font-medium">{s.value}</p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Limits" description="Optional. Shown to customers so they know the offer is limited.">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <CountField label="Limited stock" value={input.limitedStock} onChange={(v) => set({ limitedStock: v })} suffix="units" error={err("limitedStock")} hint="How many cars the offer covers." />
          <CountField label="Maximum redemptions" value={input.maxRedemptions} onChange={(v) => set({ maxRedemptions: v })} error={err("maxRedemptions")} hint="How many customers can claim it." />
        </div>
      </SectionCard>
    </div>
  );
}

/* ── E · Promotional media ──────────────────────────────────── */

export function MediaSection({ input, update, err }: SectionProps) {
  const m = input.media;
  const set = (patch: Partial<OfferInput["media"]>) => update((d) => ({ ...d, media: { ...d.media, ...patch } }));
  const host = m.videoUrl ? videoHost(m.videoUrl) : "";
  return (
    <div className="space-y-6">
      <SectionCard title="Banners" description="Images are resized in your browser before upload (max 900 KB each). JPEG, PNG or WebP.">
        <div>
          <p className="mb-2 text-[12.5px] font-medium">
            Desktop banner <span className="font-normal text-red">· required</span>
          </p>
          <ImageUploader value={m.desktopBanner ? [m.desktopBanner] : []} onChange={(u) => set({ desktopBanner: u[0] ?? "" })} label="Upload desktop banner" aspect="aspect-[12/5]" hint="Wide, ideally 1920 × 800 px. The hero of your offer page." error={err("media.desktopBanner")} />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <p className="mb-2 text-[12.5px] font-medium">
              Mobile banner <span className="font-normal text-muted">(optional)</span>
            </p>
            <ImageUploader value={m.mobileBanner ? [m.mobileBanner] : []} onChange={(u) => set({ mobileBanner: u[0] ?? "" })} label="Upload mobile banner" aspect="aspect-[4/5]" hint="Portrait, ideally 1080 × 1350 px. Falls back to the desktop banner." error={err("media.mobileBanner")} />
          </div>
          <div>
            <p className="mb-2 text-[12.5px] font-medium">
              Thumbnail <span className="font-normal text-muted">(optional)</span>
            </p>
            <ImageUploader value={m.thumbnail ? [m.thumbnail] : []} onChange={(u) => set({ thumbnail: u[0] ?? "" })} label="Upload thumbnail" aspect="aspect-[16/10]" hint="Used on offer cards. Falls back to the desktop banner." error={err("media.thumbnail")} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Gallery" description="Up to 8 photos — the cars, the showroom, the accessories pack.">
        <ImageUploader multiple max={8} value={m.gallery} onChange={(u) => set({ gallery: u })} label="Add photos" error={err("media.gallery")} />
      </SectionCard>

      <SectionCard title="Video & brochure">
        <Input
          label="Promotional video link"
          optional
          type="url"
          inputMode="url"
          value={m.videoUrl}
          onChange={(v) => set({ videoUrl: v.trim() })}
          placeholder="https://www.youtube.com/watch?v=…"
          error={err("media.videoUrl")}
          hint={host ? `Customers open it on ${host}.` : "YouTube, Vimeo or any https:// link."}
          counter={false}
        />
        <DocumentUploader kind="brochure" value={m.brochure} onChange={(f) => set({ brochure: f })} label="PDF brochure" hint="Customers can download it from the offer page while the offer is live." error={err("media.brochure")} />
      </SectionCard>
    </div>
  );
}

/* ── F · Location ───────────────────────────────────────────── */

export function LocationSection({ input, update, err, options }: SectionProps) {
  const loc = input.locations;
  const set = (patch: Partial<OfferInput["locations"]>) => update((d) => ({ ...d, locations: { ...d.locations, ...patch } }));
  const [city, setCity] = useState("");
  const [stateQuery, setStateQuery] = useState("");
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const addCity = () => {
    const c = city.trim().replace(/\s+/g, " ");
    if (c.length < 2) return;
    const name = c.replace(/\b\w/g, (x) => x.toUpperCase());
    if (!loc.cities.some((x) => x.toLowerCase() === name.toLowerCase())) set({ cities: [...loc.cities, name] });
    setCity("");
  };
  const suggestions = [...new Set([...loc.cities, ...options.citySuggestions])];
  const states = INDIAN_STATES.filter((s) => s.toLowerCase().includes(stateQuery.trim().toLowerCase()));

  return (
    <div className="space-y-6">
      <SectionCard title="Where the offer is valid" description="Customers filter offers by city — choose where yours applies.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2" role="radiogroup" aria-label="Location">
          <ChoiceCard name="loc" checked={loc.mode === "all"} onSelect={() => set({ mode: "all" })} icon={<Building2 />} title="All showrooms" description={`${options.showrooms.length} active showroom${options.showrooms.length === 1 ? "" : "s"}`} />
          <ChoiceCard name="loc" checked={loc.mode === "branches"} onSelect={() => set({ mode: "branches" })} icon={<MapPin />} title="Selected showrooms" description="Only at the branches you tick" />
          <ChoiceCard name="loc" checked={loc.mode === "cities"} onSelect={() => set({ mode: "cities" })} icon={<MapIcon />} title="Selected cities" description="For customers in specific cities" />
          <ChoiceCard name="loc" checked={loc.mode === "states"} onSelect={() => set({ mode: "states" })} icon={<Globe2 />} title="Selected states" description="State-wide campaigns" />
        </div>
        <ErrorNote>{err("locations.mode")}</ErrorNote>
      </SectionCard>

      {loc.mode === "branches" && (
        <SectionCard title="Showrooms">
          {options.showrooms.length === 0 && <p className="text-[13.5px] text-muted">No active showrooms. Add one under Showrooms.</p>}
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {options.showrooms.map((s) => {
              const on = loc.showroomIds.includes(s.id);
              return (
                <li key={s.id}>
                  <label className={cn("flex cursor-pointer items-start gap-3 rounded-[4px] border bg-white p-4 transition-colors", on ? "border-ink" : "border-line hover:border-ink/30")}>
                    <input type="checkbox" checked={on} onChange={() => set({ showroomIds: toggle(loc.showroomIds, s.id) })} className="mt-1 size-4 shrink-0 accent-[var(--color-red)]" />
                    <span className="min-w-0">
                      <span className="block text-[14px] font-semibold">{s.name}</span>
                      <span className="block text-[12.5px] text-muted">
                        {s.address}, {s.city}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <ErrorNote>{err("locations.showroomIds")}</ErrorNote>
        </SectionCard>
      )}

      {loc.mode === "cities" && (
        <SectionCard title="Cities">
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0, 40).map((c) => (
              <Chip key={c} active={loc.cities.includes(c)} onClick={() => set({ cities: toggle(loc.cities, c) })}>
                {c}
              </Chip>
            ))}
          </div>
          <div className="flex max-w-md gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Add a city</span>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value.slice(0, 64))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCity();
                  }
                }}
                placeholder="Add another city"
                className="h-10 w-full rounded-[3px] border border-line px-3 text-[14px] outline-none hover:border-ink/30 focus:border-ink"
              />
            </label>
            <button type="button" onClick={addCity} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[3px] bg-ink px-3.5 text-[13px] font-medium text-white hover:bg-ink-3">
              <Plus aria-hidden className="size-4" /> Add
            </button>
          </div>
          {loc.cities.length > 0 && (
            <p className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted">
              Selected:
              {loc.cities.map((c) => (
                <button key={c} type="button" onClick={() => set({ cities: loc.cities.filter((x) => x !== c) })} className="inline-flex items-center gap-1 rounded-full bg-mist px-2 py-0.5 text-ink hover:bg-red-50 hover:text-red" aria-label={`Remove ${c}`}>
                  {c} <X aria-hidden className="size-3" />
                </button>
              ))}
            </p>
          )}
          <ErrorNote>{err("locations.cities")}</ErrorNote>
        </SectionCard>
      )}

      {loc.mode === "states" && (
        <SectionCard title="States" action={<span className="text-[12.5px] text-muted num">{loc.states.length} selected</span>}>
          <input
            value={stateQuery}
            onChange={(e) => setStateQuery(e.target.value)}
            placeholder="Filter states"
            aria-label="Filter states"
            className="h-10 w-full max-w-xs rounded-[3px] border border-line px-3 text-[14px] outline-none hover:border-ink/30 focus:border-ink"
          />
          <div className="flex flex-wrap gap-2">
            {states.map((s) => (
              <Chip key={s} active={loc.states.includes(s)} onClick={() => set({ states: toggle(loc.states, s) })}>
                {s}
              </Chip>
            ))}
          </div>
          <ErrorNote>{err("locations.states")}</ErrorNote>
        </SectionCard>
      )}
    </div>
  );
}
