"use server";

import { z } from "zod";
import { and, count, eq, exists, inArray, not, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { adCampaigns, adCreatives, adPlacements, insInvoices, insPayments } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { AD_STATUS_LABEL, adDisplayStatus } from "@/insurance/labels";
import { insurerAction, isInsurerError, type InsurerContext } from "@/server/insurance/context";
import { insReference, logInsurerActivity, recordInsApproval } from "@/server/insurance/records";
import { isDuplicate } from "@/server/db-errors";
import { invalid, isoDate } from "@/server/validation";
import { ensureAdPlacements } from "@/server/ads/placements";
import { dateProblem, fullDays, listDays, resolveVendorTarget } from "@/server/ads/booking";
import { mediaUsable } from "@/server/ads/media";
import { istDate } from "@/components/portal/billing/shared";
import { TARGET_KINDS, adQuote, rangeDays, rangeLabel } from "@/components/ads/shared";

/* ──────────────────────────────────────────────────────────────
   The vendor side of advertising: book a placement, change dates
   while it's in review, add or replace creatives, cancel before it
   starts. Everything is scoped by ctx.vendor.id and needs
   "ads.manage" at an approved vendor.
   ────────────────────────────────────────────────────────────── */

const MAX_CREATIVES = 6;
const RACE = "Someone else just updated this booking. Refresh to see the latest and try again.";

const isRealDay = (v: string) => {
  const t = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === v;
};
const day = isoDate.refine(isRealDay, "Choose a valid date");
const id = z.coerce.number().int().positive().max(2_147_483_647);
const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .nullish()
    .transform((v) => v || null);
const image = z
  .string()
  .trim()
  .max(300)
  .nullish()
  .transform((v) => v || null);

const creativeInput = z.object({
  name: opt(120),
  desktopImage: image,
  mobileImage: image,
  headline: opt(120),
  body: opt(240),
  ctaLabel: opt(40),
  alt: z.string({ error: "Describe the banner for people using screen readers" }).trim().min(5, "Describe the banner for people using screen readers").max(200, "Keep this under 200 characters"),
});
type CreativeInput = z.infer<typeof creativeInput>;

const targetInput = z.object({
  kind: z.enum(TARGET_KINDS, { error: "Choose where the ad links to" }),
  productId: z.coerce.number().int().positive().nullish(),
  path: z.string().max(300).nullish(),
  url: z.string().max(300).nullish(),
});

const ok = <T extends object>(v: T) => ({ ok: true as const, ...v });
const fail = (field: string, message: string) => ({ ok: false as const, error: "Please check the highlighted fields.", fieldErrors: { [field]: message } });

function touch(campaignId?: number) {
  revalidatePath("/insurance-vendor/advertising");
  if (campaignId) revalidatePath(`/insurance-vendor/advertising/${campaignId}`);
  revalidatePath("/admin", "layout");
}

/** A bookable placement for this vendor: active, open to insurers. */
async function bookablePlacement(placementId: number) {
  await ensureAdPlacements();
  const [p] = await getDb().select().from(adPlacements).where(eq(adPlacements.id, placementId));
  if (!p || !p.isActive || (p.audience !== "all" && p.audience !== "insurer")) return null;
  return p;
}

/** Checks a banner creative: both images, uploaded by this vendor. */
async function creativeProblem(ctx: InsurerContext, c: CreativeInput, prefix: string): Promise<Record<string, string> | null> {
  const errors: Record<string, string> = {};
  if (!c.desktopImage) errors[`${prefix}.desktopImage`] = "Upload the desktop banner";
  if (!c.mobileImage) errors[`${prefix}.mobileImage`] = "Upload the mobile banner";
  if (Object.keys(errors).length) return errors;
  if (!(await mediaUsable([c.desktopImage!, c.mobileImage!], ctx.vendor.id))) errors[`${prefix}.desktopImage`] = "Upload the banners again — those images aren't in your media library";
  return Object.keys(errors).length ? errors : null;
}

const creativeValues = (c: CreativeInput, fallbackName: string) => ({
  name: c.name || fallbackName,
  desktopImage: c.desktopImage,
  mobileImage: c.mobileImage,
  headline: c.headline,
  body: c.body,
  ctaLabel: c.ctaLabel,
  alt: c.alt,
});

/* ── Availability ─────────────────────────────────────────────── */

const availabilityInput = z.object({ placementId: id, startsOn: day, endsOn: day, campaignId: id.optional() });

/** Live availability and price for a date range (the wizard calls this as dates change). */
export async function checkAdAvailabilityAction(input: unknown): Promise<ActionResult<{ soldOut: string[]; days: number; amount: number; gst: number; total: number }>> {
  const ctx = await insurerAction("ads.manage");
  if (isInsurerError(ctx)) return ctx;
  const parsed = availabilityInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { placementId, startsOn, endsOn, campaignId } = parsed.data;
  const p = await bookablePlacement(placementId);
  if (!p) return { ok: false, error: "That placement isn't open for booking." };
  if (campaignId) {
    const [own] = await getDb().select({ id: adCampaigns.id }).from(adCampaigns).where(and(eq(adCampaigns.id, campaignId), eq(adCampaigns.insVendorId, ctx.vendor.id)));
    if (!own) return { ok: false, error: "Booking not found." };
  }
  const problem = dateProblem(p, startsOn, endsOn);
  if (problem) return fail(problem.field, problem.message);
  const soldOut = await fullDays(p, startsOn, endsOn, campaignId);
  const days = rangeDays(startsOn, endsOn);
  return ok({ soldOut, days, ...adQuote(p.pricePerDay, days) });
}

/* ── Book ─────────────────────────────────────────────────────── */

const bookInput = z.object({
  placementId: id,
  startsOn: day,
  endsOn: day,
  name: z.string({ error: "Name the campaign" }).trim().min(3, "Name the campaign (at least 3 characters)").max(160, "Keep this under 160 characters"),
  target: targetInput,
  creative: creativeInput.nullish(),
  confirm: z.literal(true, { error: "Please confirm the booking terms" }),
});

export async function bookAdCampaignAction(input: unknown): Promise<ActionResult<{ id: number; reference: string; total: number }>> {
  const ctx = await insurerAction("ads.manage");
  if (isInsurerError(ctx)) return ctx;
  const parsed = bookInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const p = await bookablePlacement(d.placementId);
  if (!p) return fail("placementId", "That placement isn't open for booking any more — choose another");

  const problem = dateProblem(p, d.startsOn, d.endsOn);
  if (problem) return fail(problem.field, problem.message);
  const target = await resolveVendorTarget(ctx.vendor.id, p.format, d.target);
  if ("field" in target) return fail(target.field, target.message);
  if (p.format === "banner") {
    if (!d.creative) return fail("creative.desktopImage", "Upload the desktop banner");
    const bad = await creativeProblem(ctx, d.creative, "creative");
    if (bad) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: bad };
  }

  const days = rangeDays(d.startsOn, d.endsOn);
  const price = adQuote(p.pricePerDay, days);
  const db = getDb();
  let created: { id: number; reference: string; creativeId: number | null } | null = null;
  let soldOut: string[] = [];
  for (let attempt = 1; attempt <= 5 && !created; attempt++) {
    const reference = insReference("ADS");
    try {
      created = await db.transaction(async (tx) => {
        // Serialise bookings on this placement so two people can't take the last slot at once.
        await tx.select({ id: adPlacements.id }).from(adPlacements).where(eq(adPlacements.id, p.id)).for("update");
        soldOut = await fullDays(p, d.startsOn, d.endsOn);
        if (soldOut.length) return null;
        const [res] = await tx.insert(adCampaigns).values({
          reference,
          placementId: p.id,
          insVendorId: ctx.vendor.id,
          house: false,
          name: d.name,
          productId: target.productId,
          targetUrl: target.targetUrl,
          startsOn: d.startsOn,
          endsOn: d.endsOn,
          days,
          pricePerDay: p.pricePerDay,
          amount: price.amount,
          gst: price.gst,
          total: price.total,
          status: "pending_approval",
          submittedAt: new Date(),
          createdBy: ctx.user.id,
        });
        let creativeId: number | null = null;
        if (p.format === "banner" && d.creative) {
          const [cr] = await tx.insert(adCreatives).values({ campaignId: res.insertId, status: "pending", ...creativeValues(d.creative, "Main creative") });
          creativeId = cr.insertId;
        }
        return { id: res.insertId, reference, creativeId };
      });
      if (!created) break;
    } catch (err) {
      if (!isDuplicate(err) || attempt === 5) throw err;
    }
  }
  if (!created) return fail("endsOn", `Fully booked on ${listDays(soldOut)} — choose other dates`);

  await recordInsApproval({ vendorId: ctx.vendor.id, target: "ad_campaign", targetId: created.id, action: "submitted", toStatus: "pending_approval", actorUserId: ctx.user.id, actorSide: "vendor" });
  if (created.creativeId) await recordInsApproval({ vendorId: ctx.vendor.id, target: "ad_creative", targetId: created.creativeId, action: "submitted", toStatus: "pending", actorUserId: ctx.user.id, actorSide: "vendor" });
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "create", "ad_campaign", created.id, `Booked ${p.name} for ${rangeLabel(d.startsOn, d.endsOn)} (${created.reference})`);
  touch(created.id);
  return ok({ id: created.id, reference: created.reference, total: price.total });
}

