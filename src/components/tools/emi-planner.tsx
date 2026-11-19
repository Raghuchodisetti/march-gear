"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { getCar } from "@/data/cars";
import { brandName } from "@/data/brands";
import { formatINR, formatPrice, formatPriceShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/ui/chip";
import { DemoNote } from "@/components/ui/badge";
import { Eyebrow, TextLink } from "@/components/ui/section-heading";
import { EmiCalculator } from "@/components/tools/emi-calculator";
import { amortise } from "./calc";
import { Readout, StepLabel } from "./instrument";
import { ScheduleChart } from "./schedule-chart";

const PICKS = [
  "maruti-swift",
  "tata-nexon",
  "hyundai-creta",
  "mahindra-xev-9e",
  "mahindra-xuv700",
  "toyota-innova-hycross",
  "toyota-fortuner",
  "bmw-5-series",
];

/** Must match EmiCalculator's internal starting values so the schedule mirrors it on (re)mount. */
const DEFAULTS = { price: 1_200_000, downPct: 20, rate: 9.25, years: 5 };
type Inputs = typeof DEFAULTS;

const picks = PICKS.map((slug) => getCar(slug)).filter((c) => c !== undefined);

export function EmiPlanner() {
  const [pick, setPick] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Inputs>(DEFAULTS);
  // Bumped on every pick so re-selecting the same chip also resets the calculator.
  const [version, setVersion] = useState(0);
  const car = pick ? getCar(pick) : undefined;
  const carName = car ? `${brandName(car.brand)} ${car.name}` : undefined;

  const choose = (slug: string | null) => {
    const next = slug ? getCar(slug) : undefined;
    setPick(slug);
    setVersion((v) => v + 1);
    setInputs({ ...DEFAULTS, price: next?.priceMin ?? DEFAULTS.price });
  };

  const principal = Math.round(inputs.price * (1 - inputs.downPct / 100));
  const schedule = useMemo(() => amortise(principal, inputs.rate, inputs.years), [principal, inputs.rate, inputs.years]);
  const first = schedule.rows[0];
  const firstInterestShare = first ? first.interest / Math.max(1, first.interest + first.principal) : 0;
  const crossover = schedule.rows.find((r) => r.principal >= r.interest);

  return (
    <>
      <section aria-label="EMI calculator" className="py-14 md:py-20">
        <div className="container-x">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <StepLabel index="01">Quick pick a popular car — or set your own price</StepLabel>
            <DemoNote>Ex-showroom starting prices · indicative</DemoNote>
          </div>
          <div
            role="group"
            aria-label="Quick pick a car price"
            className="no-scrollbar -mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
          >
            <Chip selected={pick === null} onClick={() => choose(null)}>
              Custom
            </Chip>
            {picks.map((c) => (
              <Chip key={c.slug} selected={pick === c.slug} onClick={() => choose(c.slug)} aria-label={`${brandName(c.brand)} ${c.name}, from ${formatPrice(c.priceMin)}`}>
                {c.name}
                <span className={cn("num text-[12px]", pick === c.slug ? "text-white/60" : "text-muted")}>{formatPriceShort(c.priceMin)}</span>
              </Chip>
            ))}
          </div>

          {car && carName && (
            <div className="mt-6 flex items-center gap-4 border-t border-line pt-6">
              <div className="relative h-12 w-16 shrink-0 overflow-hidden bg-mist">
                <Image src={car.images[0]} alt="" fill sizes="64px" className="object-cover" style={{ objectPosition: car.focus ?? "50% 55%" }} />
              </div>
              <p className="min-w-0 flex-1 text-[14px] text-muted">
                Pre-filled with the <span className="font-medium text-ink">{carName}</span> from{" "}
                <span className="font-medium text-ink num">{formatPrice(car.priceMin)}</span> ex-showroom.
              </p>
              <TextLink href={`/cars/${car.slug}`} className="hidden shrink-0 sm:inline-flex">
                View car
              </TextLink>
            </div>
          )}

          <div className="mt-8 border border-line">
            <EmiCalculator key={`${pick ?? "custom"}-${version}`} defaultPrice={inputs.price} subject={carName} onChange={setInputs} />
          </div>
        </div>
      </section>

      <section aria-labelledby="schedule-heading" className="border-t border-line py-20 md:py-28">
        <div className="container-x">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <Eyebrow>Amortisation schedule</Eyebrow>
              <h2 id="schedule-heading" className="type-h2 mt-5 text-balance">
                Where every rupee of your EMI <span className="type-editorial">goes</span>
              </h2>
              <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted">
                Your instalment stays the same, but its make-up doesn&apos;t. Early EMIs are interest-heavy; as the balance falls, more of each
                payment retires the loan itself. This schedule follows the calculator above as you adjust it.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-px self-end border border-line bg-line lg:col-span-7 md:grid-cols-4">
              <Stat label="Loan amount" value={formatINR(principal)} />
              <Stat label="Monthly EMI" value={formatINR(schedule.emi)} />
              <Stat label="Total interest" value={formatINR(schedule.totalInterest)} />
              <Stat
                label="Year-1 interest"
                value={`${Math.round(firstInterestShare * 100)}%`}
                caption={crossover ? (crossover.year === 1 ? "Principal leads from year 1" : `Principal overtakes in year ${crossover.year}`) : "Interest leads throughout"}
              />
            </div>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10">
            <ScheduleChart rows={schedule.rows} className="min-w-0 lg:col-span-7" />

            <div className="min-w-0 lg:col-span-5">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px] text-[13.5px]">
                  <caption className="sr-only">
                    Yearly amortisation for a loan of {formatINR(principal)} at {inputs.rate.toFixed(2)}% over {inputs.years} years
                  </caption>
                  <thead>
                    <tr className="border-b border-ink text-left text-[11.5px] uppercase tracking-[0.12em] text-muted">
                      <th scope="col" className="py-3 pr-4 font-medium">Year</th>
                      <th scope="col" className="py-3 pr-4 text-right font-medium">Principal</th>
                      <th scope="col" className="py-3 pr-4 text-right font-medium">Interest</th>
                      <th scope="col" className="py-3 text-right font-medium">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="num">
                    {schedule.rows.map((r) => (
                      <tr key={r.year} className="border-b border-line">
                        <th scope="row" className="py-3.5 pr-4 text-left font-medium">{r.year}</th>
                        <td className="py-3.5 pr-4 text-right">{formatINR(r.principal)}</td>
                        <td className="py-3.5 pr-4 text-right text-muted">{formatINR(r.interest)}</td>
                        <td className="py-3.5 text-right">{formatINR(r.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="num">
                    <tr>
                      <th scope="row" className="pt-4 pr-4 text-left font-semibold">Total</th>
                      <td className="pt-4 pr-4 text-right font-semibold">{formatINR(principal)}</td>
                      <td className="pt-4 pr-4 text-right font-semibold">{formatINR(schedule.totalInterest)}</td>
                      <td className="pt-4 text-right text-muted">—</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="mt-6 text-[12px] leading-relaxed text-muted">
                Mirrors: {formatINR(inputs.price)} price · {inputs.downPct}% down · {inputs.rate.toFixed(2)}% p.a. · {inputs.years}{" "}
                {inputs.years === 1 ? "year" : "years"}. Monthly reducing balance, rounded to the rupee.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Stat({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <div className="bg-white p-5">
      <Readout label={label} value={value} caption={caption} size="sm" />
    </div>
  );
}
