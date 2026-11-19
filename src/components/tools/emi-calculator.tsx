"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { loanBreakdown } from "@/lib/finance";
import { formatINR, formatPriceShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RangeField, Segmented } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useUI } from "@/components/providers/app-provider";

const TENURES = [1, 2, 3, 4, 5, 6, 7] as const;

export interface EmiInputs {
  price: number;
  downPct: number;
  rate: number;
  years: number;
}

/**
 * Reusable EMI calculator. Used standalone on /tools/emi-calculator and
 * embedded on model pages with the car's price pre-filled.
 */
export function EmiCalculator({
  defaultPrice = 1_200_000,
  minPrice = 300_000,
  maxPrice = 20_000_000,
  tone = "light",
  subject,
  className,
  onChange,
}: {
  defaultPrice?: number;
  minPrice?: number;
  maxPrice?: number;
  tone?: "light" | "dark";
  /** Car name used for the loan-offer CTA */
  subject?: string;
  className?: string;
  /** Notified whenever any input changes — lets pages build on the same figures. */
  onChange?: (inputs: EmiInputs) => void;
}) {
  const { openEnquiry } = useUI();
  const [price, setPrice] = useState(defaultPrice);
  const [downPct, setDownPct] = useState(20);
  const [rate, setRate] = useState(9.25);
  const [years, setYears] = useState<number>(5);

  const emit = (patch: Partial<EmiInputs>) => onChange?.({ price, downPct, rate, years, ...patch });
  const changePrice = (v: number) => {
    setPrice(v);
    emit({ price: v });
  };
  const changeDown = (v: number) => {
    setDownPct(v);
    emit({ downPct: v });
  };
  const changeRate = (v: number) => {
    setRate(v);
    emit({ rate: v });
  };
  const changeYears = (v: number) => {
    setYears(v);
    emit({ years: v });
  };

  const principal = Math.round(price * (1 - downPct / 100));
  const { emi, totalInterest, totalPayable } = useMemo(() => loanBreakdown(principal, rate, years * 12), [principal, rate, years]);
  const interestShare = totalPayable > 0 ? totalInterest / totalPayable : 0;
  const dark = tone === "dark";

  const step = price > 5_000_000 ? 100_000 : 10_000;

  return (
    <div className={cn("grid grid-cols-1 gap-px overflow-hidden lg:grid-cols-[1.2fr_1fr]", dark ? "bg-white/10" : "bg-line", className)}>
      <div className={cn("space-y-8 p-6 md:p-10", dark ? "bg-ink-2" : "bg-white")}>
        <RangeField
          tone={dark ? "light" : "dark"}
          label="Car price (on-road)"
          value={price}
          min={minPrice}
          max={maxPrice}
          step={step}
          onChange={changePrice}
          format={formatPriceShort}
          minLabel={formatPriceShort(minPrice)}
          maxLabel={formatPriceShort(maxPrice)}
        />
        <RangeField
          tone={dark ? "light" : "dark"}
          label={`Down payment · ${formatINR(price - principal)}`}
          value={downPct}
          min={0}
          max={80}
          step={5}
          onChange={changeDown}
          format={(v) => `${v}%`}
          minLabel="0%"
          maxLabel="80%"
        />
        <RangeField
          tone={dark ? "light" : "dark"}
          label="Interest rate (p.a.)"
          value={rate}
          min={7}
          max={16}
          step={0.25}
          onChange={changeRate}
          format={(v) => `${v.toFixed(2)}%`}
          minLabel="7%"
          maxLabel="16%"
        />
        <div>
          <p className={cn("mb-3 text-[13px]", dark ? "text-white/65" : "text-muted")}>Loan tenure</p>
          <Segmented
            tone={dark ? "light" : "dark"}
            ariaLabel="Loan tenure in years"
            className="flex w-full"
            options={TENURES.map((y) => ({ value: String(y), label: `${y}y` }))}
            value={String(years)}
            onChange={(v) => changeYears(Number(v))}
          />
        </div>
      </div>

      <div className={cn("flex flex-col p-6 md:p-10", dark ? "bg-ink text-white" : "bg-mist")}>
        <p className={cn("type-eyebrow", dark ? "text-white/60" : "text-muted")}>Monthly instalment</p>
        <motion.p
          key={Math.round(emi)}
          initial={{ opacity: 0.4, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="type-h1 mt-3 num"
          aria-live="polite"
        >
          {formatINR(emi)}
        </motion.p>
        <p className={cn("mt-1 text-[13px]", dark ? "text-white/55" : "text-muted")}>
          for {years * 12} months at {rate.toFixed(2)}%
        </p>

        <div className="mt-8 flex items-center gap-6">
          <Donut share={interestShare} dark={dark} />
          <dl className="grid flex-1 gap-3 text-[13px]">
            <Row dark={dark} swatch="bg-ink" swatchDark="bg-white" label="Principal" value={formatINR(principal)} />
            <Row dark={dark} swatch="bg-red" swatchDark="bg-red" label="Total interest" value={formatINR(totalInterest)} />
            <div className={cn("border-t pt-3", dark ? "border-white/15" : "border-line")}>
              <Row dark={dark} label="Total payable" value={formatINR(totalPayable)} strong />
            </div>
          </dl>
        </div>

        <div className="mt-auto pt-10">
          <Button
            variant="primary"
            className="w-full"
            arrow
            onClick={() => openEnquiry({ kind: "callback", subject: subject ? `Loan offers · ${subject}` : "Car loan offers", detail: `${formatINR(principal)} over ${years} years` })}
          >
            Get personalised loan offers
          </Button>
          <p className={cn("mt-3 text-center text-[11.5px]", dark ? "text-white/45" : "text-muted")}>
            Illustrative calculation. Actual rates depend on lender and credit profile.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, swatch, swatchDark, strong, dark }: { label: string; value: string; swatch?: string; swatchDark?: string; strong?: boolean; dark: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={cn("flex items-center gap-2", dark ? "text-white/65" : "text-muted")}>
        {swatch && <span aria-hidden className={cn("size-2 rounded-full", dark ? swatchDark : swatch)} />}
        {label}
      </dt>
      <dd className={cn("num", strong ? "text-[15px] font-semibold" : "font-medium")}>{value}</dd>
    </div>
  );
}

function Donut({ share, dark }: { share: number; dark: boolean }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 80 80" className="size-24 shrink-0 -rotate-90" aria-hidden>
      <circle cx="40" cy="40" r={r} fill="none" strokeWidth="8" className={dark ? "stroke-white" : "stroke-ink"} />
      <motion.circle
        cx="40"
        cy="40"
        r={r}
        fill="none"
        strokeWidth="8"
        className="stroke-red"
        strokeDasharray={c}
        initial={false}
        animate={{ strokeDashoffset: c * (1 - share) }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}
