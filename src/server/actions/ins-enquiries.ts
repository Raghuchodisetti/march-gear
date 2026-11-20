"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { insCompanies, insEnquiries, insProducts, insRenewals } from "@/db/schema";
import { INS_LEAD_STATUS } from "@/db/enums";
import type { ActionResult } from "@/lib/action-result";
import { INS_LEAD_STATUS_LABEL, INS_PRODUCT_CATEGORY_LABEL } from "@/insurance/labels";
import { insurerAction, isInsurerError } from "@/server/insurance/context";
import { insReference, logInsurerActivity, notifyInsurer } from "@/server/insurance/records";
import { activeMember, addEnquiryEvent, enquiryAccess, enquiryInScope, istStart, setEnquiryStatus } from "@/server/insurance/crm";
import { isDuplicate } from "@/server/db-errors";
import { invalid, isoDate, optionalText, todayISO } from "@/server/validation";
import { formatIstDateTime, fromISTInput } from "@/components/portal/crm/pipeline";
import { istDate } from "@/components/portal/billing/shared";
import { CALL_OUTCOMES, INS_LEAD_FINISHED, policyExpiryFrom } from "@/components/insurance/vendor/crm/shared";

/* ──────────────────────────────────────────────────────────────
   Insurance vendor CRM: enquiry status, assignment, notes, contact
   log, reminders and the reported policy conversion. Every action
   checks the member's permission and that the enquiry belongs to
   their vendor (and to them, for "own" access). Every change
   writes an ins_enquiry_events row and the vendor activity log.
   ────────────────────────────────────────────────────────────── */

const enquiryId = z.number().int().positive();
const istDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose a date and time");
const NOT_FOUND = { ok: false as const, error: "That enquiry no longer exists or isn't assigned to you." };

const refresh = () => revalidatePath("/insurance-vendor", "layout");

async function actor(perm: Parameters<typeof insurerAction>[0]) {
  const ctx = await insurerAction(perm);
  if (isInsurerError(ctx)) return ctx;
  if (!enquiryAccess(ctx)) return { ok: false as const, error: "You don't have access to enquiries." };
  return ctx;
}

const touch = (id: number) => getDb().update(insEnquiries).set({ updatedAt: new Date() }).where(eq(insEnquiries.id, id));

/* ── Status ────────────────────────────────────────────────── */

const statusSchema = z
  .object({ id: enquiryId, status: z.enum(INS_LEAD_STATUS), lostReason: optionalText(200) })
  .refine((v) => v.status !== "lost" || Boolean(v.lostReason), { path: ["lostReason"], message: "Say why the enquiry was lost" })
  .refine((v) => v.status !== "policy_issued", { path: ["status"], message: "Use “Mark policy issued” to record the policy number and premium" });

export async function updateEnquiryStatusAction(input: unknown): Promise<ActionResult> {
  const ctx = await actor("enquiries.manage");
  if (isInsurerError(ctx)) return ctx;
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const lead = await enquiryInScope(ctx, parsed.data.id);
  if (!lead) return NOT_FOUND;
  if (lead.conversionVerifiedAt) return { ok: false, error: "MarchGear has verified this policy conversion, so its status is locked. Contact support if it's wrong." };
  if (await setEnquiryStatus(ctx, lead, parsed.data.status, { lostReason: parsed.data.lostReason })) {
    await logInsurerActivity(ctx.vendor.id, ctx.user.id, "status", "enquiry", lead.id, `${lead.reference}: ${INS_LEAD_STATUS_LABEL[parsed.data.status]}`);
    refresh();
  }
  return { ok: true };
}

/* ── Assignment ────────────────────────────────────────────── */

const assignSchema = z.object({ id: enquiryId, memberId: z.number().int().positive().nullable() });

