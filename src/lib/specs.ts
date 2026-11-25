import type { CarModel, Dimensions } from "@/types";

/* ──────────────────────────────────────────────────────────────
   Facts-only conventions. The researched catalogue stores a spec
   the manufacturer doesn't publish as 0 / "" / an all-zero
   dimensions object (the columns are NOT NULL), and models without
   editorial copy have no rating, score, verdict or pros/cons.
   These helpers let the UI show "—" or leave such things out
   instead of printing zeros. Server- and client-safe.
   ────────────────────────────────────────────────────────────── */

/** Shown in spec tables for a figure that isn't published. */
export const NOT_PUBLISHED = "—";

/** A published number, or undefined for 0 / missing. */
export const known = (n: number | null | undefined) => (n && n > 0 ? n : undefined);

/** A published string, or undefined for "" / missing. */
export const knownText = (s: string | null | undefined) => (s && s.trim() ? s.trim() : undefined);

/** "190 km/h", or "—" when not published. */
export function specText(value: number | string | null | undefined, unit = "") {
  if (typeof value === "number") return known(value) ? `${value}${unit}` : NOT_PUBLISHED;
  return knownText(value) ? `${knownText(value)}${unit}` : NOT_PUBLISHED;
}

/** Seconds from an acceleration figure: "8.9 s" or "0–100 km/h in 8.9 s" → 8.9. */
export function accelSeconds(a: string | null | undefined): number | undefined {
  if (!a) return undefined;
  const m = a.match(/(\d+(?:\.\d+)?)\s*(?:s|sec|secs|seconds)\b/i) ?? a.match(/^\s*(\d+(?:\.\d+)?)\s*$/);
  return m ? Number(m[1]) : undefined;
}

/** The 0–100 km/h time for display: "8.9 s" (or the published text as is), "" when not published. */
export function accelText(a: string | null | undefined) {
  const s = accelSeconds(a);
  if (s !== undefined) return `${s} s`;
  return knownText(a) ?? "";
}

const UNIT: Record<string, string> = { bhp: "bhp", hp: "hp", ps: "PS", kw: "kW", nm: "Nm", kgm: "kgm" };
const fmtNum = (n: number) => String(Number(n.toFixed(1)));

/**
 * The top figure of a published power/torque range, with its unit: "82 – 118 bhp" → 118 bhp,
 * "60 – 150 kW" → 150 kW, "88 kW (118 bhp)" → 118 bhp. RPM figures are ignored. undefined when not published.
 */
export function topFigure(s: string | null | undefined, prefer: string[] = ["bhp", "hp", "PS", "kW", "Nm", "kgm"]) {
  if (!knownText(s)) return undefined;
  const clean = s!.replace(/,/g, "").replace(/(?:@|at)?\s*\d[\d.\s–-]*\s*rpm/gi, " ");
  const byUnit = new Map<string, number[]>();
  let pending: number[] = [];
  for (const m of clean.matchAll(/(\d+(?:\.\d+)?)|\b(bhp|hp|ps|kw|nm|kgm)\b/gi)) {
    if (m[1]) pending.push(Number(m[1]));
    else if (m[2] && pending.length) {
      const unit = UNIT[m[2].toLowerCase()];
      byUnit.set(unit, [...(byUnit.get(unit) ?? []), ...pending]);
      pending = [];
    }
  }
  const unit = prefer.find((u) => byUnit.has(u));
  const values = unit ? byUnit.get(unit)! : pending;
  if (!values.length) return undefined;
  const value = Math.max(...values);
  return { value, unit: unit ?? "", text: unit ? `${fmtNum(value)} ${unit}` : fmtNum(value) };
}

/** Peak power in bhp, for comparing cars whose makers publish kW or PS (1 kW = 1.341 bhp, 1 PS = 0.986 bhp). */
export function powerBhp(s: string | null | undefined) {
  const f = topFigure(s);
  if (!f) return undefined;
  const k = f.unit === "kW" ? 1.341 : f.unit === "PS" ? 0.986 : 1;
  return Math.round(f.value * k);
}

/** Peak torque in Nm (1 kgm = 9.807 Nm). */
export function torqueNm(s: string | null | undefined) {
  const f = topFigure(s, ["Nm", "kgm"]);
  if (!f) return undefined;
  return Math.round(f.unit === "kgm" ? f.value * 9.807 : f.value);
}

export const hasDimensions =(d: Dimensions | null | undefined): d is Dimensions => Boolean(d && d.length > 0 && d.width > 0 && d.height > 0);

/** Owner rating worth showing: a real average from real reviews. */
export const hasOwnerRating = (c: Pick<CarModel, "rating" | "reviewCount">) => c.rating > 0 && c.reviewCount > 0;

export const hasExpertScore = (c: Pick<CarModel, "expertScore">) => c.expertScore > 0;

/** Researched facts only: no editorial overview or verdict (and so no score, pros/cons or review). */
export const isFactsOnly = (c: Pick<CarModel, "overview" | "expertVerdict">) => !c.overview.trim() && !c.expertVerdict.trim();

/** "Data as of 25 Nov 2026 · ex-showroom Delhi" for researched models, or null. */
export function dataNote(c: Pick<CarModel, "dataAsOf" | "priceCity">) {
  if (!c.dataAsOf && !c.priceCity) return null;
  const parts: string[] = [];
  if (c.dataAsOf) {
    const d = new Date(`${c.dataAsOf}T00:00:00Z`);
    parts.push(`Prices and specs as of ${d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`);
  }
  if (c.priceCity) parts.push(`ex-showroom ${c.priceCity}`);
  return parts.join(" · ");
}
