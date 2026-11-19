"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, CircleAlert } from "lucide-react";
import type { CarModel } from "@/types";
import { BUDGETS, cars, isElectric } from "@/data/cars";
import { brandName } from "@/data/brands";
import { LOAN_TO_VALUE, type Employment } from "@/data/tools-assumptions";
import { calculateEmi } from "@/lib/finance";
import { formatINR, formatPrice, formatPriceShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RangeField, Segmented } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Eyebrow, TextLink } from "@/components/ui/section-heading";
import { useUI } from "@/components/providers/app-provider";
import { loanEligibility, splitPrice } from "./calc";
import { EstimateNote, Readout, StepLabel } from "./instrument";

const TENURES = [1, 2, 3, 4, 5, 6, 7];
type BodyFilter = "all" | "SUV" | "Sedan" | "Hatchback" | "MUV" | "electric";
const FILTERS: { value: BodyFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "SUV", label: "SUV" },
  { value: "Sedan", label: "Sedan" },
  { value: "Hatchback", label: "Hatchback" },
  { value: "MUV", label: "MUV" },
  { value: "electric", label: "Electric" },
];
const matches = (car: CarModel, f: BodyFilter) => (f === "all" ? true : f === "electric" ? isElectric(car) : car.bodyType === f);

export function LoanEligibility() {
  const { openEnquiry } = useUI();
  const [employment, setEmployment] = useState<Employment>("salaried");
  const [income, setIncome] = useState(100_000);
  const [existing, setExisting] = useState(10_000);
  const [rate, setRate] = useState(9.25);
  const [years, setYears] = useState(5);
  const [filter, setFilter] = useState<BodyFilter>("all");
  const [expanded, setExpanded] = useState(false);

  const result = loanEligibility({ income, existingEmis: existing, employment, ratePct: rate, years });
  const [figure, unit] = splitPrice(result.eligible);

  const affordable = useMemo(
    () => cars.filter((c) => c.priceMin <= result.carBudget).sort((a, b) => b.priceMin - a.priceMin),
    [result.carBudget],
  );
  const shown = affordable.filter((c) => matches(c, filter));
  const visible = expanded ? shown : shown.slice(0, 6);
  const band = BUDGETS.find((b) => result.carBudget >= b.min && result.carBudget < b.max) ?? BUDGETS[0];

  const usage = result.cap > 0 ? existing / result.cap : 1;
  const health = result.overLimit ? "Over the limit" : usage < 0.3 ? "Strong" : usage < 0.6 ? "Moderate" : "Stretched";

  return (
    <>
      <section aria-label="Loan eligibility calculator" className="py-14 md:py-20">
        <div className="container-x">
          <div className="grid grid-cols-1 gap-px overflow-hidden border border-line bg-line lg:grid-cols-[1.1fr_1fr]">
            <div className="space-y-9 bg-white p-6 md:p-10">
              <div>
                <StepLabel index="01">Your income</StepLabel>
                <Segmented
                  ariaLabel="Employment type"
                  className="mt-5 flex w-full"
                  options={[
                    { value: "salaried", label: "Salaried" },
                    { value: "self-employed", label: "Self-employed" },
                  ]}
                  value={employment}
                  onChange={setEmployment}
                />
              </div>
              <RangeField
                label="Monthly net income (take-home)"
                value={income}
                min={15_000}
                max={500_000}
                step={5_000}
                onChange={setIncome}
                format={formatINR}
                minLabel="₹15K"
                maxLabel="₹5 L"
              />
              <RangeField
                label="Existing EMIs per month"
                value={existing}
                min={0}
                max={200_000}
                step={1_000}
                onChange={setExisting}
                format={formatINR}
                minLabel="None"
                maxLabel="₹2 L"
              />

              <div className="border-t border-line pt-9">
                <StepLabel index="02">Loan terms</StepLabel>
                <RangeField
                  className="mt-6"
                  label="Interest rate (p.a.)"
                  value={rate}
                  min={7}
                  max={16}
                  step={0.25}
                  onChange={setRate}
                  format={(v) => `${v.toFixed(2)}%`}
                  minLabel="7%"
                  maxLabel="16%"
                />
                <p className="mb-3 mt-8 text-[13px] text-muted">Loan tenure</p>
                <Segmented
                  ariaLabel="Loan tenure in years"
                  className="flex w-full [&>button]:px-0 sm:[&>button]:px-4"
                  options={TENURES.map((y) => ({ value: String(y), label: `${y}y` }))}
                  value={String(years)}
                  onChange={(v) => setYears(Number(v))}
                />
              </div>
            </div>

            <div className="flex flex-col bg-ink p-6 text-white md:p-10">
              <div className="flex items-start justify-between gap-4">
                <p className="type-eyebrow text-white/55">You could borrow up to</p>
                <span
                  className={cn(
                    "inline-flex h-6 shrink-0 items-center rounded-[2px] px-2 text-[10.5px] font-semibold uppercase tracking-[0.12em]",
                    result.overLimit ? "bg-red text-white" : "bg-white/10 text-white",
                  )}
                >
                  {health}
                </span>
              </div>
              <p aria-live="polite" className="num mt-4 flex flex-wrap items-baseline gap-x-3 font-display text-[clamp(3rem,2rem+4.4vw,5.75rem)] font-semibold leading-[0.9] tracking-[-0.045em] [font-stretch:108%]">
                {figure}
                {unit && <span className="font-sans text-[15px] font-medium tracking-normal text-white/55">{unit}</span>}
              </p>
              <p className="mt-3 text-[13px] text-white/55 num">
                at {rate.toFixed(2)}% over {years} {years === 1 ? "year" : "years"} · max new EMI {formatINR(result.maxEmi)}/mo
              </p>

              <IncomeMeter
                income={income}
                existing={existing}
                headroom={result.maxEmi}
                foir={result.foir}
                className="mt-10"
              />

              {result.overLimit && (
                <p className="mt-6 flex gap-2.5 text-[13px] leading-relaxed text-white/75">
                  <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-red" />
                  Existing EMIs already use the full {Math.round(result.foir * 100)}% allowance for{" "}
                  {employment === "salaried" ? "salaried" : "self-employed"} applicants. Closing a loan or adding a co-applicant would restore
                  eligibility.
                </p>
              )}

              <div className="mt-10 grid grid-cols-2 gap-6 border-t border-white/15 pt-8">
                <Readout
                  tone="light"
                  size="sm"
                  label="Car budget"
                  value={formatPrice(result.carBudget)}
                  caption={`With ${Math.round((1 - LOAN_TO_VALUE) * 100)}% down · ${formatPriceShort(result.downPayment)}`}
                />
                <Readout tone="light" size="sm" label="FOIR applied" value={`${Math.round(result.foir * 100)}%`} caption={employment === "salaried" ? "Salaried" : "Self-employed"} />
              </div>

              <div className="mt-auto pt-10">
                <Button
                  className="w-full"
                  arrow
                  disabled={result.eligible <= 0}
                  onClick={() =>
                    openEnquiry({
                      kind: "callback",
                      subject: "Car loan pre-approval",
                      detail: `Up to ${formatPrice(result.eligible)} · ${years} years · ${employment === "salaried" ? "Salaried" : "Self-employed"}`,
                    })
                  }
                >
                  Check pre-approved offers
                </Button>
                <EstimateNote tone="light" className="mt-3 text-center">
                  Illustrative estimate. Lenders also weigh credit score, employer and city.
                </EstimateNote>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="afford-heading" className="border-t border-line py-20 md:py-28">
        <div className="container-x">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <Eyebrow>Within reach</Eyebrow>
              <h2 id="afford-heading" className="type-h2 mt-5 text-balance">
                {affordable.length > 0 ? (
                  <>
                    <span className="num">{affordable.length}</span> models fit a <span className="num">{formatPrice(result.carBudget)}</span> budget
                  </>
                ) : (
                  "No new models fit this budget yet"
                )}
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-muted">
                Starting ex-showroom prices at or below your loan plus a {Math.round((1 - LOAN_TO_VALUE) * 100)}% down payment, most expensive first.
                EMIs assume an {Math.round(LOAN_TO_VALUE * 100)}% loan at your rate and tenure.
              </p>
            </div>
            {affordable.length > 0 && <TextLink href={`/new-cars?budget=${band.slug}`}>Browse {band.label} cars</TextLink>}
          </div>

          {affordable.length === 0 ? (
            <div className="mt-12 flex flex-col items-start gap-6 border border-line p-8 md:flex-row md:items-center md:justify-between md:p-10">
              <p className="max-w-xl text-[15px] leading-relaxed text-muted">
                Try a longer tenure, reduce existing EMIs, or consider a certified pre-owned car — verified used cars often cost 30–40% less than new.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button href="/used-cars" variant="dark" arrow>
                  Explore used cars
                </Button>
                <Button href="/new-cars?budget=under-8" variant="outline">
                  Cars under ₹8 Lakh
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div role="group" aria-label="Filter by body type" className="no-scrollbar -mx-5 mt-10 flex gap-2 overflow-x-auto px-5 md:mx-0 md:px-0">
                {FILTERS.map((f) => {
                  const count = affordable.filter((c) => matches(c, f.value)).length;
                  if (f.value !== "all" && count === 0) return null;
                  return (
                    <Chip
                      key={f.value}
                      selected={filter === f.value}
                      onClick={() => {
                        setFilter(f.value);
                        setExpanded(false);
                      }}
                    >
                      {f.label}
                      <span className={cn("num text-[12px]", filter === f.value ? "text-white/60" : "text-muted")}>{count}</span>
                    </Chip>
                  );
                })}
              </div>

              <ul className="mt-8 border-t border-ink">
                {visible.map((car) => (
                  <AffordRow key={car.slug} car={car} budget={result.carBudget} emi={calculateEmi(car.priceMin * LOAN_TO_VALUE, rate, years * 12)} years={years} />
                ))}
              </ul>

              {shown.length > 6 && (
                <div className="mt-8 flex justify-center">
                  <Button variant="outline" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
                    {expanded ? "Show fewer" : `Show all ${shown.length}`}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}

function AffordRow({ car, budget, emi, years }: { car: CarModel; budget: number; emi: number; years: number }) {
  const title = `${brandName(car.brand)} ${car.name}`;
  const share = Math.min(1, car.priceMin / Math.max(1, budget));
  return (
    <li className="border-b border-line">
      <Link
        href={`/cars/${car.slug}`}
        className="group/row grid grid-cols-[80px_1fr_auto] items-center gap-4 py-4 transition-colors duration-[400ms] hover:bg-mist/60 md:grid-cols-[112px_1.5fr_1fr_1fr_1.3fr_24px] md:gap-6 md:py-5"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-mist">
          <Image
            src={car.images[0]}
            alt={title}
            fill
            sizes="112px"
            className="object-cover transition-transform duration-[700ms] ease-[var(--ease-premium)] group-hover/row:scale-[1.05]"
            style={{ objectPosition: car.focus ?? "50% 55%" }}
          />
        </div>
        <div className="min-w-0">
          <p className="type-eyebrow text-muted">{brandName(car.brand)}</p>
          <p className="type-h4 mt-1.5 truncate">{car.name}</p>
          <p className="mt-1 text-[12.5px] text-muted num md:hidden">
            From {formatPriceShort(car.priceMin)} · {formatINR(emi)}/mo
          </p>
        </div>
        <div className="hidden md:block">
          <p className="text-[15px] font-semibold num">{formatPrice(car.priceMin)}</p>
          <p className="mt-0.5 text-[11.5px] text-muted">Ex-showroom from</p>
        </div>
        <div className="hidden md:block">
          <p className="text-[15px] font-semibold num">{formatINR(emi)}<span className="text-[12px] font-normal text-muted">/mo</span></p>
          <p className="mt-0.5 text-[11.5px] text-muted">{Math.round(LOAN_TO_VALUE * 100)}% loan · {years} yrs</p>
        </div>
        <div className="hidden md:block">
          <div className="h-[3px] bg-line">
            <div className="h-full bg-ink transition-[width] duration-500 ease-[var(--ease-premium)]" style={{ width: `${share * 100}%` }} />
          </div>
          <p className="mt-2 text-[11.5px] text-muted num">Uses {Math.round(share * 100)}% of budget</p>
        </div>
        <ArrowRight aria-hidden className="size-4 text-red transition-transform duration-[250ms] group-hover/row:translate-x-0.5" />
      </Link>
    </li>
  );
}

/** Monthly income split: existing EMIs · new EMI headroom · everything else, against the FOIR cap. */
function IncomeMeter({ income, existing, headroom, foir, className }: { income: number; existing: number; headroom: number; foir: number; className?: string }) {
  const safe = Math.max(1, income);
  const ex = Math.min(1, existing / safe);
  const head = Math.min(1 - ex, headroom / safe);
  const rest = Math.max(0, 1 - ex - head);
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-4 text-[12px] text-white/55">
        <span>Monthly income · {formatINR(income)}</span>
        <span className="num">FOIR cap {Math.round(foir * 100)}%</span>
      </div>
      <div className="relative mt-4">
        <div className="flex h-3 gap-[2px]" role="img" aria-label={`Existing EMIs ${Math.round(ex * 100)}% of income, new EMI capacity ${Math.round(head * 100)}%, remaining ${Math.round(rest * 100)}%`}>
          {ex > 0 && <span className="h-full bg-white/55 transition-[width] duration-500 ease-[var(--ease-premium)]" style={{ width: `${ex * 100}%` }} />}
          {head > 0 && <span className="h-full bg-red transition-[width] duration-500 ease-[var(--ease-premium)]" style={{ width: `${head * 100}%` }} />}
          {rest > 0 && <span className="h-full flex-1 bg-white/10" />}
        </div>
        <span aria-hidden className="absolute -bottom-1.5 -top-1.5 w-px bg-white" style={{ left: `${foir * 100}%` }} />
      </div>
      <dl className="mt-5 grid gap-2.5 text-[13px]">
        <MeterRow swatch="bg-white/55" label="Existing EMIs" value={formatINR(existing)} />
        <MeterRow swatch="bg-red" label="New EMI capacity" value={formatINR(headroom)} />
        <MeterRow swatch="bg-white/10" label="Living costs & savings" value={formatINR(Math.max(0, income - existing - headroom))} />
      </dl>
    </div>
  );
}

function MeterRow({ swatch, label, value }: { swatch: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-2 text-white/65">
        <span aria-hidden className={cn("size-2.5 rounded-[1px]", swatch)} />
        {label}
      </dt>
      <dd className="font-medium num">{value}</dd>
    </div>
  );
}

