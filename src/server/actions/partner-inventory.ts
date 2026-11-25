"use server";

import { z } from "zod";
import { and, count, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { partnerShowrooms, partnerVehicles } from "@/db/schema";
import type { PartnerVehicleStatus } from "@/db/enums";
import type { ActionFailure, ActionResult } from "@/lib/action-result";
import { formatINR } from "@/lib/format";
import { VEHICLE_STATUS_LABEL } from "@/partner/labels";
import type { NewVehicleDetails, UsedVehicleDetails } from "@/partner/types";
import type { CarModel, Variant } from "@/types";
import { getCatalog, expireCatalog } from "@/server/catalog";
import { isDuplicate } from "@/server/db-errors";
import { invalid, todayISO } from "@/server/validation";
import { listingLimitError } from "@/server/partner/limits";
import { isActionError, partnerAction, type PartnerContext } from "@/server/partner/context";
import { logPartnerActivity, notifyPartner, recordApproval, reference } from "@/server/partner/records";
import { syncPublicDealer, syncPublicVehicle } from "@/server/partner/public-sync";
import {
  brandLineups,
  catalogueOf,
  getPartnerVehicle,
  getPartnerVehicles,
  lineupError,
  ownedMediaIds,
  ownsInspectionFile,
  previewVehicle,
  vehicleHistory,
  type BrandLineup,
  type VehicleRow,
} from "@/server/partner/inventory";
import {
  CONDITION_GRADES,
  INDIAN_STATES,
  INSURANCE_OPTIONS,
  LIVE,
  MAX_CONDITION_NOTES,
  MAX_IMAGES,
  MAX_WAITING_WEEKS,
  MIN_CONDITION_NOTES,
  MIN_YEAR,
  PRICE_BAND,
  PUBLISHABLE,
  REG_PATTERN,
  STOCK_NO_PATTERN,
  SUBMITTABLE,
  WITHDRAWABLE,
  currentYear,
  isUsedDetails,
  newDetailsOf,
  normaliseReg,
  normaliseStockNo,
  priceBand,
  vehicleToForm,
  type PublicVehicle,
  type VehicleHistoryEntry,
} from "@/components/portal/inventory/shared";

/* ──────────────────────────────────────────────────────────────
   Dealer vehicle inventory. Every action re-checks the member's
   permission, scopes every read and write by the dealership, and
   keeps the public site in step.

   The catalogue rule, enforced here whatever the browser sends:
   - The car (brand, model, variant) must be in MarchGear's published
     catalogue; names, body type, fuel, gearbox and ex-showroom price
     are filled from it. Dealer-sent specs, features, descriptions,
     videos — and photos of new cars — are dropped.
   - New cars also need an approved brand authorisation (and the
     dealer's line-up from /dealer/models, once narrowed). They go
     live as soon as the dealer publishes; dealers can pause and
     republish, MarchGear staff can unpublish.
   - Used cars keep MarchGear's approval: draft → pending_approval →
     approved/published, mirrored to /used-cars when published.
   ────────────────────────────────────────────────────────────── */

const id = z.coerce.number().int().positive().max(2_147_483_647);
const ids = z.array(id).min(1, "Select at least one vehicle").max(100, "Select up to 100 vehicles at a time");

/* ── Validation ─────────────────────────────────────────────── */

const text = (max: number) => z.string().trim().max(max);
const slug = (message: string) => z.string().trim().max(120).regex(/^[a-z0-9-]*$/, message);

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
  condition: z.union([z.literal(""), z.enum(CONDITION_GRADES.map((c) => c.value) as [string, ...string[]])], { error: "Choose the condition" }),
  conditionNotes: z.string().trim().max(MAX_CONDITION_NOTES, `Keep the condition notes to ${MAX_CONDITION_NOTES} characters`),
});

/**
 * Exactly what a dealer may say about a listing. Anything else in the request — model or variant names,
 * specs, features, descriptions, videos, body type, fuel, gearbox, ex-showroom price — is stripped by Zod
 * and filled from the catalogue instead.
 */
