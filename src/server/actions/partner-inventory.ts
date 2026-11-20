"use server";

import { z } from "zod";
import { and, count, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { partnerShowrooms, partnerVehicles } from "@/db/schema";
import type { PartnerVehicleStatus } from "@/db/enums";
import type { ActionFailure, ActionResult } from "@/lib/action-result";
import { LEGACY_BRANDS } from "@/lib/catalog";
import { VEHICLE_STATUS_LABEL } from "@/partner/labels";
import type { UsedVehicleDetails } from "@/partner/types";
import type { BodyType, FuelType, Transmission } from "@/types";
import { getCatalog, expireCatalog } from "@/server/catalog";
import { isDuplicate } from "@/server/db-errors";
import { invalid, todayISO } from "@/server/validation";
import { listingLimitError } from "@/server/partner/limits";
import { isActionError, partnerAction, type PartnerContext } from "@/server/partner/context";
import { logPartnerActivity, notifyPartner, recordApproval, reference } from "@/server/partner/records";
import { syncPublicDealer, syncPublicVehicle } from "@/server/partner/public-sync";
import { getPartnerVehicle, getPartnerVehicles, ownedMediaIds, ownsInspectionFile, previewVehicle, vehicleHistory, type VehicleRow } from "@/server/partner/inventory";
import {
  BODY_TYPES,
  FUELS,
  INDIAN_STATES,
  INSURANCE_OPTIONS,
  LIVE,
  MAX_FEATURES,
  MAX_IMAGES,
  MAX_SPECS,
  MAX_VIDEOS,
  MIN_DESCRIPTION,
  MIN_YEAR,
  REG_PATTERN,
  SUBMITTABLE,
  TRANSMISSIONS,
  VIN_PATTERN,
  WITHDRAWABLE,
  currentYear,
  normaliseReg,
  parseVideo,
  vehicleToForm,
  type PublicVehicle,
  type VehicleHistoryEntry,
} from "@/components/portal/inventory/shared";

/* ──────────────────────────────────────────────────────────────
   Dealer vehicle inventory. Every action re-checks the member's
   permission, scopes every read and write by the dealership, and
   keeps the public site in step (a used car's /used-cars mirror,
   the dealer and model pages' new-car stock). Only MarchGear staff
   approve and publish — the dealer can submit, withdraw, archive.
   ────────────────────────────────────────────────────────────── */

const id = z.coerce.number().int().positive().max(2_147_483_647);
const ids = z.array(id).min(1, "Select at least one vehicle").max(100, "Select up to 100 vehicles at a time");

/* ── Validation ─────────────────────────────────────────────── */

const text = (max: number) => z.string().trim().max(max);

/** A whole number typed into a text box ("12,50,000", "₹ 9 99 000"); "" → null. */
const whole = (min: number, max: number, message: string) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => String(v).replace(/[,\s₹]/g, ""))
    .refine((v) => v === "" || /^\d+$/.test(v), "Enter a whole number")
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (v >= min && v <= max), message);

const fileRef = z.object({ id: z.number().int().positive(), filename: z.string().max(200), mime: z.string().max(60), size: z.number().int().min(0) });

const usedSchema = z.object({
  registrationYear: whole(MIN_YEAR, currentYear(), `Choose a registration year between ${MIN_YEAR} and ${currentYear()}`),
  km: whole(0, 1_000_000, "Enter the odometer reading in km (up to 10,00,000)"),
  owners: whole(1, 10, "Enter the number of owners, from 1 to 10"),
  registrationNumber: z
    .string()
    .max(20, "Enter a valid registration number, e.g. KA 01 AB 1234")
    .transform(normaliseReg)
    .refine((v) => v === "" || REG_PATTERN.test(v), "Enter a valid registration number, e.g. KA 01 AB 1234"),
  registrationState: z.union([z.literal(""), z.enum(INDIAN_STATES)], { error: "Choose a state" }),
  accident: z.enum(["", "yes", "no"], { error: "Choose yes or no" }),
  accidentDetails: text(1000),
  insuranceStatus: z.union([z.literal(""), z.enum(INSURANCE_OPTIONS.map((o) => o.value) as [string, ...string[]])], { error: "Choose the insurance status" }),
  insuranceValidUntil: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Choose a date"),
  inspection: fileRef.nullable(),
});

