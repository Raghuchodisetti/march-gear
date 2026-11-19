"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Gauge, LineChart, ListChecks } from "lucide-react";
import type { FuelType } from "@/types";
import { cities } from "@/data/cities";
import { formatKm, formatPrice, formatPriceRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { DemoNote } from "@/components/ui/badge";
import { Label, RangeField, Segmented, SelectField, TextField } from "@/components/ui/field";
import { Eyebrow } from "@/components/ui/section-heading";
import { useCatalog } from "@/components/providers/catalog-provider";
import { ConditionGauge } from "./condition-gauge";
import { DepreciationChart } from "./depreciation-chart";
import {
  CONDITIONS,
  FUELS,
  YEARS,
  modelsForBrand,
  valuate,
  valuationBrands,
  valuationTitle,
  type Condition,
  type GearboxKind,
} from "./valuation";

const OTHER = "other";

export function ValuationTool() {
  const catalog = useCatalog();
  const { usedCars, brandName } = catalog;
  const brandOptions = useMemo(() => valuationBrands(catalog), [catalog]);
  const [brand, setBrand] = useState("hyundai");
  const [model, setModel] = useState("hyundai-creta");
  const [otherModel, setOtherModel] = useState("");
  const [year, setYear] = useState(2021);
  const [km, setKm] = useState(42_000);
  const [fuel, setFuel] = useState<FuelType>("Petrol");
  const [transmission, setTransmission] = useState<GearboxKind>("Manual");
  const [condition, setCondition] = useState<Condition>("good");
  const [owners, setOwners] = useState("1");
  const [city, setCity] = useState("Mumbai");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const resultRef = useRef<HTMLDivElement>(null);

  const models = modelsForBrand(brand, catalog);
  const modelSlug = model !== OTHER ? model : undefined;
  const result = valuate({ brand, modelSlug, year, km, fuel, transmission, owners: Number(owners), condition, city }, catalog);
  const title = valuationTitle({ brand, modelSlug, year }, catalog, otherModel);
  const hasListings = usedCars.some((c) => c.brand === brand);

  const changeBrand = (next: string) => {
    setBrand(next);
    setModel(modelsForBrand(next, catalog)[0]?.slug ?? OTHER);
    setOtherModel("");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (model === OTHER && otherModel.trim().length < 2) {
      setError("Tell us the model name");
      return;
    }
    setSubmitted(true);
    requestAnimationFrame(() => {
      if (window.matchMedia("(max-width: 1023px)").matches) {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  };

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[400px_minmax(0,1fr)] xl:grid-cols-[440px_minmax(0,1fr)] xl:gap-16">
      {/* Form */}
      <form onSubmit={submit} noValidate className="self-start border border-line bg-white p-6 md:p-8 lg:sticky lg:top-[96px]">
        <h2 className="type-h4">Your car</h2>
        <p className="mt-1 text-[13px] text-muted">Seven details. No sign-up.</p>

        <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <SelectField label="Brand" value={brand} onChange={(e) => changeBrand(e.target.value)} options={brandOptions} />
          {models.length > 0 ? (
            <SelectField
              label="Model"
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                setError(undefined);
              }}
              options={[...models.map((m) => ({ value: m.slug, label: m.name })), { value: OTHER, label: "Other model" }]}
            />
          ) : (
            <TextField
              label="Model"
              placeholder="e.g. Polo"
              value={otherModel}
              onChange={(e) => {
                setOtherModel(e.target.value);
                setError(undefined);
              }}
              error={error}
            />
          )}
          {models.length > 0 && model === OTHER && (
            <TextField
              className="sm:col-span-2"
              label="Model name"
              placeholder={`Which ${brandName(brand)}?`}
              value={otherModel}
              onChange={(e) => {
                setOtherModel(e.target.value);
                setError(undefined);
              }}
              error={error}
            />
          )}
          <SelectField
            label="Registration year"
            value={String(year)}
            onChange={(e) => setYear(Number(e.target.value))}
            options={YEARS.map((y) => ({ value: String(y), label: String(y) }))}
          />
          <SelectField
            label="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            options={cities.map((c) => ({ value: c.name, label: c.name }))}
          />
          <SelectField
            label="Fuel"
            value={fuel}
            onChange={(e) => setFuel(e.target.value as FuelType)}
            options={FUELS.map((f) => ({ value: f, label: f }))}
          />
          <div>
            <Label>Gearbox</Label>
            <Segmented
              ariaLabel="Gearbox"
              className="w-full"
              value={transmission}
              onChange={setTransmission}
              options={[
                { value: "Manual", label: "Manual" },
                { value: "Automatic", label: "Automatic" },
              ]}
            />
          </div>
        </div>

        <RangeField
          className="mt-7"
          label="Kilometres driven"
          value={km}
          min={0}
          max={200_000}
          step={1_000}
          onChange={setKm}
          format={formatKm}
          minLabel="0 km"
          maxLabel="2,00,000 km"
        />

        <div className="mt-7">
          <Label>Owners</Label>
          <Segmented
            ariaLabel="Number of owners"
            className="w-full"
            value={owners}
            onChange={setOwners}
            options={[
              { value: "1", label: "1st" },
              { value: "2", label: "2nd" },
              { value: "3", label: "3rd +" },
            ]}
          />
        </div>

        <div className="mt-7">
          <Label>Condition</Label>
          <Segmented
            ariaLabel="Condition"
            className="w-full"
            value={condition}
            onChange={setCondition}
            options={CONDITIONS.map((c) => ({ value: c.value, label: c.label }))}
          />
          <p className="mt-2 text-[12px] text-muted">{CONDITIONS.find((c) => c.value === condition)?.note}</p>
        </div>

        <Button type="submit" size="lg" className="mt-8 w-full" arrow>
          {submitted ? "Update valuation" : "Get valuation"}
        </Button>
        <DemoNote className="mt-3 block text-center">Indicative estimate · not an offer to buy</DemoNote>
      </form>

      {/* Result */}
      <div ref={resultRef} className="min-w-0 scroll-mt-24" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          {!submitted ? (
            <motion.div
              key="placeholder"
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="flex h-full flex-col justify-between bg-mist p-8 md:p-12 lg:min-h-[420px]"
            >
              <div>
                <Eyebrow>Your valuation</Eyebrow>
                <p className="mt-8 font-display text-[clamp(3rem,2rem+4vw,5.5rem)] font-semibold leading-none tracking-[-0.04em] text-ink/15 [font-stretch:110%]">
                  ₹ — —
                </p>
                <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted">
                  Fill in the details and we&apos;ll estimate what your car is worth today, and how that value is likely to change.
                </p>
              </div>
              <ul className="mt-12 grid grid-cols-1 gap-6 border-t border-ink/10 pt-8 sm:grid-cols-3">
                {[
                  { icon: Gauge, text: "A range for fair, good and excellent condition" },
                  { icon: ListChecks, text: "The factors that moved your price" },
                  { icon: LineChart, text: "A ten-year depreciation curve" },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-3 text-[13.5px] text-ink/80">
                    <Icon className="mt-0.5 size-4 shrink-0 text-red" aria-hidden />
                    {text}
                  </li>
                ))}
              </ul>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              {/* Headline */}
              <div className="border-b border-ink pb-8">
                <Eyebrow>Indicative valuation</Eyebrow>
                <h2 className="type-h3 mt-5">{title}</h2>
                <p className="mt-1 text-[13px] text-muted num">
                  {formatKm(km)} · {fuel} · {transmission} · {owners === "1" ? "1st owner" : owners === "2" ? "2nd owner" : "3+ owners"} · {city}
                </p>
                <p className="mt-8 text-[12.5px] text-muted">
                  In {CONDITIONS.find((c) => c.value === condition)?.label.toLowerCase()} condition
                </p>
                <motion.p
                  key={`${result.selected.low}-${result.selected.high}`}
                  initial={{ opacity: 0.2 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4 }}
                  className="mt-2 font-display text-[clamp(2.5rem,1.8rem+3vw,4.25rem)] font-semibold leading-none tracking-[-0.035em] [font-stretch:108%]"
                >
                  {formatPriceRange(result.selected.low, result.selected.high)}
                </motion.p>
                <p className="mt-4 text-[14px] text-ink/80">
                  Most likely <span className="font-semibold num">{formatPrice(result.selected.mid)}</span>
                  <span className="text-muted"> · about {result.retainedPct}% of its {formatPrice(result.newPrice)} new price</span>
                </p>
              </div>

              {/* Gauge + condition bands */}
              <div className="grid grid-cols-1 gap-10 border-b border-line py-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center">
                <ConditionGauge bands={result.byCondition} selected={condition} />
                <div role="radiogroup" aria-label="Condition" className="grid grid-cols-3 border-t border-line md:grid-cols-1 md:border-t-0">
                  {CONDITIONS.map((c) => {
                    const band = result.byCondition[c.value];
                    const active = c.value === condition;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setCondition(c.value)}
                        className={cn(
                          "border-line py-4 text-left transition-colors duration-[250ms] md:border-b md:py-5 md:first:border-t",
                          "max-md:border-l max-md:pl-3 max-md:first:border-l-0 max-md:first:pl-0",
                          active ? "text-ink" : "text-muted hover:text-ink",
                        )}
                      >
                        <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
                          <span aria-hidden className={cn("size-1.5 rounded-full transition-colors duration-[250ms]", active ? "bg-red" : "bg-line")} />
                          {c.label}
                        </span>
                        <span className="mt-1.5 block text-[14px] font-medium num md:text-[16px]">
                          {formatPriceRange(band.low, band.high)}
                        </span>
                        <span className="mt-0.5 hidden text-[12px] text-muted md:block">{c.note}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Factors */}
              <div className="border-b border-line py-10">
                <h3 className="type-h4">What moved the price</h3>
                <dl className="mt-5 grid grid-cols-1 gap-x-10 sm:grid-cols-2">
                  {result.factors.map((f) => (
                    <div key={f.label} className="flex items-baseline justify-between gap-4 border-b border-line py-3.5">
                      <dt className="min-w-0">
                        <span className="block text-[14px] text-ink">{f.label}</span>
                        <span className="block truncate text-[12px] text-muted">{f.detail}</span>
                      </dt>
                      <dd className={cn("shrink-0 text-[14px] font-medium num", f.effect === 0 ? "text-muted" : "text-ink")}>
                        {f.effect > 0 ? "+" : f.effect < 0 ? "−" : "±"}
                        {Math.abs(f.effect)}%
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Depreciation */}
              <div className="py-10">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h3 className="type-h4">How its value changes</h3>
                    <p className="mt-1 text-[13px] text-muted">Estimated value from new to ten years, for a car like yours.</p>
                  </div>
                  <ul className="flex items-center gap-5 text-[12px] text-muted" aria-label="Legend">
                    <li className="flex items-center gap-2">
                      <span aria-hidden className="h-[2px] w-5 bg-ink" /> To date
                    </li>
                    <li className="flex items-center gap-2">
                      <span aria-hidden className="h-0 w-5 border-t-2 border-dashed border-ink/35" /> Projected
                    </li>
                  </ul>
                </div>
                <DepreciationChart className="mt-6" curve={result.curve} currentAge={result.age} currentValue={result.selected.mid} />
              </div>

              {/* Next steps */}
              <div className="flex flex-col gap-6 bg-ink p-7 text-white md:flex-row md:items-center md:justify-between md:p-9">
                <div>
                  <p className="type-h4">Ready to turn this into an offer?</p>
                  <p className="mt-1 text-[13.5px] text-white/60">A free inspection turns this estimate into a firm, same-day price.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button href="/sell-car" arrow>
                    Sell at this price
                  </Button>
                  <Button href={hasListings ? `/used-cars?brand=${brand}` : "/used-cars"} variant="outline-light">
                    {hasListings ? `Used ${brandName(brand)} cars` : "Browse used cars"}
                  </Button>
                </div>
              </div>
              <DemoNote className="mt-4 block">
                Indicative only, based on a demonstration pricing model. Actual offers depend on inspection, documents and market conditions.
              </DemoNote>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
