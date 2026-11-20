"use server";

import { z } from "zod";
import { and, eq, inArray, like } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { insCompanies, insCovers, insFiles, insProducts } from "@/db/schema";
import { INS_PRODUCT_CATEGORIES, type InsProductStatus } from "@/db/enums";
import type { ActionFailure, ActionResult } from "@/lib/action-result";
import { INDIA_CITIES } from "@/data/india-cities";
import { INDIAN_STATES, isIndianState } from "@/data/states";
import { CATEGORY_TERMS, DEFAULT_PRODUCT_PRICING, type PricingConfig } from "@/insurance/estimator";
import { INS_PRODUCT_CATEGORY_LABEL, INS_PRODUCT_STATUS_LABEL } from "@/insurance/labels";
import { FUELS } from "@/insurance/search";
import type { FileRef, FuelName, ProductCoverage, ProductDocuments, ProductEligibility, ProductPricing } from "@/insurance/types";
import { getCatalog } from "@/server/catalog";
import { isDuplicate } from "@/server/db-errors";
import { insurerAction, isInsurerError, type InsurerContext } from "@/server/insurance/context";
import { publishLimitError } from "@/server/insurance/catalog-limits";
import { insReference, logInsurerActivity, recordInsApproval } from "@/server/insurance/records";
import { invalid } from "@/server/validation";
import { getProductRow, type ProductRow } from "@/components/insurance/vendor/products/queries";
import {
  BODY_TYPES,
  CODE_PATTERN,
  MIN_DESCRIPTION,
  PRICING_LIMITS,
  PRODUCT_LIVE,
  PRODUCT_LOCKED,
  PRODUCT_MAX,
  PRODUCT_SUBMITTABLE,
  isIntermediary,
  pricingConfigOf,
  productToForm,
  publicProductHref,
} from "@/components/insurance/vendor/products/shared";

/* ──────────────────────────────────────────────────────────────
   Insurance products. The vendor saves drafts and submits them;
   MarchGear approves (→ approved / published), asks for changes or
   rejects. The vendor may publish an approved product (within the
   plan's limit), unpublish a published one, duplicate, withdraw a
   submission and delete a never-submitted draft. Editing an
   approved or published product sends it back to pending_approval
   (offline until re-approved) — the vendor confirms that first.
   Every read and write is scoped by ctx.vendor.id.
   ────────────────────────────────────────────────────────────── */

const idSchema = z.coerce.number().int().positive().max(2_147_483_647);
const fail = (error: string, fieldErrors?: Record<string, string>): ActionFailure => ({ ok: false, error, ...(fieldErrors ? { fieldErrors } : {}) });

/* ── Validation ─────────────────────────────────────────────── */

/** A number typed into a text box ("2.8", "-10", "1,500"); "" → null. */
const num = (signed = false) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => String(v).replace(/[,\s₹%]/g, ""))
    .refine((v) => v === "" || (signed ? /^-?\d+(\.\d+)?$/ : /^\d+(\.\d+)?$/).test(v), "Enter a number")
    .transform((v) => (v === "" ? null : Number(v)));
const whole = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).replace(/[,\s₹]/g, ""))
  .refine((v) => v === "" || /^\d+$/.test(v), "Enter a whole number")
  .transform((v) => (v === "" ? null : Number(v)));
const lines = (max: number, each: number, label: string) =>
  z
    .array(z.string().trim().max(each, `Keep each ${label} under ${each} characters`))
    .max(max, `Up to ${max} ${label}s`)
    .transform((l) => [...new Set(l.filter(Boolean))]);
const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{0,119}$/, "Choose from the list");
const fileRef = z.object({ id: z.number().int().positive(), filename: z.string().max(200), mime: z.string().max(60), size: z.number().int().min(0) }).nullable();

