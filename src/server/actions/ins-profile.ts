"use server";

import { z } from "zod";
import { and, asc, count, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { insBranches, insChangeRequests, insCompanies, insFiles, insVendors, media } from "@/db/schema";
import { INS_BUSINESS_TYPES, INS_VENDOR_CATEGORIES } from "@/db/enums";
import type { ActionFailure, ActionResult } from "@/lib/action-result";
import { INDIAN_STATES } from "@/data/states";
import { PATTERNS } from "@/partner/application";
import type { FileRef, InsurerApplication, InsurerProfile } from "@/insurance/types";
import { decryptField, encryptField, maskAccount } from "@/server/partner/crypto";
import { insurerAction, isInsurerError } from "@/server/insurance/context";
import { logInsurerActivity, recordInsApproval } from "@/server/insurance/records";
import { invalid } from "@/server/validation";
import { CHANGE_FIELDS, CHANGE_LABEL, docSlots, readPath, type ChangeField } from "@/components/insurance/vendor/profile/shared";

/* ──────────────────────────────────────────────────────────────
   Company profile: the public profile (saved straight away and
   mirrored onto an insurer's own company listing), branch offices
   (exactly one primary), change requests for verified details and
   replacements for rejected KYC documents. Scoped by ctx.vendor.id.
   ────────────────────────────────────────────────────────────── */

const fail = (error: string, fieldErrors?: Record<string, string>): ActionFailure => ({ ok: false, error, ...(fieldErrors ? { fieldErrors } : {}) });
const idSchema = z.coerce.number().int().positive().max(2_147_483_647);

const url = z
  .string()
  .trim()
  .max(300)
  .refine((v) => !v || /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(v), "Enter a full link starting with https://");
const phone = z
  .string()
  .trim()
  .max(30)
  .transform((v) => v.replace(/[^\d+]/g, ""))
  .refine((v) => !v || /^\+?\d{8,13}$/.test(v), "Enter a valid phone number (toll-free numbers are fine)");
const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(190)
  .refine((v) => !v || z.email().safeParse(v).success, "Enter a valid email address");
const mediaUrl = z
  .string()
  .max(300)
  .refine((v) => !v || /^\/media\/\d+\/[\w.-]+$/.test(v), "Upload the logo with the uploader");

const profileSchema = z.object({
  logo: mediaUrl,
  about: z.string().trim().max(2000, "Keep this under 2,000 characters"),
  website: url,
  supportPhone: phone,
  supportEmail: optionalEmail,
  claimsPhone: phone,
  claimsEmail: optionalEmail,
  supportHours: z.string().trim().max(80, "Keep this under 80 characters"),
  garageCount: z
    .union([z.string(), z.number()])
    .transform((v) => String(v).replace(/[,\s]/g, ""))
    .refine((v) => v === "" || (/^\d{1,6}$/.test(v) && Number(v) <= 100_000), "Enter 0 to 1,00,000")
    .transform((v) => (v === "" ? null : Number(v))),
  garageNote: z.string().trim().max(200, "Keep this under 200 characters"),
});

/** The insurer's own company listing, when MarchGear has linked one. */
async function ownCompany(vendorId: number) {
  const [c] = await getDb().select({ id: insCompanies.id, slug: insCompanies.slug }).from(insCompanies).where(eq(insCompanies.vendorId, vendorId)).limit(1);
  return c ?? null;
}

/** Saves the public profile; for insurers also mirrors it onto their company listing (never claim info or regulator numbers). */
export async function saveInsurerProfileAction(input: unknown): Promise<ActionResult<{ mirrored: boolean }>> {
  const ctx = await insurerAction("profile.manage");
  if (isInsurerError(ctx)) return ctx;
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const db = getDb();
  if (v.logo) {
    const id = Number(v.logo.split("/")[2]);
    const [m] = await db.select({ id: media.id }).from(media).where(and(eq(media.id, id), eq(media.insVendorId, ctx.vendor.id))).limit(1);
    if (!m) return fail("The logo wasn't uploaded by your company. Upload it again.", { logo: "Upload the logo again" });
  }
  const profile: InsurerProfile = {
    logo: v.logo,
    about: v.about,
    website: v.website,
    supportPhone: v.supportPhone,
    supportEmail: v.supportEmail,
    claimsPhone: v.claimsPhone,
    claimsEmail: v.claimsEmail,
    supportHours: v.supportHours,
  };
  await db.update(insVendors).set({ profile }).where(eq(insVendors.id, ctx.vendor.id));

  let mirrored = false;
  const company = ctx.vendor.category === "insurer" ? await ownCompany(ctx.vendor.id) : null;
  if (company) {
    await db
      .update(insCompanies)
      .set({
        logo: v.logo || null,
        about: v.about || null,
        website: v.website || null,
        supportPhone: v.supportPhone || null,
        claimsPhone: v.claimsPhone || null,
        claimsEmail: v.claimsEmail || null,
        garageCount: v.garageCount,
        garageNote: v.garageNote || null,
      })
      .where(and(eq(insCompanies.id, company.id), eq(insCompanies.vendorId, ctx.vendor.id)));
    mirrored = true;
    revalidatePath("/insurance", "layout");
  }
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "update", "profile", ctx.vendor.id, mirrored ? "Updated the public profile and the company listing" : "Updated the public profile");
  revalidatePath("/insurance-vendor", "layout");
  return { ok: true, mirrored };
}

