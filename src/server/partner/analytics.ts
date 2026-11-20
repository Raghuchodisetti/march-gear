import "server-only";
import { and, count, eq, gte, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { partnerEvents, partnerLeadEvents, partnerLeads, partnerMembers, partnerOffers, partnerTestDrives, partnerVehicles, users } from "@/db/schema";
import { CRM_WON, LEAD_SOURCE_LABEL, OFFER_STATUS_LABEL, PARTNER_ROLE_LABEL, VEHICLE_STATUS_LABEL, offerDisplayStatus } from "@/partner/labels";
import type { CrmStatus, LeadSource } from "@/db/enums";
import { getCatalog } from "@/server/catalog";
import { addDays, daysBetween } from "@/components/portal/billing/shared";
import type { AnalyticsReport, DateRange, Metric, MetricKey, SeriesPoint } from "@/components/portal/analytics/report";
import type { PartnerRow } from "./context";

/* ──────────────────────────────────────────────────────────────
   Dealer analytics for a date range (IST days) and the period
   before it. Sources: partner_events (views, contact clicks),
   partner_leads (+ lead events for response times),
   partner_test_drives, partner_vehicles and partner_offers.
   Every query is scoped to the one dealership.
   ────────────────────────────────────────────────────────────── */

const IST_MS = 5.5 * 3_600_000;
/** Start of an IST day as a UTC instant. */
const istStart = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) - IST_MS);
/** "YYYY-MM-DD" of a UTC instant in IST. */
const istDay = (d: Date) => new Date(d.getTime() + IST_MS).toISOString().slice(0, 10);
const istDayExpr = (col: unknown) => sql<string>`DATE_FORMAT(DATE_ADD(${col}, INTERVAL 330 MINUTE), '%Y-%m-%d')`;

const WON = new Set<CrmStatus>(CRM_WON);
const RESPONSE_KINDS = ["call", "email", "whatsapp", "note", "status", "test_drive"] as const;
const metric = (value: number, prev: number): Metric => ({ value, prev });

