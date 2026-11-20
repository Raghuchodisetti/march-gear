import "server-only";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { adCampaigns, insCompanies, insProducts, insVendors } from "@/db/schema";
import { publicProductWhere } from "@/server/insurance/public";
import { addDays, istDate } from "@/components/portal/billing/shared";
import {
  BOOKING_HORIZON_DAYS,
  BOOKING_LEAD_DAYS,
  OCCUPYING,
  dayLabel,
  rangeDays,
  safeHttpsUrl,
  safeInternalPath,
  soldOutDays,
  type BookedRange,
  type TargetKind,
} from "@/components/ads/shared";
import type { PlacementRow } from "./placements";

/* ──────────────────────────────────────────────────────────────
   Booking rules: dates, slot availability and click targets.
   Used by the vendor wizard, the admin (house campaigns,
   rescheduling) and re-checked on every save.
   ────────────────────────────────────────────────────────────── */

/** Campaigns holding a slot in the placements between from…to. */
export async function bookedRanges(placementIds: number[], from: string, to: string): Promise<Map<number, BookedRange[]>> {
  const out = new Map<number, BookedRange[]>();
  if (!placementIds.length) return out;
  const rows = await getDb()
    .select({ id: adCampaigns.id, placementId: adCampaigns.placementId, startsOn: adCampaigns.startsOn, endsOn: adCampaigns.endsOn, status: adCampaigns.status })
    .from(adCampaigns)
    .where(and(inArray(adCampaigns.placementId, placementIds), inArray(adCampaigns.status, OCCUPYING), lte(adCampaigns.startsOn, to), gte(adCampaigns.endsOn, from)))
    .orderBy(asc(adCampaigns.startsOn));
  for (const r of rows) out.set(r.placementId, [...(out.get(r.placementId) ?? []), { id: r.id, startsOn: r.startsOn, endsOn: r.endsOn, status: r.status }]);
  return out;
}

/** Days in startsOn…endsOn on which the placement is already full (ignoring `excludeId`, the campaign being moved). */
export async function fullDays(placement: Pick<PlacementRow, "id" | "slots">, startsOn: string, endsOn: string, excludeId?: number) {
  const ranges = (await bookedRanges([placement.id], startsOn, endsOn)).get(placement.id) ?? [];
  return soldOutDays(ranges, placement.slots, startsOn, endsOn, excludeId);
}

/** "12 Dec, 13 Dec and 2 more" */
export function listDays(days: string[]) {
  const shown = days.slice(0, 3).map((d) => dayLabel(d, false));
  return days.length > 3 ? `${shown.join(", ")} and ${days.length - 3} more` : shown.join(", ").replace(/, ([^,]*)$/, " and $1");
}

type DateIssue = { field: "startsOn" | "endsOn"; message: string };

/**
 * Date rules for a booking. `minStart` is the earliest allowed start (vendors: tomorrow; staff: today).
 * Returns the first problem, or null.
 */
export function dateProblem(p: Pick<PlacementRow, "minDays" | "maxDays">, startsOn: string, endsOn: string, opts: { minStart?: string; checkLength?: boolean } = {}): DateIssue | null {
  const today = istDate();
  const minStart = opts.minStart ?? addDays(today, BOOKING_LEAD_DAYS);
  if (startsOn < minStart) return { field: "startsOn", message: minStart === today ? "Choose today or a later day" : `The earliest start is ${dayLabel(minStart)}` };
  if (startsOn > addDays(today, BOOKING_HORIZON_DAYS)) return { field: "startsOn", message: `Bookings open up to ${BOOKING_HORIZON_DAYS} days ahead` };
  if (endsOn < startsOn) return { field: "endsOn", message: "The last day can't be before the first" };
  if (opts.checkLength !== false) {
    const days = rangeDays(startsOn, endsOn);
    if (days < p.minDays) return { field: "endsOn", message: `Book at least ${p.minDays} days (this is ${days})` };
    if (days > p.maxDays) return { field: "endsOn", message: `Book at most ${p.maxDays} days (this is ${days})` };
  }
  return null;
}

