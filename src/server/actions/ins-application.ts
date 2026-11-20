"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { insVendors } from "@/db/schema";
import type { ActionFailure, ActionResult } from "@/lib/action-result";
import { INS_STEPS, type InsStepKey } from "@/insurance/application";
import {
  INS_SECTIONS,
  INS_STEP_KEYS,
  INS_STEP_SECTIONS,
  PATTERNS,
  insCheckApplication,
  insCheckStep,
  insContextFor,
  insDraftSchemas,
  insReferencedFiles,
  insRejectedFileErrors,
  insStepNumber,
  normaliseMobile,
  zodErrors,
  type FieldErrors,
  type InsBankMeta,
  type InsDraftOf,
  type InsSection,
} from "@/insurance/schemas";
import type { InsurerApplication } from "@/insurance/types";
import { checkOtp, issueOtp, otpDelivery } from "@/server/partner/application";
import { maskAccount } from "@/server/partner/crypto";
import { insurerAction, isInsurerError, vendorName } from "@/server/insurance/context";
import { logInsurerActivity, notifyInsurer, recordInsApproval } from "@/server/insurance/records";
import { HOUR, take } from "@/server/rate-limit";
import { denormalise, fileReviews, insEditable, mergeSection, sanitise, toWizard } from "@/app/insurance-vendor/register/_lib/wizard";

/* Insurance vendor registration wizard: autosave, step advance, mobile/email codes and the final submission. */

const LOCKED = "Your application has been submitted and is locked while our team reviews it.";
const SLOW_DOWN = "You're saving very quickly — please wait a moment and try again.";

type SaveOk = { savedAt: string; step: number; bank?: InsBankMeta; accountSaved?: boolean; verified?: { mobile: boolean; email: boolean }; next?: InsStepKey };
export type InsSaveResult = ({ ok: true } & SaveOk) | (ActionFailure & { savedAt?: string; step?: number });

const saveInput = z.object({
  step: z.enum(INS_STEP_KEYS),
  /** { [section]: value } for the step's sections. */
  data: z.partialRecord(z.enum(INS_SECTIONS), z.unknown()),
  /** Validate the step completely and unlock the next one ("Next"). */
  advance: z.boolean().optional(),
});

const loadVendor = async (id: number) => (await getDb().select().from(insVendors).where(eq(insVendors.id, id)))[0];

/** Autosave of one step (debounced in the browser), or "Next" when `advance` is set. */
export async function saveInsApplicationAction(input: unknown): Promise<InsSaveResult> {
  const ctx = await insurerAction("profile.manage", { approved: false });
  if (isInsurerError(ctx)) return ctx;
  const parsed = saveInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That save request wasn't valid. Reload the page and try again." };
  const { step, data, advance } = parsed.data;
  const sections = INS_STEP_SECTIONS[step];
  if (Object.keys(data).some((k) => !sections.includes(k as InsSection)) || !sections.some((s) => s in data))
    return { ok: false, error: "That save request wasn't valid. Reload the page and try again." };
  if (!take(`ins-app-save:${ctx.user.id}`, 900, HOUR)) return { ok: false, error: SLOW_DOWN };

  const vendor = await loadVendor(ctx.vendor.id);
  if (!vendor) return { ok: false, error: "We couldn't find your application." };
  if (!insEditable(vendor)) return { ok: false, error: LOCKED };
  const n = insStepNumber(step);
  if (n > Math.max(1, vendor.step)) return { ok: false, error: "Finish the earlier steps first." };

  let app: InsurerApplication = vendor.application;
  let accountSaved = false;
  const fieldErrors: FieldErrors = {};
  const typedBank: { accountNumber: string; accountNumberConfirm: string } = { accountNumber: "", accountNumberConfirm: "" };
  for (const s of sections) {
    if (!(s in data)) continue;
    const draft = insDraftSchemas[s].safeParse(data[s]);
    if (!draft.success) {
      const errs = zodErrors(draft.error);
      Object.assign(fieldErrors, s === "declaration" ? Object.fromEntries(Object.entries(errs).map(([k, v]) => [`declaration.${k}`, v])) : errs);
      continue;
    }
    const clean = await sanitise(vendor.id, s, draft.data as InsDraftOf<typeof s>);
    const merged = mergeSection(app, s, clean);
    app = merged.app;
    if (s === "bank") {
      accountSaved = merged.accountSaved;
      const b = draft.data as InsDraftOf<"bank">;
      typedBank.accountNumber = b.accountNumber;
      typedBank.accountNumberConfirm = b.accountNumberConfirm;
    }
  }
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Some fields are too long or in the wrong format.", fieldErrors };

  let checkErrors: FieldErrors = {};
  if (advance) {
    const view = toWizard(app);
    // A typed account number that wasn't saved (mismatch, wrong length) is checked as typed.
    if (step === "bank" && !accountSaved) view.app.bank = { ...view.app.bank, ...typedBank };
    const check = insContextFor(view.app, { requireVerifiedMobile: otpDelivery() !== "none", hasAccount: view.bank.hasAccount });
    const reviews = await fileReviews(
      vendor.id,
      insReferencedFiles(view.app).map((f) => f.id),
    );
    checkErrors = { ...insCheckStep(step, view.app, check), ...insRejectedFileErrors(step, view.app, reviews) };
  }
  const valid = Boolean(advance) && Object.keys(checkErrors).length === 0 && step !== "documents";
  const nextStep = valid ? Math.min(INS_STEPS.length, Math.max(vendor.step, n + 1)) : vendor.step;

  await getDb()
    .update(insVendors)
    .set({ application: app, step: nextStep, ...denormalise(app) })
    .where(eq(insVendors.id, vendor.id));
  const savedAt = new Date().toISOString();

  if (valid && nextStep > vendor.step) await logInsurerActivity(vendor.id, ctx.user.id, "update", "application", vendor.id, `Completed “${INS_STEPS[n - 1].title}” in the vendor application`);
  if (advance && Object.keys(checkErrors).length) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: checkErrors, savedAt, step: nextStep };

  return {
    ok: true,
    savedAt,
    step: nextStep,
    ...(sections.includes("bank") ? { bank: { hasAccount: Boolean(app.bank.accountNumber), masked: maskAccount(app.bank.accountNumber) }, accountSaved } : {}),
    ...(sections.includes("contact") ? { verified: { mobile: app.contact.mobileVerified, email: app.contact.emailVerified } } : {}),
    ...(valid ? { next: INS_STEPS[Math.min(INS_STEPS.length - 1, n)].key } : {}),
  };
}