const vehicleSchema = z
  .object({
    kind: z.enum(["new", "used"], { error: "Choose new or used" }),
    brand: z.string().trim().max(80).regex(/^[a-z0-9-]*$/, "Choose a brand"),
    modelSlug: z.string().trim().max(120),
    model: text(120),
    variantSlug: z.string().max(120).optional(),
    variant: text(120),
    year: whole(MIN_YEAR, currentYear() + 1, `Choose a year between ${MIN_YEAR} and ${currentYear() + 1}`),
    bodyType: z.union([z.literal(""), z.enum(BODY_TYPES)], { error: "Choose a body type" }),
    fuel: z.union([z.literal(""), z.enum(FUELS)], { error: "Choose a fuel type" }),
    transmission: z.union([z.literal(""), z.enum(TRANSMISSIONS)], { error: "Choose a transmission" }),
    colour: text(60),
    exShowroom: whole(10_000, 1_000_000_000, "Enter a price between ₹10,000 and ₹100 Cr"),
    sellingPrice: whole(10_000, 1_000_000_000, "Enter a price between ₹10,000 and ₹100 Cr"),
    stock: whole(0, 999, "Stock must be between 0 and 999"),
    vin: z
      .string()
      .max(40)
      .transform((v) => v.toUpperCase().replace(/[\s-]+/g, ""))
      .refine((v) => v === "" || VIN_PATTERN.test(v), "A VIN is 17 letters and digits, without I, O or Q"),
    description: text(5000),
    specs: z
      .array(z.object({ label: text(60), value: text(160) }))
      .max(MAX_SPECS, `Keep it to ${MAX_SPECS} specifications`)
      .superRefine((rows, ctx) =>
        rows.forEach((r, i) => {
          if (r.label && !r.value) ctx.addIssue({ code: "custom", path: [i, "value"], message: "Add a value or remove the row" });
          if (!r.label && r.value) ctx.addIssue({ code: "custom", path: [i, "label"], message: "Add a label or remove the row" });
        }),
      )
      .transform((rows) => rows.filter((r) => r.label && r.value)),
    features: z
      .array(text(120))
      .max(MAX_FEATURES, `Keep it to ${MAX_FEATURES} features`)
      .transform((list) => [...new Set(list.filter(Boolean))]),
    images: z.array(z.string().max(300).regex(/^\/media\/\d+\/[\w.-]+$/, "Upload photos with the uploader")).max(MAX_IMAGES, `Add up to ${MAX_IMAGES} photos`),
    videos: z
      .array(z.string().trim().max(300, "That link is too long"))
      .max(MAX_VIDEOS, `Add up to ${MAX_VIDEOS} videos`)
      .superRefine((list, ctx) =>
        list.forEach((v, i) => {
          if (v && !parseVideo(v)) ctx.addIssue({ code: "custom", path: [i], message: "Paste a YouTube or Vimeo link, e.g. https://youtu.be/…" });
        }),
      )
      .transform((list) => [...new Set(list.filter(Boolean).map((v) => parseVideo(v)!.url))]),
    showroomId: z
      .union([z.string(), z.number()])
      .transform((v) => String(v).trim())
      .refine((v) => v === "" || /^\d{1,10}$/.test(v), "Choose a showroom")
      .transform((v) => (v ? Number(v) : null)),
    used: usedSchema,
  })
  .superRefine((d, ctx) => {
    if (d.kind !== "used") return;
    const u = d.used;
    if (u.registrationYear && d.year && u.registrationYear < d.year) ctx.addIssue({ code: "custom", path: ["used", "registrationYear"], message: "Registration can't be before the manufacturing year" });
  });

type Parsed = z.output<typeof vehicleSchema>;

const fail = (error: string, fieldErrors?: Record<string, string>): ActionFailure => ({ ok: false, error, ...(fieldErrors ? { fieldErrors } : {}) });

