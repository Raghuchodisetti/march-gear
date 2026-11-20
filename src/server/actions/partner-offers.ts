"use server";

import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { media, partnerFiles, partnerOffers, partnerShowrooms } from "@/db/schema";
import { OFFER_CATEGORIES, type OfferStatus } from "@/db/enums";
import type { ActionResult } from "@/lib/action-result";
import { OFFER_STATUS_LABEL, offerDisplayStatus } from "@/partner/labels";
import { invalid } from "@/server/validation";
import { isDuplicate } from "@/server/db-errors";
import { expireCatalog } from "@/server/catalog";
import { offerLimitError } from "@/server/partner/limits";
import { isActionError, partnerAction, type PartnerContext } from "@/server/partner/context";
import { logPartnerActivity, notifyPartner, recordApproval, reference } from "@/server/partner/records";
import { getEditorOptions, getOffer, offerHistory, offerToInput, type OfferRow } from "@/server/partner/offers";
import { INDIAN_STATES, addDays, fromIstParts, hasBenefit, istDay, money, toIstParts } from "@/components/offers/offer-utils";
import { OFFER_DRAFT_STATUSES, OFFER_LIVE_STATUSES, OFFER_REVIEW_STATUSES, type ApprovalEntry, type OfferInput } from "@/components/portal/offers/offer-input";

/* ──────────────────────────────────────────────────────────────
   Dealer offers: autosaved drafts, submission for approval and the
   dealer-side lifecycle (withdraw, pause/resume, cancel, duplicate).
   Every action checks the session + permission and is scoped to the
   signed-in dealership. Admin decisions live in the admin panel.
   ────────────────────────────────────────────────────────────── */

