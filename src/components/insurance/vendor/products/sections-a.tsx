"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Building2, Info, Lock } from "lucide-react";
import { INS_PRODUCT_CATEGORIES, type InsProductCategory, type InsVendorCategory } from "@/db/enums";
import { INDIA_CITIES } from "@/data/india-cities";
import { INDIAN_STATES, isIndianState } from "@/data/states";
import { INS_PRODUCT_CATEGORY_BLURB, INS_PRODUCT_CATEGORY_LABEL, INS_VENDOR_CATEGORY_SHORT } from "@/insurance/labels";
import { FUELS } from "@/insurance/search";
import type { FuelName } from "@/insurance/types";
import { cn } from "@/lib/utils";
import { useCatalog } from "@/components/providers/catalog-provider";
import { InsDocumentUploader } from "@/components/insurance/vendor/uploader";
import { ChipGroup, Field, MultiPicker, RadioCards, SelectBox, UnitInput, control, type PickOption } from "./controls";
import { Note, Section, type SectionProps } from "./section";
import { BODY_TYPES, MIN_DESCRIPTION, PRODUCT_MAX, type CompanyOption } from "./shared";

/* Sections 1–3 of the product form: basics, the underwriting insurer and vehicle eligibility. */

type State = "ready" | "todo" | "error" | "optional";

export function BasicsSection({ v, set, err, disabled, state, onCategory }: SectionProps & { state: State; onCategory: (c: InsProductCategory) => void }) {
  const len = v.description.trim().length;
  return (
    <Section id="basics" index={1} title="Basics" description="What customers see first. The product code is your own reference and must be unique in your company." state={state}>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field name="name" label="Product name" htmlFor="p-name" error={err("name")} wide>
          <input id="p-name" className={control} value={v.name} maxLength={PRODUCT_MAX.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Private Car Package Policy" aria-invalid={err("name") ? true : undefined} />
        </Field>
        <Field name="code" label="Product code" htmlFor="p-code" error={err("code")} hint="Letters, numbers, dots, dashes or slashes.">
          <input
            id="p-code"
            className={cn(control, "font-mono text-[13.5px] uppercase tracking-wide placeholder:font-sans placeholder:normal-case placeholder:tracking-normal")}
            value={v.code}
            maxLength={PRODUCT_MAX.code}
            onChange={(e) => set("code", e.target.value.toUpperCase().replace(/\s+/g, "-"))}
            placeholder="e.g. PC-PKG-01"
            aria-invalid={err("code") ? true : undefined}
          />
        </Field>
        <Field name="uin" label="Insurer's product UIN" optional htmlFor="p-uin" error={err("uin")} hint="The identifier the insurer filed the product under, if any.">
          <input id="p-uin" className={cn(control, "font-mono text-[13.5px] uppercase placeholder:font-sans placeholder:normal-case")} value={v.uin} maxLength={PRODUCT_MAX.uin} onChange={(e) => set("uin", e.target.value.toUpperCase())} />
        </Field>
      </div>

      <div data-field="category" className="mt-6">
        <p className="mb-1.5 text-[12.5px] font-medium">Category</p>
        <RadioCards<InsProductCategory>
          ariaLabel="Category"
          value={v.category}
          disabled={disabled}
          onChange={(c) => c !== v.category && onCategory(c)}
          options={INS_PRODUCT_CATEGORIES.map((c) => ({ value: c, label: INS_PRODUCT_CATEGORY_LABEL[c], hint: INS_PRODUCT_CATEGORY_BLURB[c] }))}
        />
        {err("category") ? <p className="mt-1.5 text-xs text-red">{err("category")}</p> : <p className="mt-2 text-xs text-muted">Changing the category resets the own-damage and third-party terms to its usual ones.</p>}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5">
        <Field name="tagline" label="Tagline" optional htmlFor="p-tagline" error={err("tagline")} hint="One line under the name, e.g. “Cashless repairs at 1,200+ garages”.">
          <input id="p-tagline" className={control} value={v.tagline} maxLength={PRODUCT_MAX.tagline} onChange={(e) => set("tagline", e.target.value)} />
        </Field>
        <Field
          name="description"
          label="Description"
          htmlFor="p-desc"
          error={err("description")}
          hint={
            <span className={cn(len >= MIN_DESCRIPTION && "text-[#1e7a3c]")}>
              {len.toLocaleString("en-IN")} characters{len < MIN_DESCRIPTION ? ` — at least ${MIN_DESCRIPTION} to submit` : ""}. Plain language: who it&rsquo;s for and what makes it different.
            </span>
          }
        >
          <textarea id="p-desc" rows={6} className={cn(control, "h-auto py-2.5 leading-relaxed")} value={v.description} maxLength={PRODUCT_MAX.description} onChange={(e) => set("description", e.target.value)} aria-invalid={err("description") ? true : undefined} />
        </Field>
      </div>
    </Section>
  );
}

export function InsurerSection({
  v,
  set,
  setIn,
  err,
  disabled,
  state,
  companies,
  vendorCategory,
}: SectionProps & { state: State; companies: CompanyOption[]; vendorCategory: InsVendorCategory | null }) {
  const insurer = vendorCategory === "insurer";
  const own = companies[0];
  const chosen = companies.find((c) => String(c.id) === v.companyId);
  return (
    <Section
      id="insurer"
      index={2}
      title="Underwriting insurer"
      description={insurer ? "The insurance company that issues the policy — your own company on MarchGear." : "The insurer whose product you distribute. MarchGear checks your authorisation with every submission."}
      state={state}
    >
      {insurer ? (
        own ? (
          <div data-field="companyId" className="flex items-center gap-4 border border-line bg-[#fafafa] p-4">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-white">
              <Building2 aria-hidden className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14.5px] font-semibold">{own.name}</p>
              <p className="text-[12.5px] text-muted">{own.isActive ? "Your company listing on MarchGear" : "Your company listing is inactive — contact MarchGear support"}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted">
              <Lock aria-hidden className="size-3.5" /> Locked
            </span>
          </div>
        ) : (
          <div data-field="companyId" className="border border-dashed border-line p-5 text-[13.5px]">
            <p className="font-medium">Your company listing isn&rsquo;t linked yet</p>
            <p className="mt-1 text-muted">MarchGear staff link your insurer listing to this account after approval. Products can be saved once it&rsquo;s linked — contact support if it&rsquo;s taking long.</p>
            {err("companyId") && <p className="mt-2 text-xs text-red">{err("companyId")}</p>}
          </div>
        )
      ) : (
        <div className="space-y-5">
          {companies.length ? (
            <Field name="companyId" label="Insurer" htmlFor="p-company" error={err("companyId")} hint={chosen && !chosen.isActive ? "This insurer is inactive on MarchGear — choose another to submit." : `As a ${INS_VENDOR_CATEGORY_SHORT[vendorCategory ?? "other_intermediary"].toLowerCase()}, choose the insurer that underwrites this product.`}>
              <SelectBox
                id="p-company"
                value={v.companyId}
                onChange={(x) => set("companyId", x)}
                placeholder="Choose the insurer"
                options={companies.map((c) => ({ value: String(c.id), label: `${c.name}${c.isActive ? "" : " (inactive)"}` }))}
                error={err("companyId")}
                disabled={disabled}
              />
            </Field>
          ) : (
            <div data-field="companyId" className="flex gap-3 border border-dashed border-line p-5 text-[13.5px]">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
              <div>
                <p className="font-medium">No insurers are listed yet</p>
                <p className="mt-1 text-muted">
                  MarchGear staff add the insurance companies vendors can list products for. Ask them to add the insurer you work with through{" "}
                  <Link href="/insurance-vendor/support" className="font-medium text-ink underline underline-offset-4">
                    Support
                  </Link>
                  .
                </p>
              </div>
            </div>
          )}
          <div data-field="documents.tieUp">
            <InsDocumentUploader
              kind="tie_up_letter"
              label="Insurer authorisation / tie-up letter"
              required
              value={v.documents.tieUp}
              onChange={(f) => setIn("documents", { tieUp: f })}
              error={err("documents.tieUp")}
              hint="The insurer's letter authorising you to distribute this product. Only MarchGear staff see it."
            />
          </div>
        </div>
      )}
    </Section>
  );
}

