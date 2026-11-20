"use server";

import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { partnerInvoices, partnerPayments, partners } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { formatDate } from "@/lib/format";
import { PLAN_IDS, addDays, istDate, rupees } from "@/components/portal/billing/shared";
import { audit } from "@/server/audit";
import { requireStaff } from "@/server/auth";
import { getPlans, insertInvoice, planNameOf } from "@/server/partner/billing";
import { logPartnerActivity, notifyPartner, recordApproval } from "@/server/partner/records";
import { invalid, isoDate } from "@/server/validation";

/* MarchGear staff: verify or reject dealer payments, issue and void invoices (/admin/partner-billing). */

const id = z.coerce.number().int().positive();
/** A real calendar day ("2026-02-31" is refused rather than rolled over). */
const realDay = (v: unknown): v is string => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const t = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === v;
};
const day = isoDate.refine(realDay, "Choose a valid date");

async function loadPayment(paymentId: number) {
  const [row] = await getDb()
    .select({ payment: partnerPayments, invoice: partnerInvoices })
    .from(partnerPayments)
    .innerJoin(partnerInvoices, eq(partnerInvoices.id, partnerPayments.invoiceId))
    .where(eq(partnerPayments.id, paymentId));
  return row ?? null;
}

/** Payment checked against the bank statement → invoice paid, plan active until the period's end. */
export async function verifyPaymentAction(paymentId: unknown, input: unknown): Promise<ActionResult<{ renewsAt: string }>> {
  const me = await requireStaff();
  const pid = id.safeParse(paymentId);
  const parsed = z.object({ remarks: z.string().trim().max(500, "Keep remarks under 500 characters").optional() }).safeParse(input ?? {});
  if (!pid.success) return { ok: false, error: "Payment not found." };
  if (!parsed.success) return invalid(parsed.error);
  const row = await loadPayment(pid.data);
  if (!row) return { ok: false, error: "Payment not found." };
  const { payment, invoice } = row;
  if (payment.status !== "submitted") return { ok: false, error: `This payment has already been ${payment.status}.` };
  if (invoice.status === "void") return { ok: false, error: "That invoice was voided — reject this payment instead and explain why." };

  const today = istDate();
  const plans = await getPlans();
  const result = await getDb().transaction(async (tx) => {
    const [p] = await tx.select().from(partners).where(eq(partners.id, payment.partnerId)).for("update");
    if (!p) return null;
    const [res] = await tx
      .update(partnerPayments)
      .set({ status: "verified", remarks: parsed.data.remarks || null })
      .where(and(eq(partnerPayments.id, payment.id), eq(partnerPayments.status, "submitted")));
    if (!res.affectedRows) return null;
    await tx.update(partnerInvoices).set({ status: "paid", paidAt: new Date() }).where(eq(partnerInvoices.id, invoice.id));
    const next = addDays(invoice.periodEnd, 1);
    const renewsAt = p.planRenewsAt && p.planRenewsAt > next ? p.planRenewsAt : next;
    const startsNow = invoice.periodStart <= today;
    const plan = startsNow ? invoice.plan : p.plan;
    await tx
      .update(partners)
      .set({ plan, planStatus: renewsAt > today ? "active" : "past_due", planRenewsAt: renewsAt })
      .where(eq(partners.id, p.id));
    return { renewsAt, plan, changed: plan !== p.plan, startsNow };
  });
  if (!result) return { ok: false, error: "This payment changed in the meantime. Refresh and try again." };

  const planName = planNameOf(plans, invoice.plan);
  const until = formatDate(addDays(result.renewsAt, -1));
  const summary = result.startsNow
    ? `${planName} plan active until ${until}`
    : `${planName} plan starts ${formatDate(invoice.periodStart)}, paid until ${until}`;
  await recordApproval({ partnerId: payment.partnerId, target: "payment", targetId: payment.id, action: "verified", fromStatus: "submitted", toStatus: "verified", remarks: parsed.data.remarks || `Invoice ${invoice.number} paid — ${summary}`, actorUserId: me.id, actorSide: "admin" });
  await logPartnerActivity(payment.partnerId, me.id, "payment_ok", "subscription", invoice.number, `Payment verified by MarchGear for ${invoice.number} — ${summary}`);
  await notifyPartner(payment.partnerId, {
    kind: "billing",
    title: `Payment verified — invoice ${invoice.number} is paid`,
    body: `We received ${rupees(payment.amount)} (ref ${payment.utr}). ${summary}.${parsed.data.remarks ? ` ${parsed.data.remarks}` : ""}`,
    href: `/dealer/invoices/${invoice.id}`,
  });
  await audit(me.id, "status", "partner_payment", payment.id, `Verified ${rupees(payment.amount)} (ref ${payment.utr}) for invoice ${invoice.number} — ${summary}`);
  return { ok: true, renewsAt: result.renewsAt };
}

