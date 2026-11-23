import "server-only";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { leadNotes, leads, partnerLeadEvents, partnerLeads, partnerShowrooms, partnerTestDrives, partners } from "@/db/schema";
import type { CrmStatus, LeadStatus, LeadType, TestDriveStatus } from "@/db/enums";
import { LEAD_STATUS_LABEL, LEAD_TYPE_LABEL, detailLabel, detailValue } from "@/lib/leads";
import type { Tone } from "@/partner/labels";
import { getCatalog } from "@/server/catalog";
import { customerOfPartnerLead, notifyCustomer } from "@/server/customer/notify";
import { WEEKDAYS, formatIstDay, formatTime, formatWhen } from "@/components/portal/crm/pipeline";

/* ──────────────────────────────────────────────────────────────
   A website customer's own requests (/account/enquiries and
   /account/test-drives): every `leads` row they sent while signed
   in, the dealer CRM enquiry it was routed to, and the test drives
   booked on it. Everything is scoped by the customer's user id
   (leads.user_id) — never by email or mobile, which aren't verified.

   Customers only ever see customer-safe facts: the dealership's
   name and public contact, a customer-friendly status, and dates.
   Dealer notes, call logs, reasons and assignees stay internal.
   ────────────────────────────────────────────────────────────── */

export type CustomerStatus = { label: string; tone: Tone };

/* ── Customer-friendly statuses (the one place they're mapped) ── */

/** A website request MarchGear handles itself (not routed to a dealer partner). */
export const SITE_LEAD_STATUS: Record<LeadStatus, CustomerStatus> = {
  new: { label: "Received", tone: "blue" },
  contacted: { label: "MarchGear contacted you", tone: "amber" },
  qualified: { label: "In progress", tone: "blue" },
  converted: { label: "Completed", tone: "green" },
  closed: { label: "Closed", tone: "neutral" },
};

/** The dealer CRM status of the enquiry a website request was routed to. "Lost" is never shown as such. */
export const DEALER_LEAD_STATUS: Record<CrmStatus, CustomerStatus> = {
  new: { label: "Sent to the dealer", tone: "blue" },
  contacted: { label: "The dealer contacted you", tone: "amber" },
  follow_up: { label: "The dealer contacted you", tone: "amber" },
  interested: { label: "In discussion with the dealer", tone: "blue" },
  test_drive_scheduled: { label: "Test drive scheduled", tone: "blue" },
  negotiation: { label: "Discussing the price", tone: "blue" },
  booking_completed: { label: "Booked", tone: "green" },
  converted: { label: "Completed", tone: "green" },
  lost: { label: "Closed", tone: "neutral" },
  closed: { label: "Closed", tone: "neutral" },
};

const SITE_CLOSED: LeadStatus[] = ["converted", "closed"];
const DEALER_CLOSED: CrmStatus[] = ["converted", "lost", "closed"];
/** Test drives the customer (and the dealer) can still change. */
export const TEST_DRIVE_ACTIVE: TestDriveStatus[] = ["requested", "accepted", "scheduled", "rescheduled"];
const SITE_DRIVE_ACTIVE: LeadStatus[] = ["new", "contacted", "qualified"];

/** "12 Dec, 11:00 am" in IST. */
export const slotLabel = (d: Date | string) => `${formatIstDay(d, false)}, ${formatTime(d)}`;

/** A dealer test drive, in the customer's words. `at` is the confirmed time (scheduled_at). */
export function testDriveStatus(status: TestDriveStatus, at: Date | string | null): CustomerStatus {
  switch (status) {
    case "requested":
      return { label: "Requested", tone: "blue" };
    case "accepted":
      return { label: "Accepted · time to be confirmed", tone: "blue" };
    case "scheduled":
      return { label: at ? `Confirmed for ${slotLabel(at)}` : "Confirmed", tone: "green" };
    case "rescheduled":
      return { label: at ? `Rescheduled to ${slotLabel(at)}` : "Rescheduled", tone: "amber" };
    case "completed":
      return { label: "Completed", tone: "dark" };
    case "rejected":
      return { label: "Dealer couldn't offer this slot", tone: "neutral" };
    case "no_show":
      return { label: "Missed", tone: "amber" };
    default:
      return { label: "Cancelled", tone: "neutral" };
  }
}

/** A website test-drive request that hasn't reached a dealer partner (MarchGear arranges it). */
function siteDriveStatus(status: LeadStatus, cancelledByYou: boolean): CustomerStatus {
  if (status === "closed") return cancelledByYou ? { label: "Cancelled", tone: "neutral" } : { label: "Closed", tone: "neutral" };
  if (status === "converted") return { label: "Completed", tone: "dark" };
  if (status === "new") return { label: "Requested", tone: "blue" };
  return { label: "Being arranged", tone: "amber" };
}

