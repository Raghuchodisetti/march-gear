"use server";

import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { media, partnerChangeRequests, partners, users } from "@/db/schema";
import { BUSINESS_TYPES } from "@/db/enums";
import type { ActionResult } from "@/lib/action-result";
import { PATTERNS } from "@/partner/application";
import type { PartnerProfile } from "@/partner/types";
import { decryptField, encryptField, maskAccount } from "@/server/partner/crypto";
import { isActionError, partnerAction } from "@/server/partner/context";
import { syncPublicDealer } from "@/server/partner/public-sync";
import { logPartnerActivity, notifyPartner, recordApproval } from "@/server/partner/records";
import { invalid, mobile, name } from "@/server/validation";
import { dayHoursSchema, mediaId, mediaUrl, optionalMediaUrl } from "@/components/portal/showrooms/shared";

/* Dealership profile: the owner's contact card, the public profile (no re-approval)
   and change requests for verified business and bank details. */

/** Every image must be one this dealership uploaded. */
async function ownMedia(partnerId: number, urls: string[]) {
  const ids = [...new Set(urls.filter(Boolean).map(mediaId))];
  if (!ids.length) return true;
  const rows = await getDb()
    .select({ id: media.id })
    .from(media)
    .where(and(inArray(media.id, ids), eq(media.partnerId, partnerId)));
  return rows.length === ids.length;
}

const NOT_YOURS = { ok: false as const, error: "One of the images wasn't uploaded by your dealership. Upload it again." };

const personalSchema = z.object({
  fullName: name,
  designation: z.string().trim().max(80, "Keep this under 80 characters"),
  mobile,
  photo: optionalMediaUrl,
});

/** The dealer owner's own contact card (application.personal + their login's name and mobile). */
export async function updatePrimaryContactAction(input: unknown): Promise<ActionResult> {
  const ctx = await partnerAction("profile.manage");
  if (isActionError(ctx)) return ctx;
  if (ctx.partner.ownerUserId !== ctx.user.id) return { ok: false, error: "Only the dealer owner can change the primary contact. Edit your own name and mobile in Settings." };
  const parsed = personalSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  if (!(await ownMedia(ctx.partner.id, [v.photo]))) return NOT_YOURS;

  const db = getDb();
  const [p] = await db.select({ application: partners.application }).from(partners).where(eq(partners.id, ctx.partner.id));
  const prev = p.application.personal;
  const application = {
    ...p.application,
    personal: {
      ...prev,
      fullName: v.fullName,
      designation: v.designation,
      photo: v.photo,
      mobile: v.mobile,
      // A new number hasn't been verified by OTP.
      mobileVerified: v.mobile === prev.mobile ? prev.mobileVerified : false,
    },
  };
  await db.update(partners).set({ application }).where(eq(partners.id, ctx.partner.id));
  await db.update(users).set({ name: v.fullName, phone: v.mobile }).where(eq(users.id, ctx.user.id));
  await logPartnerActivity(ctx.partner.id, ctx.user.id, "update", "profile", ctx.partner.id, "Updated the primary contact details");
  revalidatePath("/dealer", "layout");
  return { ok: true };
}

const url = z
  .string()
  .trim()
  .max(300)
  .refine((v) => !v || /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(v), "Enter a full link starting with https://");
const hostOf = (v: string) => {
  try {
    return new URL(v).hostname;
  } catch {
    return "";
  }
};
const social = (host: RegExp, label: string) => url.refine((v) => !v || host.test(hostOf(v)), `Enter your ${label} page link`);

const profileSchema = z.object({
  description: z.string().trim().max(2000, "Keep the description under 2,000 characters"),
  logo: optionalMediaUrl,
  banner: optionalMediaUrl,
  gallery: z.array(mediaUrl).max(12, "Up to 12 gallery images"),
  hours: dayHoursSchema,
  facilities: z.array(z.string().trim().min(2).max(60)).max(20, "Up to 20 facilities"),
  socials: z.object({
    website: url,
    instagram: social(/(^|\.)instagram\.com$/i, "Instagram"),
    facebook: social(/(^|\.)(facebook|fb)\.com$/i, "Facebook"),
    youtube: social(/(^|\.)(youtube\.com|youtu\.be)$/i, "YouTube"),
    whatsapp: z
      .string()
      .trim()
      .transform((v) => v.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, ""))
      .refine((v) => !v || PATTERNS.mobile.test(v), "Enter a 10-digit WhatsApp number"),
  }),
});