const vehicleSchema = z
  .object({
    kind: z.enum(["new", "used"], { error: "Choose new or used" }),
    brand: slug("Choose a brand from the list"),
    modelSlug: slug("Choose a model from the list"),
    variantSlug: slug("Choose a variant from the list"),
    year: whole(MIN_YEAR, currentYear(), `Choose a year between ${MIN_YEAR} and ${currentYear()}`),
    colour: text(60),
    sellingPrice: whole(10_000, 1_000_000_000, "Enter a price between ₹10,000 and ₹100 Cr"),
    availability: z.enum(["in_stock", "on_order"], { error: "Choose in stock or on order" }),
    stock: whole(0, 999, "Stock must be between 0 and 999"),
    waitingWeeks: whole(1, MAX_WAITING_WEEKS, `Enter the expected wait in weeks, from 1 to ${MAX_WAITING_WEEKS}`),
    vin: z
      .string()
      .max(40)
      .transform(normaliseStockNo)
      .refine((v) => v === "" || STOCK_NO_PATTERN.test(v), "Use letters, digits, “-” or “/” (up to 32), e.g. a VIN or your stock number"),
    showroomId: z
      .union([z.string(), z.number()])
      .transform((v) => String(v).trim())
      .refine((v) => v === "" || /^\d{1,10}$/.test(v), "Choose a showroom")
      .transform((v) => (v ? Number(v) : null)),
    images: z.array(z.string().max(300)).max(MAX_IMAGES, `Add up to ${MAX_IMAGES} photos`),
    used: usedSchema,
  })
  .superRefine((d, ctx) => {
    if (d.kind !== "used") return;
    d.images.forEach((u, i) => {
      if (!/^\/media\/\d+\/[\w.-]+$/.test(u)) ctx.addIssue({ code: "custom", path: ["images", i], message: "Upload photos with the uploader" });
    });
    if (d.used.registrationYear && d.year && d.used.registrationYear < d.year) ctx.addIssue({ code: "custom", path: ["used", "registrationYear"], message: "Registration can't be before the manufacturing year" });
  })
  // A new car is the catalogue's car: never the dealer's photos or used-car details.
  .transform((d) => (d.kind === "new" ? { ...d, images: [] as string[] } : d));

type Parsed = z.output<typeof vehicleSchema>;
type Cat = Awaited<ReturnType<typeof getCatalog>>;
type Resolved = { car: CarModel | undefined; variant: Variant | undefined };

const fail = (error: string, fieldErrors?: Record<string, string>): ActionFailure => ({ ok: false, error, ...(fieldErrors ? { fieldErrors } : {}) });

/** The catalogue model and variant the dealer chose (undefined when not chosen or not in the catalogue). */
function resolve(cat: Cat, d: Pick<Parsed, "brand" | "modelSlug" | "variantSlug">): Resolved {
  const found = d.modelSlug ? cat.getCar(d.modelSlug) : undefined;
  const car = found && found.brand === d.brand ? found : undefined;
  return { car, variant: car && d.variantSlug ? car.variants.find((v) => v.slug === d.variantSlug) : undefined };
}

/** What must be filled in before a new car goes live. Keys match the form's fields. */
function missingForPublish(d: Parsed, { car, variant }: Resolved, hasShowrooms: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  if (!d.brand) e.brand = "Choose a brand";
  if (!d.modelSlug) e.modelSlug = "Choose the model";
  if (!d.variantSlug) e.variantSlug = "Choose the variant";
  if (car?.colors.length && !d.colour) e.colour = "Choose the colour";
  if (!d.sellingPrice) e.sellingPrice = "Enter your selling price";
  else if (variant) {
    const band = priceBand(variant.price);
    if (d.sellingPrice < band.min || d.sellingPrice > band.max)
      e.sellingPrice = `Enter a price between ${formatINR(band.min)} and ${formatINR(band.max)} — ${PRICE_BAND.min * 100}% to ${PRICE_BAND.max * 100}% of the ${formatINR(variant.price)} catalogue ex-showroom price`;
  }
  if (d.availability === "in_stock" && (!d.stock || d.stock < 1)) e.stock = "Add at least 1 unit, or mark the car as on order";
  if (d.availability === "on_order" && !d.waitingWeeks) e.waitingWeeks = "Enter the expected waiting period in weeks";
  if (hasShowrooms && !d.showroomId) e.showroomId = "Choose the showroom that sells it";
  return e;
}