/* ── Change an existing booking ───────────────────────────────── */

async function ownCampaign(ctx: InsurerContext, campaignId: number) {
  const [row] = await getDb()
    .select({ c: adCampaigns, p: adPlacements })
    .from(adCampaigns)
    .innerJoin(adPlacements, eq(adPlacements.id, adCampaigns.placementId))
    .where(and(eq(adCampaigns.id, campaignId), eq(adCampaigns.insVendorId, ctx.vendor.id)));
  return row ?? null;
}

const datesInput = z.object({ id, startsOn: day, endsOn: day });

/** New dates while the booking is in review or has changes requested (the price follows the booked rate). */
export async function updateAdDatesAction(input: unknown): Promise<ActionResult<{ total: number }>> {
  const ctx = await insurerAction("ads.manage");
  if (isInsurerError(ctx)) return ctx;
  const parsed = datesInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const row = await ownCampaign(ctx, d.id);
  if (!row) return { ok: false, error: "Booking not found." };
  const { c, p } = row;
  if (c.status !== "pending_approval" && c.status !== "changes_requested") return { ok: false, error: "Dates can only be changed while the booking is in review or has changes requested." };
  const problem = dateProblem(p, d.startsOn, d.endsOn);
  if (problem) return fail(problem.field, problem.message);
  const days = rangeDays(d.startsOn, d.endsOn);
  const price = adQuote(c.pricePerDay, days);
  const db = getDb();
  const result = await db.transaction(async (tx) => {
    await tx.select({ id: adPlacements.id }).from(adPlacements).where(eq(adPlacements.id, p.id)).for("update");
    const soldOut = await fullDays(p, d.startsOn, d.endsOn, c.id);
    if (soldOut.length) return { soldOut };
    const [res] = await tx
      .update(adCampaigns)
      .set({ startsOn: d.startsOn, endsOn: d.endsOn, days, amount: price.amount, gst: price.gst, total: price.total })
      .where(and(eq(adCampaigns.id, c.id), eq(adCampaigns.status, c.status)));
    return { changed: res.affectedRows > 0 };
  });
  if (result.soldOut) return fail("endsOn", `Fully booked on ${listDays(result.soldOut)} — choose other dates`);
  if (!result.changed) return { ok: false, error: RACE };
  await recordInsApproval({
    vendorId: ctx.vendor.id,
    target: "ad_campaign",
    targetId: c.id,
    action: "dates_changed",
    fromStatus: c.status,
    toStatus: c.status,
    remarks: `${rangeLabel(d.startsOn, d.endsOn)} (was ${rangeLabel(c.startsOn, c.endsOn)})`,
    actorUserId: ctx.user.id,
    actorSide: "vendor",
  });
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "update", "ad_campaign", c.id, `Changed the dates of ${c.reference} to ${rangeLabel(d.startsOn, d.endsOn)}`);
  touch(c.id);
  return ok({ total: price.total });
}