/** What must be filled in before MarchGear can review the listing. Keys match the form's fields. */
function missingForSubmit(d: Parsed, hasShowrooms: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  if (!d.brand) e.brand = "Choose a brand";
  if (!d.model) e.model = "Choose or enter the model";
  if (!d.variant) e.variant = "Choose or enter the variant";
  if (!d.year) e.year = "Choose the year";
  if (!d.bodyType) e.bodyType = "Choose a body type";
  if (!d.fuel) e.fuel = "Choose a fuel type";
  if (!d.transmission) e.transmission = "Choose a transmission";
  if (!d.colour) e.colour = "Choose or enter the colour";
  if (d.kind === "new" && !d.exShowroom) e.exShowroom = "Enter the ex-showroom price";
  if (!d.sellingPrice) e.sellingPrice = "Enter the selling price";
  if (!d.stock || d.stock < 1) e.stock = "Add at least 1 unit in stock";
  if (hasShowrooms && !d.showroomId) e.showroomId = "Choose the showroom where the car is";
  if (d.description.length < MIN_DESCRIPTION) e.description = `Write at least ${MIN_DESCRIPTION} characters about the car`;
  if (!d.images.length) e.images = "Add at least one photo";
  if (d.kind === "used") {
    const u = d.used;
    if (!u.registrationYear) e["used.registrationYear"] = "Choose the registration year";
    if (u.km === null) e["used.km"] = "Enter the odometer reading";
    if (!u.owners) e["used.owners"] = "Enter the number of owners";
    if (!u.registrationNumber) e["used.registrationNumber"] = "Enter the registration number";
    if (!u.registrationState) e["used.registrationState"] = "Choose the registration state";
    if (!u.accident) e["used.accident"] = "Tell buyers whether the car has been in an accident";
    if (u.accident === "yes" && u.accidentDetails.length < 10) e["used.accidentDetails"] = "Describe the damage and the repairs";
    if (!u.insuranceStatus) e["used.insuranceStatus"] = "Choose the insurance status";
    if ((u.insuranceStatus === "comprehensive" || u.insuranceStatus === "third_party") && !u.insuranceValidUntil)
      e["used.insuranceValidUntil"] = "Enter the date the policy is valid until";
    if ((u.insuranceStatus === "comprehensive" || u.insuranceStatus === "third_party") && u.insuranceValidUntil && u.insuranceValidUntil < todayISO())
      e["used.insuranceValidUntil"] = "That date has passed — choose “Expired” instead";
  }
  return e;
}

/** Checks that need the database or the catalogue: brand/model, showroom, photos and report ownership. */
async function crossCheck(ctx: PartnerContext, d: Parsed): Promise<Record<string, string>> {
  const e: Record<string, string> = {};
  const cat = await getCatalog();
  if (d.brand) {
    const known = Boolean(cat.getBrand(d.brand));
    const legacy = d.brand in LEGACY_BRANDS && d.brand !== "multi-brand";
    if (!known && !(legacy && d.kind === "used")) e.brand = d.kind === "new" && legacy ? "This brand isn't sold new any more — list it as a used car" : "Choose a brand from the list";
  }
  if (d.modelSlug) {
    const car = cat.getCar(d.modelSlug);
    if (!car || car.brand !== d.brand) e.model = "That model isn't in the catalogue for this brand — choose it again";
  }
  if (d.showroomId) {
    const [room] = await getDb()
      .select({ id: partnerShowrooms.id })
      .from(partnerShowrooms)
      .where(and(eq(partnerShowrooms.id, d.showroomId), eq(partnerShowrooms.partnerId, ctx.partner.id), eq(partnerShowrooms.isActive, true)));
    if (!room) e.showroomId = "Choose one of your active showrooms";
  }
  const mediaIds = d.images.map((u) => Number(u.split("/")[2]));
  if (mediaIds.length) {
    const owned = await ownedMediaIds(ctx.partner.id, mediaIds);
    if (mediaIds.some((m) => !owned.has(m))) e.images = "One of the photos is no longer in your media library — remove it and upload it again";
  }
  if (d.kind === "used" && d.used.inspection && !(await ownsInspectionFile(ctx.partner.id, d.used.inspection.id))) e["used.inspection"] = "Upload the inspection report again";
  return e;
}