export async function getAnalyticsReport(partner: PartnerRow, range: DateRange, dealerName: string): Promise<AnalyticsReport> {
  const db = getDb();
  const pid = partner.id;
  const curStart = istStart(range.from);
  const end = istStart(addDays(range.to, 1));
  const prevStart = istStart(range.prevFrom);
  const inCur = (day: string) => day >= range.from && day <= range.to;

  const [events, refViews, leads, drives, members, responses] = await Promise.all([
    db
      .select({ kind: partnerEvents.kind, day: istDayExpr(partnerEvents.createdAt), n: count() })
      .from(partnerEvents)
      .where(and(eq(partnerEvents.partnerId, pid), gte(partnerEvents.createdAt, prevStart), lt(partnerEvents.createdAt, end)))
      .groupBy(partnerEvents.kind, istDayExpr(partnerEvents.createdAt)),
    db
      .select({ kind: partnerEvents.kind, refId: partnerEvents.refId, n: count() })
      .from(partnerEvents)
      .where(
        and(
          eq(partnerEvents.partnerId, pid),
          inArray(partnerEvents.kind, ["vehicle_view", "offer_view"]),
          isNotNull(partnerEvents.refId),
          gte(partnerEvents.createdAt, curStart),
          lt(partnerEvents.createdAt, end),
        ),
      )
      .groupBy(partnerEvents.kind, partnerEvents.refId),
    db
      .select({
        id: partnerLeads.id,
        createdAt: partnerLeads.createdAt,
        source: partnerLeads.source,
        status: partnerLeads.status,
        vehicleId: partnerLeads.vehicleId,
        offerId: partnerLeads.offerId,
        memberId: partnerLeads.assignedMemberId,
      })
      .from(partnerLeads)
      .where(and(eq(partnerLeads.partnerId, pid), gte(partnerLeads.createdAt, prevStart), lt(partnerLeads.createdAt, end))),
    db
      .select({
        id: partnerTestDrives.id,
        status: partnerTestDrives.status,
        leadId: partnerTestDrives.leadId,
        leadStatus: partnerLeads.status,
        at: sql<string>`DATE_FORMAT(DATE_ADD(COALESCE(${partnerTestDrives.scheduledAt}, ${partnerTestDrives.requestedFor}, ${partnerTestDrives.createdAt}), INTERVAL 330 MINUTE), '%Y-%m-%d')`,
      })
      .from(partnerTestDrives)
      .leftJoin(partnerLeads, and(eq(partnerLeads.id, partnerTestDrives.leadId), eq(partnerLeads.partnerId, pid)))
      .where(eq(partnerTestDrives.partnerId, pid)),
    db
      .select({ id: partnerMembers.id, role: partnerMembers.role, isActive: partnerMembers.isActive, name: users.name })
      .from(partnerMembers)
      .innerJoin(users, eq(users.id, partnerMembers.userId))
      .where(eq(partnerMembers.partnerId, pid)),
    db
      .select({ leadId: partnerLeadEvents.leadId, first: sql<string>`MIN(${partnerLeadEvents.createdAt})` })
      .from(partnerLeadEvents)
      .innerJoin(partnerLeads, eq(partnerLeads.id, partnerLeadEvents.leadId))
      .where(
        and(
          eq(partnerLeads.partnerId, pid),
          gte(partnerLeads.createdAt, curStart),
          lt(partnerLeads.createdAt, end),
          inArray(partnerLeadEvents.kind, [...RESPONSE_KINDS]),
          isNotNull(partnerLeadEvents.memberId),
        ),
      )
      .groupBy(partnerLeadEvents.leadId),
  ]);

  /* ── Totals ── */
  const ev = (kinds: string[], cur: boolean) => events.filter((e) => kinds.includes(e.kind) && inCur(e.day) === cur).reduce((s, e) => s + e.n, 0);
  const both = (kinds: string[]) => metric(ev(kinds, true), ev(kinds, false));
  const leadDay = (l: (typeof leads)[number]) => istDay(l.createdAt);
  const cur = leads.filter((l) => inCur(leadDay(l)));
  const prev = leads.filter((l) => !inCur(leadDay(l)));
  const isVehicle = (l: (typeof leads)[number]) => l.vehicleId !== null || l.source === "listing";
  const isOffer = (l: (typeof leads)[number]) => l.offerId !== null || l.source === "offer";
  const won = (l: { status: CrmStatus }) => WON.has(l.status);
  const pair = (f: (l: (typeof leads)[number]) => boolean) => metric(cur.filter(f).length, prev.filter(f).length);

  const driveIn = (period: "cur" | "prev") => drives.filter((d) => (period === "cur" ? inCur(d.at) : d.at >= range.prevFrom && d.at <= range.prevTo));
  const completed = (list: typeof drives) => list.filter((d) => d.status === "completed");
  const convertedDrives = (list: typeof drives) => completed(list).filter((d) => d.leadStatus && WON.has(d.leadStatus));
  const [dCur, dPrev] = [driveIn("cur"), driveIn("prev")];

  const totals: Record<MetricKey, Metric> = {
    profileViews: both(["profile_view"]),
    vehicleViews: both(["vehicle_view"]),
    offerViews: both(["offer_view"]),
    contactClicks: both(["phone_click", "whatsapp_click", "direction_click"]),
    enquiries: metric(cur.length, prev.length),
    vehicleEnquiries: pair(isVehicle),
    offerEnquiries: pair(isOffer),
    leadConversions: pair(won),
    testDrivesCompleted: metric(completed(dCur).length, completed(dPrev).length),
    testDriveConversions: metric(convertedDrives(dCur).length, convertedDrives(dPrev).length),
  };
  const views = metric(totals.profileViews.value + totals.vehicleViews.value + totals.offerViews.value, totals.profileViews.prev + totals.vehicleViews.prev + totals.offerViews.prev);
  const rate = (a: Metric, b: Metric) => metric(b.value ? (a.value / b.value) * 100 : 0, b.prev ? (a.prev / b.prev) * 100 : 0);

  /* ── Trend (daily up to 92 days, weekly beyond) ── */
  const bucket: "day" | "week" = range.days > 92 ? "week" : "day";
  const size = bucket === "day" ? 1 : 7;
  const series: SeriesPoint[] = [];
  const VIEW_KINDS = new Set(["profile_view", "vehicle_view", "offer_view"]);
  const idx = (day: string, start: string) => Math.floor(daysBetween(start, day) / size);
  const n = Math.ceil(range.days / size);
  for (let i = 0; i < n; i++) {
    const date = addDays(range.from, i * size);
    const last = addDays(date, size - 1);
    series.push({ date, end: last > range.to ? range.to : last, views: 0, enquiries: 0, prevViews: 0, prevEnquiries: 0 });
  }
  for (const e of events) {
    if (!VIEW_KINDS.has(e.kind)) continue;
    if (inCur(e.day)) series[idx(e.day, range.from)].views += e.n;
    else {
      const i = idx(e.day, range.prevFrom);
      if (series[i]) series[i].prevViews += e.n;
    }
  }
  for (const l of leads) {
    const day = leadDay(l);
    if (inCur(day)) series[idx(day, range.from)].enquiries++;
    else {
      const i = idx(day, range.prevFrom);
      if (series[i]) series[i].prevEnquiries++;
    }
  }

  /* ── Funnel ── */
  const curIds = new Set(cur.map((l) => l.id));
  const droveLeads = new Set(drives.filter((d) => d.status === "completed" && d.leadId && curIds.has(d.leadId)).map((d) => d.leadId));
  const funnel = [
    { key: "enquiries", label: "Enquiries", value: cur.length },
    { key: "contacted", label: "Contacted", value: cur.filter((l) => l.status !== "new").length },
    { key: "test_drive", label: "Test drive completed", value: droveLeads.size },
    { key: "won", label: "Won (booked or converted)", value: cur.filter(won).length },
  ];

  /* ── Sources ── */
  const bySource = new Map<string, number>();
  for (const l of cur) bySource.set(l.source, (bySource.get(l.source) ?? 0) + 1);
  const sources = [...bySource.entries()]
    .map(([source, value]) => ({ source, label: LEAD_SOURCE_LABEL[source as LeadSource] ?? source, value }))
    .sort((a, b) => b.value - a.value);

  /* ── Vehicles & campaigns ── */
  const viewsOf = (kind: string) => new Map(refViews.filter((r) => r.kind === kind && r.refId !== null).map((r) => [r.refId as number, r.n]));
  const vViews = viewsOf("vehicle_view");
  const oViews = viewsOf("offer_view");
  const tally = (key: "vehicleId" | "offerId") => {
    const m = new Map<number, { enquiries: number; won: number }>();
    for (const l of cur) {
      const id = l[key];
      if (id === null) continue;
      const t = m.get(id) ?? { enquiries: 0, won: 0 };
      t.enquiries++;
      if (won(l)) t.won++;
      m.set(id, t);
    }
    return m;
  };
  const vLeads = tally("vehicleId");
  const oLeads = tally("offerId");
  const vIds = [...new Set([...vViews.keys(), ...vLeads.keys()])];
  const oIds = [...new Set([...oViews.keys(), ...oLeads.keys()])];

  const [vehicleRows, offerRows, catalog] = await Promise.all([
    vIds.length
      ? db
          .select({ id: partnerVehicles.id, reference: partnerVehicles.reference, kind: partnerVehicles.kind, brand: partnerVehicles.brand, model: partnerVehicles.model, variant: partnerVehicles.variant, year: partnerVehicles.year, status: partnerVehicles.status })
          .from(partnerVehicles)
          .where(and(eq(partnerVehicles.partnerId, pid), inArray(partnerVehicles.id, vIds)))
      : Promise.resolve([]),
    oIds.length
      ? db
          .select({ id: partnerOffers.id, reference: partnerOffers.reference, title: partnerOffers.title, campaignName: partnerOffers.campaignName, status: partnerOffers.status, startsAt: partnerOffers.startsAt, endsAt: partnerOffers.endsAt })
          .from(partnerOffers)
          .where(and(eq(partnerOffers.partnerId, pid), inArray(partnerOffers.id, oIds)))
      : Promise.resolve([]),
    getCatalog(),
  ]);

  const vehicles = vehicleRows
    .map((v) => ({
      id: v.id,
      reference: v.reference,
      label: `${v.kind === "used" ? `${v.year} ` : ""}${catalog.brandName(v.brand)} ${v.model} ${v.variant}`.trim(),
      kind: v.kind === "used" ? "Used" : "New",
      status: VEHICLE_STATUS_LABEL[v.status],
      views: vViews.get(v.id) ?? 0,
      enquiries: vLeads.get(v.id)?.enquiries ?? 0,
      won: vLeads.get(v.id)?.won ?? 0,
    }))
    .sort((a, b) => b.enquiries - a.enquiries || b.views - a.views)
    .slice(0, 10);

  const campaigns = offerRows
    .map((o) => ({
      id: o.id,
      reference: o.reference,
      title: o.title,
      campaign: o.campaignName,
      status: OFFER_STATUS_LABEL[offerDisplayStatus(o)],
      views: oViews.get(o.id) ?? 0,
      enquiries: oLeads.get(o.id)?.enquiries ?? 0,
      won: oLeads.get(o.id)?.won ?? 0,
    }))
    .sort((a, b) => b.won - a.won || b.enquiries - a.enquiries || b.views - a.views)
    .slice(0, 10);

  /* ── Sales team ── */
  const asDate = (v: unknown) => (v instanceof Date ? v : new Date(`${String(v).replace(" ", "T")}Z`));
  const firstResponse = new Map(responses.map((r) => [r.leadId, asDate(r.first)]));
  const createdAt = new Map(cur.map((l) => [l.id, l.createdAt]));
  const teamRow = (memberId: number | null, name: string, role: string) => {
    const mine = cur.filter((l) => l.memberId === memberId);
    const times = mine
      .map((l) => {
        const f = firstResponse.get(l.id);
        const c = createdAt.get(l.id);
        return f && c && !Number.isNaN(f.getTime()) ? Math.max(0, (f.getTime() - c.getTime()) / 60_000) : null;
      })
      .filter((t): t is number => t !== null);
    return {
      memberId,
      name,
      role,
      assigned: mine.length,
      contacted: mine.filter((l) => l.status !== "new").length,
      converted: mine.filter(won).length,
      avgResponseMins: times.length ? times.reduce((s, t) => s + t, 0) / times.length : null,
      responded: times.length,
    };
  };
  const SALES_ROLES = new Set(["sales_executive", "sales_manager"]);
  const team = members
    .filter((m) => cur.some((l) => l.memberId === m.id) || (m.isActive && SALES_ROLES.has(m.role)))
    .map((m) => teamRow(m.id, m.name, `${PARTNER_ROLE_LABEL[m.role]}${m.isActive ? "" : " (inactive)"}`))
    .sort((a, b) => b.converted - a.converted || b.assigned - a.assigned || a.name.localeCompare(b.name));
  if (cur.some((l) => l.memberId === null)) team.push(teamRow(null, "Unassigned", "Not yet assigned"));

  return {
    dealer: { name: dealerName, reference: partner.reference },
    range,
    generatedAt: new Date().toISOString(),
    bucket,
    totals,
    rates: {
      leadConversion: rate(totals.leadConversions, totals.enquiries),
      testDriveConversion: rate(totals.testDriveConversions, totals.testDrivesCompleted),
      viewToEnquiry: rate(totals.enquiries, views),
    },
    clicks: { phone: ev(["phone_click"], true), whatsapp: ev(["whatsapp_click"], true), directions: ev(["direction_click"], true) },
    series,
    funnel,
    sources,
    vehicles,
    campaigns,
    team,
  };
}
