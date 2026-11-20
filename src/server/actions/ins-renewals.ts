"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { insEnquiries, insRenewals } from "@/db/schema";
import { INS_RENEWAL_STATUS } from "@/db/enums";
import type { ActionResult } from "@/lib/action-result";
import { INS_RENEWAL_OPEN, INS_RENEWAL_STATUS_LABEL } from "@/insurance/labels";
import { NCB_OPTIONS, isValidReg, normaliseReg } from "@/insurance/search";
import { getCatalog } from "@/server/catalog";
import { insurerAction, isInsurerError, type InsurerContext } from "@/server/insurance/context";
import { insReference, logInsurerActivity, notifyInsurer } from "@/server/insurance/records";
import { activeMember, addEnquiryEvent, enquiryAccess, enquiryInScope, renewalInScope } from "@/server/insurance/crm";
import { matchCatalogVehicle } from "@/server/insurance/quote-builder";
import { isDuplicate } from "@/server/db-errors";
import { email, invalid, isoDate, mobile, name, optionalText, todayISO } from "@/server/validation";
import { formatIstDateTime, fromISTInput } from "@/components/portal/crm/pipeline";
import { addDays } from "@/components/portal/billing/shared";
import { RENEWAL_POLICY_TYPES, daysFrom } from "@/components/insurance/vendor/crm/shared";

/* ──────────────────────────────────────────────────────────────
   Renewal desk: add a renewal, change its status (renewed / lapsed
   / lost…), assign, remind, add notes, and prepare a quote (which
   creates a renewal enquiry when there isn't one). Own-only members
   work on the renewals assigned to them. History lives in the
   vendor activity log (entity "renewal") and, when linked, on the
   enquiry's timeline.
   ────────────────────────────────────────────────────────────── */

const id = z.number().int().positive();
const istDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose a date and time");
const NOT_FOUND = { ok: false as const, error: "That renewal no longer exists or isn't assigned to you." };
const refresh = () => revalidatePath("/insurance-vendor", "layout");

async function actor(perm: Parameters<typeof insurerAction>[0] = "renewals.manage") {
  const ctx = await insurerAction(perm);
  if (isInsurerError(ctx)) return ctx;
  if (perm !== "renewals.manage" && !ctx.can("renewals.manage")) return { ok: false as const, error: "You don't have permission to manage renewals." };
  return ctx;
}

const log = (ctx: InsurerContext, renewalId: number, action: string, summary: string) => logInsurerActivity(ctx.vendor.id, ctx.user.id, action, "renewal", renewalId, summary);

/** Mirrors a renewal change onto its enquiry's timeline, when it has one the person can see. */
async function onEnquiry(ctx: InsurerContext, renewal: typeof insRenewals.$inferSelect, body: string) {
  if (!renewal.enquiryId) return;
  const e = await enquiryInScope(ctx, renewal.enquiryId);
  if (e) await addEnquiryEvent(ctx, e.id, "renewal", `Renewal ${renewal.reference}: ${body}`, { renewalId: renewal.id });
}

/* ── Add a renewal ─────────────────────────────────────────── */

const createSchema = z.object({
  name,
  mobile,
  email: z.union([z.literal("").transform(() => undefined), email]).optional(),
  regNumber: z
    .string()
    .trim()
    .transform((v) => normaliseReg(v))
    .refine((v) => !v || isValidReg(v), "Enter a valid registration number, e.g. MH12AB1234"),
  brand: z.string().trim().min(1, "Choose the brand").max(80),
  model: z.string().trim().min(1, "Choose the model").max(120),
  variant: z.string().trim().max(120).optional().default(""),
  year: z.coerce.number({ error: "Choose the year" }).int().min(1990, "Choose the year").max(2100),
  city: z.string().trim().min(2, "Enter the city").max(64),
  currentInsurer: z.string().trim().min(2, "Enter the current insurer").max(160),
  policyNumber: optionalText(60),
  policyType: z.enum(RENEWAL_POLICY_TYPES, { error: "Choose the policy type" }),
  expiryDate: isoDate,
  ncbPct: z.coerce.number().int().refine((n) => (NCB_OPTIONS as readonly number[]).includes(n), "Choose an NCB slab"),
  premium: z.union([z.literal("").transform(() => undefined), z.coerce.number().int("Use whole rupees").min(100, "Enter the premium in rupees").max(10_000_000)]).optional(),
  assignedMemberId: z.union([z.literal("").transform(() => undefined), z.coerce.number().int().positive()]).optional(),
  followUpAt: z.union([z.literal("").transform(() => undefined), istDateTime]).optional(),
  notes: optionalText(2000),
});

