import "server-only";
import { and, count, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { articles, cars, leads, ownerReviews, subscribers, usedCars, users, type LeadType } from "@/db/schema";
import { requireStaff } from "@/server/auth";
import { todayISO } from "@/server/validation";

const IST_OFFSET_MIN = 330;
const DAY = 86_400_000;

/** Midnight IST for a date offset in days from today, as a UTC Date. */
function istMidnight(daysAgo = 0) {
  const [y, m, d] = todayISO().split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - IST_OFFSET_MIN * 60_000 - daysAgo * DAY);
}

export async function getDashboard() {
  await requireStaff();
  const db = getDb();
  const today = istMidnight(0);
  const weekAgo = istMidnight(6);
  const twoWeeksAgo = istMidnight(13);
  const monthAgo = istMidnight(29);
  const n = (rows: { n: number }[]) => rows[0]?.n ?? 0;
  const istDay = sql<string>`DATE(DATE_ADD(${leads.createdAt}, INTERVAL ${IST_OFFSET_MIN} MINUTE))`;

  const [
    newLeads,
    leadsToday,
    leadsWeek,
    leadsPrevWeek,
    customers,
    subscriberCount,
    activeUsed,
    liveCars,
    pendingReviews,
    liveArticles,
    perDay,
    byType,
    recent,
    pdi,
  ] = await Promise.all([
    db.select({ n: count() }).from(leads).where(eq(leads.status, "new")),
    db.select({ n: count() }).from(leads).where(gte(leads.createdAt, today)),
    db.select({ n: count() }).from(leads).where(gte(leads.createdAt, weekAgo)),
    db.select({ n: count() }).from(leads).where(and(gte(leads.createdAt, istMidnight(13)), lt(leads.createdAt, weekAgo))),
    db.select({ n: count() }).from(users).where(eq(users.role, "customer")),
    db.select({ n: count() }).from(subscribers),
    db.select({ n: count() }).from(usedCars).where(eq(usedCars.status, "active")),
    db.select({ n: count() }).from(cars).where(eq(cars.status, "published")),
    db.select({ n: count() }).from(ownerReviews).where(eq(ownerReviews.status, "pending")),
    db.select({ n: count() }).from(articles).where(eq(articles.status, "published")),
    db.select({ day: istDay, n: count() }).from(leads).where(gte(leads.createdAt, twoWeeksAgo)).groupBy(istDay),
    db.select({ type: leads.type, n: count() }).from(leads).where(gte(leads.createdAt, monthAgo)).groupBy(leads.type).orderBy(desc(count())),
    db
      .select({ id: leads.id, reference: leads.reference, type: leads.type, status: leads.status, name: leads.name, subject: leads.subject, createdAt: leads.createdAt })
      .from(leads)
      .orderBy(desc(leads.createdAt))
      .limit(8),
    db
      .select({ id: leads.id, type: leads.type, name: leads.name, subject: leads.subject, city: leads.city, details: leads.details, status: leads.status })
      .from(leads)
      .where(and(inArray(leads.type, ["pdi_booking", "pdi_checklist"] as LeadType[]), gte(leads.createdAt, istMidnight(120))))
      .orderBy(desc(leads.createdAt))
      .limit(300),
  ]);

  // Fill in days with no leads so the chart has 14 bars.
  const counts = new Map(perDay.map((r) => [String(r.day).slice(0, 10), r.n]));
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(istMidnight(13 - i).getTime() + IST_OFFSET_MIN * 60_000);
    const key = d.toISOString().slice(0, 10);
    return { key, label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }), n: counts.get(key) ?? 0 };
  });

  const todayKey = todayISO();
  const deliveries = pdi
    .map((l) => ({ ...l, delivery: typeof l.details?.deliveryDate === "string" ? l.details.deliveryDate : null }))
    .filter((l): l is typeof l & { delivery: string } => Boolean(l.delivery && l.delivery >= todayKey))
    .sort((a, b) => a.delivery.localeCompare(b.delivery))
    .slice(0, 8);

  return {
    kpis: {
      newLeads: n(newLeads),
      leadsToday: n(leadsToday),
      leadsWeek: n(leadsWeek),
      leadsPrevWeek: n(leadsPrevWeek),
      customers: n(customers),
      subscribers: n(subscriberCount),
      activeUsed: n(activeUsed),
      liveCars: n(liveCars),
      pendingReviews: n(pendingReviews),
      liveArticles: n(liveArticles),
    },
    days,
    byType,
    recent,
    deliveries,
  };
}