export const SLOT_LABEL = { morning: "Morning (10 am – 1 pm)", afternoon: "Afternoon (1 – 5 pm)", evening: "Evening (5 – 8 pm)" } as const;
export type TimeSlot = keyof typeof SLOT_LABEL;
const SLOT_TIME: Record<TimeSlot, string> = { morning: "10:00", afternoon: "14:00", evening: "17:30" };
const isSlot = (v: unknown): v is TimeSlot => typeof v === "string" && v in SLOT_TIME;
const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** "Tue, 24 Nov · afternoon" for a preferred day + slot. */
export function preferredLabel(day: string, slot: TimeSlot) {
  const d = new Date(`${day}T12:00:00+05:30`);
  return `${WEEKDAYS[d.getUTCDay()]}, ${formatIstDay(d, false)} · ${slot}`;
}

/* ── What a request is about ───────────────────────────────── */

type Catalog = Awaited<ReturnType<typeof getCatalog>>;
type LeadRow = typeof leads.$inferSelect;
export type AboutKind = "car" | "used" | "dealer" | "pdi" | "sell" | "insurance" | "general";

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : "");

function aboutLead(c: Catalog, l: Pick<LeadRow, "type" | "subject" | "carSlug" | "usedCarId" | "dealerId" | "details">): { title: string; kind: AboutKind; href: string | null } {
  const d = l.details ?? {};
  const subject = l.subject?.trim() || null;
  if (l.usedCarId) {
    const u = c.getUsedCar(l.usedCarId);
    if (u) return { title: `${u.year} ${c.brandName(u.brand)} ${u.name} ${u.variant}`.trim(), kind: "used", href: `/used-cars/${u.id}` };
    return { title: subject ?? "A used car", kind: "used", href: null };
  }
  if (l.type === "sell_car") return { title: [str(d.year), str(d.brand), str(d.model)].filter(Boolean).join(" ") || "Your car", kind: "sell", href: null };
  if (l.type === "pdi_booking") return { title: subject ?? "Pre-delivery inspection", kind: "pdi", href: null };
  if (l.type === "pdi_checklist") return { title: [str(d.brand), str(d.model)].filter(Boolean).join(" ") || "PDI checklist", kind: "pdi", href: null };
  if (l.type === "insurance_claim" || l.type === "insurance_help") return { title: subject ?? LEAD_TYPE_LABEL[l.type], kind: "insurance", href: null };
  if (l.carSlug) {
    const car = c.getCar(l.carSlug);
    if (car) return { title: `${c.brandName(car.brand)} ${car.name}`, kind: "car", href: `/cars/${car.slug}` };
  }
  if (l.dealerId) {
    const dealer = c.getDealer(l.dealerId);
    if (dealer) return { title: subject ?? dealer.name, kind: "dealer", href: `/dealers/${dealer.id}` };
  }
  return { title: subject ?? LEAD_TYPE_LABEL[l.type] ?? "Your request", kind: "general", href: null };
}

/* ── The dealership's public contact ───────────────────────── */

export interface DealerContact {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  hours: string | null;
  mapUrl: string | null;
  /** The public /dealers page. */
  href: string | null;
}

const mapsSearch = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

function publicDealer(c: Catalog, dealerId: string | null | undefined, fallbackName?: string | null): DealerContact | null {
  const d = dealerId ? c.getDealer(dealerId) : undefined;
  if (d) return { name: d.name, address: d.address, phone: d.phone || null, email: d.email || null, hours: d.hours || null, mapUrl: mapsSearch(`${d.name}, ${d.address}`), href: `/dealers/${d.id}` };
  return fallbackName ? { name: fallbackName, address: null, phone: null, email: null, hours: null, mapUrl: null, href: null } : null;
}

const partnerName = (p: { tradeName: string | null; legalName: string | null } | null) => p?.tradeName || p?.legalName || null;

/* ── Enquiries ─────────────────────────────────────────────── */

export interface CustomerEnquiry {
  reference: string;
  type: LeadType;
  typeLabel: string;
  title: string;
  about: AboutKind;
  status: CustomerStatus;
  open: boolean;
  /** ISO */
  createdAt: string;
  /** Latest change on either side (ISO). */
  updatedAt: string;
  /** The dealership handling it, when it was passed to a dealer partner. */
  dealerName: string | null;
  href: string;
}

function enquiryStatus(siteStatus: LeadStatus, dealerStatus: CrmStatus | null) {
  return dealerStatus
    ? { status: DEALER_LEAD_STATUS[dealerStatus], open: !DEALER_CLOSED.includes(dealerStatus) }
    : { status: SITE_LEAD_STATUS[siteStatus], open: !SITE_CLOSED.includes(siteStatus) };
}

function enquirySelect() {
  return getDb()
    .select({
      lead: leads,
      plId: partnerLeads.id,
      plStatus: partnerLeads.status,
      plCreatedAt: partnerLeads.createdAt,
      plUpdatedAt: partnerLeads.updatedAt,
      tradeName: partners.tradeName,
      legalName: partners.legalName,
      publicDealerId: partners.publicDealerId,
    })
    .from(leads)
    .leftJoin(partnerLeads, eq(partnerLeads.siteLeadId, leads.id))
    .leftJoin(partners, eq(partners.id, partnerLeads.partnerId));
}
type EnquiryRow = Awaited<ReturnType<ReturnType<typeof enquirySelect>["where"]>>[number];