function toColumns(d: Parsed) {
  const used: UsedVehicleDetails | null =
    d.kind === "used"
      ? {
          registrationYear: d.used.registrationYear,
          km: d.used.km,
          owners: d.used.owners,
          registrationNumber: d.used.registrationNumber,
          registrationState: d.used.registrationState,
          accident: { hadAccident: d.used.accident === "yes", details: d.used.accident === "yes" ? d.used.accidentDetails : "" },
          insurance: {
            status: d.used.insuranceStatus as UsedVehicleDetails["insurance"]["status"],
            validUntil: d.used.insuranceStatus === "comprehensive" || d.used.insuranceStatus === "third_party" ? d.used.insuranceValidUntil : "",
          },
          inspection: d.used.inspection,
        }
      : null;
  return {
    kind: d.kind,
    brand: d.brand,
    modelSlug: d.modelSlug || null,
    model: d.model,
    variant: d.variant,
    // Drafts may leave these blank; the submit check makes sure they're filled before review.
    bodyType: d.bodyType as BodyType,
    year: d.year ?? 0,
    fuel: d.fuel as FuelType,
    transmission: d.transmission as Transmission,
    colour: d.colour,
    exShowroom: d.exShowroom,
    sellingPrice: d.sellingPrice ?? 0,
    stock: d.stock ?? 0,
    vin: d.vin || null,
    description: d.description,
    specs: d.specs,
    features: d.features,
    images: d.images,
    videos: d.videos,
    showroomId: d.showroomId,
    used,
  };
}

const titleOf = (v: Pick<VehicleRow, "reference" | "model" | "variant">) => `${v.reference} · ${[v.model, v.variant].filter(Boolean).join(" ") || "untitled"}`;

/**
 * Keeps the public site in step after a dealer change. A used car's mirror on /used-cars is
 * re-synced (and the dealer listing's "certified pre-owned" flag with it); new-car stock is read
 * straight from partner_vehicles by the dealer and model pages, so expiring the cache is enough.
 */
async function syncPublic(ctx: PartnerContext, v: Pick<VehicleRow, "id" | "kind" | "publicUsedCarId">, wasPublished: boolean, isPublished: boolean) {
  if (!wasPublished && !isPublished && !v.publicUsedCarId) return;
  try {
    if (v.kind === "used") {
      // Dealer first, so a newly created public listing id lands on the mirror.
      if (ctx.partner.status === "approved") await syncPublicDealer(ctx.partner.id);
      await syncPublicVehicle(v.id);
    } else {
      expireCatalog();
    }
  } catch (err) {
    console.error("[inventory] public sync failed", err);
  }
}

async function showroomCount(partnerId: number) {
  const [{ n }] = await getDb()
    .select({ n: count() })
    .from(partnerShowrooms)
    .where(and(eq(partnerShowrooms.partnerId, partnerId), eq(partnerShowrooms.isActive, true)));
  return n;
}

/* ── Create / edit ──────────────────────────────────────────── */

const saveInput = z.object({
  id: id.optional(),
  intent: z.enum(["draft", "submit"]),
  /** The dealer confirmed that editing a live listing takes it offline until re-approved. */
  acknowledgeLive: z.boolean().optional(),
  values: z.unknown(),
});

