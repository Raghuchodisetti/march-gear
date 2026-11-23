import "server-only";
import { and, count, desc, eq, gt, inArray, ne } from "drizzle-orm";
import { getDb } from "@/db";
import {
  brands,
  cars,
  customerNotifications,
  customerVehicles,
  dealers,
  insEnquiries,
  insQuotes,
  insVendors,
  leads,
  ownerReviews,
  sessions,
  users,
  wishlistItems,
  type ReviewStatus,
} from "@/db/schema";
import { DEFAULT_PREFERENCES, type UserPreferences } from "@/lib/action-result";
import { LEAD_TYPE_LABEL } from "@/lib/leads";
import { INDICATIVE_NOTE, INS_INTENT_LABEL, INS_QUOTE_AUTH_SHORT, quoteDisplayStatus } from "@/insurance/labels";
import { currentSessionId } from "@/server/auth";
import { todayISO } from "@/server/validation";
import { CUSTOMER_QUOTE_STATUS, customerEnquiryStatus } from "@/server/customer/insurance";
import { getCustomerEnquiries, getCustomerTestDrives } from "@/server/customer/requests";
import type { BadgeTone } from "@/components/portal/ui";
import { getSavedCars } from "./saved";

/* ──────────────────────────────────────────────────────────────
   The signed-in customer's own account: sessions, reviews,
   preferences and the "download my data" export. Every query is
   scoped by the customer's user id — never by email or mobile.
   ────────────────────────────────────────────────────────────── */

/* ── Sessions ───────────────────────────────────────────────── */

/** "Edge on Windows" from a user agent, and whether it's a phone. */
export function describeDevice(ua: string | null) {
  if (!ua) return { label: "Unknown device", mobile: false };
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /SamsungBrowser\//.test(ua)
        ? "Samsung Internet"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Firefox\//.test(ua)
            ? "Firefox"
            : /Safari\//.test(ua)
              ? "Safari"
              : "Browser";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return { label: os ? `${browser} on ${os}` : browser, mobile: /Mobile|Android|iPhone/.test(ua) };
}

/**
 * Sessions store the SHA-256 of the cookie token. The browser only ever gets a short prefix of it,
 * which is enough to pick one of the customer's own sessions (always matched together with the user id).
 */
export const sessionKey = (id: string) => id.slice(0, 16);

export interface CustomerSession {
  key: string;
  device: string;
  mobile: boolean;
  ip: string | null;
  started: string;
  expires: string;
  current: boolean;
}

/** The customer's sessions that are still valid, this browser first. */
export async function getCustomerSessions(userId: number): Promise<CustomerSession[]> {
  const [rows, mine] = await Promise.all([
    getDb()
      .select({ id: sessions.id, createdAt: sessions.createdAt, expiresAt: sessions.expiresAt, userAgent: sessions.userAgent, ip: sessions.ip })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date())))
      .orderBy(desc(sessions.createdAt)),
    currentSessionId("customer"),
  ]);
  return rows
    .map((s) => {
      const d = describeDevice(s.userAgent);
      return { key: sessionKey(s.id), device: d.label, mobile: d.mobile, ip: s.ip, started: s.createdAt.toISOString(), expires: s.expiresAt.toISOString(), current: s.id === mine };
    })
    .sort((a, b) => Number(b.current) - Number(a.current));
}

/* ── Reviews ────────────────────────────────────────────────── */

export const REVIEW_STATUS_VIEW: Record<ReviewStatus, { label: string; tone: BadgeTone; note: string }> = {
  pending: { label: "Awaiting moderation", tone: "amber", note: "Our team checks every review before it's published — usually within two working days." },
  approved: { label: "Published", tone: "green", note: "Live on the car's page." },
  rejected: { label: "Not published", tone: "neutral", note: "It didn't meet our review guidelines, so it isn't shown on the site." },
};

export interface MyReview {
  id: string;
  carSlug: string;
  car: string;
  image: string | null;
  focus: string | null;
  /** The car's page, while the car is published. */
  href: string | null;
  variant: string;
  ownedFor: string;
  kmDriven: number;
  rating: number;
  title: string;
  body: string;
  date: string;
  helpful: number;
  status: ReviewStatus;
}