/** Public profile — saved straight away (no re-approval) and pushed to the public dealer page. */
export async function savePublicProfileAction(input: unknown): Promise<ActionResult<{ publicId: string | null }>> {
  const ctx = await partnerAction("profile.manage");
  if (isActionError(ctx)) return ctx;
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  if (!(await ownMedia(ctx.partner.id, [v.logo, v.banner, ...v.gallery]))) return NOT_YOURS;
  const profile: PartnerProfile = { ...v, facilities: [...new Set(v.facilities)] };
  await getDb().update(partners).set({ profile }).where(eq(partners.id, ctx.partner.id));
  const publicId = await syncPublicDealer(ctx.partner.id);
  await logPartnerActivity(ctx.partner.id, ctx.user.id, "update", "profile", ctx.partner.id, "Updated the public dealership profile");
  revalidatePath("/dealer", "layout");
  if (publicId) revalidatePath(`/dealers/${publicId}`);
  return { ok: true, publicId: publicId ?? null };
}

/* ── Change requests for verified details ───────────────────── */

const text = (max: number, label: string) => z.string().trim().min(2, `Enter the ${label}`).max(max);
const FIELD_RULES = {
  "business.legalName": text(200, "legal business name"),
  "business.tradeName": text(200, "trade name"),
  "business.businessType": z.enum(BUSINESS_TYPES, { error: "Choose a business type" }),
  "business.gst": z.string().trim().toUpperCase().regex(PATTERNS.gst, "Enter a valid 15-character GSTIN"),
  "business.pan": z.string().trim().toUpperCase().regex(PATTERNS.pan, "Enter a valid PAN, like ABCDE1234F"),
  "business.registrationNumber": text(60, "registration number"),
  "business.establishedOn": z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  "business.email": z.string().trim().toLowerCase().email("Enter a valid email address").max(190),
  "business.phone": z
    .string()
    .trim()
    .transform((v) => v.replace(/[^\d+]/g, ""))
    .refine((v) => /^\+?\d{10,13}$/.test(v), "Enter a valid phone number"),
  "business.website": url.refine((v) => v.length > 0, "Enter the website link"),
  "bank.holder": text(120, "account holder name"),
  "bank.bankName": text(120, "bank name"),
  "bank.accountNumber": z
    .string()
    .trim()
    .transform((v) => v.replace(/\s/g, ""))
    .refine((v) => PATTERNS.account.test(v), "Enter a 9–18 digit account number"),
  "bank.ifsc": z.string().trim().toUpperCase().regex(PATTERNS.ifsc, "Enter a valid IFSC, like HDFC0001234"),
  "bank.branch": text(120, "branch"),
} as const;
type ChangeField = keyof typeof FIELD_RULES;
const CHANGE_FIELDS = Object.keys(FIELD_RULES) as ChangeField[];

const requestSchema = z.object({
  changes: z.record(z.string(), z.string().max(300)),
  reason: z.string().trim().min(10, "Tell MarchGear why this is changing (at least 10 characters)").max(500),
});

