"use server";

import { z } from "zod";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { insApprovals, insCampaigns, insProducts, media, users } from "@/db/schema";
import { INS_CAMPAIGN_TYPES, type InsCampaignStatus } from "@/db/enums";
import type { ActionResult } from "@/lib/action-result";
import { INS_CAMPAIGN_STATUS_LABEL, campaignDisplayStatus } from "@/insurance/labels";
import { isDuplicate } from "@/server/db-errors";
import { insurerAction, isInsurerError, type InsurerContext } from "@/server/insurance/context";
import { insReference, logInsurerActivity, notifyInsurer, recordInsApproval } from "@/server/insurance/records";
import { campaignLimitError } from "@/server/insurance/subscription";
import { invalid } from "@/server/validation";
import { addDays, fromIstParts, istDay, toIstParts } from "@/components/offers/offer-utils";
import { CAMPAIGN_DRAFT_STATUSES, CAMPAIGN_LIMITS, CAMPAIGN_LIVE_STATUSES, type CampaignApprovalEntry, type CampaignInput } from "@/components/insurance/vendor/campaigns/shared";

/* ──────────────────────────────────────────────────────────────
   Insurance vendors' promotional campaigns: drafts, submission for
   MarchGear's approval and the vendor-side lifecycle (withdraw,
   pause/resume, cancel, duplicate, delete). Every action checks the
   session + campaigns.manage and is scoped to ctx.vendor.id.
   Admin decisions live in /admin/insurance/campaigns.
   ────────────────────────────────────────────────────────────── */

type Ctx = InsurerContext;
type Row = typeof insCampaigns.$inferSelect;
type Issues = Record<string, string>;

