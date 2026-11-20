import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { leads, partnerLeads, partnerMembers, partnerOffers, partnerShowrooms, partnerTestDrives, partnerVehicles, partners } from "@/db/schema";
import type { LeadSource } from "@/db/enums";
import { LEAD_TYPE_LABEL } from "@/lib/leads";
import { can } from "@/partner/permissions";
import { formatINR } from "@/lib/format";
import { isDuplicate } from "@/server/db-errors";
import { getCatalog } from "@/server/catalog";
import { logPartnerActivity, notifyPartner, reference } from "@/server/partner/records";
import { addLeadEvent, vehicleLabelMap } from "@/server/partner/crm";

/* ──────────────────────────────────────────────────────────────
   Routes public website enquiries to the dealer partner they are
   about, creating a CRM enquiry (and a test-drive request) in the
   dealer portal:
   - a `pv-<vehicleId>` used-car listing  → that vehicle's dealer
   - an offer reference "OFF-XXXXXX" in the message → the offer's dealer
   - a dealer page enquiry (dealerId = partners.public_dealer_id)
   Only approved dealerships receive enquiries. Never throws.
   ────────────────────────────────────────────────────────────── */

/** Preferred-slot start times (IST) for website test-drive requests. */
const SLOT_TIME = { morning: "10:00", afternoon: "14:00", evening: "17:30" } as const;
const SLOT_LABEL = { morning: "morning", afternoon: "afternoon", evening: "evening" } as const;
const OFFER_REF = /\bOFF-([A-HJ-NP-Z2-9]{6})\b/gi;
const VEHICLE_REF = /\bVEH-([A-HJ-NP-Z2-9]{6})\b/i;

export async function routeSiteLead(siteLeadId: number) {
  try {
    await route(siteLeadId);
  } catch (err) {
    console.error("[lead-routing] could not route website lead", siteLeadId, err);
  }
}

async function insertWithReference<T>(prefix: "LD" | "TD", insert: (ref: string) => Promise<T>): Promise<{ ref: string; result: T }> {
  for (let attempt = 0; ; attempt++) {
    const ref = reference(prefix);
    try {
      return { ref, result: await insert(ref) };
    } catch (err) {
      if (!isDuplicate(err) || attempt >= 2) throw err;
    }
  }
}

