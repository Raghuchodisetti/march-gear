"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { InsCoverStatus } from "@/db/enums";
import { ageYears, eligibilityProblems, type PricingConfig } from "@/insurance/estimator";
import { INS_COVER_STATUS_LABEL } from "@/insurance/labels";
import type { CoverPricing, FuelName, ProductEligibility, ProductPricing } from "@/insurance/types";
import { cn } from "@/lib/utils";
import { EstimateBreakdown, VehiclePicker, estimateFor, firstChoice, type PickerCar, type VehicleChoice } from "../config/estimate";

/* The product review's "sample indicative estimate": pick a catalogue car and see what the product's pricing gives. */

export interface SampleAddOn {
  coverId: number;
  key: string;
  name: string;
  pricing: CoverPricing;
  included: boolean;
  status: InsCoverStatus;
}

export function SampleEstimate({
  cars,
  today,
  config,
  pricing,
  paOwnerDriver,
  addOns,
  eligibility,
}: {
  cars: PickerCar[];
  today: string;
  config: PricingConfig & { disclaimer?: string };
  pricing: ProductPricing;
  paOwnerDriver: "included" | "optional" | "none";
  addOns: SampleAddOn[];
  eligibility: ProductEligibility;
}) {
  const [choice, setChoice] = useState<VehicleChoice>(() => firstChoice(cars, today));
  const [picked, setPicked] = useState<number[]>([]);
  const [includePa, setIncludePa] = useState(true);
  const result = estimateFor(choice, cars, {
    pricing,
    paOwnerDriver,
    includePa,
    addOns: addOns.map((a) => ({ coverId: a.coverId, key: a.key, name: a.name, pricing: a.pricing, included: a.included, selected: picked.includes(a.coverId) })),
    config,
    today,
  });
  const problems = result
    ? eligibilityProblems(eligibility, {
        brand: result.car.brand,
        model: result.car.slug,
        bodyType: result.car.bodyType,
        isLuxury: result.car.isLuxury,
        fuel: result.variant.fuel as FuelName,
        ageYears: ageYears(result.ageMonths),
        state: "",
        city: "",
      })
    : [];
  const optional = addOns.filter((a) => !a.included);
  const unapproved = addOns.filter((a) => a.status !== "approved");

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-5">
        <VehiclePicker cars={cars} value={choice} onChange={setChoice} maxAgeYears={config.maxVehicleAgeYears} today={today} />
        {(optional.length > 0 || paOwnerDriver === "optional") && (
          <fieldset>
            <legend className="mb-2 text-[12px] font-medium text-muted">Optional covers the customer could add</legend>
            <div className="flex flex-wrap gap-1.5">
              {paOwnerDriver === "optional" && (
                <label className={cn("inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] transition-colors", includePa ? "border-ink bg-mist" : "border-line hover:border-ink/30")}>
                  <input type="checkbox" checked={includePa} onChange={(e) => setIncludePa(e.target.checked)} className="size-3.5 accent-[var(--color-red)]" />
                  Owner-driver PA
                </label>
              )}
              {optional.map((a) => {
                const on = picked.includes(a.coverId);
                return (
                  <label key={a.coverId} className={cn("inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] transition-colors", on ? "border-ink bg-mist" : "border-line hover:border-ink/30")}>
                    <input type="checkbox" checked={on} onChange={() => setPicked((p) => (on ? p.filter((x) => x !== a.coverId) : [...p, a.coverId]))} className="size-3.5 accent-[var(--color-red)]" />
                    {a.name}
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
        {problems.length > 0 && (
          <p className="flex gap-2 rounded-[3px] border border-[#e09200]/30 bg-[#fdf3e1] px-3 py-2.5 text-[12.5px] text-[#7a4800]">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              This product wouldn&apos;t be offered for this car: {problems.join("; ")}. The estimate is shown anyway so you can check the pricing.
            </span>
          </p>
        )}
        {unapproved.length > 0 && (
          <p className="text-[12px] text-muted">
            Includes covers that aren&apos;t approved yet ({unapproved.map((a) => `${a.name}: ${INS_COVER_STATUS_LABEL[a.status].toLowerCase()}`).join(", ")}) — the public estimate leaves them out until they are.
          </p>
        )}
      </div>
      <div className="min-w-0 border border-line bg-white p-5">{result ? <EstimateBreakdown estimate={result.estimate} extraNote={config.disclaimer || undefined} /> : <p className="text-[13px] text-muted">Pick a car to see an estimate.</p>}</div>
    </div>
  );
}