/** Payment couldn't be matched → rejected with remarks; the invoice is payable again. */
export async function rejectPaymentAction(paymentId: unknown, input: unknown): Promise<ActionResult> {
  const me = await requireStaff();
  const pid = id.safeParse(paymentId);
  const parsed = z
    .object({ remarks: z.string({ error: "Tell the dealer why" }).trim().min(5, "Tell the dealer why (at least 5 characters)").max(500, "Keep remarks under 500 characters") })
    .safeParse(input);
  if (!pid.success) return { ok: false, error: "Payment not found." };
  if (!parsed.success) return invalid(parsed.error);
  const row = await loadPayment(pid.data);
  if (!row) return { ok: false, error: "Payment not found." };
  const { payment, invoice } = row;
  if (payment.status !== "submitted") return { ok: false, error: `This payment has already been ${payment.status}.` };

  const ok = await getDb().transaction(async (tx) => {
    const [res] = await tx
      .update(partnerPayments)
      .set({ status: "rejected", remarks: parsed.data.remarks })
      .where(and(eq(partnerPayments.id, payment.id), eq(partnerPayments.status, "submitted")));
    if (!res.affectedRows) return false;
    const [other] = await tx
      .select({ id: partnerPayments.id })
      .from(partnerPayments)
      .where(and(eq(partnerPayments.invoiceId, invoice.id), eq(partnerPayments.status, "submitted"), ne(partnerPayments.id, payment.id)))
      .limit(1);
    if (!other) await tx.update(partnerInvoices).set({ status: "due" }).where(and(eq(partnerInvoices.id, invoice.id), eq(partnerInvoices.status, "verifying")));
    return true;
  });
  if (!ok) return { ok: false, error: "This payment changed in the meantime. Refresh and try again." };

  await recordApproval({ partnerId: payment.partnerId, target: "payment", targetId: payment.id, action: "rejected", fromStatus: "submitted", toStatus: "rejected", remarks: parsed.data.remarks, actorUserId: me.id, actorSide: "admin" });
  await logPartnerActivity(payment.partnerId, me.id, "payment_rejected", "invoice", invoice.number, `Payment ref ${payment.utr} for ${invoice.number} was not verified: ${parsed.data.remarks}`);
  await notifyPartner(payment.partnerId, {
    kind: "billing",
    title: `Payment for invoice ${invoice.number} couldn't be verified`,
    body: `Ref ${payment.utr}: ${parsed.data.remarks} Please check and record the payment again.`,
    href: `/dealer/invoices/${invoice.id}`,
  });
  await audit(me.id, "status", "partner_payment", payment.id, `Rejected payment ref ${payment.utr} for invoice ${invoice.number}: ${parsed.data.remarks}`);
  return { ok: true };
}

