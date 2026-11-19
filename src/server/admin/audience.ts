import "server-only";
import { and, asc, count, desc, eq, like, or, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { REVIEW_STATUS, USER_ROLES, brands, cars, dealerReviews, dealers, leads, ownerReviews, subscribers, users, wishlistItems, type ReviewStatus, type UserRole } from "@/db/schema";
import { requireStaff } from "@/server/auth";

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

export async function listUsers(q?: string, role?: string, page = 1) {
  await requireStaff(["admin"]);
  const db = getDb();
  const conds: SQL[] = [];
  if (q) conds.push(or(like(users.name, term(q)), like(users.email, term(q)), like(users.phone, term(q)))!);
  if (role && (USER_ROLES as readonly string[]).includes(role)) conds.push(eq(users.role, role as UserRole));
  const where = conds.length ? and(...conds) : undefined;
  const [{ total }] = await db.select({ total: count() }).from(users).where(where);
  // A ?page= past the end shows the last page rather than an empty one.
  const current = Math.min(Math.max(1, page), Math.max(1, Math.ceil(total / USERS_PAGE_SIZE)));
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email, phone: users.phone, city: users.city, role: users.role, isActive: users.isActive, createdAt: users.createdAt, lastLoginAt: users.lastLoginAt })
    .from(users)
    .where(where)
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(USERS_PAGE_SIZE)
    .offset((current - 1) * USERS_PAGE_SIZE);
  return { rows, total, page: current };
}

export async function getUserDetail(id: number) {
  await requireStaff(["admin"]);
  const db = getDb();
  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email, phone: users.phone, city: users.city, role: users.role, isActive: users.isActive, createdAt: users.createdAt, lastLoginAt: users.lastLoginAt })
    .from(users)
    .where(eq(users.id, id));
  if (!user) return null;
  const [userLeads, [{ saved }]] = await Promise.all([
    db
      .select({ id: leads.id, reference: leads.reference, type: leads.type, status: leads.status, subject: leads.subject, createdAt: leads.createdAt })
      .from(leads)
      .where(eq(leads.userId, id))
      .orderBy(desc(leads.createdAt))
      .limit(50),
    db.select({ saved: count() }).from(wishlistItems).where(eq(wishlistItems.userId, id)),
  ]);
  return { user, leads: userLeads, saved };
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