async function route(siteLeadId: number) {
  const db = getDb();
  const [lead] = await db.select().from(leads).where(eq(leads.id, siteLeadId));
  if (!lead) return;
  const [already] = await db.select({ id: partnerLeads.id }).from(partnerLeads).where(eq(partnerLeads.siteLeadId, siteLeadId)).limit(1);
  if (already) return;

  let partnerId: number | null = null;
  let source: LeadSource = "website";

  // 1. A dealer's used car mirrored on /used-cars.
  let vehicle: typeof partnerVehicles.$inferSelect | null = null;
  const mirror = lead.usedCarId?.match(/^pv-(\d+)$/);
  if (lead.usedCarId) {
    const [v] = await db
      .select()
      .from(partnerVehicles)
      .where(mirror ? eq(partnerVehicles.id, Number(mirror[1])) : eq(partnerVehicles.publicUsedCarId, lead.usedCarId))
      .limit(1);
    if (v) {
      vehicle = v;
      partnerId = v.partnerId;
      source = "listing";
    }
  }

  // 1b. A new-car stock enquiry (dealer page / model page) quotes the vehicle's reference — link it when it's that
  //     dealer's published listing, so it counts as an enquiry on the vehicle.
  const stockRef = !vehicle ? `${lead.subject ?? ""} ${lead.message ?? ""}`.match(VEHICLE_REF) : null;
  if (stockRef && lead.dealerId) {
    const [v] = await db
      .select({ v: partnerVehicles })
      .from(partnerVehicles)
      .innerJoin(partners, eq(partners.id, partnerVehicles.partnerId))
      .where(and(eq(partnerVehicles.reference, `VEH-${stockRef[1].toUpperCase()}`), eq(partnerVehicles.status, "published"), eq(partners.publicDealerId, lead.dealerId)))
      .limit(1);
    if (v) {
      vehicle = v.v;
      partnerId = v.v.partnerId;
      source = "listing";
    }
  }

  // 2. An offer reference quoted in the message.
  let offer: typeof partnerOffers.$inferSelect | null = null;
  const refs = [...`${lead.message ?? ""} ${lead.subject ?? ""}`.matchAll(OFFER_REF)].map((m) => `OFF-${m[1].toUpperCase()}`);
  if (refs.length) {
    const found = await db
      .select()
      .from(partnerOffers)
      .where(and(inArray(partnerOffers.reference, [...new Set(refs)].slice(0, 5)), eq(partnerOffers.status, "approved")));
    offer = found.find((o) => partnerId === null || o.partnerId === partnerId) ?? null;
    if (offer) {
      partnerId ??= offer.partnerId;
      if (!vehicle) source = "offer";
    }
  }

  // 3. The dealer's own public page.
  if (partnerId === null && lead.dealerId) {
    const [p] = await db.select({ id: partners.id }).from(partners).where(eq(partners.publicDealerId, lead.dealerId)).limit(1);
    if (p) partnerId = p.id;
  }
  if (partnerId === null) return;

  const [partner] = await db.select({ id: partners.id, status: partners.status }).from(partners).where(eq(partners.id, partnerId));
  if (!partner || partner.status !== "approved") return;

  // What the customer is interested in.
  const { getCar, brandName } = await getCatalog();
  const label = await vehicleLabelMap();
  const car = lead.carSlug ? getCar(lead.carSlug) : vehicle?.modelSlug ? getCar(vehicle.modelSlug) : undefined;
  const offerModel = offer && offer.scope.models.length === 1 ? getCar(offer.scope.models[0]) : undefined;
  const carLabel = vehicle ? label(vehicle) : car ? `${brandName(car.brand)} ${car.name}` : offerModel ? `${brandName(offerModel.brand)} ${offerModel.name}` : null;
  const details = lead.details ?? {};
  const budget = typeof details.offer === "number" ? `Offered ${formatINR(details.offer)}` : null;
  const name = (lead.name ?? "").trim() || "Website visitor";

  const { ref, result } = await insertWithReference("LD", (r) =>
    db.insert(partnerLeads).values({
      partnerId: partner.id,
      reference: r,
      name: name.slice(0, 120),
      mobile: lead.phone,
      email: lead.email,
      carLabel: carLabel?.slice(0, 200) ?? null,
      carSlug: lead.carSlug ?? vehicle?.modelSlug ?? offerModel?.slug ?? null,
      variant: vehicle?.variant ?? null,
      vehicleId: vehicle?.id ?? null,
      offerId: offer?.id ?? null,
      budget,
      location: lead.city?.slice(0, 120) ?? null,
      source,
      status: "new",
      siteLeadId: lead.id,
    }),
  );
  const leadId = result[0].insertId;
  const typeLabel = LEAD_TYPE_LABEL[lead.type] ?? "Enquiry";
  const via = source === "listing" ? "your listing" : source === "offer" ? `your offer ${offer?.reference}` : "your MarchGear page";
  await addLeadEvent(leadId, null, "created", `${typeLabel} received from the website via ${via}.${lead.message ? `\n“${lead.message.slice(0, 1500)}”` : ""}`, {
    siteReference: lead.reference,
    type: lead.type,
    page: lead.source ?? null,
  });

  if (vehicle) await db.update(partnerVehicles).set({ enquiries: sql`${partnerVehicles.enquiries} + 1` }).where(eq(partnerVehicles.id, vehicle.id));
  if (offer) await db.update(partnerOffers).set({ enquiries: sql`${partnerOffers.enquiries} + 1` }).where(eq(partnerOffers.id, offer.id));

  // A test-drive request also lands in the test-drive queue.
  let driveId: number | null = null;
  if (lead.type === "test_drive" && lead.phone) {
    const date = typeof details.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(details.date) ? details.date : null;
    const slot = (typeof details.slot === "string" && details.slot in SLOT_TIME ? details.slot : "morning") as keyof typeof SLOT_TIME;
    const requestedFor = date ? new Date(`${date}T${SLOT_TIME[slot]}:00+05:30`) : null;
    const [room] = vehicle?.showroomId
      ? [{ id: vehicle.showroomId }]
      : await db
          .select({ id: partnerShowrooms.id })
          .from(partnerShowrooms)
          .where(and(eq(partnerShowrooms.partnerId, partner.id), eq(partnerShowrooms.isActive, true)))
          .orderBy(desc(partnerShowrooms.isPrimary), asc(partnerShowrooms.id))
          .limit(1);
    const td = await insertWithReference("TD", (r) =>
      db.insert(partnerTestDrives).values({
        partnerId: partner.id,
        reference: r,
        leadId,
        customerName: name.slice(0, 120),
        mobile: lead.phone!,
        email: lead.email,
        carLabel: (carLabel ?? lead.subject ?? "To be confirmed").slice(0, 200),
        vehicleId: vehicle?.id ?? null,
        showroomId: room?.id ?? null,
        requestedFor,
        status: "requested",
      }),
    );
    driveId = td.result[0].insertId;
    await addLeadEvent(
      leadId,
      null,
      "test_drive",
      `Test drive ${td.ref} requested${date ? ` for ${new Date(`${date}T12:00:00+05:30`).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" })}, ${SLOT_LABEL[slot]}` : ""}.`,
      { testDriveId: driveId, reference: td.ref },
    );
  }

  const what = [carLabel, offer?.title].filter(Boolean).join(" · ");
  const note = driveId
    ? { kind: "test_drive", title: `New test-drive request from ${name}`, body: what || typeLabel, href: `/dealer/test-drives?td=${driveId}` }
    : { kind: "lead", title: `New enquiry from ${name}`, body: [typeLabel, what].filter(Boolean).join(" · "), href: `/dealer/enquiries/${leadId}` };
  // A new website enquiry is unassigned, so only people who see every enquiry can open it — notify just them
  // (a dealership-wide notification would show customer details to staff who can't act on it).
  const members = await db
    .select({ userId: partnerMembers.userId, role: partnerMembers.role, permissions: partnerMembers.permissions })
    .from(partnerMembers)
    .where(and(eq(partnerMembers.partnerId, partner.id), eq(partnerMembers.isActive, true)));
  for (const m of members.filter((m) => can(m, "leads.view_all"))) await notifyPartner(partner.id, { ...note, userId: m.userId });
  await logPartnerActivity(partner.id, null, "create", "lead", leadId, `Website enquiry ${ref} received (${typeLabel})`);
}
