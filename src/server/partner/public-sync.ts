import "server-only";
import { and, asc, avg, count, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { dealerReviews, dealers, partnerBrands, partnerShowrooms, partnerVehicles, partners, usedCars } from "@/db/schema";
import { IMG } from "@/data/images";
import { DAY_LABEL } from "@/partner/application";
import type { DayHours } from "@/partner/types";
import { expireCatalog } from "@/server/catalog";

/* ──────────────────────────────────────────────────────────────
   Keeps the public site in step with the dealer portal:
   - syncPublicDealer: an approved partner ↔ its /dealers listing
   - syncPublicVehicle: a published used car ↔ its /used-cars listing
   Call after any change that affects what the public sees.
   ────────────────────────────────────────────────────────────── */

const slug = (v: string) =>
  v
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56) || "dealer";

const to12h = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${suffix}`;
};

/** "Mon – Sat · 9:30 AM – 8:00 PM" from structured hours (the most common opening window). */
export function hoursLabel(hours: DayHours[]) {
  const open = hours.filter((h) => !h.closed);
  if (!open.length) return "By appointment";
  const key = (h: DayHours) => `${h.open}-${h.close}`;
  const counts = new Map<string, number>();
  for (const h of open) counts.set(key(h), (counts.get(key(h)) ?? 0) + 1);
  const common = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const days = open.filter((h) => key(h) === common);
  const [o, c] = common.split("-");
  const first = DAY_LABEL[days[0].day].slice(0, 3);
  const last = DAY_LABEL[days[days.length - 1].day].slice(0, 3);
  return `${first === last ? first : `${first} – ${last}`} · ${to12h(o)} – ${to12h(c)}`;
}

/**
 * The "area" in "area, city" labels: the district when it differs from the city, otherwise the locality
 * from the street address ("47-10-21, Dwaraka Nagar Main Road, near…" → "Dwaraka Nagar Main Road"),
 * so listings never read "Visakhapatnam, Visakhapatnam".
 */
export function areaOf(room: { address: string; district: string; city: string } | undefined) {
  if (!room) return "";
  const city = room.city.trim().toLowerCase();
  const district = room.district.trim();
  if (district && district.toLowerCase() !== city) return district;
  const locality = room.address
    .split(",")
    .map((s) => s.trim())
    .find((s) => /[a-z]{3}/i.test(s) && !/^\d/.test(s) && !/^(plot|door|flat|shop|unit|no\.?|d\.?\s?no|#)(\b|\s|\d)/i.test(s) && !/^(near|opp\.?|opposite|behind|beside|next to)\b/i.test(s) && s.toLowerCase() !== city);
  return locality ?? district;
}

/** Creates or updates the public showroom listing for an approved partner; hides it otherwise. */
export async function syncPublicDealer(partnerId: number) {
  const db = getDb();
  const [p] = await db.select().from(partners).where(eq(partners.id, partnerId));
  if (!p) return null;

  if (p.status !== "approved") {
    if (p.publicDealerId) {
      await db.update(dealers).set({ isActive: false }).where(eq(dealers.id, p.publicDealerId));
      expireCatalog();
    }
    return p.publicDealerId;
  }

  const [rooms, brands, usedLive] = await Promise.all([
    db.select().from(partnerShowrooms).where(and(eq(partnerShowrooms.partnerId, partnerId), eq(partnerShowrooms.isActive, true))).orderBy(desc(partnerShowrooms.isPrimary), asc(partnerShowrooms.id)),
    db.select({ brand: partnerBrands.brand }).from(partnerBrands).where(and(eq(partnerBrands.partnerId, partnerId), eq(partnerBrands.status, "approved"))),
    db.select({ id: partnerVehicles.id }).from(partnerVehicles).where(and(eq(partnerVehicles.partnerId, partnerId), eq(partnerVehicles.kind, "used"), eq(partnerVehicles.status, "published"))).limit(1),
  ]);
  const room = rooms[0];
  const app = p.application;
  const profile = p.profile;
  const name = p.tradeName || p.legalName || app.business.tradeName || app.business.legalName || "Dealer partner";
  const city = room?.city || p.city || "";
  const services = [
    brands.length ? "New car sales" : null,
    usedLive.length ? "Certified pre-owned" : null,
    room?.serviceCentre ? "Service & body shop" : null,
    "Finance & insurance",
  ].filter((s): s is string => Boolean(s));

  const values = {
    name: name.slice(0, 120),
    brand: brands.length === 1 ? brands[0].brand : "multi-brand",
    city: city.slice(0, 64) || "India",
    area: areaOf(room).slice(0, 120),
    address: (room ? `${room.address}, ${room.city} ${room.pin}` : app.business.legalName).slice(0, 300),
    phone: (room?.phone || app.business.phone || app.personal.mobile).slice(0, 30),
    email: (app.business.email || app.personal.email).slice(0, 190),
    hours: hoursLabel(profile?.hours?.length ? profile.hours : (room?.hours ?? [])).slice(0, 120),
    image: profile?.banner || room?.photos[0] || IMG.showroomRed,
    services,
    established: Number(app.business.establishedOn.slice(0, 4)) || new Date().getFullYear(),
    usedInventory: usedLive.length > 0,
    profile: {
      about: profile?.description || `${name} is a MarchGear dealer partner in ${city}.`,
      facilities: profile?.facilities ?? [],
      showroomArea: "—",
      serviceBays: 0,
      languages: ["English", "Hindi"],
      bearing: 0,
    },
    isActive: true,
  };

  let id = p.publicDealerId;
  if (id) {
    await db.update(dealers).set(values).where(eq(dealers.id, id));
  } else {
    // A readable, unique public id: "torque-motors-bengaluru", "-2", "-3"…
    const base = slug(`${name}-${city}`);
    const taken = new Set((await db.select({ id: dealers.id }).from(dealers)).map((d) => d.id));
    id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
    await db.insert(dealers).values({ ...values, id, rating: 0, reviewCount: 0, distanceKm: 0, sortOrder: 500 });
    await db.update(partners).set({ publicDealerId: id }).where(eq(partners.id, partnerId));
  }
  await refreshPartnerDealerRating(id);
  expireCatalog();
  return id;
}

/**
 * A partner showroom's public rating and review count, from its approved reviews.
 * Only for listings linked to a dealer partner — the launch showrooms keep their editorial figures.
 */
export async function refreshPartnerDealerRating(dealerId: string | null | undefined) {
  if (!dealerId) return;
  const db = getDb();
  const [linked] = await db.select({ id: partners.id }).from(partners).where(eq(partners.publicDealerId, dealerId)).limit(1);
  if (!linked) return;
  const [r] = await db
    .select({ avg: avg(dealerReviews.rating), n: count() })
    .from(dealerReviews)
    .where(and(eq(dealerReviews.dealerId, dealerId), eq(dealerReviews.status, "approved")));
  const rating = r?.avg ? Math.round(Number(r.avg) * 10) / 10 : 0;
  await db.update(dealers).set({ rating, reviewCount: r?.n ?? 0 }).where(eq(dealers.id, dealerId));
}

const INSURANCE_LABEL: Record<string, string> = {
  comprehensive: "Comprehensive",
  third_party: "Third party",
  expired: "Expired",
  none: "Not insured",
};

/**
 * Mirrors a dealer's used car into the public used-car listings while it is published
 * (and the dealership approved); otherwise hides the mirror. New-car stock isn't mirrored —
 * the public dealer page reads partner_vehicles directly.
 */
export async function syncPublicVehicle(vehicleId: number) {
  const db = getDb();
  const [v] = await db.select().from(partnerVehicles).where(eq(partnerVehicles.id, vehicleId));
  if (!v) return null;
  if (v.kind !== "used") {
    // New-car stock is read straight from partner_vehicles by the dealer and model pages — just refresh them.
    expireCatalog();
    return null;
  }
  const [p] = await db.select().from(partners).where(eq(partners.id, v.partnerId));
  const mirrorId = v.publicUsedCarId ?? `pv-${v.id}`;
  const live = v.status === "published" && p?.status === "approved" && v.stock > 0;

  if (!live) {
    if (v.publicUsedCarId) {
      await db.update(usedCars).set({ status: v.stock <= 0 && v.status === "published" ? "sold" : "draft" }).where(eq(usedCars.id, v.publicUsedCarId));
      expireCatalog();
    }
    return v.publicUsedCarId;
  }

  const [room] = v.showroomId ? await db.select().from(partnerShowrooms).where(eq(partnerShowrooms.id, v.showroomId)) : [];
  const used = v.used;
  const until = used?.insurance.validUntil
    ? new Date(`${used.insurance.validUntil}T00:00:00+05:30`).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "Asia/Kolkata" })
    : "";
  const insurance = used?.insurance.status ? `${INSURANCE_LABEL[used.insurance.status] ?? used.insurance.status}${until ? ` till ${until}` : ""}` : "Ask the dealer";
  // "KA-01" from "KA 01 AB 1234" when a number is given, else the state.
  const rto = used?.registrationNumber.toUpperCase().match(/^([A-Z]{2})[\s-]?(\d{1,2})/);
  const values = {
    modelSlug: v.modelSlug,
    brand: v.brand,
    name: v.model,
    variant: v.variant,
    year: used?.registrationYear ?? v.year,
    km: used?.km ?? 0,
    fuel: v.fuel,
    transmission: v.transmission,
    owners: Math.max(1, used?.owners ?? 1),
    city: (room?.city || p.city || "India").slice(0, 64),
    price: v.sellingPrice,
    newPrice: v.exShowroom,
    bodyType: v.bodyType,
    images: v.images.length ? v.images : [IMG.showroomRed],
    focus: null,
    verified: false,
    inspectionScore: 0,
    registration: (rto ? `${rto[1]}-${rto[2].padStart(2, "0")}` : used?.registrationState || "—").slice(0, 40),
    insurance: insurance.slice(0, 80),
    color: v.colour,
    sellerName: (p.tradeName || p.legalName || "Dealer partner").slice(0, 120),
    sellerType: "Dealer" as const,
    dealerId: p.publicDealerId,
    highlights: v.features.slice(0, 5),
    postedOn: (v.publishedAt ?? new Date()).toISOString().slice(0, 10),
    status: "active" as const,
  };
  const [exists] = await db.select({ id: usedCars.id }).from(usedCars).where(eq(usedCars.id, mirrorId));
  if (exists) await db.update(usedCars).set(values).where(eq(usedCars.id, mirrorId));
  else await db.insert(usedCars).values({ ...values, id: mirrorId });
  if (!v.publicUsedCarId) await db.update(partnerVehicles).set({ publicUsedCarId: mirrorId }).where(eq(partnerVehicles.id, v.id));
  expireCatalog();
  return mirrorId;
}

/** Re-syncs everything public for a partner (e.g. after approval, suspension or reactivation). */
export async function syncPartnerEverywhere(partnerId: number) {
  await syncPublicDealer(partnerId);
  const used = await getDb()
    .select({ id: partnerVehicles.id })
    .from(partnerVehicles)
    .where(and(eq(partnerVehicles.partnerId, partnerId), eq(partnerVehicles.kind, "used"), inArray(partnerVehicles.status, ["published", "unpublished", "archived"])));
  for (const u of used) await syncPublicVehicle(u.id);
}
