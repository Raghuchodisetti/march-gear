import "server-only";
import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { brands, cars, usedCars, wishlistItems } from "@/db/schema";
import { LEGACY_BRANDS } from "@/lib/catalog";
import { formatKm } from "@/lib/format";
import { offerDisplayStatus } from "@/partner/labels";
import { getCatalog } from "@/server/catalog";
import { liveOffers, offerCoversCar } from "@/server/partner/offers";
import { discountHeadline, offerImage, type PublicOffer } from "@/components/offers/offer-utils";
import type { BadgeTone } from "@/components/portal/ui";

/* ──────────────────────────────────────────────────────────────
   A customer's saved cars (wishlist_items), resolved against the
   live catalogue so each one says whether it can still be bought,
   plus the dealer offers running on it right now. Same states as
   the admin's view of a customer (server/admin/audience.ts).
   ────────────────────────────────────────────────────────────── */

export type SavedState = "live" | "draft" | "hidden" | "reserved" | "sold" | "gone";

export const SAVED_STATE: Record<SavedState, { label: string; tone: BadgeTone; note: string }> = {
  live: { label: "Available", tone: "green", note: "" },
  reserved: { label: "Reserved", tone: "amber", note: "Another buyer has reserved this car. It may come back if their booking falls through." },
  sold: { label: "Sold", tone: "neutral", note: "This car has been sold." },
  draft: { label: "Not listed", tone: "neutral", note: "This car isn't listed on MarchGear right now." },
  hidden: { label: "Not listed", tone: "neutral", note: "This brand isn't listed on MarchGear right now." },
  gone: { label: "Removed", tone: "neutral", note: "This listing has been removed from MarchGear." },
};

/** A dealer offer running on a saved car right now (customer-safe fields only). */
export interface SavedOffer {
  id: number;
  reference: string;
  title: string;
  headline: string;
  dealer: string;
  city: string;
  image: string;
  endsAt: string;
  href: string;
}

export interface SavedCar {
  /** `${kind}:${itemId}` — unique per customer. */
  key: string;
  kind: "cars" | "used";
  itemId: string;
  savedAt: string;
  state: SavedState;
  title: string;
  /** Body type and fuels for new cars; year, km, fuel and city for used ones. */
  meta: string | null;
  image: string | null;
  focus: string | null;
  /** Public page while it's listed. */
  href: string | null;
  brand: string | null;
  bodyType: string | null;
  fuels: string[];
  /** New cars: the ex-showroom range. Used cars: the asking price (min = max). */
  price: { min: number; max: number } | null;
  /** The used car's original new price, when known. */
  newPrice: number | null;
  /** All fuels are electric (on-road estimates use the EV markup). */
  ev: boolean;
  /** Live dealer offers on this car, ending soonest first. */
  offers: SavedOffer[];
}

const toSavedOffer = (o: PublicOffer): SavedOffer => ({
  id: o.id,
  reference: o.reference,
  title: o.title,
  headline: discountHeadline(o.discount),
  dealer: o.dealer.name,
  city: o.dealer.city,
  image: offerImage(o.media),
  endsAt: o.endsAt,
  href: `/offers/${o.reference}`,
});

/** Live dealer offers (approved, inside their window, dealer approved) — the same feed as /offers. */
async function activeOffers(now: number) {
  const offers = await liveOffers(now);
  return offers.filter((o) => offerDisplayStatus({ status: "approved", startsAt: o.startsAt, endsAt: o.endsAt }, new Date(now)) === "active");
}