/**
 * "Test drive scheduled" stops being true once every drive on the enquiry is over (cancelled, turned down or done),
 * even though the dealer's CRM status hasn't moved on yet — say what actually happened.
 */
async function driveOutcomes(plIds: number[]) {
  const out = new Map<number, CustomerStatus>();
  if (!plIds.length) return out;
  const drives = await getDb()
    .select({ leadId: partnerTestDrives.leadId, status: partnerTestDrives.status, updatedAt: partnerTestDrives.updatedAt })
    .from(partnerTestDrives)
    .where(inArray(partnerTestDrives.leadId, plIds))
    .orderBy(asc(partnerTestDrives.updatedAt), asc(partnerTestDrives.id));
  const byLead = new Map<number, TestDriveStatus[]>();
  for (const d of drives) if (d.leadId) byLead.set(d.leadId, [...(byLead.get(d.leadId) ?? []), d.status]);
  for (const [leadId, list] of byLead) {
    if (list.some((s) => TEST_DRIVE_ACTIVE.includes(s))) continue;
    const last = list[list.length - 1];
    out.set(
      leadId,
      last === "completed"
        ? { label: "Test drive done", tone: "dark" }
        : last === "no_show"
          ? { label: "Test drive missed", tone: "amber" }
          : { label: "Test drive didn't go ahead", tone: "neutral" },
    );
  }
  return out;
}

function toEnquiry(c: Catalog, r: EnquiryRow, outcomes?: Map<number, CustomerStatus>): CustomerEnquiry {
  const l = r.lead;
  const about = aboutLead(c, l);
  const base = enquiryStatus(l.status, r.plId ? r.plStatus : null);
  const outcome = r.plId && r.plStatus === "test_drive_scheduled" ? outcomes?.get(r.plId) : undefined;
  const { status, open } = outcome ? { status: outcome, open: base.open } : base;
  const updated = r.plUpdatedAt && r.plUpdatedAt > l.updatedAt ? r.plUpdatedAt : l.updatedAt;
  return {
    reference: l.reference,
    type: l.type,
    typeLabel: LEAD_TYPE_LABEL[l.type] ?? "Request",
    title: about.title,
    about: about.kind,
    status,
    open,
    createdAt: l.createdAt.toISOString(),
    updatedAt: updated.toISOString(),
    dealerName: r.plId ? (publicDealer(c, r.publicDealerId)?.name ?? partnerName(r)) : null,
    href: `/account/enquiries/${encodeURIComponent(l.reference)}`,
  };
}

/** Every website request this customer sent while signed in, newest first. */
export async function getCustomerEnquiries(userId: number, opts: { limit?: number } = {}): Promise<CustomerEnquiry[]> {
  const limit = Math.min(Math.max(1, opts.limit ?? 500), 500);
  const [rows, c] = await Promise.all([
    enquirySelect().where(eq(leads.userId, userId)).orderBy(desc(leads.createdAt), desc(leads.id)).limit(limit),
    getCatalog(),
  ]);
  const seen = new Set<number>();
  const unique = rows.filter((r) => !seen.has(r.lead.id) && seen.add(r.lead.id));
  const outcomes = await driveOutcomes(unique.filter((r) => r.plId && r.plStatus === "test_drive_scheduled").map((r) => r.plId!));
  return unique.map((r) => toEnquiry(c, r, outcomes));
}

export interface TimelineStep {
  at: string;
  title: string;
  detail?: string;
  /** Something the customer did themselves. */
  mine?: boolean;
}

export interface CustomerEnquiryDetail extends CustomerEnquiry {
  aboutHref: string | null;
  routed: boolean;
  /** The form answers, in the customer's own words. */
  answers: { label: string; value: string }[];
  message: string | null;
  contact: { name: string | null; phone: string | null; email: string | null; city: string | null };
  /** The dealership handling it (routed), or the one the customer asked about (MarchGear passes it on). */
  dealer: DealerContact | null;
  timeline: TimelineStep[];
  testDrives: CustomerTestDrive[];
  next: string;
}

const TD_EVENT: Partial<Record<TestDriveStatus, string>> = {
  accepted: "The dealer accepted your test drive",
  scheduled: "Test drive confirmed",
  rescheduled: "Test drive moved to a new time",
  completed: "Test drive completed",
  no_show: "Test drive marked as missed",
  rejected: "The dealer couldn't offer the requested slot",
  cancelled: "The dealer cancelled the test drive",
};

/** Admin timeline notes are generated as "Status changed from X to Y" (src/server/actions/admin.ts). */
const LABEL_TO_STATUS = new Map(Object.entries(LEAD_STATUS_LABEL).map(([k, v]) => [v, k as LeadStatus]));
const STATUS_NOTE = /^Status changed from (.+) to (.+)$/;
/** Prefixes of the notes a customer's own actions write on a website lead (see customer-requests actions). */
export const CUSTOMER_NOTE = { cancelled: "Cancelled by the customer from their MarchGear account", ask: "Customer asked for another time:" } as const;