const text = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters`);
const mediaUrl = z.string().trim().max(300).regex(/^\/media\/\d+\/[\w.-]+$/, "Upload this image again");

const inputSchema = z.object({
  title: text(CAMPAIGN_LIMITS.title),
  summary: text(CAMPAIGN_LIMITS.summary),
  description: text(CAMPAIGN_LIMITS.description),
  type: z.union([z.enum(INS_CAMPAIGN_TYPES), z.literal("")]),
  productIds: z.array(z.number().int().positive()).max(30, "Pick up to 30 products"),
  banner: z.union([z.literal(""), mediaUrl]),
  ctaLabel: text(CAMPAIGN_LIMITS.cta),
  startDate: z.string().max(10),
  startTime: z.string().max(5),
  endDate: z.string().max(10),
  endTime: z.string().max(5),
}) satisfies z.ZodType<CampaignInput>;

const saveSchema = inputSchema.extend({ id: z.number().int().positive().optional() });
const submitSchema = saveSchema.extend({ confirmRules: z.boolean() });
const idSchema = z.object({ id: z.number().int().positive() });

const NOT_FOUND = { ok: false as const, error: "This campaign no longer exists." };
const CHANGED = { ok: false as const, error: "This campaign changed in another window. Reload the page and try again." };
const affected = (res: unknown) => (Array.isArray(res) ? ((res[0] as { affectedRows?: number })?.affectedRows ?? 0) : 0);

async function getCampaign(vendorId: number, id: number): Promise<Row | null> {
  const [row] = await getDb()
    .select()
    .from(insCampaigns)
    .where(and(eq(insCampaigns.id, id), eq(insCampaigns.vendorId, vendorId)));
  return row ?? null;
}

const mediaId = (url: string) => Number(url.match(/^\/media\/(\d+)\//)?.[1] ?? 0);

/** The banner and products must belong to this vendor — checked on every save. */
async function ownershipIssues(ctx: Ctx, d: CampaignInput): Promise<Issues> {
  const db = getDb();
  const out: Issues = {};
  if (d.banner) {
    const [m] = await db
      .select({ id: media.id })
      .from(media)
      .where(and(eq(media.id, mediaId(d.banner)), eq(media.insVendorId, ctx.vendor.id)));
    if (!m) out.banner = "This image isn't in your uploads — upload it again";
  }
  if (d.productIds.length) {
    const rows = await db
      .select({ id: insProducts.id })
      .from(insProducts)
      .where(and(eq(insProducts.vendorId, ctx.vendor.id), inArray(insProducts.id, d.productIds)));
    if (rows.length !== d.productIds.length) out.productIds = "One of the selected products no longer exists — untick it";
  }
  return out;
}

/** Everything that must be right before a campaign can go to MarchGear. Field names match the form. */
async function submissionIssues(ctx: Ctx, d: CampaignInput, confirmRules: boolean | null): Promise<Issues> {
  const out: Issues = {};
  if (d.title.length < 5) out.title = "Give the campaign a clear title (at least 5 characters)";
  if (!d.type) out.type = "Choose a campaign type";
  if (d.summary.length < 20) out.summary = "Write a one- or two-line summary customers will see (at least 20 characters)";
  if (!d.productIds.length) out.productIds = "Choose at least one published product to promote";
  else {
    const published = await getDb()
      .select({ id: insProducts.id })
      .from(insProducts)
      .where(and(eq(insProducts.vendorId, ctx.vendor.id), eq(insProducts.status, "published"), inArray(insProducts.id, d.productIds)));
    if (published.length !== d.productIds.length) out.productIds = "Only published products can be promoted — untick the ones that aren't live";
  }
  const start = fromIstParts(d.startDate, d.startTime);
  const end = fromIstParts(d.endDate, d.endTime);
  if (!start) out.startsAt = "Choose a start date and time";
  if (!end) out.endsAt = "Choose an end date and time";
  if (start && end) {
    if (end <= start) out.endsAt = "The campaign must end after it starts";
    else if (end.getTime() - start.getTime() > 366 * 86_400_000) out.endsAt = "A campaign can run for up to a year";
    else if (end.getTime() < Date.now() + 3_600_000) out.endsAt = "This end date has passed — choose one in the future";
  }
  if (confirmRules === false) out.confirmRules = "Confirm the campaign follows the insurance advertising rules";
  return out;
}

const normalise = (d: CampaignInput): CampaignInput => ({ ...d, productIds: [...new Set(d.productIds)] });

function rowValues(d: CampaignInput, row: Row | null) {
  const tomorrow = fromIstParts(addDays(istDay(new Date()), 1), "09:00")!;
  const startsAt = fromIstParts(d.startDate, d.startTime) ?? row?.startsAt ?? tomorrow;
  const endsAt = fromIstParts(d.endDate, d.endTime) ?? row?.endsAt ?? new Date(startsAt.getTime() + 30 * 86_400_000);
  return {
    title: d.title,
    summary: d.summary,
    description: d.description || null,
    type: d.type || "other",
    productIds: d.productIds,
    banner: d.banner || null,
    ctaLabel: d.ctaLabel || null,
    startsAt,
    endsAt,
  } as const;
}

function lockedMessage(row: Row) {
  if (row.status === "pending_approval") return "This campaign is with MarchGear for review. Withdraw it first to make changes.";
  if (CAMPAIGN_LIVE_STATUSES.includes(row.status)) return "This campaign has been approved. Changes to it go back to MarchGear — use “Resubmit for approval”.";
  return `${INS_CAMPAIGN_STATUS_LABEL[campaignDisplayStatus(row)]} campaigns can't be edited. Duplicate it to start a new draft.`;
}

async function insertCampaign(ctx: Ctx, values: ReturnType<typeof rowValues>, status: InsCampaignStatus = "draft", submittedAt: Date | null = null) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const ref = insReference("CMP");
    try {
      const [res] = await getDb()
        .insert(insCampaigns)
        .values({ ...values, vendorId: ctx.vendor.id, reference: ref, status, submittedAt, createdBy: ctx.user.id });
      return { id: res.insertId, reference: ref };
    } catch (err) {
      if (!isDuplicate(err) || attempt === 3) throw err;
    }
  }
  throw new Error("Couldn't create the campaign.");
}

const countIssues = (n: number) => (n === 1 ? "One thing needs your attention before you submit." : `${n} things need your attention before you submit.`);

/* ── Editor ─────────────────────────────────────────────────── */