export async function createRenewalAction(input: unknown): Promise<ActionResult<{ id: number; reference: string }>> {
  const ctx = await actor();
  if (isInsurerError(ctx)) return ctx;
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const today = todayISO();
  const fieldErrors: Record<string, string> = {};
  if (d.expiryDate < addDays(today, -90)) fieldErrors.expiryDate = "That policy expired over 90 days ago — treat it as a new policy";
  if (d.expiryDate > addDays(today, 366)) fieldErrors.expiryDate = "Choose an expiry within the next year";
  if (d.year > Number(today.slice(0, 4))) fieldErrors.year = "The year can't be in the future";
  const { getCar, brandName } = await getCatalog();
  const car = getCar(d.model);
  if (!car || car.brand !== d.brand) fieldErrors.model = "Choose the model from the list";
  const variant = car?.variants.find((v) => v.slug === d.variant);
  if (d.variant && !variant) fieldErrors.variant = "Choose the variant from the list";
  const followUpAt = d.followUpAt ? fromISTInput(d.followUpAt) : null;
  if (followUpAt && followUpAt.getTime() < Date.now() - 60_000) fieldErrors.followUpAt = "Pick a time in the future";
  // Without "assign" (or without access to everyone's work) the person adding it keeps it.
  let assignedMemberId: number | null = d.assignedMemberId ?? null;
  if (!ctx.can("enquiries.assign") || enquiryAccess(ctx) !== "all") assignedMemberId = ctx.member.id;
  if (assignedMemberId && assignedMemberId !== ctx.member.id && !(await activeMember(ctx.vendor.id, assignedMemberId))) fieldErrors.assignedMemberId = "Choose an active member of your team";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Please check the highlighted fields.", fieldErrors };

  const db = getDb();
  if (d.regNumber) {
    const [dupe] = await db
      .select({ reference: insRenewals.reference })
      .from(insRenewals)
      .where(and(eq(insRenewals.vendorId, ctx.vendor.id), eq(insRenewals.regNumber, d.regNumber), inArray(insRenewals.status, INS_RENEWAL_OPEN)));
    if (dupe) return { ok: false, fieldErrors: { regNumber: `This car already has an open renewal (${dupe.reference})` } };
  }

  let newId = 0;
  let reference = "";
  for (let attempt = 0; attempt < 3 && !newId; attempt++) {
    reference = insReference("REN");
    try {
      const [res] = await db.insert(insRenewals).values({
        reference,
        vendorId: ctx.vendor.id,
        name: d.name,
        mobile: d.mobile,
        email: d.email ?? null,
        regNumber: d.regNumber || null,
        brandName: brandName(d.brand),
        modelName: car!.name,
        variantName: variant?.name ?? null,
        year: d.year,
        fuel: variant?.fuel ?? (car!.fuelTypes.length === 1 ? car!.fuelTypes[0] : null),
        city: d.city,
        currentInsurer: d.currentInsurer,
        policyNumber: d.policyNumber ?? null,
        policyType: d.policyType,
        expiryDate: d.expiryDate,
        ncbPct: d.ncbPct,
        premium: d.premium ?? null,
        status: "upcoming",
        assignedMemberId,
        followUpAt,
        notes: d.notes ? `— ${ctx.user.name} · ${formatIstDateTime(new Date())}\n${d.notes}` : null,
        source: "manual",
        createdBy: ctx.user.id,
      });
      newId = res.insertId;
    } catch (err) {
      if (!isDuplicate(err) || attempt === 2) throw err;
    }
  }
  await log(ctx, newId, "create", `Added renewal ${reference} for ${d.name} (expires ${d.expiryDate})`);
  if (assignedMemberId && assignedMemberId !== ctx.member.id) {
    const m = await activeMember(ctx.vendor.id, assignedMemberId);
    if (m) await notifyInsurer(ctx.vendor.id, { userId: m.userId, kind: "renewal_assigned", title: `Renewal assigned to you: ${d.name}`, body: `${reference} · expires ${d.expiryDate}`, href: `/insurance-vendor/renewals?view=all&renewal=${newId}` });
  }
  refresh();
  return { ok: true, id: newId, reference };
}

/* ── Status ────────────────────────────────────────────────── */

const statusSchema = z
  .object({ id, status: z.enum(INS_RENEWAL_STATUS), reason: optionalText(200) })
  .refine((v) => v.status !== "lost" || Boolean(v.reason), { path: ["reason"], message: "Say why the renewal was lost" });

