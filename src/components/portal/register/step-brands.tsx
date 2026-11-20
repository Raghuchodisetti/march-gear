"use client";

import { useState } from "react";
import { BadgeCheck, Check, CircleX, Layers, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { BrandLogo, hasBrandLogo } from "@/components/ui/brand-logo";
import { useCatalog } from "@/components/providers/catalog-provider";
import { DocumentUploader } from "@/components/portal/uploader";
import { errorAt, trimStop, type FileReview, type WizardApplication, type WizardBrand } from "@/partner/schemas";
import { ChoiceCard, FieldError, FormSection, Note } from "./controls";
import type { StepProps } from "./step-types";

const today = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);

/** What MarchGear's team decided about an uploaded file, if anything yet. */
export function ReviewLine({ review }: { review?: FileReview }) {
  if (!review || review.status === "pending") return null;
  return review.status === "verified" ? (
    <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-[#1e7a3c]">
      <BadgeCheck aria-hidden className="size-3.5" /> Verified by MarchGear
    </p>
  ) : (
    <p className="mt-1.5 flex items-start gap-1 text-xs font-medium text-red" data-error="true">
      <CircleX aria-hidden className="mt-px size-3.5 shrink-0" />
      <span>
        Rejected by MarchGear{review.remarks ? ` — ${trimStop(review.remarks)}` : ""}. Replace this file.
      </span>
    </p>
  );
}

export function BrandsStep({ app, value, onChange, errors, clear, reviews }: StepProps<"brands"> & { reviews: Record<number, FileReview> }) {
  const catalog = useCatalog();
  const [removing, setRemoving] = useState<string | null>(null);
  const authorised = value.mode === "authorized";
  const rooms = app.showrooms;
  const combined = Boolean(app.documents.brand_authorization);

  const setItems = (items: WizardBrand[], ...keys: string[]) => {
    onChange({ ...value, items });
    clear(...keys);
  };
  const patch = (i: number, p: Partial<WizardBrand>, ...keys: string[]) =>
    setItems(
      value.items.map((it, j) => (j === i ? { ...it, ...p } : it)),
      ...keys.map((k) => `items.${i}.${k}`),
    );

  const addBrand = (slug: string) => {
    const at = value.items.findIndex((it) => it.brand === slug);
    if (at >= 0) {
      document.getElementById(`brand-${slug}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setItems([...value.items, { brand: slug, models: [], variants: [], certificate: null, validUntil: "", showroomKeys: rooms.map((r) => r.key) }], "items");
  };

  const removeBrand = (i: number) => {
    setItems(
      value.items.filter((_, j) => j !== i),
      "items",
    );
    setRemoving(null);
  };

  return (
    <>
      <FormSection title="How do you sell?" description="This decides which documents we need.">
        <div role="radiogroup" aria-label="Dealer type" className="grid gap-3 md:grid-cols-2" data-error={errors.mode ? "true" : undefined}>
          <ChoiceCard
            selected={value.mode === "authorized"}
            onSelect={() => {
              onChange({ ...value, mode: "authorized" });
              clear("mode", "items");
            }}
            icon={<BadgeCheck aria-hidden className="size-4" />}
            title="Authorised dealer"
            description="A franchised dealership appointed by one or more manufacturers. We'll need the authorisation certificate for each brand."
          />
          <ChoiceCard
            selected={value.mode === "multi_brand"}
            onSelect={() => {
              onChange({ ...value, mode: "multi_brand" });
              clear("mode", "items");
            }}
            icon={<Layers aria-hidden className="size-4" />}
            title="Independent multi-brand dealer"
            description="You sell new or pre-owned cars of several brands without a manufacturer franchise. Certificates are optional."
          />
        </div>
        <FieldError>{errors.mode}</FieldError>
      </FormSection>

      <FormSection title="Brands you sell" description="Choose every brand, then the models and variants you stock.">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" data-error={errors.items ? "true" : undefined}>
          {catalog.brands.map((b) => {
            const selected = value.items.some((it) => it.brand === b.slug);
            return (
              <button
                key={b.slug}
                type="button"
                onClick={() => addBrand(b.slug)}
                aria-pressed={selected}
                className={cn(
                  "group relative flex h-[84px] flex-col items-center justify-center gap-1.5 border bg-white px-2 text-center transition-[border-color,box-shadow] duration-300 ease-[var(--ease-premium)]",
                  selected ? "border-ink shadow-[inset_0_0_0_1px_#111]" : "border-line hover:border-ink/40",
                )}
              >
                {selected && (
                  <span className="absolute right-1.5 top-1.5 inline-flex size-4 items-center justify-center rounded-full bg-red text-white">
                    <Check aria-hidden className="size-2.5" strokeWidth={3} />
                  </span>
                )}
                <span className="flex h-8 w-full items-center justify-center">
                  {hasBrandLogo(b.slug) ? <BrandLogo slug={b.slug} className="h-7" /> : <span className="font-display text-[15px] font-semibold">{b.name.slice(0, 2)}</span>}
                </span>
                <span className="w-full truncate text-[12px] font-medium">{b.name}</span>
              </button>
            );
          })}
        </div>
        <FieldError>{errors.items}</FieldError>
        {authorised && combined && (
          <Note tone="success" className="mt-4">
            You&apos;ve attached a combined brand authorisation letter in Documents, so per-brand certificates are optional.
          </Note>
        )}
      </FormSection>

      {value.items.map((item, i) => {
        const brand = catalog.getBrand(item.brand);
        const line = catalog.carsByBrand(item.brand);
        const allModels = line.length > 0 && line.every((c) => item.models.includes(c.slug));
        const toggleModel = (slug: string) => {
          const car = line.find((c) => c.slug === slug);
          if (item.models.includes(slug)) patch(i, { models: item.models.filter((m) => m !== slug), variants: item.variants.filter((v) => !v.startsWith(`${slug}/`)) }, "models", "variants");
          else patch(i, { models: [...item.models, slug], variants: [...item.variants, ...(car?.variants.map((v) => `${slug}/${v.slug}`) ?? [])] }, "models", "variants");
        };
        const toggleVariant = (key: string) => patch(i, { variants: item.variants.includes(key) ? item.variants.filter((v) => v !== key) : [...item.variants, key] }, "variants");
        const review = item.certificate ? reviews[item.certificate.id] : undefined;
        return (
          <FormSection
            key={item.brand}
            id={`brand-${item.brand}`}
            className={cn("scroll-mt-24", Object.keys(errors).some((k) => k.startsWith(`items.${i}.`)) && "border-red/40")}
            title={
              <span className="flex items-center gap-3">
                {hasBrandLogo(item.brand) && (
                  <span className="inline-flex h-8 w-12 items-center justify-center border border-line bg-white">
                    <BrandLogo slug={item.brand} className="h-5" />
                  </span>
                )}
                {brand?.name ?? item.brand}
              </span>
            }
            description={line.length ? `${item.models.length} of ${line.length} models · ${item.variants.length} variants selected` : "No models in our catalogue yet for this brand."}
            action={
              removing === item.brand ? (
                <span className="flex items-center gap-2">
                  <Button size="sm" variant="dark" onClick={() => removeBrand(i)}>
                    Remove brand
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRemoving(null)}>
                    Cancel
                  </Button>
                </span>
              ) : (
                <button type="button" onClick={() => setRemoving(item.brand)} className="inline-flex h-9 items-center gap-1.5 text-[13px] text-muted hover:text-red">
                  <Trash2 aria-hidden className="size-4" /> Remove
                </button>
              )
            }
          >
            {errors[`items.${i}.brand`] && <Note tone="error" className="mb-4">{errors[`items.${i}.brand`]}</Note>}
            {line.length > 0 && (
              <div data-error={errors[`items.${i}.models`] ? "true" : undefined}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-[12.5px] font-medium">Models & variants</p>
                  <button
                    type="button"
                    className="text-[12px] font-medium text-muted hover:text-ink"
                    onClick={() =>
                      allModels
                        ? patch(i, { models: [], variants: [] }, "models", "variants")
                        : patch(i, { models: line.map((c) => c.slug), variants: line.flatMap((c) => c.variants.map((v) => `${c.slug}/${v.slug}`)) }, "models", "variants")
                    }
                  >
                    {allModels ? "Clear all" : "Select all models"}
                  </button>
                </div>
                <ul className="divide-y divide-line border border-line">
                  {line.map((car) => {
                    const on = item.models.includes(car.slug);
                    const vErr = errors[`items.${i}.variants.${car.slug}`];
                    return (
                      <li key={car.slug} className={cn("px-4 py-3 transition-colors duration-300", on && "bg-[#FAFAFA]")}>
                        <label className="flex cursor-pointer items-center gap-3">
                          <input type="checkbox" checked={on} onChange={() => toggleModel(car.slug)} className="size-4 shrink-0 cursor-pointer accent-[#111111]" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[14px] font-medium">{car.name}</span>
                            <span className="block text-[12px] text-muted">
                              {car.bodyType} · {car.variants.length} {car.variants.length === 1 ? "variant" : "variants"}
                            </span>
                          </span>
                        </label>
                        {on && car.variants.length > 0 && (
                          <div className="mt-3 animate-rise pl-7">
                            <div className="flex flex-wrap gap-1.5">
                              {car.variants.map((v) => {
                                const key = `${car.slug}/${v.slug}`;
                                const sel = item.variants.includes(key);
                                return (
                                  <button
                                    key={key}
                                    type="button"
                                    aria-pressed={sel}
                                    onClick={() => toggleVariant(key)}
                                    className={cn(
                                      "inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[12px] transition-colors duration-300",
                                      sel ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink/40",
                                    )}
                                  >
                                    {sel && <Check aria-hidden className="size-3" strokeWidth={3} />}
                                    {v.name}
                                  </button>
                                );
                              })}
                            </div>
                            {vErr && <p className="mt-1.5 text-xs text-red">{vErr}</p>}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <FieldError>{errors[`items.${i}.models`] ?? errors[`items.${i}.variants`]}</FieldError>
              </div>
            )}

            <div className={cn("grid gap-5 md:grid-cols-[minmax(0,1fr)_220px]", line.length > 0 && "mt-6")}>
              <div>
                <DocumentUploader
                  kind="brand_authorization"
                  value={item.certificate}
                  onChange={(f) => patch(i, { certificate: f }, "certificate")}
                  label="Dealership authorisation certificate"
                  required={authorised && !combined}
                  hint={`Issued by ${brand?.name ?? "the manufacturer"}, showing your dealership's name.`}
                  error={errors[`items.${i}.certificate`]}
                />
                {!errors[`items.${i}.certificate`] && <ReviewLine review={review} />}
              </div>
              <TextField
                label={authorised ? "Valid until" : "Valid until (optional)"}
                type="date"
                min={today()}
                value={item.validUntil}
                onChange={(e) => patch(i, { validUntil: e.target.value }, "validUntil")}
                error={errors[`items.${i}.validUntil`]}
                className="md:pt-[1px]"
              />
            </div>

            {rooms.length > 1 && (
              <div className="mt-6" data-error={errors[`items.${i}.showroomKeys`] ? "true" : undefined}>
                <p className="mb-2 text-[12.5px] font-medium">Sold at</p>
                <div className="flex flex-wrap gap-1.5">
                  {rooms.map((r, ri) => {
                    const sel = (item.showroomKeys ?? []).includes(r.key);
                    return (
                      <button
                        key={r.key}
                        type="button"
                        aria-pressed={sel}
                        onClick={() => patch(i, { showroomKeys: sel ? (item.showroomKeys ?? []).filter((k) => k !== r.key) : [...(item.showroomKeys ?? []), r.key] }, "showroomKeys")}
                        className={cn("inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[12px] transition-colors duration-300", sel ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/40")}
                      >
                        {sel && <Check aria-hidden className="size-3" strokeWidth={3} />}
                        {r.name || `Showroom ${ri + 1}`}
                        {r.city ? <span className={sel ? "text-white/60" : "text-muted"}> · {r.city}</span> : null}
                      </button>
                    );
                  })}
                </div>
                <FieldError>{errorAt(errors, `items.${i}.showroomKeys`)}</FieldError>
              </div>
            )}
          </FormSection>
        );
      })}
    </>
  );
}

export type BrandsValue = WizardApplication["brands"];