/* ── Verification codes (partner_otps, keyed by user + channel) ── */

const otpTarget = z.discriminatedUnion("channel", [
  z.object({
    channel: z.literal("mobile"),
    target: z
      .string()
      .max(30)
      .transform(normaliseMobile)
      .refine((v) => PATTERNS.mobile.test(v), "Enter a valid 10-digit mobile number first"),
  }),
  z.object({
    channel: z.literal("email"),
    target: z
      .string()
      .trim()
      .toLowerCase()
      .max(190)
      .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), "Enter a valid email address first"),
  }),
]);

/**
 * Generates a 6-digit code (hashed, 10-minute expiry, 5 attempts, rate-limited resend).
 * No SMS or email provider is configured: in development the code comes back for on-screen display;
 * in production nothing is sent and MarchGear verifies the contact details during review.
 */
export async function sendInsOtpAction(input: unknown): Promise<ActionResult<{ channel: "mobile" | "email"; target: string; devCode?: string; expiresAt: string; resendAt: string }>> {
  const ctx = await insurerAction("profile.manage", { approved: false });
  if (isInsurerError(ctx)) return ctx;
  if (!insEditable(ctx.vendor)) return { ok: false, error: LOCKED };
  const parsed = otpTarget.safeParse(input);
  if (!parsed.success) return { ok: false, error: zodErrors(parsed.error).target ?? "Check the details and try again." };
  const { channel, target } = parsed.data;
  if (otpDelivery() === "none")
    return {
      ok: false,
      error: channel === "mobile" ? "SMS isn't set up yet — our team will verify this number during review." : "Email delivery isn't set up yet — our team will confirm this address during review.",
    };
  if (!take(`ins-otp:${ctx.user.id}`, 12, HOUR)) return { ok: false, error: "Too many codes requested. Please try again in an hour." };
  const issued = await issueOtp(ctx.user.id, channel, target);
  if (!issued.ok) return { ok: false, error: issued.error };
  return { ok: true, channel, target, devCode: issued.code, expiresAt: issued.expiresAt.toISOString(), resendAt: issued.resendAt.toISOString() };
}