const productSchema = z.object({
  name: z.string().trim().max(PRODUCT_MAX.name, `Keep the name under ${PRODUCT_MAX.name} characters`),
  code: z.string().trim().max(PRODUCT_MAX.code, `Keep the code under ${PRODUCT_MAX.code} characters`),
  uin: z.string().trim().toUpperCase().max(PRODUCT_MAX.uin, `Keep the UIN under ${PRODUCT_MAX.uin} characters`),
  category: z.enum(INS_PRODUCT_CATEGORIES, { error: "Choose a category" }),
  tagline: z.string().trim().max(PRODUCT_MAX.tagline, `Keep the tagline under ${PRODUCT_MAX.tagline} characters`),
  description: z.string().trim().max(PRODUCT_MAX.description, "Keep the description under 5,000 characters"),
  companyId: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim())
    .refine((v) => v === "" || /^\d{1,10}$/.test(v), "Choose the insurer")
    .transform((v) => (v ? Number(v) : null)),
  eligibility: z.object({
    bodyTypes: z.array(z.enum(BODY_TYPES, { error: "Choose a body type from the list" })).max(BODY_TYPES.length),
    luxury: z.enum(["any", "exclude", "only"]),
    brands: z.array(slug).max(PRODUCT_MAX.brands, `Up to ${PRODUCT_MAX.brands} brands`),
    models: z.array(slug).max(PRODUCT_MAX.models, `Up to ${PRODUCT_MAX.models} models`),
    fuels: z.array(z.enum(FUELS as [FuelName, ...FuelName[]], { error: "Choose a fuel from the list" })).max(FUELS.length),
    minAgeYears: whole,
    maxAgeYears: whole,
    states: z.array(z.string().max(64)).max(PRODUCT_MAX.states),
    cities: z.array(z.string().max(64)).max(PRODUCT_MAX.cities, `Up to ${PRODUCT_MAX.cities} cities`),
  }),
  coverage: z.object({
    ownDamage: z.boolean(),
    thirdParty: z.boolean(),
    paOwnerDriver: z.enum(["included", "optional", "none"]),
    tpPropertyLimit: z.string().trim().max(PRODUCT_MAX.tpLimit, `Keep this under ${PRODUCT_MAX.tpLimit} characters`),
    coverIds: z.array(idSchema).max(30, "Up to 30 coverage items"),
    highlights: lines(PRODUCT_MAX.highlights, 120, "highlight"),
  }),
  addOns: z.array(z.object({ coverId: idSchema, included: z.boolean() })).max(30, "Up to 30 add-on covers"),
  pricing: z.object({
    odRatePct: num(),
    minOdPremium: num(),
    idvMinPct: num(true),
    idvMaxPct: num(true),
    odYears: whole,
    tpYears: whole,
    odAdjustmentPct: num(true),
  }),
  deductibles: z.object({
    compulsory: whole,
    voluntary: z.array(z.number().int().min(PRICING_LIMITS.deductible.min).max(PRICING_LIMITS.deductible.max, "Up to ₹1,00,000")).max(PRODUCT_MAX.voluntary, `Up to ${PRODUCT_MAX.voluntary} options`),
  }),
  garageCount: whole,
  exclusions: lines(PRODUCT_MAX.exclusions, 200, "exclusion"),
  documents: z.object({ brochure: fileRef, wording: fileRef, tieUp: fileRef }),
  terms: z.string().trim().max(PRODUCT_MAX.terms, "Keep the terms under 8,000 characters"),
});
type Parsed = z.output<typeof productSchema>;

const inRange = (v: number | null, r: { min: number; max: number }) => v !== null && v >= r.min && v <= r.max;