export async function saveVehicleAction(input: unknown): Promise<ActionResult<{ id: number; reference: string; status: PartnerVehicleStatus }>> {
  const ctx = await partnerAction("inventory.manage");
  if (isActionError(ctx)) return ctx;
  const shell = saveInput.safeParse(input);
  if (!shell.success) return fail("Something went wrong. Reload the page and try again.");
  const { intent, acknowledgeLive } = shell.data;
  const parsed = vehicleSchema.safeParse(shell.data.values);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;

  const existing = shell.data.id ? await getPartnerVehicle(ctx.partner.id, shell.data.id) : null;
  if (shell.data.id && !existing) return fail("This vehicle no longer exists. It may have been removed by someone else at your dealership.");
  if (existing && existing.kind !== d.kind) return fail("A listing can't switch between new and used. Duplicate it or add a new vehicle instead.");
  if (existing && LIVE.includes(existing.status) && !acknowledgeLive) return fail("This listing is live. Confirm that saving sends it back for approval.");

  if (intent === "draft" && (!d.brand || !d.model)) {
    return fail("Choose at least the brand and model to save.", {
      ...(d.brand ? {} : { brand: "Choose a brand" }),
      ...(d.model ? {} : { model: "Choose or enter the model" }),
    });
  }
  const hasShowrooms = (await showroomCount(ctx.partner.id)) > 0;
  const errors = { ...(intent === "submit" ? missingForSubmit(d, hasShowrooms) : {}), ...(await crossCheck(ctx, d)) };
  if (Object.keys(errors).length) return fail(intent === "submit" ? "Complete the highlighted fields to submit for approval." : "Please check the highlighted fields.", errors);
  if (intent === "submit") {
    const overLimit = await listingLimitError(ctx.partner.id, ctx.partner.plan, 1, existing ? [existing.id] : []);
    if (overLimit) return fail(overLimit);
  }

  const db = getDb();
  const now = new Date();
  const prev = existing?.status;
  const next: PartnerVehicleStatus =
    intent === "submit" ? "pending_approval" : prev === "changes_requested" || prev === "rejected" || prev === "draft" ? prev : "draft";
  const columns = { ...toColumns(d), status: next, ...(intent === "submit" ? { submittedAt: now } : {}) };

  let vid = existing?.id ?? 0;
  let ref = existing?.reference ?? "";
  if (existing) {
    await db.update(partnerVehicles).set(columns).where(and(eq(partnerVehicles.id, existing.id), eq(partnerVehicles.partnerId, ctx.partner.id)));
  } else {
    for (let attempt = 0; attempt < 4 && !vid; attempt++) {
      ref = reference("VEH");
      try {
        const [res] = await db.insert(partnerVehicles).values({ ...columns, partnerId: ctx.partner.id, reference: ref });
        vid = res.insertId;
      } catch (err) {
        if (!isDuplicate(err) || attempt === 3) throw err;
      }
    }
  }

  const label = titleOf({ reference: ref, model: d.model, variant: d.variant });
  if (intent === "submit") {
    await recordApproval({
      partnerId: ctx.partner.id,
      target: "vehicle",
      targetId: vid,
      action: existing?.submittedAt ? "resubmitted" : "submitted",
      fromStatus: prev ?? "draft",
      toStatus: "pending_approval",
      actorUserId: ctx.user.id,
      actorSide: "dealer",
    });
    await notifyPartner(ctx.partner.id, {
      kind: "vehicle",
      title: `${ref} sent for approval`,
      body: `${ctx.user.name} submitted ${label} — MarchGear will review it shortly.`,
      href: `/dealer/inventory/${vid}`,
    });
  } else if (prev && prev !== next) {
    const live = LIVE.includes(prev);
    await recordApproval({
      partnerId: ctx.partner.id,
      target: "vehicle",
      targetId: vid,
      action: prev === "archived" ? "restored" : live ? "edited" : "withdrawn",
      fromStatus: prev,
      toStatus: next,
      remarks: live ? "Edited after approval — saved as a draft and taken off the website." : null,
      actorUserId: ctx.user.id,
      actorSide: "dealer",
    });
  }
  if (prev === "published") {
    await notifyPartner(ctx.partner.id, {
      kind: "vehicle",
      title: `${ref} is offline until re-approved`,
      body: `${ctx.user.name} edited the live listing ${label}. It's hidden from the website until MarchGear approves the changes.`,
      href: `/dealer/inventory/${vid}`,
    });
  }
  await logPartnerActivity(
    ctx.partner.id,
    ctx.user.id,
    existing ? (intent === "submit" ? "submit" : "update") : "create",
    "vehicle",
    vid,
    `${existing ? "Updated" : "Added"} ${label}${intent === "submit" ? " and submitted it for approval" : " as a draft"}`,
  );
  if (existing) await syncPublic(ctx, existing, prev === "published", false);

  return { ok: true, id: vid, reference: ref, status: next };
}