export function EligibilitySection({ v, setIn, err, disabled, state, maxAge }: SectionProps & { state: State; maxAge: number }) {
  const cat = useCatalog();
  const e = v.eligibility;
  const brandOptions: PickOption[] = useMemo(() => [...cat.brands].sort((a, b) => a.name.localeCompare(b.name)).map((b) => ({ value: b.slug, label: b.name, meta: b.isLuxury ? "Luxury" : undefined })), [cat.brands]);
  const modelOptions: PickOption[] = useMemo(
    () =>
      cat.cars
        .filter((c) => !e.brands.length || e.brands.includes(c.brand))
        .map((c) => ({ value: c.slug, label: c.name, group: cat.brandName(c.brand), meta: c.bodyType }))
        .sort((a, b) => (a.group ?? "").localeCompare(b.group ?? "") || a.label.localeCompare(b.label)),
    [cat, e.brands],
  );
  const stateOptions: PickOption[] = INDIAN_STATES.map((s) => ({ value: s, label: s }));
  const cityOptions: PickOption[] = useMemo(() => {
    const states = e.states.length ? e.states.filter(isIndianState) : [...INDIAN_STATES];
    const out: PickOption[] = [];
    const seen = new Set<string>();
    for (const s of states) {
      const list = new Set([...(INDIA_CITIES[s] ?? []), ...cat.cities.filter((c) => c.state === s).map((c) => c.name)]);
      for (const c of [...list].sort((a, b) => a.localeCompare(b))) {
        if (seen.has(c)) continue;
        seen.add(c);
        out.push({ value: c, label: c, group: s });
      }
    }
    return out;
  }, [e.states, cat.cities]);

  // Dropping a brand drops its models; dropping a state drops its cities.
  const setBrands = (brands: string[]) => setIn("eligibility", { brands, models: brands.length ? e.models.filter((m) => brands.includes(cat.getCar(m)?.brand ?? "")) : e.models });
  const setStates = (states: string[]) => {
    const keep = states.length ? new Set(states.filter(isIndianState).flatMap((s) => [...(INDIA_CITIES[s] ?? []), ...cat.cities.filter((c) => c.state === s).map((c) => c.name)])) : null;
    setIn("eligibility", { states, cities: keep ? e.cities.filter((c) => keep.has(c)) : e.cities });
  };

  return (
    <Section id="eligibility" index={3} title="Vehicle eligibility" description="Which cars the product is sold for. Leave a filter empty for “any” — customers outside the rules aren't shown the product." state={state}>
      <div className="space-y-6">
        <Field name="eligibility.bodyTypes" label="Body types" error={err("eligibility.bodyTypes")} hint={e.bodyTypes.length ? undefined : "None selected — every body type."}>
          <ChipGroup ariaLabel="Body types" options={BODY_TYPES.map((b) => ({ value: b, label: b }))} value={e.bodyTypes} onChange={(bodyTypes) => setIn("eligibility", { bodyTypes })} disabled={disabled} />
        </Field>
        <Field name="eligibility.luxury" label="Luxury cars" error={err("eligibility.luxury")}>
          <RadioCards<"any" | "exclude" | "only">
            ariaLabel="Luxury cars"
            columns={3}
            value={e.luxury}
            disabled={disabled}
            onChange={(luxury) => setIn("eligibility", { luxury })}
            options={[
              { value: "any", label: "Any car", hint: "Mainstream and luxury" },
              { value: "exclude", label: "Exclude luxury", hint: "Mainstream brands only" },
              { value: "only", label: "Luxury only", hint: "Premium brands and models" },
            ]}
          />
        </Field>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Field name="eligibility.brands" label="Brands" error={err("eligibility.brands")}>
            <MultiPicker title="Brands" description="Leave empty to offer the product for every brand." options={brandOptions} value={e.brands} onChange={setBrands} anyLabel="Any brand" disabled={disabled} max={PRODUCT_MAX.brands} />
          </Field>
          <Field name="eligibility.models" label="Models" error={err("eligibility.models")} hint={e.brands.length ? "From the chosen brands." : undefined}>
            <MultiPicker title="Models" description={e.brands.length ? "Models of the brands you chose. Leave empty for all of them." : "Leave empty to offer the product for every model."} options={modelOptions} value={e.models} onChange={(models) => setIn("eligibility", { models })} anyLabel="Any model" disabled={disabled} max={PRODUCT_MAX.models} />
          </Field>
        </div>
        <Field name="eligibility.fuels" label="Fuels" error={err("eligibility.fuels")} hint={e.fuels.length ? undefined : "None selected — every fuel."}>
          <ChipGroup ariaLabel="Fuels" options={FUELS.map((f) => ({ value: f, label: f }))} value={e.fuels} onChange={(fuels) => setIn("eligibility", { fuels: fuels as FuelName[] })} disabled={disabled} />
        </Field>
        <div className="grid grid-cols-2 gap-5 sm:max-w-md">
          <Field name="eligibility.minAgeYears" label="Minimum car age" htmlFor="p-minage" error={err("eligibility.minAgeYears")}>
            <UnitInput id="p-minage" value={e.minAgeYears} onChange={(x) => setIn("eligibility", { minAgeYears: x.replace(/\D/g, "").slice(0, 2) })} suffix="years" inputMode="numeric" error={err("eligibility.minAgeYears")} disabled={disabled} />
          </Field>
          <Field name="eligibility.maxAgeYears" label="Maximum car age" htmlFor="p-maxage" error={err("eligibility.maxAgeYears")}>
            <UnitInput id="p-maxage" value={e.maxAgeYears} onChange={(x) => setIn("eligibility", { maxAgeYears: x.replace(/\D/g, "").slice(0, 2) })} suffix="years" inputMode="numeric" error={err("eligibility.maxAgeYears")} disabled={disabled} />
          </Field>
        </div>
        <Note>Age is in whole years at the policy start; 0 means a new car. MarchGear estimates premiums for cars up to {maxAge} years old.</Note>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Field name="eligibility.states" label="States" error={err("eligibility.states")}>
            <MultiPicker title="States" description="Leave empty to sell across India." options={stateOptions} value={e.states} onChange={setStates} anyLabel="All of India" disabled={disabled} max={PRODUCT_MAX.states} />
          </Field>
          <Field name="eligibility.cities" label="Cities" error={err("eligibility.cities")} hint={e.states.length ? "In the chosen states." : undefined}>
            <MultiPicker title="Cities" description={e.states.length ? "Cities in the chosen states. Leave empty for the whole of those states." : "Leave empty for every city."} options={cityOptions} value={e.cities} onChange={(cities) => setIn("eligibility", { cities })} anyLabel={e.states.length ? "Every city in those states" : "Every city"} disabled={disabled} max={PRODUCT_MAX.cities} />
          </Field>
        </div>
      </div>
    </Section>
  );
}
