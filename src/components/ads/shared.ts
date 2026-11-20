import type { AdAudience, AdCampaignStatus, AdFormat } from "@/db/enums";
import { addDays, daysBetween, gstOn } from "@/components/portal/billing/shared";

/* ──────────────────────────────────────────────────────────────
   Advertising rules shared by the server, the vendor portal and
   the admin. Client-safe: no database imports. Dates are IST
   calendar days as "YYYY-MM-DD" strings (inclusive ranges).
   ────────────────────────────────────────────────────────────── */

/** A placement as the portal and admin see it (a serialisable ad_placements row). */
export interface PlacementView {
  id: number;
  key: string;
  name: string;
  description: string;
  location: string;
  format: AdFormat;
  desktopSize: string | null;
  mobileSize: string | null;
  pricePerDay: number;
  minDays: number;
  maxDays: number;
  slots: number;
  audience: AdAudience;
  isActive: boolean;
  sortOrder: number;
}

/** Statuses that hold a slot on their days: booked (approved, paused) and pending (awaiting review or changes). */
export const OCCUPYING: AdCampaignStatus[] = ["approved", "paused", "pending_approval", "changes_requested"];

/** Bookings may start from tomorrow (IST), so MarchGear has time to review the creatives… */
export const BOOKING_LEAD_DAYS = 1;
/** …and up to this many days ahead. */
export const BOOKING_HORIZON_DAYS = 180;

export const ADVERTISER_TYPES = ["insurer", "dealer", "house"] as const;
export type AdvertiserType = (typeof ADVERTISER_TYPES)[number];
export const ADVERTISER_TYPE_LABEL: Record<AdvertiserType, string> = { insurer: "Insurance vendor", dealer: "Dealer partner", house: "MarchGear (house)" };
export const AUDIENCE_LABEL: Record<AdAudience, string> = { all: "Every advertiser", insurer: "Insurance vendors", dealer: "Dealer partners" };

/* ── Sizes ────────────────────────────────────────────────────── */

/** "1600×400" (or 1600x400) → { w: 1600, h: 400 }. */
export function parseSize(s: string | null | undefined): { w: number; h: number } | null {
  const m = /^\s*(\d{2,5})\s*[×xX*]\s*(\d{2,5})\s*$/.exec(s ?? "");
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  return w > 0 && h > 0 ? { w, h } : null;
}
/** A CSS aspect-ratio value for a recommended size, e.g. "1600 / 400". */
export const aspectOf = (s: string | null | undefined, fallback: string) => {
  const p = parseSize(s);
  return p ? `${p.w} / ${p.h}` : fallback;
};
export const DESKTOP_ASPECT = "4 / 1";
export const MOBILE_ASPECT = "4 / 3";
/** "1600 × 400 px" for people. */
export const sizeLabel = (s: string | null | undefined) => {
  const p = parseSize(s);
  return p ? `${p.w} × ${p.h} px` : "—";
};

/* ── Money ────────────────────────────────────────────────────── */

/** Price for a booking: ₹/day × days, plus 18% GST. */
export function adQuote(pricePerDay: number, days: number) {
  const amount = Math.max(0, Math.round(pricePerDay * days));
  const gst = gstOn(amount);
  return { amount, gst, total: amount + gst };
}

/** Inclusive number of days in a range. */
export const rangeDays = (startsOn: string, endsOn: string) => daysBetween(startsOn, endsOn) + 1;

/* ── Occupancy ────────────────────────────────────────────────── */

export interface BookedRange {
  id: number;
  startsOn: string;
  endsOn: string;
  status: AdCampaignStatus;
}

/** Campaigns holding a slot on each day from…to (inclusive), as { day: count }. */
export function occupancyByDay(ranges: BookedRange[], from: string, to: string, excludeId?: number) {
  const out: Record<string, number> = {};
  const total = Math.max(0, daysBetween(from, to) + 1);
  for (let i = 0; i < total; i++) out[addDays(from, i)] = 0;
  for (const r of ranges) {
    if (r.id === excludeId || !OCCUPYING.includes(r.status)) continue;
    const s = r.startsOn > from ? r.startsOn : from;
    const e = r.endsOn < to ? r.endsOn : to;
    for (let d = s; d <= e; d = addDays(d, 1)) out[d] = (out[d] ?? 0) + 1;
  }
  return out;
}

