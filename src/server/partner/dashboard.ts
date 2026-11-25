import "server-only";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import {
  partnerActivity,
  partnerBrands,
  partnerEvents,
  partnerInvoices,
  partnerLeads,
  partnerMembers,
  partnerNotifications,
  partnerOffers,
  partnerShowrooms,
  partnerTestDrives,
  partnerVehicles,
  users,
} from "@/db/schema";
import type { CrmStatus } from "@/db/enums";
import { CRM_WON, offerDisplayStatus } from "@/partner/labels";
import type { PartnerContext } from "@/server/partner/context";
import { testDriveScope } from "@/server/partner/crm";
import { getCatalog } from "@/server/catalog";
import { needsCatalogueCount } from "@/server/partner/inventory";
import { todayISO } from "@/server/validation";
import { CRM_FINISHED } from "@/components/portal/crm/pipeline";
import { categoryOf, notificationVisible, type DealerNotificationPrefs } from "@/components/portal/notifications/categories";

/* ──────────────────────────────────────────────────────────────
   Read models for the dealer dashboard. Everything is scoped by
   the signed-in dealership, and enquiries/test drives by the
   member's own assignments when they can't see every enquiry.
   ────────────────────────────────────────────────────────────── */

const DAY = 86_400_000;
const IST_OFFSET_MIN = 330;
/** Lead statuses that no longer need a follow-up. */
export const CRM_DONE: CrmStatus[] = ["booking_completed", "converted", "lost", "closed"];

/** YYYY-MM-DD in IST for a UTC instant. */
const istDay = (d: Date) => new Date(d.getTime() + IST_OFFSET_MIN * 60_000).toISOString().slice(0, 10);

/** What a member may see of the dealership's enquiries. */
export function leadScope(ctx: PartnerContext): "all" | "own" | "none" {
  if (ctx.can("leads.view_all")) return "all";
  if (ctx.can("leads.view_own")) return "own";
  return "none";
}

function leadWhere(ctx: PartnerContext, ...extra: (SQL | undefined)[]) {
  const scope = leadScope(ctx);
  return and(eq(partnerLeads.partnerId, ctx.partner.id), scope === "own" ? eq(partnerLeads.assignedMemberId, ctx.member.id) : undefined, ...extra);
}

/** The same test drives the Test drives page shows this person (their own drives and drives on their enquiries). */
function driveWhere(ctx: PartnerContext, ...extra: (SQL | undefined)[]) {
  return and(testDriveScope(ctx), ...extra);
}

export interface PendingAction {
  key: string;
  tone: "red" | "amber" | "blue";
  title: string;
  detail: string;
  href: string;
  count: number;
}

export interface DashboardData {
  range: 14 | 30;
  scope: "all" | "own" | "none";
  show: { leads: boolean; inventory: boolean; offers: boolean; testDrives: boolean; billing: boolean; brands: boolean; profile: boolean; staff: boolean };
  kpi: {
    totalEnquiries: number;
    periodEnquiries: number;
    previousEnquiries: number;
    newEnquiries: number;
    activeListings: number;
    pendingVehicles: number;
    activeOffers: number;
    pendingOffers: number;
    testDriveRequests: number;
    profileViews: number;
    previousProfileViews: number;
    won: number;
    conversion: number | null;
    campaign: { offers: number; views: number; enquiries: number; conversions: number };
  };
  series: { day: string; count: number }[];
  topVehicles: { id: number; reference: string; title: string; kind: "new" | "used"; status: string; views: number; enquiries: number; image: string | null }[];
  recentLeads: { id: number; reference: string; name: string; carLabel: string | null; status: CrmStatus; source: string; createdAt: Date; assignee: string | null }[];
  campaigns: { id: number; reference: string; title: string; campaignName: string; status: string; startsAt: Date; endsAt: Date; views: number; enquiries: number }[];
  pending: PendingAction[];
  activity: { id: number; summary: string; entity: string; action: string; createdAt: Date; who: string | null }[];
  notifications: { id: number; title: string; body: string | null; href: string | null; kind: string; createdAt: Date; readAt: Date | null }[];
  setup: { key: string; label: string; done: boolean; href: string; perm: boolean }[];
}