function nextStep(e: { routed: boolean; dealerStatus: CrmStatus | null; siteStatus: LeadStatus; dealerName: string | null; phone: string | null; type: LeadType; hasDrive: boolean }) {
  const who = e.dealerName ?? "The dealership";
  const phone = e.phone ? ` on +91\u00a0${e.phone}` : "";
  if (e.routed && e.dealerStatus) {
    switch (e.dealerStatus) {
      case "new":
        return `${who} has your request and will contact you${phone}. Their progress shows here as they update it.`;
      case "contacted":
      case "follow_up":
        return `${who} has been in touch. Missed their call? Use the contact details on this page to reach them directly.`;
      case "interested":
      case "negotiation":
        return `You're talking with ${who}. Quote your reference ${e.type === "test_drive" ? "at the showroom" : "when you call or visit"} so they find your request straight away.`;
      case "test_drive_scheduled":
        return e.hasDrive ? "Your test drive is booked — the time and showroom are below. Need a different time? Ask for another one from Test drives." : `${who} is arranging your test drive and will confirm the time with you.`;
      case "booking_completed":
        return `Your booking with ${who} is done. They'll keep you posted on delivery.`;
      default:
        return "This request is closed. Need something else? Send a new request from any car or dealer page.";
    }
  }
  if (SITE_CLOSED.includes(e.siteStatus)) return "This request is closed. Need something else? Send a new request from any car or dealer page.";
  if (e.siteStatus === "new") return `MarchGear's team has your request and will contact you${phone}.`;
  return "MarchGear's team is working on your request and will be in touch with the next step.";
}