/** When an advertising invoice is due: the start date or the payment terms, whichever is sooner (never before today). */
export function adInvoiceDueDate(startsOn: string, termsDays: number, today = istDate()) {
  const byTerms = addDays(today, termsDays);
  const due = startsOn < byTerms ? startsOn : byTerms;
  return due < today ? today : due;
}

/* ── Targets ──────────────────────────────────────────────────── */

export interface VendorProductOption {
  id: number;
  name: string;
  reference: string;
  category: string;
}

/** A vendor's public products (published, vendor approved, company active) — what it may promote. */
export async function vendorPublicProducts(vendorId: number): Promise<VendorProductOption[]> {
  return getDb()
    .select({ id: insProducts.id, name: insProducts.name, reference: insProducts.reference, category: insProducts.category })
    .from(insProducts)
    .innerJoin(insVendors, eq(insVendors.id, insProducts.vendorId))
    .innerJoin(insCompanies, eq(insCompanies.id, insProducts.companyId))
    .where(and(eq(insProducts.vendorId, vendorId), publicProductWhere))
    .orderBy(asc(insProducts.name));
}

/** The vendor's own provider page (insurers with a linked, active company). */
export async function vendorProvider(vendorId: number): Promise<{ slug: string; name: string; href: string } | null> {
  const [c] = await getDb()
    .select({ slug: insCompanies.slug, name: insCompanies.name })
    .from(insCompanies)
    .where(and(eq(insCompanies.vendorId, vendorId), eq(insCompanies.isActive, true)))
    .limit(1);
  return c ? { ...c, href: providerHref(c.slug) } : null;
}

/** Public URL of an insurance provider's page. */
export const providerHref = (slug: string) => `/insurance/providers/${encodeURIComponent(slug)}`;

export type TargetInput = { kind: TargetKind; productId?: number | null; path?: string | null; url?: string | null };

/**
 * Resolves a vendor's chosen target to stored values ({ productId } or { targetUrl }), checking
 * ownership — or a field error. Sponsored listings must promote a product.
 */
export async function resolveVendorTarget(vendorId: number, format: PlacementRow["format"], t: TargetInput): Promise<{ productId: number | null; targetUrl: string | null } | { field: string; message: string }> {
  if (format === "sponsored_listing" && t.kind !== "product") return { field: "target.kind", message: "A sponsored listing promotes one of your published products" };
  switch (t.kind) {
    case "product": {
      if (!t.productId) return { field: "target.productId", message: "Choose a product" };
      const ok = (await vendorPublicProducts(vendorId)).some((p) => p.id === t.productId);
      if (!ok) return { field: "target.productId", message: "Choose one of your published products" };
      return { productId: t.productId, targetUrl: null };
    }
    case "provider": {
      const p = await vendorProvider(vendorId);
      if (!p) return { field: "target.kind", message: "Your company doesn't have a provider page on MarchGear yet" };
      return { productId: null, targetUrl: p.href };
    }
    case "path": {
      const path = safeInternalPath(t.path);
      if (!path) return { field: "target.path", message: "Enter a MarchGear page starting with /, e.g. /insurance/renewal" };
      return { productId: null, targetUrl: path };
    }
    case "url": {
      const url = safeHttpsUrl(t.url);
      if (!url) return { field: "target.url", message: "Enter a full https:// address, e.g. https://www.example.com/offer" };
      return { productId: null, targetUrl: url };
    }
  }
}

/** Which kind a stored target is (for editing). */
export function targetKindOf(c: { productId: number | null; targetUrl: string | null }): TargetKind {
  if (c.productId) return "product";
  if (c.targetUrl?.startsWith("/insurance/providers/")) return "provider";
  if (c.targetUrl?.startsWith("/")) return "path";
  return "url";
}
