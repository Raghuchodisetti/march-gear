"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Plus, X } from "lucide-react";
import { INS_COVER_STATUS_LABEL, INS_COVER_STATUS_TONE } from "@/insurance/labels";
import { CATEGORY_TERMS, type PricingConfig } from "@/insurance/estimator";
import type { ProductCoverage } from "@/insurance/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/field";
import { Toggle } from "@/components/portal/profile/kit";
import { InsDocumentUploader } from "@/components/insurance/vendor/uploader";
import { pricingSummary } from "@/components/insurance/vendor/covers/shared";
import { Field, LineList, RadioCards, UnitInput, control } from "./controls";
import { Note, Section, type SectionProps } from "./section";
import { PRICING_LIMITS, PRODUCT_MAX, toNum, type CoverOption } from "./shared";

/* Sections 4–11 of the product form: coverage, add-ons, pricing, deductibles, garages, exclusions, documents, terms. */

type State = "ready" | "todo" | "error" | "optional";

const NOT_READY = ["draft", "changes_requested", "rejected"];

function CoverStatus({ c }: { c: CoverOption }) {
  return <Badge tone={INS_COVER_STATUS_TONE[c.status]}>{INS_COVER_STATUS_LABEL[c.status]}</Badge>;
}

export function CoverageSection({ v, setIn, err, disabled, state, covers }: SectionProps & { state: State; covers: CoverOption[] }) {
  const c = v.coverage;
  const items = covers.filter((x) => x.type === "coverage");
  const terms = CATEGORY_TERMS[v.category];
  const toggleItem = (id: number) => setIn("coverage", { coverIds: c.coverIds.includes(id) ? c.coverIds.filter((x) => x !== id) : [...c.coverIds, id] });
  return (
    <Section id="coverage" index={4} title="Coverage" description="What every policy includes. The own-damage and third-party terms follow the category; the coverage items come from your Coverage list." state={state}>
      <div className="space-y-6">
        <div data-field="coverage.ownDamage" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="border border-line p-4">
            <Toggle
              checked={c.ownDamage}
              disabled={disabled}
              onChange={(ownDamage) => setIn("coverage", { ownDamage })}
              label="Own damage"
              hint={terms.odYears === 0 ? "Not part of this category" : "Accident, fire, theft and calamity damage to the customer's car"}
            />
          </div>
          <div data-field="coverage.thirdParty" className="border border-line p-4">
            <Toggle
              checked={c.thirdParty}
              disabled={disabled}
              onChange={(thirdParty) => setIn("coverage", { thirdParty, paOwnerDriver: thirdParty ? (c.paOwnerDriver === "none" ? "included" : c.paOwnerDriver) : "none" })}
              label="Third-party liability"
              hint={terms.tpYears === 0 ? "Not part of this category" : "Injury, death and property damage caused to others — required by law"}
            />
          </div>
        </div>
        {(err("coverage.ownDamage") || err("coverage.thirdParty")) && <p className="-mt-3 text-xs text-red">{err("coverage.ownDamage") ?? err("coverage.thirdParty")}</p>}

        <Field name="coverage.paOwnerDriver" label="Owner-driver personal accident cover" error={err("coverage.paOwnerDriver")}>
          <RadioCards<ProductCoverage["paOwnerDriver"]>
            ariaLabel="Owner-driver PA cover"
            columns={3}
            value={c.paOwnerDriver}
            disabled={disabled || !c.thirdParty}
            onChange={(paOwnerDriver) => setIn("coverage", { paOwnerDriver })}
            options={[
              { value: "included", label: "Included", hint: "In every policy" },
              { value: "optional", label: "Optional", hint: "The customer chooses" },
              { value: "none", label: "Not offered", hint: c.thirdParty ? "Customer has it elsewhere" : "Needs third-party cover" },
            ]}
          />
        </Field>

        {c.thirdParty && (
          <Field name="coverage.tpPropertyLimit" label="Third-party property damage limit" htmlFor="p-tplimit" error={err("coverage.tpPropertyLimit")} hint="As stated in the policy wording." className="sm:max-w-sm">
            <input id="p-tplimit" className={control} value={c.tpPropertyLimit} maxLength={PRODUCT_MAX.tpLimit} onChange={(e) => setIn("coverage", { tpPropertyLimit: e.target.value })} placeholder="e.g. ₹7.5 lakh" disabled={disabled} />
          </Field>
        )}

        <div data-field="coverage.coverIds">
          <div className="mb-2 flex items-end justify-between gap-3">
            <p className="text-[12.5px] font-medium">Coverage items</p>
            <Link href="/insurance-vendor/coverage" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-muted hover:text-ink">
              Manage coverage <ArrowUpRight aria-hidden className="size-3.5" />
            </Link>
          </div>
          {items.length ? (
            <ul className="divide-y divide-line border border-line">
              {items.map((x) => {
                const on = c.coverIds.includes(x.id);
                return (
                  <li key={x.id}>
                    <button type="button" role="checkbox" aria-checked={on} disabled={disabled} onClick={() => toggleItem(x.id)} className="flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors hover:bg-mist/50 disabled:cursor-not-allowed disabled:hover:bg-transparent">
                      <span aria-hidden className={cn("mt-0.5 inline-flex size-[18px] shrink-0 items-center justify-center rounded-[3px] border", on ? "border-ink bg-ink text-white" : "border-ink/25 bg-white")}>{on && <Check className="size-3.5" strokeWidth={3} />}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-medium">{x.name}</span>
                        <span className="line-clamp-1 text-[12px] text-muted">{x.description}</span>
                      </span>
                      <CoverStatus c={x} />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="border border-dashed border-line px-4 py-5 text-[13px] text-muted">
              You haven&rsquo;t added any coverage items yet.{" "}
              <Link href="/insurance-vendor/coverage" className="font-medium text-ink underline underline-offset-4">
                Add them from the standard list
              </Link>{" "}
              (own damage, theft, fire, natural calamities…) so customers can see exactly what&rsquo;s covered.
            </p>
          )}
          {err("coverage.coverIds") ? <p className="mt-1.5 text-xs text-red">{err("coverage.coverIds")}</p> : items.some((x) => c.coverIds.includes(x.id) && NOT_READY.includes(x.status)) ? <p className="mt-1.5 text-xs text-[#9a5b00]">Items still in draft (or sent back) must be submitted for approval before this product can be.</p> : null}
        </div>

        <Field name="coverage.highlights" label="Highlights" optional error={err("coverage.highlights")} hint="Short selling points shown on the product card.">
          <LineList ariaLabel="Add a highlight" value={c.highlights} onChange={(highlights) => setIn("coverage", { highlights })} max={PRODUCT_MAX.highlights} maxLength={120} placeholder="e.g. Cashless claims at 1,200+ network garages" disabled={disabled} />
        </Field>
      </div>
    </Section>
  );
}

export function AddOnsSection({ v, set, err, disabled, state, covers }: SectionProps & { state: State; covers: CoverOption[] }) {
  const list = covers.filter((x) => x.type === "addon");
  const chosen = new Map(v.addOns.map((a) => [a.coverId, a]));
  const toggle = (id: number) => set("addOns", chosen.has(id) ? v.addOns.filter((a) => a.coverId !== id) : [...v.addOns, { coverId: id, included: false }]);
  const setIncluded = (id: number, included: boolean) => set("addOns", v.addOns.map((a) => (a.coverId === id ? { ...a, included } : a)));
  return (
    <Section
      id="addons"
      index={5}
      title="Add-on covers"
      description="Extras offered with this product — bundled into the price, or optional for the customer. Only approved covers show on the website."
      state={state}
      action={
        <Link href="/insurance-vendor/add-ons" className="hidden items-center gap-1 text-[12.5px] font-medium text-muted hover:text-ink sm:inline-flex">
          Manage <ArrowUpRight aria-hidden className="size-3.5" />
        </Link>
      }
    >
      <div data-field="addOns">
        {list.length ? (
          <ul className="divide-y divide-line border border-line">
            {list.map((x) => {
              const a = chosen.get(x.id);
              return (
                <li key={x.id} className={cn("flex flex-col gap-3 px-3.5 py-3 transition-colors sm:flex-row sm:items-center", a && "bg-[#fcfcfc]")}>
                  <button type="button" role="checkbox" aria-checked={Boolean(a)} disabled={disabled} onClick={() => toggle(x.id)} className="flex min-w-0 flex-1 items-start gap-3 text-left disabled:cursor-not-allowed">
                    <span aria-hidden className={cn("mt-0.5 inline-flex size-[18px] shrink-0 items-center justify-center rounded-[3px] border", a ? "border-ink bg-ink text-white" : "border-ink/25 bg-white")}>{a && <Check className="size-3.5" strokeWidth={3} />}</span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[13.5px] font-medium">{x.name}</span>
                        <CoverStatus c={x} />
                      </span>
                      <span className="mt-0.5 block text-[12px] text-muted">
                        {pricingSummary(x.pricing)}
                        {x.maxVehicleAgeYears ? ` · cars up to ${x.maxVehicleAgeYears} yrs` : ""}
                        {x.fuels.length ? ` · ${x.fuels.join(", ")}` : ""}
                      </span>
                    </span>
                  </button>
                  {a && (
                    <Segmented<"optional" | "included">
                      ariaLabel={`How ${x.name} is offered`}
                      className="w-full shrink-0 sm:w-auto"
                      value={a.included ? "included" : "optional"}
                      onChange={(m) => !disabled && setIncluded(x.id, m === "included")}
                      options={[
                        { value: "optional", label: "Optional" },
                        { value: "included", label: "Included" },
                      ]}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="border border-dashed border-line px-4 py-5 text-[13px] text-muted">
            No add-on covers yet.{" "}
            <Link href="/insurance-vendor/add-ons" className="font-medium text-ink underline underline-offset-4">
              Add zero depreciation, engine protection, roadside assistance…
            </Link>{" "}
            from the standard templates, then come back to attach them.
          </p>
        )}
        {err("addOns") ? (
          <p className="mt-1.5 text-xs text-red">{err("addOns")}</p>
        ) : v.addOns.some((a) => NOT_READY.includes(list.find((x) => x.id === a.coverId)?.status ?? "")) ? (
          <p className="mt-1.5 text-xs text-[#9a5b00]">Covers still in draft (or sent back) must be submitted for approval before this product can be.</p>
        ) : v.addOns.length ? (
          <p className="mt-1.5 text-xs text-muted">
            {v.addOns.filter((a) => a.included).length} included · {v.addOns.filter((a) => !a.included).length} optional
          </p>
        ) : null}
      </div>
    </Section>
  );
}

export function PricingSection({ v, setIn, err, disabled, state, config }: SectionProps & { state: State; config: PricingConfig }) {
  const p = v.pricing;
  const od = v.coverage.ownDamage;
  const rate = toNum(p.odRatePct);
  const pct = rate === null ? 0 : Math.max(0, Math.min(100, ((rate - config.odRate.min) / (config.odRate.max - config.odRate.min)) * 100));
  const num = (x: string) => x.replace(/[^\d.-]/g, "").slice(0, 8);
  return (
    <Section id="pricing" index={6} title="Pricing" description="Used only for indicative premiums on the site. The insurer sets the final premium when the policy is issued." state={state}>
      <div className="space-y-6">
        <fieldset disabled={!od || disabled} className={cn("space-y-5", !od && "opacity-55")}>
          <legend className="sr-only">Own-damage pricing</legend>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field name="pricing.odRatePct" label="Own-damage rate" htmlFor="p-odrate" error={err("pricing.odRatePct")} hint={`Allowed ${config.odRate.min}–${config.odRate.max}% of IDV a year (typical ${config.odRate.default}%).`}>
              <UnitInput id="p-odrate" value={p.odRatePct} onChange={(x) => setIn("pricing", { odRatePct: num(x) })} suffix="% of IDV" error={err("pricing.odRatePct")} />
              <span aria-hidden className="mt-2 block h-1 overflow-hidden rounded-full bg-mist">
                <span className="block h-full rounded-full bg-ink/70 transition-[width] duration-500" style={{ width: `${pct}%` }} />
              </span>
            </Field>
            <Field name="pricing.minOdPremium" label="Minimum own-damage premium" htmlFor="p-minod" error={err("pricing.minOdPremium")} hint="A floor per year, before NCB.">
              <UnitInput id="p-minod" value={p.minOdPremium} onChange={(x) => setIn("pricing", { minOdPremium: x.replace(/\D/g, "").slice(0, 6) })} prefix="₹" inputMode="numeric" error={err("pricing.minOdPremium")} />
            </Field>
            <Field name="pricing.idvMinPct" label="IDV can go down by" htmlFor="p-idvmin" error={err("pricing.idvMinPct")} hint={`${PRICING_LIMITS.idvMinPct.min}% to 0%.`}>
              <UnitInput id="p-idvmin" value={p.idvMinPct} onChange={(x) => setIn("pricing", { idvMinPct: num(x) })} suffix="%" error={err("pricing.idvMinPct")} />
            </Field>
            <Field name="pricing.idvMaxPct" label="IDV can go up by" htmlFor="p-idvmax" error={err("pricing.idvMaxPct")} hint={`0% to +${PRICING_LIMITS.idvMaxPct.max}%.`}>
              <UnitInput id="p-idvmax" value={p.idvMaxPct} onChange={(x) => setIn("pricing", { idvMaxPct: num(x) })} suffix="%" error={err("pricing.idvMaxPct")} />
            </Field>
            <Field name="pricing.odAdjustmentPct" label="Own-damage adjustment" optional htmlFor="p-odadj" error={err("pricing.odAdjustmentPct")} hint="Flat loading (+) or discount (−) on OD. Usually 0.">
              <UnitInput id="p-odadj" value={p.odAdjustmentPct} onChange={(x) => setIn("pricing", { odAdjustmentPct: num(x) })} suffix="%" error={err("pricing.odAdjustmentPct")} />
            </Field>
          </div>
        </fieldset>
        {!od && <Note>Own-damage pricing doesn&rsquo;t apply — this product has no own-damage cover.</Note>}
        <div className="grid grid-cols-2 gap-5 border-t border-line pt-5 sm:max-w-md">
          <Field name="pricing.odYears" label="Own-damage term" htmlFor="p-odyears" error={err("pricing.odYears")}>
            <UnitInput id="p-odyears" value={od ? p.odYears : "0"} onChange={(x) => setIn("pricing", { odYears: x.replace(/\D/g, "").slice(0, 1) })} suffix="years" inputMode="numeric" disabled={disabled || !od} error={err("pricing.odYears")} />
          </Field>
          <Field name="pricing.tpYears" label="Third-party term" htmlFor="p-tpyears" error={err("pricing.tpYears")}>
            <UnitInput id="p-tpyears" value={v.coverage.thirdParty ? p.tpYears : "0"} onChange={(x) => setIn("pricing", { tpYears: x.replace(/\D/g, "").slice(0, 1) })} suffix="years" inputMode="numeric" disabled={disabled || !v.coverage.thirdParty} error={err("pricing.tpYears")} />
          </Field>
        </div>
        <Note>Third-party premiums come from the regulator&rsquo;s rates in MarchGear&rsquo;s pricing settings, by engine size or motor power. New cars usually carry 1 year of own damage with 3 years of third party.</Note>
      </div>
    </Section>
  );
}

const VOLUNTARY_PRESETS = [2500, 5000, 7500, 15000];

export function DeductiblesSection({ v, setIn, err, disabled, state }: SectionProps & { state: State }) {
  const [draft, setDraft] = useState("");
  const d = v.deductibles;
  const add = (n: number) => {
    if (!Number.isFinite(n) || n < 0 || n > PRICING_LIMITS.deductible.max || d.voluntary.includes(n) || d.voluntary.length >= PRODUCT_MAX.voluntary) return;
    setIn("deductibles", { voluntary: [...d.voluntary, n].sort((a, b) => a - b) });
    setDraft("");
  };
  return (
    <Section id="deductibles" index={7} title="Deductibles" description="What the customer pays towards each own-damage claim." state={state}>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-[220px_minmax(0,1fr)]">
        <Field name="deductibles.compulsory" label="Compulsory deductible" htmlFor="p-ded" error={err("deductibles.compulsory")} hint="Per claim. ₹0 if none.">
          <UnitInput id="p-ded" value={d.compulsory} onChange={(x) => setIn("deductibles", { compulsory: x.replace(/\D/g, "").slice(0, 6) })} prefix="₹" inputMode="numeric" error={err("deductibles.compulsory")} disabled={disabled} />
        </Field>
        <Field name="deductibles.voluntary" label="Voluntary deductible options" optional error={err("deductibles.voluntary")} hint="Amounts customers may choose for a lower premium.">
          <div className="flex flex-wrap items-center gap-2">
            {d.voluntary.map((n) => (
              <span key={n} className="inline-flex items-center gap-1 rounded-full border border-line bg-[#fafafa] py-1 pl-3 pr-1 text-[13px] num">
                ₹{n.toLocaleString("en-IN")}
                {!disabled && (
                  <button type="button" onClick={() => setIn("deductibles", { voluntary: d.voluntary.filter((x) => x !== n) })} aria-label={`Remove ₹${n}`} className="inline-flex size-6 items-center justify-center rounded-full text-muted hover:bg-white hover:text-red">
                    <X className="size-3.5" />
                  </button>
                )}
              </span>
            ))}
            {!disabled &&
              VOLUNTARY_PRESETS.filter((n) => !d.voluntary.includes(n)).map((n) => (
                <button key={n} type="button" onClick={() => add(n)} disabled={d.voluntary.length >= PRODUCT_MAX.voluntary} className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-ink/25 px-3 text-[12.5px] text-muted transition-colors hover:border-ink hover:text-ink disabled:opacity-40 num">
                  <Plus aria-hidden className="size-3" />₹{n.toLocaleString("en-IN")}
                </button>
              ))}
          </div>
          {!disabled && (
            <div className="mt-3 flex max-w-xs gap-2">
              <UnitInput ariaLabel="Another amount" value={draft} onChange={(x) => setDraft(x.replace(/\D/g, "").slice(0, 6))} prefix="₹" inputMode="numeric" placeholder="Another amount" />
              <Button variant="outline" className="h-11 shrink-0" disabled={!draft || d.voluntary.length >= PRODUCT_MAX.voluntary} onClick={() => add(Number(draft))}>
                Add
              </Button>
            </div>
          )}
        </Field>
      </div>
    </Section>
  );
}

export function GaragesSection({ v, set, err, disabled, state, companyGarages }: SectionProps & { state: State; companyGarages: string | null }) {
  return (
    <Section id="garages" index={8} title="Cashless garages" description="How many network garages offer cashless repairs for this product." state={state}>
      <Field name="garageCount" label="Cashless garages" optional htmlFor="p-garages" error={err("garageCount")} hint={companyGarages ? `Leave empty to show the insurer's figure (${companyGarages}).` : "Leave empty to show the insurer's network figure, if MarchGear has one."} className="sm:max-w-xs">
        <UnitInput id="p-garages" value={v.garageCount} onChange={(x) => set("garageCount", x.replace(/\D/g, "").slice(0, 6))} suffix="garages" inputMode="numeric" error={err("garageCount")} disabled={disabled} />
      </Field>
    </Section>
  );
}

const COMMON_EXCLUSIONS = [
  "Driving under the influence of alcohol or drugs",
  "Driving without a valid driving licence",
  "Normal wear and tear, and mechanical or electrical breakdown",
  "Consequential loss",
  "Damage outside the geographical area of India",
  "War, nuclear risks and acts of terrorism (unless covered)",
  "Use of the car for purposes other than private use",
];

export function ExclusionsSection({ v, set, err, disabled, state }: SectionProps & { state: State }) {
  const left = COMMON_EXCLUSIONS.filter((x) => !v.exclusions.includes(x));
  return (
    <Section id="exclusions" index={9} title="Exclusions" description="What the policy doesn't cover. Customers see these before asking for a quote." state={state}>
      <div data-field="exclusions">
        <LineList ariaLabel="Add an exclusion" value={v.exclusions} onChange={(exclusions) => set("exclusions", exclusions)} max={PRODUCT_MAX.exclusions} placeholder="e.g. Damage while driving under the influence" error={err("exclusions")} disabled={disabled} numbered />
        {!disabled && left.length > 0 && v.exclusions.length < PRODUCT_MAX.exclusions && (
          <div className="mt-4">
            <p className="mb-2 text-[12px] font-medium text-muted">Common exclusions — check them against your policy wording</p>
            <div className="flex flex-wrap gap-2">
              {left.map((x) => (
                <button key={x} type="button" onClick={() => set("exclusions", [...v.exclusions, x])} className="inline-flex min-h-8 items-center gap-1 rounded-full border border-dashed border-ink/25 px-3 py-1 text-left text-[12.5px] text-muted transition-colors hover:border-ink hover:text-ink">
                  <Plus aria-hidden className="size-3 shrink-0" /> {x}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

export function DocumentsSection({ v, setIn, err, state }: SectionProps & { state: State }) {
  return (
    <Section id="documents" index={10} title="Documents" description="PDFs customers can download from the product page while it's published." state={state}>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div data-field="documents.wording">
          <InsDocumentUploader kind="policy_wording" label="Policy wording" required value={v.documents.wording} onChange={(f) => setIn("documents", { wording: f })} error={err("documents.wording")} hint="The insurer's full policy wording, as a PDF." />
        </div>
        <div data-field="documents.brochure">
          <InsDocumentUploader kind="brochure" label="Product brochure" value={v.documents.brochure} onChange={(f) => setIn("documents", { brochure: f })} error={err("documents.brochure")} hint="A customer-friendly summary, as a PDF." />
        </div>
      </div>
    </Section>
  );
}

export function TermsSection({ v, set, err, disabled, state }: SectionProps & { state: State }) {
  return (
    <Section id="terms" index={11} title="Terms and conditions" description="Anything else customers should know — claim conditions, waiting periods, how renewals work." state={state}>
      <Field name="terms" label="Terms" optional htmlFor="p-terms" error={err("terms")} hint={`${v.terms.length.toLocaleString("en-IN")} / ${PRODUCT_MAX.terms.toLocaleString("en-IN")} characters.`}>
        <textarea id="p-terms" rows={6} className={cn(control, "h-auto py-2.5 leading-relaxed")} value={v.terms} maxLength={PRODUCT_MAX.terms} onChange={(e) => set("terms", e.target.value)} disabled={disabled} />
      </Field>
    </Section>
  );
}
