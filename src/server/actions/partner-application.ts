"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { partners } from "@/db/schema";
import type { ActionFailure, ActionResult } from "@/lib/action-result";
import { WIZARD_STEPS, PATTERNS, type WizardSlug } from "@/partner/application";
import {
  SECTIONS,
  STEP_SECTION,
  checkApplication,
  checkStep,
  contextFor,
  draftSchemas,
  normaliseMobile,
  rejectedFileErrors,
  stepNumber,
  zodErrors,
  type BankMeta,
  type DraftOf,
  type FieldErrors,
  type Section,
} from "@/partner/schemas";
import { partnerAction, isActionError } from "@/server/partner/context";
import {
  catalogLite,
  checkOtp,
  denormalise,
  fileReviews,
  isEditable,
  issueOtp,
  materialise,
  mergeSection,
  otpDelivery,
  referencedFiles,
  sanitise,
  toWizard,
} from "@/server/partner/application";
import { maskAccount } from "@/server/partner/crypto";
import { logPartnerActivity, notifyPartner, recordApproval } from "@/server/partner/records";
import { HOUR, take } from "@/server/rate-limit";

/* Registration wizard: autosave, step advance, mobile/email codes and the final submission. */

const LOCKED = "Your application has been submitted and is locked while our team reviews it.";
const SLOW_DOWN = "You're saving very quickly — please wait a moment and try again.";

type SaveOk = { savedAt: string; step: number; bank?: BankMeta; accountSaved?: boolean; verified?: { mobile: boolean; email: boolean }; next?: string };
export type SaveResult = ({ ok: true } & SaveOk) | (ActionFailure & { savedAt?: string; step?: number });

const saveInput = z.object({
  section: z.enum(SECTIONS),
  data: z.unknown(),
  /** Validate the step completely and unlock the next one. */
  advance: z.boolean().optional(),
  /** Which step is being saved (for advance). */
  step: z.enum(WIZARD_STEPS.map((s) => s.slug) as [WizardSlug, ...WizardSlug[]]).optional(),
});

/** Autosave of one section (debounced in the browser), or "Next" when `advance` is set. */
export async function saveApplicationSectionAction(input: unknown): Promise<SaveResult> {
  const ctx = await partnerAction("profile.manage", { approved: false });
  if (isActionError(ctx)) return ctx;
  const parsed = saveInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That save request wasn't valid. Reload the page and try again." };
  const { section, advance } = parsed.data;
  const slug = parsed.data.step ?? (Object.entries(STEP_SECTION).find(([, s]) => s === section)![0] as WizardSlug);
  if (STEP_SECTION[slug] !== section) return { ok: false, error: "That save request wasn't valid. Reload the page and try again." };
  if (!take(`partner-app-save:${ctx.user.id}`, 900, HOUR)) return { ok: false, error: SLOW_DOWN };

  const db = getDb();
  const [partner] = await db.select().from(partners).where(eq(partners.id, ctx.partner.id));
  if (!partner) return { ok: false, error: "We couldn't find your application." };
  if (!isEditable(partner)) return { ok: false, error: LOCKED };
  const n = stepNumber(slug);
  if (n > Math.max(1, partner.step)) return { ok: false, error: "Finish the earlier steps first." };

  const draft = draftSchemas[section].safeParse(parsed.data.data);
  if (!draft.success) return { ok: false, error: "Some fields are too long or in the wrong format.", fieldErrors: zodErrors(draft.error) };
  const clean = await sanitise(partner.id, section, draft.data as DraftOf<typeof section>);
  const { app, accountSaved } = mergeSection(partner.application, section, clean);

  let fieldErrors: FieldErrors = {};
  if (advance) {
    const view = toWizard(app);
    if (section === "bank") {
      const typed = draft.data as DraftOf<"bank">;
      view.app.bank = { ...view.app.bank, accountNumber: accountSaved ? "" : typed.accountNumber, accountNumberConfirm: accountSaved ? "" : typed.accountNumberConfirm };
    }
    const check = contextFor(view.app, { requireVerifiedMobile: otpDelivery() !== "none", hasAccount: view.bank.hasAccount });
    const reviews = await fileReviews(
      partner.id,
      referencedFiles(view.app).map((f) => f.id),
    );
    fieldErrors = {
      ...checkStep(slug, view.app, check, section === "brands" ? await catalogLite() : undefined),
      ...rejectedFileErrors(slug, view.app, reviews),
    };
  }
  const valid = advance && Object.keys(fieldErrors).length === 0;
  const step = valid ? Math.min(7, Math.max(partner.step, n + 1)) : partner.step;

  await db
    .update(partners)
    .set({ application: app, step, ...denormalise(app) })
    .where(eq(partners.id, partner.id));
  const savedAt = new Date().toISOString();

  if (valid && step > partner.step) await logPartnerActivity(partner.id, ctx.user.id, "update", "application", null, `Completed “${WIZARD_STEPS[n - 1].title}” in the partner application`);
  if (advance && !valid) return { ok: false, error: "Please check the highlighted fields.", fieldErrors, savedAt, step };

  return {
    ok: true,
    savedAt,
    step,
    ...(section === "bank" ? { bank: { hasAccount: Boolean(app.bank.accountNumber), masked: maskAccount(app.bank.accountNumber) }, accountSaved } : {}),
    ...(section === "personal" ? { verified: { mobile: app.personal.mobileVerified, email: app.personal.emailVerified } } : {}),
    ...(valid ? { next: WIZARD_STEPS[Math.min(6, n)].slug } : {}),
  };
}

