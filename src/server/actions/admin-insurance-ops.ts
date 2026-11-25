"use server";

import { z } from "zod";
import { and, eq, inArray, isNotNull, isNull, like, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { insCampaigns, insEnquiries, insEnquiryEvents, insInvoices, insQuotes, insVendors } from "@/db/schema";
import type { InsCampaignStatus } from "@/db/enums";
import type { ActionResult } from "@/lib/action-result";
import { INS_CAMPAIGN_STATUS_LABEL, INS_QUOTE_STATUS_LABEL } from "@/insurance/labels";
import { audit } from "@/server/audit";
import { requireStaff } from "@/server/auth";
import { getCatalog } from "@/server/catalog";
import { insertInsInvoice } from "@/server/insurance/billing";
import { notifyInsurer, recordInsApproval } from "@/server/insurance/records";
import { invalid } from "@/server/validation";
import { addDays, istDate, rupees } from "@/components/portal/billing/shared";

/* ──────────────────────────────────────────────────────────────
   MarchGear staff: verify vendor-reported policy conversions,
   withdraw non-compliant quotes and decide promotional campaigns
   (/admin/insurance/{enquiries,quotes,campaigns}). Every change is
   audited; workflow steps also go to the vendor's approval history.
   ────────────────────────────────────────────────────────────── */

const id = z.coerce.number().int().positive();
const remarksOptional = z.object({ remarks: z.string().trim().max(500, "Keep remarks under 500 characters").optional() });
const remarksRequired = (what: string) =>
  z.object({
    remarks: z.string({ error: `Tell the vendor ${what}` }).trim().min(5, `Tell the vendor ${what} (at least 5 characters)`).max(500, "Keep remarks under 500 characters"),
  });
const CHANGED = "This record changed in the meantime. Refresh and try again.";
const campaignLabel = (s: InsCampaignStatus) => (s === "approved" ? "Approved" : INS_CAMPAIGN_STATUS_LABEL[s]);
const like_ = (s: string) => `%${s.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;

/* ── Policy conversions ─────────────────────────────────────── */

/**
 * Staff checked the vendor's evidence for a reported policy. Raises the lead-fee invoice when lead fees are
 * enabled — never twice for the same enquiry (an open or paid lead-fee invoice naming it blocks another).
 */
export async function verifyConversionAction(enquiryId: unknown, input: unknown): Promise<ActionResult<{ invoice: { id: number; number: string; total: number } | null }>> {
  const me = await requireStaff("insurance");
  const eid = id.safeParse(enquiryId);
  const parsed = remarksOptional.safeParse(input ?? {});
  if (!eid.success) return { ok: false, error: "Enquiry not found." };
  if (!parsed.success) return invalid(parsed.error);
  const db = getDb();
  const [e] = await db.select().from(insEnquiries).where(eq(insEnquiries.id, eid.data));
  if (!e) return { ok: false, error: "Enquiry not found." };
  if (e.conversionVerifiedAt) return { ok: false, error: "This conversion is already verified." };
  if (e.status !== "policy_issued") return { ok: false, error: "The vendor hasn't reported a policy for this enquiry." };
  if (!e.policyNumber?.trim()) return { ok: false, error: "The vendor reported the policy without a policy number. Ask them to add it before you verify." };

  const [res] = await db
    .update(insEnquiries)
    .set({ conversionVerifiedAt: new Date(), conversionVerifiedBy: me.id })
    .where(and(eq(insEnquiries.id, e.id), isNull(insEnquiries.conversionVerifiedAt), eq(insEnquiries.status, "policy_issued")));
  if (!res.affectedRows) return { ok: false, error: CHANGED };

  const remarks = parsed.data.remarks || null;
  await recordInsApproval({ vendorId: e.vendorId, target: "conversion", targetId: e.id, action: "verified", fromStatus: "reported", toStatus: "verified", remarks: remarks ?? `Policy ${e.policyNumber} checked and verified by MarchGear.`, actorUserId: me.id, actorSide: "admin" });
  await db.insert(insEnquiryEvents).values({ enquiryId: e.id, vendorId: e.vendorId, userId: me.id, kind: "policy", body: `MarchGear verified the policy conversion (policy ${e.policyNumber}).${remarks ? ` ${remarks}` : ""}`, meta: { verified: true } });

  // Lead fee, where enabled (and only once per enquiry).
  const settings = (await getCatalog()).content.insuranceSettings;
  let invoice: { id: number; number: string; total: number } | null = null;
  if (settings.leadFeeEnabled && settings.leadFeeAmount > 0) {
    const [existing] = await db
      .select({ id: insInvoices.id })
      .from(insInvoices)
      .where(and(eq(insInvoices.vendorId, e.vendorId), eq(insInvoices.kind, "lead_fee"), ne(insInvoices.status, "void"), like(insInvoices.description, like_(e.reference))))
      .limit(1);
    if (!existing) {
      const today = istDate();
      const day = istDate(e.policyIssuedAt ?? new Date());
      const inv = await insertInsInvoice({
        vendorId: e.vendorId,
        kind: "lead_fee",
        description: `Lead fee — verified policy conversion, enquiry ${e.reference} (policy ${e.policyNumber})`,
        periodStart: day,
        periodEnd: day,
        amount: settings.leadFeeAmount,
        dueOn: addDays(today, settings.paymentTermsDays),
      });
      invoice = { id: inv.id, number: inv.number, total: inv.total };
      await notifyInsurer(e.vendorId, {
        kind: "billing",
        title: `New invoice ${inv.number} — lead fee`,
        body: `Lead fee for the verified policy on enquiry ${e.reference}: ${rupees(inv.total)} incl. 18% GST, due ${addDays(today, settings.paymentTermsDays)}.`,
        href: `/insurance-vendor/invoices/${inv.id}`,
      });
      await audit(me.id, "create", "ins_invoice", inv.id, `Raised lead-fee invoice ${inv.number} (${rupees(inv.total)}) for verified conversion ${e.reference}`);
    }
  }

  await notifyInsurer(e.vendorId, {
    kind: "conversion",
    title: `Policy conversion verified — ${e.reference}`,
    body: `MarchGear verified policy ${e.policyNumber} for ${e.name}.${remarks ? ` ${remarks}` : ""}`,
    href: `/insurance-vendor/enquiries/${e.id}`,
  });
  await audit(me.id, "status", "ins_enquiry", e.id, `Verified policy conversion for ${e.reference} (policy ${e.policyNumber})${invoice ? ` — lead fee ${invoice.number}` : ""}`);
  return { ok: true, invoice };
}

/** Takes a verification back (e.g. the policy was cancelled or the evidence was wrong). */
export async function unverifyConversionAction(enquiryId: unknown, input: unknown): Promise<ActionResult<{ openLeadFee: { id: number; number: string } | null }>> {
  const me = await requireStaff("insurance");
  const eid = id.safeParse(enquiryId);
  const parsed = z
    .object({ reason: z.string({ error: "Give a reason" }).trim().min(5, "Give a reason (at least 5 characters)").max(500, "Keep the reason under 500 characters") })
    .safeParse(input);
  if (!eid.success) return { ok: false, error: "Enquiry not found." };
  if (!parsed.success) return invalid(parsed.error);
  const db = getDb();
  const [e] = await db.select().from(insEnquiries).where(eq(insEnquiries.id, eid.data));
  if (!e) return { ok: false, error: "Enquiry not found." };
  if (!e.conversionVerifiedAt) return { ok: false, error: "This conversion isn't verified." };
  const [res] = await db.update(insEnquiries).set({ conversionVerifiedAt: null, conversionVerifiedBy: null }).where(and(eq(insEnquiries.id, e.id), isNotNull(insEnquiries.conversionVerifiedAt)));
  if (!res.affectedRows) return { ok: false, error: CHANGED };

  const reason = parsed.data.reason;
  await recordInsApproval({ vendorId: e.vendorId, target: "conversion", targetId: e.id, action: "unverified", fromStatus: "verified", toStatus: "reported", remarks: reason, actorUserId: me.id, actorSide: "admin" });
  await db.insert(insEnquiryEvents).values({ enquiryId: e.id, vendorId: e.vendorId, userId: me.id, kind: "policy", body: `MarchGear withdrew its verification of this policy: ${reason}`, meta: { verified: false } });
  const [openFee] = await db
    .select({ id: insInvoices.id, number: insInvoices.number })
    .from(insInvoices)
    .where(and(eq(insInvoices.vendorId, e.vendorId), eq(insInvoices.kind, "lead_fee"), inArray(insInvoices.status, ["due", "verifying"]), like(insInvoices.description, like_(e.reference))))
    .limit(1);
  await notifyInsurer(e.vendorId, {
    kind: "conversion",
    title: `Policy verification withdrawn — ${e.reference}`,
    body: reason,
    href: `/insurance-vendor/enquiries/${e.id}`,
  });
  await audit(me.id, "status", "ins_enquiry", e.id, `Withdrew conversion verification for ${e.reference}: ${reason}`);
  return { ok: true, openLeadFee: openFee ?? null };
}

/* ── Quotes ─────────────────────────────────────────────────── */

/** Compliance withdrawal: the customer's link stops offering the quote; the vendor is told why. */
export async function withdrawQuoteAction(quoteId: unknown, input: unknown): Promise<ActionResult> {
  const me = await requireStaff("insurance");
  const qid = id.safeParse(quoteId);
  const parsed = remarksRequired("why it was withdrawn").safeParse(input);
  if (!qid.success) return { ok: false, error: "Quote not found." };
  if (!parsed.success) return invalid(parsed.error);
  const db = getDb();
  const [q] = await db.select().from(insQuotes).where(eq(insQuotes.id, qid.data));
  if (!q) return { ok: false, error: "Quote not found." };
  if (q.status === "withdrawn") return { ok: false, error: "This quote is already withdrawn." };
  if (q.status === "declined") return { ok: false, error: "The customer already declined this quote." };
  const [res] = await db.update(insQuotes).set({ status: "withdrawn" }).where(and(eq(insQuotes.id, q.id), eq(insQuotes.status, q.status)));
  if (!res.affectedRows) return { ok: false, error: CHANGED };

  const remarks = parsed.data.remarks;
  await db.insert(insEnquiryEvents).values({ enquiryId: q.enquiryId, vendorId: q.vendorId, userId: me.id, kind: "quote", body: `Quote ${q.reference} withdrawn by MarchGear (compliance): ${remarks}`, meta: { quoteId: q.id, withdrawnBy: "admin" } });
  await notifyInsurer(q.vendorId, {
    kind: "quote",
    title: `Quote ${q.reference} was withdrawn by MarchGear`,
    body: remarks,
    href: `/insurance-vendor/enquiries/${q.enquiryId}`,
  });
  await audit(me.id, "status", "ins_quote", q.id, `Withdrew quote ${q.reference} (was ${INS_QUOTE_STATUS_LABEL[q.status]}): ${remarks}`);
  return { ok: true };
}

/* ── Promotional campaigns ──────────────────────────────────── */

const DECISIONS = {
  approve: { from: ["pending_approval"], to: "approved", action: "approved", remarks: false },
  changes: { from: ["pending_approval"], to: "changes_requested", action: "changes_requested", remarks: true },
  reject: { from: ["pending_approval", "changes_requested"], to: "rejected", action: "rejected", remarks: true },
  pause: { from: ["approved"], to: "paused", action: "paused", remarks: false },
  resume: { from: ["paused"], to: "approved", action: "resumed", remarks: false },
  cancel: { from: ["pending_approval", "changes_requested", "approved", "paused"], to: "cancelled", action: "cancelled", remarks: true },
} as const satisfies Record<string, { from: readonly InsCampaignStatus[]; to: InsCampaignStatus; action: string; remarks: boolean }>;
export type CampaignDecision = keyof typeof DECISIONS;

const TITLE: Record<CampaignDecision, (t: string) => string> = {
  approve: (t) => `Campaign approved — “${t}”`,
  changes: (t) => `Changes requested on campaign “${t}”`,
  reject: (t) => `Campaign not approved — “${t}”`,
  pause: (t) => `Campaign paused by MarchGear — “${t}”`,
  resume: (t) => `Campaign resumed — “${t}”`,
  cancel: (t) => `Campaign cancelled by MarchGear — “${t}”`,
};

export async function campaignDecisionAction(campaignId: unknown, input: unknown): Promise<ActionResult<{ status: InsCampaignStatus }>> {
  const me = await requireStaff("insurance");
  const cid = id.safeParse(campaignId);
  const parsed = z
    .object({
      decision: z.enum(Object.keys(DECISIONS) as [CampaignDecision, ...CampaignDecision[]], { error: "Choose a decision" }),
      remarks: z.string().trim().max(1000, "Keep remarks under 1,000 characters").optional(),
    })
    .safeParse(input);
  if (!cid.success) return { ok: false, error: "Campaign not found." };
  if (!parsed.success) return invalid(parsed.error);
  const { decision } = parsed.data;
  const rule = DECISIONS[decision];
  const remarks = parsed.data.remarks?.trim() || null;
  if (rule.remarks && (!remarks || remarks.length < 5)) return { ok: false, fieldErrors: { remarks: "Tell the vendor why (at least 5 characters)" } };

  const db = getDb();
  const [row] = await db.select({ c: insCampaigns, vendorStatus: insVendors.status }).from(insCampaigns).innerJoin(insVendors, eq(insVendors.id, insCampaigns.vendorId)).where(eq(insCampaigns.id, cid.data));
  if (!row) return { ok: false, error: "Campaign not found." };
  const c = row.c;
  if (!(rule.from as readonly InsCampaignStatus[]).includes(c.status)) return { ok: false, error: `A ${campaignLabel(c.status).toLowerCase()} campaign can't be ${decision === "changes" ? "sent back for changes" : `${rule.action.replace(/_/g, " ")}`}.` };
  const now = new Date();
  if ((decision === "approve" || decision === "resume") && c.endsAt < now) return { ok: false, error: "This campaign's end date has passed. Ask the vendor to change the dates and resubmit." };
  if (decision === "approve" && row.vendorStatus !== "approved") return { ok: false, error: "The vendor's account isn't approved, so the campaign couldn't go live. Review the vendor first." };

  const [res] = await db
    .update(insCampaigns)
    .set({
      status: rule.to,
      adminRemarks: decision === "resume" || decision === "pause" ? (remarks ?? c.adminRemarks) : remarks,
      decidedBy: me.id,
      ...(decision === "approve" ? { approvedAt: now } : {}),
    })
    .where(and(eq(insCampaigns.id, c.id), eq(insCampaigns.status, c.status)));
  if (!res.affectedRows) return { ok: false, error: CHANGED };

  await recordInsApproval({ vendorId: c.vendorId, target: "campaign", targetId: c.id, action: rule.action, fromStatus: c.status, toStatus: rule.to, remarks, actorUserId: me.id, actorSide: "admin" });
  await notifyInsurer(c.vendorId, {
    kind: "campaign",
    title: TITLE[decision](c.title),
    body:
      remarks ??
      (decision === "approve"
        ? c.startsAt > now
          ? `It goes live on the insurance pages on ${istDate(c.startsAt)}.`
          : "It's live on the insurance pages now."
        : decision === "resume"
          ? "It's showing on the insurance pages again."
          : "It's no longer showing on the insurance pages."),
    href: `/insurance-vendor/campaigns/${c.id}`,
  });
  await audit(me.id, "status", "ins_campaign", c.id, `Campaign ${c.reference} “${c.title}”: ${campaignLabel(c.status)} → ${campaignLabel(rule.to)}${remarks ? ` — ${remarks}` : ""}`);
  return { ok: true, status: rule.to };
}
