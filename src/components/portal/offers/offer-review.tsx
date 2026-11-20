"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Monitor, Pencil, Smartphone, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { OfferArt, OfferCard, type OfferCardData } from "@/components/offers/offer-card";
import { Countdown } from "@/components/offers/countdown";
import { benefitList, discountHeadline, formatIst, fromIstParts, locationLabel, money, offerImage, vehicleLabel } from "@/components/offers/offer-utils";
import { OFFER_CATEGORY_LABEL } from "@/partner/labels";
import type { EditorOptions, OfferInput, OfferStepKey } from "./offer-input";
import { OFFER_STEPS, stepOfField } from "./offer-input";
import { SectionCard } from "./offer-fields";

/** The public card data for what's in the editor right now. */
export function previewData(input: OfferInput, options: EditorOptions): OfferCardData {
  const names = new Map(options.catalogueBrands.map((b) => [b.slug, b.name]));
  const models = new Map(options.catalogueBrands.flatMap((b) => b.models.map((m) => [m.slug, m.name] as const)));
  const brandOf = new Map(options.catalogueBrands.flatMap((b) => b.models.map((m) => [m.slug, b.slug] as const)));
  const start = fromIstParts(input.startDate, input.startTime) ?? new Date();
  const end = fromIstParts(input.endDate, input.endTime) ?? new Date(start.getTime() + 30 * 86_400_000);
  return {
    title: input.title,
    tagline: input.tagline,
    categoryLabel: input.category ? OFFER_CATEGORY_LABEL[input.category] : "Dealer offer",
    headline: discountHeadline(input.discount),
    image: offerImage(input.media),
    dealerName: options.dealerName,
    dealerCity: options.dealerCity,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    vehicleLabel: vehicleLabel(input.scope, { brand: (s) => names.get(s) ?? s, model: (s) => models.get(s) ?? s, brandOf: (s) => brandOf.get(s) }, options.brands.filter((b) => b.authorised).map((b) => b.slug)),
    locationLabel: locationLabel(input.locations, options.showrooms),
    benefits: benefitList(input.discount),
  };
}