export async function assignEnquiryAction(input: unknown): Promise<ActionResult> {
  const ctx = await actor("enquiries.assign");
  if (isInsurerError(ctx)) return ctx;
  if (enquiryAccess(ctx) !== "all") return { ok: false, error: "Only people who can see every enquiry can assign them." };
  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const lead = await enquiryInScope(ctx, parsed.data.id);
  if (!lead) return NOT_FOUND;
  const memberId = parsed.data.memberId;
  if (lead.assignedMemberId === memberId) return { ok: true };
  const m = memberId ? await activeMember(ctx.vendor.id, memberId) : null;
  if (memberId && !m) return { ok: false, fieldErrors: { memberId: "Choose an active member of your team" } };

  await getDb().update(insEnquiries).set({ assignedMemberId: memberId }).where(eq(insEnquiries.id, lead.id));
  await addEnquiryEvent(ctx, lead.id, "assign", m ? `Assigned to ${m.name}.` : "Unassigned.", { memberId });
  // A brand-new enquiry that now has an owner moves along.
  if (m && lead.status === "new") await setEnquiryStatus(ctx, lead, "assigned");
  if (m && m.id !== ctx.member.id)
    await notifyInsurer(ctx.vendor.id, {
      userId: m.userId,
      kind: "enquiry_assigned",
      title: `Enquiry assigned to you: ${lead.name}`,
      body: `${ctx.user.name} assigned ${lead.reference} to you.`,
      href: `/insurance-vendor/enquiries/${lead.id}`,
    });
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "assign", "enquiry", lead.id, `${lead.reference} ${m ? `assigned to ${m.name}` : "unassigned"}`);
  refresh();
  return { ok: true };
}

/* ── Notes, contact log, reminders ─────────────────────────── */

const noteSchema = z.object({ id: enquiryId, body: z.string().trim().min(2, "Write a note").max(2000) });

export async function addEnquiryNoteAction(input: unknown): Promise<ActionResult> {
  const ctx = await actor("enquiries.manage");
  if (isInsurerError(ctx)) return ctx;
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const lead = await enquiryInScope(ctx, parsed.data.id);
  if (!lead) return NOT_FOUND;
  await addEnquiryEvent(ctx, lead.id, "note", parsed.data.body);
  await touch(lead.id);
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "note", "enquiry", lead.id, `Note on ${lead.reference}`);
  refresh();
  return { ok: true };
}

const contactSchema = z.object({
  id: enquiryId,
  channel: z.enum(["call", "whatsapp", "email"]),
  outcome: z.enum(Object.keys(CALL_OUTCOMES) as [keyof typeof CALL_OUTCOMES, ...(keyof typeof CALL_OUTCOMES)[]]).optional(),
  durationMin: z.coerce.number().int().min(0).max(600).optional(),
  notes: optionalText(2000),
});

const CHANNEL_LABEL = { call: "Call", whatsapp: "WhatsApp", email: "Email" } as const;

/** A manual record of a call / WhatsApp / email (there's no telephony or messaging integration). */
export async function logEnquiryContactAction(input: unknown): Promise<ActionResult> {
  const ctx = await actor("enquiries.manage");
  if (isInsurerError(ctx)) return ctx;
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  if (d.channel === "call" && !d.outcome) return { ok: false, fieldErrors: { outcome: "Choose how the call went" } };
  if (d.channel !== "call" && !d.notes) return { ok: false, fieldErrors: { notes: "Summarise the conversation" } };
  const lead = await enquiryInScope(ctx, d.id);
  if (!lead) return NOT_FOUND;

  const body =
    d.channel === "call"
      ? `Call · ${CALL_OUTCOMES[d.outcome!]}${d.durationMin ? ` · ${d.durationMin} min` : ""}${d.notes ? `\n${d.notes}` : ""}`
      : `${CHANNEL_LABEL[d.channel]} conversation${d.notes ? `\n${d.notes}` : ""}`;
  await addEnquiryEvent(ctx, lead.id, d.channel, body, { outcome: d.outcome ?? null, durationMin: d.durationMin ?? null });
  // First real contact moves a new (or just-assigned) enquiry along.
  const reached = d.channel !== "call" || d.outcome === "connected" || d.outcome === "callback";
  if (reached && (lead.status === "new" || lead.status === "assigned")) await setEnquiryStatus(ctx, lead, "contacted");
  else await touch(lead.id);
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, d.channel, "enquiry", lead.id, `${CHANNEL_LABEL[d.channel]} logged on ${lead.reference}`);
  refresh();
  return { ok: true };
}