/** Checks that apply to drafts too — whatever is filled in must be sensible. */
function draftProblems(d: Parsed, config: PricingConfig): Record<string, string> {
  const e: Record<string, string> = {};
  if (d.name.length < 3) e.name = "Name the product (at least 3 characters) to save it";
  if (!CODE_PATTERN.test(d.code)) e.code = "Enter your product code — letters, numbers, dots, dashes or slashes (2–40)";
  if (!d.companyId) e.companyId = "Choose the underwriting insurer";
  const el = d.eligibility;
  if (el.minAgeYears !== null && el.maxAgeYears !== null && el.maxAgeYears < el.minAgeYears) e["eligibility.maxAgeYears"] = "The maximum age can't be below the minimum";
  if (el.maxAgeYears !== null && el.maxAgeYears > config.maxVehicleAgeYears) e["eligibility.maxAgeYears"] = `MarchGear estimates for cars up to ${config.maxVehicleAgeYears} years old`;
  const p = d.pricing;
  if (p.odRatePct !== null && !inRange(p.odRatePct, config.odRate)) e["pricing.odRatePct"] = `Set an own-damage rate between ${config.odRate.min}% and ${config.odRate.max}% of IDV`;
  if (p.minOdPremium !== null && !inRange(p.minOdPremium, PRICING_LIMITS.minOdPremium)) e["pricing.minOdPremium"] = "Enter ₹0 to ₹1,00,000";
  if (p.idvMinPct !== null && !inRange(p.idvMinPct, PRICING_LIMITS.idvMinPct)) e["pricing.idvMinPct"] = "Enter 0 to −30%";
  if (p.idvMaxPct !== null && !inRange(p.idvMaxPct, PRICING_LIMITS.idvMaxPct)) e["pricing.idvMaxPct"] = "Enter 0 to +30%";
  if (p.odYears !== null && !inRange(p.odYears, PRICING_LIMITS.odYears)) e["pricing.odYears"] = "0 to 5 years";
  if (p.tpYears !== null && !inRange(p.tpYears, PRICING_LIMITS.tpYears)) e["pricing.tpYears"] = "0 to 5 years";
  if (p.odAdjustmentPct !== null && !inRange(p.odAdjustmentPct, PRICING_LIMITS.odAdjustmentPct)) e["pricing.odAdjustmentPct"] = "Enter −50% to +50%";
  if (d.deductibles.compulsory !== null && !inRange(d.deductibles.compulsory, PRICING_LIMITS.deductible)) e["deductibles.compulsory"] = "Enter ₹0 to ₹1,00,000";
  if (d.garageCount !== null && !inRange(d.garageCount, PRICING_LIMITS.garages)) e.garageCount = "Enter 0 to 1,00,000";
  return e;
}

/** Everything MarchGear needs to review the product. Keys match the form's fields. */
function submitProblems(d: Parsed, config: PricingConfig, intermediary: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  if (d.description.length < MIN_DESCRIPTION) e.description = `Describe the product in at least ${MIN_DESCRIPTION} characters`;
  if (intermediary && !d.documents.tieUp) e["documents.tieUp"] = "Upload the insurer's authorisation or tie-up letter for this product";
  const el = d.eligibility;
  if (el.minAgeYears === null) e["eligibility.minAgeYears"] = "Enter the minimum car age (0 for new cars)";
  if (el.maxAgeYears === null) e["eligibility.maxAgeYears"] = "Enter the maximum car age";
  const c = d.coverage;
  const terms = CATEGORY_TERMS[d.category];
  const label = INS_PRODUCT_CATEGORY_LABEL[d.category];
  if (!c.ownDamage && !c.thirdParty) e["coverage.ownDamage"] = "A product must cover own damage, third-party liability or both";
  else if (terms.odYears === 0 && c.ownDamage) e["coverage.ownDamage"] = `${label} products don't include own-damage cover`;
  else if (terms.tpYears === 0 && c.thirdParty) e["coverage.thirdParty"] = `${label} products don't include third-party cover`;
  else if (terms.odYears > 0 && terms.tpYears > 0 && d.category !== "new_car" && d.category !== "used_car" && d.category !== "ev" && (!c.ownDamage || !c.thirdParty))
    e["coverage.ownDamage"] = `${label} products cover both own damage and third-party liability`;
  if (!c.thirdParty && c.paOwnerDriver !== "none") e["coverage.paOwnerDriver"] = "Owner-driver PA cover comes with third-party cover — choose “Not offered”";
  if (c.thirdParty && !c.tpPropertyLimit) e["coverage.tpPropertyLimit"] = "Enter the third-party property damage limit, e.g. ₹7.5 lakh";
  const p = d.pricing;
  if (c.ownDamage) {
    if (p.odRatePct === null) e["pricing.odRatePct"] = "Enter the own-damage rate";
    if (p.minOdPremium === null) e["pricing.minOdPremium"] = "Enter the minimum own-damage premium";
    if (p.idvMinPct === null) e["pricing.idvMinPct"] = "Enter how far below the IDV customers may go";
    if (p.idvMaxPct === null) e["pricing.idvMaxPct"] = "Enter how far above the IDV customers may go";
    if (!p.odYears) e["pricing.odYears"] = "Own-damage cover needs at least 1 year";
  }
  if (c.thirdParty && !p.tpYears) e["pricing.tpYears"] = "Third-party cover needs at least 1 year";
  if (d.deductibles.compulsory === null) e["deductibles.compulsory"] = "Enter the compulsory deductible (₹0 if none)";
  if (!d.exclusions.length) e.exclusions = "List at least one exclusion customers should know about";
  if (!d.documents.wording) e["documents.wording"] = "Upload the policy wording (PDF)";
  return e;
}