/* ── Branches ───────────────────────────────────────────────── */

const branchSchema = z.object({
  id: idSchema.nullable(),
  name: z.string().trim().min(2, "Enter the office name").max(160),
  address: z.string().trim().min(8, "Enter the full street address").max(300),
  state: z.string().refine((v) => (INDIAN_STATES as readonly string[]).includes(v), "Choose the state"),
  city: z.string().trim().min(2, "Enter the city").max(64),
  pin: z.string().trim().regex(PATTERNS.pin, "Enter a valid 6-digit PIN code"),
  phone,
  email: optionalEmail,
});

async function branchCount(vendorId: number) {
  const [{ n }] = await getDb().select({ n: count() }).from(insBranches).where(eq(insBranches.vendorId, vendorId));
  return n;
}

/** Keeps exactly one primary branch (the oldest becomes primary when none is). */
async function ensurePrimary(vendorId: number) {
  const db = getDb();
  const rows = await db.select({ id: insBranches.id, isPrimary: insBranches.isPrimary }).from(insBranches).where(eq(insBranches.vendorId, vendorId)).orderBy(asc(insBranches.id));
  const primaries = rows.filter((r) => r.isPrimary);
  if (primaries.length === 1 || !rows.length) return;
  const keep = primaries[0]?.id ?? rows[0].id;
  await db.transaction(async (tx) => {
    await tx.update(insBranches).set({ isPrimary: false }).where(and(eq(insBranches.vendorId, vendorId), ne(insBranches.id, keep)));
    await tx.update(insBranches).set({ isPrimary: true }).where(eq(insBranches.id, keep));
  });
}

export async function saveBranchAction(input: unknown): Promise<ActionResult<{ id: number }>> {
  const ctx = await insurerAction("profile.manage");
  if (isInsurerError(ctx)) return ctx;
  const parsed = branchSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, ...v } = parsed.data;
  const db = getDb();
  const values = { ...v, phone: v.phone || null, email: v.email || null };
  if (id) {
    const [row] = await db.select({ id: insBranches.id }).from(insBranches).where(and(eq(insBranches.id, id), eq(insBranches.vendorId, ctx.vendor.id)));
    if (!row) return fail("That office couldn't be found.");
    await db.update(insBranches).set(values).where(and(eq(insBranches.id, id), eq(insBranches.vendorId, ctx.vendor.id)));
    await logInsurerActivity(ctx.vendor.id, ctx.user.id, "update", "branch", id, `Updated the office ${v.name}`);
    revalidatePath("/insurance-vendor/profile");
    return { ok: true, id };
  }
  if ((await branchCount(ctx.vendor.id)) >= 100) return fail("You can list up to 100 offices.");
  const first = (await branchCount(ctx.vendor.id)) === 0;
  const [res] = await db.insert(insBranches).values({ ...values, vendorId: ctx.vendor.id, isPrimary: first });
  await ensurePrimary(ctx.vendor.id);
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "create", "branch", res.insertId, `Added the office ${v.name}`);
  revalidatePath("/insurance-vendor/profile");
  return { ok: true, id: res.insertId };
}