/** Saves a draft (creates it on first save). Returns what still blocks submission. */
export async function saveInsCampaignDraftAction(raw: unknown): Promise<ActionResult<{ id: number; reference: string; issues: Issues }>> {
  const ctx = await insurerAction("campaigns.manage");
  if (isInsurerError(ctx)) return ctx;
  const parsed = saveSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { id, ...rest } = parsed.data;
  const d = normalise(rest);
  const basics: Issues = {};
  if (d.title.length < 3) basics.title = "Give the campaign a title to save it";
  if (!d.type) basics.type = "Choose a campaign type";
  const own = await ownershipIssues(ctx, d);
  if (Object.keys(basics).length || Object.keys(own).length) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: { ...basics, ...own } };

  let row: Row | null = null;
  if (id) {
    row = await getCampaign(ctx.vendor.id, id);
    if (!row) return NOT_FOUND;
    if (!CAMPAIGN_DRAFT_STATUSES.includes(row.status)) return { ok: false, error: lockedMessage(row) };
  }
  const values = rowValues(d, row);
  let saved: { id: number; reference: string };
  if (row) {
    const res = await getDb()
      .update(insCampaigns)
      .set({ ...values, status: row.status === "rejected" ? "draft" : row.status })
      .where(and(eq(insCampaigns.id, row.id), eq(insCampaigns.vendorId, ctx.vendor.id), inArray(insCampaigns.status, CAMPAIGN_DRAFT_STATUSES)));
    if (!affected(res)) return CHANGED;
    saved = { id: row.id, reference: row.reference };
  } else {
    saved = await insertCampaign(ctx, values);
    await logInsurerActivity(ctx.vendor.id, ctx.user.id, "create", "campaign", saved.id, `Started campaign ${saved.reference} “${d.title}”`);
  }
  return { ok: true, ...saved, issues: await submissionIssues(ctx, d, null) };
}

async function submit(ctx: Ctx, d: CampaignInput, row: Row | null, confirmRules: boolean): Promise<ActionResult<{ id: number; reference: string }>> {
  const issues = { ...(await ownershipIssues(ctx, d)), ...(await submissionIssues(ctx, d, confirmRules)) };
  const n = Object.keys(issues).length;
  if (n) return { ok: false, error: countIssues(n), fieldErrors: issues };

  const allowed: InsCampaignStatus[] = [...CAMPAIGN_DRAFT_STATUSES, ...CAMPAIGN_LIVE_STATUSES];
  if (row && !allowed.includes(row.status)) return { ok: false, error: lockedMessage(row) };
  const overLimit = await campaignLimitError(ctx.vendor.id, ctx.vendor.plan, row?.id);
  if (overLimit) return { ok: false, error: overLimit };

  const submittedAt = new Date();
  const values = rowValues(d, row);
  let saved: { id: number; reference: string };
  if (row) {
    const res = await getDb()
      .update(insCampaigns)
      .set({ ...values, status: "pending_approval", submittedAt })
      .where(and(eq(insCampaigns.id, row.id), eq(insCampaigns.vendorId, ctx.vendor.id), eq(insCampaigns.status, row.status)));
    if (!affected(res)) return CHANGED;
    saved = { id: row.id, reference: row.reference };
  } else {
    saved = await insertCampaign(ctx, values, "pending_approval", submittedAt);
  }

  const from = row?.status ?? "draft";
  const live = CAMPAIGN_LIVE_STATUSES.includes(from);
  await recordInsApproval({
    vendorId: ctx.vendor.id,
    target: "campaign",
    targetId: saved.id,
    action: from === "draft" && !row?.submittedAt ? "submitted" : "resubmitted",
    fromStatus: from,
    toStatus: "pending_approval",
    remarks: live ? "Edited after approval — the campaign is off the insurance pages until it is approved again." : null,
    actorUserId: ctx.user.id,
    actorSide: "vendor",
  });
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "submit", "campaign", saved.id, `Submitted campaign ${saved.reference} “${d.title}” for approval`);
  await notifyInsurer(ctx.vendor.id, {
    kind: "campaign",
    title: `Campaign sent for approval: ${d.title}`,
    body: `${ctx.user.name} submitted ${saved.reference}. You'll be notified when MarchGear has reviewed it.`,
    href: `/insurance-vendor/campaigns/${saved.id}`,
  });
  return { ok: true, ...saved };
}

/** Submit (or resubmit) from the editor: saves the latest edits and sends the campaign for approval. */
export async function submitInsCampaignAction(raw: unknown): Promise<ActionResult<{ id: number; reference: string }>> {
  const ctx = await insurerAction("campaigns.manage");
  if (isInsurerError(ctx)) return ctx;
  const parsed = submitSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const { id, confirmRules, ...rest } = parsed.data;
  const row = id ? await getCampaign(ctx.vendor.id, id) : null;
  if (id && !row) return NOT_FOUND;
  return submit(ctx, normalise(rest), row, confirmRules);
}