/* ── Row actions ────────────────────────────────────────────── */

export async function duplicateVehicleAction(vehicleId: unknown): Promise<ActionResult<{ id: number; reference: string }>> {
  const ctx = await partnerAction("inventory.manage");
  if (isActionError(ctx)) return ctx;
  const vid = id.safeParse(vehicleId);
  if (!vid.success) return fail("Choose a vehicle.");
  const v = await getPartnerVehicle(ctx.partner.id, vid.data);
  if (!v) return fail("This vehicle no longer exists.");

  const db = getDb();
  let newId = 0;
  let ref = "";
  for (let attempt = 0; attempt < 4 && !newId; attempt++) {
    ref = reference("VEH");
    try {
      const [res] = await db.insert(partnerVehicles).values({
        partnerId: ctx.partner.id,
        reference: ref,
        kind: v.kind,
        brand: v.brand,
        modelSlug: v.modelSlug,
        model: v.model,
        variant: v.variant,
        bodyType: v.bodyType,
        year: v.year,
        fuel: v.fuel,
        transmission: v.transmission,
        colour: v.colour,
        exShowroom: v.exShowroom,
        sellingPrice: v.sellingPrice,
        stock: v.stock,
        // Unique to the physical car — never copied.
        vin: null,
        description: v.description,
        specs: v.specs,
        features: v.features,
        images: v.images,
        videos: v.videos,
        showroomId: v.showroomId,
        used: v.used ? { ...v.used, registrationNumber: "", inspection: null } : null,
        status: "draft",
      });
      newId = res.insertId;
    } catch (err) {
      if (!isDuplicate(err) || attempt === 3) throw err;
    }
  }
  await logPartnerActivity(ctx.partner.id, ctx.user.id, "duplicate", "vehicle", newId, `Duplicated ${titleOf(v)} as ${ref}`);
  return { ok: true, id: newId, reference: ref };
}

export async function submitVehiclesAction(vehicleIds: unknown): Promise<ActionResult<{ submitted: string[]; skipped: { reference: string; reason: string }[] }>> {
  const ctx = await partnerAction("inventory.manage");
  if (isActionError(ctx)) return ctx;
  const list = ids.safeParse(vehicleIds);
  if (!list.success) return fail(list.error.issues[0]?.message ?? "Select vehicles to submit.");
  const rows = await getPartnerVehicles(ctx.partner.id, list.data);
  if (!rows.length) return fail("Those vehicles no longer exist.");
  const hasShowrooms = (await showroomCount(ctx.partner.id)) > 0;
  const db = getDb();
  const now = new Date();
  const submitted: string[] = [];
  const skipped: { reference: string; reason: string }[] = [];

  for (const v of rows) {
    if (!SUBMITTABLE.includes(v.status)) {
      skipped.push({ reference: v.reference, reason: `It's ${VEHICLE_STATUS_LABEL[v.status].toLowerCase()}` });
      continue;
    }
    const parsed = vehicleSchema.safeParse(vehicleToForm(v));
    const missing = parsed.success ? missingForSubmit(parsed.data, hasShowrooms) : { form: parsed.error.issues[0]?.message ?? "Invalid details" };
    // The same database checks the form runs (showroom still active, photos still in the library, catalogue model…).
    if (parsed.success) Object.assign(missing, await crossCheck(ctx, parsed.data));
    const problems = Object.values(missing);
    if (problems.length) {
      skipped.push({ reference: v.reference, reason: problems.length > 2 ? `${problems.slice(0, 2).join("; ")} and ${problems.length - 2} more` : problems.join("; ") });
      continue;
    }
    const overLimit = await listingLimitError(ctx.partner.id, ctx.partner.plan, 1, [v.id]);
    if (overLimit) {
      skipped.push({ reference: v.reference, reason: "Your plan's listing limit is reached" });
      continue;
    }
    await db
      .update(partnerVehicles)
      .set({ status: "pending_approval", submittedAt: now })
      .where(and(eq(partnerVehicles.id, v.id), eq(partnerVehicles.partnerId, ctx.partner.id)));
    await recordApproval({
      partnerId: ctx.partner.id,
      target: "vehicle",
      targetId: v.id,
      action: v.submittedAt ? "resubmitted" : "submitted",
      fromStatus: v.status,
      toStatus: "pending_approval",
      actorUserId: ctx.user.id,
      actorSide: "dealer",
    });
    await logPartnerActivity(ctx.partner.id, ctx.user.id, "submit", "vehicle", v.id, `Submitted ${titleOf(v)} for approval`);
    await syncPublic(ctx, v, false, false);
    submitted.push(v.reference);
  }
  if (submitted.length) {
    await notifyPartner(ctx.partner.id, {
      kind: "vehicle",
      title: submitted.length === 1 ? `${submitted[0]} sent for approval` : `${submitted.length} vehicles sent for approval`,
      body: `${ctx.user.name} submitted ${submitted.join(", ")}. MarchGear will review ${submitted.length === 1 ? "it" : "them"} shortly.`,
      href: "/dealer/inventory?status=pending_approval",
    });
  }
  return { ok: true, submitted, skipped };
}