export async function setPrimaryBranchAction(branchId: unknown): Promise<ActionResult> {
  const ctx = await insurerAction("profile.manage");
  if (isInsurerError(ctx)) return ctx;
  const id = idSchema.safeParse(branchId);
  if (!id.success) return fail("Choose an office.");
  const db = getDb();
  const [row] = await db.select().from(insBranches).where(and(eq(insBranches.id, id.data), eq(insBranches.vendorId, ctx.vendor.id)));
  if (!row) return fail("That office couldn't be found.");
  await db.transaction(async (tx) => {
    await tx.update(insBranches).set({ isPrimary: false }).where(and(eq(insBranches.vendorId, ctx.vendor.id), ne(insBranches.id, row.id)));
    await tx.update(insBranches).set({ isPrimary: true }).where(eq(insBranches.id, row.id));
  });
  await db.update(insVendors).set({ city: row.city, state: row.state }).where(eq(insVendors.id, ctx.vendor.id));
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "update", "branch", row.id, `Made ${row.name} the primary office`);
  revalidatePath("/insurance-vendor/profile");
  return { ok: true };
}

export async function deleteBranchAction(branchId: unknown): Promise<ActionResult> {
  const ctx = await insurerAction("profile.manage");
  if (isInsurerError(ctx)) return ctx;
  const id = idSchema.safeParse(branchId);
  if (!id.success) return fail("Choose an office.");
  const db = getDb();
  const [row] = await db.select().from(insBranches).where(and(eq(insBranches.id, id.data), eq(insBranches.vendorId, ctx.vendor.id)));
  if (!row) return fail("That office couldn't be found.");
  if (row.isPrimary) return fail("This is your primary office. Make another office primary before removing it.");
  await db.delete(insBranches).where(and(eq(insBranches.id, row.id), eq(insBranches.vendorId, ctx.vendor.id)));
  await ensurePrimary(ctx.vendor.id);
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "delete", "branch", row.id, `Removed the office ${row.name}`);
  revalidatePath("/insurance-vendor/profile");
  return { ok: true };
}

/* ── Change requests for verified details ───────────────────── */

const text = (max: number, label: string) => z.string().trim().min(2, `Enter the ${label}`).max(max);
const FIELD_RULES: Record<ChangeField, z.ZodType<string>> = {
  "company.legalName": text(200, "legal name"),
  "company.brandName": text(200, "brand name"),
  "company.businessType": z.enum(INS_BUSINESS_TYPES, { error: "Choose a business type" }),
  "company.address": text(300, "registered address"),
  "registration.gstin": z.string().trim().toUpperCase().regex(PATTERNS.gst, "Enter a valid 15-character GSTIN"),
  "registration.pan": z.string().trim().toUpperCase().regex(PATTERNS.pan, "Enter a valid PAN, like ABCDE1234F"),
  "registration.cin": z.string().trim().toUpperCase().min(5, "Enter the CIN or LLPIN").max(30),
  "regulatory.category": z.enum(INS_VENDOR_CATEGORIES, { error: "Choose a category" }),
  "regulatory.registrationType": text(160, "registration type"),
  "regulatory.licenceNumber": text(60, "licence number"),
  "regulatory.licenceValidUntil": z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  "bank.holder": text(120, "account holder name"),
  "bank.bankName": text(120, "bank name"),
  "bank.accountNumber": z
    .string()
    .trim()
    .transform((v) => v.replace(/\s/g, ""))
    .refine((v) => PATTERNS.account.test(v), "Enter a 9–18 digit account number"),
  "bank.ifsc": z.string().trim().toUpperCase().regex(PATTERNS.ifsc, "Enter a valid IFSC, like HDFC0001234"),
};

