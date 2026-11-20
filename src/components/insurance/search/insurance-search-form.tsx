"use client";

import { useId, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CarFront, Info, Loader2, RefreshCcw, ShieldPlus } from "lucide-react";
import type { InsIntent, InsPolicyStatus } from "@/db/enums";
import { INS_POLICY_STATUS_LABEL } from "@/insurance/labels";
import { EMPTY_SEARCH, FUELS, NCB_OPTIONS, isValidReg, normaliseReg, parseSearch, searchQuery } from "@/insurance/search";
import type { FuelName, InsuranceSearch } from "@/insurance/types";
import { INDIA_CITIES } from "@/data/india-cities";
import { INDIAN_STATES, isIndianState } from "@/data/states";
import { createPersistentStore, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { SelectField, TextField } from "@/components/ui/field";
import { useCity, useUser } from "@/components/providers/app-provider";
import { useCatalog } from "@/components/providers/catalog-provider";

/* ──────────────────────────────────────────────────────────────
   The customer's vehicle search. Used on /insurance (hero), the
   category pages (panel) and /insurance/quotes (compact, "edit
   vehicle"). Submits to /insurance/quotes?<searchQuery>&src=…
   and remembers the last search on this device.
   ────────────────────────────────────────────────────────────── */

export type InsuranceSearchVariant = "hero" | "panel" | "compact";

export interface InsuranceSearchFormProps {
  /** "new" | "renewal" — the tab selected first (unless `initial.intent` says otherwise). */
  defaultIntent?: InsIntent;
  /** Prefill, e.g. parsed from the current URL. When it names a car, the remembered search is ignored. */
  initial?: Partial<InsuranceSearch>;
  /** hero = homepage, panel = landing pages, compact = quotes page "edit vehicle". */
  variant?: InsuranceSearchVariant;
  /** Where the form was submitted from (kept in the URL as &src=). */
  source?: string;
  /** Passed through to the URL, e.g. { campaign: "12", ad: "4", provider: "acme" }. */
  extraParams?: Record<string, string>;
}

/** The last search on this device, stored as its (sanitised) query string. */
const lastSearchStore = createPersistentStore<string>("mg.insurance.search", "");

const OTHER_CITY = "__other";
const DAY = 86_400_000;

/** Local calendar date as YYYY-MM-DD. */
const localISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysSince = (iso: string) => Math.round((new Date(`${localISO()}T00:00:00`).getTime() - new Date(`${iso}T00:00:00`).getTime()) / DAY);

/** Policy status implied by an expiry date. */
function statusFromExpiry(iso: string): InsPolicyStatus | "" {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const since = daysSince(iso);
  if (since <= 0) return "active";
  return since <= 90 ? "expired_recent" : "expired_long";
}

/** "MH12AB1234" → "MH 12 AB 1234"; "22BH1234AA" → "22 BH 1234 AA"; anything else unchanged. */
function formatReg(v: string) {
  const n = normaliseReg(v);
  const std = n.match(/^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/);
  if (std) return [std[1], std[2], std[3], std[4]].filter(Boolean).join(" ");
  const bh = n.match(/^(\d{2})(BH)(\d{4})([A-Z]{1,2})$/);
  if (bh) return bh.slice(1).join(" ");
  return v.toUpperCase();
}

const hasVehicle = (s?: Partial<InsuranceSearch> | null) => Boolean(s && (s.brand || s.model || s.reg));
const PLACE = /^[\p{L}\p{M} .'()&-]{2,64}$/u;

export function InsuranceSearchForm({ defaultIntent, initial, variant = "panel", source, extraParams }: InsuranceSearchFormProps): React.JSX.Element {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { brands, cars, getCar } = useCatalog();
  const { user } = useUser();
  const { city: siteCity } = useCity();
  const saved = useStore(lastSearchStore);
  const thisYear = new Date().getFullYear();
  const idBase = `ins-${variant}-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  const userState = user?.state ?? "";
  const userCity = user?.city ?? "";
  const siteState = siteCity?.state ?? "";
  const siteCityName = siteCity?.name ?? "";

  /* ── Starting values: URL/initial › remembered search › profile/site city ── */
  const base = useMemo<InsuranceSearch>(() => {
    const remembered = !hasVehicle(initial) && saved ? parseSearch(new URLSearchParams(saved), thisYear) : null;
    const s: InsuranceSearch = { ...EMPTY_SEARCH, ...(remembered ?? {}) };
    for (const [k, v] of Object.entries(initial ?? {})) if (v !== undefined && v !== "" && v !== null) (s as unknown as Record<string, unknown>)[k] = v;
    s.intent = initial?.intent ?? defaultIntent ?? remembered?.intent ?? "new";
    // Only cars that are in the catalogue.
    const car = s.model ? getCar(s.model) : undefined;
    if (!car || (s.brand && car.brand !== s.brand)) {
      s.model = "";
      s.variant = "";
    } else {
      s.brand = car.brand;
      if (s.variant && !car.variants.some((x) => x.slug === s.variant)) s.variant = "";
      // Fuel must be one the car is sold with (the variant's, when one is chosen).
      const variantFuel = car.variants.find((x) => x.slug === s.variant)?.fuel as FuelName | undefined;
      if (!s.fuel || !car.fuelTypes.includes(s.fuel)) s.fuel = variantFuel ?? (car.fuelTypes.length === 1 ? (car.fuelTypes[0] as FuelName) : "");
    }
    if (s.brand && !brands.some((b) => b.slug === s.brand)) s.brand = "";
    if (s.intent === "renewal" && s.policy === "new_vehicle") s.policy = "";
    s.reg = s.policy === "new_vehicle" ? "" : formatReg(s.reg);
    if (!s.state && !s.city) {
      if (isIndianState(userState)) {
        s.state = userState;
        s.city = userCity;
      } else if (isIndianState(siteState)) {
        s.state = siteState;
        s.city = siteCityName;
      }
    }
    return s;
  }, [initial, saved, defaultIntent, thisYear, getCar, brands, userState, userCity, siteState, siteCityName]);

  const [draft, setDraft] = useState<InsuranceSearch | null>(null);
  const [cityOther, setCityOther] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // The hero splits the form in two short steps (car → location & policy); the other variants show everything.
  const stepped = variant === "hero";
  const [step, setStep] = useState<1 | 2>(1);
  const s = draft ?? base;

  const update = (patch: Partial<InsuranceSearch>, clear: string[] = []) => {
    setDraft({ ...s, ...patch });
    if (clear.length) setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !clear.includes(k))));
  };

  const renewal = s.intent === "renewal";
  const newCar = !renewal && s.policy === "new_vehicle";
  const car = s.model ? getCar(s.model) : undefined;

  /* ── Options ── */
  const brandOptions = useMemo(() => {
    const withCars = new Set(cars.map((c) => c.brand));
    return brands
      .filter((b) => withCars.has(b.slug))
      .map((b) => ({ value: b.slug, label: b.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [brands, cars]);
  const modelOptions = useMemo(
    () =>
      cars
        .filter((c) => c.brand === s.brand)
        .map((c) => ({ value: c.slug, label: c.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [cars, s.brand],
  );
  const variantOptions = (car?.variants ?? []).map((v) => ({ value: v.slug, label: `${v.name} · ${v.fuel} · ${v.transmission}` }));
  const fuelOptions = (car ? FUELS.filter((f) => car.fuelTypes.includes(f)) : FUELS).map((f) => ({ value: f, label: f }));
  const years = newCar ? [thisYear, thisYear - 1] : Array.from({ length: 26 }, (_, i) => thisYear - i);
  const cityList = isIndianState(s.state) ? [...INDIA_CITIES[s.state]] : [];
  const otherCity = cityOther || (Boolean(s.city) && !cityList.includes(s.city));
  const policyOptions = (["active", "expired_recent", "expired_long", "not_sure"] as const).map((p) => ({ value: p, label: INS_POLICY_STATUS_LABEL[p] }));

  /* ── Changes ── */
  const setIntent = (intent: InsIntent) => {
    if (intent === s.intent) return;
    const patch: Partial<InsuranceSearch> = { intent };
    if (intent === "renewal" && s.policy === "new_vehicle") patch.policy = s.expiry ? statusFromExpiry(s.expiry) : "";
    if (intent === "renewal" && s.year && s.year >= thisYear && !s.reg) patch.year = null;
    update(patch, ["expiry", "policy", "reg", "year"]);
  };
  const setNewCar = (on: boolean) =>
    on
      ? update({ policy: "new_vehicle", reg: "", year: s.year && s.year >= thisYear - 1 ? s.year : thisYear, expiry: "", ncb: 0, claimed: false }, ["reg", "year", "expiry", "policy"])
      : update({ policy: "" }, ["year"]);
  const setBrand = (brand: string) => update({ brand, model: "", variant: "", fuel: "" }, ["brand", "model"]);
  const setModel = (model: string) => {
    const c = getCar(model);
    update({ model, variant: "", fuel: c && c.fuelTypes.length === 1 ? (c.fuelTypes[0] as FuelName) : "" }, ["model"]);
  };
  const setVariant = (variant: string) => {
    const v = car?.variants.find((x) => x.slug === variant);
    update({ variant, fuel: v ? (v.fuel as FuelName) : s.fuel }, ["variant", "fuel"]);
  };
  const setExpiry = (expiry: string) => {
    const implied = statusFromExpiry(expiry);
    update({ expiry, policy: implied && s.policy !== "not_sure" ? implied : s.policy }, ["expiry", "policy"]);
  };

  /* ── Submit ── */
  const CAR_FIELDS = ["reg", "brand", "model", "year"];
  const validate = () => {
    const e: Record<string, string> = {};
    const reg = normaliseReg(s.reg);
    if (!newCar && reg && !isValidReg(reg)) e.reg = "Check the registration number — e.g. MH 12 AB 1234 or 22 BH 1234 AA";
    if (!s.brand) e.brand = "Choose the brand";
    if (!s.model) e.model = s.brand ? "Choose the model" : "Choose a brand first";
    if (!s.year) e.year = "Choose the year";
    else if (newCar && s.year < thisYear - 1) e.year = "A new car should be from this year or last";
    if (s.city && !PLACE.test(s.city)) e.city = "Enter a valid city name";
    if (renewal) {
      if (!s.expiry) e.expiry = "Enter your policy's expiry date";
      else {
        const since = daysSince(s.expiry);
        if (since < -366) e.expiry = "That's more than a year away — check the date";
        else if (s.policy === "active" && since > 0) e.expiry = "This date has passed — if the policy has expired, choose an “Expired” status";
        else if ((s.policy === "expired_recent" || s.policy === "expired_long") && since <= 0) e.expiry = "This date hasn't passed yet — choose “Policy active”";
        else if (s.policy === "expired_recent" && since > 90) e.expiry = "That's more than 90 days ago — choose “Expired over 90 days ago”";
        else if (s.policy === "expired_long" && since <= 90) e.expiry = "That's within 90 days — choose “Expired within 90 days”";
      }
    }
    return e;
  };

  const focusLater = (id: string) => window.requestAnimationFrame(() => document.getElementById(id)?.focus());

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (pending) return;
    const all = validate();
    // Step 1 of the hero only checks the car.
    const e = stepped && step === 1 ? Object.fromEntries(Object.entries(all).filter(([k]) => CAR_FIELDS.includes(k))) : all;
    setErrors(e);
    if (Object.keys(e).length) {
      const first = [...CAR_FIELDS, "city", "expiry"].find((k) => e[k]);
      if (stepped && first && CAR_FIELDS.includes(first)) setStep(1);
      if (first) focusLater(`${idBase}-${first}`);
      return;
    }
    if (stepped && step === 1) {
      setStep(2);
      focusLater(`${idBase}-state`);
      return;
    }
    const clean: InsuranceSearch = {
      ...s,
      reg: newCar ? "" : normaliseReg(s.reg),
      policy: renewal && !s.policy ? statusFromExpiry(s.expiry) : s.policy,
      expiry: newCar ? "" : s.expiry,
      ncb: renewal && s.policy !== "expired_long" ? s.ncb : 0,
      claimed: renewal ? s.claimed : false,
      city: s.city.trim(),
    };
    const query = searchQuery(clean);
    lastSearchStore.set(query); // never throws: the store guards localStorage
    const extra = new URLSearchParams();
    if (source) extra.set("src", source);
    for (const [k, v] of Object.entries(extraParams ?? {})) if (v && !extra.has(k)) extra.set(k, v);
    const tail = extra.toString();
    startTransition(() => router.push(`/insurance/quotes?${query}${tail ? `&${tail}` : ""}`));
  };

  const hero = variant === "hero";
  const compact = variant === "compact";
  const grid = cn("grid grid-cols-2 gap-x-3 gap-y-4", variant === "panel" ? "sm:gap-x-4 lg:grid-cols-4" : "sm:gap-x-4");
  const wideOnMobile = cn("col-span-2", variant === "panel" ? "lg:col-span-1" : "sm:col-span-1");
  const showCar = !stepped || step === 1;
  const showRest = !stepped || step === 2;
  const brandName = brands.find((b) => b.slug === s.brand)?.name ?? "";
  const variantName = car?.variants.find((v) => v.slug === s.variant)?.name;

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label={renewal ? "Renew existing insurance" : "Buy new insurance"}
      className={cn("relative bg-white text-ink", hero && "shadow-lift", variant === "panel" && "border border-line", compact && "border border-line")}
    >
      {/* Intent */}
      {compact ? (
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <p className="text-[13px] font-semibold">Your car</p>
          <IntentSwitch value={s.intent} onChange={setIntent} />
        </div>
      ) : (
        <IntentTabs value={s.intent} onChange={setIntent} />
      )}

      <div className={cn(compact ? "space-y-5 p-4 sm:p-5" : "space-y-6 p-5 sm:p-6", hero && "lg:p-7", variant === "panel" && "md:p-8")}>
        {/* 01 · The car */}
        {showCar && (
          <fieldset className="min-w-0">
            {!compact && (
              <GroupTitle n="01" aside={stepped ? "Step 1 of 2" : undefined}>
                Your car
              </GroupTitle>
            )}
            <div className={grid}>
              <div className={cn("col-span-2", variant === "panel" && "lg:col-span-2")}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <label htmlFor={`${idBase}-reg`} className="text-[12.5px] font-medium text-ink">
                    Registration number <span className="font-normal text-muted">(optional)</span>
                  </label>
                  {!renewal && (
                    <Toggle id={`${idBase}-newcar`} checked={newCar} onChange={setNewCar}>
                      New car / no registration number yet
                    </Toggle>
                  )}
                </div>
                <input
                  id={`${idBase}-reg`}
                  value={newCar ? "" : s.reg}
                  disabled={newCar}
                  onChange={(e) => update({ reg: e.target.value.toUpperCase().slice(0, 16) }, ["reg"])}
                  onBlur={() => s.reg && update({ reg: formatReg(s.reg) })}
                  placeholder={newCar ? "Not registered yet" : "MH 12 AB 1234"}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  aria-invalid={errors.reg ? true : undefined}
                  aria-describedby={`${idBase}-reg-msg`}
                  className={cn(
                    "h-12 w-full rounded-[3px] border border-line bg-white px-4 font-mono text-[15px] uppercase tracking-[0.08em] text-ink outline-none transition-[border-color] duration-[250ms] placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-muted/70 hover:border-ink/30 focus:border-ink aria-[invalid=true]:border-red disabled:cursor-not-allowed disabled:bg-mist disabled:hover:border-line",
                  )}
                />
                <p id={`${idBase}-reg-msg`} className={cn("mt-1.5 flex items-start gap-1.5 text-xs", errors.reg ? "text-red" : "text-muted")}>
                  {errors.reg ?? (
                    <>
                      <Info aria-hidden className="mt-px size-3.5 shrink-0" />
                      <span>We can&apos;t fetch your car&apos;s details from the number — no vehicle registry is connected — so please choose the car below.</span>
                    </>
                  )}
                </p>
              </div>

              <SelectField
                id={`${idBase}-brand`}
                className={wideOnMobile}
                label="Brand"
                placeholder="Choose brand"
                options={brandOptions}
                value={s.brand}
                onChange={(e) => setBrand(e.target.value)}
                error={errors.brand}
              />
              <SelectField
                id={`${idBase}-model`}
                className={wideOnMobile}
                label="Model"
                placeholder={s.brand ? "Choose model" : "Choose a brand first"}
                disabled={!s.brand}
                options={modelOptions}
                value={s.model}
                onChange={(e) => setModel(e.target.value)}
                error={errors.model}
              />
              <SelectField
                id={`${idBase}-variant`}
                className={cn("col-span-2", variant === "panel" && "lg:col-span-2")}
                label="Variant"
                placeholder={car ? "Not sure / any variant" : "Choose a model first"}
                disabled={!car}
                options={variantOptions}
                value={s.variant}
                onChange={(e) => setVariant(e.target.value)}
              />
              <SelectField
                id={`${idBase}-year`}
                label="Manufacturing year"
                placeholder="Year"
                options={years.map((y) => ({ value: String(y), label: String(y) }))}
                value={s.year ? String(s.year) : ""}
                onChange={(e) => update({ year: e.target.value ? Number(e.target.value) : null }, ["year"])}
                error={errors.year}
              />
              <SelectField
                id={`${idBase}-fuel`}
                label="Fuel"
                placeholder={car ? "Choose fuel" : "Fuel"}
                options={fuelOptions}
                value={s.fuel}
                onChange={(e) => update({ fuel: e.target.value as FuelName | "" }, ["fuel"])}
              />
            </div>
          </fieldset>
        )}

        {/* 02 · Where, and the current policy */}
        {showRest && (
          <fieldset className="min-w-0">
            {!compact && (
              <GroupTitle n="02" aside={stepped ? "Step 2 of 2" : undefined}>
                {newCar ? "Where it will be registered" : "Location & current policy"}
              </GroupTitle>
            )}
            {stepped && car && (
              <div className="mb-5 flex items-center justify-between gap-4 bg-mist px-4 py-3">
                <p className="min-w-0 truncate text-[13.5px]">
                  <span className="font-semibold">
                    {s.year} {brandName} {car.name}
                  </span>
                  <span className="text-muted">
                    {variantName ? ` · ${variantName}` : ""}
                    {s.fuel ? ` · ${s.fuel}` : ""}
                    {newCar ? " · New" : s.reg ? ` · ${formatReg(s.reg)}` : ""}
                  </span>
                </p>
                <button type="button" onClick={() => setStep(1)} className="shrink-0 text-[13px] font-medium underline underline-offset-4 hover:text-red">
                  Edit
                </button>
              </div>
            )}
            <div className={grid}>
              <SelectField
                id={`${idBase}-state`}
                label="State"
                placeholder="State"
                options={INDIAN_STATES.map((x) => ({ value: x, label: x }))}
                value={s.state}
                onChange={(e) => {
                  const next = e.target.value;
                  const keep = isIndianState(next) && INDIA_CITIES[next].includes(s.city);
                  setCityOther(false);
                  update({ state: next, city: keep ? s.city : "" }, ["city"]);
                }}
                autoComplete="address-level1"
              />
              <div className="min-w-0">
                <SelectField
                  id={`${idBase}-city`}
                  label="City"
                  placeholder={s.state ? "City" : "Choose state"}
                  disabled={!s.state}
                  options={[...cityList.map((c) => ({ value: c, label: c })), ...(s.state ? [{ value: OTHER_CITY, label: "Other city or town…" }] : [])]}
                  value={otherCity ? OTHER_CITY : s.city}
                  onChange={(e) => {
                    if (e.target.value === OTHER_CITY) {
                      setCityOther(true);
                      update({ city: "" }, ["city"]);
                    } else {
                      setCityOther(false);
                      update({ city: e.target.value }, ["city"]);
                    }
                  }}
                  error={otherCity ? undefined : errors.city}
                  autoComplete="address-level2"
                />
                {otherCity && (
                  <TextField
                    id={`${idBase}-city-other`}
                    aria-label="Your city or town"
                    className="mt-2"
                    value={s.city}
                    onChange={(e) => update({ city: e.target.value }, ["city"])}
                    placeholder="Type your city"
                    error={errors.city}
                    maxLength={64}
                  />
                )}
              </div>

              {!newCar && (
                <SelectField
                  id={`${idBase}-policy`}
                  className={wideOnMobile}
                  label={renewal ? "Current policy" : "Existing insurance"}
                  placeholder={renewal ? "Choose status" : "None / not sure"}
                  options={policyOptions}
                  value={s.policy}
                  onChange={(e) => update({ policy: e.target.value as InsPolicyStatus | "" }, ["policy", "expiry"])}
                  error={errors.policy}
                />
              )}
              {!newCar && (
                <TextField
                  id={`${idBase}-expiry`}
                  className={cn(renewal ? "col-span-1" : wideOnMobile)}
                  label={renewal ? "Policy expiry date" : "Expiry date (if any)"}
                  type="date"
                  value={s.expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  error={errors.expiry}
                />
              )}
              {renewal && (
                <SelectField
                  id={`${idBase}-ncb`}
                  label="Current NCB"
                  options={NCB_OPTIONS.map((n) => ({ value: String(n), label: n === 0 ? "0% — none" : `${n}%` }))}
                  value={String(s.ncb)}
                  disabled={s.policy === "expired_long"}
                  onChange={(e) => update({ ncb: Number(e.target.value) })}
                />
              )}
              {renewal && (
                <div className={cn("col-span-2 flex flex-col justify-end", variant === "panel" && "lg:col-span-1")}>
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-[3px] border border-line px-3.5 py-3 text-[13px] leading-snug transition-colors hover:border-ink/30">
                    <input
                      type="checkbox"
                      checked={s.claimed}
                      onChange={(e) => update({ claimed: e.target.checked })}
                      className="mt-0.5 size-4 shrink-0 accent-[var(--color-red)]"
                    />
                    <span>I made a claim in the last policy year</span>
                  </label>
                </div>
              )}
            </div>
            {renewal && (s.claimed || s.policy === "expired_long") && (
              <p className="mt-3 flex items-start gap-1.5 text-xs text-muted">
                <Info aria-hidden className="mt-px size-3.5 shrink-0" />
                {s.policy === "expired_long"
                  ? "Policies that lapsed more than 90 days ago usually lose their no-claim bonus, and the insurer will want to inspect the car."
                  : "A claim usually resets the no-claim bonus to 0% at renewal, unless your policy had NCB protection."}
              </p>
            )}
          </fieldset>
        )}

        {/* Submit */}
        <div className={cn("flex flex-col gap-3", variant === "panel" && "md:flex-row md:items-center md:justify-between md:gap-6")}>
          <p className={cn("text-[12px] leading-relaxed text-muted", variant === "panel" ? "md:order-1 md:max-w-md" : "order-2")}>
            Premiums shown next are <strong className="font-semibold text-ink">indicative</strong>. Your details reach an insurer only when you ask it for a quote.
          </p>
          <button
            type="submit"
            disabled={pending}
            className={cn(
              "group/btn inline-flex h-13 items-center justify-center gap-2 rounded-[3px] bg-red px-7 text-[15px] font-medium text-white transition-[background-color,transform] duration-[250ms] hover:bg-red-600 active:translate-y-px disabled:opacity-70",
              variant === "panel" ? "w-full md:order-2 md:w-auto md:shrink-0" : "order-1 w-full",
              compact && "h-12",
            )}
          >
            {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            {pending ? "Finding plans…" : stepped && step === 1 ? "Continue" : compact ? "Update plans" : renewal ? "Compare renewal premiums" : "See plans & premiums"}
            {!pending && <ArrowRight aria-hidden className="size-4 transition-transform duration-[250ms] group-hover/btn:translate-x-0.5" />}
          </button>
        </div>
      </div>
    </form>
  );
}

/* ── Pieces ─────────────────────────────────────────────────── */

const INTENTS: { value: InsIntent; label: string; hint: string; Icon: typeof CarFront }[] = [
  { value: "new", label: "Buy new insurance", hint: "New car, or no current policy", Icon: ShieldPlus },
  { value: "renewal", label: "Renew existing insurance", hint: "Keep your no-claim bonus", Icon: RefreshCcw },
];

function IntentTabs({ value, onChange }: { value: InsIntent; onChange: (v: InsIntent) => void }) {
  return (
    <div role="radiogroup" aria-label="What do you need?" className="grid grid-cols-2 border-b border-line">
      {INTENTS.map(({ value: v, label, hint, Icon }) => {
        const on = v === value;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(v)}
            className={cn(
              "group/tab relative flex min-w-0 items-start gap-3 px-4 py-4 text-left transition-colors duration-[250ms] sm:px-6 sm:py-5",
              on ? "bg-white" : "bg-mist text-muted hover:bg-[#efefef] hover:text-ink",
              v === "renewal" && "border-l border-line",
            )}
          >
            <span aria-hidden className={cn("absolute inset-x-0 top-0 h-[3px] transition-colors duration-[250ms]", on ? "bg-red" : "bg-transparent")} />
            <Icon aria-hidden className={cn("mt-0.5 hidden size-5 shrink-0 sm:block", on ? "text-red" : "text-muted")} />
            <span className="min-w-0">
              <span className={cn("block text-[14px] font-semibold leading-tight sm:text-[15px]", on && "text-ink")}>{label}</span>
              <span className="mt-1 block text-[12px] leading-snug text-muted">{hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function IntentSwitch({ value, onChange }: { value: InsIntent; onChange: (v: InsIntent) => void }) {
  return (
    <div role="radiogroup" aria-label="What do you need?" className="inline-flex rounded-[3px] bg-mist p-1">
      {INTENTS.map(({ value: v }) => {
        const on = v === value;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(v)}
            className={cn("h-8 rounded-[2px] px-3 text-[12.5px] font-medium transition-colors duration-[250ms]", on ? "bg-white text-ink shadow-soft" : "text-muted hover:text-ink")}
          >
            {v === "new" ? "New policy" : "Renewal"}
          </button>
        );
      })}
    </div>
  );
}

function GroupTitle({ n, children, aside }: { n: string; children: ReactNode; aside?: string }) {
  return (
    <legend className="mb-4 flex w-full items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
      <span className="text-red num">{n}</span>
      <span>{children}</span>
      <span aria-hidden className="h-px flex-1 bg-line" />
      {aside && <span className="font-medium normal-case tracking-normal text-muted/80">{aside}</span>}
    </legend>
  );
}

function Toggle({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label htmlFor={id} className="inline-flex cursor-pointer select-none items-center gap-2 text-[12.5px] font-medium text-ink">
      <input id={id} type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className="relative inline-flex h-5 w-9 shrink-0 rounded-full bg-line transition-colors duration-[250ms] peer-checked:bg-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-red after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:duration-[250ms] peer-checked:after:translate-x-4"
      />
      {children}
    </label>
  );
}