/** Owner reviews this customer wrote while signed in, newest first. */
export async function getMyReviews(userId: number): Promise<MyReview[]> {
  const rows = await getDb()
    .select({
      id: ownerReviews.id,
      carSlug: ownerReviews.carSlug,
      carName: cars.name,
      carStatus: cars.status,
      images: cars.images,
      focus: cars.focus,
      brand: brands.name,
      brandActive: brands.isActive,
      variant: ownerReviews.variant,
      ownedFor: ownerReviews.ownedFor,
      kmDriven: ownerReviews.kmDriven,
      rating: ownerReviews.rating,
      title: ownerReviews.title,
      body: ownerReviews.body,
      date: ownerReviews.date,
      helpful: ownerReviews.helpful,
      status: ownerReviews.status,
    })
    .from(ownerReviews)
    .innerJoin(cars, eq(cars.slug, ownerReviews.carSlug))
    .leftJoin(brands, eq(brands.slug, cars.brand))
    .where(eq(ownerReviews.userId, userId))
    .orderBy(desc(ownerReviews.createdAt))
    .limit(100);
  return rows.map((r) => {
    const listed = r.carStatus === "published" && r.brandActive !== false;
    return {
      id: r.id,
      carSlug: r.carSlug,
      car: [r.brand, r.carName].filter(Boolean).join(" "),
      image: listed ? (r.images[0] ?? null) : null,
      focus: r.focus,
      href: listed ? `/cars/${r.carSlug}` : null,
      variant: r.variant,
      ownedFor: r.ownedFor,
      kmDriven: r.kmDriven,
      rating: r.rating,
      title: r.title,
      body: r.body,
      date: r.date,
      helpful: r.helpful,
      status: r.status,
    };
  });
}

/** Catalogue models in the customer's garage — offered as "review your car" shortcuts. */
export async function getGarageModels(userId: number) {
  const rows = await getDb()
    .select({ model: customerVehicles.model, brandName: customerVehicles.brandName, modelName: customerVehicles.modelName })
    .from(customerVehicles)
    .where(eq(customerVehicles.userId, userId));
  const seen = new Set<string>();
  return rows.filter((r): r is typeof r & { model: string } => Boolean(r.model) && !seen.has(r.model!) && Boolean(seen.add(r.model!)));
}

/* ── Preferences ────────────────────────────────────────────── */

/** The customer's alert and contact preferences; `chosen` is false until they've saved them once. */
export async function getPreferences(userId: number): Promise<{ preferences: UserPreferences; chosen: boolean }> {
  const [row] = await getDb().select({ preferences: users.preferences }).from(users).where(eq(users.id, userId));
  const p = row?.preferences as Partial<UserPreferences> | null | undefined;
  // Only a customer-shaped object counts (the column is shared with the partner portals' settings).
  if (!p || typeof p !== "object" || !p.alerts || !p.contact) return { preferences: DEFAULT_PREFERENCES, chosen: false };
  return { preferences: { alerts: { ...DEFAULT_PREFERENCES.alerts, ...p.alerts }, contact: p.contact }, chosen: true };
}

/* ── Download my data ───────────────────────────────────────── */

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/** A copy of a row without some of its columns. */
function omit<T extends object, K extends keyof T>(row: T, ...keys: K[]): Omit<T, K> {
  return Object.fromEntries(Object.entries(row).filter(([k]) => !keys.includes(k as K))) as Omit<T, K>;
}

/**
 * Everything MarchGear holds about this customer that they can see in their account, as plain JSON.
 * Internal notes (staff, dealer and insurer timelines) aren't part of it.
 */
