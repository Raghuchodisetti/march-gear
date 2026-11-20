"use client";

import { useMemo } from "react";
import { SelectField, Segmented, TextField } from "@/components/ui/field";
import { useCatalog } from "@/components/providers/catalog-provider";
import type { InsPolicyStatus } from "@/db/enums";
import type { FuelName, InsuranceSearch } from "@/insurance/types";
import { EMPTY_SEARCH, FUELS, NCB_OPTIONS, normaliseReg } from "@/insurance/search";
import { cn } from "@/lib/utils";

/**
 * A compact car chooser for the marketplace (product-page estimator, the compare page's
 * "add your car" prompt and the quote request when no car was chosen yet). Brands, models
 * and variants come from the catalogue. Controlled: it edits an InsuranceSearch.
 */
export function VehiclePicker({
  value,
  onChange,
  thisYear,
  maxAgeYears,
  errors = {},
  layout = "grid",
  showReg = true,
}: {
  value: InsuranceSearch;
  onChange: (next: InsuranceSearch) => void;
  thisYear: number;
  maxAgeYears: number;
  errors?: Record<string, string>;
  layout?: "grid" | "stack";
  showReg?: boolean;
}) {
  const { brands, carsByBrand, getCar } = useCatalog();
  const brandOptions = useMemo(
    () =>
      brands
        .filter((b) => carsByBrand(b.slug).length > 0)
        .map((b) => ({ value: b.slug, label: b.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [brands, carsByBrand],
  );
  const models = value.brand ? carsByBrand(value.brand) : [];
  const car = value.model ? getCar(value.model) : undefined;
  const fuels = (car?.fuelTypes ?? []).filter((f): f is FuelName => (FUELS as string[]).includes(f));
  const variants = car?.variants ?? [];
  const renewal = value.intent === "renewal";
  const years = Array.from({ length: maxAgeYears + 1 }, (_, i) => thisYear - i);
  const set = (patch: Partial<InsuranceSearch>) => onChange({ ...value, ...patch });

  const policyOptions: { value: InsPolicyStatus; label: string }[] = [
    { value: "active", label: "Active" },
    { value: "expired_recent", label: "Expired within 90 days" },
    { value: "expired_long", label: "Expired over 90 days ago" },
  ];

  return (
    <div className="space-y-4">
      <Segmented
        className="flex w-full"
        ariaLabel="New car or renewal"
        value={value.intent}
        onChange={(intent) =>
          onChange(
            intent === "new"
              ? { ...value, intent, policy: "new_vehicle", reg: "", year: null, ncb: 0, claimed: false, expiry: "" }
              : { ...value, intent, policy: value.policy === "new_vehicle" || !value.policy ? "active" : value.policy, year: value.year ?? thisYear - 1 },
          )
        }
        options={[
          { value: "new", label: "New car" },
          { value: "renewal", label: "Renew a policy" },
        ]}
      />
      <div className={cn("grid grid-cols-1 gap-4", layout === "grid" && "sm:grid-cols-2")}>
        <SelectField
          label="Brand"
          placeholder="Choose brand"
          value={value.brand}
          error={errors.brand ?? errors.vehicle}
          onChange={(e) => set({ brand: e.target.value, model: "", variant: "", fuel: "" })}
          options={brandOptions}
        />
        <SelectField
          label="Model"
          placeholder={value.brand ? "Choose model" : "Choose a brand first"}
          value={value.model}
          disabled={!value.brand}
          error={errors.model}
          onChange={(e) => {
            const next = getCar(e.target.value);
            set({ model: e.target.value, variant: "", fuel: next && next.fuelTypes.length === 1 ? (next.fuelTypes[0] as FuelName) : "" });
          }}
          options={models.map((m) => ({ value: m.slug, label: m.name }))}
        />
        <SelectField
          label="Variant"
          value={value.variant}
          disabled={!car}
          onChange={(e) => {
            const v = variants.find((x) => x.slug === e.target.value);
            set({ variant: e.target.value, fuel: v ? (v.fuel as FuelName) : value.fuel });
          }}
          options={[{ value: "", label: car ? "Not sure — use starting price" : "Choose a model first" }, ...variants.map((v) => ({ value: v.slug, label: v.name }))]}
        />
        {fuels.length > 1 && !value.variant ? (
          <SelectField
            label="Fuel"
            value={value.fuel}
            onChange={(e) => set({ fuel: e.target.value as FuelName | "" })}
            options={[{ value: "", label: "Choose fuel" }, ...fuels.map((f) => ({ value: f, label: f }))]}
          />
        ) : (
          <TextField label="Fuel" value={value.variant ? (variants.find((x) => x.slug === value.variant)?.fuel ?? "") : (fuels[0] ?? "")} readOnly placeholder="—" tabIndex={-1} />
        )}
        {renewal && (
          <>
            <SelectField
              label="Manufacturing year"
              value={String(value.year ?? "")}
              error={errors.year}
              onChange={(e) => set({ year: e.target.value ? Number(e.target.value) : null })}
              options={years.map((y) => ({ value: String(y), label: String(y) }))}
            />
            <SelectField
              label="Current policy"
              value={value.policy || "active"}
              onChange={(e) => set({ policy: e.target.value as InsPolicyStatus })}
              options={policyOptions}
            />
            <SelectField
              label="No-claim bonus"
              value={String(value.ncb)}
              onChange={(e) => set({ ncb: Number(e.target.value) })}
              options={NCB_OPTIONS.map((n) => ({ value: String(n), label: n === 0 ? "0% (none)" : `${n}%` }))}
            />
            {showReg && (
              <TextField
                label="Registration number (optional)"
                value={value.reg}
                error={errors.reg}
                onChange={(e) => set({ reg: normaliseReg(e.target.value) })}
                placeholder="MH12AB1234"
                autoComplete="off"
              />
            )}
            <label className={cn("flex cursor-pointer items-center gap-3 text-[13px] text-ink", layout === "grid" && "sm:col-span-2")}>
              <input type="checkbox" checked={value.claimed} onChange={(e) => set({ claimed: e.target.checked })} className="size-4 accent-[var(--color-ink)]" />
              I made a claim in the last policy year
            </label>
          </>
        )}
      </div>
    </div>
  );
}

/** A fresh search for the picker. */
export const blankSearch = (intent: InsuranceSearch["intent"] = "new"): InsuranceSearch => ({ ...EMPTY_SEARCH, intent, policy: intent === "new" ? "new_vehicle" : "active" });