/** How the top of the public offer page will look. Decorative — nothing in it is clickable. */
export function BannerPreview({ input, card, renderedAt }: { input: OfferInput; card: OfferCardData; renderedAt: number }) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const image = device === "mobile" ? input.media.mobileBanner || input.media.desktopBanner : input.media.desktopBanner || input.media.mobileBanner;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[12.5px] font-medium">Offer page banner</p>
        <div role="radiogroup" aria-label="Preview device" className="inline-flex rounded-[3px] bg-mist p-1">
          {(
            [
              ["desktop", "Desktop", Monitor],
              ["mobile", "Mobile", Smartphone],
            ] as const
          ).map(([v, label, Icon]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={device === v}
              onClick={() => setDevice(v)}
              className={cn("inline-flex h-8 items-center gap-1.5 rounded-[2px] px-3 text-[12.5px] font-medium transition-colors", device === v ? "bg-white text-ink shadow-soft" : "text-muted hover:text-ink")}
            >
              <Icon aria-hidden className="size-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>
      <div aria-hidden className={cn("relative mx-auto overflow-hidden bg-ink text-white transition-[max-width] duration-500 ease-[var(--ease-premium)]", device === "mobile" ? "aspect-[4/5] max-w-[300px]" : "aspect-[16/8] max-w-full")}>
        <OfferArt image={image} headline="" sizes="(min-width: 1024px) 50vw, 90vw" className="opacity-60" eager />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/50 to-ink/10" />
        <div className={cn("absolute inset-x-0 bottom-0", device === "mobile" ? "p-5" : "p-6 md:p-8")}>
          <p className="type-eyebrow inline-flex items-center gap-2 text-white/80">
            <span className="h-px w-5 bg-red" />
            {card.categoryLabel}
          </p>
          <p className={cn("mt-3 font-display font-semibold leading-[1.02] tracking-[-0.025em]", device === "mobile" ? "text-[24px]" : "text-[28px] md:text-[36px]")}>{card.title || "Your offer title"}</p>
          {card.tagline && <p className="mt-2 line-clamp-2 max-w-lg text-[13px] text-white/70">{card.tagline}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-white/75">
            <span className="inline-flex items-center gap-1.5">
              <Store className="size-3.5" /> {card.dealerName}
            </span>
            <Countdown startsAt={card.startsAt} endsAt={card.endsAt} renderedAt={renderedAt} tone="light" />
          </div>
          <div className="mt-4 inline-flex items-center gap-3 border-l-2 border-red pl-3">
            <span className={cn("font-display font-semibold", device === "mobile" ? "text-[18px]" : "text-[22px]")}>{card.headline}</span>
          </div>
        </div>
        <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink">Preview</span>
      </div>
    </div>
  );
}

/** G · Review & submit: previews, summary, outstanding issues and the confirmation. */
export function ReviewSection({
  input,
  options,
  issues,
  goTo,
  confirm,
  setConfirm,
  confirmError,
  renderedAt,
  live,
}: {
  input: OfferInput;
  options: EditorOptions;
  issues: Record<string, string>;
  goTo: (s: OfferStepKey) => void;
  confirm: boolean;
  setConfirm: (v: boolean) => void;
  confirmError?: string;
  renderedAt: number;
  live: boolean;
}) {
  const card = previewData(input, options);
  const open = Object.entries(issues).filter(([k]) => k !== "confirmTerms");
  const start = fromIstParts(input.startDate, input.startTime);
  const end = fromIstParts(input.endDate, input.endTime);
  const showroomNames = options.showrooms.filter((s) => input.locations.showroomIds.includes(s.id)).map((s) => s.name);

  const summary: { step: OfferStepKey; rows: [string, string][] }[] = [
    {
      step: "basics",
      rows: [
        ["Title", input.title || "—"],
        ["Campaign", input.campaignName || "—"],
        ["Category", input.category ? OFFER_CATEGORY_LABEL[input.category] : "—"],
        ["Terms", input.terms ? `${input.terms.length.toLocaleString("en-IN")} characters` : "—"],
      ],
    },
    {
      step: "vehicles",
      rows: [
        ["Vehicles", card.vehicleLabel],
        ["Variants", input.scope.allModels || !input.scope.variants.length ? "All variants" : `${input.scope.variants.length} selected`],
      ],
    },
    {
      step: "discount",
      rows: [
        ...(card.benefits.length ? card.benefits.map((b) => [b.label, b.value] as [string, string]) : [["Benefits", "None yet"] as [string, string]]),
        ...(input.discount.maxDiscount ? [["Maximum discount", money(input.discount.maxDiscount)] as [string, string]] : []),
        ...(input.discount.minPurchase ? [["Purchase condition", input.discount.minPurchase] as [string, string]] : []),
      ],
    },
    {
      step: "validity",
      rows: [
        ["Starts", start ? formatIst(start) : "—"],
        ["Ends (auto-expiry)", end ? formatIst(end) : "—"],
        ["Limited stock", input.limitedStock ? `${input.limitedStock} units` : "No limit"],
        ["Max redemptions", input.maxRedemptions ? String(input.maxRedemptions) : "No limit"],
      ],
    },
    {
      step: "media",
      rows: [
        ["Banners", [input.media.desktopBanner && "Desktop", input.media.mobileBanner && "Mobile", input.media.thumbnail && "Thumbnail"].filter(Boolean).join(", ") || "None"],
        ["Gallery", `${input.media.gallery.length} photo${input.media.gallery.length === 1 ? "" : "s"}`],
        ["Video / brochure", [input.media.videoUrl && "Video link", input.media.brochure && "PDF brochure"].filter(Boolean).join(", ") || "—"],
      ],
    },
    { step: "location", rows: [["Valid at", input.locations.mode === "branches" && showroomNames.length ? showroomNames.join(", ") : card.locationLabel]] },
  ];

  return (
    <div className="space-y-6">
      <SectionCard title="Live preview" description="Exactly what customers will see once MarchGear approves the offer.">
        <BannerPreview input={input} card={card} renderedAt={renderedAt} />
        <div>
          <p className="mb-3 text-[12.5px] font-medium">Offer card</p>
          <div className="max-w-sm">
            <OfferCard offer={card} renderedAt={renderedAt} />
          </div>
        </div>
      </SectionCard>

      {open.length > 0 ? (
        <section className="border border-[#f0d9ad] bg-[#fdf8ee]">
          <header className="flex items-center gap-3 border-b border-[#f0d9ad] px-5 py-4 md:px-6">
            <AlertTriangle aria-hidden className="size-5 shrink-0 text-[#9a5b00]" />
            <h3 className="text-[15px] font-semibold text-[#7a4a00]">
              {open.length} thing{open.length === 1 ? "" : "s"} to finish before submitting
            </h3>
          </header>
          <ul className="divide-y divide-[#f0d9ad]">
            {open.map(([k, msg]) => {
              const step = OFFER_STEPS.find((s) => s.key === stepOfField(k))!;
              return (
                <li key={k}>
                  <button type="button" onClick={() => goTo(step.key)} className="group/i flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-white/60 md:px-6">
                    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-white font-mono text-[11px] font-semibold">{step.letter}</span>
                    <span className="min-w-0 flex-1 text-[13.5px] text-[#5c3800]">{msg}</span>
                    <ArrowRight aria-hidden className="size-4 shrink-0 text-[#9a5b00] transition-transform group-hover/i:translate-x-0.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <div className="flex items-center gap-3 border border-[#cde6d5] bg-[#f1f9f3] px-5 py-4 text-[14px] text-[#1e5c33] md:px-6">
          <CheckCircle2 aria-hidden className="size-5 shrink-0 text-[#1e7a3c]" /> Everything&apos;s in place. Review the summary and submit.
        </div>
      )}

      <SectionCard title="Summary">
        <div className="divide-y divide-line">
          {summary.map((s) => {
            const step = OFFER_STEPS.find((x) => x.key === s.step)!;
            return (
              <div key={s.step} className="grid grid-cols-1 gap-3 py-4 first:pt-0 last:pb-0 md:grid-cols-[200px_minmax(0,1fr)_auto] md:gap-6">
                <p className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                  <span className="mr-2 font-mono text-red">{step.letter}</span>
                  {step.title}
                </p>
                <dl className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
                  {s.rows.map(([l, v]) => (
                    <div key={l} className="min-w-0">
                      <dt className="text-[11.5px] text-muted">{l}</dt>
                      <dd className="break-words text-[13.5px]">{v}</dd>
                    </div>
                  ))}
                </dl>
                <button type="button" onClick={() => goTo(s.step)} className="inline-flex h-8 items-center gap-1.5 self-start rounded-[3px] px-2 text-[12.5px] font-medium text-ink hover:bg-mist">
                  <Pencil aria-hidden className="size-3.5" /> Edit
                </button>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <section className={cn("border bg-white p-5 md:p-6", confirmError ? "border-red" : "border-line")}>
        <label className="flex cursor-pointer items-start gap-3 text-[14px] leading-relaxed">
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-1 size-4 shrink-0 accent-[var(--color-red)]" />
          <span>
            I confirm the offer details, benefits and terms are accurate, and that the dealership will honour them for every eligible customer during the offer period.
            {live && <span className="mt-1 block text-[13px] text-muted">Resubmitting replaces the approved version once MarchGear approves the changes.</span>}
          </span>
        </label>
        {confirmError && <p className="mt-2 text-xs text-red">{confirmError}</p>}
      </section>
    </div>
  );
}