const verifyInput = z.object({
  channel: z.enum(["mobile", "email"]),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export async function verifyInsOtpAction(input: unknown): Promise<ActionResult<{ channel: "mobile" | "email"; target: string }>> {
  const ctx = await insurerAction("profile.manage", { approved: false });
  if (isInsurerError(ctx)) return ctx;
  if (!insEditable(ctx.vendor)) return { ok: false, error: LOCKED };
  const parsed = verifyInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter the 6-digit code", fieldErrors: { code: "Enter the 6-digit code" } };
  const { channel, code } = parsed.data;
  if (!take(`ins-otp-verify:${ctx.user.id}`, 30, HOUR)) return { ok: false, error: "Too many attempts. Please try again later." };

  const res = await checkOtp(ctx.user.id, channel, code);
  if (!res.ok) return { ok: false, error: res.error, fieldErrors: { code: res.error } };

  const vendor = await loadVendor(ctx.vendor.id);
  const app = structuredClone(vendor.application);
  app.contact = channel === "mobile" ? { ...app.contact, mobile: res.target, mobileVerified: true } : { ...app.contact, email: res.target, emailVerified: true };
  await getDb().update(insVendors).set({ application: app }).where(eq(insVendors.id, vendor.id));
  await logInsurerActivity(vendor.id, ctx.user.id, "verify", "application", vendor.id, channel === "mobile" ? `Verified the contact mobile ending ${res.target.slice(-4)}` : "Verified the contact email");
  return { ok: true, channel, target: res.target };
}

/* ── Final submission (and resubmission after staff feedback) ── */

export type InsSubmitResult = { ok: true; next: string } | (ActionFailure & { incomplete?: { key: InsStepKey; title: string; count: number }[] });

export async function submitInsApplicationAction(input: unknown): Promise<InsSubmitResult> {
  const ctx = await insurerAction("profile.manage", { approved: false });
  if (isInsurerError(ctx)) return ctx;
  const parsed = z.object({ declaration: insDraftSchemas.declaration }).safeParse(input);
  if (!parsed.success) {
    const errs = zodErrors(parsed.error);
    return { ok: false, error: "Please check the highlighted fields.", fieldErrors: Object.fromEntries(Object.entries(errs).map(([k, v]) => [k.startsWith("declaration.") ? k : `declaration.${k}`, v])) };
  }
  if (!take(`ins-app-submit:${ctx.user.id}`, 20, HOUR)) return { ok: false, error: SLOW_DOWN };

  const db = getDb();
  const vendor = await loadVendor(ctx.vendor.id);
  if (!vendor) return { ok: false, error: "We couldn't find your application." };
  if (!insEditable(vendor)) return { ok: false, error: LOCKED };
  if (vendor.step < INS_STEPS.length) return { ok: false, error: "Finish every step before submitting." };

  // Re-check every stored file reference, then validate the whole application server-side.
  let stored = vendor.application;
  for (const s of ["regulatory", "bank", "documents"] as const) {
    const view = toWizard(stored).app;
    const clean = await sanitise(vendor.id, s, view[s] as InsDraftOf<typeof s>);
    stored = mergeSection(stored, s, clean as InsDraftOf<typeof s>).app;
  }
  const merged = mergeSection(stored, "declaration", parsed.data.declaration).app;
  const view = toWizard(merged);
  const check = insContextFor(view.app, { requireVerifiedMobile: otpDelivery() !== "none", hasAccount: view.bank.hasAccount });
  const reviews = await fileReviews(
    vendor.id,
    insReferencedFiles(view.app).map((f) => f.id),
  );
  const incomplete = insCheckApplication(view.app, check)
    .map((s) => ({ ...s, errors: { ...s.errors, ...insRejectedFileErrors(s.key, view.app, reviews) } }))
    .filter((s) => Object.keys(s.errors).length > 0)
    .map((s) => ({ key: s.key, title: s.title, count: Object.keys(s.errors).length }));
  const all = insCheckStep("documents", view.app, check);
  const declarationErrors = Object.fromEntries(Object.entries(all).filter(([k]) => k.startsWith("declaration")));
  if (incomplete.length || Object.keys(declarationErrors).length) {
    await db.update(insVendors).set({ application: merged }).where(eq(insVendors.id, vendor.id));
    return {
      ok: false,
      error: incomplete.length ? `Some sections need attention: ${incomplete.map((s) => s.title).join(", ")}.` : "Please check the highlighted fields.",
      fieldErrors: declarationErrors,
      incomplete,
    };
  }

  const resubmission = vendor.status !== "draft";
  const now = new Date();
  const signed: InsurerApplication = { ...merged, declaration: { ...merged.declaration, name: merged.declaration.name.trim(), acceptedAt: now.toISOString() } };
  await db
    .update(insVendors)
    .set({ application: signed, status: "pending_approval", step: INS_STEPS.length, submittedAt: now, requiredCorrections: null, ...denormalise(signed) })
    .where(eq(insVendors.id, vendor.id));

  await recordInsApproval({
    vendorId: vendor.id,
    target: "vendor",
    targetId: vendor.id,
    action: resubmission ? "resubmitted" : "submitted",
    fromStatus: vendor.status,
    toStatus: "pending_approval",
    remarks: resubmission ? "Updated the application with the requested changes" : null,
    actorUserId: ctx.user.id,
    actorSide: "vendor",
  });
  await notifyInsurer(vendor.id, {
    kind: "application",
    title: resubmission ? "Updated application received" : "Application received",
    body: `We've received the application for ${vendorName({ ...vendor, ...denormalise(signed), application: signed })} (${vendor.reference}). Our team will verify your details, regulatory registration and documents — you'll see every update on your application status page.`,
    href: "/insurance-vendor/application-status",
  });
  await logInsurerActivity(vendor.id, ctx.user.id, "submit", "application", vendor.id, resubmission ? "Resubmitted the vendor application" : "Submitted the vendor application for verification");
  revalidatePath("/insurance-vendor", "layout");
  return { ok: true, next: "/insurance-vendor/application-status" };
}