/* ── Verification codes ─────────────────────────────────────── */

const otpTarget = z.discriminatedUnion("channel", [
  z.object({
    channel: z.literal("mobile"),
    target: z
      .string()
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
 * Generates a 6-digit code (SHA-256 stored, 10-minute expiry, 5 attempts, rate-limited resend).
 * No SMS or email provider is configured: in development the code is returned for on-screen display;
 * in production nothing is sent and the team verifies the number during review.
 */
export async function sendApplicationOtpAction(input: unknown): Promise<ActionResult<{ channel: "mobile" | "email"; target: string; devCode?: string; expiresAt: string; resendAt: string }>> {
  const ctx = await partnerAction("profile.manage", { approved: false });
  if (isActionError(ctx)) return ctx;
  if (!isEditable(ctx.partner)) return { ok: false, error: LOCKED };
  const parsed = otpTarget.safeParse(input);
  if (!parsed.success) {
    const errors = zodErrors(parsed.error);
    return { ok: false, error: errors.target ?? "Check the number and try again.", fieldErrors: errors.target ? { [String((input as { channel?: string })?.channel ?? "mobile")]: errors.target } : undefined };
  }
  const { channel, target } = parsed.data;
  if (otpDelivery() === "none")
    return {
      ok: false,
      error: channel === "mobile" ? "SMS isn't set up yet — your number will be verified by our team during review." : "Email delivery isn't set up yet — our team will confirm your email during review.",
    };
  if (!take(`partner-otp:${ctx.user.id}`, 12, HOUR)) return { ok: false, error: "Too many codes requested. Please try again in an hour." };

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

export async function verifyApplicationOtpAction(input: unknown): Promise<ActionResult<{ channel: "mobile" | "email"; target: string }>> {
  const ctx = await partnerAction("profile.manage", { approved: false });
  if (isActionError(ctx)) return ctx;
  if (!isEditable(ctx.partner)) return { ok: false, error: LOCKED };
  const parsed = verifyInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter the 6-digit code", fieldErrors: { code: "Enter the 6-digit code" } };
  const { channel, code } = parsed.data;
  if (!take(`partner-otp-verify:${ctx.user.id}`, 30, HOUR)) return { ok: false, error: "Too many attempts. Please try again later." };

  const res = await checkOtp(ctx.user.id, channel, code);
  if (!res.ok) return { ok: false, error: res.error, fieldErrors: { code: res.error } };

  const db = getDb();
  const [partner] = await db.select().from(partners).where(eq(partners.id, ctx.partner.id));
  const app = structuredClone(partner.application);
  if (channel === "mobile") app.personal = { ...app.personal, mobile: res.target, mobileVerified: true };
  else app.personal = { ...app.personal, email: res.target, emailVerified: true };
  await db.update(partners).set({ application: app }).where(eq(partners.id, partner.id));
  await logPartnerActivity(partner.id, ctx.user.id, "verify", "application", null, channel === "mobile" ? `Verified mobile number ending ${res.target.slice(-4)}` : "Verified contact email");
  return { ok: true, channel, target: res.target };
}

/* ── Final submission (and resubmission after staff feedback) ── */

export type SubmitResult = ({ ok: true; next: string }) | (ActionFailure & { incomplete?: { slug: WizardSlug; title: string; count: number }[] });

export async function submitApplicationAction(input: unknown): Promise<SubmitResult> {
  const ctx = await partnerAction("profile.manage", { approved: false });
  if (isActionError(ctx)) return ctx;
  const parsed = z.object({ declaration: draftSchemas.declaration }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: zodErrors(parsed.error) };
  if (!take(`partner-app-submit:${ctx.user.id}`, 20, HOUR)) return { ok: false, error: SLOW_DOWN };

  const db = getDb();
  const [partner] = await db.select().from(partners).where(eq(partners.id, ctx.partner.id));
  if (!partner) return { ok: false, error: "We couldn't find your application." };
  if (!isEditable(partner)) return { ok: false, error: LOCKED };
  if (partner.step < 7) return { ok: false, error: "Finish every step before submitting." };

  // Re-check every stored reference, then validate the whole application server-side.
  let stored = partner.application;
  for (const s of ["personal", "showrooms", "brands", "documents", "bank"] as Section[]) {
    const view = toWizard(stored).app;
    const current = s === "bank" ? view.bank : (view as unknown as Record<Section, unknown>)[s];
    const clean = await sanitise(partner.id, s, current as DraftOf<typeof s>);
    stored = mergeSection(stored, s, clean as DraftOf<typeof s>).app;
  }
  const { app: merged } = mergeSection(stored, "declaration", parsed.data.declaration);
  const view = toWizard(merged);
  const check = contextFor(view.app, { requireVerifiedMobile: otpDelivery() !== "none", hasAccount: view.bank.hasAccount });
  const [catalog, reviews] = await Promise.all([
    catalogLite(),
    fileReviews(
      partner.id,
      referencedFiles(view.app).map((f) => f.id),
    ),
  ]);
  const incomplete = checkApplication(view.app, check, catalog)
    .map((s) => ({ ...s, errors: { ...s.errors, ...rejectedFileErrors(s.slug, view.app, reviews) } }))
    .filter((s) => Object.keys(s.errors).length > 0)
    .map((s) => ({ slug: s.slug, title: s.title, count: Object.keys(s.errors).length }));
  const declarationErrors = checkStep("review", view.app, check);
  if (incomplete.length || Object.keys(declarationErrors).length) {
    await db.update(partners).set({ application: merged }).where(eq(partners.id, partner.id));
    return {
      ok: false,
      error: incomplete.length ? `Some sections need attention: ${incomplete.map((s) => s.title).join(", ")}.` : "Please check the highlighted fields.",
      fieldErrors: declarationErrors,
      incomplete,
    };
  }

  const resubmission = partner.status !== "draft";
  const now = new Date();
  const signed: typeof merged = { ...merged, declaration: { ...merged.declaration, signedName: merged.declaration.signedName.trim(), signedAt: now.toISOString() } };
  await db.transaction(async (tx) => {
    const final = await materialise(tx, partner.id, signed);
    await tx
      .update(partners)
      .set({ application: final, status: "submitted", step: 7, submittedAt: now, requiredCorrections: null, ...denormalise(final) })
      .where(eq(partners.id, partner.id));
    // Straight into the verification queue.
    await tx.update(partners).set({ status: "pending_approval" }).where(eq(partners.id, partner.id));
  });

  await recordApproval({
    partnerId: partner.id,
    target: "partner",
    action: resubmission ? "resubmitted" : "submitted",
    fromStatus: partner.status,
    toStatus: "submitted",
    remarks: resubmission ? "Updated the application with the requested changes" : null,
    actorUserId: ctx.user.id,
    actorSide: "dealer",
  });
  await recordApproval({ partnerId: partner.id, target: "partner", action: "queued", fromStatus: "submitted", toStatus: "pending_approval", remarks: "Added to the verification queue", actorUserId: null, actorSide: "system" });
  await notifyPartner(partner.id, {
    kind: "application",
    title: resubmission ? "Updated application received" : "Application received",
    body: `We've received your partner application ${partner.reference}. Our team will verify your details and documents, and you'll hear from us here.`,
    href: "/dealer/application-status",
  });
  await logPartnerActivity(partner.id, ctx.user.id, "submit", "application", partner.id, resubmission ? "Resubmitted the partner application" : "Submitted the partner application for verification");
  return { ok: true, next: "/dealer/application-status" };
}