/** Sends a booking with changes requested back for review. */
export async function resubmitAdCampaignAction(input: unknown): Promise<ActionResult> {
  const ctx = await insurerAction("ads.manage");
  if (isInsurerError(ctx)) return ctx;
  const parsed = z.object({ id }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Booking not found." };
  const row = await ownCampaign(ctx, parsed.data.id);
  if (!row) return { ok: false, error: "Booking not found." };
  const { c, p } = row;
  if (c.status !== "changes_requested") return { ok: false, error: "Only bookings with changes requested can be resubmitted." };
  if (c.endsOn < istDate()) return { ok: false, error: "This booking's dates have passed. Change the dates first." };
  if (p.format === "banner") {
    const [{ usable }] = await getDb()
      .select({ usable: count() })
      .from(adCreatives)
      .where(and(eq(adCreatives.campaignId, c.id), inArray(adCreatives.status, ["pending", "approved"])));
    if (!usable) return { ok: false, error: "Replace the creative MarchGear asked you to change (or add a new one) before resubmitting." };
  }
  const [res] = await getDb()
    .update(adCampaigns)
    .set({ status: "pending_approval", submittedAt: new Date() })
    .where(and(eq(adCampaigns.id, c.id), eq(adCampaigns.status, "changes_requested")));
  if (!res.affectedRows) return { ok: false, error: RACE };
  await recordInsApproval({ vendorId: ctx.vendor.id, target: "ad_campaign", targetId: c.id, action: "resubmitted", fromStatus: c.status, toStatus: "pending_approval", actorUserId: ctx.user.id, actorSide: "vendor" });
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "submit", "ad_campaign", c.id, `Resubmitted ${c.reference} for review`);
  touch(c.id);
  return { ok: true };
}

