/**
 * Pure calculation models behind the March Gear tools. No React, no I/O —
 * safe to import from server pages (for sample figures) and client islands.
 */
import type { CarModel } from "@/types";
import { calculateEmi, principalForEmi } from "@/lib/finance";
import { formatNumber } from "@/lib/format";
import { isElectric } from "@/lib/catalog";
import { onRoadPrice } from "@/data/cities";
import {
  CO2_PER_KWH,
  CO2_PER_LITRE,
  EV_DEPRECIATION_DRAG,
  EV_MAINTENANCE_FACTOR,
  EV_REAL_WORLD_FACTOR,
  FOIR,
  FUEL_PRICE,
  HOME_TARIFF,
  ICE_REAL_WORLD_FACTOR,
  INSURANCE_RATE,
  LOAN_TO_VALUE,
  LUXURY_DEPRECIATION_DRAG,
  LUXURY_MAINTENANCE,
  MAINTENANCE_BY_SEGMENT,
  MAINTENANCE_GROWTH,
  RESALE_CURVE,
  type Employment,
  type IceFuel,
} from "@/data/tools-assumptions";

/* ── Formatting ─────────────────────────────────────────────── */

const trim = (n: number, digits = 1) => Number(n.toFixed(digits)).toString();

/** Compact rupee figure for axes and dense UI: ₹1.2 Cr · ₹14.5 L · ₹48K · ₹950 */
export function compactINR(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7, 2)} Cr`;
  if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5, abs >= 1e6 ? 1 : 2)} L`;
  if (abs >= 1e3) return `${sign}₹${trim(abs / 1e3, abs >= 1e4 ? 0 : 1)}K`;
  return `${sign}₹${Math.round(abs)}`;
}

/** Splits a price into figure + unit for display typography: ["₹23.95", "Lakh"]. */
export function splitPrice(amount: number): [string, string] {
  const abs = Math.max(0, amount);
  if (abs >= 1e7) return [`₹${trim(abs / 1e7, 2)}`, "Crore"];
  if (abs >= 1e5) return [`₹${trim(abs / 1e5, 2)}`, "Lakh"];
  return [`₹${formatNumber(Math.round(abs))}`, ""];
}

/** 2.42 → "2 yrs 5 mo" */
export function formatYears(years: number) {
  const totalMonths = Math.round(years * 12);
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  if (y === 0) return `${m} mo`;
  if (m === 0) return `${y} ${y === 1 ? "yr" : "yrs"}`;
  return `${y} ${y === 1 ? "yr" : "yrs"} ${m} mo`;
}