export async function updateRenewalStatusAction(input: unknown): Promise<ActionResult> {
  const ctx = await actor();
  if (isInsurerError(ctx)) return ctx;
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const r = await renewalInScope(ctx, parsed.data.id);
  if (!r) return NOT_FOUND;
  const { status, reason } = parsed.data;
  if (r.status === status) return { ok: true };
  if (status === "lapsed" && daysFrom(todayISO(), r.expiryDate) > 0) return { ok: false, fieldErrors: { status: "A policy can only lapse after its expiry date" } };
  const open = INS_RENEWAL_OPEN.includes(status);
  const line = `${INS_RENEWAL_STATUS_LABEL[r.status]} → ${INS_RENEWAL_STATUS_LABEL[status]}${reason ? ` · ${reason}` : ""}`;
  await getDb()
    .update(insRenewals)
    .set({
      status,
      renewedAt: status === "renewed" ? new Date() : null,
      ...(open ? {} : { followUpAt: null }),
      ...(reason ? { notes: `${r.notes ? `${r.notes}\n\n` : ""}— ${ctx.user.name} · ${formatIstDateTime(new Date())}\n${INS_RENEWAL_STATUS_LABEL[status]}: ${reason}` } : {}),
    })
    .where(eq(insRenewals.id, r.id));
  await log(ctx, r.id, "status", line);
  await onEnquiry(ctx, r, line);
  refresh();
  return { ok: true };
}

/* ── Assignment, reminder, notes ───────────────────────────── */