export async function archiveVehiclesAction(vehicleIds: unknown): Promise<ActionResult<{ archived: string[] }>> {
  const ctx = await partnerAction("inventory.manage");
  if (isActionError(ctx)) return ctx;
  const list = ids.safeParse(vehicleIds);
  if (!list.success) return fail(list.error.issues[0]?.message ?? "Select vehicles to archive.");
  const rows = (await getPartnerVehicles(ctx.partner.id, list.data)).filter((v) => v.status !== "archived");
  if (!rows.length) return fail("Those vehicles are already archived.");
  const db = getDb();
  await db
    .update(partnerVehicles)
    .set({ status: "archived" })
    .where(and(eq(partnerVehicles.partnerId, ctx.partner.id), inArray(partnerVehicles.id, rows.map((v) => v.id))));
  for (const v of rows) {
    await recordApproval({ partnerId: ctx.partner.id, target: "vehicle", targetId: v.id, action: "archived", fromStatus: v.status, toStatus: "archived", actorUserId: ctx.user.id, actorSide: "dealer" });
    await logPartnerActivity(ctx.partner.id, ctx.user.id, "archive", "vehicle", v.id, `Archived ${titleOf(v)}`);
  }
  // One public refresh per kind is enough.
  const usedLive = rows.filter((v) => v.kind === "used" && (v.status === "published" || v.publicUsedCarId));
  for (const v of usedLive) await syncPublic(ctx, v, v.status === "published", false);
  if (rows.some((v) => v.kind === "new" && v.status === "published")) expireCatalog();
  return { ok: true, archived: rows.map((v) => v.reference) };
}

export async function withdrawVehicleAction(vehicleId: unknown): Promise<ActionResult> {
  const ctx = await partnerAction("inventory.manage");
  if (isActionError(ctx)) return ctx;
  const vid = id.safeParse(vehicleId);
  if (!vid.success) return fail("Choose a vehicle.");
  const v = await getPartnerVehicle(ctx.partner.id, vid.data);
  if (!v) return fail("This vehicle no longer exists.");
  if (!WITHDRAWABLE.includes(v.status)) return fail(`Only pending, approved or live listings can be withdrawn — this one is ${VEHICLE_STATUS_LABEL[v.status].toLowerCase()}.`);
  await getDb()
    .update(partnerVehicles)
    .set({ status: "draft" })
    .where(and(eq(partnerVehicles.id, v.id), eq(partnerVehicles.partnerId, ctx.partner.id)));
  await recordApproval({ partnerId: ctx.partner.id, target: "vehicle", targetId: v.id, action: "withdrawn", fromStatus: v.status, toStatus: "draft", actorUserId: ctx.user.id, actorSide: "dealer" });
  await logPartnerActivity(ctx.partner.id, ctx.user.id, "withdraw", "vehicle", v.id, `Withdrew ${titleOf(v)} to draft`);
  await syncPublic(ctx, v, v.status === "published", false);
  return { ok: true };
}

