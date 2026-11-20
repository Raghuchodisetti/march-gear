"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { insCovers } from "@/db/schema";
import { INS_COVER_TYPES, type InsCoverStatus, type InsCoverType } from "@/db/enums";
import type { ActionFailure, ActionResult } from "@/lib/action-result";
import { STANDARD_COVER_BY_KEY } from "@/insurance/covers";
import { INS_COVER_STATUS_LABEL } from "@/insurance/labels";
import { FUELS } from "@/insurance/search";
import type { CoverPricing, FuelName } from "@/insurance/types";
import { getCatalog } from "@/server/catalog";
import { insurerAction, isInsurerError } from "@/server/insurance/context";
import { logInsurerActivity, recordInsApproval } from "@/server/insurance/records";
import { invalid } from "@/server/validation";
import type { HistoryEntry } from "@/components/insurance/vendor/approvals/shared";
import { coverHistory, coverUsage, getCoverRow, listCoverViews } from "@/components/insurance/vendor/covers/queries";
import { COVER_LIVE, COVER_LOCKED, COVER_MAX, COVER_MIN_DESCRIPTION, COVER_TYPE_META, PRICING_RANGE, type CoverView } from "@/components/insurance/vendor/covers/shared";

/* ──────────────────────────────────────────────────────────────
   Coverage items and add-on covers. Each is reviewed by MarchGear
   on its own (ins_covers.status); only approved covers show on
   public product pages and in estimates. The vendor saves drafts,
   submits, withdraws, archives (→ draft) and deletes unused,
   never-approved ones. Every change is scoped by the vendor.
   ────────────────────────────────────────────────────────────── */

const idSchema = z.coerce.number().int().positive().max(2_147_483_647);
const fail = (error: string, fieldErrors?: Record<string, string>): ActionFailure => ({ ok: false, error, ...(fieldErrors ? { fieldErrors } : {}) });

const lineList = (max: number, each: number, label: string) =>
  z
    .array(z.string().trim().max(each, `Keep each ${label} under ${each} characters`))
    .max(max, `Up to ${max} ${label}s`)
    .transform((l) => [...new Set(l.filter(Boolean))]);

const decimal = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).replace(/[,\s₹%]/g, ""))
  .refine((v) => v === "" || /^\d+(\.\d+)?$/.test(v), "Enter a number")
  .transform((v) => (v === "" ? null : Number(v)));

const coverSchema = z.object({
  key: z.string().trim().max(40).regex(/^[a-z0-9_]+$/, "Choose a template or custom"),
  name: z.string().trim().max(COVER_MAX.name, `Keep the name under ${COVER_MAX.name} characters`),
  description: z.string().trim().max(COVER_MAX.description, `Keep the description under ${COVER_MAX.description.toLocaleString("en-IN")} characters`),
  eligibility: z.string().trim().max(COVER_MAX.eligibility, `Keep this under ${COVER_MAX.eligibility} characters`),
  maxVehicleAgeYears: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .refine((v) => v === "" || /^\d{1,2}$/.test(v), "Enter whole years")
    .transform((v) => (v === "" ? null : Number(v))),
  fuels: z.array(z.enum(FUELS as [FuelName, ...FuelName[]], { error: "Choose a fuel from the list" })).max(FUELS.length),
  exclusions: lineList(COVER_MAX.exclusions, 200, "exclusion"),
  limits: z.string().trim().max(COVER_MAX.limits, `Keep this under ${COVER_MAX.limits} characters`),
  pricing: z.object({ basis: z.enum(["included", "flat", "pct_idv", "pct_od"], { error: "Choose how it's priced" }), value: decimal }),
});
type ParsedCover = z.output<typeof coverSchema>;

