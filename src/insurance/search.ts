import { INS_INTENTS, INS_POLICY_STATUS, type InsIntent, type InsPolicyStatus } from "@/db/enums";
import type { FuelName, InsuranceSearch } from "./types";

/* ──────────────────────────────────────────────────────────────
   The customer's vehicle search, as URL params. The search form
   (/insurance and the landing pages) writes these; /insurance/quotes
   and /insurance/compare read them. Client-safe.

   ?intent=new|renewal&reg=MH12AB1234&brand=hyundai&model=hyundai-creta
   &variant=sx-o&year=2024&fuel=Petrol&city=Pune&state=Maharashtra
   &policy=active&expiry=2026-12-31&ncb=25&claimed=1
   ────────────────────────────────────────────────────────────── */

export const FUELS: FuelName[] = ["Petrol", "Diesel", "CNG", "Hybrid", "Electric"];
export const NCB_OPTIONS = [0, 20, 25, 35, 45, 50] as const;

export const EMPTY_SEARCH: InsuranceSearch = {
  intent: "new",
  reg: "",
  brand: "",
  model: "",
  variant: "",
  year: null,
  fuel: "",
  city: "",
  state: "",
  policy: "",
  expiry: "",
  ncb: 0,
  claimed: false,
};

/** Upper-case, no spaces or dashes: "mh 12 ab-1234" → "MH12AB1234". */
export const normaliseReg = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);

/** Standard (MH12AB1234, DL3CAB1234) and Bharat-series (22BH1234AA) registration numbers. */
export const isValidReg = (v: string) => /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/.test(v) || /^\d{2}BH\d{4}[A-Z]{1,2}$/.test(v);

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

const read = (p: Params, key: string): string => {
  const v = p instanceof URLSearchParams ? p.get(key) : p[key];
  return (Array.isArray(v) ? v[0] : v ?? "").trim();
};

const slug = (v: string) => (/^[a-z0-9][a-z0-9-]{0,119}$/.test(v) ? v : "");
const place = (v: string) => (/^[\p{L}\p{M} .'()&-]{2,64}$/u.test(v) ? v : "");

/** Parses (and sanitises) search params. Unknown or malformed values are dropped. */
export function parseSearch(p: Params, thisYear = new Date().getFullYear()): InsuranceSearch {
  const intent = read(p, "intent");
  const policy = read(p, "policy");
  const fuel = read(p, "fuel");
  const year = Number(read(p, "year"));
  const ncb = Number(read(p, "ncb"));
  const expiry = read(p, "expiry");
  const reg = normaliseReg(read(p, "reg"));
  return {
    intent: (INS_INTENTS as readonly string[]).includes(intent) ? (intent as InsIntent) : "new",
    reg: isValidReg(reg) ? reg : "",
    brand: slug(read(p, "brand")),
    model: slug(read(p, "model")),
    variant: slug(read(p, "variant")),
    year: Number.isInteger(year) && year >= thisYear - 25 && year <= thisYear + 1 ? year : null,
    fuel: (FUELS as string[]).includes(fuel) ? (fuel as FuelName) : "",
    city: place(read(p, "city")),
    state: place(read(p, "state")),
    policy: (INS_POLICY_STATUS as readonly string[]).includes(policy) ? (policy as InsPolicyStatus) : "",
    expiry: /^\d{4}-\d{2}-\d{2}$/.test(expiry) ? expiry : "",
    ncb: (NCB_OPTIONS as readonly number[]).includes(ncb) ? ncb : 0,
    claimed: read(p, "claimed") === "1",
  };
}

/** The query string for a search (empty values left out). */
export function searchQuery(s: Partial<InsuranceSearch>): string {
  const q = new URLSearchParams();
  const full = { ...EMPTY_SEARCH, ...s };
  q.set("intent", full.intent);
  if (full.reg) q.set("reg", full.reg);
  if (full.brand) q.set("brand", full.brand);
  if (full.model) q.set("model", full.model);
  if (full.variant) q.set("variant", full.variant);
  if (full.year) q.set("year", String(full.year));
  if (full.fuel) q.set("fuel", full.fuel);
  if (full.city) q.set("city", full.city);
  if (full.state) q.set("state", full.state);
  if (full.policy) q.set("policy", full.policy);
  if (full.expiry) q.set("expiry", full.expiry);
  if (full.ncb) q.set("ncb", String(full.ncb));
  if (full.claimed) q.set("claimed", "1");
  return q.toString();
}

/** True when there's enough to estimate premiums (a model; the variant/year improve it). */
export const isSearchReady = (s: InsuranceSearch) => Boolean(s.brand && s.model);

/** The car is new (not registered yet) — no NCB, no previous policy, bundled/new-car products apply. */
export const isNewVehicle = (s: InsuranceSearch) => s.intent === "new" && (s.policy === "new_vehicle" || (!s.reg && s.policy === ""));