/** One of this customer's requests by reference, or null (also for other people's references). */
export async function getCustomerEnquiry(userId: number, reference: string): Promise<CustomerEnquiryDetail | null> {
  if (!/^[A-Z]{2,4}-[A-Z0-9]{4,10}$/i.test(reference)) return null;
  const db = getDb();
  const [[row], c] = await Promise.all([enquirySelect().where(and(eq(leads.userId, userId), eq(leads.reference, reference.toUpperCase()))).limit(1), getCatalog()]);
  if (!row) return null;
  const outcomes = row.plId && row.plStatus === "test_drive_scheduled" ? await driveOutcomes([row.plId]) : undefined;
  const base = toEnquiry(c, row, outcomes);
  const outcome = row.plId ? outcomes?.get(row.plId) : undefined;
  const l = row.lead;
  const routed = Boolean(row.plId);

  const [events, notes, drives] = await Promise.all([
    // Only the kinds with customer-safe meaning, and never their text: notes, calls and messages stay with the dealer.
    routed
      ? db
          .select({ kind: partnerLeadEvents.kind, meta: partnerLeadEvents.meta, createdAt: partnerLeadEvents.createdAt })
          .from(partnerLeadEvents)
          .where(and(eq(partnerLeadEvents.leadId, row.plId!), inArray(partnerLeadEvents.kind, ["status", "test_drive"])))
          .orderBy(asc(partnerLeadEvents.createdAt), asc(partnerLeadEvents.id))
      : Promise.resolve([]),
    // MarchGear's generated status notes, plus what the customer wrote themselves — never staff notes.
    routed
      ? Promise.resolve([])
      : db
          .select({ kind: leadNotes.kind, body: leadNotes.body, authorId: leadNotes.authorId, createdAt: leadNotes.createdAt })
          .from(leadNotes)
          .where(eq(leadNotes.leadId, l.id))
          .orderBy(asc(leadNotes.createdAt), asc(leadNotes.id)),
    getCustomerTestDrives(userId, { siteLeadId: l.id }),
  ]);

  const dealerName = base.dealerName;
  const timeline: TimelineStep[] = [{ at: l.createdAt.toISOString(), title: `You sent a ${base.typeLabel.toLowerCase()} request`, detail: base.title, mine: true }];

  if (routed) {
    timeline.push({ at: row.plCreatedAt!.toISOString(), title: `Passed to ${dealerName ?? "the dealership"}`, detail: "Your request reached the dealership's enquiry desk." });
    let label = DEALER_LEAD_STATUS.new.label;
    const driveState = new Map<number, string>();
    const driveTimes = events.filter((e) => e.kind === "test_drive" && ["accepted", "scheduled", "rescheduled"].includes(String(e.meta?.status))).map((e) => e.createdAt.getTime());
    for (const e of events) {
      const m = e.meta ?? {};
      if (e.kind === "status") {
        const to = m.to as CrmStatus | undefined;
        if (!to || !(to in DEALER_LEAD_STATUS)) continue;
        const next = DEALER_LEAD_STATUS[to].label;
        if (next === label) continue;
        label = next;
        // Booking a drive moves the enquiry along too — the drive's own step says it better.
        if (to === "test_drive_scheduled" && driveTimes.some((t) => Math.abs(t - e.createdAt.getTime()) < 10_000)) continue;
        timeline.push({ at: e.createdAt.toISOString(), title: next });
        continue;
      }
      const tdId = typeof m.testDriveId === "number" ? m.testDriveId : 0;
      if (m.by === "customer") {
        if (m.action === "reschedule_request" && isDay(m.date) && isSlot(m.slot))
          timeline.push({ at: e.createdAt.toISOString(), title: "You asked for another time", detail: preferredLabel(m.date, m.slot), mine: true });
        else if (m.status === "cancelled") {
          driveState.set(tdId, "cancelled");
          timeline.push({ at: e.createdAt.toISOString(), title: "You cancelled the test drive", mine: true });
        }
        continue;
      }
      const st = typeof m.status === "string" ? (m.status as TestDriveStatus) : null;
      const title = st ? TD_EVENT[st] : typeof m.reference === "string" ? "Test drive request passed to the dealer" : undefined;
      const key = st ?? "requested";
      if (!title || driveState.get(tdId) === key) continue;
      driveState.set(tdId, key);
      timeline.push({ at: e.createdAt.toISOString(), title });
    }
  } else {
    let label = SITE_LEAD_STATUS.new.label;
    for (const n of notes) {
      if (n.authorId === userId) {
        if (n.body.startsWith(CUSTOMER_NOTE.cancelled)) timeline.push({ at: n.createdAt.toISOString(), title: "You cancelled this request", mine: true });
        else if (n.body.startsWith(CUSTOMER_NOTE.ask)) timeline.push({ at: n.createdAt.toISOString(), title: "You asked for another time", detail: n.body.slice(CUSTOMER_NOTE.ask.length).split("\n")[0].trim(), mine: true });
        continue;
      }
      if (n.kind !== "status") continue;
      const to = LABEL_TO_STATUS.get(n.body.match(STATUS_NOTE)?.[2] ?? "");
      if (!to || SITE_LEAD_STATUS[to].label === label) continue;
      label = SITE_LEAD_STATUS[to].label;
      timeline.push({ at: n.createdAt.toISOString(), title: label });
    }
  }

  const answers = Object.entries(l.details ?? {})
    // "channel" is how staff took a phone/walk-in lead — not something the customer told us.
    .filter(([k, v]) => k !== "channel" && v !== null && v !== "")
    .map(([k, v]) => ({ label: detailLabel(k), value: isDay(v) ? formatIstDay(new Date(`${v}T12:00:00+05:30`)) : detailValue(k, v) }));

  const dealer = routed ? (publicDealer(c, row.publicDealerId, partnerName(row)) ?? null) : publicDealer(c, l.dealerId);

  return {
    ...base,
    aboutHref: aboutLead(c, l).href,
    routed,
    answers,
    message: l.message,
    contact: { name: l.name, phone: l.phone, email: l.email, city: l.city },
    dealer,
    timeline,
    testDrives: drives,
    next: outcome
      ? outcome.label === "Test drive done"
        ? `You've had your test drive. ${dealerName ?? "The dealership"} will follow up about the next steps.`
        : `Your test drive didn't go ahead. Contact ${dealerName ?? "the dealership"} to arrange another time, or request a new one from the car's page.`
      : nextStep({ routed, dealerStatus: row.plId ? row.plStatus : null, siteStatus: l.status, dealerName, phone: l.phone, type: l.type, hasDrive: drives.some((d) => d.upcoming) }),
  };
}

/* ── Test drives ───────────────────────────────────────────── */

export interface CustomerTestDrive {
  /** "td-<partner test drive id>" for a dealer booking, "lead-<website lead id>" for a request MarchGear is arranging. */
  id: string;
  reference: string;
  car: string;
  /** The dealership (or "MarchGear" while MarchGear arranges it). */
  dealerName: string;
  /** The showroom's name. */
  showroom: string | null;
  showroomAddress: string | null;
  mapUrl: string | null;
  phone: string | null;
  /** The confirmed time, else the preferred one (ISO). */
  when: string | null;
  /** "Sat, 12 Dec · 11:00 am", or "Sat, 12 Dec · morning" for a preferred slot. */
  whenLabel: string | null;
  /** True once the dealer has set the time. */
  confirmed: boolean;
  status: CustomerStatus;
  upcoming: boolean;
  /** The customer may still cancel or ask for another time. */
  canChange: boolean;
  /** Latest "ask for another time" the dealer hasn't acted on yet. */
  pendingAsk: { label: string; at: string } | null;
  enquiryReference: string;
  enquiryHref: string;
  href: string;
}

const istTodayStart = () => {
  const d = new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
  return new Date(`${d}T00:00:00+05:30`).getTime();
};

/**
 * The customer's test drives: dealer bookings linked through their website requests
 * (partner_test_drives → partner_leads → leads.user_id), plus website test-drive
 * requests MarchGear is still arranging. Upcoming first (soonest first), then past.
 */