/** Checks that need the database or the catalogue. Returns the cleaned eligibility and documents. */
async function crossCheck(ctx: InsurerContext, d: Parsed, submit: boolean, existing: ProductRow | null) {
  const e: Record<string, string> = {};
  const db = getDb();
  const cat = await getCatalog();

  // Underwriting insurer.
  if (d.companyId) {
    const [co] = await db.select({ id: insCompanies.id, vendorId: insCompanies.vendorId, isActive: insCompanies.isActive, name: insCompanies.name }).from(insCompanies).where(eq(insCompanies.id, d.companyId)).limit(1);
    if (!co) e.companyId = "That insurer is no longer listed. Choose another.";
    else if (ctx.vendor.category === "insurer" && co.vendorId !== ctx.vendor.id) e.companyId = "Insurers list products under their own company only.";
    else if (!co.isActive && (submit || co.id !== existing?.companyId)) e.companyId = `${co.name} isn't active on MarchGear right now. Choose another insurer or contact support.`;
  }

  // Catalogue brands and models (models must belong to the chosen brands, when brands are chosen).
  const el = d.eligibility;
  const brands = [...new Set(el.brands)];
  const badBrand = brands.find((b) => !cat.getBrand(b));
  if (badBrand) e["eligibility.brands"] = "One of the brands is no longer in the catalogue — choose them again";
  const models = [...new Set(el.models)];
  const badModel = models.find((m) => !cat.getCar(m));
  if (badModel) e["eligibility.models"] = "One of the models is no longer in the catalogue — choose them again";
  const keptModels = brands.length ? models.filter((m) => brands.includes(cat.getCar(m)?.brand ?? "")) : models;
  const states = [...new Set(el.states)];
  if (states.some((s) => !isIndianState(s))) e["eligibility.states"] = "Choose states from the list";
  const pool = new Set((states.length ? states.filter(isIndianState) : INDIAN_STATES).flatMap((s) => INDIA_CITIES[s] ?? []));
  for (const c of cat.cities) if (!states.length || states.includes(c.state)) pool.add(c.name);
  const cities = [...new Set(el.cities)];
  if (cities.some((c) => !pool.has(c))) e["eligibility.cities"] = states.length ? "Some cities aren't in the chosen states — choose them again" : "Choose cities from the list";

  // Covers must be this vendor's, of the right type; submitted products can't use drafts or rejected ones.
  const coverIds = [...new Set([...d.coverage.coverIds, ...d.addOns.map((a) => a.coverId)])];
  const covers = coverIds.length
    ? await db
        .select({ id: insCovers.id, type: insCovers.type, name: insCovers.name, status: insCovers.status })
        .from(insCovers)
        .where(and(eq(insCovers.vendorId, ctx.vendor.id), inArray(insCovers.id, coverIds)))
    : [];
  const coverById = new Map(covers.map((c) => [c.id, c]));
  if (d.coverage.coverIds.some((id) => coverById.get(id)?.type !== "coverage")) e["coverage.coverIds"] = "One of the coverage items no longer exists — choose them again";
  if (d.addOns.some((a) => coverById.get(a.coverId)?.type !== "addon")) e.addOns = "One of the add-on covers no longer exists — choose them again";
  if (submit) {
    const notReady = (ids: number[]) => ids.map((id) => coverById.get(id)).filter((c) => c && (c.status === "draft" || c.status === "changes_requested" || c.status === "rejected"));
    const items = notReady(d.coverage.coverIds);
    const adds = notReady(d.addOns.map((a) => a.coverId));
    if (items.length) e["coverage.coverIds"] = `Submit ${items.map((c) => `“${c!.name}”`).join(", ")} for approval first (Coverage), or remove ${items.length === 1 ? "it" : "them"}.`;
    if (adds.length) e.addOns = `Submit ${adds.map((c) => `“${c!.name}”`).join(", ")} for approval first (Add-on covers), or remove ${adds.length === 1 ? "it" : "them"}.`;
  }

  // Documents must be this vendor's uploads of the right kind (and the public ones PDFs).
  const refs: [keyof ProductDocuments, string, boolean][] = [
    ["brochure", "brochure", true],
    ["wording", "policy_wording", true],
    ["tieUp", "tie_up_letter", false],
  ];
  const ids = refs.map(([k]) => d.documents[k]?.id).filter((x): x is number => Boolean(x));
  const files = ids.length
    ? await db
        .select({ id: insFiles.id, kind: insFiles.kind, filename: insFiles.filename, mime: insFiles.mime, size: insFiles.size })
        .from(insFiles)
        .where(and(eq(insFiles.vendorId, ctx.vendor.id), inArray(insFiles.id, ids)))
    : [];
  const fileById = new Map(files.map((f) => [f.id, f]));
  const documents: ProductDocuments = { brochure: null, wording: null, tieUp: null };
  for (const [k, kind, pdf] of refs) {
    const ref = d.documents[k];
    if (!ref) continue;
    const f = fileById.get(ref.id);
    if (!f || f.kind !== kind) e[`documents.${k}`] = "Upload this document again";
    else if (pdf && f.mime !== "application/pdf") e[`documents.${k}`] = "Upload a PDF";
    else documents[k] = { id: f.id, filename: f.filename, mime: f.mime, size: f.size } satisfies FileRef;
  }

  return { errors: e, eligibility: { ...el, brands, models: keptModels, states, cities }, documents };
}