export async function assignRenewalAction(input: unknown): Promise<ActionResult> {
  const ctx = await actor("enquiries.assign");
  if (isInsurerError(ctx)) return ctx;
  if (enquiryAccess(ctx) !== "all") return { ok: false, error: "Only people who can see every enquiry can assign renewals." };
  const parsed = z.object({ id, memberId: z.number().int().positive().nullable() }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const r = await renewalInScope(ctx, parsed.data.id);
  if (!r) return NOT_FOUND;
  const memberId = parsed.data.memberId;
  if (r.assignedMemberId === memberId) return { ok: true };
  const m = memberId ? await activeMember(ctx.vendor.id, memberId) : null;
  if (memberId && !m) return { ok: false, fieldErrors: { memberId: "Choose an active member of your team" } };
  await getDb().update(insRenewals).set({ assignedMemberId: memberId }).where(eq(insRenewals.id, r.id));
  await log(ctx, r.id, "assign", m ? `Assigned to ${m.name}` : "Unassigned");
  if (m && m.id !== ctx.member.id)
    await notifyInsurer(ctx.vendor.id, { userId: m.userId, kind: "renewal_assigned", title: `Renewal assigned to you: ${r.name}`, body: `${r.reference} · expires ${r.expiryDate}`, href: `/insurance-vendor/renewals?view=all&renewal=${r.id}` });
  refresh();
  return { ok: true };
}

export async function setRenewalFollowUpAction(input: unknown): Promise<ActionResult> {
  const ctx = await actor();
  if (isInsurerError(ctx)) return ctx;
  const parsed = z.object({ id, at: z.union([z.literal(""), istDateTime]) }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const r = await renewalInScope(ctx, parsed.data.id);
  if (!r) return NOT_FOUND;
  const at = parsed.data.at ? fromISTInput(parsed.data.at) : null;
  if (at && at.getTime() < Date.now() - 60_000) return { ok: false, fieldErrors: { at: "Pick a time in the future" } };
  if (at && !INS_RENEWAL_OPEN.includes(r.status)) return { ok: false, fieldErrors: { at: "Reopen the renewal before setting a reminder" } };
  await getDb()
    .update(insRenewals)
    .set({ followUpAt: at, ...(at && r.status === "contacted" ? { status: "follow_up" as const } : {}) })
    .where(eq(insRenewals.id, r.id));
  await log(ctx, r.id, "reminder", at ? `Follow-up set for ${formatIstDateTime(at)}${r.status === "contacted" ? " · Contacted → Follow-up" : ""}` : "Follow-up cleared");
  refresh();
  return { ok: true };
}

export async function addRenewalNoteAction(input: unknown): Promise<ActionResult> {
  const ctx = await actor();
  if (isInsurerError(ctx)) return ctx;
  const parsed = z.object({ id, body: z.string().trim().min(2, "Write a note").max(2000) }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const r = await renewalInScope(ctx, parsed.data.id);
  if (!r) return NOT_FOUND;
  const notes = `${r.notes ? `${r.notes}\n\n` : ""}— ${ctx.user.name} · ${formatIstDateTime(new Date())}\n${parsed.data.body}`;
  if (notes.length > 60_000) return { ok: false, fieldErrors: { body: "This renewal has too many notes — summarise older ones first" } };
  await getDb().update(insRenewals).set({ notes }).where(eq(insRenewals.id, r.id));
  await log(ctx, r.id, "note", `Note added`);
  refresh();
  return { ok: true };
}

const CONTACT = { call: "Opened the phone dialler (tel: link)", whatsapp: "Opened a WhatsApp chat (wa.me link)", email: "Opened an email (mailto: link)" } as const;

/** Records that the Call / WhatsApp / Email link was used; a first contact moves "upcoming" to "contacted". */
export async function recordRenewalContactAction(input: unknown): Promise<ActionResult> {
  const ctx = await actor();
  if (isInsurerError(ctx)) return ctx;
  const parsed = z.object({ id, channel: z.enum(["call", "whatsapp", "email"]) }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const r = await renewalInScope(ctx, parsed.data.id);
  if (!r) return NOT_FOUND;
  await log(ctx, r.id, parsed.data.channel, CONTACT[parsed.data.channel]);
  refresh();
  return { ok: true };
}

/* ── Prepare a quote ───────────────────────────────────────── */

/**
 * The enquiry to quote against: the renewal's own, or a new renewal enquiry (source "renewal_desk").
 * The customer is the vendor's own policyholder, so consent is recorded as of now by the person preparing it.
 */
export async function prepareRenewalQuoteAction(input: unknown): Promise<ActionResult<{ enquiryId: number; created: boolean }>> {
  const ctx = await actor("quotes.manage");
  if (isInsurerError(ctx)) return ctx;
  const parsed = z.object({ id }).safeParse(input);
  if (!parsed.success) return NOT_FOUND;
  const r = await renewalInScope(ctx, parsed.data.id);
  if (!r) return NOT_FOUND;
  if (!INS_RENEWAL_OPEN.includes(r.status)) return { ok: false, error: `This renewal is ${INS_RENEWAL_STATUS_LABEL[r.status].toLowerCase()} — reopen it before quoting.` };
  const db = getDb();

  if (r.enquiryId) {
    const e = await enquiryInScope(ctx, r.enquiryId);
    if (e && e.status !== "policy_issued" && e.status !== "closed") return { ok: true, enquiryId: e.id, created: false };
  }

  const today = todayISO();
  const days = daysFrom(today, r.expiryDate);
  const car = await matchCatalogVehicle({ brandName: r.brandName, modelName: r.modelName, variantName: r.variantName });
  const assignedMemberId = r.assignedMemberId ?? ctx.member.id;
  let enquiryId = 0;
  let reference = "";
  for (let attempt = 0; attempt < 3 && !enquiryId; attempt++) {
    reference = insReference("ENQ");
    try {
      const [res] = await db.insert(insEnquiries).values({
        reference,
        vendorId: ctx.vendor.id,
        intent: "renewal",
        name: r.name,
        mobile: r.mobile,
        email: r.email,
        regNumber: r.regNumber,
        vehicleIsNew: false,
        brand: car.brand || null,
        brandName: r.brandName,
        model: car.model || null,
        modelName: r.modelName,
        variant: car.variant || null,
        variantName: r.variantName,
        year: r.year,
        fuel: r.fuel,
        city: r.city,
        policyStatus: days >= 0 ? "active" : days >= -90 ? "expired_recent" : "expired_long",
        policyExpiry: r.expiryDate,
        previousInsurer: r.currentInsurer,
        ncbPct: r.ncbPct,
        addOns: [],
        status: "assigned",
        assignedMemberId,
        source: "renewal_desk",
        consentAt: new Date(),
      });
      enquiryId = res.insertId;
    } catch (err) {
      if (!isDuplicate(err) || attempt === 2) throw err;
    }
  }
  await addEnquiryEvent(
    ctx,
    enquiryId,
    "created",
    `Created from renewal ${r.reference} by ${ctx.user.name}\nThe customer is your own policyholder (policy ${r.policyNumber ?? "—"} with ${r.currentInsurer ?? "their insurer"}); consent to contact recorded as of now.`,
    { renewalId: r.id, source: "renewal_desk" },
  );
  await db.update(insRenewals).set({ enquiryId }).where(eq(insRenewals.id, r.id));
  await log(ctx, r.id, "quote", `Created renewal enquiry ${reference} to prepare a quote`);
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "create", "enquiry", enquiryId, `Renewal enquiry ${reference} from ${r.reference}`);
  refresh();
  return { ok: true, enquiryId, created: true };
}