const toInput = (r: Row): CampaignInput => {
  const s = toIstParts(r.startsAt);
  const e = toIstParts(r.endsAt);
  return {
    title: r.title,
    summary: r.summary,
    description: r.description ?? "",
    type: r.type,
    productIds: r.productIds,
    banner: r.banner ?? "",
    ctaLabel: r.ctaLabel ?? "",
    startDate: s.date,
    startTime: s.time,
    endDate: e.date,
    endTime: e.time,
  };
};

/** Submit a saved draft straight from the list or the detail page. */
export async function submitInsCampaignByIdAction(raw: unknown): Promise<ActionResult<{ id: number; reference: string }>> {
  const ctx = await insurerAction("campaigns.manage");
  if (isInsurerError(ctx)) return ctx;
  const parsed = idSchema.extend({ confirmRules: z.boolean() }).safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const row = await getCampaign(ctx.vendor.id, parsed.data.id);
  if (!row) return NOT_FOUND;
  if (!CAMPAIGN_DRAFT_STATUSES.includes(row.status)) return { ok: false, error: lockedMessage(row) };
  return submit(ctx, toInput(row), row, parsed.data.confirmRules);
}

/* ── Lifecycle ──────────────────────────────────────────────── */

async function transition(
  raw: unknown,
  t: { from: InsCampaignStatus[]; to: InsCampaignStatus; action: string; verb: string; check?: (row: Row) => string | null; notify?: boolean },
): Promise<ActionResult<{ id: number }>> {
  const ctx = await insurerAction("campaigns.manage");
  if (isInsurerError(ctx)) return ctx;
  const parsed = idSchema.extend({ reason: z.string().trim().max(500, "Keep the reason under 500 characters").optional() }).safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const row = await getCampaign(ctx.vendor.id, parsed.data.id);
  if (!row) return NOT_FOUND;
  if (!t.from.includes(row.status)) return { ok: false, error: `A ${INS_CAMPAIGN_STATUS_LABEL[campaignDisplayStatus(row)].toLowerCase()} campaign can't be ${t.verb}.` };
  const blocked = t.check?.(row);
  if (blocked) return { ok: false, error: blocked };

  const res = await getDb()
    .update(insCampaigns)
    .set({ status: t.to })
    .where(and(eq(insCampaigns.id, row.id), eq(insCampaigns.vendorId, ctx.vendor.id), eq(insCampaigns.status, row.status)));
  if (!affected(res)) return CHANGED;

  const remarks = parsed.data.reason || null;
  await recordInsApproval({ vendorId: ctx.vendor.id, target: "campaign", targetId: row.id, action: t.action, fromStatus: row.status, toStatus: t.to, remarks, actorUserId: ctx.user.id, actorSide: "vendor" });
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, t.action, "campaign", row.id, `${t.verb[0].toUpperCase()}${t.verb.slice(1)} campaign ${row.reference} “${row.title}”`);
  if (t.notify)
    await notifyInsurer(ctx.vendor.id, {
      kind: "campaign",
      title: `Campaign ${t.verb}: ${row.title}`,
      body: `${ctx.user.name} ${t.verb} ${row.reference}.${remarks ? ` Reason: ${remarks}` : ""}`,
      href: `/insurance-vendor/campaigns/${row.id}`,
    });
  return { ok: true, id: row.id };
}

const ended = (row: Row) => row.endsAt.getTime() < Date.now();

/** Pulls a campaign back from review so it can be edited again. */
export async function withdrawInsCampaignAction(raw: unknown) {
  return transition(raw, { from: ["pending_approval"], to: "draft", action: "withdrawn", verb: "withdrawn" });
}

/** Takes an approved, not-yet-ended campaign off the insurance pages for now. */
export async function pauseInsCampaignAction(raw: unknown) {
  return transition(raw, {
    from: ["approved"],
    to: "paused",
    action: "paused",
    verb: "paused",
    notify: true,
    check: (row) => (ended(row) ? "This campaign has already ended — there's nothing to pause." : null),
  });
}

/** Puts a paused campaign back (it keeps its approval; its dates decide whether it shows). */
export async function resumeInsCampaignAction(raw: unknown) {
  return transition(raw, {
    from: ["paused"],
    to: "approved",
    action: "resumed",
    verb: "resumed",
    notify: true,
    check: (row) => (ended(row) ? "Its end date has passed. Edit the dates and resubmit it to run it again." : null),
  });
}

/** Ends a campaign for good. It can be duplicated later. */
export async function cancelInsCampaignAction(raw: unknown) {
  return transition(raw, {
    from: ["pending_approval", "changes_requested", "approved", "paused"],
    to: "cancelled",
    action: "cancelled",
    verb: "cancelled",
    notify: true,
    check: (row) => (row.status !== "pending_approval" && row.status !== "changes_requested" && ended(row) ? "This campaign has already ended." : null),
  });
}