const issueSchema = z
  .object({
    partnerId: z.coerce.number({ error: "Choose a dealer" }).int().positive("Choose a dealer"),
    plan: z.enum(PLAN_IDS, { error: "Choose a plan" }),
    periodStart: day,
    periodEnd: day,
    amount: z.coerce.number({ error: "Enter the amount before GST" }).int("Whole rupees only").min(1, "Enter the amount before GST").max(10_000_000),
    dueOn: day,
  })
  // Zod runs these even when a date above failed, so only compare real dates.
  .refine((v) => !realDay(v.periodStart) || !realDay(v.periodEnd) || v.periodEnd >= v.periodStart, { path: ["periodEnd"], message: "The period must end on or after it starts" })
  .refine((v) => !realDay(v.periodStart) || !realDay(v.periodEnd) || v.periodEnd <= addDays(v.periodStart, 366), { path: ["periodEnd"], message: "Keep the period to a year or less" });

export async function issueInvoiceAction(input: unknown): Promise<ActionResult<{ id: number; number: string }>> {
  const me = await requireStaff();
  const parsed = issueSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  if (d.dueOn < istDate()) return { ok: false, fieldErrors: { dueOn: "The due date can't be in the past" } };
  const [p] = await getDb().select({ id: partners.id, status: partners.status, name: partners.tradeName, legal: partners.legalName, reference: partners.reference }).from(partners).where(eq(partners.id, d.partnerId));
  if (!p) return { ok: false, fieldErrors: { partnerId: "Choose a dealer" } };
  if (p.status !== "approved") return { ok: false, fieldErrors: { partnerId: "Invoices can only be issued to approved dealers" } };

  const plans = await getPlans();
  const inv = await insertInvoice(getDb(), { partnerId: p.id, plan: d.plan, periodStart: d.periodStart, periodEnd: d.periodEnd, amount: d.amount, dueOn: d.dueOn });
  const label = `${planNameOf(plans, d.plan)} plan, ${formatDate(d.periodStart)} – ${formatDate(d.periodEnd)}`;
  await notifyPartner(p.id, { kind: "billing", title: `New invoice ${inv.number} from MarchGear`, body: `${label}. Total ${rupees(inv.total)} incl. 18% GST, due ${formatDate(d.dueOn)}.`, href: `/dealer/invoices/${inv.id}` });
  await logPartnerActivity(p.id, me.id, "invoice", "subscription", inv.number, `Invoice ${inv.number} issued by MarchGear — ${label}`);
  await audit(me.id, "create", "partner_invoice", inv.id, `Issued invoice ${inv.number} to ${p.name || p.legal || p.reference}: ${label}, ${rupees(inv.total)}`);
  return { ok: true, id: inv.id, number: inv.number };
}

export async function voidInvoiceAction(invoiceId: unknown, input: unknown): Promise<ActionResult> {
  const me = await requireStaff();
  const iid = id.safeParse(invoiceId);
  const parsed = z.object({ reason: z.string({ error: "Give a reason" }).trim().min(5, "Give a reason (at least 5 characters)").max(300) }).safeParse(input);
  if (!iid.success) return { ok: false, error: "Invoice not found." };
  if (!parsed.success) return invalid(parsed.error);
  const db = getDb();
  const [inv] = await db.select().from(partnerInvoices).where(eq(partnerInvoices.id, iid.data));
  if (!inv) return { ok: false, error: "Invoice not found." };
  if (inv.status !== "due") return { ok: false, error: inv.status === "verifying" ? "A payment is being verified — verify or reject it first." : `This invoice is already ${inv.status}.` };
  const [res] = await db.update(partnerInvoices).set({ status: "void" }).where(and(eq(partnerInvoices.id, inv.id), eq(partnerInvoices.status, "due")));
  if (!res.affectedRows) return { ok: false, error: "This invoice changed in the meantime. Refresh and try again." };
  await notifyPartner(inv.partnerId, { kind: "billing", title: `Invoice ${inv.number} was cancelled`, body: `${parsed.data.reason} No payment is needed for this invoice.`, href: `/dealer/invoices/${inv.id}` });
  await logPartnerActivity(inv.partnerId, me.id, "invoice_void", "subscription", inv.number, `Invoice ${inv.number} voided by MarchGear: ${parsed.data.reason}`);
  await audit(me.id, "status", "partner_invoice", inv.id, `Voided invoice ${inv.number}: ${parsed.data.reason}`);
  return { ok: true };
}