export async function restoreVehicleAction(vehicleId: unknown): Promise<ActionResult> {
  const ctx = await partnerAction("inventory.manage");
  if (isActionError(ctx)) return ctx;
  const vid = id.safeParse(vehicleId);
  if (!vid.success) return fail("Choose a vehicle.");
  const v = await getPartnerVehicle(ctx.partner.id, vid.data);
  if (!v) return fail("This vehicle no longer exists.");
  if (v.status !== "archived") return fail("Only archived vehicles can be restored.");
  await getDb()
    .update(partnerVehicles)
    .set({ status: "draft" })
    .where(and(eq(partnerVehicles.id, v.id), eq(partnerVehicles.partnerId, ctx.partner.id)));
  await recordApproval({ partnerId: ctx.partner.id, target: "vehicle", targetId: v.id, action: "restored", fromStatus: "archived", toStatus: "draft", actorUserId: ctx.user.id, actorSide: "dealer" });
  await logPartnerActivity(ctx.partner.id, ctx.user.id, "restore", "vehicle", v.id, `Restored ${titleOf(v)} from the archive`);
  return { ok: true };
}

export async function updateStockAction(vehicleId: unknown, stock: unknown): Promise<ActionResult<{ stock: number }>> {
  const ctx = await partnerAction("inventory.manage");
  if (isActionError(ctx)) return ctx;
  const parsed = z.tuple([id, whole(0, 999, "Stock must be between 0 and 999")]).safeParse([vehicleId, stock]);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Enter the stock";
    return fail(message, { stock: message });
  }
  const [vid, units] = parsed.data;
  if (units === null) return fail("Enter the stock", { stock: "Enter the stock" });
  const v = await getPartnerVehicle(ctx.partner.id, vid);
  if (!v) return fail("This vehicle no longer exists.");
  if (v.status === "archived") return fail("Restore this vehicle before changing its stock.");
  if (v.stock !== units) {
    await getDb()
      .update(partnerVehicles)
      .set({ stock: units })
      .where(and(eq(partnerVehicles.id, v.id), eq(partnerVehicles.partnerId, ctx.partner.id)));
    await logPartnerActivity(ctx.partner.id, ctx.user.id, "stock", "vehicle", v.id, `Stock of ${titleOf(v)}: ${v.stock} → ${units}`);
    // Stock shows publicly (and a used car with none left is marked sold).
    await syncPublic(ctx, v, v.status === "published", v.status === "published");
  }
  return { ok: true, stock: units };
}

/* ── Reads for the list's drawers ───────────────────────────── */

export async function vehicleHistoryAction(
  vehicleId: unknown,
): Promise<ActionResult<{ entries: VehicleHistoryEntry[]; status: PartnerVehicleStatus; remarks: string | null; reference: string; title: string }>> {
  const ctx = await partnerAction("inventory.view");
  if (isActionError(ctx)) return ctx;
  const vid = id.safeParse(vehicleId);
  if (!vid.success) return fail("Choose a vehicle.");
  const v = await getPartnerVehicle(ctx.partner.id, vid.data);
  if (!v) return fail("This vehicle no longer exists.");
  const { brandName } = await getCatalog();
  return {
    ok: true,
    entries: await vehicleHistory(ctx.partner.id, v.id),
    status: v.status,
    remarks: v.adminRemarks,
    reference: v.reference,
    title: [v.year > 0 ? v.year : null, brandName(v.brand), v.model, v.variant].filter(Boolean).join(" "),
  };
}

export async function vehiclePreviewAction(vehicleId: unknown): Promise<ActionResult<{ vehicle: PublicVehicle; brandName: string; status: PartnerVehicleStatus }>> {
  const ctx = await partnerAction("inventory.view");
  if (isActionError(ctx)) return ctx;
  const vid = id.safeParse(vehicleId);
  if (!vid.success) return fail("Choose a vehicle.");
  const [vehicle, row] = await Promise.all([previewVehicle(ctx.partner.id, vid.data), getPartnerVehicle(ctx.partner.id, vid.data)]);
  if (!vehicle || !row) return fail("This vehicle no longer exists.");
  const { brandName } = await getCatalog();
  return { ok: true, vehicle, brandName: brandName(vehicle.brand), status: row.status };
}
