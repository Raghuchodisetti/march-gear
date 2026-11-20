/**
 * Pure calculation models behind the March Gear tools. No React, no I/O —
 * safe to import from server pages (for sample figures) and client islands.
 */
import type { BodyType, CarModel } from "@/types";
import type { SiteContent } from "@/content/registry";
import { isElectric, type Catalog } from "@/lib/catalog";
import { calculateEmi, principalForEmi } from "@/lib/finance";
import { formatNumber } from "@/lib/format";
import type { Employment, IceFuel } from "@/data/tools-assumptions";

/* ── Rates ──────────────────────────────────────────────────── */

/** The calculators' assumptions as fractions and multipliers, built from the `toolRates` content block. */
export interface CalcRates {
  /** ₹ per litre (CNG per kg) */
  fuelPrice: Record<IceFuel, number>;
  /** ₹ per kWh, home charging */
  homeTariff: number;
  /** Real-world EV energy use ÷ what the claimed range implies */
  evRealWorldFactor: number;
  /** Real-world fuel economy ÷ claimed */
  iceRealWorldFactor: number;
  /** kg CO₂ per litre of petrol */
  co2PerLitre: number;
  /** kg CO₂ per kWh from the grid */
  co2PerKwh: number;
  /** kg CO₂ a mature tree absorbs in a year */
  treeKgPerYear: number;
  foir: Record<Employment, number>;
  loanToValue: number;
  insuranceRate: number;
  /** Share of ex-showroom value retained at each age (index = years old) */
  resaleCurve: number[];
  luxuryDepreciationDrag: number;
  evDepreciationDrag: number;
  /** ₹ per year, first year of ownership */
  maintenanceBySegment: Record<BodyType, number>;
  luxuryMaintenance: number;
  evMaintenanceFactor: number;
  maintenanceGrowth: number;
}