/** What must be filled in before MarchGear can review a used car. Keys match the form's fields. */
function missingForSubmit(d: Parsed, hasShowrooms: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  if (!d.brand) e.brand = "Choose a brand";
  if (!d.modelSlug) e.modelSlug = "Choose the model";
  if (!d.variantSlug) e.variantSlug = "Choose the variant";
  if (!d.year) e.year = "Choose the manufacturing year";
  if (!d.colour) e.colour = "Choose or enter the colour";
  if (!d.sellingPrice) e.sellingPrice = "Enter the asking price";
  if (d.stock === 0) e.stock = "This car is marked as sold — mark it available to submit it";
  if (hasShowrooms && !d.showroomId) e.showroomId = "Choose the showroom where the car is";
  if (!d.images.length) e.images = "Add at least one photo of the car";
  const u = d.used;
  if (!u.registrationYear) e["used.registrationYear"] = "Choose the registration year";
  if (u.km === null) e["used.km"] = "Enter the odometer reading";
  if (!u.owners) e["used.owners"] = "Enter the number of owners";
  if (!u.registrationNumber) e["used.registrationNumber"] = "Enter the registration number";
  if (!u.registrationState) e["used.registrationState"] = "Choose the registration state";
  if (!u.accident) e["used.accident"] = "Tell buyers whether the car has been in an accident";
  if (u.accident === "yes" && u.accidentDetails.length < 10) e["used.accidentDetails"] = "Describe the damage and the repairs";
  if (!u.insuranceStatus) e["used.insuranceStatus"] = "Choose the insurance status";
  if ((u.insuranceStatus === "comprehensive" || u.insuranceStatus === "third_party") && !u.insuranceValidUntil) e["used.insuranceValidUntil"] = "Enter the date the policy is valid until";
  if ((u.insuranceStatus === "comprehensive" || u.insuranceStatus === "third_party") && u.insuranceValidUntil && u.insuranceValidUntil < todayISO())
    e["used.insuranceValidUntil"] = "That date has passed — choose “Expired” instead";
  if (!u.condition) e["used.condition"] = "Choose the overall condition";
  if (u.conditionNotes.length < MIN_CONDITION_NOTES) e["used.conditionNotes"] = `Describe the condition in at least ${MIN_CONDITION_NOTES} characters`;
  return e;
}

/**
 * Checks against the catalogue and the database: the car is a published catalogue variant, a new car fits the
 * dealership's brand authorisations (when going live), the colour is a factory colour, and the showroom, photos
 * and inspection report are the dealership's own.
 */