/** Days in a range on which every slot is already taken. */
export function soldOutDays(ranges: BookedRange[], slots: number, startsOn: string, endsOn: string, excludeId?: number) {
  const occ = occupancyByDay(ranges, startsOn, endsOn, excludeId);
  return Object.entries(occ)
    .filter(([, n]) => n >= slots)
    .map(([d]) => d);
}

/* ── Click targets ────────────────────────────────────────────── */

export const TARGET_KINDS = ["product", "provider", "path", "url"] as const;
export type TargetKind = (typeof TARGET_KINDS)[number];
export const TARGET_KIND_LABEL: Record<TargetKind, string> = {
  product: "One of your published products",
  provider: "Your provider page",
  path: "A page on MarchGear",
  url: "Your own website (https)",
};

/** Site areas an advertiser's click may not land on. */
const PRIVATE_PREFIXES = ["/api", "/ads", "/admin", "/insurance-vendor", "/dealer", "/media", "/_next"];

/**
 * A same-site path: starts with one "/", no "//" or "/\" (which browsers read as another host), no
 * whitespace or control characters, and not a private area. Returns the normalised path or null.
 */
export function safeInternalPath(raw: string | null | undefined, opts: { allowPrivate?: boolean } = {}): string | null {
  const v = (raw ?? "").trim();
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\") || v.length > 300) return null;
  if (/[\s\u0000-\u001f\u007f\\]/.test(v)) return null;
  let url: URL;
  try {
    url = new URL(v, "https://marchgear.invalid");
  } catch {
    return null;
  }
  if (url.origin !== "https://marchgear.invalid") return null;
  const path = url.pathname.toLowerCase();
  if (!opts.allowPrivate && PRIVATE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** An absolute https:// URL with a real host and no user:password@ part. Returns the normalised URL or null. */
export function safeHttpsUrl(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!/^https:\/\//i.test(v) || v.length > 300) return null;
  if (/[\s\u0000-\u001f\u007f\\]/.test(v)) return null;
  let url: URL;
  try {
    url = new URL(v);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes(".") || url.hostname.endsWith(".")) return null;
  return url.toString();
}

/** Adds ad=<id> to an internal path, keeping its query and #hash. */
export function withAdParam(path: string, campaignId: number) {
  const url = new URL(path, "https://marchgear.invalid");
  url.searchParams.set("ad", String(campaignId));
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Public URL of a product (the click route adds ?ad=). */
export const productHref = (reference: string) => `/insurance/products/${encodeURIComponent(reference)}`;

/** Where a campaign sends people, in words. */
export function describeTarget(c: { productId: number | null; targetUrl: string | null }, productName?: string | null) {
  if (c.productId) return productName ? `Product: ${productName}` : "A product page";
  if (!c.targetUrl) return "Not set";
  return c.targetUrl;
}

/* ── Formatting ───────────────────────────────────────────────── */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "12 Dec 2026" from an IST day string. */
export const dayLabel = (iso: string, year = true) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}${year ? ` ${iso.slice(0, 4)}` : ""}`;
/** "12 Dec – 25 Dec 2026" (years shown once when equal). */
export function rangeLabel(a: string, b: string) {
  if (a === b) return dayLabel(a);
  return a.slice(0, 4) === b.slice(0, 4) ? `${dayLabel(a, false)} – ${dayLabel(b)}` : `${dayLabel(a)} – ${dayLabel(b)}`;
}
/** Click-through rate as "2.4%" (or "—" without impressions). */
export const ctr = (clicks: number, impressions: number) => (impressions ? `${((clicks / impressions) * 100).toFixed(clicks / impressions >= 0.1 ? 1 : 2)}%` : "—");
export const n = (v: number) => v.toLocaleString("en-IN");