/** Everything MarchGear needs to review the cover. Keys match the editor's fields. */
function submitProblems(d: ParsedCover, maxAge: number): Record<string, string> {
  const e: Record<string, string> = {};
  if (d.name.length < 3) e.name = "Enter the cover's name";
  if (d.description.length < COVER_MIN_DESCRIPTION) e.description = `Describe what's covered in at least ${COVER_MIN_DESCRIPTION} characters`;
  if (d.maxVehicleAgeYears !== null && (d.maxVehicleAgeYears < 1 || d.maxVehicleAgeYears > maxAge)) e.maxVehicleAgeYears = `Choose 1–${maxAge} years, or leave it empty for any age`;
  const r = PRICING_RANGE[d.pricing.basis];
  if (d.pricing.basis !== "included") {
    if (d.pricing.value === null) e["pricing.value"] = "Enter the price";
    else if (d.pricing.value < r.min || d.pricing.value > r.max) e["pricing.value"] = `Enter ${r.unit === "₹" ? "₹" : ""}${r.min.toLocaleString("en-IN")}–${r.max.toLocaleString("en-IN")}${r.unit === "%" ? "%" : ""}`;
  }
  return e;
}

/** Field checks that apply to drafts too (values that are there must be sensible). */
function draftProblems(d: ParsedCover, maxAge: number): Record<string, string> {
  const e: Record<string, string> = {};
  if (d.name.length < 2) e.name = "Give the cover a name to save it";
  if (d.maxVehicleAgeYears !== null && (d.maxVehicleAgeYears < 1 || d.maxVehicleAgeYears > maxAge)) e.maxVehicleAgeYears = `Choose 1–${maxAge} years, or leave it empty for any age`;
  const r = PRICING_RANGE[d.pricing.basis];
  if (d.pricing.basis !== "included" && d.pricing.value !== null && (d.pricing.value < r.min || d.pricing.value > r.max))
    e["pricing.value"] = `Enter ${r.min.toLocaleString("en-IN")}–${r.max.toLocaleString("en-IN")}${r.unit === "%" ? "%" : ""}`;
  return e;
}

const pricingOf = (d: ParsedCover): CoverPricing => (d.pricing.basis === "included" ? { basis: "included", value: 0 } : { basis: d.pricing.basis, value: d.pricing.value ?? 0 });

function refresh(type: InsCoverType) {
  revalidatePath(COVER_TYPE_META[type].base);
  revalidatePath("/insurance-vendor/approvals");
  revalidatePath("/insurance-vendor/products", "layout");
}

const saveInput = z.object({
  id: idSchema.optional(),
  type: z.enum(INS_COVER_TYPES),
  intent: z.enum(["draft", "submit"]),
  /** The vendor confirmed that editing an approved cover sends it back for approval. */
  acknowledgeLive: z.boolean().optional(),
  values: z.unknown(),
});