async function crossCheck(
  ctx: PartnerContext,
  d: Parsed,
  r: Resolved,
  opts: { cat: Cat; lineups: BrandLineup[]; goingLive: boolean; existing?: VehicleRow | null },
): Promise<Record<string, string>> {
  const e: Record<string, string> = {};
  if (d.brand && !opts.cat.getBrand(d.brand)) e.brand = "Choose a brand from the MarchGear catalogue";
  else if (d.modelSlug && !r.car) e.modelSlug = "That model isn't in the MarchGear catalogue for this brand — choose one from the list";
  else if (r.car && d.variantSlug && !r.variant) e.variantSlug = "That variant isn't in the MarchGear catalogue — choose one from the list";

  if (d.kind === "new") {
    if (r.car && d.colour && !r.car.colors.some((c) => c.name === d.colour)) e.colour = r.car.colors.length ? `Choose one of the ${r.car.name}'s factory colours` : "The catalogue has no colours for this model yet";
    if (opts.goingLive && r.car && r.variant && !e.brand) {
      // A listing keeps its model and variant if the dealer later narrows the line-up; the brand must stay authorised.
      const prev = opts.existing;
      const unchanged = prev && prev.modelSlug === r.car.slug && catalogueOf(prev, opts.cat).variant?.slug === r.variant.slug;
      const problem = lineupError(opts.lineups, d.brand, r.car.slug, r.variant.slug);
      if (problem && (problem.field === "brand" || !unchanged)) e[problem.field] = problem.message;
    }
  }

  if (d.showroomId) {
    const [room] = await getDb()
      .select({ id: partnerShowrooms.id })
      .from(partnerShowrooms)
      .where(and(eq(partnerShowrooms.id, d.showroomId), eq(partnerShowrooms.partnerId, ctx.partner.id), eq(partnerShowrooms.isActive, true)));
    if (!room) e.showroomId = "Choose one of your active showrooms";
  }
  if (d.kind === "used") {
    const mediaIds = d.images.map((u) => Number(u.split("/")[2]));
    if (mediaIds.length) {
      const owned = await ownedMediaIds(ctx.partner.id, mediaIds);
      if (mediaIds.some((m) => !owned.has(m))) e.images = "One of the photos is no longer in your media library — remove it and upload it again";
    }
    if (d.used.inspection && !(await ownsInspectionFile(ctx.partner.id, d.used.inspection.id))) e["used.inspection"] = "Upload the inspection report again";
  }
  return e;
}