export async function getDashboard(ctx: PartnerContext, range: 14 | 30): Promise<DashboardData> {
  const db = getDb();
  const pid = ctx.partner.id;
  const now = new Date();
  const scope = leadScope(ctx);
  const show = {
    leads: scope !== "none",
    inventory: ctx.can("inventory.view"),
    offers: ctx.can("offers.view"),
    testDrives: ctx.can("test_drives.manage"),
    billing: ctx.can("billing.manage"),
    brands: ctx.can("brands.manage"),
    profile: ctx.can("profile.manage"),
    staff: ctx.can("staff.manage"),
  };

  // Day buckets in IST: today and the (range − 1) days before it.
  const todayIst = todayISO();
  const startIst = new Date(`${todayIst}T00:00:00+05:30`).getTime() - (range - 1) * DAY;
  const periodStart = new Date(startIst);
  const previousStart = new Date(startIst - range * DAY);
  const istDate = sql<string>`DATE_FORMAT(DATE_ADD(${partnerLeads.createdAt}, INTERVAL ${IST_OFFSET_MIN} MINUTE), '%Y-%m-%d')`;
  const zero = Promise.resolve([{ n: 0 }]);

  const [
    [{ n: totalEnquiries }],
    [{ n: newEnquiries }],
    [{ n: periodEnquiries }],
    [{ n: previousEnquiries }],
    [{ n: won }],
    daily,
    [{ n: activeListings }],
    [{ n: pendingVehicles }],
    offerRows,
    [{ n: testDriveRequests }],
    [{ n: profileViews }],
    [{ n: previousProfileViews }],
    topVehicles,
    recentLeads,
  ] = await Promise.all([
    show.leads ? db.select({ n: count() }).from(partnerLeads).where(leadWhere(ctx)) : zero,
    show.leads ? db.select({ n: count() }).from(partnerLeads).where(leadWhere(ctx, eq(partnerLeads.status, "new"))) : zero,
    show.leads ? db.select({ n: count() }).from(partnerLeads).where(leadWhere(ctx, gte(partnerLeads.createdAt, periodStart))) : zero,
    show.leads ? db.select({ n: count() }).from(partnerLeads).where(leadWhere(ctx, gte(partnerLeads.createdAt, previousStart), lt(partnerLeads.createdAt, periodStart))) : zero,
    show.leads ? db.select({ n: count() }).from(partnerLeads).where(leadWhere(ctx, inArray(partnerLeads.status, CRM_WON))) : zero,
    show.leads
      ? db.select({ day: istDate, n: count() }).from(partnerLeads).where(leadWhere(ctx, gte(partnerLeads.createdAt, periodStart))).groupBy(istDate)
      : Promise.resolve([] as { day: string; n: number }[]),
    show.inventory ? db.select({ n: count() }).from(partnerVehicles).where(and(eq(partnerVehicles.partnerId, pid), eq(partnerVehicles.status, "published"))) : zero,
    // Only used cars wait for MarchGear's approval.
    show.inventory ? db.select({ n: count() }).from(partnerVehicles).where(and(eq(partnerVehicles.partnerId, pid), eq(partnerVehicles.kind, "used"), eq(partnerVehicles.status, "pending_approval"))) : zero,
    show.offers
      ? db
          .select({
            id: partnerOffers.id,
            reference: partnerOffers.reference,
            title: partnerOffers.title,
            campaignName: partnerOffers.campaignName,
            status: partnerOffers.status,
            startsAt: partnerOffers.startsAt,
            endsAt: partnerOffers.endsAt,
            views: partnerOffers.views,
            enquiries: partnerOffers.enquiries,
            conversions: partnerOffers.conversions,
          })
          .from(partnerOffers)
          .where(and(eq(partnerOffers.partnerId, pid), notInArray(partnerOffers.status, ["draft", "cancelled"])))
          .orderBy(asc(partnerOffers.startsAt))
          .limit(200)
      : Promise.resolve([]),
    show.testDrives ? db.select({ n: count() }).from(partnerTestDrives).where(driveWhere(ctx, eq(partnerTestDrives.status, "requested"))) : zero,
    db.select({ n: count() }).from(partnerEvents).where(and(eq(partnerEvents.partnerId, pid), eq(partnerEvents.kind, "profile_view"), gte(partnerEvents.createdAt, periodStart))),
    db
      .select({ n: count() })
      .from(partnerEvents)
      .where(and(eq(partnerEvents.partnerId, pid), eq(partnerEvents.kind, "profile_view"), gte(partnerEvents.createdAt, previousStart), lt(partnerEvents.createdAt, periodStart))),
    show.inventory
      ? db
          .select({
            id: partnerVehicles.id,
            reference: partnerVehicles.reference,
            kind: partnerVehicles.kind,
            brand: partnerVehicles.brand,
            model: partnerVehicles.model,
            variant: partnerVehicles.variant,
            year: partnerVehicles.year,
            status: partnerVehicles.status,
            views: partnerVehicles.views,
            enquiries: partnerVehicles.enquiries,
            images: partnerVehicles.images,
            modelSlug: partnerVehicles.modelSlug,
          })
          .from(partnerVehicles)
          .where(and(eq(partnerVehicles.partnerId, pid), inArray(partnerVehicles.status, ["published", "approved", "unpublished"])))
          .orderBy(desc(partnerVehicles.views), desc(partnerVehicles.enquiries))
          .limit(5)
      : Promise.resolve([]),
    show.leads
      ? db
          .select({
            id: partnerLeads.id,
            reference: partnerLeads.reference,
            name: partnerLeads.name,
            carLabel: partnerLeads.carLabel,
            status: partnerLeads.status,
            source: partnerLeads.source,
            createdAt: partnerLeads.createdAt,
            assignee: users.name,
          })
          .from(partnerLeads)
          .leftJoin(partnerMembers, eq(partnerMembers.id, partnerLeads.assignedMemberId))
          .leftJoin(users, eq(users.id, partnerMembers.userId))
          .where(leadWhere(ctx))
          .orderBy(desc(partnerLeads.createdAt))
          .limit(6)
      : Promise.resolve([]),
  ]);

  // Fill every day of the range so the chart has no gaps.
  const byDay = new Map(daily.map((d) => [d.day, Number(d.n)]));
  const series = Array.from({ length: range }, (_, i) => {
    const day = istDay(new Date(startIst + i * DAY + 12 * 3_600_000));
    return { day, count: byDay.get(day) ?? 0 };
  });

  const withStatus = offerRows.map((o) => ({ ...o, display: offerDisplayStatus(o, now) }));
  const live = withStatus.filter((o) => o.display === "active");
  const ran = withStatus.filter((o) => o.display === "active" || o.display === "expired" || o.display === "paused");
  const campaigns = [...withStatus.filter((o) => o.display === "scheduled"), ...live.sort((a, b) => a.endsAt.getTime() - b.endsAt.getTime())].slice(0, 4);

  const [pending, activity, notifications, setup, cat] = await Promise.all([pendingActions(ctx, show, now), recentActivity(ctx), latestNotifications(ctx), setupChecklist(ctx, show), getCatalog()]);

  return {
    range,
    scope,
    show,
    kpi: {
      totalEnquiries,
      periodEnquiries,
      previousEnquiries,
      newEnquiries,
      activeListings,
      pendingVehicles,
      activeOffers: live.length,
      pendingOffers: withStatus.filter((o) => o.status === "submitted" || o.status === "pending_approval").length,
      testDriveRequests,
      profileViews,
      previousProfileViews,
      won,
      conversion: totalEnquiries ? Math.round((won / totalEnquiries) * 1000) / 10 : null,
      campaign: {
        offers: ran.length,
        views: ran.reduce((s, o) => s + o.views, 0),
        enquiries: ran.reduce((s, o) => s + o.enquiries, 0),
        conversions: ran.reduce((s, o) => s + o.conversions, 0),
      },
    },
    series,
    topVehicles: topVehicles.map((v) => ({
      id: v.id,
      reference: v.reference,
      title: `${v.year} ${v.model} ${v.variant}`.trim(),
      kind: v.kind,
      status: v.status,
      views: v.views,
      enquiries: v.enquiries,
      // A new car's photo is the catalogue's.
      image: (v.kind === "new" ? (v.modelSlug ? cat.getCar(v.modelSlug)?.images[0] : undefined) : v.images[0]) ?? null,
    })),
    recentLeads,
    campaigns: campaigns.map((o) => ({ id: o.id, reference: o.reference, title: o.title, campaignName: o.campaignName, status: o.display, startsAt: o.startsAt, endsAt: o.endsAt, views: o.views, enquiries: o.enquiries })),
    pending,
    activity,
    notifications,
    setup,
  };
}

