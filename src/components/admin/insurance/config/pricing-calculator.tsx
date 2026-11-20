"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { INS_PRODUCT_CATEGORIES, type InsProductCategory } from "@/db/enums";
import { DEFAULT_PRODUCT_PRICING, depreciationFor, type PricingConfig } from "@/insurance/estimator";
import { INS_PRODUCT_CATEGORY_LABEL } from "@/insurance/labels";
import { cn } from "@/lib/utils";
import { EstimateBreakdown, VehiclePicker, estimateFor, firstChoice, type PickerCar, type VehicleChoice } from "./estimate";

/* Live calculator next to the pricing configuration: the estimator's output with the saved rates. */

export function PricingCalculator({ cars, config, today, savedAt }: { cars: PickerCar[]; config: PricingConfig & { disclaimer?: string }; today: string; savedAt: string | null }) {
  const [choice, setChoice] = useState<VehicleChoice>(() => firstChoice(cars, today));
  const [category, setCategory] = useState<InsProductCategory>("comprehensive");
  const [rate, setRate] = useState(String(config.odRate.default));
  const [pa, setPa] = useState(true);
  const odRate = Number(rate);
  const rateOk = rate !== "" && Number.isFinite(odRate) && odRate >= config.odRate.min && odRate <= config.odRate.max;
  const pricing = { ...DEFAULT_PRODUCT_PRICING(category, config), odRatePct: rateOk ? odRate : config.odRate.default };
  const result = estimateFor(choice, cars, { pricing, paOwnerDriver: "optional", includePa: pa, addOns: [], config, today });
  const dep = result && !choice.isNew ? depreciationFor(result.ageMonths, config) : null;

  return (
    <section className="border border-line bg-white">
      <header className="border-b border-line px-5 py-4">
        <h2 className="text-[15px] font-semibold">Live calculator</h2>
        <p className="mt-0.5 text-[12.5px] text-muted">The estimator with the rates currently saved{savedAt ? ` (${savedAt})` : " (launch defaults)"}. Save &amp; publish to see your edits here.</p>
      </header>
      <div className="space-y-4 p-5">
        <VehiclePicker cars={cars} value={choice} onChange={setChoice} maxAgeYears={config.maxVehicleAgeYears} today={today} compact />
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-muted">Policy type</span>
          <span className="relative block">
            <select value={category} onChange={(e) => setCategory(e.target.value as InsProductCategory)} className="h-10 w-full cursor-pointer appearance-none rounded-[3px] border border-line bg-white pl-3 pr-9 text-[13.5px] outline-none hover:border-ink/30 focus:border-ink">
              {INS_PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {INS_PRODUCT_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          </span>
        </label>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
          <label className="block min-w-0">
            <span className="mb-1.5 block text-[12px] font-medium text-muted">Own-damage rate (% of IDV)</span>
            <input
              value={rate}
              onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, "").slice(0, 5))}
              inputMode="decimal"
              aria-invalid={!rateOk || undefined}
              className={cn("h-10 w-full rounded-[3px] border bg-white px-3 text-[13.5px] outline-none focus:border-ink", rateOk ? "border-line hover:border-ink/30" : "border-red")}
            />
          </label>
          <label className="flex h-10 cursor-pointer items-center gap-2 whitespace-nowrap text-[12.5px]">
            <input type="checkbox" checked={pa} onChange={(e) => setPa(e.target.checked)} className="size-4 accent-[var(--color-red)]" /> Owner PA
          </label>
        </div>
        <p className={cn("-mt-2 text-[11.5px]", rateOk ? "text-muted" : "text-red")}>
          Vendors may set {config.odRate.min}–{config.odRate.max}% (default {config.odRate.default}%).{rateOk ? "" : " Using the default."}
        </p>
        {result ? (
          <div className="border-t border-line pt-4">
            <EstimateBreakdown estimate={result.estimate} extraNote={config.disclaimer || undefined} />
            <p className="mt-3 text-[11.5px] text-muted">
              Ex-showroom {`₹${result.variant.price.toLocaleString("en-IN")}`} · {result.variant.fuel === "Electric" ? (result.car.motorKw ? `${result.car.motorKw} kW motor` : "motor power unknown") : result.car.engineCc ? `${result.car.engineCc} cc` : "engine size unknown"}
              {dep ? ` · ${dep.pct}% depreciation${dep.approximate ? " (approximate)" : ""}` : choice.isNew ? " · new car" : ""}
            </p>
          </div>
        ) : (
          <p className="text-[13px] text-muted">Pick a car to see an estimate.</p>
        )}
      </div>
    </section>
  );
}
