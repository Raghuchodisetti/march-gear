"use server";

import { z } from "zod";
import { and, eq, exists, ne, not, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { adCampaigns, adCreatives, adPlacements, insInvoices, insPayments, insVendors } from "@/db/schema";
import { AD_AUDIENCE, type AdCampaignStatus, type AdCreativeStatus } from "@/db/enums";
import type { ActionResult } from "@/lib/action-result";
import { AD_CREATIVE_STATUS_LABEL, AD_STATUS_LABEL, INS_VENDOR_STATUS_LABEL, adDisplayStatus } from "@/insurance/labels";
import { audit } from "@/server/audit";
import { requireStaff } from "@/server/auth";
import { getCatalog } from "@/server/catalog";
import { isDuplicate } from "@/server/db-errors";
import { insertInsInvoice } from "@/server/insurance/billing";
import { insReference, notifyInsurer, recordInsApproval } from "@/server/insurance/records";
import { invalid, isoDate } from "@/server/validation";
import { adInvoiceDueDate, dateProblem, fullDays, listDays } from "@/server/ads/booking";
import { publicProductRef } from "@/server/ads/live";
import { mediaUsable } from "@/server/ads/media";
import { ensureAdPlacements, placementDefaults, placementDefinition, resyncAdPlacements } from "@/server/ads/placements";
import { istDate } from "@/components/portal/billing/shared";
import { adQuote, parseSize, rangeDays, rangeLabel, safeHttpsUrl, safeInternalPath } from "@/components/ads/shared";

/* ──────────────────────────────────────────────────────────────
   Staff decisions on advertising: campaigns, creatives, house
   campaigns and placements. Advertiser campaigns record every
   step in ins_approvals (shown to the vendor) and notify the
   vendor; everything is in the admin activity log.
   ────────────────────────────────────────────────────────────── */

const RACE = "Someone else just updated this. Refresh to see the latest and try again.";
const id = z.coerce.number().int().positive().max(2_147_483_647);
const isRealDay = (v: string) => {
  const t = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === v;
};
const day = isoDate.refine(isRealDay, "Choose a valid date");
const optionalRemarks = z
  .string()
  .trim()
  .max(2000, "Keep this under 2000 characters")
  .nullish()
  .transform((v) => v || null);
const requiredRemarks = (message: string) => z.string({ error: message }).trim().min(5, message).max(2000, "Keep this under 2000 characters");
const fail = (field: string, message: string) => ({ ok: false as const, error: "Please check the highlighted fields.", fieldErrors: { [field]: message } });

type Campaign = typeof adCampaigns.$inferSelect;

function touch(campaignId?: number) {
  revalidatePath("/admin", "layout");
  revalidatePath("/insurance-vendor/advertising", "layout");
  if (campaignId) revalidatePath(`/admin/advertising/${campaignId}`);
}

const vendorHref = (c: Pick<Campaign, "id">) => `/insurance-vendor/advertising/${c.id}`;

/** The line on an advertising invoice. */
const invoiceLine = (placement: string, c: Pick<Campaign, "days" | "pricePerDay" | "reference">, startsOn: string, endsOn: string) =>
  `Advertising — ${placement}, ${rangeLabel(startsOn, endsOn)} (${c.days} days × ₹${c.pricePerDay.toLocaleString("en-IN")}/day) · ${c.reference}`;

/** Approval history + notification for vendor campaigns (house and dealer campaigns have only the audit log). */
async function tellVendor(c: Campaign, e: { target: "ad_campaign" | "ad_creative"; targetId: number; action: string; from: string | null; to: string | null; remarks: string | null; actor: number; title: string; body: string }) {
  if (!c.insVendorId) return;
  await recordInsApproval({ vendorId: c.insVendorId, target: e.target, targetId: e.targetId, action: e.action, fromStatus: e.from, toStatus: e.to, remarks: e.remarks, actorUserId: e.actor, actorSide: "admin" });
  await notifyInsurer(c.insVendorId, { kind: "advertising", title: e.title, body: e.body, href: vendorHref(c) });
}

/* ── Campaign decisions ───────────────────────────────────────── */

const decision = z.discriminatedUnion("op", [
  z.object({ op: z.literal("approve"), remarks: optionalRemarks, approveCreatives: z.boolean().optional() }),
  z.object({ op: z.literal("request_changes"), remarks: requiredRemarks("Tell the advertiser what to change") }),
  z.object({ op: z.literal("reject"), remarks: requiredRemarks("Give the advertiser a reason") }),
  z.object({ op: z.literal("pause"), remarks: optionalRemarks }),
  z.object({ op: z.literal("resume"), remarks: optionalRemarks }),
  z.object({ op: z.literal("cancel"), remarks: requiredRemarks("Give the advertiser a reason") }),
  z.object({ op: z.literal("reschedule"), startsOn: day, endsOn: day, remarks: optionalRemarks }),
]);
type Op = z.infer<typeof decision>["op"];

const FROM: Record<Op, AdCampaignStatus[]> = {
  approve: ["pending_approval", "changes_requested"],
  request_changes: ["pending_approval"],
  reject: ["pending_approval", "changes_requested"],
  pause: ["approved"],
  resume: ["paused"],
  cancel: ["pending_approval", "changes_requested", "approved", "paused"],
  reschedule: ["pending_approval", "changes_requested", "approved", "paused"],
};
const TO: Partial<Record<Op, AdCampaignStatus>> = { approve: "approved", request_changes: "changes_requested", reject: "rejected", pause: "paused", resume: "approved", cancel: "cancelled" };
const ACTION: Record<Op, string> = { approve: "approved", request_changes: "changes_requested", reject: "rejected", pause: "paused", resume: "resumed", cancel: "cancelled", reschedule: "rescheduled" };

export async function adCampaignDecisionAction(campaignId: unknown, input: unknown): Promise<ActionResult<{ display: string; invoice?: string | null }>> {
  const me = await requireStaff();
  const cid = id.safeParse(campaignId);
  if (!cid.success) return { ok: false, error: "Campaign not found." };
  const parsed = decision.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const db = getDb();
  const [row] = await db.select({ c: adCampaigns, p: adPlacements }).from(adCampaigns).innerJoin(adPlacements, eq(adPlacements.id, adCampaigns.placementId)).where(eq(adCampaigns.id, cid.data));
  if (!row) return { ok: false, error: "This campaign no longer exists." };
  const { c, p } = row;
  const today = istDate();
  const shown = adDisplayStatus(c, today);
  if (!FROM[d.op].includes(c.status)) return { ok: false, error: `This campaign is ${AD_STATUS_LABEL[shown].toLowerCase()}, so that isn't available. Refresh to see the latest.` };
  const ended = c.endsOn < today;
  if ((d.op === "approve" || d.op === "pause" || d.op === "resume") && ended) return { ok: false, error: "This campaign's dates have passed. Reschedule it first." };
  if (d.op === "cancel" && (c.status === "approved" || c.status === "paused") && ended) return { ok: false, error: "This campaign has already ended." };
  // An advertiser's booking goes live (and is invoiced) only while the vendor is approved — as for its products and promotions.
  if ((d.op === "approve" || d.op === "resume") && c.insVendorId) {
    const [v] = await db.select({ status: insVendors.status }).from(insVendors).where(eq(insVendors.id, c.insVendorId));
    if (v?.status !== "approved") return { ok: false, error: `The advertiser's account is ${v ? INS_VENDOR_STATUS_LABEL[v.status].toLowerCase() : "no longer on MarchGear"}, so this booking can't be ${d.op === "approve" ? "approved" : "resumed"}. Review the vendor first.` };
  }

  const set: Partial<typeof adCampaigns.$inferInsert> = {};
  let remarks = d.remarks ?? null;
  let invoiceNumber: string | null = null;
  let approvedCreatives = 0;
  let voided = false;
  let partPaidInvoice: string | null = null;

  if (d.op === "reschedule") {
    if (d.endsOn < d.startsOn) return fail("endsOn", "The last day can't be before the first");
    if (d.startsOn === c.startsOn && d.endsOn === c.endsOn) return fail("startsOn", "Those are the current dates — choose new ones");
    const startMoved = d.startsOn !== c.startsOn;
    const problem = startMoved ? dateProblem(p, d.startsOn, d.endsOn, { minStart: today, checkLength: false }) : d.endsOn < today ? { field: "endsOn" as const, message: "The last day can't be in the past" } : null;
    if (problem) return fail(problem.field, problem.message);
    const days = rangeDays(d.startsOn, d.endsOn);
    const [inv] = await db
      .select({ id: insInvoices.id, dueOn: insInvoices.dueOn })
      .from(insInvoices)
      .where(and(eq(insInvoices.adCampaignId, c.id), eq(insInvoices.kind, "advertising"), ne(insInvoices.status, "void")));
    if (inv && days !== c.days) return fail("endsOn", `This booking is invoiced for ${c.days} days — keep the same length (move the dates) or void the invoice first`);
    const price = c.house ? { amount: 0, gst: 0, total: 0 } : adQuote(c.pricePerDay, days);
    const res = await db.transaction(async (tx) => {
      await tx.select({ id: adPlacements.id }).from(adPlacements).where(eq(adPlacements.id, p.id)).for("update");
      const soldOut = await fullDays(p, d.startsOn, d.endsOn, c.id);
      if (soldOut.length) return { soldOut };
      const [u] = await tx
        .update(adCampaigns)
        .set({ startsOn: d.startsOn, endsOn: d.endsOn, days, ...price })
        .where(and(eq(adCampaigns.id, c.id), eq(adCampaigns.status, c.status)));
      // An unpaid invoice follows the new service period (same length, so the amount is unchanged) and, when the
      // booking now starts earlier, is due by the new start date (never before today) — as on approval.
      if (u.affectedRows && inv)
        await tx
          .update(insInvoices)
          .set({ periodStart: d.startsOn, periodEnd: d.endsOn, description: invoiceLine(p.name, c, d.startsOn, d.endsOn), ...(d.startsOn < inv.dueOn ? { dueOn: d.startsOn < today ? today : d.startsOn } : {}) })
          .where(and(eq(insInvoices.id, inv.id), eq(insInvoices.status, "due")));
      return { changed: u.affectedRows > 0 };
    });
    if (res.soldOut) return fail("endsOn", `The placement is full on ${listDays(res.soldOut)}`);
    if (!res.changed) return { ok: false, error: RACE };
    remarks = [`Rescheduled to ${rangeLabel(d.startsOn, d.endsOn)} (was ${rangeLabel(c.startsOn, c.endsOn)})`, remarks].filter(Boolean).join("\n");
  } else {
    Object.assign(set, { status: TO[d.op]!, decidedBy: me.id });
    if (d.op !== "pause" && d.op !== "resume") set.adminRemarks = remarks;
    if (d.op === "approve") set.approvedAt = new Date();
    const terms = d.op === "approve" && c.insVendorId ? (await getCatalog()).content.insuranceSettings.paymentTermsDays : 0;
    const out = await db.transaction(async (tx) => {
      const [u] = await tx.update(adCampaigns).set(set).where(and(eq(adCampaigns.id, c.id), eq(adCampaigns.status, c.status)));
      if (!u.affectedRows) return null;
      let invoice: string | null = null;
      let approved = 0;
      let wasVoided = false;
      if (d.op === "approve") {
        if (d.approveCreatives) {
          const [r] = await tx.update(adCreatives).set({ status: "approved", decidedBy: me.id }).where(and(eq(adCreatives.campaignId, c.id), eq(adCreatives.status, "pending")));
          approved = r.affectedRows;
        }
        // Advertiser campaigns are invoiced once, on first approval. House campaigns aren't invoiced.
        if (c.insVendorId && !c.house && c.amount > 0) {
          const [existing] = await tx
            .select({ id: insInvoices.id })
            .from(insInvoices)
            .where(and(eq(insInvoices.adCampaignId, c.id), eq(insInvoices.kind, "advertising"), ne(insInvoices.status, "void")));
          if (!existing) {
            const inv = await insertInsInvoice(
              {
                vendorId: c.insVendorId,
                kind: "advertising",
                description: invoiceLine(p.name, c, c.startsOn, c.endsOn),
                adCampaignId: c.id,
                periodStart: c.startsOn,
                periodEnd: c.endsOn,
                amount: c.amount,
                dueOn: adInvoiceDueDate(c.startsOn, terms, today),
              },
              tx,
            );
            invoice = inv.number;
          }
        }
      }
      let partPaid: string | null = null;
      if (d.op === "cancel") {
        // Same rule as "Void invoice": a part-paid invoice stays open (the payment is settled with the vendor), never silently voided.
        const verifiedPayment = exists(
          tx
            .select({ x: sql`1` })
            .from(insPayments)
            .where(and(eq(insPayments.invoiceId, insInvoices.id), eq(insPayments.status, "verified"))),
        );
        const [v] = await tx
          .update(insInvoices)
          .set({ status: "void" })
          .where(and(eq(insInvoices.adCampaignId, c.id), eq(insInvoices.kind, "advertising"), eq(insInvoices.status, "due"), not(verifiedPayment)));
        wasVoided = v.affectedRows > 0;
        const [left] = await tx
          .select({ number: insInvoices.number })
          .from(insInvoices)
          .where(and(eq(insInvoices.adCampaignId, c.id), eq(insInvoices.kind, "advertising"), eq(insInvoices.status, "due")))
          .limit(1);
        partPaid = left?.number ?? null;
      }
      return { invoice, approved, voided: wasVoided, partPaid };
    });
    if (!out) return { ok: false, error: RACE };
    invoiceNumber = out.invoice;
    approvedCreatives = out.approved;
    voided = out.voided;
    partPaidInvoice = out.partPaid;
  }

  const after = { status: (set.status ?? c.status) as AdCampaignStatus, startsOn: d.op === "reschedule" ? d.startsOn : c.startsOn, endsOn: d.op === "reschedule" ? d.endsOn : c.endsOn };
  const display = adDisplayStatus(after, today);
  const extra = [
    invoiceNumber ? `Invoice ${invoiceNumber} has been raised — pay it by bank transfer as shown on the invoice.` : null,
    approvedCreatives ? `${approvedCreatives} creative${approvedCreatives === 1 ? "" : "s"} approved.` : null,
    voided ? "The unpaid invoice was voided." : null,
    partPaidInvoice ? `Invoice ${partPaidInvoice} is part-paid, so it was left open — MarchGear will settle that payment with you.` : null,
  ].filter(Boolean);
  const historyRemarks = [remarks, ...extra].filter(Boolean).join("\n") || null;
  const titles: Record<Op, string> = {
    approve: `Advertising approved: ${c.name}`,
    request_changes: `Changes needed on your ad booking: ${c.name}`,
    reject: `Ad booking rejected: ${c.name}`,
    pause: `Ad campaign paused: ${c.name}`,
    resume: `Ad campaign resumed: ${c.name}`,
    cancel: `Ad booking cancelled: ${c.name}`,
    reschedule: `Ad booking rescheduled: ${c.name}`,
  };
  await tellVendor(c, {
    target: "ad_campaign",
    targetId: c.id,
    action: ACTION[d.op],
    from: c.status,
    to: after.status,
    remarks: historyRemarks,
    actor: me.id,
    title: titles[d.op],
    body: historyRemarks ?? `${c.reference} is now ${AD_STATUS_LABEL[display].toLowerCase()} (${rangeLabel(after.startsOn, after.endsOn)}).`,
  });
  if (d.op === "approve" && approvedCreatives && c.insVendorId) {
    const ids = (await db.select({ id: adCreatives.id }).from(adCreatives).where(and(eq(adCreatives.campaignId, c.id), eq(adCreatives.status, "approved"), eq(adCreatives.decidedBy, me.id)))).map((r) => r.id);
    for (const cr of ids) await recordInsApproval({ vendorId: c.insVendorId, target: "ad_creative", targetId: cr, action: "approved", fromStatus: "pending", toStatus: "approved", actorUserId: me.id, actorSide: "admin" });
  }
  await audit(me.id, "status", "ad_campaign", c.id, `${AD_STATUS_LABEL[shown]} → ${AD_STATUS_LABEL[display]}: ${c.reference} ${c.name}${d.op === "reschedule" ? ` (${rangeLabel(after.startsOn, after.endsOn)})` : ""}${invoiceNumber ? ` · invoice ${invoiceNumber}` : ""}`);
  touch(c.id);
  if (invoiceNumber || voided) revalidatePath("/insurance-vendor/invoices", "layout");
  return { ok: true, display: AD_STATUS_LABEL[display], invoice: invoiceNumber };
}

/** A staff-only note on a vendor campaign (never shown to the vendor). */
export async function adCampaignNoteAction(campaignId: unknown, input: unknown): Promise<ActionResult> {
  const me = await requireStaff();
  const cid = id.safeParse(campaignId);
  const parsed = z.object({ remarks: requiredRemarks("Write the note") }).safeParse(input);
  if (!cid.success) return { ok: false, error: "Campaign not found." };
  if (!parsed.success) return invalid(parsed.error);
  const [c] = await getDb().select().from(adCampaigns).where(eq(adCampaigns.id, cid.data));
  if (!c) return { ok: false, error: "Campaign not found." };
  if (c.insVendorId)
    await recordInsApproval({ vendorId: c.insVendorId, target: "ad_campaign", targetId: c.id, action: "internal_note", remarks: parsed.data.remarks, actorUserId: me.id, actorSide: "admin" });
  await audit(me.id, "note", "ad_campaign", c.id, `Note on ${c.reference}: ${parsed.data.remarks}`);
  touch(c.id);
  return { ok: true };
}

/* ── Creative decisions ───────────────────────────────────────── */

const creativeDecision = z.discriminatedUnion("op", [
  z.object({ op: z.literal("approve"), remarks: optionalRemarks }),
  z.object({ op: z.literal("request_changes"), remarks: requiredRemarks("Tell the advertiser what to change") }),
  z.object({ op: z.literal("reject"), remarks: requiredRemarks("Give the advertiser a reason") }),
]);
const CREATIVE_FROM: Record<"approve" | "request_changes" | "reject", AdCreativeStatus[]> = {
  approve: ["pending", "changes_requested", "rejected"],
  request_changes: ["pending", "approved"],
  reject: ["pending", "approved", "changes_requested"],
};
const CREATIVE_TO = { approve: "approved", request_changes: "changes_requested", reject: "rejected" } as const;

export async function adCreativeDecisionAction(creativeId: unknown, input: unknown): Promise<ActionResult<{ status: string }>> {
  const me = await requireStaff();
  const crid = id.safeParse(creativeId);
  if (!crid.success) return { ok: false, error: "Creative not found." };
  const parsed = creativeDecision.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const db = getDb();
  const [row] = await db.select({ cr: adCreatives, c: adCampaigns }).from(adCreatives).innerJoin(adCampaigns, eq(adCampaigns.id, adCreatives.campaignId)).where(eq(adCreatives.id, crid.data));
  if (!row) return { ok: false, error: "This creative no longer exists." };
  const { cr, c } = row;
  if (!CREATIVE_FROM[d.op].includes(cr.status)) return { ok: false, error: `This creative is ${AD_CREATIVE_STATUS_LABEL[cr.status].toLowerCase()}, so that isn't available. Refresh to see the latest.` };
  if (d.op === "approve" && (!cr.desktopImage || !cr.mobileImage)) return { ok: false, error: "This creative is missing an image — ask for changes instead." };
  const to = CREATIVE_TO[d.op];
  const [res] = await db
    .update(adCreatives)
    .set({ status: to, remarks: d.remarks ?? null, decidedBy: me.id })
    .where(and(eq(adCreatives.id, cr.id), eq(adCreatives.status, cr.status)));
  if (!res.affectedRows) return { ok: false, error: RACE };
  const verb = { approve: "approved", request_changes: "needs changes", reject: "was rejected" }[d.op];
  await tellVendor(c, {
    target: "ad_creative",
    targetId: cr.id,
    action: { approve: "approved", request_changes: "changes_requested", reject: "rejected" }[d.op],
    from: cr.status,
    to,
    remarks: d.remarks ?? null,
    actor: me.id,
    title: `Creative ${verb}: ${cr.name} (${c.name})`,
    body: d.remarks ?? (d.op === "approve" ? `“${cr.name}” can now be shown on ${c.reference}.` : `“${cr.name}” on ${c.reference}.`),
  });
  await audit(me.id, "status", "ad_creative", cr.id, `${AD_CREATIVE_STATUS_LABEL[cr.status]} → ${AD_CREATIVE_STATUS_LABEL[to]}: “${cr.name}” on ${c.reference}`);
  touch(c.id);
  return { ok: true, status: AD_CREATIVE_STATUS_LABEL[to] };
}

/* ── House campaigns (MarchGear's own ads) ────────────────────── */

const houseCreative = z.object({
  desktopImage: z.string().trim().max(300).nullish(),
  mobileImage: z.string().trim().max(300).nullish(),
  headline: z.string().trim().max(120).nullish(),
  body: z.string().trim().max(240).nullish(),
  ctaLabel: z.string().trim().max(40).nullish(),
  alt: z.string({ error: "Describe the banner for screen readers" }).trim().min(5, "Describe the banner for screen readers").max(200),
});

const houseInput = z.object({
  placementId: id,
  name: z.string({ error: "Name the campaign" }).trim().min(3, "Name the campaign").max(160),
  startsOn: day,
  endsOn: day,
  targetUrl: z.string().trim().max(300).nullish(),
  productId: z.coerce.number().int().positive().nullish(),
  creative: houseCreative.nullish(),
});

/** Validates a house target: an internal path (any public page) or an https URL. */
function houseTarget(raw: string | null | undefined) {
  const v = (raw ?? "").trim();
  if (!v) return { error: "Enter where the banner links to: a /path on MarchGear or an https:// address" };
  const path = v.startsWith("/") ? safeInternalPath(v) : null;
  const url = path ? null : safeHttpsUrl(v);
  return path || url ? { value: (path || url)! } : { error: "Use a /path on MarchGear (not an admin or portal page) or a full https:// address" };
}

export async function createHouseCampaignAction(input: unknown): Promise<ActionResult<{ id: number; reference: string }>> {
  const me = await requireStaff();
  const parsed = houseInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  await ensureAdPlacements();
  const db = getDb();
  const [p] = await db.select().from(adPlacements).where(eq(adPlacements.id, d.placementId));
  if (!p) return fail("placementId", "Choose a placement");
  if (!p.isActive) return fail("placementId", "This placement is switched off — turn it on in Placements & pricing first");
  const problem = dateProblem(p, d.startsOn, d.endsOn, { minStart: istDate(), checkLength: false });
  if (problem) return fail(problem.field, problem.message);

  let productId: number | null = null;
  let targetUrl: string | null = null;
  if (p.format === "sponsored_listing") {
    if (!d.productId || !(await publicProductRef(d.productId))) return fail("productId", "Choose a published product");
    productId = d.productId;
  } else {
    const t = houseTarget(d.targetUrl);
    if ("error" in t) return fail("targetUrl", t.error!);
    targetUrl = t.value;
    const c = d.creative;
    if (!c?.desktopImage) return fail("creative.desktopImage", "Choose the desktop banner");
    if (!c.mobileImage) return fail("creative.mobileImage", "Choose the mobile banner");
    if (!(await mediaUsable([c.desktopImage, c.mobileImage]))) return fail("creative.desktopImage", "Choose images from the media library");
  }

  const days = rangeDays(d.startsOn, d.endsOn);
  let created: { id: number; reference: string } | null = null;
  let soldOut: string[] = [];
  for (let attempt = 1; attempt <= 5 && !created; attempt++) {
    const reference = insReference("ADS");
    try {
      created = await db.transaction(async (tx) => {
        await tx.select({ id: adPlacements.id }).from(adPlacements).where(eq(adPlacements.id, p.id)).for("update");
        soldOut = await fullDays(p, d.startsOn, d.endsOn);
        if (soldOut.length) return null;
        const now = new Date();
        const [res] = await tx.insert(adCampaigns).values({
          reference,
          placementId: p.id,
          house: true,
          name: d.name,
          productId,
          targetUrl,
          startsOn: d.startsOn,
          endsOn: d.endsOn,
          days,
          pricePerDay: 0,
          amount: 0,
          gst: 0,
          total: 0,
          status: "approved",
          submittedAt: now,
          approvedAt: now,
          decidedBy: me.id,
          createdBy: me.id,
        });
        if (p.format === "banner" && d.creative)
          await tx.insert(adCreatives).values({
            campaignId: res.insertId,
            name: "Main creative",
            desktopImage: d.creative.desktopImage!,
            mobileImage: d.creative.mobileImage!,
            headline: d.creative.headline || null,
            body: d.creative.body || null,
            ctaLabel: d.creative.ctaLabel || null,
            alt: d.creative.alt,
            status: "approved",
            decidedBy: me.id,
          });
        return { id: res.insertId, reference };
      });
      if (!created) break;
    } catch (err) {
      if (!isDuplicate(err) || attempt === 5) throw err;
    }
  }
  if (!created) return fail("endsOn", `The placement is full on ${listDays(soldOut)}`);
  await audit(me.id, "create", "ad_campaign", created.id, `House campaign ${created.reference} “${d.name}” on ${p.name}, ${rangeLabel(d.startsOn, d.endsOn)}`);
  touch(created.id);
  return { ok: true, ...created };
}

const houseCreativeInput = z.object({ campaignId: id, creativeId: id.nullish(), creative: houseCreative });

/** Adds or replaces a creative on a house campaign (approved straight away — staff made it). */
export async function saveHouseCreativeAction(input: unknown): Promise<ActionResult> {
  const me = await requireStaff();
  const parsed = houseCreativeInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { campaignId, creativeId, creative: c } = parsed.data;
  const db = getDb();
  const [row] = await db.select({ c: adCampaigns, format: adPlacements.format }).from(adCampaigns).innerJoin(adPlacements, eq(adPlacements.id, adCampaigns.placementId)).where(eq(adCampaigns.id, campaignId));
  if (!row || !row.c.house) return { ok: false, error: "Only house campaigns take creatives from here." };
  if (row.format !== "banner") return { ok: false, error: "Sponsored listings don't use creatives." };
  if (!c.desktopImage) return fail("creative.desktopImage", "Choose the desktop banner");
  if (!c.mobileImage) return fail("creative.mobileImage", "Choose the mobile banner");
  if (!(await mediaUsable([c.desktopImage, c.mobileImage]))) return fail("creative.desktopImage", "Choose images from the media library");
  const values = { desktopImage: c.desktopImage, mobileImage: c.mobileImage, headline: c.headline || null, body: c.body || null, ctaLabel: c.ctaLabel || null, alt: c.alt, status: "approved" as const, remarks: null, decidedBy: me.id };
  if (creativeId) {
    const [res] = await db.update(adCreatives).set(values).where(and(eq(adCreatives.id, creativeId), eq(adCreatives.campaignId, campaignId)));
    if (!res.affectedRows) return { ok: false, error: "Creative not found." };
  } else {
    const existing = await db.select({ id: adCreatives.id }).from(adCreatives).where(eq(adCreatives.campaignId, campaignId));
    if (existing.length >= 6) return { ok: false, error: "A campaign can have up to 6 creatives." };
    await db.insert(adCreatives).values({ campaignId, name: `Creative ${existing.length + 1}`, ...values });
  }
  await audit(me.id, creativeId ? "update" : "create", "ad_creative", creativeId ?? campaignId, `${creativeId ? "Replaced" : "Added"} a creative on house campaign ${row.c.reference}`);
  touch(campaignId);
  return { ok: true };
}

/* ── Placements & pricing ─────────────────────────────────────── */

const sizeField = z
  .string()
  .trim()
  .max(20)
  .nullish()
  .transform((v) => v || null)
  .refine((v) => v === null || parseSize(v) !== null, "Use width × height in pixels, e.g. 1600×400")
  .transform((v) => {
    const s = parseSize(v);
    return s ? `${s.w}×${s.h}` : null;
  });
const placementInput = z
  .object({
    name: z.string().trim().min(3, "Enter a name").max(120),
    description: z.string().trim().min(5, "Describe the placement").max(300),
    location: z.string().trim().min(3, "Say where it appears").max(160),
    desktopSize: sizeField,
    mobileSize: sizeField,
    pricePerDay: z.coerce.number({ error: "Enter a price" }).int("Use whole rupees").min(0).max(10_000_000),
    minDays: z.coerce.number().int().min(1, "At least 1 day").max(365),
    maxDays: z.coerce.number().int().min(1).max(365, "At most 365 days"),
    slots: z.coerce.number().int().min(1, "At least 1 slot").max(20, "At most 20 slots"),
    audience: z.enum(AD_AUDIENCE),
    isActive: z.boolean(),
  })
  .refine((v) => v.maxDays >= v.minDays, { path: ["maxDays"], message: "Must be at least the minimum" });

export async function updatePlacementAction(placementId: unknown, input: unknown): Promise<ActionResult> {
  const me = await requireStaff();
  const pid = id.safeParse(placementId);
  if (!pid.success) return { ok: false, error: "Placement not found." };
  const parsed = placementInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const db = getDb();
  const [p] = await db.select().from(adPlacements).where(eq(adPlacements.id, pid.data));
  if (!p) return { ok: false, error: "Placement not found." };
  const v = parsed.data;
  if (p.format === "banner" && (!v.desktopSize || !v.mobileSize)) return fail(v.desktopSize ? "mobileSize" : "desktopSize", "Banners need both recommended sizes");
  const changes = (Object.keys(v) as (keyof typeof v)[]).filter((k) => String(v[k] ?? "") !== String(p[k] ?? ""));
  if (!changes.length) return { ok: true };
  await db.update(adPlacements).set(v).where(eq(adPlacements.id, p.id));
  const fmt = (k: keyof typeof v, x: unknown) => (k === "pricePerDay" ? `₹${Number(x).toLocaleString("en-IN")}` : k === "isActive" ? (x ? "on" : "off") : String(x ?? "—"));
  await audit(me.id, "update", "ad_placement", p.id, `${p.name}: ${changes.map((k) => `${k} ${fmt(k, p[k])} → ${fmt(k, v[k])}`).join("; ")}`);
  touch();
  revalidatePath("/admin/advertising/placements");
  return { ok: true };
}

/** Puts a placement back to its launch settings from the code (src/ads/placements.ts). */
export async function restorePlacementDefaultsAction(placementId: unknown): Promise<ActionResult> {
  const me = await requireStaff();
  const pid = id.safeParse(placementId);
  if (!pid.success) return { ok: false, error: "Placement not found." };
  const db = getDb();
  const [p] = await db.select().from(adPlacements).where(eq(adPlacements.id, pid.data));
  const def = p ? placementDefinition(p.key) : undefined;
  if (!p || !def) return { ok: false, error: "This placement has no launch defaults." };
  const { key: _key, ...defaults } = placementDefaults(def);
  void _key;
  await db.update(adPlacements).set(defaults).where(eq(adPlacements.id, p.id));
  resyncAdPlacements();
  await audit(me.id, "reset", "ad_placement", p.id, `${p.name}: restored the launch defaults (₹${def.pricePerDay.toLocaleString("en-IN")}/day, ${def.slots} slots, ${def.minDays}–${def.maxDays} days)`);
  touch();
  revalidatePath("/admin/advertising/placements");
  return { ok: true };
}