/** Round axis ticks spanning [min, max]. */
export function niceTicks(min: number, max: number, count = 4) {
  if (!(max > min)) return [min, min + 1];
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

/** Parse a user-typed numeric string; empty or invalid → NaN. */
export function parseAmount(value: string) {
  if (value.trim() === "") return NaN;
  const n = Number(value.replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

/* ── Loans ──────────────────────────────────────────────────── */

export interface ScheduleRow {
  year: number;
  principal: number;
  interest: number;
  /** Outstanding balance at the end of the year */
  balance: number;
}

/** Year-by-year reducing-balance amortisation. */
export function amortise(principal: number, annualRatePct: number, years: number) {
  const months = Math.max(1, Math.round(years * 12));
  const emi = calculateEmi(principal, annualRatePct, months);
  const r = annualRatePct / 12 / 100;
  const rows: ScheduleRow[] = [];
  let balance = principal;
  for (let y = 0; y < Math.ceil(months / 12); y++) {
    let p = 0;
    let i = 0;
    for (let m = 0; m < 12 && y * 12 + m < months; m++) {
      const interest = balance * r;
      const repaid = Math.min(balance, emi - interest);
      balance -= repaid;
      p += repaid;
      i += interest;
    }
    rows.push({ year: y + 1, principal: p, interest: i, balance: Math.max(0, balance) });
  }
  const totalInterest = rows.reduce((s, row) => s + row.interest, 0);
  return { emi, rows, totalInterest, totalPayable: principal + totalInterest };
}

export function loanEligibility({
  income,
  existingEmis,
  employment,
  ratePct,
  years,
}: {
  income: number;
  existingEmis: number;
  employment: Employment;
  ratePct: number;
  years: number;
}) {
  const foir = FOIR[employment];
  const cap = income * foir;
  const maxEmi = Math.max(0, cap - existingEmis);
  const eligible = maxEmi > 0 ? principalForEmi(maxEmi, ratePct, years * 12) : 0;
  const carBudget = eligible / LOAN_TO_VALUE;
  const safeIncome = Math.max(1, income);
  return {
    foir,
    cap,
    maxEmi,
    eligible,
    carBudget,
    downPayment: carBudget - eligible,
    existingShare: Math.min(1, existingEmis / safeIncome),
    headroomShare: Math.min(1, maxEmi / safeIncome),
    overLimit: existingEmis >= cap,
  };
}

/* ── Energy ─────────────────────────────────────────────────── */

/** Real-world EV consumption, kWh per km. */
export function evKwhPerKm(car: CarModel) {
  if (!car.ev) return 0;
  return (car.ev.batteryKwh / car.ev.rangeKm) * EV_REAL_WORLD_FACTOR;
}

/** Real-world fuel economy, km per litre (km/kg for CNG figures). */
export function iceKmpl(car: CarModel) {
  return car.efficiencyValue * ICE_REAL_WORLD_FACTOR;
}

export function primaryFuel(car: CarModel): IceFuel {
  return (car.fuelTypes.find((f) => f !== "Electric") ?? "Petrol") as IceFuel;
}

/** Running cost per km at the given energy prices. */
export function runningCostPerKm(car: CarModel, tariff = HOME_TARIFF, fuelPrice?: number) {
  if (isElectric(car)) return evKwhPerKm(car) * tariff;
  return (fuelPrice ?? FUEL_PRICE[primaryFuel(car)]) / iceKmpl(car);
}

export type BreakEvenStatus = "ev-always" | "breakeven" | "later" | "never";

export function evVsIce({
  ev,
  ice,
  dailyKm,
  years,
  tariff,
  fuelPrice,
}: {
  ev: CarModel;
  ice: CarModel;
  dailyKm: number;
  years: number;
  tariff: number;
  fuelPrice: number;
}) {
  const annualKm = dailyKm * 365;
  const evPerKm = evKwhPerKm(ev) * tariff;
  const icePerKm = fuelPrice / iceKmpl(ice);
  const evAnnual = annualKm * evPerKm;
  const iceAnnual = annualKm * icePerKm;
  const ev0 = ev.priceMin;
  const ice0 = ice.priceMin;

  const series = Array.from({ length: years + 1 }, (_, y) => ({
    year: y,
    ev: ev0 + evAnnual * y,
    ice: ice0 + iceAnnual * y,
  }));

  let status: BreakEvenStatus;
  let breakEven: number | null = null;
  if (ev0 <= ice0 && evAnnual <= iceAnnual) {
    status = "ev-always";
    breakEven = 0;
  } else if (evAnnual < iceAnnual) {
    breakEven = (ev0 - ice0) / (iceAnnual - evAnnual);
    status = breakEven <= years ? "breakeven" : "later";
  } else {
    status = "never";
  }

  const litres = (annualKm * years) / iceKmpl(ice);
  const kwh = annualKm * years * evKwhPerKm(ev);
  const last = series[series.length - 1];

  return {
    annualKm,
    evPerKm,
    icePerKm,
    evAnnual,
    iceAnnual,
    series,
    status,
    breakEven,
    savings: last.ice - last.ev,
    runningSavings: (iceAnnual - evAnnual) * years,
    co2AvoidedKg: litres * CO2_PER_LITRE - kwh * CO2_PER_KWH,
    litres,
    kwh,
  };
}

/* ── Ownership ──────────────────────────────────────────────── */

export interface OwnershipYear {
  year: number;
  fuel: number;
  insurance: number;
  maintenance: number;
  interest: number;
  depreciation: number;
  total: number;
  /** Indicative resale value at the end of the year */
  value: number;
}

export function retainedValue(car: CarModel, age: number) {
  const base = RESALE_CURVE[Math.min(age, RESALE_CURVE.length - 1)];
  const luxury = car.isLuxury ? Math.pow(LUXURY_DEPRECIATION_DRAG, age) : 1;
  const electric = isElectric(car) ? Math.pow(EV_DEPRECIATION_DRAG, age) : 1;
  return base * luxury * electric;
}

export function ownershipCost({
  car,
  citySlug,
  kmPerYear,
  years,
  finance,
}: {
  car: CarModel;
  citySlug: string;
  kmPerYear: number;
  years: number;
  finance: { enabled: boolean; downPct: number; ratePct: number };
}) {
  const ev = isElectric(car);
  const exShowroom = car.priceMin;
  const onRoad = onRoadPrice(exShowroom, citySlug, ev);
  const firstInsurance = exShowroom * INSURANCE_RATE;
  const registration = Math.max(0, onRoad - exShowroom - firstInsurance);
  const perKm = runningCostPerKm(car);
  const serviceBase = (car.isLuxury ? LUXURY_MAINTENANCE : MAINTENANCE_BY_SEGMENT[car.bodyType]) * (ev ? EV_MAINTENANCE_FACTOR : 1);

  const loanAmount = finance.enabled ? onRoad * (1 - finance.downPct / 100) : 0;
  const loan = finance.enabled && loanAmount > 0 ? amortise(loanAmount, finance.ratePct, years) : null;

  const rows: OwnershipYear[] = [];
  for (let y = 1; y <= years; y++) {
    const startValue = exShowroom * retainedValue(car, y - 1);
    const endValue = exShowroom * retainedValue(car, y);
    const row = {
      year: y,
      fuel: kmPerYear * perKm,
      // First-year cover is bundled into the on-road price.
      insurance: y === 1 ? firstInsurance : startValue * INSURANCE_RATE,
      maintenance: serviceBase * Math.pow(1 + MAINTENANCE_GROWTH, y - 1),
      interest: loan?.rows[y - 1]?.interest ?? 0,
      depreciation: startValue - endValue,
      value: endValue,
    };
    rows.push({ ...row, total: row.fuel + row.insurance + row.maintenance + row.interest + row.depreciation });
  }

  const sum = (key: keyof Omit<OwnershipYear, "year" | "value" | "total">) => rows.reduce((s, r) => s + r[key], 0);
  const components = {
    depreciation: sum("depreciation"),
    fuel: sum("fuel"),
    interest: sum("interest"),
    insurance: sum("insurance"),
    maintenance: sum("maintenance"),
    registration,
  };
  const total = Object.values(components).reduce((s, v) => s + v, 0);
  const totalKm = kmPerYear * years;

  return {
    ev,
    exShowroom,
    onRoad,
    registration,
    loanAmount,
    emi: loan?.emi ?? 0,
    downPayment: finance.enabled ? onRoad - loanAmount : onRoad,
    rows,
    components,
    total,
    perKm: totalKm > 0 ? total / totalKm : 0,
    perMonth: total / (years * 12),
    resale: rows[rows.length - 1]?.value ?? exShowroom,
    runningPerKm: perKm,
  };
}