const slug = z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/, "Pick from the list");
const amount = z.number().int("Use whole rupees").min(0, "This can't be negative").max(10_000_000, "That's more than ₹1 crore — check the figure").nullable();
const units = z.number().int("Use a whole number").min(1, "Use at least 1").max(1_000_000, "That's too many").nullable();
const mediaUrl = z.string().trim().max(500).regex(/^\/media\/\d+\/[\w.-]+$/, "Upload this image again");
const fileRef = z.object({ id: z.number().int().positive(), filename: z.string().max(200), mime: z.string().max(60), size: z.number().int().min(0) });
const text = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters`);

const inputSchema = z.object({
  title: text(160),
  campaignName: text(160),
  category: z.union([z.enum(OFFER_CATEGORIES), z.literal("")]),
  description: text(4000),
  tagline: text(200),
  terms: text(6000),
  scope: z.object({
    vehicleType: z.enum(["new", "used", "both"]),
    allModels: z.boolean(),
    brands: z.array(slug).max(40),
    models: z.array(slug).max(300),
    variants: z.array(z.string().trim().max(250)).max(800),
  }),
  discount: z.object({
    flat: amount,
    percentage: z.number().min(0, "This can't be negative").max(100, "A percentage can't be over 100").nullable(),
    cash: amount,
    exchangeBonus: amount,
    corporateBonus: amount,
    loyaltyBonus: amount,
    freeAccessories: text(300),
    freeInsurance: z.boolean(),
    financeBenefit: text(300),
    maxDiscount: amount,
    minPurchase: text(300),
  }),
  startDate: z.string().max(10),
  startTime: z.string().max(5),
  endDate: z.string().max(10),
  endTime: z.string().max(5),
  limitedStock: units,
  maxRedemptions: units,
  media: z.object({
    desktopBanner: z.union([z.literal(""), mediaUrl]),
    mobileBanner: z.union([z.literal(""), mediaUrl]),
    thumbnail: z.union([z.literal(""), mediaUrl]),
    gallery: z.array(mediaUrl).max(8, "Up to 8 gallery images"),
    videoUrl: text(500),
    brochure: fileRef.nullable(),
  }),
  locations: z.object({
    mode: z.enum(["all", "branches", "cities", "states"]),
    showroomIds: z.array(z.number().int().positive()).max(200),
    cities: z.array(z.string().trim().min(2, "City names need at least 2 letters").max(64)).max(100, "Up to 100 cities"),
    states: z.array(z.string().trim().max(64)).max(40),
  }),
}) satisfies z.ZodType<OfferInput>;

const saveSchema = inputSchema.extend({ id: z.number().int().positive().optional() });
const submitSchema = saveSchema.extend({ confirmTerms: z.boolean() });
const idSchema = z.object({ id: z.number().int().positive() });

type Issues = Record<string, string>;
type Ctx = PartnerContext;

/* ── Checks ─────────────────────────────────────────────────── */

const mediaId = (url: string) => Number(url.match(/^\/media\/(\d+)\//)?.[1] ?? 0);

/** Images, the brochure and showrooms must belong to this dealership — checked on every save. */
async function ownershipIssues(ctx: Ctx, d: OfferInput): Promise<Issues> {
  const db = getDb();
  const out: Issues = {};
  const images: [string, string][] = [
    ["media.desktopBanner", d.media.desktopBanner],
    ["media.mobileBanner", d.media.mobileBanner],
    ["media.thumbnail", d.media.thumbnail],
    ...d.media.gallery.map((u): [string, string] => ["media.gallery", u]),
  ].filter((x): x is [string, string] => Boolean(x[1]));
  const ids = [...new Set(images.map(([, u]) => mediaId(u)).filter(Boolean))];
  if (ids.length) {
    const mine = new Set(
      (await db.select({ id: media.id }).from(media).where(and(inArray(media.id, ids), eq(media.partnerId, ctx.partner.id)))).map((m) => m.id),
    );
    for (const [path, url] of images) if (!mine.has(mediaId(url))) out[path] ??= "This image isn't in your media library — upload it again";
  }
  if (d.media.brochure) {
    const [f] = await db
      .select({ id: partnerFiles.id })
      .from(partnerFiles)
      .where(and(eq(partnerFiles.id, d.media.brochure.id), eq(partnerFiles.partnerId, ctx.partner.id), eq(partnerFiles.kind, "brochure")));
    if (!f) out["media.brochure"] = "Upload the brochure again";
  }
  if (d.locations.showroomIds.length) {
    const rooms = new Set(
      (
        await db
          .select({ id: partnerShowrooms.id })
          .from(partnerShowrooms)
          .where(and(eq(partnerShowrooms.partnerId, ctx.partner.id), eq(partnerShowrooms.isActive, true), inArray(partnerShowrooms.id, d.locations.showroomIds)))
      ).map((r) => r.id),
    );
    if (d.locations.showroomIds.some((id) => !rooms.has(id))) out["locations.showroomIds"] = "One of the selected showrooms is no longer available — untick it";
  }
  return out;
}

const AMOUNT_LABEL = { flat: "flat discount", cash: "cash discount", exchangeBonus: "exchange bonus", corporateBonus: "corporate bonus", loyaltyBonus: "loyalty bonus" } as const;

/** Everything that must be right before an offer can go to MarchGear. Field paths match the form. */
async function submissionIssues(ctx: Ctx, d: OfferInput, confirmTerms: boolean | null): Promise<Issues> {
  const out: Issues = {};
  const opts = await getEditorOptions(ctx.partner.id);

  // A — basics
  if (d.title.length < 5) out.title = "Give the offer a clear title (at least 5 characters)";
  if (d.campaignName.length < 3) out.campaignName = "Name the campaign this offer belongs to";
  if (!d.category) out.category = "Choose a category";
  if (d.tagline.length < 5) out.tagline = "Add a one-line tagline";
  if (d.description.length < 20) out.description = "Describe the offer in a sentence or two (at least 20 characters)";
  if (d.terms.length < 30) out.terms = "Terms & conditions are required (at least 30 characters)";

  // B — vehicles
  const authorised = opts.brands.filter((b) => b.authorised);
  const pool = d.scope.vehicleType === "used" ? opts.catalogueBrands : authorised;
  if (d.scope.vehicleType !== "used" && !authorised.length)
    out["scope.vehicleType"] = "Your dealership has no approved brand authorisation yet. Choose Used cars, or get a brand authorised under Brands first.";
  const byBrand = new Map(pool.map((b) => [b.slug, b]));
  const badBrand = d.scope.brands.find((b) => !byBrand.has(b));
  if (badBrand) out["scope.brands"] = `${opts.catalogueBrands.find((b) => b.slug === badBrand)?.name ?? badBrand} isn't one of your authorised brands`;
  if (!d.scope.allModels) {
    if (!d.scope.models.length) out["scope.models"] = "Select at least one model — or apply the offer to all models";
    const models = new Map(pool.flatMap((b) => b.models.map((m) => [m.slug, m] as const)));
    const badModel = d.scope.models.find((m) => !models.has(m));
    if (badModel) out["scope.models"] = "One of the selected models isn't available to you any more — untick it";
    const badVariant = d.scope.variants.find((v) => {
      const [car, variant] = v.split("/");
      return !d.scope.models.includes(car) || !models.get(car)?.variants.some((x) => x.slug === variant);
    });
    if (badVariant) out["scope.variants"] = "One of the selected variants isn't available any more — untick it";
  }

  // C — discount
  const dc = d.discount;
  if (!hasBenefit(dc)) out["discount.benefits"] = "Add at least one benefit — a discount, a bonus or a free extra";
  if (dc.percentage !== null && dc.percentage > 50) out["discount.percentage"] = "Percentage discounts above 50% aren't accepted — check the figure";
  if (dc.percentage !== null && dc.percentage > 0 && dc.percentage < 0.5) out["discount.percentage"] = "Use at least 0.5%, or leave it empty";
  const biggest = (Object.keys(AMOUNT_LABEL) as (keyof typeof AMOUNT_LABEL)[])
    .map((k) => [k, dc[k] ?? 0] as const)
    .sort((a, b) => b[1] - a[1])[0];
  if (dc.maxDiscount === 0) out["discount.maxDiscount"] = "Leave this empty if there's no cap";
  else if (dc.maxDiscount !== null && biggest[1] > dc.maxDiscount)
    out["discount.maxDiscount"] = `The maximum can't be lower than the ${money(biggest[1])} ${AMOUNT_LABEL[biggest[0]]} you're offering`;
  for (const k of ["freeAccessories", "financeBenefit", "minPurchase"] as const)
    if (dc[k] && dc[k].length < 3) out[`discount.${k}`] = "Add a few more words, or leave it empty";

  // D — validity
  const start = fromIstParts(d.startDate, d.startTime);
  const end = fromIstParts(d.endDate, d.endTime);
  if (!start) out.startsAt = "Choose a start date and time";
  if (!end) out.endsAt = "Choose an end date and time";
  if (start && end) {
    if (end <= start) out.endsAt = "The offer must end after it starts";
    else if (end.getTime() - start.getTime() > 366 * 86_400_000) out.endsAt = "An offer can run for up to a year";
    else if (end.getTime() < Date.now() + 3_600_000) out.endsAt = "This end date has passed — choose one in the future";
  }
  if (d.limitedStock && d.maxRedemptions && d.maxRedemptions > d.limitedStock)
    out.maxRedemptions = `Can't be more than the limited stock (${d.limitedStock} units)`;

  // E — media
  if (!d.media.desktopBanner) out["media.desktopBanner"] = "Upload a desktop banner — it's the first thing customers see";
  if (d.media.videoUrl) {
    let ok = false;
    try {
      ok = new URL(d.media.videoUrl).protocol === "https:";
    } catch {}
    if (!ok) out["media.videoUrl"] = "Paste the full https:// link to the video (YouTube, Vimeo…)";
  }

  // F — location
  const loc = d.locations;
  if (loc.mode === "all" && !opts.showrooms.length) out["locations.mode"] = "Add a showroom under Showrooms first";
  if (loc.mode === "branches" && !loc.showroomIds.length) out["locations.showroomIds"] = "Select at least one showroom";
  if (loc.mode === "cities" && !loc.cities.length) out["locations.cities"] = "Add at least one city";
  if (loc.mode === "states") {
    if (!loc.states.length) out["locations.states"] = "Select at least one state";
    else if (loc.states.some((s) => !(INDIAN_STATES as readonly string[]).includes(s))) out["locations.states"] = "Pick states from the list";
  }

  // G — confirmation (only when actually submitting)
  if (confirmTerms === false) out.confirmTerms = "Please confirm the offer details and terms before submitting";
  return out;
}

