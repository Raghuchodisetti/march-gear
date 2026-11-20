"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, Check, CircleAlert, Eye, Loader2, Plus, RotateCcw, Send, Save, Trash2, TriangleAlert } from "lucide-react";
import type { InsPolicyStatus, InsQuoteAuthorization } from "@/db/enums";
import { INDICATIVE_NOTE, INS_POLICY_STATUS_LABEL, INS_PRODUCT_CATEGORY_LABEL, INS_PRODUCT_STATUS_LABEL } from "@/insurance/labels";
import { effectiveNcb, type PricingConfig } from "@/insurance/estimator";
import { NCB_OPTIONS } from "@/insurance/search";
import type { QuoteCoverLine } from "@/insurance/types";
import { cn } from "@/lib/utils";
import { saveQuoteAction } from "@/server/actions/ins-quotes";
import { useCatalog } from "@/components/providers/catalog-provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { Input, Select, Textarea } from "@/components/portal/crm/controls";
import { useRun } from "@/components/portal/crm/use-run";
import { addDays, rupees } from "@/components/portal/billing/shared";
import { formatDayShort } from "@/components/insurance/vendor/crm/badges";
import { formatMobile } from "@/components/insurance/vendor/crm/shared";
import { AUTH_DECLARATION, AUTH_EXPLAINER, MAX_COVER_LINES, addOnProblem, breakdownLines, defaultCoverLines, priceQuote, productProblems, type BuilderProduct, type QuoteForm } from "./pricing";
import { QuotePreview } from "./quote-preview";
import { vehicleFromCatalog } from "./vehicle";

export interface BuilderEnquiry {
  id: number;
  reference: string;
  name: string;
  mobile: string;
  email: string | null;
  regNumber: string | null;
  city: string | null;
  state: string | null;
  intent: "new" | "renewal";
  policyStatus: InsPolicyStatus | null;
  policyExpiry: string | null;
  previousInsurer: string | null;
  claimedLastYear: boolean;
  ncbPct: number;
  /** Add-on keys the customer ticked. */
  addOns: string[];
  idv: number | null;
  productId: number | null;
  vehicle: { brand: string; model: string; variant: string; year: number | null; isNew: boolean };
}

const STEPS = ["Customer & vehicle", "Product", "Coverage", "Add-ons", "IDV & pricing", "Premium", "Validity", "Authorisation", "Notes & terms", "Preview"] as const;