/** The row as stored: the catalogue's car plus the dealer's own facts. */
function toColumns(d: Parsed, { car, variant }: Resolved, existing: VehicleRow | null) {
  // Only called once the model is known to be in the catalogue.
  const c = car!;
  const catalogue = {
    kind: d.kind,
    brand: c.brand,
    modelSlug: c.slug,
    model: c.name,
    variant: variant?.name ?? "",
    bodyType: c.bodyType,
    fuel: variant?.fuel ?? c.fuelTypes[0] ?? "Petrol",
    transmission: variant?.transmission ?? c.transmissions[0] ?? "Manual",
    exShowroom: variant?.price ?? null,
    specs: [],
    features: [],
    videos: [],
  };
  const own = { colour: d.colour, sellingPrice: d.sellingPrice ?? 0, vin: d.vin || null, showroomId: d.showroomId };
  if (d.kind === "new") {
    const details: NewVehicleDetails = { variantSlug: variant?.slug ?? "", availability: d.availability, waitingWeeks: d.availability === "on_order" ? d.waitingWeeks : null };
    return {
      ...catalogue,
      ...own,
      year: existing && existing.year > 0 ? existing.year : currentYear(),
      stock: d.availability === "on_order" ? 0 : (d.stock ?? 0),
      description: "",
      images: [],
      used: details,
    };
  }
  const u = d.used;
  const details: UsedVehicleDetails = {
    registrationYear: u.registrationYear,
    km: u.km,
    owners: u.owners,
    registrationNumber: u.registrationNumber,
    registrationState: u.registrationState,
    accident: { hadAccident: u.accident === "yes", details: u.accident === "yes" ? u.accidentDetails : "" },
    insurance: {
      status: u.insuranceStatus as UsedVehicleDetails["insurance"]["status"],
      validUntil: u.insuranceStatus === "comprehensive" || u.insuranceStatus === "third_party" ? u.insuranceValidUntil : "",
    },
    inspection: u.inspection,
    variantSlug: variant?.slug ?? "",
    condition: u.condition as UsedVehicleDetails["condition"],
  };
  return {
    ...catalogue,
    ...own,
    year: d.year ?? 0,
    stock: d.stock ?? existing?.stock ?? 1,
    description: u.conditionNotes,
    images: d.images,
    used: details,
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

/** A new car's status after the dealer saves it without publishing. */
function pausedStatus(prev: PartnerVehicleStatus | undefined): PartnerVehicleStatus {
  if (prev === "published" || prev === "unpublished") return "unpublished";
  if (prev === "changes_requested" || prev === "rejected") return prev;
  return "draft";
}

/* ── Create / edit ──────────────────────────────────────────── */

const saveInput = z.object({
  id: id.optional(),
  /** Used cars: "draft" or "submit" (for approval). New cars: "publish", or "pause" to save without publishing. */
  intent: z.enum(["draft", "submit", "publish", "pause"]),
  /** Used cars: the dealer confirmed that editing a live listing takes it offline until re-approved. */
  acknowledgeLive: z.boolean().optional(),
  values: z.unknown(),
});

export async function saveVehicleAction(input: unknown): Promise<ActionResult<{ id: number; reference: string; status: PartnerVehicleStatus }>> {
  const ctx = await partnerAction("inventory.manage");
  if (isActionError(ctx)) return ctx;
  const shell = saveInput.safeParse(input);
  if (!shell.success) return fail("Something went wrong. Reload the page and try again.");
  const { acknowledgeLive } = shell.data;
  const parsed = vehicleSchema.safeParse(shell.data.values);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const isNew = d.kind === "new";
  // One meaning per kind, whatever the button said: new cars publish or pause, used cars submit or stay drafts.
  const live = shell.data.intent === "submit" || shell.data.intent === "publish";

  const existing = shell.data.id ? await getPartnerVehicle(ctx.partner.id, shell.data.id) : null;
  if (shell.data.id && !existing) return fail("This vehicle no longer exists. It may have been removed by someone else at your dealership.");
  if (existing && existing.kind !== d.kind) return fail("A listing can't switch between new and used. Add a new vehicle instead.");
  if (!isNew && existing && LIVE.includes(existing.status) && !acknowledgeLive) return fail("This listing is live. Confirm that saving sends it back for approval.");

  const [cat, lineups, rooms] = await Promise.all([getCatalog(), isNew ? brandLineups(ctx.partner.id) : Promise.resolve([]), showroomCount(ctx.partner.id)]);
  if (!d.brand || !d.modelSlug) {
    const missing = { ...(d.brand ? {} : { brand: "Choose a brand" }), ...(d.modelSlug ? {} : { modelSlug: "Choose the model" }) };
    if (live) return fail(isNew ? "Complete the highlighted fields to publish." : "Complete the highlighted fields to submit for approval.", { ...(isNew ? missingForPublish(d, { car: undefined, variant: undefined }, rooms > 0) : missingForSubmit(d, rooms > 0)), ...missing });
    return fail("Choose at least the brand and model from the catalogue to save.", missing);
  }
  const r = resolve(cat, d);
  const required = live ? (isNew ? missingForPublish(d, r, rooms > 0) : missingForSubmit(d, rooms > 0)) : {};
  const errors = { ...required, ...(await crossCheck(ctx, d, r, { cat, lineups, goingLive: live, existing })) };
  if (Object.keys(errors).length)
    return fail(live ? (isNew ? "Complete the highlighted fields to publish." : "Complete the highlighted fields to submit for approval.") : "Please check the highlighted fields.", errors);
  if (live && (!existing || existing.status !== "published")) {
    const overLimit = await listingLimitError(ctx.partner.id, ctx.partner.plan, 1, existing ? [existing.id] : []);
    if (overLimit) return fail(overLimit);
  }

  const db = getDb();
  const now = new Date();
  const prev = existing?.status;
  const next: PartnerVehicleStatus = isNew
    ? live
      ? "published"
      : pausedStatus(prev)
    : live
      ? "pending_approval"
      : prev === "changes_requested" || prev === "rejected" || prev === "draft"
        ? prev
        : "draft";
  const columns = {
    ...toColumns(d, r, existing),
    status: next,
    ...(!isNew && live ? { submittedAt: now } : {}),
    ...(isNew && next === "published" && prev !== "published" ? { publishedAt: now } : {}),
    // A dealer republishing after MarchGear paused it has dealt with the remarks (they stay in the history).
    ...(isNew && next === "published" ? { adminRemarks: null } : {}),
  };

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

  const label = titleOf({ reference: ref, model: columns.model, variant: columns.variant });
  if (isNew) {
    if (next !== prev) {
      const action = next === "published" ? "published" : prev === "published" ? "paused" : prev === "archived" ? "restored" : null;
      if (action)
        await recordApproval({
          partnerId: ctx.partner.id,
          target: "vehicle",
          targetId: vid,
          action,
          fromStatus: prev ?? "draft",
          toStatus: next,
          remarks: action === "published" && (prev === "pending_approval" || prev === "approved") ? "New-car listings no longer need MarchGear's approval — published on save." : null,
          actorUserId: ctx.user.id,
          actorSide: "dealer",
        });
    }
    if (next === "published" && prev !== "published")
      await notifyPartner(ctx.partner.id, { kind: "vehicle", title: `${ref} is live on MarchGear`, body: `${ctx.user.name} published ${label}.`, href: `/dealer/inventory/${vid}` });
  } else if (live) {
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
    const wasLive = LIVE.includes(prev);
    await recordApproval({
      partnerId: ctx.partner.id,
      target: "vehicle",
      targetId: vid,
      action: prev === "archived" ? "restored" : wasLive ? "edited" : "withdrawn",
      fromStatus: prev,
      toStatus: next,
      remarks: wasLive ? "Edited after approval — saved as a draft and taken off the website." : null,
      actorUserId: ctx.user.id,
      actorSide: "dealer",
    });
  }
  if (!isNew && prev === "published") {
    await notifyPartner(ctx.partner.id, {
      kind: "vehicle",
      title: `${ref} is offline until re-approved`,
      body: `${ctx.user.name} edited the live listing ${label}. It's hidden from the website until MarchGear approves the changes.`,
      href: `/dealer/inventory/${vid}`,
    });
  }
  const verb = isNew ? (next === "published" ? (prev === "published" ? "" : " and published it") : " without publishing") : live ? " and submitted it for approval" : " as a draft";
  await logPartnerActivity(ctx.partner.id, ctx.user.id, existing ? (live ? (isNew ? "publish" : "submit") : "update") : "create", "vehicle", vid, `${existing ? "Updated" : "Added"} ${label}${verb}`);
  await syncPublic(ctx, { id: vid, kind: d.kind, publicUsedCarId: existing?.publicUsedCarId ?? null }, prev === "published", next === "published");

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
        stock: v.kind === "used" ? 1 : v.stock,
        // Unique to the physical car — never copied: VIN, registration, inspection, photos and condition notes.
        vin: null,
        description: "",
        specs: [],
        features: [],
        images: [],
        videos: [],
        showroomId: v.showroomId,
        used: isUsedDetails(v.used) ? { ...v.used, registrationNumber: "", inspection: null, condition: "" } : v.kind === "new" ? newDetailsOf(v.used) : null,
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

/**
 * The list's "Publish / Submit" (one vehicle or many): new cars go live straight away, used cars go to
 * MarchGear for approval. Each is checked exactly like the form; incomplete ones are skipped with reasons.
 */
export async function submitVehiclesAction(
  vehicleIds: unknown,
): Promise<ActionResult<{ published: string[]; submitted: string[]; skipped: { reference: string; reason: string }[] }>> {
  const ctx = await partnerAction("inventory.manage");
  if (isActionError(ctx)) return ctx;
  const list = ids.safeParse(vehicleIds);
  if (!list.success) return fail(list.error.issues[0]?.message ?? "Select vehicles to publish or submit.");
  const rows = await getPartnerVehicles(ctx.partner.id, list.data);
  if (!rows.length) return fail("Those vehicles no longer exist.");
  const [cat, lineups, rooms] = await Promise.all([getCatalog(), brandLineups(ctx.partner.id), showroomCount(ctx.partner.id)]);
  const db = getDb();
  const now = new Date();
  const published: string[] = [];
  const submitted: string[] = [];
  const skipped: { reference: string; reason: string }[] = [];

  for (const v of rows) {
    const isNew = v.kind === "new";
    if (!(isNew ? PUBLISHABLE : SUBMITTABLE).includes(v.status)) {
      skipped.push({ reference: v.reference, reason: `It's ${VEHICLE_STATUS_LABEL[v.status].toLowerCase()}` });
      continue;
    }
    const { car } = catalogueOf(v, cat);
    if (!car) {
      skipped.push({ reference: v.reference, reason: "Needs a catalogue model — open it and pick the model" });
      continue;
    }
    const parsed = vehicleSchema.safeParse(vehicleToForm(v, car));
    const problems: Record<string, string> = {};
    if (!parsed.success) problems.form = parsed.error.issues[0]?.message ?? "Invalid details";
    else {
      const r = resolve(cat, parsed.data);
      Object.assign(problems, isNew ? missingForPublish(parsed.data, r, rooms > 0) : missingForSubmit(parsed.data, rooms > 0));
      // The same catalogue and database checks the form runs (line-up, showroom still active, photos still in the library…).
      Object.assign(problems, await crossCheck(ctx, parsed.data, r, { cat, lineups, goingLive: true, existing: v }));
    }
    const reasons = Object.values(problems);
    if (reasons.length) {
      skipped.push({ reference: v.reference, reason: reasons.length > 2 ? `${reasons.slice(0, 2).join("; ")} and ${reasons.length - 2} more` : reasons.join("; ") });
      continue;
    }
    const overLimit = await listingLimitError(ctx.partner.id, ctx.partner.plan, 1, [v.id]);
    if (overLimit) {
      skipped.push({ reference: v.reference, reason: "Your plan's listing limit is reached" });
      continue;
    }
    const to: PartnerVehicleStatus = isNew ? "published" : "pending_approval";
    await db
      .update(partnerVehicles)
      .set(isNew ? { status: to, publishedAt: now, adminRemarks: null } : { status: to, submittedAt: now })
      .where(and(eq(partnerVehicles.id, v.id), eq(partnerVehicles.partnerId, ctx.partner.id), eq(partnerVehicles.status, v.status)));
    await recordApproval({
      partnerId: ctx.partner.id,
      target: "vehicle",
      targetId: v.id,
      action: isNew ? "published" : v.submittedAt ? "resubmitted" : "submitted",
      fromStatus: v.status,
      toStatus: to,
      remarks: isNew && (v.status === "pending_approval" || v.status === "approved") ? "New-car listings no longer need MarchGear's approval — published." : null,
      actorUserId: ctx.user.id,
      actorSide: "dealer",
    });
    await logPartnerActivity(ctx.partner.id, ctx.user.id, isNew ? "publish" : "submit", "vehicle", v.id, `${isNew ? "Published" : "Submitted"} ${titleOf(v)}${isNew ? "" : " for approval"}`);
    if (!isNew) await syncPublic(ctx, v, false, false);
    (isNew ? published : submitted).push(v.reference);
  }
  if (published.length) {
    expireCatalog();
    await notifyPartner(ctx.partner.id, {
      kind: "vehicle",
      title: published.length === 1 ? `${published[0]} is live on MarchGear` : `${published.length} new cars are live on MarchGear`,
      body: `${ctx.user.name} published ${published.join(", ")}.`,
      href: "/dealer/inventory?status=published",
    });
  }
  if (submitted.length) {
    await notifyPartner(ctx.partner.id, {
      kind: "vehicle",
      title: submitted.length === 1 ? `${submitted[0]} sent for approval` : `${submitted.length} used cars sent for approval`,
      body: `${ctx.user.name} submitted ${submitted.join(", ")}. MarchGear will review ${submitted.length === 1 ? "it" : "them"} shortly.`,
      href: "/dealer/inventory?status=pending_approval",
    });
  }
  return { ok: true, published, submitted, skipped };
}

/** Takes live new-car listings off the website (the dealer can republish any time). */
export async function pauseVehiclesAction(vehicleIds: unknown): Promise<ActionResult<{ paused: string[]; skipped: { reference: string; reason: string }[] }>> {
  const ctx = await partnerAction("inventory.manage");
  if (isActionError(ctx)) return ctx;
  const list = ids.safeParse(vehicleIds);
  if (!list.success) return fail(list.error.issues[0]?.message ?? "Select vehicles to pause.");
  const rows = await getPartnerVehicles(ctx.partner.id, list.data);
  if (!rows.length) return fail("Those vehicles no longer exist.");
  const db = getDb();
  const paused: string[] = [];
  const skipped: { reference: string; reason: string }[] = [];
  for (const v of rows) {
    if (v.kind !== "new") {
      skipped.push({ reference: v.reference, reason: "Used cars are withdrawn to draft instead" });
      continue;
    }
    if (v.status !== "published") {
      skipped.push({ reference: v.reference, reason: `It's ${VEHICLE_STATUS_LABEL[v.status].toLowerCase()}, not live` });
      continue;
    }
    const [res] = await db
      .update(partnerVehicles)
      .set({ status: "unpublished" })
      .where(and(eq(partnerVehicles.id, v.id), eq(partnerVehicles.partnerId, ctx.partner.id), eq(partnerVehicles.status, "published")));
    if (!res.affectedRows) continue;
    await recordApproval({ partnerId: ctx.partner.id, target: "vehicle", targetId: v.id, action: "paused", fromStatus: "published", toStatus: "unpublished", actorUserId: ctx.user.id, actorSide: "dealer" });
    await logPartnerActivity(ctx.partner.id, ctx.user.id, "pause", "vehicle", v.id, `Paused ${titleOf(v)}`);
    paused.push(v.reference);
  }
  if (paused.length) expireCatalog();
  if (!paused.length) return fail(skipped[0]?.reason ?? "Nothing to pause.");
  return { ok: true, paused, skipped };
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

/** Used cars: pulls a pending, approved or live listing back to draft. */
export async function withdrawVehicleAction(vehicleId: unknown): Promise<ActionResult> {
  const ctx = await partnerAction("inventory.manage");
  if (isActionError(ctx)) return ctx;
  const vid = id.safeParse(vehicleId);
  if (!vid.success) return fail("Choose a vehicle.");
  const v = await getPartnerVehicle(ctx.partner.id, vid.data);
  if (!v) return fail("This vehicle no longer exists.");
  if (v.kind === "new") return fail("New-car listings don't go through approval — pause the listing instead.");
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

/** The list's inline stock. For a new car on order, entering units marks it in stock. */
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
  const nd = v.kind === "new" ? newDetailsOf(v.used) : null;
  const leavesOrder = nd?.availability === "on_order" && units > 0;
  if (v.stock !== units || leavesOrder) {
    await getDb()
      .update(partnerVehicles)
      .set({ stock: units, ...(leavesOrder && nd ? { used: { ...nd, availability: "in_stock" as const, waitingWeeks: null } } : {}) })
      .where(and(eq(partnerVehicles.id, v.id), eq(partnerVehicles.partnerId, ctx.partner.id)));
    await logPartnerActivity(ctx.partner.id, ctx.user.id, "stock", "vehicle", v.id, `Stock of ${titleOf(v)}: ${nd?.availability === "on_order" ? "on order" : v.stock} → ${units}`);
    // Stock shows publicly (and a used car with none left is marked sold).
    await syncPublic(ctx, v, v.status === "published", v.status === "published");
  }
  return { ok: true, stock: units };
}

/* ── Reads for the list's drawers ───────────────────────────── */

export async function vehicleHistoryAction(
  vehicleId: unknown,
): Promise<ActionResult<{ entries: VehicleHistoryEntry[]; status: PartnerVehicleStatus; kind: "new" | "used"; remarks: string | null; reference: string; title: string }>> {
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
    kind: v.kind,
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