/** Keeps scope consistent: "all models" carries no model list; variants only of selected models. */
function normalise(d: OfferInput): OfferInput {
  const scope = d.scope.allModels
    ? { ...d.scope, models: [], variants: [] }
    : { ...d.scope, variants: d.scope.variants.filter((v) => d.scope.models.includes(v.split("/")[0])) };
  return {
    ...d,
    scope: { ...scope, brands: [...new Set(scope.brands)], models: [...new Set(scope.models)], variants: [...new Set(scope.variants)] },
    media: { ...d.media, gallery: [...new Set(d.media.gallery)] },
    locations: {
      ...d.locations,
      showroomIds: [...new Set(d.locations.showroomIds)],
      cities: [...new Set(d.locations.cities)],
      states: [...new Set(d.locations.states)],
    },
  };
}

function rowValues(d: OfferInput, row: OfferRow | null) {
  const tomorrow = fromIstParts(addDays(istDay(new Date()), 1), "00:00")!;
  const startsAt = fromIstParts(d.startDate, d.startTime) ?? row?.startsAt ?? tomorrow;
  const endsAt = fromIstParts(d.endDate, d.endTime) ?? row?.endsAt ?? new Date(startsAt.getTime() + 30 * 86_400_000 - 60_000);
  return {
    title: d.title,
    campaignName: d.campaignName,
    category: d.category,
    description: d.description,
    tagline: d.tagline,
    terms: d.terms,
    scope: d.scope,
    discount: d.discount,
    startsAt,
    endsAt,
    limitedStock: d.limitedStock,
    maxRedemptions: d.maxRedemptions,
    media: d.media,
    locations: d.locations,
  };
}

