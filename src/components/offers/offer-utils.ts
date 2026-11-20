import type { OfferCategory, OfferDiscount, OfferLocations, OfferMedia, OfferScope } from "@/partner/types";
import { formatINR, formatPrice } from "@/lib/format";

/* ──────────────────────────────────────────────────────────────
   Dealer offers — pure helpers shared by the dealer portal, the
   public site and the server (client-safe: no database imports).
   ────────────────────────────────────────────────────────────── */

/** States and union territories of India (for state-wide offers). */
export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
] as const;

/* ── Time (stored UTC, shown and entered in IST) ────────────── */

const IST_OFFSET_MS = 330 * 60_000;

/** A UTC instant → the IST calendar date and wall-clock time ("2026-11-21", "09:30"). */
export function toIstParts(d: Date | string | number) {
  const t = new Date(new Date(d).getTime() + IST_OFFSET_MS).toISOString();
  return { date: t.slice(0, 10), time: t.slice(11, 16) };
}

/** IST date + time typed by a dealer → the UTC instant, or null when incomplete/invalid. */
export function fromIstParts(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const d = new Date(`${date}T${time}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** IST day key for calendars. */
export const istDay = (d: Date | string | number) => toIstParts(d).date;

/** Adds whole days to a YYYY-MM-DD key (calendar arithmetic, no time zone involved). */
export function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const IST = { timeZone: "Asia/Kolkata" } as const;

/** "21 Nov 2026, 9:30 am" in IST. */
export function formatIst(d: Date | string, withTime = true) {
  return new Date(d).toLocaleString("en-IN", { ...IST, day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}) });
}

/** "21 Nov – 5 Dec 2026" (IST dates). */
export function formatWindow(start: Date | string, end: Date | string) {
  const s = new Date(start);
  const e = new Date(end);
  const sameYear = toIstParts(s).date.slice(0, 4) === toIstParts(e).date.slice(0, 4);
  const left = s.toLocaleDateString("en-IN", { ...IST, day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
  const right = e.toLocaleDateString("en-IN", { ...IST, day: "numeric", month: "short", year: "numeric" });
  return `${left} – ${right}`;
}

/** Whole days between two instants, rounded up (a 23:59 end counts its last day). */
export const durationDays = (start: Date | string, end: Date | string) => Math.max(0, Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000));

/** "3d 4h", "14h 20m", "35m 10s" — the time left until `target`. */
export function timeLeft(target: Date | string | number, now: number) {
  const ms = new Date(target).getTime() - now;
  if (ms <= 0) return "0m";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d >= 3) return `${d} days`;
  if (d >= 1) return `${d}d ${h}h`;
  if (h >= 1) return `${h}h ${m}m`;
  return `${m}m ${String(s % 60).padStart(2, "0")}s`;
}

/* ── Benefits ───────────────────────────────────────────────── */

export const EMPTY_DISCOUNT: OfferDiscount = {
  flat: null,
  percentage: null,
  cash: null,
  exchangeBonus: null,
  corporateBonus: null,
  loyaltyBonus: null,
  freeAccessories: "",
  freeInsurance: false,
  financeBenefit: "",
  maxDiscount: null,
  minPurchase: "",
};
export const EMPTY_SCOPE: OfferScope = { vehicleType: "new", allModels: true, brands: [], models: [], variants: [] };
export const EMPTY_MEDIA: OfferMedia = { desktopBanner: "", mobileBanner: "", thumbnail: "", gallery: [], videoUrl: "", brochure: null };
export const EMPTY_LOCATIONS: OfferLocations = { mode: "all", showroomIds: [], cities: [], states: [] };

/** ₹75,000 below a lakh, ₹1.25 Lakh above. */
export const money = (n: number) => (n >= 100_000 ? formatPrice(n) : formatINR(n));

const AMOUNTS = [
  ["flat", "Flat discount"],
  ["cash", "Cash discount"],
  ["exchangeBonus", "Exchange bonus"],
  ["corporateBonus", "Corporate bonus"],
  ["loyaltyBonus", "Loyalty bonus"],
] as const satisfies readonly (readonly [keyof OfferDiscount, string])[];

const pos = (n: number | null | undefined): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;

/** Sum of the rupee benefits, capped by the maximum discount when one is set. */
export function totalSavings(d: OfferDiscount) {
  const sum = AMOUNTS.reduce((acc, [k]) => acc + (pos(d[k] as number | null) ? (d[k] as number) : 0), 0);
  return pos(d.maxDiscount) ? Math.min(sum, d.maxDiscount) : sum;
}

export interface Benefit {
  key: string;
  label: string;
  value: string;
}

/** Every benefit the offer gives, in display order. */
export function benefitList(d: OfferDiscount): Benefit[] {
  const out: Benefit[] = [];
  for (const [k, label] of AMOUNTS) {
    const v = d[k] as number | null;
    if (pos(v)) out.push({ key: k, label, value: money(v) });
  }
  if (pos(d.percentage)) out.push({ key: "percentage", label: "Percentage discount", value: `${Number(d.percentage.toFixed(2))}% off${pos(d.maxDiscount) ? `, up to ${money(d.maxDiscount)}` : ""}` });
  if (d.freeInsurance) out.push({ key: "freeInsurance", label: "Free insurance", value: "Insurance included" });
  if (d.freeAccessories.trim()) out.push({ key: "freeAccessories", label: "Free accessories", value: d.freeAccessories.trim() });
  if (d.financeBenefit.trim()) out.push({ key: "financeBenefit", label: "Finance benefits", value: d.financeBenefit.trim() });
  return out;
}

export const hasBenefit = (d: OfferDiscount) => benefitList(d).length > 0;

/** The one-line promise shown on cards: "Save up to ₹85,000", "8% off", "Free insurance"… */
export function discountHeadline(d: OfferDiscount) {
  const amounts = AMOUNTS.filter(([k]) => pos(d[k] as number | null));
  const total = totalSavings(d);
  const pct = pos(d.percentage) ? `${Number(d.percentage.toFixed(2))}% off` : "";
  if (amounts.length === 1 && !pct) {
    const [k] = amounts[0];
    const v = money(total);
    if (k === "flat") return `Flat ${v} off`;
    if (k === "cash") return `${v} cash discount`;
    if (k === "exchangeBonus") return `${v} exchange bonus`;
    if (k === "corporateBonus") return `${v} corporate bonus`;
    return `${v} loyalty bonus`;
  }
  if (amounts.length > 1 && !pct) return `Save up to ${money(total)}`;
  if (amounts.length && pct) return `${pct} + up to ${money(total)}`;
  if (pct) return pos(d.maxDiscount) ? `${pct}, up to ${money(d.maxDiscount)}` : pct;
  if (d.freeInsurance) return "Free insurance";
  if (d.freeAccessories.trim()) return "Free accessories";
  if (d.financeBenefit.trim()) return d.financeBenefit.trim().slice(0, 60);
  return "Special offer";
}

/* ── Labels ─────────────────────────────────────────────────── */

const listLabel = (items: string[], max = 2) => (items.length <= max ? items.join(", ") : `${items.slice(0, max).join(", ")} +${items.length - max} more`);

/** "All Hyundai models", "Hyundai Creta, Verna", "All pre-owned cars"… */
export function vehicleLabel(
  scope: OfferScope,
  names: { brand: (slug: string) => string; model: (slug: string) => string; brandOf?: (model: string) => string | undefined },
  effectiveBrands: string[] = scope.brands,
) {
  const used = scope.vehicleType === "used";
  const both = scope.vehicleType === "both";
  if (scope.allModels || !scope.models.length) {
    const brands = (scope.brands.length ? scope.brands : effectiveBrands).map(names.brand);
    if (used) return brands.length ? `Pre-owned ${listLabel(brands)} cars` : "All pre-owned cars";
    const tail = both ? " · new & pre-owned" : "";
    if (!brands.length) return `All models${tail}`;
    return `All ${brands.length <= 2 ? brands.join(" & ") : listLabel(brands)} models${tail}`;
  }
  const models = scope.models.map(names.model);
  const brands = [...new Set(scope.models.map((m) => names.brandOf?.(m)).filter(Boolean))] as string[];
  const prefix = brands.length === 1 ? `${names.brand(brands[0])} ` : "";
  return `${used ? "Pre-owned " : ""}${prefix}${listLabel(models)}${both ? " · new & pre-owned" : ""}`;
}

/** "All 3 showrooms", "Banjara Hills, Kukatpally", "Hyderabad, Vijayawada"… */
export function locationLabel(loc: OfferLocations, showrooms: { id: number; name: string; city: string }[]) {
  if (loc.mode === "branches") {
    const picked = showrooms.filter((s) => loc.showroomIds.includes(s.id)).map((s) => s.name);
    return picked.length ? listLabel(picked) : "Selected showrooms";
  }
  if (loc.mode === "cities") return loc.cities.length ? listLabel(loc.cities, 3) : "Selected cities";
  if (loc.mode === "states") return loc.states.length ? listLabel(loc.states, 2) : "Selected states";
  const cities = [...new Set(showrooms.map((s) => s.city))];
  if (showrooms.length <= 1) return cities[0] ? `${cities[0]} showroom` : "All showrooms";
  return cities.length === 1 ? `All ${showrooms.length} ${cities[0]} showrooms` : `All ${showrooms.length} showrooms`;
}

/** Only https links to videos are accepted; YouTube/Vimeo get a friendly name. */
export function videoHost(url: string) {
  try {
    const u = new URL(url);
    if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(u.hostname)) return "YouTube";
    if (/(^|\.)vimeo\.com$/.test(u.hostname)) return "Vimeo";
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/* ── Public offer shape (what the website renders) ─────────── */

export interface PublicOffer {
  id: number;
  reference: string;
  partnerId: number;
  title: string;
  campaignName: string;
  tagline: string;
  category: OfferCategory | string;
  description: string;
  terms: string;
  scope: OfferScope;
  discount: OfferDiscount;
  media: Omit<OfferMedia, "brochure"> & { brochure: { filename: string; size: number } | null };
  startsAt: string;
  endsAt: string;
  limitedStock: number | null;
  maxRedemptions: number | null;
  dealer: { id: string; name: string; city: string; area: string };
  /** Brands the offer covers (its own list, or the dealer's authorised brands for "all models"). */
  brands: string[];
  /** Cities and states it is valid in, for filters. */
  cities: string[];
  states: string[];
  branches: { name: string; city: string; address: string }[];
  vehicleLabel: string;
  locationLabel: string;
}

/** Whether a public offer is live at `now` (approved and inside its window — the server already checked approval). */
export const isLive = (o: Pick<PublicOffer, "startsAt" | "endsAt">, now: number) => new Date(o.startsAt).getTime() <= now && now <= new Date(o.endsAt).getTime();

/** Cover image for cards: thumbnail, then banner, then the first gallery photo. */
export const offerImage = (m: Pick<OfferMedia, "thumbnail" | "desktopBanner" | "mobileBanner" | "gallery">) => m.thumbnail || m.desktopBanner || m.mobileBanner || m.gallery[0] || "";