const cancelInput = z.object({ id, reason: opt(500) });

/** Cancels a booking before it starts. An unpaid invoice for it is voided. */
export async function cancelAdCampaignAction(input: unknown): Promise<ActionResult<{ voided: boolean; paid: boolean }>> {
  const ctx = await insurerAction("ads.manage");
  if (isInsurerError(ctx)) return ctx;
  const parsed = cancelInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const row = await ownCampaign(ctx, parsed.data.id);
  if (!row) return { ok: false, error: "Booking not found." };
  const { c } = row;
  const today = istDate();
  const shown = adDisplayStatus(c, today);
  const cancellable = c.status === "pending_approval" || c.status === "changes_requested" || ((c.status === "approved" || c.status === "paused") && c.startsOn > today);
  if (!cancellable) return { ok: false, error: `This booking is ${AD_STATUS_LABEL[shown].toLowerCase()}, so it can't be cancelled here. Contact MarchGear support.` };
  const db = getDb();
  // A part-paid invoice is never voided (that would strand the money MarchGear received) — support settles those.
  const verifiedPayment = exists(
    db
      .select({ x: sql`1` })
      .from(insPayments)
      .where(and(eq(insPayments.invoiceId, insInvoices.id), eq(insPayments.status, "verified"))),
  );
  const [partPaid] = await db
    .select({ number: insInvoices.number })
    .from(insInvoices)
    .where(and(eq(insInvoices.adCampaignId, c.id), eq(insInvoices.vendorId, ctx.vendor.id), eq(insInvoices.kind, "advertising"), eq(insInvoices.status, "due"), verifiedPayment))
    .limit(1);
  if (partPaid) return { ok: false, error: `Part of invoice ${partPaid.number} for this booking has already been paid, so it can't be cancelled here. Contact MarchGear support — they'll cancel it and settle the payment with you.` };
  const out = await db.transaction(async (tx) => {
    const [res] = await tx.update(adCampaigns).set({ status: "cancelled" }).where(and(eq(adCampaigns.id, c.id), eq(adCampaigns.status, c.status)));
    if (!res.affectedRows) return null;
    const [v] = await tx
      .update(insInvoices)
      .set({ status: "void" })
      .where(and(eq(insInvoices.adCampaignId, c.id), eq(insInvoices.vendorId, ctx.vendor.id), eq(insInvoices.kind, "advertising"), eq(insInvoices.status, "due"), not(verifiedPayment)));
    const paid = await tx
      .select({ id: insInvoices.id })
      .from(insInvoices)
      .where(and(eq(insInvoices.adCampaignId, c.id), eq(insInvoices.kind, "advertising"), inArray(insInvoices.status, ["paid", "verifying"])));
    return { voided: v.affectedRows > 0, paid: paid.length > 0 };
  });
  if (!out) return { ok: false, error: RACE };
  const note = [parsed.data.reason, out.voided ? "The unpaid invoice was voided." : null, out.paid ? "A payment was recorded against this booking — MarchGear will contact you about a refund." : null].filter(Boolean).join("\n");
  await recordInsApproval({ vendorId: ctx.vendor.id, target: "ad_campaign", targetId: c.id, action: "cancelled", fromStatus: c.status, toStatus: "cancelled", remarks: note || null, actorUserId: ctx.user.id, actorSide: "vendor" });
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "cancel", "ad_campaign", c.id, `Cancelled ${c.reference}`);
  touch(c.id);
  revalidatePath("/insurance-vendor/invoices");
  return ok(out);
}

/* ── Creatives ────────────────────────────────────────────────── */

/** Campaigns that still take creatives: banners, not rejected/cancelled, not ended. */
function creativeLock(c: typeof adCampaigns.$inferSelect, format: string) {
  if (format !== "banner") return "Sponsored listings use your product's own details — there's no creative to upload.";
  if (c.status === "rejected" || c.status === "cancelled") return "This booking is closed.";
  if (c.endsOn < istDate()) return "This campaign has ended.";
  return null;
}

const addCreativeInput = z.object({ campaignId: id, creative: creativeInput });