export async function saveCoverAction(input: unknown): Promise<ActionResult<{ id: number; status: InsCoverStatus }>> {
  const ctx = await insurerAction("products.manage");
  if (isInsurerError(ctx)) return ctx;
  const shell = saveInput.safeParse(input);
  if (!shell.success) return fail("Something went wrong. Reload the page and try again.");
  const { type, intent, acknowledgeLive } = shell.data;
  const parsed = coverSchema.safeParse(shell.data.values);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const maxAge = (await getCatalog()).content.insurancePricing.maxVehicleAgeYears;

  const std = STANDARD_COVER_BY_KEY[d.key];
  if (d.key !== "custom" && (!std || std.type !== type)) return fail("That template isn't available here. Start again from the list.");

  const db = getDb();
  const existing = shell.data.id ? await getCoverRow(ctx.vendor.id, shell.data.id) : null;
  if (shell.data.id && !existing) return fail("This cover no longer exists. Someone at your company may have deleted it.");
  if (existing && existing.type !== type) return fail("This cover belongs to the other list.");
  if (existing && COVER_LOCKED.includes(existing.status)) return fail("This cover is waiting for MarchGear's review. Withdraw it first to make changes.");
  const live = existing ? COVER_LIVE.includes(existing.status) : false;
  if (live && !acknowledgeLive) return fail("This cover is approved. Confirm that saving sends it back for approval.");

  // Approved covers can only be resubmitted; a "draft" save of one would take it offline silently.
  const submit = intent === "submit" || live;
  const errors = submit ? { ...draftProblems(d, maxAge), ...submitProblems(d, maxAge) } : draftProblems(d, maxAge);
  if (Object.keys(errors).length) return fail(submit ? "Complete the highlighted fields to submit for approval." : "Please check the highlighted fields.", errors);

  // One cover per standard template (custom covers can repeat).
  if (d.key !== "custom") {
    const [dupe] = await db
      .select({ id: insCovers.id, name: insCovers.name })
      .from(insCovers)
      .where(and(eq(insCovers.vendorId, ctx.vendor.id), eq(insCovers.type, type), eq(insCovers.key, d.key)))
      .limit(2);
    if (dupe && dupe.id !== existing?.id) return fail(`You already have “${dupe.name}” from this template. Edit that one, or start a custom cover.`);
  }

  const now = new Date();
  const prev = existing?.status ?? null;
  const next: InsCoverStatus = submit ? "pending_approval" : (prev ?? "draft");
  const values = {
    key: d.key,
    name: d.name,
    description: d.description,
    eligibility: d.eligibility || null,
    maxVehicleAgeYears: d.maxVehicleAgeYears,
    fuels: d.fuels,
    exclusions: d.exclusions,
    limits: d.limits || null,
    pricing: pricingOf(d),
    status: next,
    ...(submit ? { submittedAt: now } : {}),
  };

  let id = existing?.id ?? 0;
  if (existing) {
    // Only if nobody changed its status meanwhile (e.g. MarchGear deciding it) — never undo a staff decision.
    const [res] = await db.update(insCovers).set(values).where(and(eq(insCovers.id, existing.id), eq(insCovers.vendorId, ctx.vendor.id), eq(insCovers.status, existing.status)));
    if (!res.affectedRows) return fail("This cover changed in the meantime (MarchGear may have reviewed it). Reload the page and try again.");
  } else {
    const [res] = await db.insert(insCovers).values({ ...values, vendorId: ctx.vendor.id, type });
    id = res.insertId;
  }

  const noun = COVER_TYPE_META[type].singular;
  if (submit) {
    await recordInsApproval({
      vendorId: ctx.vendor.id,
      target: "cover",
      targetId: id,
      action: existing?.submittedAt ? "resubmitted" : "submitted",
      fromStatus: prev ?? "draft",
      toStatus: "pending_approval",
      remarks: live ? "Edited after approval — offline until MarchGear approves the changes." : null,
      actorUserId: ctx.user.id,
      actorSide: "vendor",
    });
  }
  await logInsurerActivity(
    ctx.vendor.id,
    ctx.user.id,
    existing ? (submit ? "submit" : "update") : "create",
    "cover",
    id,
    `${existing ? "Updated" : "Added"} the ${noun} “${d.name}”${submit ? " and submitted it for approval" : " as a draft"}`,
  );
  refresh(type);
  return { ok: true, id, status: next };
}

/** Takes a cover out of MarchGear's queue so it can be edited again. */
export async function withdrawCoverAction(coverId: unknown): Promise<ActionResult> {
  const ctx = await insurerAction("products.manage");
  if (isInsurerError(ctx)) return ctx;
  const id = idSchema.safeParse(coverId);
  if (!id.success) return fail("Choose a cover.");
  const row = await getCoverRow(ctx.vendor.id, id.data);
  if (!row) return fail("This cover no longer exists.");
  if (row.status !== "pending_approval") return fail("Only covers waiting for review can be withdrawn.");
  await getDb().update(insCovers).set({ status: "draft" }).where(and(eq(insCovers.id, row.id), eq(insCovers.vendorId, ctx.vendor.id)));
  await recordInsApproval({ vendorId: ctx.vendor.id, target: "cover", targetId: row.id, action: "withdrawn", fromStatus: row.status, toStatus: "draft", actorUserId: ctx.user.id, actorSide: "vendor" });
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "withdraw", "cover", row.id, `Withdrew “${row.name}” from review`);
  refresh(row.type);
  return { ok: true };
}