function lockedMessage(row: OfferRow) {
  if (OFFER_REVIEW_STATUSES.includes(row.status)) return "This offer is with MarchGear for review. Withdraw it first to make changes.";
  if (OFFER_LIVE_STATUSES.includes(row.status)) return "This offer has been approved. Changes to it go back to MarchGear — use “Resubmit for approval”.";
  return `${OFFER_STATUS_LABEL[row.status]} offers can't be edited. Duplicate it to start a new draft.`;
}

const affected = (res: unknown) => (Array.isArray(res) ? ((res[0] as { affectedRows?: number })?.affectedRows ?? 0) : 0);

async function insertOffer(ctx: Ctx, values: ReturnType<typeof rowValues> & Partial<typeof partnerOffers.$inferInsert>) {
  const db = getDb();
  for (let attempt = 0; attempt < 4; attempt++) {
    const ref = reference("OFF");
    try {
      const [res] = await db.insert(partnerOffers).values({ ...values, partnerId: ctx.partner.id, reference: ref, status: "draft" });
      return { id: res.insertId, reference: ref };
    } catch (err) {
      if (!isDuplicate(err) || attempt === 3) throw err;
    }
  }
  throw new Error("Couldn't create the offer.");
}

const NOT_FOUND = { ok: false as const, error: "This offer no longer exists." };

/* ── Editor ─────────────────────────────────────────────────── */

/** Autosave: creates the draft on first save, then updates it. Returns what still blocks submission. */
export async function saveOfferDraftAction(raw: unknown): Promise<ActionResult<{ id: number; reference: string; savedAt: string; issues: Issues }>> {
  const ctx = await partnerAction("offers.manage");
  if (isActionError(ctx)) return ctx;
  const parsed = saveSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { id, ...rest } = parsed.data;
  const d = normalise(rest);
  const own = await ownershipIssues(ctx, d);
  if (Object.keys(own).length) return { ok: false, error: "Some files or showrooms couldn't be saved.", fieldErrors: own };

  const db = getDb();
  let row: OfferRow | null = null;
  if (id) {
    row = await getOffer(ctx.partner.id, id);
    if (!row) return NOT_FOUND;
    if (!OFFER_DRAFT_STATUSES.includes(row.status)) return { ok: false, error: lockedMessage(row) };
  }
  const values = rowValues(d, row);
  let saved: { id: number; reference: string };
  if (row) {
    const res = await db
      .update(partnerOffers)
      .set(values)
      .where(and(eq(partnerOffers.id, row.id), eq(partnerOffers.partnerId, ctx.partner.id), inArray(partnerOffers.status, OFFER_DRAFT_STATUSES)));
    if (!affected(res)) return { ok: false, error: "This offer changed in another window. Reload the page to continue." };
    saved = { id: row.id, reference: row.reference };
  } else {
    saved = await insertOffer(ctx, values);
    await logPartnerActivity(ctx.partner.id, ctx.user.id, "create", "offer", saved.id, `Started offer ${saved.reference}${d.title ? ` “${d.title}”` : ""}`);
  }
  return { ok: true, ...saved, savedAt: new Date().toISOString(), issues: await submissionIssues(ctx, d, null) };
}