function toColumns(d: Parsed, cleaned: { eligibility: Parsed["eligibility"]; documents: ProductDocuments }, config: PricingConfig) {
  const def = DEFAULT_PRODUCT_PRICING(d.category, config);
  const el = cleaned.eligibility;
  const eligibility: ProductEligibility = {
    bodyTypes: el.bodyTypes,
    luxury: el.luxury,
    brands: el.brands,
    models: el.models,
    fuels: el.fuels,
    minAgeYears: el.minAgeYears ?? 0,
    maxAgeYears: el.maxAgeYears ?? config.maxVehicleAgeYears,
    states: el.states,
    cities: el.cities,
  };
  const c = d.coverage;
  const coverage: ProductCoverage = {
    ownDamage: c.ownDamage,
    thirdParty: c.thirdParty,
    paOwnerDriver: c.thirdParty ? c.paOwnerDriver : "none",
    tpPropertyLimit: c.thirdParty ? c.tpPropertyLimit : "",
    coverIds: [...new Set(c.coverIds)],
    highlights: c.highlights,
  };
  const p = d.pricing;
  // Drafts may leave numbers blank; the defaults fill them so the row stays well-formed.
  const pricing: ProductPricing = {
    odRatePct: p.odRatePct ?? def.odRatePct,
    minOdPremium: p.minOdPremium ?? def.minOdPremium,
    idvMinPct: p.idvMinPct ?? def.idvMinPct,
    idvMaxPct: p.idvMaxPct ?? def.idvMaxPct,
    odYears: c.ownDamage ? (p.odYears ?? (def.odYears || 1)) : 0,
    tpYears: c.thirdParty ? (p.tpYears ?? (def.tpYears || 1)) : 0,
    odAdjustmentPct: p.odAdjustmentPct ?? 0,
  };
  const seen = new Set<number>();
  return {
    name: d.name,
    code: d.code,
    uin: d.uin || null,
    category: d.category,
    tagline: d.tagline || null,
    description: d.description,
    companyId: d.companyId!,
    eligibility,
    coverage,
    addOns: d.addOns.filter((a) => (seen.has(a.coverId) ? false : (seen.add(a.coverId), true))),
    pricing,
    deductibles: { compulsory: d.deductibles.compulsory ?? 0, voluntary: [...new Set(d.deductibles.voluntary)].sort((a, b) => a - b) },
    garageCount: d.garageCount,
    exclusions: d.exclusions,
    documents: cleaned.documents,
    terms: d.terms || null,
  };
}

function refresh(id?: number, reference?: string, publicToo = false) {
  revalidatePath("/insurance-vendor/products", "layout");
  revalidatePath("/insurance-vendor/approvals");
  revalidatePath("/insurance-vendor/dashboard");
  if (id) revalidatePath(`/insurance-vendor/products/${id}`);
  if (publicToo) {
    revalidatePath("/insurance", "layout");
    if (reference) revalidatePath(publicProductHref(reference));
  }
}

const labelOf = (p: { reference: string; name: string }) => `${p.reference} · ${p.name || "untitled"}`;