const requestSchema = z.object({
  changes: z.record(z.string(), z.string().max(300)),
  reason: z.string().trim().min(10, "Tell MarchGear why this is changing (at least 10 characters)").max(500, "Keep the reason under 500 characters"),
});

/** Asks MarchGear to change verified details. Nothing changes until staff approve. */
export async function requestInsurerChangeAction(input: unknown): Promise<ActionResult<{ id: number }>> {
  const ctx = await insurerAction("profile.manage");
  if (isInsurerError(ctx)) return ctx;
  const parsed = requestSchema.safeParse(input);
  const reasonErrors = parsed.success ? null : (invalid(parsed.error).fieldErrors ?? {});
  const changes = parsed.success ? parsed.data.changes : z.object({ changes: requestSchema.shape.changes }).safeParse(input).data?.changes;
  if (!changes) return fail("Please check the highlighted fields.", reasonErrors ?? {});

  const db = getDb();
  const [pending] = await db
    .select({ id: insChangeRequests.id })
    .from(insChangeRequests)
    .where(and(eq(insChangeRequests.vendorId, ctx.vendor.id), eq(insChangeRequests.status, "pending")))
    .limit(1);
  if (pending) return fail("You already have a change request waiting for review. Withdraw it first to send a different one.");

  const [row] = await db.select({ application: insVendors.application }).from(insVendors).where(eq(insVendors.id, ctx.vendor.id));
  const app = row.application as InsurerApplication;
  const current = (f: ChangeField) => (f === "bank.accountNumber" ? app.bank.accountMasked || maskAccount(app.bank.accountNumber) : readPath(app, f));

  const errs: Record<string, string> = {};
  const fields: Record<string, { from: string; to: string }> = {};
  for (const [key, raw] of Object.entries(changes)) {
    if (!raw.trim() || !(CHANGE_FIELDS as readonly string[]).includes(key)) continue;
    const f = key as ChangeField;
    const res = FIELD_RULES[f].safeParse(raw);
    if (!res.success) {
      errs[`changes.${f}`] = res.error.issues[0]?.message ?? "Check this value";
      continue;
    }
    const to = res.data;
    if (f === "bank.accountNumber") {
      let same = false;
      try {
        same = decryptField(app.bank.accountNumber) === to;
      } catch {
        same = false;
      }
      // Never store a bank account number in clear text — even inside a change request.
      if (!same) fields[f] = { from: current(f), to: encryptField(to) };
    } else if (to !== current(f)) {
      fields[f] = { from: current(f), to };
    }
  }
  if (Object.keys(errs).length || reasonErrors) return fail("Please check the highlighted fields.", { ...(reasonErrors ?? {}), ...errs });
  if (!parsed.success) return invalid(parsed.error);
  if (!Object.keys(fields).length) return fail("Change at least one value before sending the request.");

  const [res] = await db.insert(insChangeRequests).values({ vendorId: ctx.vendor.id, fields, requestedBy: ctx.user.id });
  const labels = Object.keys(fields).map((f) => CHANGE_LABEL[f as ChangeField].toLowerCase());
  await recordInsApproval({
    vendorId: ctx.vendor.id,
    target: "profile_change",
    targetId: res.insertId,
    action: "submitted",
    toStatus: "pending",
    remarks: parsed.data.reason,
    actorUserId: ctx.user.id,
    actorSide: "vendor",
  });
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "request", "profile_change", res.insertId, `Asked MarchGear to change the ${labels.join(", ")}`);
  revalidatePath("/insurance-vendor/profile");
  return { ok: true, id: res.insertId };
}

