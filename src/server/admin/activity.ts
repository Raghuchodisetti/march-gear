import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, like, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { articles, auditLog, authors, brands, cars, dealerReviews, dealers, leads, ownerReviews, upcomingCars, usedCars, users } from "@/db/schema";
import { BLOCK_KEYS } from "@/content/registry";
import { requireStaff } from "@/server/auth";

/** Areas of the panel as the activity log names them (audit_log.entity → label). */
export const ACTIVITY_AREAS: Record<string, string> = {
  lead: "Leads",
  owner_review: "Owner reviews",
  dealer_review: "Dealer reviews",
  brand: "Brands",
  car: "New cars",
  upcoming: "Upcoming launches",
  used_car: "Used cars",
  dealer: "Dealers",
  article: "News & reviews",
  author: "Authors",
  content: "Site content",
  media: "Media library",
  subscriber: "Subscribers",
  user: "Accounts",
  session: "Sign-ins",
};

export const ACTIVITY_PAGE_SIZE = 50;

export interface ActivityFilters {
  /** audit_log.entity */
  area?: string;
  /** A staff user id, or "none" for entries whose account has since been deleted. */
  user?: string;
  q?: string;
  page?: number;
}

const term = (q: string) => `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;

function where(f: ActivityFilters) {
  const conds: SQL[] = [];
  if (f.area && /^[a-z_]{1,40}$/.test(f.area)) conds.push(eq(auditLog.entity, f.area));
  if (f.user === "none") conds.push(isNull(auditLog.userId));
  else if (f.user && /^\d+$/.test(f.user)) conds.push(eq(auditLog.userId, Number(f.user)));
  if (f.q) conds.push(like(auditLog.summary, term(f.q)));
  return conds.length ? and(...conds) : undefined;
}

const columns = {
  id: auditLog.id,
  action: auditLog.action,
  entity: auditLog.entity,
  entityId: auditLog.entityId,
  summary: auditLog.summary,
  createdAt: auditLog.createdAt,
  userId: auditLog.userId,
  userName: users.name,
};

type Row = { action: string; entity: string; entityId: string | null };

/* Where each kind of record is edited. Reviews have no page of their own, so they link to their row on the list. */
const HREF: Record<string, (id: string) => string> = {
  lead: (id) => `/admin/leads/${id}`,
  brand: (id) => `/admin/brands/${id}`,
  car: (id) => `/admin/cars/${id}`,
  upcoming: (id) => `/admin/upcoming/${id}`,
  article: (id) => `/admin/news/${id}`,
  user: (id) => `/admin/users/${id}`,
  session: (id) => `/admin/users/${id}`,
  used_car: (id) => `/admin/used-cars/${encodeURIComponent(id)}`,
  dealer: (id) => `/admin/showrooms/${encodeURIComponent(id)}`,
  author: (id) => `/admin/authors/${encodeURIComponent(id)}`,
  owner_review: (id) => `/admin/reviews?kind=owner#review-${encodeURIComponent(id)}`,
  dealer_review: (id) => `/admin/reviews?kind=dealer#review-${encodeURIComponent(id)}`,
};
const NUMERIC_IDS = new Set(["lead", "brand", "car", "upcoming", "article", "user", "session"]);
const ADMIN_ONLY = new Set(["user", "session"]);