/** Saves (and optionally submits) a product. Shared by the form and the list's "Submit". */
async function persist(ctx: InsurerContext, existing: ProductRow | null, values: unknown, intent: "draft" | "submit", acknowledgeLive: boolean): Promise<ActionResult<{ id: number; reference: string; status: InsProductStatus }>> {
  const parsed = productSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const config = pricingConfigOf((await getCatalog()).content.insurancePricing);

  if (existing && PRODUCT_LOCKED.includes(existing.status))
    return fail(existing.status === "suspended" ? "MarchGear has suspended this product, so it can't be changed. Contact support for details." : "This product is waiting for MarchGear's review. Withdraw it first to make changes.");
  const live = existing ? PRODUCT_LIVE.includes(existing.status) : false;
  if (live && !acknowledgeLive) return fail("This product is approved. Confirm that saving sends it back for approval and takes it offline.");
  const submit = intent === "submit" || live;
  if (existing && submit && !live && !PRODUCT_SUBMITTABLE.includes(existing.status)) return fail(`A product that's ${INS_PRODUCT_STATUS_LABEL[existing.status].toLowerCase()} can't be submitted.`);

  const intermediary = isIntermediary(ctx.vendor.category);
  const basic = draftProblems(d, config);
  const full = submit ? submitProblems(d, config, intermediary) : {};
  const cross = await crossCheck(ctx, d, submit, existing);
  const errors = { ...full, ...basic, ...cross.errors };
  if (Object.keys(errors).length) return fail(submit ? "Complete the highlighted fields to submit for approval." : "Please check the highlighted fields.", errors);

  const db = getDb();
  const now = new Date();
  const prev = existing?.status ?? null;
  const next: InsProductStatus = submit ? "pending_approval" : (prev ?? "draft");
  const columns = { ...toColumns(d, cross, config), status: next, ...(submit ? { submittedAt: now } : {}) };

  let id = existing?.id ?? 0;
  let reference = existing?.reference ?? "";
  try {
    if (existing) {
      // Only if nobody changed its status meanwhile (e.g. MarchGear suspending it) — never undo a staff decision.
      const [res] = await db.update(insProducts).set(columns).where(and(eq(insProducts.id, existing.id), eq(insProducts.vendorId, ctx.vendor.id), eq(insProducts.status, existing.status)));
      if (!res.affectedRows) return fail("This product changed in the meantime (MarchGear may have reviewed it). Reload the page and try again.");
    } else {
      for (let attempt = 0; attempt < 4 && !id; attempt++) {
        reference = insReference("PRD");
        try {
          const [res] = await db.insert(insProducts).values({ ...columns, vendorId: ctx.vendor.id, reference, createdBy: ctx.user.id });
          id = res.insertId;
        } catch (err) {
          // A duplicate code is the vendor's to fix; a duplicate reference is ours to retry.
          if (!isDuplicate(err) || attempt === 3 || String((err as { cause?: { message?: string } })?.cause?.message ?? err).includes("ins_products_code_uq")) throw err;
        }
      }
    }
  } catch (err) {
    if (isDuplicate(err)) return fail("Please check the highlighted fields.", { code: "You already have a product with this code. Product codes are unique within your company." });
    throw err;
  }

  const label = labelOf({ reference, name: d.name });
  if (submit) {
    await recordInsApproval({
      vendorId: ctx.vendor.id,
      target: "product",
      targetId: id,
      action: existing?.submittedAt ? "resubmitted" : "submitted",
      fromStatus: prev ?? "draft",
      toStatus: "pending_approval",
      remarks: live ? `Edited after approval — ${prev === "published" ? "taken off the website" : "offline"} until MarchGear approves the changes.` : null,
      actorUserId: ctx.user.id,
      actorSide: "vendor",
    });
  }
  await logInsurerActivity(
    ctx.vendor.id,
    ctx.user.id,
    existing ? (submit ? "submit" : "update") : "create",
    "product",
    id,
    `${existing ? "Updated" : "Created"} ${label}${submit ? (live ? " — sent back for approval after editing" : " and submitted it for approval") : " as a draft"}`,
  );
  refresh(id, reference, prev === "published");
  return { ok: true, id, reference, status: next };
}

/* ── Create / edit / submit ─────────────────────────────────── */