/** What still blocks submission, without saving (used while editing an approved offer). */
export async function checkOfferAction(raw: unknown): Promise<ActionResult<{ issues: Issues }>> {
  const ctx = await partnerAction("offers.manage");
  if (isActionError(ctx)) return ctx;
  const parsed = saveSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const rest: Partial<typeof parsed.data> = { ...parsed.data };
  delete rest.id;
  const d = normalise(rest as OfferInput);
  return { ok: true, issues: { ...(await ownershipIssues(ctx, d)), ...(await submissionIssues(ctx, d, null)) } };
}

async function submit(ctx: Ctx, d: OfferInput, row: OfferRow | null, confirmTerms: boolean): Promise<ActionResult<{ id: number; reference: string }>> {
  const issues = { ...(await ownershipIssues(ctx, d)), ...(await submissionIssues(ctx, d, confirmTerms)) };
  const n = Object.keys(issues).length;
  if (n) return { ok: false, error: n === 1 ? "One thing needs your attention before you submit." : `${n} things need your attention before you submit.`, fieldErrors: issues };

  const allowed: OfferStatus[] = [...OFFER_DRAFT_STATUSES, ...OFFER_LIVE_STATUSES];
  if (row && !allowed.includes(row.status)) return { ok: false, error: lockedMessage(row) };
  const overLimit = await offerLimitError(ctx.partner.id, ctx.partner.plan, row?.id);
  if (overLimit) return { ok: false, error: overLimit };
  const db = getDb();
  const values = { ...rowValues(d, row), status: "pending_approval" as const, submittedAt: new Date() };
  let saved: { id: number; reference: string };
  if (row) {
    const res = await db
      .update(partnerOffers)
      .set(values)
      .where(and(eq(partnerOffers.id, row.id), eq(partnerOffers.partnerId, ctx.partner.id), inArray(partnerOffers.status, allowed)));
    if (!affected(res)) return { ok: false, error: "This offer changed in another window. Reload the page and try again." };
    saved = { id: row.id, reference: row.reference };
  } else {
    saved = await insertOffer(ctx, rowValues(d, null));
    await db.update(partnerOffers).set({ status: "pending_approval", submittedAt: values.submittedAt }).where(eq(partnerOffers.id, saved.id));
  }

  const from = row?.status ?? "draft";
  const live = OFFER_LIVE_STATUSES.includes(from);
  await recordApproval({
    partnerId: ctx.partner.id,
    target: "offer",
    targetId: saved.id,
    action: from === "draft" ? "submitted" : "resubmitted",
    fromStatus: from,
    toStatus: "pending_approval",
    remarks: live ? "Edited after approval — the offer is off the website until it is approved again." : null,
    actorUserId: ctx.user.id,
    actorSide: "dealer",
  });
  await logPartnerActivity(ctx.partner.id, ctx.user.id, "submit", "offer", saved.id, `Submitted offer ${saved.reference} “${d.title}” for approval`);
  await notifyPartner(ctx.partner.id, {
    kind: "offer",
    title: `Offer sent for approval: ${d.title}`,
    body: `${ctx.user.name} submitted ${saved.reference}. You'll be notified when MarchGear has reviewed it.`,
    href: `/dealer/offers?status=pending`,
  });
  if (live) expireCatalog();
  return { ok: true, ...saved };
}

/** Submit (or resubmit) from the editor: saves the latest edits and sends the offer for approval. */
export async function submitOfferAction(raw: unknown): Promise<ActionResult<{ id: number; reference: string }>> {
  const ctx = await partnerAction("offers.manage");
  if (isActionError(ctx)) return ctx;
  const parsed = submitSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { id, confirmTerms, ...rest } = parsed.data;
  const row = id ? await getOffer(ctx.partner.id, id) : null;
  if (id && !row) return NOT_FOUND;
  return submit(ctx, normalise(rest), row, confirmTerms);
}