export async function getCustomerTestDrives(userId: number, opts: { siteLeadId?: number } = {}): Promise<CustomerTestDrive[]> {
  const db = getDb();
  const own = opts.siteLeadId ? and(eq(leads.userId, userId), eq(leads.id, opts.siteLeadId)) : eq(leads.userId, userId);
  const [drives, requests, c] = await Promise.all([
    db
      .select({
        td: partnerTestDrives,
        plId: partnerLeads.id,
        site: { id: leads.id, reference: leads.reference, details: leads.details, carSlug: leads.carSlug, usedCarId: leads.usedCarId, subject: leads.subject },
        tradeName: partners.tradeName,
        legalName: partners.legalName,
        publicDealerId: partners.publicDealerId,
        room: { name: partnerShowrooms.name, address: partnerShowrooms.address, city: partnerShowrooms.city, pin: partnerShowrooms.pin, lat: partnerShowrooms.lat, lng: partnerShowrooms.lng, phone: partnerShowrooms.phone },
      })
      .from(partnerTestDrives)
      .innerJoin(partnerLeads, and(eq(partnerLeads.id, partnerTestDrives.leadId), eq(partnerLeads.partnerId, partnerTestDrives.partnerId)))
      .innerJoin(leads, eq(leads.id, partnerLeads.siteLeadId))
      .innerJoin(partners, eq(partners.id, partnerTestDrives.partnerId))
      .leftJoin(partnerShowrooms, eq(partnerShowrooms.id, partnerTestDrives.showroomId))
      .where(own)
      .orderBy(desc(partnerTestDrives.createdAt))
      .limit(200),
    db
      .select({ lead: leads })
      .from(leads)
      .leftJoin(partnerLeads, eq(partnerLeads.siteLeadId, leads.id))
      .where(and(own, eq(leads.type, "test_drive"), isNull(partnerLeads.id)))
      .orderBy(desc(leads.createdAt))
      .limit(200),
    getCatalog(),
  ]);

  // The customer's own "another time" asks and cancellations (written by the customer actions).
  const plIds = [...new Set(drives.map((d) => d.plId))];
  const reqIds = requests.map((r) => r.lead.id);
  const [asks, mine] = await Promise.all([
    plIds.length
      ? db
          .select({ meta: partnerLeadEvents.meta, createdAt: partnerLeadEvents.createdAt })
          .from(partnerLeadEvents)
          .where(and(inArray(partnerLeadEvents.leadId, plIds), eq(partnerLeadEvents.kind, "test_drive"), isNull(partnerLeadEvents.memberId)))
      : Promise.resolve([]),
    reqIds.length
      ? db
          .select({ leadId: leadNotes.leadId, body: leadNotes.body, createdAt: leadNotes.createdAt })
          .from(leadNotes)
          .where(and(inArray(leadNotes.leadId, reqIds), eq(leadNotes.authorId, userId)))
          .orderBy(asc(leadNotes.createdAt))
      : Promise.resolve([]),
  ]);
  const lastAsk = new Map<number, { label: string; at: Date }>();
  for (const a of asks) {
    const m = a.meta ?? {};
    if (m.by !== "customer" || m.action !== "reschedule_request" || typeof m.testDriveId !== "number" || !isDay(m.date) || !isSlot(m.slot)) continue;
    const prev = lastAsk.get(m.testDriveId);
    if (!prev || prev.at < a.createdAt) lastAsk.set(m.testDriveId, { label: preferredLabel(m.date, m.slot), at: a.createdAt });
  }

  const today = istTodayStart();
  const out: CustomerTestDrive[] = [];

  for (const r of drives) {
    const t = r.td;
    const dealer = publicDealer(c, r.publicDealerId, partnerName(r));
    const confirmed = Boolean(t.scheduledAt) && t.status !== "requested";
    const details = r.site.details ?? {};
    // The customer's own preferred day + slot reads better than the slot's nominal start time.
    const preferred = !confirmed && isDay(details.date) && isSlot(details.slot) && t.requestedFor && Math.abs(t.requestedFor.getTime() - new Date(`${details.date}T${SLOT_TIME[details.slot]}:00+05:30`).getTime()) < 60_000;
    const at = confirmed ? t.scheduledAt : t.requestedFor;
    const whenLabel = confirmed ? formatWhen(t.scheduledAt!, { weekday: true }) : preferred ? preferredLabel(details.date as string, details.slot as TimeSlot) : at ? formatWhen(at, { weekday: true }) : null;
    const active = TEST_DRIVE_ACTIVE.includes(t.status);
    const ask = lastAsk.get(t.id);
    const room = r.room?.name ? r.room : null;
    const roomAddress = room ? [room.address, `${room.city} ${room.pin}`.trim()].filter(Boolean).join(", ") : null;
    out.push({
      id: `td-${t.id}`,
      reference: t.reference,
      car: t.carLabel,
      dealerName: dealer?.name ?? "The dealership",
      showroom: room?.name ?? null,
      showroomAddress: roomAddress ?? dealer?.address ?? null,
      mapUrl: room ? (room.lat != null && room.lng != null ? mapsSearch(`${room.lat},${room.lng}`) : mapsSearch(`${room.name}, ${roomAddress}`)) : (dealer?.mapUrl ?? null),
      phone: room?.phone || dealer?.phone || null,
      when: at ? at.toISOString() : null,
      whenLabel,
      confirmed,
      status: testDriveStatus(t.status, t.scheduledAt),
      upcoming: active && (!at || at.getTime() >= today),
      canChange: active,
      pendingAsk: active && ask && ask.at >= t.updatedAt ? { label: ask.label, at: ask.at.toISOString() } : null,
      enquiryReference: r.site.reference,
      enquiryHref: `/account/enquiries/${encodeURIComponent(r.site.reference)}`,
      href: `/account/test-drives#${t.reference}`,
    });
  }

  for (const { lead: l } of requests) {
    const d = l.details ?? {};
    const day = isDay(d.date) ? d.date : null;
    const slot = isSlot(d.slot) ? d.slot : null;
    const at = day ? new Date(`${day}T${SLOT_TIME[slot ?? "morning"]}:00+05:30`) : null;
    const notes = mine.filter((n) => n.leadId === l.id);
    const cancelled = l.status === "closed" && notes.some((n) => n.body.startsWith(CUSTOMER_NOTE.cancelled));
    const askNote = [...notes].reverse().find((n) => n.body.startsWith(CUSTOMER_NOTE.ask));
    const dealer = publicDealer(c, l.dealerId);
    const active = SITE_DRIVE_ACTIVE.includes(l.status);
    out.push({
      id: `lead-${l.id}`,
      reference: l.reference,
      car: aboutLead(c, l).title,
      dealerName: dealer?.name ?? "MarchGear",
      showroom: null,
      showroomAddress: dealer?.address ?? null,
      mapUrl: dealer?.mapUrl ?? null,
      phone: dealer?.phone ?? null,
      when: at ? at.toISOString() : null,
      whenLabel: day ? preferredLabel(day, slot ?? "morning") : null,
      confirmed: false,
      status: siteDriveStatus(l.status, cancelled),
      upcoming: active && (!at || at.getTime() >= today),
      canChange: active,
      pendingAsk: active && askNote && askNote.createdAt >= l.updatedAt ? { label: askNote.body.slice(CUSTOMER_NOTE.ask.length).split("\n")[0].trim(), at: askNote.createdAt.toISOString() } : null,
      enquiryReference: l.reference,
      enquiryHref: `/account/enquiries/${encodeURIComponent(l.reference)}`,
      href: `/account/test-drives#${l.reference}`,
    });
  }

  const time = (d: CustomerTestDrive) => (d.when ? new Date(d.when).getTime() : Number.MAX_SAFE_INTEGER);
  const up = out.filter((d) => d.upcoming).sort((a, b) => time(a) - time(b));
  const past = out.filter((d) => !d.upcoming).sort((a, b) => (b.when ? new Date(b.when).getTime() : 0) - (a.when ? new Date(a.when).getTime() : 0));
  return [...up, ...past];
}