const saveInput = z.object({
  id: idSchema.optional(),
  intent: z.enum(["draft", "submit"]),
  /** The vendor confirmed that editing an approved/published product takes it offline until re-approved. */
  acknowledgeLive: z.boolean().optional(),
  values: z.unknown(),
});

export async function saveProductAction(input: unknown): Promise<ActionResult<{ id: number; reference: string; status: InsProductStatus }>> {
  const ctx = await insurerAction("products.manage");
  if (isInsurerError(ctx)) return ctx;
  const shell = saveInput.safeParse(input);
  if (!shell.success) return fail("Something went wrong. Reload the page and try again.");
  const existing = shell.data.id ? await getProductRow(ctx.vendor.id, shell.data.id) : null;
  if (shell.data.id && !existing) return fail("This product no longer exists. Someone at your company may have deleted it.");
  return persist(ctx, existing, shell.data.values, shell.data.intent, Boolean(shell.data.acknowledgeLive));
}

/** "Submit for approval" from the list — the saved product must be complete. */
export async function submitProductAction(productId: unknown): Promise<ActionResult<{ id: number; reference: string; status: InsProductStatus }>> {
  const ctx = await insurerAction("products.manage");
  if (isInsurerError(ctx)) return ctx;
  const id = idSchema.safeParse(productId);
  if (!id.success) return fail("Choose a product.");
  const row = await getProductRow(ctx.vendor.id, id.data);
  if (!row) return fail("This product no longer exists.");
  if (!PRODUCT_SUBMITTABLE.includes(row.status)) return fail(`${row.reference} is ${INS_PRODUCT_STATUS_LABEL[row.status].toLowerCase()} and can't be submitted.`);
  const res = await persist(ctx, row, productToForm(row), "submit", false);
  if (!res.ok && res.fieldErrors) return fail(`${row.reference} isn't complete yet — open it to fill in the highlighted fields.`, res.fieldErrors);
  return res;
}

/* ── Publish / unpublish ────────────────────────────────────── */

export async function publishProductAction(productId: unknown): Promise<ActionResult> {
  const ctx = await insurerAction("products.manage");
  if (isInsurerError(ctx)) return ctx;
  const id = idSchema.safeParse(productId);
  if (!id.success) return fail("Choose a product.");
  const row = await getProductRow(ctx.vendor.id, id.data);
  if (!row) return fail("This product no longer exists.");
  if (row.status !== "approved") return fail(row.status === "published" ? `${row.reference} is already live.` : "Only products MarchGear has approved can be published.");
  const db = getDb();
  const [co] = await db.select({ isActive: insCompanies.isActive, name: insCompanies.name }).from(insCompanies).where(eq(insCompanies.id, row.companyId)).limit(1);
  if (!co?.isActive) return fail(`${co?.name ?? "The underwriting insurer"} isn't active on MarchGear right now, so the product can't go live. Contact support.`);
  const over = await publishLimitError(ctx.vendor.id, ctx.vendor.plan, row.id);
  if (over) return fail(over);
  await db
    .update(insProducts)
    .set({ status: "published", publishedAt: new Date() })
    .where(and(eq(insProducts.id, row.id), eq(insProducts.vendorId, ctx.vendor.id), eq(insProducts.status, "approved")));
  await recordInsApproval({ vendorId: ctx.vendor.id, target: "product", targetId: row.id, action: "published", fromStatus: "approved", toStatus: "published", actorUserId: ctx.user.id, actorSide: "vendor" });
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "publish", "product", row.id, `Published ${labelOf(row)} on the website`);
  refresh(row.id, row.reference, true);
  return { ok: true };
}

export async function unpublishProductAction(productId: unknown): Promise<ActionResult> {
  const ctx = await insurerAction("products.manage");
  if (isInsurerError(ctx)) return ctx;
  const id = idSchema.safeParse(productId);
  if (!id.success) return fail("Choose a product.");
  const row = await getProductRow(ctx.vendor.id, id.data);
  if (!row) return fail("This product no longer exists.");
  if (row.status !== "published") return fail("Only live products can be unpublished.");
  await getDb()
    .update(insProducts)
    .set({ status: "approved" })
    .where(and(eq(insProducts.id, row.id), eq(insProducts.vendorId, ctx.vendor.id), eq(insProducts.status, "published")));
  await recordInsApproval({ vendorId: ctx.vendor.id, target: "product", targetId: row.id, action: "unpublished", fromStatus: "published", toStatus: "approved", actorUserId: ctx.user.id, actorSide: "vendor" });
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "unpublish", "product", row.id, `Took ${labelOf(row)} off the website`);
  refresh(row.id, row.reference, true);
  return { ok: true };
}