const linkSchema = z.object({ id: enquiryId, channel: z.enum(["call", "whatsapp", "email"]) });
const LINK_BODY = {
  call: "Opened the phone dialler from the portal (tel: link).",
  whatsapp: "Opened a WhatsApp chat from the portal (wa.me link).",
  email: "Opened an email from the portal (mailto: link).",
} as const;

/** Records that someone used the Call / WhatsApp / Email link (the conversation itself is logged separately). */
export async function recordEnquiryContactLinkAction(input: unknown): Promise<ActionResult> {
  const ctx = await actor("enquiries.manage");
  if (isInsurerError(ctx)) return ctx;
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const lead = await enquiryInScope(ctx, parsed.data.id);
  if (!lead) return NOT_FOUND;
  await addEnquiryEvent(ctx, lead.id, parsed.data.channel, LINK_BODY[parsed.data.channel], { via: "link" });
  await touch(lead.id);
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, `${parsed.data.channel}_link`, "enquiry", lead.id, `${CHANNEL_LABEL[parsed.data.channel]} link used on ${lead.reference}`);
  refresh();
  return { ok: true };
}

const reminderSchema = z.object({ id: enquiryId, at: z.union([z.literal(""), istDateTime]), note: optionalText(300) });

/** Sets (or clears, with an empty `at`) the follow-up reminder. */
export async function setEnquiryFollowUpAction(input: unknown): Promise<ActionResult> {
  const ctx = await actor("enquiries.manage");
  if (isInsurerError(ctx)) return ctx;
  const parsed = reminderSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const lead = await enquiryInScope(ctx, parsed.data.id);
  if (!lead) return NOT_FOUND;
  const at = parsed.data.at ? fromISTInput(parsed.data.at) : null;
  if (at && at.getTime() < Date.now() - 60_000) return { ok: false, fieldErrors: { at: "Pick a time in the future" } };
  if (at && at.getTime() > Date.now() + 366 * 86_400_000) return { ok: false, fieldErrors: { at: "Pick a time within the next year" } };
  if (at && INS_LEAD_FINISHED.includes(lead.status)) return { ok: false, fieldErrors: { at: "Reopen the enquiry before setting a reminder" } };
  await getDb().update(insEnquiries).set({ followUpAt: at }).where(eq(insEnquiries.id, lead.id));
  await addEnquiryEvent(ctx, lead.id, "reminder", at ? `Follow-up set for ${formatIstDateTime(at)}${parsed.data.note ? ` · ${parsed.data.note}` : ""}.` : "Follow-up reminder cleared.", {
    at: at?.toISOString() ?? null,
  });
  if (at && lead.status === "contacted") await setEnquiryStatus(ctx, lead, "follow_up");
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "reminder", "enquiry", lead.id, at ? `Follow-up on ${lead.reference} for ${formatIstDateTime(at)}` : `Cleared follow-up on ${lead.reference}`);
  refresh();
  return { ok: true };
}

/* ── Reported policy conversion ────────────────────────────── */

const policySchema = z.object({
  id: enquiryId,
  policyNumber: z
    .string()
    .trim()
    .min(4, "Enter the policy number")
    .max(60)
    .regex(/^[A-Za-z0-9][A-Za-z0-9/\-. ]*$/, "Use letters, numbers, / - and . only"),
  premium: z.coerce.number({ error: "Enter the premium" }).int("Use whole rupees").min(100, "Enter the total premium in rupees").max(10_000_000, "That premium looks too high"),
  issuedOn: isoDate,
});