async function pendingActions(ctx: PartnerContext, show: DashboardData["show"], now: Date): Promise<PendingAction[]> {
  const db = getDb();
  const pid = ctx.partner.id;
  const today = todayISO();
  const soon = new Date(Date.now() + 30 * DAY + 5.5 * 3_600_000).toISOString().slice(0, 10);
  const zero = Promise.resolve([{ n: 0 }]);
  const [[{ n: vehicles }], [{ n: offers }], certs, [{ n: overdue }], [{ n: drives }], [{ n: invoices }], [{ n: unassigned }], uncatalogued] = await Promise.all([
    // Only people who can fix them are asked to.
    ctx.can("inventory.manage") ? db.select({ n: count() }).from(partnerVehicles).where(and(eq(partnerVehicles.partnerId, pid), eq(partnerVehicles.status, "changes_requested"))) : zero,
    ctx.can("offers.manage") ? db.select({ n: count() }).from(partnerOffers).where(and(eq(partnerOffers.partnerId, pid), eq(partnerOffers.status, "changes_requested"))) : zero,
    show.brands
      ? db
          .select({ brand: partnerBrands.brand, validUntil: partnerBrands.validUntil })
          .from(partnerBrands)
          .where(and(eq(partnerBrands.partnerId, pid), inArray(partnerBrands.status, ["approved", "expired"]), isNotNull(partnerBrands.validUntil), lte(partnerBrands.validUntil, soon)))
      : Promise.resolve([]),
    // Same rule as the enquiries list's "overdue" filter, so the count matches the list it links to.
    show.leads ? db.select({ n: count() }).from(partnerLeads).where(leadWhere(ctx, isNotNull(partnerLeads.followUpAt), lt(partnerLeads.followUpAt, now), notInArray(partnerLeads.status, CRM_FINISHED))) : zero,
    show.testDrives
      ? db
          .select({ n: count() })
          .from(partnerTestDrives)
          .where(driveWhere(ctx, eq(partnerTestDrives.status, "requested"), lt(partnerTestDrives.createdAt, new Date(Date.now() - 4 * 3_600_000))))
      : zero,
    show.billing ? db.select({ n: count() }).from(partnerInvoices).where(and(eq(partnerInvoices.partnerId, pid), inArray(partnerInvoices.status, ["due", "overdue"]))) : zero,
    // Only people who see every enquiry can see (and assign) the unassigned ones.
    ctx.can("leads.assign") && leadScope(ctx) === "all"
      ? db.select({ n: count() }).from(partnerLeads).where(and(eq(partnerLeads.partnerId, pid), isNull(partnerLeads.assignedMemberId), notInArray(partnerLeads.status, CRM_FINISHED)))
      : zero,
    ctx.can("inventory.manage") ? needsCatalogueCount(pid) : Promise.resolve(0),
  ]);

  const out: PendingAction[] = [];
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  if (uncatalogued)
    out.push({ key: "catalogue", tone: "red", count: uncatalogued, title: "Listings need a catalogue model", detail: `Pick the catalogue model for ${plural(uncatalogued, "listing")} — hidden from the website until then.`, href: "/dealer/inventory" });
  if (vehicles) out.push({ key: "vehicles", tone: "amber", count: vehicles, title: "Vehicle changes requested", detail: `MarchGear asked for changes on ${plural(vehicles, "listing")}.`, href: "/dealer/inventory?status=changes_requested" });
  if (offers) out.push({ key: "offers", tone: "amber", count: offers, title: "Offer changes requested", detail: `Update ${plural(offers, "offer")} and resubmit for approval.`, href: "/dealer/offers?status=changes_requested" });
  const expired = certs.filter((c) => c.validUntil! < today);
  const expiring = certs.filter((c) => c.validUntil! >= today);
  if (expired.length) out.push({ key: "certs-expired", tone: "red", count: expired.length, title: "Brand certificate expired", detail: `Upload a renewed certificate for ${plural(expired.length, "brand")}.`, href: "/dealer/brands" });
  if (expiring.length) out.push({ key: "certs-expiring", tone: "amber", count: expiring.length, title: "Certificate expiring soon", detail: `${plural(expiring.length, "brand authorisation")} expire within 30 days.`, href: "/dealer/brands" });
  if (overdue) out.push({ key: "followups", tone: "red", count: overdue, title: "Overdue follow-ups", detail: `${plural(overdue, "enquiry", "enquiries")} passed the follow-up time.`, href: "/dealer/enquiries?overdue=1" });
  if (drives) out.push({ key: "drives", tone: "red", count: drives, title: "Unanswered test-drive requests", detail: `${plural(drives, "request")} waiting more than 4 hours for a reply.`, href: "/dealer/test-drives?tab=requests" });
  if (unassigned) out.push({ key: "unassigned", tone: "blue", count: unassigned, title: "Unassigned enquiries", detail: `Assign ${plural(unassigned, "open enquiry", "open enquiries")} to your team.`, href: "/dealer/enquiries?assigned=none" });
  if (invoices) out.push({ key: "invoices", tone: "amber", count: invoices, title: "Invoices due", detail: `${plural(invoices, "invoice")} to pay.`, href: "/dealer/invoices" });
  return out;
}

