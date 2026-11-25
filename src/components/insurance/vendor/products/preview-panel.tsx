"use client";

import { useId, useMemo, useState } from "react";
import { AlertTriangle, Calculator, Info } from "lucide-react";
import { estimatePremium, eligibilityProblems, parseEngineCc, vehicleAgeMonths, ageYears, effectiveNcb, type PricingConfig } from "@/insurance/estimator";
import { INDICATIVE_NOTE } from "@/insurance/labels";
import { NCB_OPTIONS } from "@/insurance/search";
import type { FuelName, ProductEligibility } from "@/insurance/types";
import { cn } from "@/lib/utils";
import { useCatalog } from "@/components/providers/catalog-provider";
import { SelectBox } from "./controls";
import { formPricing, toNum, type CoverOption, type ProductFormValue } from "./shared";

/* ──────────────────────────────────────────────────────────────
   The product form's live "Indicative preview": pick a sample car
   from the catalogue and see what the site would estimate for this
   product — always labelled indicative, never a quote.
   ────────────────────────────────────────────────────────────── */

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const istToday = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);

export function IndicativePreview({ v, covers, config, className, bare }: { v: ProductFormValue; covers: CoverOption[]; config: PricingConfig; className?: string; bare?: boolean }) {
  const cat = useCatalog();
  const titleId = useId();
  const today = istToday();
  const thisYear = Number(today.slice(0, 4));
  const start = useMemo(() => {
    const pick = cat.cars.find((c) => c.variants.length && c.priceMin >= 800_000 && c.priceMin <= 1_500_000 && !c.ev) ?? cat.cars.find((c) => c.variants.length);
    return pick ? { brand: pick.brand, model: pick.slug, variant: pick.variants[0].slug } : { brand: "", model: "", variant: "" };
  }, [cat.cars]);
  const [brand, setBrand] = useState(start.brand);
  const [model, setModel] = useState(start.model);
  const [variant, setVariant] = useState(start.variant);
  const [year, setYear] = useState(String(thisYear - 2));
  const [ncb, setNcb] = useState(20);
  const [optional, setOptional] = useState<number[]>([]);

  const car = model ? cat.getCar(model) : undefined;
  const vr = car?.variants.find((x) => x.slug === variant) ?? car?.variants[0];
  const isNew = year === "new";
  const yr = isNew ? thisYear : Number(year);
  const ageM = vehicleAgeMonths(yr, isNew, today);
  const fuel = (vr?.fuel ?? "") as FuelName | "";

  const result = useMemo(() => {
    if (!car || !vr) return null;
    const e = v.eligibility;
    const eligibility: ProductEligibility = {
      bodyTypes: e.bodyTypes,
      luxury: e.luxury,
      brands: e.brands,
      models: e.models,
      fuels: e.fuels,
      minAgeYears: toNum(e.minAgeYears) ?? 0,
      maxAgeYears: toNum(e.maxAgeYears) ?? config.maxVehicleAgeYears,
      states: [],
      cities: [],
    };
    const brandInfo = cat.getBrand(car.brand);
    const problems = eligibilityProblems(eligibility, {
      brand: car.brand,
      model: car.slug,
      bodyType: car.bodyType,
      isLuxury: Boolean(car.isLuxury || brandInfo?.isLuxury),
      fuel,
      ageYears: ageYears(ageM),
      state: "",
      city: "",
    });
    const tooOld = ageYears(ageM) > config.maxVehicleAgeYears;
    const addOnRows = v.addOns
      .map((a) => ({ a, c: covers.find((x) => x.id === a.coverId) }))
      .filter((x): x is { a: (typeof v.addOns)[number]; c: CoverOption } => Boolean(x.c))
      .map(({ a, c }) => {
        const why = c.maxVehicleAgeYears !== null && ageYears(ageM) > c.maxVehicleAgeYears ? `Cars up to ${c.maxVehicleAgeYears} yrs` : c.fuels.length && fuel && !c.fuels.includes(fuel) ? `${c.fuels.join("/")} only` : null;
        return { a, c, why };
      });
    const estimate = estimatePremium({
      exShowroom: vr.price,
      ageMonths: ageM,
      isNew,
      fuel,
      engineCc: parseEngineCc(car.engine),
      motorKw: car.ev?.motorKw ?? null,
      ncbPct: effectiveNcb(ncb, { isNew, claimed: false, lapsedLong: false }, config),
      pricing: formPricing(v, config),
      paOwnerDriver: v.coverage.thirdParty ? v.coverage.paOwnerDriver : "none",
      includePa: true,
      addOns: addOnRows
        .filter((r) => !r.why)
        .map(({ a, c }) => ({ coverId: c.id, key: c.key, name: c.name, pricing: c.pricing, included: a.included, selected: optional.includes(c.id) })),
      config,
    });
    return { estimate, problems, tooOld, addOnRows };
  }, [car, vr, v, covers, config, ageM, isNew, fuel, ncb, optional, cat]);

  const brands = [...cat.brands].sort((a, b) => a.name.localeCompare(b.name));
  const years = Array.from({ length: Math.min(config.maxVehicleAgeYears, 15) + 1 }, (_, i) => thisYear - i);
  const noCover = !v.coverage.ownDamage && !v.coverage.thirdParty;
  const est = result?.estimate;

  return (
    <section className={cn("relative border border-line bg-white", className)} aria-labelledby={titleId}>
      <header className={cn("flex items-center gap-2.5 border-b border-line px-5 py-3.5", bare && "sr-only")}>
        <Calculator aria-hidden className="size-4 text-red" />
        <h2 id={titleId} className="text-[14px] font-semibold">
          Indicative preview
        </h2>
        <span className="ml-auto rounded-full bg-[#fdf3e1] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#9a5b00]">Indicative</span>
      </header>
      <div className={cn("space-y-3", bare ? "p-1" : "p-5")}>
        {bare && <span className="inline-flex rounded-full bg-[#fdf3e1] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#9a5b00]">Indicative</span>}
        <p className="text-[12.5px] text-muted">A sample car from the catalogue, priced with this product&rsquo;s settings.</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <SelectBox
              value={brand}
              onChange={(b) => {
                setBrand(b);
                const first = cat.carsByBrand(b).find((c) => c.variants.length);
                setModel(first?.slug ?? "");
                setVariant(first?.variants[0]?.slug ?? "");
              }}
              options={brands.map((b) => ({ value: b.slug, label: b.name }))}
              id={`${titleId}-pv-brand`} ariaLabel="Sample brand"
            />
          </div>
          <div className="col-span-2">
            <SelectBox
              id={`${titleId}-pv-model`} ariaLabel="Sample model"
              value={model}
              onChange={(m) => {
                setModel(m);
                setVariant(cat.getCar(m)?.variants[0]?.slug ?? "");
              }}
              options={cat.carsByBrand(brand).filter((c) => c.variants.length).map((c) => ({ value: c.slug, label: c.name }))}
            />
          </div>
          <div className="col-span-2">
            <SelectBox id={`${titleId}-pv-variant`} ariaLabel="Sample variant" value={vr?.slug ?? ""} onChange={setVariant} options={(car?.variants ?? []).map((x) => ({ value: x.slug, label: `${x.name} · ${x.fuel}` }))} />
          </div>
          <SelectBox id={`${titleId}-pv-year`} ariaLabel="Year of manufacture" value={year} onChange={setYear} options={[{ value: "new", label: "New car" }, ...years.map((y) => ({ value: String(y), label: `Made ${y}` }))]} />
          <SelectBox id={`${titleId}-pv-ncb`} ariaLabel="No-claim bonus" value={String(isNew ? 0 : ncb)} onChange={(x) => setNcb(Number(x))} disabled={isNew || !v.coverage.ownDamage} options={NCB_OPTIONS.map((n) => ({ value: String(n), label: `${n}% NCB` }))} />
        </div>

        {noCover ? (
          <p className="border border-dashed border-line px-3 py-6 text-center text-[13px] text-muted">Turn on own-damage or third-party cover to see an estimate.</p>
        ) : !est || !vr ? (
          <p className="border border-dashed border-line px-3 py-6 text-center text-[13px] text-muted">Choose a car to see an estimate.</p>
        ) : (
          <>
            {(result.problems.length > 0 || result.tooOld) && (
              <div className="flex gap-2 rounded-[3px] bg-[#fdf3e1] px-3 py-2.5 text-[12.5px] text-[#6b4300]" role="note">
                <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                <div>
                  <p className="font-medium">Customers with this car wouldn&rsquo;t see the product</p>
                  <p className="mt-0.5">{[...result.problems, ...(result.tooOld ? [`MarchGear estimates for cars up to ${config.maxVehicleAgeYears} years old`] : [])].join(" · ")}</p>
                </div>
              </div>
            )}
            <div className="border-y border-line py-4">
              <p className="text-[12px] font-medium text-muted">Indicative premium · {est.odYears ? `${est.odYears}-yr OD` : "no OD"}{est.tpYears ? ` + ${est.tpYears}-yr TP` : ""}</p>
              <p className="mt-1 font-display text-[30px] font-semibold leading-none tracking-[-0.03em] num">{inr(est.total)}</p>
              <p className="mt-1 text-[12px] text-muted num">incl. {est.gstPct}% GST · ex-showroom {inr(vr.price)}</p>
            </div>
            <dl className="space-y-1.5 text-[12.5px]">
              {est.odYears > 0 && (
                <>
                  <Row k="IDV" v={`${inr(est.idv)}`} note={`${inr(est.idvMin)} – ${inr(est.idvMax)}`} />
                  <Row k="Own damage" v={inr(est.od)} />
                  {est.ncbDiscount > 0 && <Row k={`NCB (${est.ncbPct}%)`} v={`− ${inr(est.ncbDiscount)}`} />}
                </>
              )}
              {est.tpYears > 0 && <Row k="Third party" v={inr(est.tp)} />}
              {est.pa > 0 && <Row k="Owner-driver PA" v={inr(est.pa)} />}
              {est.addOns.map((a) => (
                <Row key={a.key + a.coverId} k={a.name} v={a.premium ? inr(a.premium) : "Included"} note={a.included ? "bundled" : "optional"} />
              ))}
              <Row k="GST" v={inr(est.gst)} />
            </dl>
            {result.addOnRows.some((r) => !r.a.included) && (
              <div className="border-t border-line pt-3">
                <p className="mb-1.5 text-[12px] font-medium text-muted">Optional add-ons in the sample</p>
                <ul className="space-y-1">
                  {result.addOnRows
                    .filter((r) => !r.a.included)
                    .map(({ c, why }) => (
                      <li key={c.id}>
                        <label className={cn("flex items-center gap-2 text-[12.5px]", why && "opacity-50")}>
                          <input type="checkbox" className="size-3.5 accent-[var(--color-ink)]" checked={optional.includes(c.id) && !why} disabled={Boolean(why)} onChange={(e) => setOptional((o) => (e.target.checked ? [...o, c.id] : o.filter((x) => x !== c.id)))} />
                          <span className="min-w-0 flex-1 truncate">{c.name}</span>
                          {why && <span className="text-[11px] text-muted">{why}</span>}
                        </label>
                      </li>
                    ))}
                </ul>
              </div>
            )}
            {est.notes.length > 0 && (
              <ul className="space-y-1 text-[11.5px] text-muted">
                {est.notes.map((n) => (
                  <li key={n} className="flex gap-1.5">
                    <Info aria-hidden className="mt-0.5 size-3 shrink-0" /> {n}
                  </li>
                ))}
              </ul>
            )}
            {covers.some((c) => v.addOns.some((a) => a.coverId === c.id) && c.status !== "approved") && <p className="text-[11.5px] text-[#9a5b00]">Includes covers that aren&rsquo;t approved yet — the website only shows approved ones.</p>}
          </>
        )}
        <p className="border-t border-line pt-3 text-[11px] leading-relaxed text-muted">{INDICATIVE_NOTE}</p>
      </div>
    </section>
  );
}

function Row({ k, v, note }: { k: string; v: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="min-w-0 truncate text-muted">
        {k}
        {note && <span className="ml-1 text-[11px] text-muted">· {note}</span>}
      </dt>
      <dd className="shrink-0 font-medium num">{v}</dd>
    </div>
  );
}