/* ── Notifying customers (called by the dealer, admin and staff actions) ── */

/**
 * A dealer moved a routed enquiry along. Tells the customer only about customer-visible steps
 * (contacted, test drive scheduled, booked, completed, closed) — never why it was lost. Never throws.
 */
export async function notifyCustomerOfDealerStatus(partnerLeadId: number, from: CrmStatus, to: CrmStatus) {
  try {
    if (!["contacted", "test_drive_scheduled", "booking_completed", "converted", "closed", "lost"].includes(to)) return;
    if (DEALER_LEAD_STATUS[from].label === DEALER_LEAD_STATUS[to].label) return;
    const userId = await customerOfPartnerLead(partnerLeadId);
    if (!userId) return;
    const [r] = await getDb()
      .select({ reference: leads.reference, type: leads.type, subject: leads.subject, carSlug: leads.carSlug, usedCarId: leads.usedCarId, dealerId: leads.dealerId, details: leads.details, tradeName: partners.tradeName, legalName: partners.legalName, publicDealerId: partners.publicDealerId })
      .from(partnerLeads)
      .innerJoin(leads, eq(leads.id, partnerLeads.siteLeadId))
      .innerJoin(partners, eq(partners.id, partnerLeads.partnerId))
      .where(eq(partnerLeads.id, partnerLeadId));
    if (!r) return;
    const c = await getCatalog();
    const dealer = publicDealer(c, r.publicDealerId, partnerName(r))?.name ?? "The dealership";
    const about = aboutLead(c, r).title;
    const copy: Record<string, { title: string; body: string }> = {
      contacted: { title: `${dealer} has been in touch about your request`, body: `${about} · reference ${r.reference}. Missed their call? Their contact details are on your enquiry.` },
      test_drive_scheduled: { title: `${dealer} is arranging your test drive`, body: `${about} · reference ${r.reference}. You'll see the time under Test drives once it's set.` },
      booking_completed: { title: `Your booking with ${dealer} is complete`, body: `${about} · reference ${r.reference}. The dealership will keep you posted on delivery.` },
      converted: { title: `${dealer} marked your request as completed`, body: `${about} · reference ${r.reference}. Thanks for choosing MarchGear.` },
      closed: { title: `${dealer} closed your request`, body: `${about} · reference ${r.reference}. Need something else? Send a new request any time.` },
    };
    const n = copy[to === "lost" ? "closed" : to];
    await notifyCustomer(userId, { kind: "enquiry", ...n, href: `/account/enquiries/${encodeURIComponent(r.reference)}` });
  } catch (err) {
    console.error("[customer] dealer status notification failed", err);
  }
}