/** Which of these record ids still exist. */
async function existingIds(entity: string, ids: string[]): Promise<string[]> {
  const db = getDb();
  const nums = ids.map(Number);
  const pick = async (q: Promise<{ id: string | number }[]>) => (await q).map((r) => String(r.id));
  switch (entity) {
    case "lead":
      return pick(db.select({ id: leads.id }).from(leads).where(inArray(leads.id, nums)));
    case "brand":
      return pick(db.select({ id: brands.id }).from(brands).where(inArray(brands.id, nums)));
    case "car":
      return pick(db.select({ id: cars.id }).from(cars).where(inArray(cars.id, nums)));
    case "upcoming":
      return pick(db.select({ id: upcomingCars.id }).from(upcomingCars).where(inArray(upcomingCars.id, nums)));
    case "article":
      return pick(db.select({ id: articles.id }).from(articles).where(inArray(articles.id, nums)));
    case "user":
    case "session":
      return pick(db.select({ id: users.id }).from(users).where(inArray(users.id, nums)));
    case "used_car":
      return pick(db.select({ id: usedCars.id }).from(usedCars).where(inArray(usedCars.id, ids)));
    case "dealer":
      return pick(db.select({ id: dealers.id }).from(dealers).where(inArray(dealers.id, ids)));
    case "author":
      return pick(db.select({ id: authors.id }).from(authors).where(inArray(authors.id, ids)));
    case "owner_review":
      return pick(db.select({ id: ownerReviews.id }).from(ownerReviews).where(inArray(ownerReviews.id, ids)));
    case "dealer_review":
      return pick(db.select({ id: dealerReviews.id }).from(dealerReviews).where(inArray(dealerReviews.id, ids)));
    default:
      return [];
  }
}

/** Adds a link to each entry whose record still exists (and that the viewer may open). */
async function withLinks<T extends Row>(rows: T[], isAdmin: boolean): Promise<(T & { href: string | null })[]> {
  const wanted = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.entityId || !HREF[r.entity] || (ADMIN_ONLY.has(r.entity) && !isAdmin)) continue;
    if (NUMERIC_IDS.has(r.entity) && !/^\d+$/.test(r.entityId)) continue;
    if (!wanted.has(r.entity)) wanted.set(r.entity, new Set());
    wanted.get(r.entity)!.add(r.entityId);
  }
  const found = new Map<string, Set<string>>();
  await Promise.all([...wanted].map(async ([entity, ids]) => found.set(entity, new Set(await existingIds(entity, [...ids])))));
  const blocks = new Set<string>(BLOCK_KEYS);
  return rows.map((r) => {
    let href: string | null = null;
    const key = r.entityId;
    if (key && found.get(r.entity)?.has(key)) href = HREF[r.entity](key);
    else if (r.entity === "content" && key && blocks.has(key)) href = `/admin/content/${key}`;
    else if (r.entity === "media" && r.action !== "delete") href = "/admin/media";
    return { ...r, href };
  });
}

export async function listActivity(f: ActivityFilters) {
  const me = await requireStaff();
  const db = getDb();
  const w = where(f);
  const [{ total }] = await db.select({ total: count() }).from(auditLog).where(w);
  // A ?page= past the end shows the last page rather than an empty one.
  const page = Math.min(Math.max(1, f.page ?? 1), Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE)));
  const rows = await db
    .select(columns)
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.userId))
    .where(w)
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(ACTIVITY_PAGE_SIZE)
    .offset((page - 1) * ACTIVITY_PAGE_SIZE);
  return { rows: await withLinks(rows, me.role === "admin"), total, page };
}

/** The latest few entries, for the dashboard. */
export async function recentActivity(limit = 8) {
  const me = await requireStaff();
  const rows = await getDb()
    .select(columns)
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.userId))
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(limit);
  return withLinks(rows, me.role === "admin");
}

/** Filter options: the areas and the people that actually appear in the log. */
export async function activityFilterOptions() {
  await requireStaff();
  const db = getDb();
  const [areas, people] = await Promise.all([
    db.selectDistinct({ entity: auditLog.entity }).from(auditLog),
    db
      .selectDistinct({ id: auditLog.userId, name: users.name })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.userId))
      .orderBy(asc(users.name)),
  ]);
  const known = Object.keys(ACTIVITY_AREAS);
  const areaKeys = [...new Set([...known, ...areas.map((a) => a.entity)])];
  return {
    areas: areaKeys.map((value) => ({ value, label: ACTIVITY_AREAS[value] ?? value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) })),
    people: people.map((p) => (p.id === null ? { value: "none", label: "Deleted accounts" } : { value: String(p.id), label: p.name ?? `User #${p.id}` })),
  };
}