function Step({ n, title, hint, children, id }: { n: number; title: string; hint?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id ?? `step-${n}`} className="scroll-mt-24 border border-line bg-white">
      <header className="flex items-start gap-3.5 border-b border-line px-5 py-4 sm:px-6">
        <span className="mt-px inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-[11.5px] font-semibold text-white num">{n}</span>
        <div className="min-w-0">
          <h2 className="text-[14.5px] font-semibold">{title}</h2>
          {hint && <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{hint}</p>}
        </div>
      </header>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

export function QuoteBuilder({
  enquiry,
  products,
  config,
  validityDays,
  today,
  vendorName,
  quote,
}: {
  enquiry: BuilderEnquiry;
  products: BuilderProduct[];
  config: PricingConfig;
  validityDays: number;
  today: string;
  vendorName: string;
  /** Editing an existing draft. */
  quote?: { id: number; reference: string; form: QuoteForm };
}) {
  const router = useRouter();
  const catalog = useCatalog();
  const { run, busy, errors, setErrors } = useRun();
  const [confirm, setConfirm] = useState(false);

  /* ── Vehicle ── */
  const [veh, setVeh] = useState(enquiry.vehicle);
  const resolved = useMemo(() => vehicleFromCatalog(catalog, { ...veh, city: enquiry.city ?? "", state: enquiry.state ?? "" }), [catalog, veh, enquiry.city, enquiry.state]);
  const vehicle = resolved.ok ? resolved.vehicle : null;
  const thisYear = Number(today.slice(0, 4));
  const brands = useMemo(() => catalog.brands.filter((b) => catalog.cars.some((c) => c.brand === b.slug)).sort((a, b) => a.name.localeCompare(b.name)), [catalog]);
  const models = useMemo(() => catalog.cars.filter((c) => c.brand === veh.brand).sort((a, b) => a.name.localeCompare(b.name)), [catalog, veh.brand]);
  const variants = catalog.getCar(veh.model)?.variants ?? [];

  /* ── Product & choices ── */
  const eligibleOf = (p: BuilderProduct) => (vehicle ? productProblems(p, vehicle, config, today) : []);
  const firstProduct = () => {
    const fromEnquiry = products.find((p) => p.id === enquiry.productId);
    return (fromEnquiry ?? products[0])?.id ?? null;
  };
  const defaultNcb = effectiveNcb(enquiry.ncbPct, { isNew: enquiry.vehicle.isNew, claimed: enquiry.claimedLastYear, lapsedLong: enquiry.policyStatus === "expired_long" }, config);
  const initialFor = (productId: number | null): QuoteForm => {
    const p = products.find((x) => x.id === productId);
    const ticked = new Set(enquiry.addOns);
    return {
      productId,
      idv: enquiry.idv,
      ncbPct: defaultNcb,
      includePa: true,
      addOnIds: p ? p.addOns.filter((a) => !a.included && ticked.has(a.key)).map((a) => a.coverId) : [],
      voluntaryDeductible: 0,
      adjustment: 0,
      coverage: p ? defaultCoverLines(p, true) : [],
      validUntil: addDays(today, validityDays),
      authorization: "indicative",
      insurerQuoteRef: "",
      declaration: false,
      notes: "",
      terms: p?.terms ?? "",
    };
  };
  const [form, setForm] = useState<QuoteForm>(() => quote?.form ?? initialFor(firstProduct()));
  const set = <K extends keyof QuoteForm>(k: K, v: QuoteForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const product = products.find((p) => p.id === form.productId) ?? null;

  // Adjustment entered as a positive amount + direction.
  const [adjKind, setAdjKind] = useState<"discount" | "loading">(form.adjustment > 0 ? "loading" : "discount");
  const [adjAmount, setAdjAmount] = useState(form.adjustment ? String(Math.abs(form.adjustment)) : "");
  const applyAdjustment = (kind: "discount" | "loading", amount: string) => {
    setAdjKind(kind);
    setAdjAmount(amount);
    const n = Number(amount || 0);
    set("adjustment", Number.isFinite(n) ? (kind === "discount" ? -Math.round(n) : Math.round(n)) : 0);
  };

  const pickProduct = (id: number) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    const ticked = new Set(enquiry.addOns);
    setForm((f) => ({
      ...f,
      productId: id,
      idv: null,
      addOnIds: p.addOns.filter((a) => !a.included && (ticked.has(a.key) || f.addOnIds.includes(a.coverId))).map((a) => a.coverId),
      voluntaryDeductible: 0,
      coverage: defaultCoverLines(p, f.includePa),
      terms: f.terms && f.terms !== product?.terms ? f.terms : (p.terms ?? ""),
    }));
    setErrors({});
  };

  const priced = useMemo(() => (vehicle && product ? priceQuote(vehicle, product, form, config, today) : null), [vehicle, product, form, config, today]);
  const b = priced?.breakdown ?? null;
  const clientProblems = priced?.problems ?? {};
  const err = (k: string) => errors[k] ?? clientProblems[k];
  const productBlocked = product && vehicle ? eligibleOf(product) : [];

  /* ── Coverage lines ── */
  const setLine = (i: number, patch: Partial<QuoteCoverLine>) => set("coverage", form.coverage.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const removeLine = (i: number) => set("coverage", form.coverage.filter((_, j) => j !== i));
  const addLine = () => form.coverage.length < MAX_COVER_LINES && set("coverage", [...form.coverage, { name: "", detail: "" }]);

  /* ── Save ── */
  const save = async (submit: boolean) => {
    setConfirm(false);
    const res = await run(
      submit ? "submit" : "save",
      () =>
        saveQuoteAction({
          quoteId: quote?.id,
          enquiryId: enquiry.id,
          vehicle: { brand: veh.brand, model: veh.model, variant: veh.variant, year: veh.isNew ? null : veh.year, isNew: veh.isNew },
          productId: form.productId,
          idv: form.idv,
          ncbPct: form.ncbPct,
          includePa: form.includePa,
          addOnIds: form.addOnIds,
          voluntaryDeductible: form.voluntaryDeductible,
          adjustment: form.adjustment,
          coverage: form.coverage,
          validUntil: form.validUntil,
          authorization: form.authorization,
          insurerQuoteRef: form.insurerQuoteRef,
          declaration: form.declaration,
          notes: form.notes,
          terms: form.terms,
          submit,
        }),
      (r) => (r.submitted ? `${r.reference} sent to ${enquiry.name.split(" ")[0]}` : `Draft ${r.reference} saved`),
    );
    if (res) router.push(`/insurance-vendor/quotes/${res.id}`);
  };

  const ready = Boolean(vehicle && product && b && !productBlocked.length && Object.keys(clientProblems).length === 0 && form.coverage.length > 0);
  const authOk = form.authorization === "indicative" || (form.insurerQuoteRef.trim().length >= 3 && form.declaration);

  const previewData = {
    reference: quote?.reference ?? null,
    vendorName,
    authorization: form.authorization,
    insurerQuoteRef: form.insurerQuoteRef.trim() || null,
    customer: { name: enquiry.name, mobile: formatMobile(enquiry.mobile), email: enquiry.email, city: enquiry.city },
    vehicle: { line: vehicle ? `${vehicle.brandName} ${vehicle.modelName} ${vehicle.variantName}${vehicle.isNew ? " · New" : vehicle.year ? ` · ${vehicle.year}` : ""}${vehicle.fuel ? ` · ${vehicle.fuel}` : ""}` : "", reg: enquiry.regNumber },
    product: product ? { name: product.name, companyName: product.companyName, category: product.category, code: product.code, uin: product.uin } : null,
    coverage: form.coverage.filter((c) => c.name.trim()),
    breakdown: b,
    validUntil: form.validUntil,
    issuedOn: today,
    notes: form.notes.trim(),
    terms: form.terms.trim(),
  };

  const idvBand = b && b.odYears > 0 ? { min: b.idvMin, max: b.idvMax } : null;
  const step = Math.max(100, Math.round(((idvBand?.max ?? 0) - (idvBand?.min ?? 0)) / 100 / 100) * 100);

  return (
    <div className="grid grid-cols-1 gap-6 pb-36 xl:grid-cols-[minmax(0,1fr)_400px] xl:pb-0">
      <div className="min-w-0 space-y-4">
        {/* Step index */}
        <nav aria-label="Builder steps" className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          {STEPS.map((s, i) => (
            <a key={s} href={i === 9 ? "#quote-preview" : `#step-${i + 1}`} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[3px] border border-line bg-white px-2.5 text-[12px] font-medium text-ink/75 transition-colors hover:border-ink/40 hover:text-ink">
              <span className="text-muted num">{i + 1}</span> {s}
            </a>
          ))}
        </nav>

        {/* 1 · Customer & vehicle */}
        <Step n={1} title="Review the customer and vehicle" hint="The premium is priced from the catalogue variant's ex-showroom price, as on the public site. Correct the car here if needed — the enquiry is updated when you save.">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13.5px] sm:grid-cols-4">
            <div className="col-span-2 min-w-0 sm:col-span-1">
              <dt className="text-[12px] text-muted">Customer</dt>
              <dd className="mt-0.5 truncate font-medium">{enquiry.name}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[12px] text-muted">Mobile</dt>
              <dd className="mt-0.5 num">+91 {formatMobile(enquiry.mobile)}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[12px] text-muted">City</dt>
              <dd className="mt-0.5 truncate">{[enquiry.city, enquiry.state].filter(Boolean).join(", ") || "—"}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[12px] text-muted">Registration</dt>
              <dd className="mt-0.5 font-mono font-semibold">{enquiry.regNumber ?? (veh.isNew ? "New car" : "—")}</dd>
            </div>
            <div className="col-span-2 min-w-0">
              <dt className="text-[12px] text-muted">Current policy</dt>
              <dd className="mt-0.5">
                {enquiry.policyStatus ? INS_POLICY_STATUS_LABEL[enquiry.policyStatus] : "Not given"}
                {enquiry.policyExpiry ? ` · expires ${formatDayShort(enquiry.policyExpiry)}` : ""}
                {enquiry.previousInsurer ? ` · ${enquiry.previousInsurer}` : ""}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[12px] text-muted">Declared NCB</dt>
              <dd className="mt-0.5 num">
                {enquiry.ncbPct}%{enquiry.claimedLastYear ? " · claimed last year" : ""}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[12px] text-muted">Enquiry</dt>
              <dd className="mt-0.5">
                <Link href={`/insurance-vendor/enquiries/${enquiry.id}`} className="font-mono text-[12.5px] underline-offset-4 hover:underline">
                  {enquiry.reference}
                </Link>
              </dd>
            </div>
          </dl>
          <div className="mt-5 grid grid-cols-1 gap-3 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              label="Brand"
              value={veh.brand}
              onChange={(e) => setVeh((v) => ({ ...v, brand: e.target.value, model: "", variant: "" }))}
              options={brands.map((b) => ({ value: b.slug, label: b.name }))}
              placeholder="Choose brand"
              error={errors["vehicle.brand"]}
            />
            <Select
              label="Model"
              value={veh.model}
              disabled={!veh.brand}
              onChange={(e) => setVeh((v) => ({ ...v, model: e.target.value, variant: "" }))}
              options={models.map((m) => ({ value: m.slug, label: m.name }))}
              placeholder="Choose model"
              error={errors["vehicle.model"] ?? (!resolved.ok && resolved.field === "model" && veh.brand ? resolved.error : undefined)}
            />
            <Select
              label="Variant"
              value={veh.variant}
              disabled={!veh.model}
              onChange={(e) => setVeh((v) => ({ ...v, variant: e.target.value }))}
              options={variants.map((v) => ({ value: v.slug, label: `${v.name} · ${v.fuel}` }))}
              placeholder="Choose variant"
              error={errors["vehicle.variant"] ?? (!resolved.ok && resolved.field === "variant" && veh.model ? resolved.error : undefined)}
            />
            <div>
              <Select
                label="Manufacturing year"
                value={veh.isNew ? "new" : veh.year ? String(veh.year) : ""}
                onChange={(e) => setVeh((v) => (e.target.value === "new" ? { ...v, isNew: true, year: null } : { ...v, isNew: false, year: Number(e.target.value) || null }))}
                options={[{ value: "new", label: "New car (not registered)" }, ...Array.from({ length: config.maxVehicleAgeYears + 1 }, (_, i) => ({ value: String(thisYear - i), label: String(thisYear - i) }))]}
                placeholder="Choose year"
                error={errors["vehicle.year"]}
              />
            </div>
          </div>
          {vehicle ? (
            <p className="mt-3 text-[12.5px] text-muted">
              Ex-showroom <span className="font-medium text-ink num">{rupees(vehicle.exShowroom)}</span> · {vehicle.fuel || "Fuel unknown"}
              {vehicle.engineCc ? ` · ${vehicle.engineCc} cc` : vehicle.motorKw ? ` · ${vehicle.motorKw} kW` : ""}
              {vehicle.bodyType ? ` · ${vehicle.bodyType}` : ""}
              {vehicle.isLuxury ? " · Luxury" : ""}
            </p>
          ) : (
            <p className="mt-3 flex items-center gap-2 text-[12.5px] text-[#9a5b00]">
              <CircleAlert aria-hidden className="size-4" /> {resolved.ok ? "" : resolved.error}
            </p>
          )}
        </Step>

        {/* 2 · Product */}
        <Step n={2} title="Select an insurance product" hint="Your approved and published products. Eligibility is checked against this car.">
          {products.length === 0 ? (
            <div className="border border-dashed border-line px-5 py-8 text-center">
              <p className="text-[14px] font-semibold">No quotable products yet</p>
              <p className="mx-auto mt-1 max-w-md text-[13px] text-muted">A product can be quoted once MarchGear approves it. Submit one from Insurance products.</p>
              <Button href="/insurance-vendor/products" variant="outline" size="sm" className="mt-4">
                Go to products
              </Button>
            </div>
          ) : (
            <div role="radiogroup" aria-label="Product" className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              {products.map((p) => {
                const problems = eligibleOf(p);
                const on = form.productId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={problems.length > 0}
                    onClick={() => pickProduct(p.id)}
                    className={cn(
                      "relative flex min-w-0 flex-col items-start rounded-[3px] border px-4 py-3.5 text-left transition-[border-color,background-color] duration-300",
                      on ? "border-ink bg-white ring-1 ring-ink" : "border-line bg-white hover:border-ink/40",
                      problems.length > 0 && "cursor-not-allowed bg-mist/60 opacity-70 hover:border-line",
                    )}
                  >
                    {on && (
                      <span className="absolute right-3 top-3 inline-flex size-5 items-center justify-center rounded-full bg-ink text-white">
                        <Check aria-hidden className="size-3" />
                      </span>
                    )}
                    <span className="pr-7 text-[14px] font-semibold leading-snug">{p.name}</span>
                    <span className="mt-0.5 text-[12px] text-muted">
                      {INS_PRODUCT_CATEGORY_LABEL[p.category]} · {p.companyName}
                    </span>
                    <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]">
                      <span className={cn("font-medium", p.status === "published" ? "text-[#1e7a3c]" : "text-muted")}>{INS_PRODUCT_STATUS_LABEL[p.status]}</span>
                      <span className="font-mono text-muted">{p.code}</span>
                      <span className="text-muted">
                        OD {p.pricing.odYears} yr · TP {p.pricing.tpYears} yr
                      </span>
                    </span>
                    {problems.length > 0 && <span className="mt-2 text-[12px] font-medium text-red">{problems[0]}</span>}
                  </button>
                );
              })}
            </div>
          )}
          {err("productId") && <p className="mt-2 text-[12px] text-red">{err("productId")}</p>}
          {product && product.unapprovedCovers > 0 && (
            <p className="mt-3 text-[12px] text-muted">
              {product.unapprovedCovers} cover{product.unapprovedCovers === 1 ? "" : "s"} on this product {product.unapprovedCovers === 1 ? "isn't" : "aren't"} approved yet and can&apos;t be quoted.
            </p>
          )}
        </Step>

        {/* 3 · Coverage */}
        <Step
          n={3}
          title="Configure coverage"
          hint="What the customer reads under “What's covered”. Prefilled from the product and its approved coverage items."
        >
          {product ? (
            <>
              <ol className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                {form.coverage.map((l, i) => (
                  <li key={i} className="border border-line p-3">
                    <div className="flex items-start gap-2">
                      <Input aria-label={`Cover ${i + 1} name`} placeholder="Cover name" value={l.name} maxLength={80} onChange={(e) => setLine(i, { name: e.target.value })} error={errors[`coverage.${i}.name`]} className="flex-1" />
                      <button
                        type="button"
                        onClick={() => removeLine(i)}
                        aria-label={`Remove ${l.name || `cover ${i + 1}`}`}
                        className="inline-flex size-10 shrink-0 items-center justify-center rounded-[3px] text-muted transition-colors hover:bg-mist hover:text-red"
                      >
                        <Trash2 aria-hidden className="size-4" />
                      </button>
                    </div>
                    <textarea
                      aria-label={`Cover ${i + 1} detail`}
                      placeholder="What it covers"
                      value={l.detail}
                      maxLength={300}
                      rows={2}
                      onChange={(e) => setLine(i, { detail: e.target.value })}
                      className="mt-2 block w-full resize-y rounded-[3px] border border-line bg-white px-3 py-2 text-[13px] leading-relaxed text-ink outline-none transition-[border-color] duration-300 placeholder:text-muted/70 hover:border-ink/30 focus:border-ink"
                    />
                    {errors[`coverage.${i}.detail`] && <p className="mt-1.5 text-[12px] text-red">{errors[`coverage.${i}.detail`]}</p>}
                  </li>
                ))}
              </ol>
              {form.coverage.length === 0 && <p className="text-[13px] text-muted">No coverage lines — add at least one.</p>}
              {errors.coverage && <p className="mt-2 text-[12px] text-red">{errors.coverage}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={addLine} disabled={form.coverage.length >= MAX_COVER_LINES} icon={<Plus className="size-4" aria-hidden />}>
                  Add a line
                </Button>
                <Button variant="ghost" size="sm" onClick={() => set("coverage", defaultCoverLines(product, form.includePa))} icon={<RotateCcw className="size-4" aria-hidden />}>
                  Reset to product defaults
                </Button>
              </div>
            </>
          ) : (
            <p className="text-[13px] text-muted">Choose a product first.</p>
          )}
        </Step>

        {/* 4 · Add-ons */}
        <Step n={4} title="Select add-ons" hint="The product's approved add-on covers. Bundled ones are always included.">
          {!product ? (
            <p className="text-[13px] text-muted">Choose a product first.</p>
          ) : product.addOns.length === 0 ? (
            <p className="text-[13px] text-muted">This product has no approved add-on covers.</p>
          ) : (
            <ul className="divide-y divide-line border border-line">
              {product.addOns.map((a) => {
                const why = vehicle ? addOnProblem(a, vehicle, today) : null;
                const on = a.included || form.addOnIds.includes(a.coverId);
                const line = b?.addOns.find((x) => x.coverId === a.coverId);
                const wanted = enquiry.addOns.includes(a.key);
                return (
                  <li key={a.coverId}>
                    <label className={cn("flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-mist/50", (a.included || why) && "cursor-default hover:bg-transparent")}>
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 accent-[#111111]"
                        checked={on && !why}
                        disabled={a.included || Boolean(why) || (b?.odYears ?? 1) === 0}
                        onChange={(e) => set("addOnIds", e.target.checked ? [...form.addOnIds, a.coverId] : form.addOnIds.filter((x) => x !== a.coverId))}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium">
                          {a.name}
                          {a.included && <span className="rounded-full bg-mist px-2 py-0.5 text-[11px] font-semibold text-ink/70">Included</span>}
                          {wanted && <span className="rounded-full bg-[#e9f0fb] px-2 py-0.5 text-[11px] font-semibold text-[#2456a6]">Customer asked</span>}
                        </span>
                        <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">{why ?? a.description}</span>
                      </span>
                      <span className="shrink-0 text-right text-[13px] font-medium num">{why ? "—" : line ? (line.premium ? rupees(line.premium) : "Included") : on ? "—" : <span className="text-muted">Not added</span>}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          {err("addOnIds") && <p className="mt-2 text-[12px] text-red">{err("addOnIds")}</p>}
        </Step>

        {/* 5 · IDV & pricing */}
        <Step n={5} title="IDV, NCB, deductible and your adjustment" hint="The IDV can move within the product's band. Your adjustment is a ₹ discount or loading on own damage.">
          {!product || !b ? (
            <p className="text-[13px] text-muted">Choose the car and a product first.</p>
          ) : (
            <div className="space-y-6">
              {idvBand ? (
                <div>
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <p className="text-[12px] font-medium text-ink/80">Insured declared value (IDV)</p>
                    <p className="font-display text-[22px] font-semibold leading-none tracking-[-0.02em] num">{rupees(b.idv)}</p>
                  </div>
                  <input
                    type="range"
                    aria-label="IDV"
                    min={idvBand.min}
                    max={idvBand.max}
                    step={step}
                    value={b.idv}
                    onChange={(e) => set("idv", Number(e.target.value))}
                    className="mt-3 w-full accent-[#E31E24]"
                  />
                  <div className="mt-1 flex justify-between text-[11.5px] text-muted num">
                    <span>{rupees(idvBand.min)}</span>
                    <button type="button" onClick={() => set("idv", null)} className="font-medium text-ink/70 hover:text-ink">
                      Reset to standard
                    </button>
                    <span>{rupees(idvBand.max)}</span>
                  </div>
                  <Input
                    label="Or type an IDV (₹)"
                    inputMode="numeric"
                    className="mt-3 sm:max-w-[240px]"
                    value={form.idv === null ? "" : String(form.idv)}
                    placeholder={String(b.idv)}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^\d]/g, "");
                      set("idv", v ? Number(v) : null);
                    }}
                    error={err("idv")}
                  />
                </div>
              ) : (
                <p className="text-[13px] text-muted">Third-party-only cover has no IDV, NCB or own-damage adjustment.</p>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Select
                  label="No-claim bonus"
                  value={String(form.ncbPct)}
                  disabled={!idvBand || veh.isNew}
                  onChange={(e) => set("ncbPct", Number(e.target.value))}
                  options={NCB_OPTIONS.map((n) => ({ value: String(n), label: `${n}%` }))}
                  hint={veh.isNew ? "New cars have no NCB." : `Customer declared ${enquiry.ncbPct}%${enquiry.claimedLastYear ? " but claimed last year" : ""}${enquiry.policyStatus === "expired_long" ? " — policy lapsed over 90 days" : ""}.`}
                  error={err("ncbPct")}
                />
                <Select
                  label="Voluntary deductible"
                  value={String(form.voluntaryDeductible)}
                  onChange={(e) => set("voluntaryDeductible", Number(e.target.value))}
                  options={[{ value: "0", label: "None" }, ...product.deductibles.voluntary.filter((v) => v > 0).map((v) => ({ value: String(v), label: rupees(v) }))]}
                  hint={`Compulsory deductible ${rupees(product.deductibles.compulsory || 0)} per claim · total ${rupees(b.deductible)}.`}
                  error={err("voluntaryDeductible")}
                />
              </div>

              {product.coverage.thirdParty && product.coverage.paOwnerDriver === "optional" && (
                <label className="flex cursor-pointer items-start gap-3 border border-line px-4 py-3">
                  <input type="checkbox" className="mt-0.5 size-4 accent-[#111111]" checked={form.includePa} onChange={(e) => set("includePa", e.target.checked)} />
                  <span>
                    <span className="block text-[13.5px] font-medium">Include personal accident cover for the owner-driver</span>
                    <span className="block text-[12px] text-muted">Leave it out only if the customer already holds a standalone PA policy.</span>
                  </span>
                </label>
              )}

              {idvBand && (
                <div>
                  <p className="mb-1.5 text-[12px] font-medium text-ink/80">Your adjustment on own damage</p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                    <div role="radiogroup" aria-label="Adjustment type" className="inline-flex h-10 w-fit shrink-0 rounded-[3px] border border-line p-0.5">
                      {(["discount", "loading"] as const).map((k) => (
                        <button
                          key={k}
                          type="button"
                          role="radio"
                          aria-checked={adjKind === k}
                          onClick={() => applyAdjustment(k, adjAmount)}
                          className={cn("rounded-[2px] px-3.5 text-[13px] font-medium capitalize transition-colors", adjKind === k ? "bg-ink text-white" : "text-muted hover:text-ink")}
                        >
                          {k}
                        </button>
                      ))}
                    </div>
                    <Input aria-label="Adjustment amount (₹)" inputMode="numeric" placeholder="₹ 0" className="sm:max-w-[200px]" value={adjAmount} onChange={(e) => applyAdjustment(adjKind, e.target.value.replace(/[^\d]/g, ""))} error={err("adjustment")} />
                  </div>
                  <p className="mt-1.5 text-[12px] text-muted">Applied after NCB. A discount can&apos;t exceed the own-damage premium; a loading is capped at 100% of it.</p>
                </div>
              )}
            </div>
          )}
        </Step>

        {/* 6 · Breakdown */}
        <Step n={6} title="Premium breakdown" hint="Recalculated by MarchGear when you save — the stored figures always come from the server.">
          {b ? (
            <>
              <dl className="divide-y divide-line border-y border-line text-[13.5px]">
                {breakdownLines(b).map((l) => (
                  <div key={l.label} className={cn("flex items-baseline justify-between gap-4 py-2.5", l.kind === "total" && "text-[16px] font-semibold", l.kind === "subtotal" && "font-medium")}>
                    <dt className="min-w-0">{l.label}</dt>
                    <dd className={cn("shrink-0 num", l.kind === "minus" && "text-[#1e7a3c]")}>{l.kind === "included" ? "Included" : l.amount < 0 ? `− ${rupees(-l.amount)}` : rupees(l.amount)}</dd>
                  </div>
                ))}
              </dl>
              {b.notes.length > 0 && (
                <ul className="mt-3 space-y-1 text-[12px] text-muted">
                  {b.notes.map((n) => (
                    <li key={n}>· {n}</li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[12px] leading-relaxed text-muted">{INDICATIVE_NOTE}</p>
            </>
          ) : (
            <p className="text-[13px] text-muted">The breakdown appears once the car and product are set.</p>
          )}
        </Step>

        {/* 7 · Validity */}
        <Step n={7} title="Quote validity" hint={`Default ${validityDays} days from today. After this date the customer's link shows the quote as expired.`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Input label="Valid until" type="date" min={today} max={addDays(today, 60)} value={form.validUntil} onChange={(e) => set("validUntil", e.target.value)} error={errors.validUntil} className="sm:w-[220px]" />
            <div className="flex flex-wrap gap-1.5">
              {[7, 15, 30].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => set("validUntil", addDays(today, d))}
                  className={cn("h-10 rounded-[3px] border px-3 text-[12.5px] font-medium transition-colors", form.validUntil === addDays(today, d) ? "border-ink bg-ink text-white" : "border-line hover:border-ink/40")}
                >
                  {d} days
                </button>
              ))}
            </div>
          </div>
        </Step>

        {/* 8 · Authorisation */}
        <Step n={8} title="Authorisation" hint="Say honestly what this is. The label appears on screen, on the customer's quote page and on the PDF.">
          <div role="radiogroup" aria-label="Authorisation" className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {(Object.keys(AUTH_EXPLAINER) as InsQuoteAuthorization[]).map((k) => {
              const on = form.authorization === k;
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => set("authorization", k)}
                  className={cn("relative rounded-[3px] border px-4 py-3.5 text-left transition-[border-color] duration-300", on ? "border-ink ring-1 ring-ink" : "border-line hover:border-ink/40")}
                >
                  <span className="flex items-center gap-2 text-[14px] font-semibold">
                    {k === "indicative" ? <TriangleAlert aria-hidden className="size-4 text-[#d68a00]" /> : <BadgeCheck aria-hidden className="size-4 text-[#1e7a3c]" />}
                    {AUTH_EXPLAINER[k].title}
                    {k === "indicative" && <span className="text-[11px] font-medium text-muted">Default</span>}
                  </span>
                  <span className="mt-1.5 block text-[12.5px] leading-relaxed text-muted">{AUTH_EXPLAINER[k].body}</span>
                  {on && (
                    <span className="absolute right-3 top-3 inline-flex size-5 items-center justify-center rounded-full bg-ink text-white">
                      <Check aria-hidden className="size-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {form.authorization === "insurer_authorised" && (
            <div className="mt-4 space-y-3 border-l-2 border-[#1e7a3c] pl-4">
              <Input label="Insurer's quotation reference" placeholder="As printed on the insurer's quotation" value={form.insurerQuoteRef} maxLength={80} onChange={(e) => set("insurerQuoteRef", e.target.value)} error={errors.insurerQuoteRef} className="sm:max-w-[360px]" />
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" className="mt-0.5 size-4 accent-[#111111]" checked={form.declaration} onChange={(e) => set("declaration", e.target.checked)} aria-invalid={errors.declaration ? true : undefined} />
                <span className="text-[13px] leading-relaxed">{AUTH_DECLARATION}</span>
              </label>
              {errors.declaration && <p className="text-[12px] text-red">{errors.declaration}</p>}
            </div>
          )}
        </Step>

        {/* 9 · Notes & terms */}
        <Step n={9} title="Notes and terms" hint="Shown to the customer on the quote page and the PDF.">
          <div className="space-y-3">
            <Textarea label="Notes to the customer" placeholder="e.g. Includes a free inspection at our partner garage. Call us to finalise." value={form.notes} maxLength={2000} onChange={(e) => set("notes", e.target.value)} error={errors.notes} />
            <Textarea label="Terms" placeholder="Conditions that apply to this quotation" value={form.terms} maxLength={4000} onChange={(e) => set("terms", e.target.value)} error={errors.terms} />
          </div>
        </Step>
      </div>

      {/* 10 · Live preview + actions */}
      <aside id="quote-preview" className="min-w-0 scroll-mt-24 xl:sticky xl:top-6 xl:self-start">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[13px] font-semibold">
            <span className="inline-flex size-6 items-center justify-center rounded-full bg-ink text-[11.5px] font-semibold text-white num">10</span>
            <Eye aria-hidden className="size-4 text-muted" /> Live preview
          </p>
          {b && <p className="text-[12px] text-muted">What the customer will see</p>}
        </div>
        <div className="xl:max-h-[calc(100vh-220px)] xl:overflow-y-auto xl:overscroll-contain">
          <QuotePreview data={previewData} />
        </div>
        {/* Phones and tablets: pinned to the bottom of the screen; desktop: under the preview. */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white p-3 shadow-lift lg:left-[264px] xl:static xl:mt-3 xl:border xl:shadow-none">
          <div className="mb-2.5 flex items-baseline justify-between gap-3">
            <span className="text-[12.5px] text-muted">{form.authorization === "insurer_authorised" ? "Insurer-authorised total" : "Indicative total"}</span>
            <span className="font-display text-[22px] font-semibold leading-none tracking-[-0.02em] num">{b ? rupees(b.total) : "—"}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" disabled={busy !== null || !product} onClick={() => save(false)} icon={busy === "save" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}>
              Save draft
            </Button>
            <Button variant="primary" size="sm" disabled={busy !== null || !ready || !authOk} onClick={() => setConfirm(true)} icon={busy === "submit" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}>
              Submit
            </Button>
          </div>
          {!ready && product && <p className="mt-2 text-[11.5px] text-muted">{productBlocked[0] ?? Object.values(clientProblems)[0] ?? (form.coverage.length ? "Finish the car details to price this quote." : "Add at least one coverage line.")}</p>}
          {ready && !authOk && <p className="mt-2 text-[11.5px] text-muted">Enter the insurer&apos;s reference and tick the declaration to submit an insurer-authorised quotation.</p>}
          {errors.form && <p className="mt-2 text-[12px] text-red">{errors.form}</p>}
        </div>
      </aside>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Send this quote to the customer?" size="sm">
        <div className="space-y-4 px-6 py-6 sm:px-8">
          <p className="text-[13.5px] leading-relaxed text-ink/80">
            {enquiry.name} gets a private link to an <strong className="font-semibold">{form.authorization === "insurer_authorised" ? "insurer-authorised quotation" : "indicative estimate"}</strong> of{" "}
            <strong className="font-semibold num">{b ? rupees(b.total) : "—"}</strong>, valid until {formatDayShort(form.validUntil)}. The enquiry moves to “Quote submitted”.
          </p>
          <p className="text-[12.5px] text-muted">MarchGear doesn&apos;t send email or SMS — after sending, copy the link or share it on WhatsApp from the quote page. Sent quotes can&apos;t be edited; revise them instead.</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={() => save(true)} data-autofocus icon={<Send className="size-4" aria-hidden />}>
              Send quote
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