async function recentActivity(ctx: PartnerContext) {
  const everyone = ctx.can("staff.manage") || ctx.can("settings.manage");
  return getDb()
    .select({ id: partnerActivity.id, summary: partnerActivity.summary, entity: partnerActivity.entity, action: partnerActivity.action, createdAt: partnerActivity.createdAt, who: users.name })
    .from(partnerActivity)
    .leftJoin(users, eq(users.id, partnerActivity.userId))
    .where(and(eq(partnerActivity.partnerId, ctx.partner.id), everyone ? undefined : eq(partnerActivity.userId, ctx.user.id)))
    .orderBy(desc(partnerActivity.createdAt), desc(partnerActivity.id))
    .limit(7);
}

async function latestNotifications(ctx: PartnerContext) {
  const db = getDb();
  const [me] = await db.select({ preferences: users.preferences }).from(users).where(eq(users.id, ctx.user.id));
  const muted = new Set((me?.preferences as { dealer?: DealerNotificationPrefs } | null)?.dealer?.muted ?? []);
  const rows = await db
    .select({
      id: partnerNotifications.id,
      title: partnerNotifications.title,
      body: partnerNotifications.body,
      href: partnerNotifications.href,
      kind: partnerNotifications.kind,
      userId: partnerNotifications.userId,
      createdAt: partnerNotifications.createdAt,
      readAt: partnerNotifications.readAt,
    })
    .from(partnerNotifications)
    .where(and(eq(partnerNotifications.partnerId, ctx.partner.id), or(isNull(partnerNotifications.userId), eq(partnerNotifications.userId, ctx.user.id))))
    .orderBy(desc(partnerNotifications.createdAt), desc(partnerNotifications.id))
    .limit(60);
  // Categories the person muted in Settings → Notifications, and ones they can't act on, stay off the dashboard.
  return rows
    .filter((n) => notificationVisible(n, ctx.can) && !muted.has(categoryOf(n.kind)))
    .slice(0, 5);
}