/** Submit a saved draft straight from the offers list. */
export async function submitOfferByIdAction(raw: unknown): Promise<ActionResult<{ id: number; reference: string }>> {
  const ctx = await partnerAction("offers.manage");
  if (isActionError(ctx)) return ctx;
  const parsed = idSchema.extend({ confirmTerms: z.boolean() }).safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const row = await getOffer(ctx.partner.id, parsed.data.id);
  if (!row) return NOT_FOUND;
  if (!OFFER_DRAFT_STATUSES.includes(row.status)) return { ok: false, error: lockedMessage(row) };
  return submit(ctx, offerToInput(row), row, parsed.data.confirmTerms);
}

/* ── Lifecycle ──────────────────────────────────────────────── */

async function transition(
  raw: unknown,
  t: { from: OfferStatus[]; to: OfferStatus; action: string; verb: string; check?: (row: OfferRow) => string | null; notify?: boolean; remarks?: (input: Record<string, unknown>) => string | null },
): Promise<ActionResult<{ id: number }>> {
  const ctx = await partnerAction("offers.manage");
  if (isActionError(ctx)) return ctx;
  const parsed = idSchema.extend({ reason: z.string().trim().max(500, "Keep the reason under 500 characters").optional() }).safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const row = await getOffer(ctx.partner.id, parsed.data.id);
  if (!row) return NOT_FOUND;
  if (!t.from.includes(row.status)) return { ok: false, error: `A ${OFFER_STATUS_LABEL[offerDisplayStatus(row)].toLowerCase()} offer can't be ${t.verb}.` };
  const blocked = t.check?.(row);
  if (blocked) return { ok: false, error: blocked };

  const res = await getDb()
    .update(partnerOffers)
    .set({ status: t.to })
    .where(and(eq(partnerOffers.id, row.id), eq(partnerOffers.partnerId, ctx.partner.id), eq(partnerOffers.status, row.status)));
  if (!affected(res)) return { ok: false, error: "This offer changed in another window. Reload the page and try again." };

  const remarks = parsed.data.reason || null;
  await recordApproval({ partnerId: ctx.partner.id, target: "offer", targetId: row.id, action: t.action, fromStatus: row.status, toStatus: t.to, remarks, actorUserId: ctx.user.id, actorSide: "dealer" });
  await logPartnerActivity(ctx.partner.id, ctx.user.id, t.action, "offer", row.id, `${t.verb[0].toUpperCase()}${t.verb.slice(1)} offer ${row.reference} “${row.title}”`);
  if (t.notify)
    await notifyPartner(ctx.partner.id, { kind: "offer", title: `Offer ${t.verb}: ${row.title}`, body: `${ctx.user.name} ${t.verb} ${row.reference}.${remarks ? ` Reason: ${remarks}` : ""}`, href: "/dealer/offers" });
  if (OFFER_LIVE_STATUSES.includes(row.status) || OFFER_LIVE_STATUSES.includes(t.to)) expireCatalog();
  return { ok: true, id: row.id };
}

/** Pulls an offer back from review so it can be edited again. */
export async function withdrawOfferAction(raw: unknown) {
  return transition(raw, { from: OFFER_REVIEW_STATUSES, to: "draft", action: "withdrawn", verb: "withdrawn" });
}

/** Takes an approved, not-yet-ended offer off the website for now. */
export async function pauseOfferAction(raw: unknown) {
  return transition(raw, {
    from: ["approved"],
    to: "paused",
    action: "paused",
    verb: "paused",
    notify: true,
    check: (row) => (offerDisplayStatus(row) === "expired" ? "This offer has already expired — there's nothing to pause." : null),
  });
}

/** Puts a paused offer back live (it stays approved; its dates decide whether it shows). */
export async function resumeOfferAction(raw: unknown) {
  return transition(raw, { from: ["paused"], to: "approved", action: "resumed", verb: "resumed", notify: true });
}

/** Ends an offer for good. It can be duplicated later. */
export async function cancelOfferAction(raw: unknown) {
  return transition(raw, {
    from: ["submitted", "pending_approval", "changes_requested", "approved", "paused"],
    to: "cancelled",
    action: "cancelled",
    verb: "cancelled",
    notify: true,
    check: (row) => (offerDisplayStatus(row) === "expired" ? "This offer has already expired." : null),
  });
}

