"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Check, Loader2, RotateCcw, Wrench } from "lucide-react";
import type { FuelType } from "@/types";
import type { Catalog } from "@/lib/catalog";
import { formatKm, formatPrice, formatPriceRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { submitLeadAction } from "@/server/actions/leads";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { DemoNote } from "@/components/ui/badge";
import { Label, RangeField, Segmented, SelectField, TextField } from "@/components/ui/field";
import { Honeypot } from "@/components/forms/honeypot";
import { CONSENT_REQUIRED, ConsentCheckbox, RequestConsentText } from "@/components/forms/consent";
import { focusFirstInvalid } from "@/components/forms/form-a11y";
import { useUI } from "@/components/providers/app-provider";
import { useCatalog } from "@/components/providers/catalog-provider";
import {
  FUELS,
  VALUATION_YEAR,
  YEARS,
  modelsForBrand,
  valuate,
  valuationBrands,
  valuationTitle,
  type GearboxKind,
} from "./valuation";
import type { CarPrefill } from "./prefill";

const STEPS = [
  { key: "brand", label: "Brand", title: "Which brand is your car?" },
  { key: "model", label: "Model", title: "And the model?" },
  { key: "year", label: "Year", title: "When was it first registered?" },
  { key: "fuel", label: "Fuel & gearbox", title: "Fuel and gearbox" },
  { key: "km", label: "Kilometres", title: "How far has it been driven?" },
  { key: "city", label: "City", title: "Where is the car right now?" },
  { key: "contact", label: "Contact", title: "How can we reach you about selling it?" },
] as const;

const RESULT = STEPS.length;

const POPULAR_BRANDS = [
  "maruti-suzuki",
  "hyundai",
  "tata",
  "mahindra",
  "toyota",
  "honda",
  "kia",
  "skoda",
  "mg",
  "volkswagen",
  "bmw",
  "mercedes-benz",
];
const KM_PRESETS = [10_000, 30_000, 50_000, 80_000, 120_000];

interface Draft {
  brand: string;
  modelSlug: string;
  modelName: string;
  year: number | null;
  fuel: FuelType | null;
  transmission: GearboxKind | null;
  km: number;
  city: string;
  name: string;
  phone: string;
  consent: boolean;
}

const EMPTY: Draft = {
  brand: "",
  modelSlug: "",
  modelName: "",
  year: null,
  fuel: null,
  transmission: null,
  km: 40_000,
  city: "",
  name: "",
  phone: "",
  consent: false,
};

const digits = (s: string) => s.replace(/\D/g, "");

const NETWORK_ERROR = "Couldn't send — check your connection and try again.";

/** Server field paths → the step that collects them. */
const STEP_FOR: Record<string, number> = {
  "details.brand": 0,
  "details.model": 1,
  carSlug: 1,
  subject: 1,
  "details.year": 2,
  "details.fuel": 3,
  "details.transmission": 3,
  "details.km": 4,
  city: 5,
  name: 6,
  phone: 6,
  consent: 6,
};

type ContactErrors = Partial<Record<"name" | "phone" | "consent", string>>;

/** The contact step's field errors (the other steps have one choice each, so one message). */
function contactErrors(d: Draft): ContactErrors {
  const out: ContactErrors = {};
  if (d.name.trim().length < 2) out.name = "Enter your name";
  if (!/^[6-9]\d{9}$/.test(digits(d.phone))) out.phone = "Enter a valid 10-digit mobile number";
  if (!d.consent) out.consent = CONSENT_REQUIRED;
  return out;
}

/** The instant valuation shown on the result screen. */
const valuationFor = (d: Draft, catalog: Catalog) =>
  valuate(
    {
      brand: d.brand,
      modelSlug: d.modelSlug || undefined,
      year: d.year ?? VALUATION_YEAR,
      km: d.km,
      fuel: d.fuel ?? "Petrol",
      transmission: d.transmission ?? "Manual",
      owners: 1,
      condition: "good",
      city: d.city,
    },
    catalog,
  );

function validate(step: number, d: Draft): string | undefined {
  switch (STEPS[step]?.key) {
    case "brand":
      return d.brand ? undefined : "Choose a brand to continue";
    case "model":
      return d.modelSlug || d.modelName.trim().length >= 2 ? undefined : "Pick a model or type its name";
    case "year":
      return d.year ? undefined : "Choose the registration year";
    case "fuel":
      return d.fuel && d.transmission ? undefined : "Choose both fuel and gearbox";
    case "city":
      return d.city ? undefined : "Choose a city";
    case "contact": {
      const errs = Object.values(contactErrors(d));
      return errs.length ? (errs.length === 1 ? "One field needs your attention." : `${errs.length} fields need your attention.`) : undefined;
    }
    default:
      return undefined;
  }
}

/** Answers from a prefill that the flow offers, and the first step still needing one. */
function seedDraft(p: CarPrefill | undefined, catalog: Catalog, brandOptions: { value: string }[]): { draft: Draft; step: number } {
  if (!p) return { draft: EMPTY, step: 0 };
  const next: Partial<Draft> = {};
  if (p.brand && brandOptions.some((o) => o.value === p.brand)) {
    next.brand = p.brand;
    const models = modelsForBrand(p.brand, catalog);
    if (p.model && models.some((m) => m.slug === p.model)) next.modelSlug = p.model;
    else if (p.modelName) next.modelName = p.modelName;
  }
  if (p.year && YEARS.includes(p.year)) next.year = p.year;
  if (p.fuel && FUELS.includes(p.fuel)) next.fuel = p.fuel;
  if (p.transmission) next.transmission = p.transmission;
  if (p.km !== undefined) next.km = Math.min(200_000, Math.round(p.km / 1_000) * 1_000);
  if (p.city && catalog.cities.some((c) => c.name === p.city)) next.city = p.city;
  if (!Object.keys(next).length) return { draft: EMPTY, step: 0 };
  const draft = { ...EMPTY, ...next };
  // Kilometres always has a value, so it's never the step we jump to.
  const open = STEPS.findIndex((st, i) => st.key !== "km" && validate(i, draft) !== undefined);
  return { draft, step: open === -1 ? STEPS.length - 1 : open };
}

/**
 * Seven-step instant valuation for /sell-car. Tile choices auto-advance;
 * Continue validates; completed steps can be revisited from the summary.
 */
/** `prefill` (e.g. from a car in the customer's garage) seeds the answers; the flow starts at the first step still open. */
export function SellFlow({ className, prefill }: { className?: string; prefill?: CarPrefill }) {
  const { openEnquiry, toast } = useUI();
  const pathname = usePathname();
  const catalog = useCatalog();
  const { brandName } = catalog;
  const popularCities = useMemo(() => catalog.cities.filter((c) => c.popular).map((c) => c.name), [catalog.cities]);
  const otherCities = useMemo(() => catalog.cities.filter((c) => !c.popular).map((c) => ({ value: c.name, label: c.name })), [catalog.cities]);
  const brandOptions = useMemo(() => valuationBrands(catalog), [catalog]);
  const seed = useMemo(() => seedDraft(prefill, catalog, brandOptions), [prefill, catalog, brandOptions]);
  const [step, setStep] = useState(seed.step);
  const [dir, setDir] = useState(1);
  const [draft, setDraft] = useState<Draft>(seed.draft);
  const [error, setError] = useState<string | undefined>();
  const [fieldErrors, setFieldErrors] = useState<ContactErrors>({});
  const [sending, setSending] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [website, setWebsite] = useState("");
  const interacted = useRef(false);
  const advanceTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const timer = advanceTimer;
    return () => window.clearTimeout(timer.current);
  }, []);

  const go = (target: number) => {
    window.clearTimeout(advanceTimer.current);
    interacted.current = true;
    setDir(target > step ? 1 : -1);
    setError(undefined);
    setFieldErrors({});
    setStep(target);
  };

  const update = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setError(undefined);
    setFieldErrors((prev) => {
      const keys = Object.keys(patch).filter((k) => k in prev);
      return keys.length ? Object.fromEntries(Object.entries(prev).filter(([k]) => !keys.includes(k))) : prev;
    });
  };

  /** Select a tile and move on after a beat, so the choice registers visually. */
  const pick = (patch: Partial<Draft>) => {
    update(patch);
    window.clearTimeout(advanceTimer.current);
    const target = step + 1;
    advanceTimer.current = window.setTimeout(() => go(target), 240);
  };

  /** Stores the valuation request. Resolves true only when the server accepted it. */
  const sendLead = async () => {
    const brand = brandName(draft.brand);
    const model = catalog.getCar(draft.modelSlug)?.name ?? draft.modelName.trim();
    const year = draft.year ?? VALUATION_YEAR;
    const r = valuationFor(draft, catalog);
    setSending(true);
    try {
      const res = await submitLeadAction({
        type: "sell_car",
        name: draft.name.trim(),
        phone: digits(draft.phone),
        city: draft.city,
        subject: `${brand} ${model} ${year}`,
        carSlug: draft.modelSlug || undefined,
        source: pathname,
        consent: true,
        website,
        details: {
          brand,
          model,
          year,
          fuel: draft.fuel ?? "",
          transmission: draft.transmission ?? "",
          km: draft.km,
          estimate: formatPriceRange(r.byCondition.fair.mid, r.byCondition.excellent.mid),
        },
      });
      setSending(false);
      if (res.ok) return true;
      // Take the visitor to the earliest step the server objected to.
      const problems = Object.entries(res.fieldErrors ?? {});
      const placed = problems.filter(([key]) => key in STEP_FOR).sort(([a], [b]) => STEP_FOR[a] - STEP_FOR[b]);
      if (placed.length) {
        const [key, msg] = placed[0];
        if (STEP_FOR[key] !== step) go(STEP_FOR[key]);
        if (key === "name" || key === "phone" || key === "consent") {
          setFieldErrors({ [key]: msg });
          focusFirstInvalid(formRef.current);
        }
        setError(msg);
      }
      const note = problems.find(([key]) => !(key in STEP_FOR))?.[1] ?? res.error;
      if (note) toast(note, { tone: "error" });
      return false;
    } catch {
      setSending(false);
      toast(NETWORK_ERROR, { tone: "error" });
      return false;
    }
  };

  const next = async (e?: FormEvent) => {
    e?.preventDefault();
    if (sending) return;
    const problem = validate(step, draft);
    if (problem) {
      setError(problem);
      if (STEPS[step].key === "contact") {
        setFieldErrors(contactErrors(draft));
        focusFirstInvalid(formRef.current);
      }
      return;
    }
    if (step === RESULT - 1) {
      if (!(await sendLead())) return;
      toast(`Thanks, ${draft.name.trim().split(" ")[0]}. Your price is ready — our team will call you to confirm it.`, { tone: "success" });
      go(RESULT);
      return;
    }
    go(step + 1);
  };

  const restart = () => {
    setDraft(EMPTY);
    go(0);
  };

  const models = draft.brand ? modelsForBrand(draft.brand, catalog) : [];
  const title = draft.brand
    ? valuationTitle({ brand: draft.brand, modelSlug: draft.modelSlug || undefined, year: draft.year ?? VALUATION_YEAR }, catalog, draft.modelName)
    : "";

  const summary: { step: number; label: string }[] = [
    draft.brand && { step: 0, label: brandName(draft.brand) },
    (draft.modelSlug || draft.modelName) && {
      step: 1,
      label: models.find((m) => m.slug === draft.modelSlug)?.name ?? draft.modelName,
    },
    draft.year && { step: 2, label: String(draft.year) },
    draft.fuel && draft.transmission && { step: 3, label: `${draft.fuel} · ${draft.transmission}` },
    step > 4 && { step: 4, label: formatKm(draft.km) },
    draft.city && step > 5 && { step: 5, label: draft.city },
  ].filter((x): x is { step: number; label: string } => Boolean(x) && (x as { step: number }).step < step);

  // Stable callback ref: runs only when a new step's heading mounts, never on re-render
  // (otherwise typing in a field would bounce focus back to the heading).
  const headingRef = useCallback((el: HTMLHeadingElement | null) => {
    if (el && interacted.current) el.focus({ preventScroll: true });
  }, []);

  return (
    <div className={cn("flex min-h-[600px] flex-col border border-line bg-white text-ink", className)}>
      {/* Progress */}
      <div className="border-b border-line px-6 pb-5 pt-6 md:px-8">
        <div className="flex items-center justify-between gap-4">
          <h2 className="type-eyebrow text-ink">
            {step < RESULT ? (
              <>
                Step <span className="num">{step + 1}</span> of <span className="num">{STEPS.length}</span>
                <span className="text-muted"> · {STEPS[step].label}</span>
              </>
            ) : (
              "Your instant price"
            )}
          </h2>
          {step > 0 && step < RESULT && (
            <button
              type="button"
              onClick={() => go(step - 1)}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors duration-[250ms] hover:text-ink"
            >
              <ArrowLeft className="size-3.5" aria-hidden /> Back
            </button>
          )}
        </div>
        <div
          className="mt-4 grid grid-cols-7 gap-1"
          role="progressbar"
          aria-label="Valuation progress"
          aria-valuemin={0}
          aria-valuemax={STEPS.length}
          aria-valuenow={Math.min(step, STEPS.length)}
        >
          {STEPS.map((s, i) => (
            <span
              key={s.key}
              className={cn(
                "h-[3px] transition-colors duration-[400ms]",
                i < step ? "bg-ink" : i === step ? "bg-red" : "bg-line",
              )}
            />
          ))}
        </div>
        {summary.length > 0 && step < RESULT && (
          <ul className="no-scrollbar -mx-6 mt-4 flex gap-1.5 overflow-x-auto px-6 md:-mx-8 md:px-8" aria-label="Your answers">
            {summary.map((s) => (
              <li key={s.step} className="shrink-0">
                <button
                  type="button"
                  onClick={() => go(s.step)}
                  className="inline-flex h-7 items-center gap-1 rounded-full bg-mist px-3 text-[12px] font-medium text-ink transition-colors duration-[250ms] hover:bg-line"
                  aria-label={`Change ${STEPS[s.step].label.toLowerCase()}: ${s.label}`}
                >
                  <Check className="size-3 text-red" aria-hidden />
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Step body */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.form
            key={step}
            custom={dir}
            variants={{
              enter: (d: number) => ({ opacity: 0, x: d * 28 }),
              center: { opacity: 1, x: 0 },
              exit: (d: number) => ({ opacity: 0, x: d * -28 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: EASE }}
            onSubmit={next}
            ref={formRef}
            noValidate
            className="flex flex-1 flex-col px-6 pb-6 pt-7 md:px-8 md:pb-8"
          >
            {step < RESULT ? (
              <>
                <h3 ref={headingRef} tabIndex={-1} className="type-h3 outline-none">
                  {STEPS[step].title}
                </h3>
                <div className="mt-6 flex-1">
                  {STEPS[step].key === "brand" && (
                    <div>
                      <TileGrid className="grid-cols-2 sm:grid-cols-3">
                        {POPULAR_BRANDS.map((b) => (
                          <Tile key={b} selected={draft.brand === b} onClick={() => pick({ brand: b, modelSlug: "", modelName: "" })}>
                            {brandName(b)}
                          </Tile>
                        ))}
                      </TileGrid>
                      <SelectField
                        className="mt-4"
                        aria-label="Other brands"
                        placeholder="More brands…"
                        value={POPULAR_BRANDS.includes(draft.brand) ? "" : draft.brand}
                        onChange={(e) => e.target.value && pick({ brand: e.target.value, modelSlug: "", modelName: "" })}
                        options={brandOptions.filter((b) => !POPULAR_BRANDS.includes(b.value))}
                      />
                    </div>
                  )}

                  {STEPS[step].key === "model" && (
                    <div>
                      {models.length > 0 && (
                        <TileGrid className="grid-cols-2 sm:grid-cols-3">
                          {models.map((m) => (
                            <Tile key={m.slug} selected={draft.modelSlug === m.slug} onClick={() => pick({ modelSlug: m.slug, modelName: "" })}>
                              {m.name}
                            </Tile>
                          ))}
                        </TileGrid>
                      )}
                      <TextField
                        className={models.length > 0 ? "mt-5" : undefined}
                        label={models.length > 0 ? "Not listed? Type the model" : `Which ${brandName(draft.brand)} model?`}
                        placeholder="e.g. Polo GT TSI"
                        value={draft.modelName}
                        onChange={(e) => update({ modelName: e.target.value, modelSlug: "" })}
                      />
                    </div>
                  )}

                  {STEPS[step].key === "year" && (
                    <TileGrid className="grid-cols-4">
                      {YEARS.map((y) => (
                        <Tile key={y} selected={draft.year === y} onClick={() => pick({ year: y })} compact>
                          <span className="num">{y}</span>
                        </Tile>
                      ))}
                    </TileGrid>
                  )}

                  {STEPS[step].key === "fuel" && (
                    <div className="space-y-7">
                      <div>
                        <Label>Fuel</Label>
                        <div className="flex flex-wrap gap-2" role="group" aria-label="Fuel">
                          {FUELS.map((f) => (
                            <Chip key={f} selected={draft.fuel === f} onClick={() => update({ fuel: f })}>
                              {f}
                            </Chip>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label>Gearbox</Label>
                        <Segmented
                          ariaLabel="Gearbox"
                          className="w-full sm:w-80"
                          value={draft.transmission ?? ("" as GearboxKind)}
                          onChange={(t) => update({ transmission: t })}
                          options={[
                            { value: "Manual", label: "Manual" },
                            { value: "Automatic", label: "Automatic" },
                          ]}
                        />
                        <p className="mt-2 text-[12px] text-muted">AMT, CVT, DCT and torque-converter gearboxes all count as automatic.</p>
                      </div>
                    </div>
                  )}

                  {STEPS[step].key === "km" && (
                    <div>
                      <RangeField
                        label="Odometer reading"
                        value={draft.km}
                        min={0}
                        max={200_000}
                        step={1_000}
                        onChange={(km) => update({ km })}
                        format={formatKm}
                        minLabel="0 km"
                        maxLabel="2,00,000 km"
                      />
                      <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Quick picks">
                        {KM_PRESETS.map((k) => (
                          <Chip key={k} selected={draft.km === k} onClick={() => update({ km: k })} className="h-8 px-3.5 text-[12.5px]">
                            <span className="num">{formatKm(k)}</span>
                          </Chip>
                        ))}
                      </div>
                      {draft.year && (
                        <p className="mt-6 border-l-2 border-line pl-4 text-[13px] text-muted">
                          A typical {draft.year} car has covered about{" "}
                          <span className="text-ink num">{formatKm(Math.max(1, VALUATION_YEAR - draft.year) * 11_000)}</span>.
                        </p>
                      )}
                    </div>
                  )}

                  {STEPS[step].key === "city" && (
                    <div>
                      <TileGrid className="grid-cols-2 sm:grid-cols-4">
                        {popularCities.map((c) => (
                          <Tile key={c} selected={draft.city === c} onClick={() => pick({ city: c })} compact>
                            {c}
                          </Tile>
                        ))}
                      </TileGrid>
                      <SelectField
                        className="mt-4"
                        aria-label="Other cities"
                        placeholder="Another city…"
                        value={popularCities.includes(draft.city) ? "" : draft.city}
                        onChange={(e) => e.target.value && pick({ city: e.target.value })}
                        options={otherCities}
                      />
                    </div>
                  )}

                  {STEPS[step].key === "contact" && (
                    <div className="space-y-5">
                      <Honeypot value={website} onChange={setWebsite} />
                      <TextField
                        label="Your name"
                        autoComplete="name"
                        value={draft.name}
                        onChange={(e) => update({ name: e.target.value })}
                        error={fieldErrors.name}
                        placeholder="Full name"
                      />
                      <TextField
                        label="Mobile number"
                        prefix="+91"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        placeholder="98765 43210"
                        value={draft.phone}
                        onChange={(e) => update({ phone: e.target.value.replace(/[^\d ]/g, "").slice(0, 11) })}
                        error={fieldErrors.phone}
                      />
                      <ConsentCheckbox id="sell-consent" checked={draft.consent} onChange={(consent) => update({ consent })} error={fieldErrors.consent}>
                        <RequestConsentText party={{ kind: "dealers" }} about="selling this car (an inspection and offers for it)" />
                      </ConsentCheckbox>
                      <p className="text-[12px] leading-relaxed text-muted">We&apos;ll only use your number to talk about this sale. No spam, ever.</p>
                    </div>
                  )}
                </div>

                <div className="mt-8">
                  <p className="min-h-5 text-[12.5px] text-red" aria-live="assertive" aria-atomic="true">
                    {error}
                  </p>
                  <Button
                    type="submit"
                    size="lg"
                    className="mt-2 w-full"
                    arrow={!sending}
                    disabled={sending}
                    icon={sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}
                  >
                    {step === RESULT - 1 ? (sending ? "Sending…" : "See my price") : "Continue"}
                  </Button>
                </div>
              </>
            ) : (
              <ResultView
                title={title}
                draft={draft}
                onInspect={() =>
                  openEnquiry({ kind: "inspection", subject: title, detail: `${formatKm(draft.km)} · ${draft.city}`, city: draft.city, carSlug: draft.modelSlug || undefined })
                }
                onRestart={restart}
                headingRef={headingRef}
              />
            )}
          </motion.form>
        </AnimatePresence>
      </div>
    </div>
  );
}

function TileGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-2", className)}>{children}</div>;
}

function Tile({
  children,
  selected,
  onClick,
  compact,
}: {
  children: ReactNode;
  selected: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex min-w-0 items-center justify-between gap-2 rounded-[3px] border text-left text-[14px] font-medium transition-[background-color,border-color,color] duration-[250ms]",
        compact ? "h-11 justify-center px-2 text-center" : "h-14 px-4",
        selected ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink/40",
      )}
    >
      <span className="truncate">{children}</span>
      {selected && !compact && <Check className="size-4 shrink-0 text-red" aria-hidden />}
    </button>
  );
}

function ResultView({
  title,
  draft,
  onInspect,
  onRestart,
  headingRef,
}: {
  title: string;
  draft: Draft;
  onInspect: () => void;
  onRestart: () => void;
  headingRef: (el: HTMLHeadingElement | null) => void;
}) {
  const catalog = useCatalog();
  const { usedCars } = catalog;
  const r = valuationFor(draft, catalog);
  const low = r.byCondition.fair.mid;
  const high = r.byCondition.excellent.mid;
  const similar = usedCars.some((c) => c.brand === draft.brand) ? `/used-cars?brand=${draft.brand}` : "/used-cars";
  const age = r.factors.find((f) => f.label === "Age");
  const km = r.factors.find((f) => f.label === "Kilometres");

  return (
    <div className="flex flex-1 flex-col">
      <h3 ref={headingRef} tabIndex={-1} className="text-[15px] font-medium text-ink outline-none">
        {title}
      </h3>
      <p className="mt-1 text-[13px] text-muted num">
        {formatKm(draft.km)} · {draft.fuel} · {draft.transmission} · {draft.city}
      </p>

      <p className="mt-8 text-[12.5px] text-muted">Indicative price range</p>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
        className="mt-2 font-display text-[clamp(2.25rem,1.6rem+2.6vw,3.5rem)] font-semibold leading-none tracking-[-0.035em] [font-stretch:108%]"
      >
        {formatPriceRange(low, high)}
      </motion.p>
      <p className="mt-3 text-[13.5px] text-ink/80">
        Most likely <span className="font-semibold num">{formatPrice(r.byCondition.good.mid)}</span> in good condition
      </p>

      {/* Range bar: fair → excellent, with the good-condition midpoint */}
      <div className="mt-6" aria-hidden>
        <div className="relative h-[3px] bg-line">
          <div className="absolute inset-y-0 left-[8%] right-[8%] bg-ink" />
          <span
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red ring-2 ring-white"
            style={{ left: `${8 + ((r.byCondition.good.mid - low) / (high - low || 1)) * 84}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[11px] uppercase tracking-[0.12em] text-muted">
          <span>Fair</span>
          <span>Excellent</span>
        </div>
      </div>

      <dl className="mt-7 grid grid-cols-2 border-t border-line text-[13px]">
        {[age, km].filter(Boolean).map((f) => (
          <div key={f!.label} className="border-b border-line py-3 pr-3 odd:border-r even:pl-4">
            <dt className="text-muted">{f!.label}</dt>
            <dd className="mt-0.5 font-medium num">
              {f!.effect > 0 ? "+" : f!.effect < 0 ? "−" : "±"}
              {Math.abs(f!.effect)}% <span className="font-normal text-muted">· {f!.detail}</span>
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-auto grid grid-cols-1 gap-2.5 pt-8">
        <Button size="lg" onClick={onInspect} icon={<Wrench className="size-4" aria-hidden />}>
          Book free inspection
        </Button>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <Button href={similar} variant="outline">
            See similar listings
          </Button>
          <Button variant="ghost" onClick={onRestart} icon={<RotateCcw className="size-4" aria-hidden />}>
            Start over
          </Button>
        </div>
        <DemoNote className="mt-2 text-center">Indicative only — the final offer follows a free inspection.</DemoNote>
      </div>
    </div>
  );
}