/** "Get started" steps for a new dealership — each checked against real data. */
async function setupChecklist(ctx: PartnerContext, show: DashboardData["show"]) {
  const db = getDb();
  const pid = ctx.partner.id;
  const [[{ rooms }], [{ brands }], [{ vehicles }], [{ offers }], [{ staff }]] = await Promise.all([
    db.select({ rooms: count() }).from(partnerShowrooms).where(and(eq(partnerShowrooms.partnerId, pid), eq(partnerShowrooms.isActive, true))),
    db.select({ brands: count() }).from(partnerBrands).where(and(eq(partnerBrands.partnerId, pid), ne(partnerBrands.status, "rejected"))),
    db.select({ vehicles: count() }).from(partnerVehicles).where(eq(partnerVehicles.partnerId, pid)),
    db.select({ offers: count() }).from(partnerOffers).where(eq(partnerOffers.partnerId, pid)),
    db.select({ staff: count() }).from(partnerMembers).where(and(eq(partnerMembers.partnerId, pid), ne(partnerMembers.role, "owner"))),
  ]);
  const profile = ctx.partner.profile;
  return [
    { key: "profile", label: "Add your logo and a description", done: Boolean(profile?.logo && profile.description), href: "/dealer/profile", perm: show.profile },
    { key: "showroom", label: "Add your showroom location", done: rooms > 0, href: "/dealer/showrooms", perm: show.profile },
    { key: "brands", label: "Add the brands you're authorised for", done: brands > 0, href: "/dealer/brands", perm: show.brands },
    { key: "vehicle", label: "List your first vehicle", done: vehicles > 0, href: "/dealer/inventory/add", perm: ctx.can("inventory.manage") },
    { key: "offer", label: "Create an offer", done: offers > 0, href: "/dealer/offers/create", perm: ctx.can("offers.manage") },
    { key: "staff", label: "Invite your sales team", done: staff > 0, href: "/dealer/staff", perm: show.staff },
  ].filter((s) => s.perm);
}
