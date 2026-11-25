import "server-only";
import { and, asc, count, desc, eq, gt, inArray, like, or, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import {
  REVIEW_STATUS,
  brands,
  cars,
  dealerReviews,
  dealers,
  insMembers,
  insVendors,
  leads,
  ownerReviews,
  partnerMembers,
  partners,
  sessions,
  subscribers,
  usedCars,
  users,
  wishlistItems,
  type ReviewStatus,
  type UserRole,
} from "@/db/schema";
import { LEGACY_BRANDS } from "@/lib/catalog";
import { currentSessionId, getDesk, requireStaff } from "@/server/auth";
import { ACCOUNT_KINDS } from "@/lib/accounts";

const term = (q: string) => `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;

export async function listOwnerReviews(status?: string) {
  await requireStaff();
  const st = status && (REVIEW_STATUS as readonly string[]).includes(status) ? (status as ReviewStatus) : undefined;
  return getDb()
    .select({
      id: ownerReviews.id,
      name: ownerReviews.name,
      city: ownerReviews.city,
      rating: ownerReviews.rating,
      title: ownerReviews.title,
      body: ownerReviews.body,
      date: ownerReviews.date,
      status: ownerReviews.status,
      carSlug: ownerReviews.carSlug,
      car: cars.name,
      brand: brands.name,
    })
    .from(ownerReviews)
    .innerJoin(cars, eq(cars.slug, ownerReviews.carSlug))
    .innerJoin(brands, eq(brands.slug, cars.brand))
    .where(st ? eq(ownerReviews.status, st) : undefined)
    .orderBy(desc(ownerReviews.createdAt), desc(ownerReviews.date))
    .limit(300);
}

export async function listDealerReviews(status?: string) {
  await requireStaff();
  const st = status && (REVIEW_STATUS as readonly string[]).includes(status) ? (status as ReviewStatus) : undefined;
  return getDb()
    .select({
      id: dealerReviews.id,
      name: dealerReviews.name,
      visit: dealerReviews.visit,
      rating: dealerReviews.rating,
      title: dealerReviews.title,
      body: dealerReviews.body,
      date: dealerReviews.date,
      status: dealerReviews.status,
      dealerId: dealerReviews.dealerId,
      dealer: dealers.name,
    })
    .from(dealerReviews)
    .innerJoin(dealers, eq(dealers.id, dealerReviews.dealerId))
    .where(st ? eq(dealerReviews.status, st) : undefined)
    .orderBy(desc(dealerReviews.date))
    .limit(300);
}

export async function reviewCounts() {
  await requireStaff();
  const db = getDb();
  const [o, d] = await Promise.all([
    db.select({ status: ownerReviews.status, n: count() }).from(ownerReviews).groupBy(ownerReviews.status),
    db.select({ status: dealerReviews.status, n: count() }).from(dealerReviews).groupBy(dealerReviews.status),
  ]);
  const pick = (rows: { status: ReviewStatus; n: number }[]) => Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<Record<ReviewStatus, number>>;
  return { owner: pick(o), dealer: pick(d) };
}

export const USERS_PAGE_SIZE = 30;

/** Who a dealer or insurance vendor login belongs to (shown in their lists and on their page). */
export interface AccountOrg {
  name: string;
  /** Their organisation's page in the back office (/admin/…). */
  href: string;
  /** Their role inside it (owner, sales manager…). */
  memberRole: string;
}

/** Dealerships / insurance vendors of these accounts. */
async function orgsOf(kind: "dealer" | "insurer", ids: number[]): Promise<Map<number, AccountOrg>> {
  if (!ids.length) return new Map();
  const db = getDb();
  const rows =
    kind === "dealer"
      ? await db
          .select({ userId: partnerMembers.userId, id: partners.id, trade: partners.tradeName, legal: partners.legalName, ref: partners.reference, memberRole: partnerMembers.role })
          .from(partnerMembers)
          .innerJoin(partners, eq(partners.id, partnerMembers.partnerId))
          .where(inArray(partnerMembers.userId, ids))
      : await db
          .select({ userId: insMembers.userId, id: insVendors.id, trade: insVendors.brandName, legal: insVendors.legalName, ref: insVendors.reference, memberRole: insMembers.role })
          .from(insMembers)
          .innerJoin(insVendors, eq(insVendors.id, insMembers.vendorId))
          .where(inArray(insMembers.userId, ids));
  return new Map(
    rows.map((r) => [
      r.userId,
      {
        name: r.trade || r.legal || r.ref,
        href: kind === "dealer" ? `/admin/dealers/details?id=${r.id}` : `/admin/insurance/vendors/${r.id}`,
        memberRole: r.memberRole.replace(/_/g, " "),
      },
    ]),
  );
}

export type AccountListKind = "customer" | "dealer" | "insurer" | "team";

/** One kind of account, newest first, a page at a time — for whoever manages that kind. */
export async function listAccounts(kind: AccountListKind, q?: string, page = 1) {
  const roles: UserRole[] = kind === "team" ? ["admin", "staff"] : [kind];
  await requireStaff(ACCOUNT_KINDS[roles[0]].access);
  const db = getDb();
  const conds: SQL[] = [inArray(users.role, roles)];
  if (q) conds.push(or(like(users.name, term(q)), like(users.email, term(q)), like(users.phone, term(q)))!);
  const where = and(...conds);
  const [{ total }] = await db.select({ total: count() }).from(users).where(where);
  // A ?page= past the end shows the last page rather than an empty one.
  const current = Math.min(Math.max(1, page), Math.max(1, Math.ceil(total / USERS_PAGE_SIZE)));
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      city: users.city,
      role: users.role,
      permissions: users.permissions,
      isActive: users.isActive,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .where(where)
    .orderBy(kind === "team" ? asc(users.name) : desc(users.createdAt), desc(users.id))
    .limit(USERS_PAGE_SIZE)
    .offset((current - 1) * USERS_PAGE_SIZE);
  const orgs = kind === "dealer" || kind === "insurer" ? await orgsOf(kind, rows.map((r) => r.id)) : new Map<number, AccountOrg>();
  return { rows: rows.map((r) => ({ ...r, org: orgs.get(r.id) ?? null })), total, page: current };
}

/** Why a saved item can or can't be opened on the public site. */
export type SavedState = "live" | "draft" | "hidden" | "reserved" | "sold" | "gone";

export interface SavedItem {
  kind: "cars" | "used";
  itemId: string;
  savedAt: Date;
  title: string | null;
  /** Public page, when the item is still listed. */
  href: string | null;
  state: SavedState;
}

/** A customer's saved new and used cars, resolved against the catalogue — items may have been removed or unpublished since. */
async function savedItems(userId: number): Promise<SavedItem[]> {
  const db = getDb();
  const rows = await db.select().from(wishlistItems).where(eq(wishlistItems.userId, userId)).orderBy(desc(wishlistItems.createdAt));
  const carSlugs = rows.filter((r) => r.kind === "cars").map((r) => r.itemId);
  const usedIds = rows.filter((r) => r.kind === "used").map((r) => r.itemId);
  const [carRows, usedRows] = await Promise.all([
    carSlugs.length
      ? db
          .select({ slug: cars.slug, name: cars.name, status: cars.status, brand: brands.name, brandActive: brands.isActive })
          .from(cars)
          .leftJoin(brands, eq(brands.slug, cars.brand))
          .where(inArray(cars.slug, carSlugs))
      : Promise.resolve([]),
    usedIds.length
      ? db
          .select({ id: usedCars.id, name: usedCars.name, variant: usedCars.variant, year: usedCars.year, brand: usedCars.brand, brandName: brands.name, status: usedCars.status })
          .from(usedCars)
          .leftJoin(brands, eq(brands.slug, usedCars.brand))
          .where(inArray(usedCars.id, usedIds))
      : Promise.resolve([]),
  ]);
  const carBySlug = new Map(carRows.map((c) => [c.slug, c]));
  const usedById = new Map(usedRows.map((u) => [u.id, u]));
  return rows.map((r): SavedItem => {
    const base = { kind: r.kind, itemId: r.itemId, savedAt: r.createdAt };
    if (r.kind === "cars") {
      const c = carBySlug.get(r.itemId);
      if (!c) return { ...base, title: null, href: null, state: "gone" };
      const state: SavedState = c.status !== "published" ? "draft" : c.brandActive === false ? "hidden" : "live";
      return { ...base, title: [c.brand, c.name].filter(Boolean).join(" "), href: state === "live" ? `/cars/${c.slug}` : null, state };
    }
    const u = usedById.get(r.itemId);
    if (!u) return { ...base, title: null, href: null, state: "gone" };
    const state: SavedState = u.status === "active" ? "live" : u.status;
    const brand = u.brandName ?? LEGACY_BRANDS[u.brand] ?? u.brand;
    return { ...base, title: `${u.year} ${brand} ${u.name} ${u.variant}`, href: state === "live" ? `/used-cars/${encodeURIComponent(u.id)}` : null, state };
  });
}

/** Sessions that are still valid; `current` marks the browser making this request. */
async function activeSessions(userId: number) {
  // Staff are looking at this list from the admin, so "this browser" is the staff session.
  const mine = await currentSessionId(await getDesk());
  const rows = await getDb()
    .select({ id: sessions.id, createdAt: sessions.createdAt, expiresAt: sessions.expiresAt, userAgent: sessions.userAgent, ip: sessions.ip })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date())))
    .orderBy(desc(sessions.createdAt));
  // The session id is the token's hash — it stays on the server.
  return rows.map(({ id, ...s }) => ({ ...s, current: id === mine }));
}

export async function getUserDetail(id: number) {
  await requireStaff(["customers", "dealers", "insurance"]);
  const db = getDb();
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      state: users.state,
      city: users.city,
      role: users.role,
      permissions: users.permissions,
      isActive: users.isActive,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .where(eq(users.id, id));
  if (!user) return null;
  // Each kind of account belongs to its own section (staff and admins: admins only).
  await requireStaff(ACCOUNT_KINDS[user.role].access);
  const org = user.role === "dealer" || user.role === "insurer" ? ((await orgsOf(user.role, [user.id])).get(user.id) ?? null) : null;
  const [userLeads, saved, signedIn] = await Promise.all([
    db
      .select({ id: leads.id, reference: leads.reference, type: leads.type, status: leads.status, subject: leads.subject, createdAt: leads.createdAt })
      .from(leads)
      .where(eq(leads.userId, id))
      .orderBy(desc(leads.createdAt))
      .limit(50),
    savedItems(id),
    activeSessions(id),
  ]);
  return { user, org, leads: userLeads, saved, sessions: signedIn };
}

/** For the on-screen list (capped; use the CSV export for everything). */
export async function listSubscribers(q?: string) {
  await requireStaff();
  return getDb()
    .select()
    .from(subscribers)
    .where(q ? like(subscribers.email, term(q)) : undefined)
    .orderBy(desc(subscribers.createdAt), desc(subscribers.id))
    .limit(5000);
}

/** Every subscriber, oldest first — for the CSV export, which must not be cut short. */
export async function exportSubscribers() {
  await requireStaff();
  return getDb()
    .select({ email: subscribers.email, source: subscribers.source, createdAt: subscribers.createdAt })
    .from(subscribers)
    .orderBy(asc(subscribers.createdAt), asc(subscribers.id));
}

export const countSubscribers = async () => {
  await requireStaff();
  const [{ n }] = await getDb().select({ n: count() }).from(subscribers);
  return n;
};