/** Every saved car of one customer, newest first. Items removed or unpublished since are kept (and explained). */
export async function getSavedCars(userId: number, now = Date.now()): Promise<SavedCar[]> {
  const db = getDb();
  const rows = await db
    .select({ kind: wishlistItems.kind, itemId: wishlistItems.itemId, createdAt: wishlistItems.createdAt })
    .from(wishlistItems)
    .where(eq(wishlistItems.userId, userId))
    .orderBy(desc(wishlistItems.createdAt));
  if (!rows.length) return [];

  const cat = await getCatalog();
  // What the catalogue no longer lists: look it up to say why (unpublished, reserved, sold or deleted).
  const offCars = rows.filter((r) => r.kind === "cars" && !cat.getCar(r.itemId)).map((r) => r.itemId);
  const offUsed = rows.filter((r) => r.kind === "used" && !cat.getUsedCar(r.itemId)).map((r) => r.itemId);
  const [carRows, usedRows, offers] = await Promise.all([
    offCars.length
      ? db
          .select({ slug: cars.slug, name: cars.name, status: cars.status, brand: brands.name, brandActive: brands.isActive })
          .from(cars)
          .leftJoin(brands, eq(brands.slug, cars.brand))
          .where(inArray(cars.slug, offCars))
      : Promise.resolve([]),
    offUsed.length
      ? db
          .select({
            id: usedCars.id,
            brand: usedCars.brand,
            brandName: brands.name,
            name: usedCars.name,
            variant: usedCars.variant,
            year: usedCars.year,
            km: usedCars.km,
            fuel: usedCars.fuel,
            city: usedCars.city,
            price: usedCars.price,
            images: usedCars.images,
            focus: usedCars.focus,
            status: usedCars.status,
          })
          .from(usedCars)
          .leftJoin(brands, eq(brands.slug, usedCars.brand))
          .where(inArray(usedCars.id, offUsed))
      : Promise.resolve([]),
    activeOffers(now),
  ]);
  const carBySlug = new Map(carRows.map((c) => [c.slug, c]));
  const usedById = new Map(usedRows.map((u) => [u.id, u]));

  return rows.map((r): SavedCar => {
    const base = {
      key: `${r.kind}:${r.itemId}`,
      kind: r.kind,
      itemId: r.itemId,
      savedAt: r.createdAt.toISOString(),
      meta: null,
      image: null,
      focus: null,
      href: null,
      brand: null,
      bodyType: null,
      fuels: [],
      price: null,
      newPrice: null,
      ev: false,
      offers: [],
    } satisfies Partial<SavedCar>;

    if (r.kind === "cars") {
      const car = cat.getCar(r.itemId);
      if (car) {
        return {
          ...base,
          state: "live",
          title: `${cat.brandName(car.brand)} ${car.name}`,
          meta: [car.bodyType, car.fuelTypes.join(" / ")].join(" · "),
          image: car.images[0] ?? null,
          focus: car.focus ?? null,
          href: `/cars/${car.slug}`,
          brand: car.brand,
          bodyType: car.bodyType,
          fuels: car.fuelTypes,
          price: { min: car.priceMin, max: car.priceMax },
          ev: car.fuelTypes.every((f) => f === "Electric"),
          offers: offers.filter((o) => offerCoversCar(o, car)).map(toSavedOffer),
        };
      }
      // Unlisted models only show their name: no photos or prices of anything that isn't public.
      const c = carBySlug.get(r.itemId);
      if (!c) return { ...base, state: "gone", title: "A car you saved" };
      return { ...base, state: c.status !== "published" ? "draft" : "hidden", title: [c.brand, c.name].filter(Boolean).join(" ") };
    }

    const u = cat.getUsedCar(r.itemId);
    if (u) {
      return {
        ...base,
        state: "live",
        title: `${u.year} ${cat.brandName(u.brand)} ${u.name} ${u.variant}`,
        meta: [formatKm(u.km), u.fuel, u.transmission, u.city].join(" · "),
        image: u.images[0] ?? null,
        focus: u.focus ?? null,
        href: `/used-cars/${encodeURIComponent(u.id)}`,
        brand: u.brand,
        bodyType: u.bodyType,
        fuels: [u.fuel],
        price: { min: u.price, max: u.price },
        newPrice: u.newPrice ?? null,
        offers: offers
          .filter((o) => o.scope.vehicleType !== "new" && o.dealer.id === u.seller.dealerId && (o.scope.allModels || o.brands.includes(u.brand)))
          .map(toSavedOffer),
      };
    }
    const x = usedById.get(r.itemId);
    if (!x) return { ...base, state: "gone", title: "A used car you saved" };
    const title = `${x.year} ${x.brandName ?? LEGACY_BRANDS[x.brand] ?? x.brand} ${x.name} ${x.variant}`;
    // Sold and reserved listings were public — keep their photo and last price so the customer recognises them.
    if (x.status === "sold" || x.status === "reserved")
      return {
        ...base,
        state: x.status,
        title,
        meta: [formatKm(x.km), x.fuel, x.city].join(" · "),
        image: x.images[0] ?? null,
        focus: x.focus,
        brand: x.brand,
        fuels: [x.fuel],
        price: { min: x.price, max: x.price },
      };
    return { ...base, state: x.status === "active" ? "hidden" : "draft", title };
  });
}