export async function withdrawInsurerChangeAction(requestId: unknown): Promise<ActionResult> {
  const ctx = await insurerAction("profile.manage");
  if (isInsurerError(ctx)) return ctx;
  const id = idSchema.safeParse(requestId);
  if (!id.success) return fail("That request couldn't be found.");
  const db = getDb();
  const where = and(eq(insChangeRequests.id, id.data), eq(insChangeRequests.vendorId, ctx.vendor.id), eq(insChangeRequests.status, "pending"));
  const [row] = await db.select({ id: insChangeRequests.id }).from(insChangeRequests).where(where);
  if (!row) return fail("This request has already been reviewed or withdrawn.");
  await db.delete(insChangeRequests).where(where);
  await recordInsApproval({ vendorId: ctx.vendor.id, target: "profile_change", targetId: row.id, action: "withdrawn", fromStatus: "pending", toStatus: "withdrawn", actorUserId: ctx.user.id, actorSide: "vendor" });
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "withdraw", "profile_change", row.id, "Withdrew a change request for verified details");
  revalidatePath("/insurance-vendor/profile");
  return { ok: true };
}

/* ── KYC documents ──────────────────────────────────────────── */

const replaceSchema = z.object({ path: z.string().max(60), fileId: idSchema });

/** Replaces a rejected KYC document with a new upload (the application's FileRef points at the new file). */
export async function replaceKycDocumentAction(input: unknown): Promise<ActionResult<{ file: FileRef }>> {
  const ctx = await insurerAction("profile.manage", { approved: false });
  if (isInsurerError(ctx)) return ctx;
  const parsed = replaceSchema.safeParse(input);
  if (!parsed.success) return fail("Upload the document again.");
  const { path, fileId } = parsed.data;
  const db = getDb();
  const [row] = await db.select({ application: insVendors.application }).from(insVendors).where(eq(insVendors.id, ctx.vendor.id));
  const app = structuredClone(row.application) as InsurerApplication;
  const slot = docSlots(app).find((s) => s.path === path);
  if (!slot) return fail("That document slot no longer exists. Reload the page.");

  const ids = [slot.file.id, fileId];
  const files = await db
    .select({ id: insFiles.id, kind: insFiles.kind, status: insFiles.status, filename: insFiles.filename, mime: insFiles.mime, size: insFiles.size })
    .from(insFiles)
    .where(and(eq(insFiles.vendorId, ctx.vendor.id), inArray(insFiles.id, ids)));
  const old = files.find((f) => f.id === slot.file.id);
  const next = files.find((f) => f.id === fileId);
  if (!old) return fail("The original document couldn't be found.");
  if (old.status !== "rejected") return fail("Only documents MarchGear rejected can be replaced here. Contact support for other changes.");
  if (!next || next.kind !== old.kind) return fail("Upload the replacement again.");
  if (next.status !== "pending") return fail("Upload a new file as the replacement.");

  const ref: FileRef = { id: next.id, filename: next.filename, mime: next.mime, size: next.size };
  slot.assign(ref);
  await db.update(insVendors).set({ application: app }).where(eq(insVendors.id, ctx.vendor.id));
  await recordInsApproval({
    vendorId: ctx.vendor.id,
    target: "document",
    targetId: next.id,
    action: "resubmitted",
    fromStatus: "rejected",
    toStatus: "pending",
    remarks: `Replaces ${old.filename} (${slot.label}).`,
    actorUserId: ctx.user.id,
    actorSide: "vendor",
  });
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "upload", "document", next.id, `Replaced the rejected ${slot.label.toLowerCase()} with ${next.filename}`);
  revalidatePath("/insurance-vendor/profile");
  return { ok: true, file: ref };
}