/* ── Withdraw / duplicate / delete ──────────────────────────── */

export async function withdrawProductAction(productId: unknown): Promise<ActionResult> {
  const ctx = await insurerAction("products.manage");
  if (isInsurerError(ctx)) return ctx;
  const id = idSchema.safeParse(productId);
  if (!id.success) return fail("Choose a product.");
  const row = await getProductRow(ctx.vendor.id, id.data);
  if (!row) return fail("This product no longer exists.");
  if (row.status !== "pending_approval" && row.status !== "submitted") return fail("Only products waiting for review can be withdrawn.");
  await getDb().update(insProducts).set({ status: "draft" }).where(and(eq(insProducts.id, row.id), eq(insProducts.vendorId, ctx.vendor.id)));
  await recordInsApproval({ vendorId: ctx.vendor.id, target: "product", targetId: row.id, action: "withdrawn", fromStatus: row.status, toStatus: "draft", actorUserId: ctx.user.id, actorSide: "vendor" });
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "withdraw", "product", row.id, `Withdrew ${labelOf(row)} from review`);
  refresh(row.id);
  return { ok: true };
}

export async function duplicateProductAction(productId: unknown): Promise<ActionResult<{ id: number; reference: string }>> {
  const ctx = await insurerAction("products.manage");
  if (isInsurerError(ctx)) return ctx;
  const id = idSchema.safeParse(productId);
  if (!id.success) return fail("Choose a product.");
  const row = await getProductRow(ctx.vendor.id, id.data);
  if (!row) return fail("This product no longer exists.");
  const db = getDb();

  // A free code: CODE-COPY, CODE-COPY2, …
  const stem = `${row.code.slice(0, PRODUCT_MAX.code - 7)}-COPY`;
  const taken = new Set(
    (await db.select({ code: insProducts.code }).from(insProducts).where(and(eq(insProducts.vendorId, ctx.vendor.id), like(insProducts.code, `${stem}%`)))).map((r) => r.code.toUpperCase()),
  );
  let code = stem;
  for (let n = 2; taken.has(code.toUpperCase()) && n < 100; n++) code = `${stem}${n}`;

  const { id: _id, reference: _ref, createdAt: _c, updatedAt: _u, ...copy } = row;
  void _id;
  void _ref;
  void _c;
  void _u;
  let newId = 0;
  let reference = "";
  for (let attempt = 0; attempt < 4 && !newId; attempt++) {
    reference = insReference("PRD");
    try {
      const [res] = await db.insert(insProducts).values({
        ...copy,
        reference,
        code,
        name: `${row.name} (copy)`.slice(0, PRODUCT_MAX.name),
        status: "draft",
        adminRemarks: null,
        requiredCorrections: null,
        submittedAt: null,
        approvedAt: null,
        publishedAt: null,
        decidedBy: null,
        createdBy: ctx.user.id,
      });
      newId = res.insertId;
    } catch (err) {
      if (!isDuplicate(err) || attempt === 3) return fail("Couldn't create the copy. Please try again.");
    }
  }
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "duplicate", "product", newId, `Copied ${row.reference} into a new draft ${reference}`);
  refresh(newId);
  return { ok: true, id: newId, reference };
}

/** Deletes a draft that was never submitted (anything MarchGear has seen is kept for the record). */
export async function deleteProductAction(productId: unknown): Promise<ActionResult> {
  const ctx = await insurerAction("products.manage");
  if (isInsurerError(ctx)) return ctx;
  const id = idSchema.safeParse(productId);
  if (!id.success) return fail("Choose a product.");
  const row = await getProductRow(ctx.vendor.id, id.data);
  if (!row) return fail("This product no longer exists.");
  if (row.status !== "draft" || row.submittedAt) return fail("Only drafts that were never submitted can be deleted. MarchGear keeps submitted products on record.");
  await getDb()
    .delete(insProducts)
    .where(and(eq(insProducts.id, row.id), eq(insProducts.vendorId, ctx.vendor.id), eq(insProducts.status, "draft")));
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "delete", "product", row.id, `Deleted the draft ${labelOf(row)}`);
  refresh();
  return { ok: true };
}