export async function addAdCreativeAction(input: unknown): Promise<ActionResult<{ id: number }>> {
  const ctx = await insurerAction("ads.manage");
  if (isInsurerError(ctx)) return ctx;
  const parsed = addCreativeInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const row = await ownCampaign(ctx, parsed.data.campaignId);
  if (!row) return { ok: false, error: "Booking not found." };
  const lock = creativeLock(row.c, row.p.format);
  if (lock) return { ok: false, error: lock };
  const bad = await creativeProblem(ctx, parsed.data.creative, "creative");
  if (bad) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: bad };
  const db = getDb();
  const [{ n }] = await db.select({ n: count() }).from(adCreatives).where(eq(adCreatives.campaignId, row.c.id));
  if (n >= MAX_CREATIVES) return { ok: false, error: `A booking can have up to ${MAX_CREATIVES} creatives. Replace one instead.` };
  const [res] = await db.insert(adCreatives).values({ campaignId: row.c.id, status: "pending", ...creativeValues(parsed.data.creative, `Creative ${n + 1}`) });
  await recordInsApproval({ vendorId: ctx.vendor.id, target: "ad_creative", targetId: res.insertId, action: "submitted", toStatus: "pending", actorUserId: ctx.user.id, actorSide: "vendor" });
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "create", "ad_creative", res.insertId, `Added a creative to ${row.c.reference}`);
  touch(row.c.id);
  return ok({ id: res.insertId });
}

const replaceCreativeInput = z.object({ creativeId: id, creative: creativeInput });

/** Replaces a creative's images and text. It goes back to "awaiting review" and isn't shown until approved. */
export async function replaceAdCreativeAction(input: unknown): Promise<ActionResult> {
  const ctx = await insurerAction("ads.manage");
  if (isInsurerError(ctx)) return ctx;
  const parsed = replaceCreativeInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const db = getDb();
  const [cr] = await db.select().from(adCreatives).where(eq(adCreatives.id, parsed.data.creativeId));
  const row = cr ? await ownCampaign(ctx, cr.campaignId) : null;
  if (!cr || !row) return { ok: false, error: "Creative not found." };
  const lock = creativeLock(row.c, row.p.format);
  if (lock) return { ok: false, error: lock };
  const bad = await creativeProblem(ctx, parsed.data.creative, "creative");
  if (bad) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: bad };
  const [res] = await db
    .update(adCreatives)
    .set({ ...creativeValues(parsed.data.creative, cr.name), status: "pending", remarks: null, decidedBy: null })
    .where(and(eq(adCreatives.id, cr.id), eq(adCreatives.status, cr.status)));
  if (!res.affectedRows) return { ok: false, error: RACE };
  await recordInsApproval({ vendorId: ctx.vendor.id, target: "ad_creative", targetId: cr.id, action: "resubmitted", fromStatus: cr.status, toStatus: "pending", actorUserId: ctx.user.id, actorSide: "vendor" });
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "update", "ad_creative", cr.id, `Replaced creative “${cr.name}” on ${row.c.reference}`);
  touch(row.c.id);
  return { ok: true };
}

/** Removes a creative (a booking keeps at least one). */
export async function removeAdCreativeAction(input: unknown): Promise<ActionResult> {
  const ctx = await insurerAction("ads.manage");
  if (isInsurerError(ctx)) return ctx;
  const parsed = z.object({ creativeId: id }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Creative not found." };
  const db = getDb();
  const [cr] = await db.select().from(adCreatives).where(eq(adCreatives.id, parsed.data.creativeId));
  const row = cr ? await ownCampaign(ctx, cr.campaignId) : null;
  if (!cr || !row) return { ok: false, error: "Creative not found." };
  if (row.c.status === "rejected" || row.c.status === "cancelled") return { ok: false, error: "This booking is closed." };
  const [{ n }] = await db.select({ n: count() }).from(adCreatives).where(eq(adCreatives.campaignId, row.c.id));
  if (n <= 1) return { ok: false, error: "A banner booking needs at least one creative. Replace it instead." };
  await db.delete(adCreatives).where(eq(adCreatives.id, cr.id));
  await recordInsApproval({ vendorId: ctx.vendor.id, target: "ad_creative", targetId: cr.id, action: "removed", fromStatus: cr.status, remarks: `Removed “${cr.name}”`, actorUserId: ctx.user.id, actorSide: "vendor" });
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "delete", "ad_creative", cr.id, `Removed creative “${cr.name}” from ${row.c.reference}`);
  touch(row.c.id);
  return { ok: true };
}