/** Deletes a draft that was never approved. */
export async function deleteOfferDraftAction(raw: unknown): Promise<ActionResult> {
  const ctx = await partnerAction("offers.manage");
  if (isActionError(ctx)) return ctx;
  const parsed = idSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const row = await getOffer(ctx.partner.id, parsed.data.id);
  if (!row) return NOT_FOUND;
  if (row.status !== "draft" || row.approvedAt) return { ok: false, error: "Only drafts that were never approved can be deleted. Cancel the offer instead." };
  const res = await getDb()
    .delete(partnerOffers)
    .where(and(eq(partnerOffers.id, row.id), eq(partnerOffers.partnerId, ctx.partner.id), eq(partnerOffers.status, "draft")));
  if (!affected(res)) return { ok: false, error: "This offer changed in another window. Reload the page and try again." };
  await logPartnerActivity(ctx.partner.id, ctx.user.id, "delete", "offer", row.id, `Deleted draft offer ${row.reference}${row.title ? ` “${row.title}”` : ""}`);
  return { ok: true };
}

/**
 * Copies an offer into a new draft ("duplicate" keeps a "Copy of" title; "reuse" keeps the title).
 * Past windows move to start tomorrow with the same length. Performance and approvals start fresh.
 */
export async function duplicateOfferAction(raw: unknown): Promise<ActionResult<{ id: number; reference: string }>> {
  const ctx = await partnerAction("offers.manage");
  if (isActionError(ctx)) return ctx;
  const parsed = idSchema.extend({ mode: z.enum(["duplicate", "reuse"]).default("duplicate") }).safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const row = await getOffer(ctx.partner.id, parsed.data.id);
  if (!row) return NOT_FOUND;

  const input = offerToInput(row);
  let startsAt = row.startsAt;
  let endsAt = row.endsAt;
  if (row.endsAt.getTime() < Date.now() + 86_400_000) {
    const length = Math.min(Math.max(row.endsAt.getTime() - row.startsAt.getTime(), 86_400_000), 366 * 86_400_000);
    startsAt = fromIstParts(addDays(istDay(new Date()), 1), toIstParts(row.startsAt).time)!;
    endsAt = new Date(startsAt.getTime() + length);
  }
  const title = parsed.data.mode === "duplicate" ? `Copy of ${row.title}`.slice(0, 160) : row.title;
  // Files/showrooms that were since removed are dropped rather than failing the copy.
  const own = await ownershipIssues(ctx, input);
  const media = {
    ...input.media,
    desktopBanner: own["media.desktopBanner"] ? "" : input.media.desktopBanner,
    mobileBanner: own["media.mobileBanner"] ? "" : input.media.mobileBanner,
    thumbnail: own["media.thumbnail"] ? "" : input.media.thumbnail,
    gallery: own["media.gallery"] ? [] : input.media.gallery,
    brochure: own["media.brochure"] ? null : input.media.brochure,
  };
  const locations = own["locations.showroomIds"] ? { ...input.locations, showroomIds: [] } : input.locations;
  const saved = await insertOffer(ctx, { ...rowValues({ ...input, media, locations, title }, row), startsAt, endsAt });
  await logPartnerActivity(
    ctx.partner.id,
    ctx.user.id,
    parsed.data.mode,
    "offer",
    saved.id,
    `${parsed.data.mode === "duplicate" ? "Duplicated" : "Reused"} offer ${row.reference} as draft ${saved.reference}`,
  );
  return { ok: true, ...saved };
}

/* ── Read-only ──────────────────────────────────────────────── */

/** Approval history + the latest admin remarks for the history drawer. */
export async function offerHistoryAction(raw: unknown): Promise<ActionResult<{ items: ApprovalEntry[]; remarks: string | null }>> {
  const ctx = await partnerAction("offers.view");
  if (isActionError(ctx)) return ctx;
  const parsed = idSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const row = await getOffer(ctx.partner.id, parsed.data.id);
  if (!row) return NOT_FOUND;
  return { ok: true, items: await offerHistory(ctx.partner.id, row.id), remarks: row.adminRemarks };
}