/** Deletes a draft that was never approved. */
export async function deleteInsCampaignDraftAction(raw: unknown): Promise<ActionResult> {
  const ctx = await insurerAction("campaigns.manage");
  if (isInsurerError(ctx)) return ctx;
  const parsed = idSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const row = await getCampaign(ctx.vendor.id, parsed.data.id);
  if (!row) return NOT_FOUND;
  if (row.status !== "draft" || row.approvedAt) return { ok: false, error: "Only drafts that were never approved can be deleted. Cancel the campaign instead." };
  const res = await getDb()
    .delete(insCampaigns)
    .where(and(eq(insCampaigns.id, row.id), eq(insCampaigns.vendorId, ctx.vendor.id), eq(insCampaigns.status, "draft")));
  if (!affected(res)) return CHANGED;
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "delete", "campaign", row.id, `Deleted draft campaign ${row.reference} “${row.title}”`);
  return { ok: true };
}

/** Copies a campaign into a new draft. Past windows move to start tomorrow with the same length. */
export async function duplicateInsCampaignAction(raw: unknown): Promise<ActionResult<{ id: number; reference: string }>> {
  const ctx = await insurerAction("campaigns.manage");
  if (isInsurerError(ctx)) return ctx;
  const parsed = idSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const row = await getCampaign(ctx.vendor.id, parsed.data.id);
  if (!row) return NOT_FOUND;

  const input = toInput(row);
  let startsAt = row.startsAt;
  let endsAt = row.endsAt;
  if (row.endsAt.getTime() < Date.now() + 86_400_000) {
    const length = Math.min(Math.max(row.endsAt.getTime() - row.startsAt.getTime(), 86_400_000), 366 * 86_400_000);
    startsAt = fromIstParts(addDays(istDay(new Date()), 1), toIstParts(row.startsAt).time)!;
    endsAt = new Date(startsAt.getTime() + length);
  }
  // A banner or products that were since removed are dropped rather than failing the copy.
  const own = await ownershipIssues(ctx, input);
  const productIds = own.productIds
    ? (await getDb().select({ id: insProducts.id }).from(insProducts).where(and(eq(insProducts.vendorId, ctx.vendor.id), inArray(insProducts.id, input.productIds)))).map((p) => p.id)
    : input.productIds;
  const values = { ...rowValues({ ...input, title: `Copy of ${row.title}`.slice(0, CAMPAIGN_LIMITS.title), banner: own.banner ? "" : input.banner, productIds }, row), startsAt, endsAt };
  const saved = await insertCampaign(ctx, values);
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "duplicate", "campaign", saved.id, `Duplicated campaign ${row.reference} as draft ${saved.reference}`);
  return { ok: true, ...saved };
}

/* ── Read-only ──────────────────────────────────────────────── */

/** The campaign's approval history (never staff-only internal notes) and MarchGear's latest remarks. */
export async function insCampaignHistoryAction(raw: unknown): Promise<ActionResult<{ items: CampaignApprovalEntry[]; remarks: string | null }>> {
  const ctx = await insurerAction("campaigns.manage");
  if (isInsurerError(ctx)) return ctx;
  const parsed = idSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const row = await getCampaign(ctx.vendor.id, parsed.data.id);
  if (!row) return NOT_FOUND;
  const rows = await getDb()
    .select({ a: insApprovals, actorName: users.name })
    .from(insApprovals)
    .leftJoin(users, eq(users.id, insApprovals.actorUserId))
    .where(and(eq(insApprovals.vendorId, ctx.vendor.id), eq(insApprovals.target, "campaign"), eq(insApprovals.targetId, row.id), ne(insApprovals.action, "internal_note")))
    .orderBy(asc(insApprovals.createdAt), asc(insApprovals.id));
  return {
    ok: true,
    remarks: row.adminRemarks,
    items: rows.map(({ a, actorName }) => ({
      id: a.id,
      action: a.action,
      fromStatus: a.fromStatus,
      toStatus: a.toStatus,
      remarks: a.remarks,
      actorSide: a.actorSide,
      // Staff names stay with the team: vendors see "MarchGear".
      actorName: a.actorSide === "admin" ? "MarchGear" : a.actorSide === "system" ? "System" : actorName,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}
