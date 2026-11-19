"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDownRight, Check, ChevronDown, MapPin, Star } from "lucide-react";
import { formatINR, formatPrice, formatPriceShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/section-heading";
import { ImageGallery } from "@/components/vehicle/image-gallery";
import { CompareToggle, WishlistButton } from "@/components/vehicle/toggles";
import { useUI } from "@/components/providers/app-provider";
import { useCarDetail } from "./context";
import { ShareButton, scrollToSection } from "./buy-actions";
import { emiFrom, sortedVariants } from "./utils";

/** Model page opener: title row, large gallery and the buy panel. */
export function CarHero({ expertScore }: { expertScore: number }) {
  const { car, brand, title, ev } = useCarDetail();

  return (
    <section aria-labelledby="car-title">
      <div className="container-x">
        <div className="mt-8 grid grid-cols-1 gap-6 md:mt-12 lg:grid-cols-12 lg:items-end lg:gap-10">
          <div className="lg:col-span-8">
            <Eyebrow>
              {brand} · {ev ? "Electric " : ""}
              {car.bodyType}
            </Eyebrow>
            <h1 id="car-title" className="type-h1 mt-5 text-balance">
              <span className="sr-only">{brand} </span>
              {car.name}
            </h1>
            <p className="type-lead mt-4 max-w-xl text-muted">{car.tagline}</p>
          </div>
          <div className="flex items-stretch gap-6 lg:col-span-4 lg:justify-end">
            <button
              type="button"
              onClick={() => scrollToSection("reviews")}
              className="group text-left"
              aria-label={`Owner rating ${car.rating.toFixed(1)} out of 5 from ${car.reviewCount.toLocaleString("en-IN")} reviews — read reviews`}
            >
              <span className="type-eyebrow block text-muted">Owners</span>
              <span className="mt-2 flex items-center gap-1.5">
                <Star aria-hidden className="size-4 fill-ink text-ink" strokeWidth={0} />
                <span className="text-[19px] font-semibold num">{car.rating.toFixed(1)}</span>
                <span className="text-[13px] text-muted num group-hover:text-ink">({car.reviewCount.toLocaleString("en-IN")})</span>
              </span>
            </button>
            <span aria-hidden className="w-px bg-line" />
            <button
              type="button"
              onClick={() => scrollToSection("reviews")}
              className="group text-left"
              aria-label={`Expert score ${expertScore.toFixed(1)} out of 10 — read the expert review`}
            >
              <span className="type-eyebrow block text-muted">Expert score</span>
              <span className="mt-2 flex items-baseline gap-1">
                <span className="text-[19px] font-semibold num">{expertScore.toFixed(1)}</span>
                <span className="text-[13px] text-muted group-hover:text-ink">/ 10</span>
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="container-x mt-8 grid grid-cols-1 gap-8 pb-14 md:mt-10 md:pb-20 lg:grid-cols-12 lg:gap-10">
        <ImageGallery
          images={car.images}
          alt={title}
          focus={car.focus}
          priority
          aspect="aspect-[4/3] md:aspect-[16/10]"
          className="min-w-0 lg:col-span-8"
        />
        <BuyPanel />
      </div>
    </section>
  );
}

function BuyPanel() {
  const { car, title, variant, onRoad, city } = useCarDetail();
  const { openEnquiry, setLocationOpen } = useUI();

  return (
    <div id="buy-panel" className="flex flex-col border border-line lg:col-span-4">
      <div className="p-5 md:p-7">
        <VariantPicker />

        <div className="mt-7">
          <p className="text-[12.5px] text-muted">Ex-showroom price</p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={variant.slug}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="mt-1.5 font-display text-[clamp(2rem,1.6rem+1.4vw,2.75rem)] font-semibold leading-none tracking-[-0.03em] num"
              aria-live="polite"
            >
              {formatPrice(variant.price)}
            </motion.p>
          </AnimatePresence>
          <p className="mt-2 text-[11.5px] text-muted">
            Range {formatPriceShort(car.priceMin)} – {formatPriceShort(car.priceMax)} · indicative
          </p>
        </div>

        <div className="mt-6 flex items-end justify-between gap-4 border-t border-line pt-5">
          <div className="min-w-0">
            <p className="text-[12.5px] text-muted">
              On-road price, <span className="text-ink">{city.name}</span>
            </p>
            <p className="mt-1 text-[19px] font-semibold num">{formatINR(onRoad)}</p>
          </div>
          <button
            type="button"
            onClick={() => setLocationOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 pb-1 text-[13px] font-medium text-ink underline decoration-ink/25 underline-offset-4 transition-colors hover:decoration-ink"
          >
            <MapPin aria-hidden className="size-3.5 text-red" />
            Change city
          </button>
        </div>

        <button
          type="button"
          onClick={() => scrollToSection("emi")}
          className="group mt-5 flex w-full items-center justify-between gap-3 bg-mist px-4 py-3 text-left text-[13px] transition-colors hover:bg-line/70"
        >
          <span className="text-muted">
            EMI from <span className="font-semibold text-ink num">{formatINR(emiFrom(onRoad))}</span>/month
          </span>
          <ArrowDownRight aria-hidden className="size-4 text-red transition-transform duration-[250ms] group-hover:translate-y-0.5" />
        </button>
      </div>

      <div className="mt-auto grid gap-2.5 border-t border-line p-5 md:p-7">
        <Button
          size="lg"
          className="w-full"
          arrow
          onClick={() => openEnquiry({ kind: "best-price", subject: title, detail: `${variant.name} · ${city.name}`, carSlug: car.slug })}
        >
          Get best price
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="w-full"
          onClick={() => openEnquiry({ kind: "test-drive", subject: title, detail: variant.name, carSlug: car.slug })}
        >
          Book a test drive
        </Button>
        <div className="mt-3 flex items-center justify-between gap-4">
          <CompareToggle slug={car.slug} label={title} />
          <div className="flex items-center gap-2">
            <WishlistButton id={car.slug} label={title} tone="outline" />
            <ShareButton label={title} />
          </div>
        </div>
      </div>
    </div>
  );
}

function VariantPicker() {
  const { car, variant, setVariant } = useCarDetail();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const variants = sortedVariants(car);

  return (
    <div>
      <p className="text-[12.5px] text-muted">
        Variant · <span className="num">{car.variants.length}</span> available
      </p>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "mt-2 flex w-full items-center justify-between gap-3 rounded-[3px] border px-4 py-3 text-left transition-colors duration-[250ms]",
          open ? "border-ink" : "border-line hover:border-ink/40",
        )}
      >
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-medium">{variant.name}</span>
          <span className="mt-0.5 block truncate text-[12px] text-muted">
            {variant.fuel} · {variant.transmission} · {variant.efficiency}
          </span>
        </span>
        <ChevronDown aria-hidden className={cn("size-4 shrink-0 transition-transform duration-[350ms]", open && "rotate-180")} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="overflow-hidden"
          >
            <div role="radiogroup" aria-label="Choose a variant" className="mt-2 max-h-72 divide-y divide-line overflow-y-auto border border-line">
              {variants.map((v) => {
                const selected = v.slug === variant.slug;
                return (
                  <button
                    key={v.slug}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      setVariant(v.slug);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-[250ms]",
                      selected ? "bg-mist" : "hover:bg-mist/70",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "inline-flex size-4 shrink-0 items-center justify-center rounded-full border",
                        selected ? "border-red bg-red text-white" : "border-ink/25",
                      )}
                    >
                      {selected && <Check className="size-2.5" strokeWidth={3.5} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">{v.name}</span>
                      <span className="block truncate text-[12px] text-muted">
                        {v.fuel} · {v.transmission}
                      </span>
                    </span>
                    <span className="shrink-0 text-[13px] font-semibold num">{formatPriceShort(v.price)}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