/** Asks MarchGear to change verified business or bank details. Nothing changes until staff approve. */
export async function requestDetailsChangeAction(input: unknown): Promise<ActionResult<{ id: number }>> {
  const ctx = await partnerAction("profile.manage");
  if (isActionError(ctx)) return ctx;
  const parsed = requestSchema.safeParse(input);
  // Report a missing reason together with any invalid values, not one after the other.
  const reasonError = parsed.success ? null : invalid(parsed.error).fieldErrors ?? {};
  const changes = parsed.success ? parsed.data.changes : z.object({ changes: requestSchema.shape.changes }).safeParse(input).data?.changes;
  if (!changes) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: reasonError ?? {} };

  const db = getDb();
  const [pending] = await db
    .select({ id: partnerChangeRequests.id })
    .from(partnerChangeRequests)
    .where(and(eq(partnerChangeRequests.partnerId, ctx.partner.id), eq(partnerChangeRequests.status, "pending")))
    .limit(1);
  if (pending) return { ok: false, error: "You already have a change request waiting for review. Withdraw it first to send a different one." };

  const [p] = await db.select({ application: partners.application }).from(partners).where(eq(partners.id, ctx.partner.id));
  const app = p.application;
  const current = (f: ChangeField): string => {
    const [group, key] = f.split(".") as ["business" | "bank", string];
    const value = String((app[group] as Record<string, unknown>)[key] ?? "");
    return f === "bank.accountNumber" ? maskAccount(value) : value;
  };

  const fieldErrs: Record<string, string> = {};
  const fields: Record<string, { from: string; to: string }> = {};
  for (const [key, raw] of Object.entries(changes)) {
    if (!CHANGE_FIELDS.includes(key as ChangeField)) continue;
    const f = key as ChangeField;
    const res = FIELD_RULES[f].safeParse(raw);
    if (!res.success) {
      fieldErrs[f] = res.error.issues[0]?.message ?? "Check this value";
      continue;
    }
    const to = String(res.data);
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
  if (Object.keys(fieldErrs).length || reasonError)
    return { ok: false, error: "Please check the highlighted fields.", fieldErrors: { ...reasonError, ...Object.fromEntries(Object.entries(fieldErrs).map(([k, m]) => [`changes.${k}`, m])) } };
  if (!parsed.success) return invalid(parsed.error);
  if (!Object.keys(fields).length) return { ok: false, error: "Change at least one value before sending the request." };

  const [res] = await db.insert(partnerChangeRequests).values({ partnerId: ctx.partner.id, fields, requestedBy: ctx.user.id });
  const labels = Object.keys(fields).map((f) => FIELD_LABEL[f as ChangeField]);
  await recordApproval({ partnerId: ctx.partner.id, target: "profile_change", targetId: res.insertId, action: "submitted", toStatus: "pending", remarks: parsed.data.reason, actorUserId: ctx.user.id, actorSide: "dealer" });
  await notifyPartner(ctx.partner.id, {
    userId: ctx.user.id,
    kind: "profile_change",
    title: "Change request sent to MarchGear",
    body: `${ctx.user.name} asked to change ${labels.join(", ")}. We'll notify you when it's reviewed.`,
    href: "/dealer/profile?tab=business",
  });
  await logPartnerActivity(ctx.partner.id, ctx.user.id, "request", "profile_change", res.insertId, `Requested a change to ${labels.join(", ")}`);
  revalidatePath("/dealer", "layout");
  return { ok: true, id: res.insertId };
}

/** Withdraws a change request that MarchGear hasn't reviewed yet. */
export async function withdrawChangeRequestAction(id: unknown): Promise<ActionResult> {
  const ctx = await partnerAction("profile.manage");
  if (isActionError(ctx)) return ctx;
  const parsed = z.coerce.number().int().positive().safeParse(id);
  if (!parsed.success) return { ok: false, error: "That request couldn't be found." };
  const db = getDb();
  const where = and(eq(partnerChangeRequests.id, parsed.data), eq(partnerChangeRequests.partnerId, ctx.partner.id), eq(partnerChangeRequests.status, "pending"));
  const [row] = await db.select({ id: partnerChangeRequests.id }).from(partnerChangeRequests).where(where);
  if (!row) return { ok: false, error: "This request has already been reviewed or withdrawn." };
  await db.delete(partnerChangeRequests).where(where);
  await recordApproval({ partnerId: ctx.partner.id, target: "profile_change", targetId: row.id, action: "withdrawn", fromStatus: "pending", toStatus: "withdrawn", actorUserId: ctx.user.id, actorSide: "dealer" });
  await logPartnerActivity(ctx.partner.id, ctx.user.id, "withdraw", "profile_change", row.id, "Withdrew a business details change request");
  revalidatePath("/dealer", "layout");
  return { ok: true };
}

const FIELD_LABEL: Record<ChangeField, string> = {
  "business.legalName": "legal name",
  "business.tradeName": "trade name",
  "business.businessType": "business type",
  "business.gst": "GSTIN",
  "business.pan": "PAN",
  "business.registrationNumber": "registration number",
  "business.establishedOn": "date of establishment",
  "business.email": "business email",
  "business.phone": "business phone",
  "business.website": "website",
  "bank.holder": "account holder",
  "bank.bankName": "bank name",
  "bank.accountNumber": "account number",
  "bank.ifsc": "IFSC",
  "bank.branch": "bank branch",
};