/**
 * MarchGear staff changed a website lead's status in /admin/leads. Only for requests MarchGear handles
 * itself — a routed request's status comes from the dealer. Never throws.
 */
export async function notifyCustomerOfLeadStatus(leadId: number, from: LeadStatus, to: LeadStatus) {
  try {
    if (SITE_LEAD_STATUS[from].label === SITE_LEAD_STATUS[to].label) return;
    const db = getDb();
    const [l] = await db.select().from(leads).where(eq(leads.id, leadId));
    if (!l?.userId) return;
    const [routed] = await db.select({ id: partnerLeads.id }).from(partnerLeads).where(eq(partnerLeads.siteLeadId, leadId)).limit(1);
    if (routed) return;
    const about = aboutLead(await getCatalog(), l).title;
    const copy: Record<LeadStatus, { title: string; body: string }> = {
      new: { title: "Your request is open again", body: `${about} · reference ${l.reference}. MarchGear's team will be in touch.` },
      contacted: { title: "MarchGear has been in touch about your request", body: `${about} · reference ${l.reference}.` },
      qualified: { title: "Your request is in progress", body: `${about} · reference ${l.reference}. We're working on the next step.` },
      converted: { title: "Your request is complete", body: `${about} · reference ${l.reference}. Thanks for choosing MarchGear.` },
      closed: { title: "Your request has been closed", body: `${about} · reference ${l.reference}. Need something else? Send a new request any time.` },
    };
    await notifyCustomer(l.userId, { kind: "enquiry", ...copy[to], href: `/account/enquiries/${encodeURIComponent(l.reference)}` });
  } catch (err) {
    console.error("[customer] lead status notification failed", err);
  }
}

/**
 * A dealer accepted, scheduled, rescheduled, completed, rejected or cancelled a test drive.
 * Call after the change is saved; reads the drive's current state. Never throws.
 */
export async function notifyCustomerOfTestDrive(testDriveId: number) {
  try {
    const db = getDb();
    const [r] = await db
      .select({ td: partnerTestDrives, tradeName: partners.tradeName, legalName: partners.legalName, publicDealerId: partners.publicDealerId, room: partnerShowrooms.name })
      .from(partnerTestDrives)
      .innerJoin(partners, eq(partners.id, partnerTestDrives.partnerId))
      .leftJoin(partnerShowrooms, eq(partnerShowrooms.id, partnerTestDrives.showroomId))
      .where(eq(partnerTestDrives.id, testDriveId));
    if (!r?.td.leadId) return;
    const userId = await customerOfPartnerLead(r.td.leadId);
    if (!userId) return;
    const t = r.td;
    const dealer = publicDealer(await getCatalog(), r.publicDealerId, partnerName(r))?.name ?? "The dealership";
    const where = r.room ? ` at ${r.room}` : ` at ${dealer}`;
    const when = t.scheduledAt ? formatWhen(t.scheduledAt, { weekday: true }) : null;
    const copy: Partial<Record<TestDriveStatus, { title: string; body: string }>> = {
      accepted: { title: `${dealer} accepted your test drive request`, body: `${t.carLabel} · ${t.reference}. They'll confirm the time with you.` },
      scheduled: { title: when ? `Test drive confirmed for ${when}` : "Your test drive is confirmed", body: `${t.carLabel}${where} · ${t.reference}.` },
      rescheduled: { title: when ? `Test drive moved to ${when}` : "Your test drive was rescheduled", body: `${t.carLabel}${where} · ${t.reference}. Ask for another time if this doesn't suit you.` },
      completed: { title: `Thanks for test driving the ${t.carLabel}`, body: `${dealer} marked your test drive ${t.reference} as completed.` },
      rejected: { title: `${dealer} couldn't offer your requested slot`, body: `${t.carLabel} · ${t.reference}. Contact the dealership or request a new test drive from the car's page.` },
      cancelled: { title: "Your test drive was cancelled", body: `${dealer} cancelled the ${t.carLabel} test drive ${t.reference}. Contact them to book another time.` },
    };
    const n = copy[t.status];
    if (!n) return;
    await notifyCustomer(userId, { kind: "test_drive", ...n, href: `/account/test-drives#${t.reference}` });
  } catch (err) {
    console.error("[customer] test drive notification failed", err);
  }
}