/** Distinct live offers across a customer's saved cars, ending soonest first, with the saved cars each one covers. */
export function offersOnSaved(saved: SavedCar[]) {
  const byId = new Map<number, SavedOffer & { covers: string[] }>();
  for (const s of saved) {
    for (const o of s.offers) {
      const entry = byId.get(o.id) ?? { ...o, covers: [] };
      if (!entry.covers.includes(s.title)) entry.covers.push(s.title);
      byId.set(o.id, entry);
    }
  }
  return [...byId.values()].sort((a, b) => a.endsAt.localeCompare(b.endsAt));
}

/* ── Quick compare sets ─────────────────────────────────────── */

/** A ready-made comparison of saved cars (two to four listed new cars). */
export interface CompareSet {
  key: string;
  title: string;
  note: string;
  slugs: string[];
}

const BANDS: { max: number; label: string }[] = [
  { max: 1_000_000, label: "under ₹10 Lakh" },
  { max: 2_000_000, label: "₹10–20 Lakh" },
  { max: 5_000_000, label: "₹20–50 Lakh" },
  { max: Infinity, label: "above ₹50 Lakh" },
];

/**
 * Quick comparisons built from the saved new cars that are still listed: the latest four, then the same
 * body type, the same budget and electric ones — each with at least two cars, duplicates dropped.
 */
export function compareSetsFromSaved(saved: SavedCar[]): CompareSet[] {
  const live = saved.filter((s) => s.kind === "cars" && s.state === "live" && s.price);
  if (live.length < 2) return [];
  const sets: CompareSet[] = [];
  const add = (key: string, title: string, note: string, list: SavedCar[]) => {
    const slugs = list.slice(0, 4).map((s) => s.itemId);
    if (slugs.length < 2) return;
    const id = [...slugs].sort().join(",");
    if (sets.some((x) => [...x.slugs].sort().join(",") === id)) return;
    sets.push({ key, title, note, slugs });
  };

  add("latest", "Your latest saves", live.length > 4 ? `The four you saved most recently, of ${live.length}.` : "Every listed new car on your shortlist.", live);

  const byBody = new Map<string, SavedCar[]>();
  for (const s of live) if (s.bodyType) byBody.set(s.bodyType, [...(byBody.get(s.bodyType) ?? []), s]);
  for (const [body, list] of byBody) {
    const plural = /^[A-Z]{2,}$/.test(body) ? `${body}s` : `${body.toLowerCase()}s`;
    add(`body-${body}`, `Saved ${plural}`, `Like for like: the ${plural} on your shortlist.`, list);
  }

  for (const band of BANDS) {
    const min = BANDS[BANDS.indexOf(band) - 1]?.max ?? 0;
    const list = live.filter((s) => s.price!.min >= min && s.price!.min < band.max);
    add(`price-${band.max}`, `Starting ${band.label}`, `Saved cars with an ex-showroom starting price ${band.label}.`, list);
  }

  add("ev", "Saved electric cars", "Range, charging and running costs, side by side.", live.filter((s) => s.ev));
  return sets.slice(0, 6);
}