/** Sets a cover back to draft — it disappears from public product pages until it's approved again. */
export async function archiveCoverAction(coverId: unknown): Promise<ActionResult> {
  const ctx = await insurerAction("products.manage");
  if (isInsurerError(ctx)) return ctx;
  const id = idSchema.safeParse(coverId);
  if (!id.success) return fail("Choose a cover.");
  const row = await getCoverRow(ctx.vendor.id, id.data);
  if (!row) return fail("This cover no longer exists.");
  if (row.status === "draft") return fail("This cover is already a draft.");
  await getDb().update(insCovers).set({ status: "draft" }).where(and(eq(insCovers.id, row.id), eq(insCovers.vendorId, ctx.vendor.id)));
  await recordInsApproval({
    vendorId: ctx.vendor.id,
    target: "cover",
    targetId: row.id,
    action: "archived",
    fromStatus: row.status,
    toStatus: "draft",
    remarks: `Archived by the vendor (was ${INS_COVER_STATUS_LABEL[row.status].toLowerCase()}).`,
    actorUserId: ctx.user.id,
    actorSide: "vendor",
  });
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "archive", "cover", row.id, `Archived “${row.name}” to draft`);
  refresh(row.type);
  return { ok: true };
}

/** Deletes a cover no product uses and MarchGear never approved. */
export async function deleteCoverAction(coverId: unknown): Promise<ActionResult> {
  const ctx = await insurerAction("products.manage");
  if (isInsurerError(ctx)) return ctx;
  const id = idSchema.safeParse(coverId);
  if (!id.success) return fail("Choose a cover.");
  const row = await getCoverRow(ctx.vendor.id, id.data);
  if (!row) return fail("This cover no longer exists.");
  const [usage, views] = await Promise.all([coverUsage(ctx.vendor.id), listCoverViews(ctx.vendor.id, row.type)]);
  const used = usage.get(row.id) ?? [];
  if (used.length) return fail(`${used.map((p) => p.reference).join(", ")} ${used.length === 1 ? "uses" : "use"} this cover. Remove it from ${used.length === 1 ? "that product" : "those products"} first, or archive it instead.`);
  if (views.find((v) => v.id === row.id)?.everApproved) return fail("MarchGear has approved this cover before, so it's kept for the record. Archive it instead.");
  await getDb().delete(insCovers).where(and(eq(insCovers.id, row.id), eq(insCovers.vendorId, ctx.vendor.id)));
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "delete", "cover", row.id, `Deleted the ${COVER_TYPE_META[row.type].singular} “${row.name}”`);
  refresh(row.type);
  return { ok: true };
}

/** One cover with its usage and vendor-visible history, for the editor drawer. */
export async function coverDetailAction(coverId: unknown): Promise<ActionResult<{ cover: CoverView; history: HistoryEntry[] }>> {
  const ctx = await insurerAction("products.view");
  if (isInsurerError(ctx)) return ctx;
  const id = idSchema.safeParse(coverId);
  if (!id.success) return fail("Choose a cover.");
  const row = await getCoverRow(ctx.vendor.id, id.data);
  if (!row) return fail("This cover no longer exists.");
  const [views, history] = await Promise.all([listCoverViews(ctx.vendor.id, row.type), coverHistory(ctx.vendor.id, row.id)]);
  const cover = views.find((v) => v.id === row.id);
  if (!cover) return fail("This cover no longer exists.");
  return { ok: true, cover, history };
}