/** The vendor reports that the customer bought the policy. MarchGear staff verify it separately. */
export async function markPolicyIssuedAction(input: unknown): Promise<ActionResult> {
  const ctx = await actor("enquiries.manage");
  if (isInsurerError(ctx)) return ctx;
  const parsed = policySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const lead = await enquiryInScope(ctx, d.id);
  if (!lead) return NOT_FOUND;
  if (lead.conversionVerifiedAt) return { ok: false, error: "MarchGear has already verified this conversion — it can't be changed." };
  const today = todayISO();
  if (d.issuedOn > today) return { ok: false, fieldErrors: { issuedOn: "The issue date can't be in the future" } };
  if (d.issuedOn < istDate(new Date(lead.createdAt.getTime() - 60 * 86_400_000))) return { ok: false, fieldErrors: { issuedOn: "The issue date is long before this enquiry arrived" } };

  const editing = lead.status === "policy_issued";
  await getDb()
    .update(insEnquiries)
    .set({ status: "policy_issued", policyNumber: d.policyNumber, policyPremium: d.premium, policyIssuedAt: istStart(d.issuedOn), followUpAt: null, lostReason: null })
    .where(eq(insEnquiries.id, lead.id));
  await addEnquiryEvent(
    ctx,
    lead.id,
    "policy",
    `${editing ? "Updated the reported policy" : "Policy issued — reported by your team"}\nPolicy ${d.policyNumber} · ₹${d.premium.toLocaleString("en-IN")} · issued ${d.issuedOn}. MarchGear verifies conversions.`,
    { policyNumber: d.policyNumber, premium: d.premium, issuedOn: d.issuedOn },
  );
  if (!editing)
    await addEnquiryEvent(ctx, lead.id, "status", `${INS_LEAD_STATUS_LABEL[lead.status]} → ${INS_LEAD_STATUS_LABEL.policy_issued}`, { from: lead.status, to: "policy_issued", reason: null });
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "policy_issued", "enquiry", lead.id, `${lead.reference}: policy ${d.policyNumber} reported (₹${d.premium.toLocaleString("en-IN")})`);
  refresh();
  return { ok: true };
}

/** Adds an issued policy to the renewal desk: expiry = issue date + 1 year − 1 day. */
export async function addEnquiryToRenewalsAction(input: unknown): Promise<ActionResult<{ renewalId: number }>> {
  const ctx = await actor("renewals.manage");
  if (isInsurerError(ctx)) return ctx;
  const parsed = z.object({ id: enquiryId }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const lead = await enquiryInScope(ctx, parsed.data.id);
  if (!lead) return NOT_FOUND;
  if (lead.status !== "policy_issued" || !lead.policyIssuedAt) return { ok: false, error: "Mark the policy as issued first." };
  const db = getDb();
  const [existing] = await db
    .select({ id: insRenewals.id, reference: insRenewals.reference })
    .from(insRenewals)
    .where(and(eq(insRenewals.vendorId, ctx.vendor.id), eq(insRenewals.enquiryId, lead.id), eq(insRenewals.source, "policy")));
  if (existing) return { ok: false, error: `This policy is already on the renewal desk (${existing.reference}).` };

  const [product] = lead.productId
    ? await db
        .select({ category: insProducts.category, company: insCompanies.name })
        .from(insProducts)
        .leftJoin(insCompanies, eq(insCompanies.id, insProducts.companyId))
        .where(and(eq(insProducts.id, lead.productId), eq(insProducts.vendorId, ctx.vendor.id)))
    : [];
  const expiryDate = policyExpiryFrom(istDate(lead.policyIssuedAt));
  let id = 0;
  let ref = "";
  for (let attempt = 0; attempt < 3 && !id; attempt++) {
    ref = insReference("REN");
    try {
      const [res] = await db.insert(insRenewals).values({
        reference: ref,
        vendorId: ctx.vendor.id,
        enquiryId: lead.id,
        name: lead.name,
        mobile: lead.mobile,
        email: lead.email,
        regNumber: lead.regNumber,
        brandName: lead.brandName,
        modelName: lead.modelName,
        variantName: lead.variantName,
        year: lead.year,
        fuel: lead.fuel,
        city: lead.city,
        currentInsurer: product?.company ?? null,
        policyNumber: lead.policyNumber,
        policyType: product ? INS_PRODUCT_CATEGORY_LABEL[product.category].slice(0, 40) : null,
        expiryDate,
        ncbPct: lead.ncbPct,
        premium: lead.policyPremium,
        status: "upcoming",
        assignedMemberId: lead.assignedMemberId,
        source: "policy",
        createdBy: ctx.user.id,
      });
      id = res.insertId;
    } catch (err) {
      if (!isDuplicate(err) || attempt === 2) throw err;
    }
  }
  await addEnquiryEvent(ctx, lead.id, "renewal", `Added to renewals as ${ref} · expires ${expiryDate}.`, { renewalId: id, expiryDate });
  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "create", "renewal", id, `Added ${lead.reference}'s policy to renewals (${ref}, expires ${expiryDate})`);
  refresh();
  return { ok: true, renewalId: id };
}