/** Content stores percentages as admins type them (50 = 50%); the models work in fractions. */
export function calcRates(c: SiteContent["toolRates"]): CalcRates {
  const frac = (pct: number) => pct / 100;
  const r = c.resaleCurve;
  return {
    fuelPrice: { Petrol: c.fuelPrices.petrol, Diesel: c.fuelPrices.diesel, Hybrid: c.fuelPrices.hybrid, CNG: c.fuelPrices.cng },
    homeTariff: c.homeTariff,
    evRealWorldFactor: c.evRealWorldFactor,
    iceRealWorldFactor: c.iceRealWorldFactor,
    co2PerLitre: c.co2PerLitre,
    co2PerKwh: c.co2PerKwh,
    treeKgPerYear: c.treeKgPerYear,
    foir: { salaried: frac(c.foir.salaried), "self-employed": frac(c.foir.selfEmployed) },
    loanToValue: frac(c.loanToValue),
    insuranceRate: frac(c.insuranceRate),
    resaleCurve: [1, ...[r.year1, r.year2, r.year3, r.year4, r.year5, r.year6, r.year7].map(frac)],
    luxuryDepreciationDrag: c.luxuryDepreciationDrag,
    evDepreciationDrag: c.evDepreciationDrag,
    maintenanceBySegment: { Hatchback: c.maintenance.hatchback, Sedan: c.maintenance.sedan, SUV: c.maintenance.suv, MUV: c.maintenance.muv, Coupe: c.maintenance.coupe },
    luxuryMaintenance: c.maintenance.luxury,
    evMaintenanceFactor: frac(c.evMaintenanceFactor),
    maintenanceGrowth: frac(c.maintenanceGrowth),
  };
}

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
  rates,
}: {
  income: number;
  existingEmis: number;
  employment: Employment;
  ratePct: number;
  years: number;
  rates: CalcRates;
}) {
  const foir = rates.foir[employment];
  const cap = income * foir;
  const maxEmi = Math.max(0, cap - existingEmis);
  const eligible = maxEmi > 0 ? principalForEmi(maxEmi, ratePct, years * 12) : 0;
  const carBudget = eligible / rates.loanToValue;
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
export function evKwhPerKm(car: CarModel, rates: CalcRates) {
  if (!car.ev) return 0;
  return (car.ev.batteryKwh / car.ev.rangeKm) * rates.evRealWorldFactor;
}

/** Real-world fuel economy, km per litre (km/kg for CNG figures). */
export function iceKmpl(car: CarModel, rates: CalcRates) {
  return car.efficiencyValue * rates.iceRealWorldFactor;
}

export function primaryFuel(car: CarModel): IceFuel {
  return (car.fuelTypes.find((f) => f !== "Electric") ?? "Petrol") as IceFuel;
}

/** Running cost per km at the given energy prices. */
export function runningCostPerKm(car: CarModel, rates: CalcRates, tariff = rates.homeTariff, fuelPrice?: number) {
  if (isElectric(car)) return evKwhPerKm(car, rates) * tariff;
  return (fuelPrice ?? rates.fuelPrice[primaryFuel(car)]) / iceKmpl(car, rates);
}

export type BreakEvenStatus = "ev-always" | "breakeven" | "later" | "never";

export function evVsIce({
  ev,
  ice,
  dailyKm,
  years,
  tariff,
  fuelPrice,
  rates,
}: {
  ev: CarModel;
  ice: CarModel;
  dailyKm: number;
  years: number;
  tariff: number;
  fuelPrice: number;
  rates: CalcRates;
}) {
  const annualKm = dailyKm * 365;
  const evPerKm = evKwhPerKm(ev, rates) * tariff;
  const icePerKm = fuelPrice / iceKmpl(ice, rates);
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

  const litres = (annualKm * years) / iceKmpl(ice, rates);
  const kwh = annualKm * years * evKwhPerKm(ev, rates);
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
    co2AvoidedKg: litres * rates.co2PerLitre - kwh * rates.co2PerKwh,
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

export function retainedValue(car: CarModel, age: number, rates: CalcRates) {
  const curve = rates.resaleCurve;
  const base = curve[Math.min(age, curve.length - 1)];
  const luxury = car.isLuxury ? Math.pow(rates.luxuryDepreciationDrag, age) : 1;
  const electric = isElectric(car) ? Math.pow(rates.evDepreciationDrag, age) : 1;
  return base * luxury * electric;
}

export function ownershipCost({
  car,
  citySlug,
  kmPerYear,
  years,
  finance,
  rates,
  onRoadPrice,
}: {
  car: CarModel;
  citySlug: string;
  kmPerYear: number;
  years: number;
  finance: { enabled: boolean; downPct: number; ratePct: number };
  rates: CalcRates;
  /** The catalogue's city pricing, from getCatalog() or useCatalog(). */
  onRoadPrice: Catalog["onRoadPrice"];
}) {
  const ev = isElectric(car);
  const exShowroom = car.priceMin;
  const onRoad = onRoadPrice(exShowroom, citySlug, ev);
  const firstInsurance = exShowroom * rates.insuranceRate;
  const registration = Math.max(0, onRoad - exShowroom - firstInsurance);
  const perKm = runningCostPerKm(car, rates);
  const serviceBase = (car.isLuxury ? rates.luxuryMaintenance : rates.maintenanceBySegment[car.bodyType]) * (ev ? rates.evMaintenanceFactor : 1);

  const loanAmount = finance.enabled ? onRoad * (1 - finance.downPct / 100) : 0;
  const loan = finance.enabled && loanAmount > 0 ? amortise(loanAmount, finance.ratePct, years) : null;

  const rows: OwnershipYear[] = [];
  for (let y = 1; y <= years; y++) {
    const startValue = exShowroom * retainedValue(car, y - 1, rates);
    const endValue = exShowroom * retainedValue(car, y, rates);
    const row = {
      year: y,
      fuel: kmPerYear * perKm,
      // First-year cover is bundled into the on-road price.
      insurance: y === 1 ? firstInsurance : startValue * rates.insuranceRate,
      maintenance: serviceBase * Math.pow(1 + rates.maintenanceGrowth, y - 1),
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