export async function buildDataExport(userId: number) {
  const db = getDb();
  const [[u], prefs, saved, wishlist, garage, siteLeads, enquiries, drives, reviews, notes, active, ins] = await Promise.all([
    db
      .select({ name: users.name, email: users.email, phone: users.phone, state: users.state, city: users.city, createdAt: users.createdAt, lastLoginAt: users.lastLoginAt })
      .from(users)
      .where(eq(users.id, userId)),
    getPreferences(userId),
    getSavedCars(userId),
    db.select().from(wishlistItems).where(eq(wishlistItems.userId, userId)),
    db.select().from(customerVehicles).where(eq(customerVehicles.userId, userId)).orderBy(desc(customerVehicles.createdAt)),
    db
      .select({
        id: leads.id,
        reference: leads.reference,
        type: leads.type,
        status: leads.status,
        name: leads.name,
        email: leads.email,
        phone: leads.phone,
        city: leads.city,
        subject: leads.subject,
        carSlug: leads.carSlug,
        usedCarId: leads.usedCarId,
        dealerId: leads.dealerId,
        dealerName: dealers.name,
        message: leads.message,
        details: leads.details,
        createdAt: leads.createdAt,
      })
      .from(leads)
      .leftJoin(dealers, eq(dealers.id, leads.dealerId))
      .where(eq(leads.userId, userId))
      .orderBy(desc(leads.createdAt)),
    // The same customer-friendly statuses the account shows (dealer progress included).
    getCustomerEnquiries(userId),
    getCustomerTestDrives(userId),
    db
      .select({ id: ownerReviews.id, carSlug: ownerReviews.carSlug, variant: ownerReviews.variant, ownedFor: ownerReviews.ownedFor, kmDriven: ownerReviews.kmDriven, rating: ownerReviews.rating, ratings: ownerReviews.ratings, title: ownerReviews.title, body: ownerReviews.body, name: ownerReviews.name, city: ownerReviews.city, date: ownerReviews.date, status: ownerReviews.status, helpful: ownerReviews.helpful })
      .from(ownerReviews)
      .where(eq(ownerReviews.userId, userId))
      .orderBy(desc(ownerReviews.createdAt)),
    db.select().from(customerNotifications).where(eq(customerNotifications.userId, userId)).orderBy(desc(customerNotifications.createdAt)),
    getCustomerSessions(userId),
    db
      .select({
        id: insEnquiries.id,
        reference: insEnquiries.reference,
        intent: insEnquiries.intent,
        insurer: insVendors.brandName,
        name: insEnquiries.name,
        mobile: insEnquiries.mobile,
        email: insEnquiries.email,
        regNumber: insEnquiries.regNumber,
        vehicleIsNew: insEnquiries.vehicleIsNew,
        brandName: insEnquiries.brandName,
        modelName: insEnquiries.modelName,
        variantName: insEnquiries.variantName,
        year: insEnquiries.year,
        fuel: insEnquiries.fuel,
        city: insEnquiries.city,
        state: insEnquiries.state,
        policyStatus: insEnquiries.policyStatus,
        policyExpiry: insEnquiries.policyExpiry,
        previousInsurer: insEnquiries.previousInsurer,
        ncbPct: insEnquiries.ncbPct,
        claimedLastYear: insEnquiries.claimedLastYear,
        addOns: insEnquiries.addOns,
        idv: insEnquiries.idv,
        indicativePremium: insEnquiries.indicativePremium,
        message: insEnquiries.message,
        status: insEnquiries.status,
        consentAt: insEnquiries.consentAt,
        policyIssuedAt: insEnquiries.policyIssuedAt,
        policyNumber: insEnquiries.policyNumber,
        policyPremium: insEnquiries.policyPremium,
        conversionVerifiedAt: insEnquiries.conversionVerifiedAt,
        createdAt: insEnquiries.createdAt,
      })
      .from(insEnquiries)
      .leftJoin(insVendors, eq(insVendors.id, insEnquiries.vendorId))
      .where(eq(insEnquiries.userId, userId))
      .orderBy(desc(insEnquiries.createdAt)),
  ]);

  const insIds = ins.map((e) => e.id);
  const quotes = insIds.length
    ? await db
        .select({
          enquiryId: insQuotes.enquiryId,
          reference: insQuotes.reference,
          status: insQuotes.status,
          authorization: insQuotes.authorization,
          insurerQuoteRef: insQuotes.insurerQuoteRef,
          idv: insQuotes.idv,
          total: insQuotes.total,
          validUntil: insQuotes.validUntil,
          viewedAt: insQuotes.viewedAt,
          submittedAt: insQuotes.submittedAt,
          respondedAt: insQuotes.respondedAt,
          shareToken: insQuotes.shareToken,
        })
        .from(insQuotes)
        .where(and(inArray(insQuotes.enquiryId, insIds), ne(insQuotes.status, "draft")))
    : [];
  const today = todayISO();
  const enquiryByRef = new Map(enquiries.map((e) => [e.reference, e]));
  const savedByKey = new Map(saved.map((s) => [`${s.kind}:${s.itemId}`, s]));

  return {
    exportedAt: new Date().toISOString(),
    about:
      "Your MarchGear account data, as shown in your account. Times are in UTC (ISO 8601). Internal notes made by MarchGear staff, dealerships and insurers are not included. Your compare list and chosen city are kept only in your browser and aren't stored on our servers.",
    profile: u ? { name: u.name, email: u.email, mobile: u.phone, state: u.state, city: u.city, memberSince: iso(u.createdAt), lastSignIn: iso(u.lastLoginAt) } : null,
    preferences: { ...prefs.preferences, savedByYou: prefs.chosen },
    savedCars: wishlist.map((w) => {
      const s = savedByKey.get(`${w.kind}:${w.itemId}`);
      return { kind: w.kind === "cars" ? "new" : "used", id: w.itemId, title: s?.title ?? null, availability: s?.state ?? null, savedAt: iso(w.createdAt) };
    }),
    garage: garage.map((v) => ({ ...omit(v, "userId"), createdAt: iso(v.createdAt), updatedAt: iso(v.updatedAt) })),
    enquiries: siteLeads.map((l) => {
      const e = enquiryByRef.get(l.reference);
      return {
        ...omit(l, "id"),
        type: LEAD_TYPE_LABEL[l.type] ?? l.type,
        status: e?.status.label ?? null,
        handledBy: e?.dealerName ?? null,
        createdAt: iso(l.createdAt),
        lastUpdate: e?.updatedAt ?? null,
      };
    }),
    testDrives: drives.map((d) => ({
      reference: d.reference,
      enquiry: d.enquiryReference,
      car: d.car,
      dealership: d.dealerName,
      showroom: d.showroom,
      address: d.showroomAddress,
      when: d.when,
      whenLabel: d.whenLabel,
      confirmedByDealer: d.confirmed,
      status: d.status.label,
    })),
    insuranceRequests: ins.map((e) => ({
      ...omit(e, "id", "consentAt", "policyIssuedAt", "conversionVerifiedAt", "createdAt", "indicativePremium", "policyNumber", "policyPremium"),
      intent: INS_INTENT_LABEL[e.intent] ?? e.intent,
      status: customerEnquiryStatus(e.status, Boolean(e.conversionVerifiedAt)).label,
      indicativePremium: e.indicativePremium === null ? null : { amount: e.indicativePremium, note: INDICATIVE_NOTE },
      quotes: quotes
        .filter((q) => q.enquiryId === e.id)
        .map((q) => ({
          reference: q.reference,
          label: INS_QUOTE_AUTH_SHORT[q.authorization],
          insurerQuoteRef: q.insurerQuoteRef,
          idv: q.idv,
          total: q.total,
          validUntil: q.validUntil,
          status: CUSTOMER_QUOTE_STATUS[quoteDisplayStatus(q, today)].label,
          link: `/insurance/quote/${q.shareToken}`,
          sentAt: iso(q.submittedAt),
          respondedAt: iso(q.respondedAt),
        })),
      policy: e.policyIssuedAt
        ? { number: e.policyNumber, premium: e.policyPremium, issuedAt: iso(e.policyIssuedAt), basis: e.conversionVerifiedAt ? "Verified by MarchGear" : "Reported by the insurer" }
        : null,
      consentGivenAt: iso(e.consentAt),
      createdAt: iso(e.createdAt),
    })),
    reviews: reviews.map((r) => ({ ...r, status: r.status === "approved" ? "Published" : r.status === "pending" ? "Awaiting moderation" : "Not published" })),
    notifications: notes.map((n) => ({ ...omit(n, "userId"), readAt: iso(n.readAt), createdAt: iso(n.createdAt) })),
    signedInDevices: active.map((s) => ({ device: s.device, ip: s.ip, signedIn: s.started, expires: s.expires, thisBrowser: s.current })),
  };
}

/** How many records of each kind the account holds — for the privacy page. */
export async function getDataSummary(userId: number) {
  const db = getDb();
  const n = (rows: { n: number }[]) => Number(rows[0]?.n ?? 0);
  const [saved, garage, enquiries, drives, insurance, reviews, notifications] = await Promise.all([
    db.select({ n: count() }).from(wishlistItems).where(eq(wishlistItems.userId, userId)),
    db.select({ n: count() }).from(customerVehicles).where(eq(customerVehicles.userId, userId)),
    db.select({ n: count() }).from(leads).where(eq(leads.userId, userId)),
    // Counted the way the Test drives page lists them (dealer bookings and requests MarchGear is arranging).
    getCustomerTestDrives(userId),
    db.select({ n: count() }).from(insEnquiries).where(eq(insEnquiries.userId, userId)),
    db.select({ n: count() }).from(ownerReviews).where(eq(ownerReviews.userId, userId)),
    db.select({ n: count() }).from(customerNotifications).where(eq(customerNotifications.userId, userId)),
  ]);
  return {
    saved: n(saved),
    garage: n(garage),
    enquiries: n(enquiries),
    testDrives: drives.length,
    insurance: n(insurance),
    reviews: n(reviews),
    notifications: n(notifications),
  };
}
