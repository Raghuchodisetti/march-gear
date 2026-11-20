"use server";

import { z } from "zod";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { insInvoices, insPayments, insRefunds, insVendors } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { formatDate } from "@/lib/format";
import { INS_INVOICE_KIND_LABEL } from "@/insurance/labels";
import { audit } from "@/server/audit";
import { requireStaff } from "@/server/auth";
import { getCatalog } from "@/server/catalog";
import { insertInsInvoice } from "@/server/insurance/billing";
import { notifyInsurer, recordInsApproval } from "@/server/insurance/records";
import { invalid } from "@/server/validation";
import { addDays, istDate, rupees } from "@/components/portal/billing/shared";

/* ──────────────────────────────────────────────────────────────
   MarchGear staff: insurance vendor payments, invoices and refunds
   (/admin/insurance/{payments,invoices,refunds}). No payment gateway
   — vendors pay by bank transfer / UPI / cheque and record the UTR;
   staff check it against the bank statement here. Refunds and voids
   are admin-only.
   ────────────────────────────────────────────────────────────── */

const id = z.coerce.number().int().positive();
const CHANGED = "This record changed in the meantime. Refresh and try again.";
const realDay = (v: unknown): v is string => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const t = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === v;
};
const day = z.string({ error: "Choose a date" }).refine(realDay, "Choose a valid date");
const METHOD = { bank_transfer: "Bank transfer", upi: "UPI", cheque: "Cheque" } as const;
const invoiceHref = (invoiceId: number) => `/insurance-vendor/invoices/${invoiceId}`;
type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

/** A plan's display name ("Professional"), for messages to the vendor. */
const planName = async (id: string) => (await getCatalog()).content.insurerPlans.plans.find((p) => p.id === id)?.name ?? id;

/** Verified money on an invoice so far. */
async function verifiedOn(tx: Tx, invoiceId: number) {
  const [r] = await tx
    .select({ paid: sql<string>`COALESCE(SUM(${insPayments.amount}), 0)` })
    .from(insPayments)
    .where(and(eq(insPayments.invoiceId, invoiceId), eq(insPayments.status, "verified")));
  return Number(r?.paid ?? 0);
}

/** A paid subscription invoice activates its plan up to the end of the period (as dealer billing does). */
async function applySubscription(tx: Tx, inv: typeof insInvoices.$inferSelect) {
  if (inv.kind !== "subscription" || !inv.plan) return null;
  const [v] = await tx.select().from(insVendors).where(eq(insVendors.id, inv.vendorId)).for("update");
  if (!v) return null;
  const today = istDate();
  const next = addDays(inv.periodEnd, 1);
  const renewsAt = v.planRenewsAt && v.planRenewsAt > next ? v.planRenewsAt : next;
  const startsNow = inv.periodStart <= today;
  await tx
    .update(insVendors)
    .set({ plan: startsNow ? inv.plan : v.plan, planStatus: renewsAt > today ? "active" : "past_due", planRenewsAt: renewsAt })
    .where(eq(insVendors.id, v.id));
  return { plan: inv.plan, renewsAt, startsNow };
}

async function loadPayment(paymentId: number) {
  const [row] = await getDb().select({ payment: insPayments, invoice: insInvoices }).from(insPayments).innerJoin(insInvoices, eq(insInvoices.id, insPayments.invoiceId)).where(eq(insPayments.id, paymentId));
  return row ?? null;
}

/* ── Payments ───────────────────────────────────────────────── */

/**
 * The payment was found on the bank statement. The invoice is paid once verified payments cover its total;
 * a part-payment sends it back to due (or keeps it verifying while another payment waits).
 */
export async function verifyInsPaymentAction(paymentId: unknown, input: unknown): Promise<ActionResult<{ invoicePaid: boolean; balance: number }>> {
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
  const remarks = parsed.data.remarks || null;

  const result = await getDb().transaction(async (tx) => {
    const [inv] = await tx.select().from(insInvoices).where(eq(insInvoices.id, invoice.id)).for("update");
    if (!inv || inv.status === "void") return null;
    // Verified money never exceeds the invoice: an over-payment is rejected and recorded again for the right amount.
    const before = await verifiedOn(tx, inv.id);
    if (before + payment.amount > inv.total) return { over: true as const, due: Math.max(0, inv.total - before) };
    const [res] = await tx
      .update(insPayments)
      .set({ status: "verified", remarks, verifiedBy: me.id, verifiedAt: new Date() })
      .where(and(eq(insPayments.id, payment.id), eq(insPayments.status, "submitted")));
    if (!res.affectedRows) return null;
    const paid = await verifiedOn(tx, inv.id);
    const covered = paid >= inv.total;
    const [other] = await tx
      .select({ id: insPayments.id })
      .from(insPayments)
      .where(and(eq(insPayments.invoiceId, inv.id), eq(insPayments.status, "submitted")))
      .limit(1);
    const status = covered ? "paid" : other ? "verifying" : "due";
    await tx.update(insInvoices).set({ status, paidAt: covered ? (inv.paidAt ?? new Date()) : null }).where(eq(insInvoices.id, inv.id));
    const plan = covered && inv.status !== "paid" ? await applySubscription(tx, inv) : null;
    return { over: false as const, covered, balance: Math.max(0, inv.total - paid), plan };
  });
  if (!result) return { ok: false, error: CHANGED };
  if (result.over)
    return { ok: false, error: `This payment (${rupees(payment.amount)}) is more than the ${rupees(result.due)} still due on invoice ${invoice.number}. Reject it and ask the vendor to record the amount actually owed.` };

  const summary = result.covered ? `Invoice ${invoice.number} is paid.` : `${rupees(result.balance)} is still due on invoice ${invoice.number}.`;
  await recordInsApproval({
    vendorId: payment.vendorId,
    target: "payment",
    targetId: payment.id,
    action: "verified",
    fromStatus: "submitted",
    toStatus: "verified",
    remarks: remarks ?? `${rupees(payment.amount)} (ref ${payment.utr}) verified. ${summary}`,
    actorUserId: me.id,
    actorSide: "admin",
  });
  await notifyInsurer(payment.vendorId, {
    kind: "billing",
    title: result.covered ? `Payment verified — invoice ${invoice.number} is paid` : `Payment verified — ${rupees(result.balance)} still due on ${invoice.number}`,
    body: `We received ${rupees(payment.amount)} (ref ${payment.utr}). ${summary}${result.plan ? ` Your ${await planName(result.plan.plan)} plan is paid up to ${formatDate(addDays(result.plan.renewsAt, -1))}.` : ""}${remarks ? ` ${remarks}` : ""}`,
    href: invoiceHref(invoice.id),
  });
  await audit(me.id, "status", "ins_payment", payment.id, `Verified ${rupees(payment.amount)} (ref ${payment.utr}) for invoice ${invoice.number} — ${summary}`);
  return { ok: true, invoicePaid: result.covered, balance: result.balance };
}

/** The payment couldn't be matched: rejected with remarks; the invoice is payable again. */
export async function rejectInsPaymentAction(paymentId: unknown, input: unknown): Promise<ActionResult> {
  const me = await requireStaff();
  const pid = id.safeParse(paymentId);
  const parsed = z
    .object({ remarks: z.string({ error: "Tell the vendor why" }).trim().min(5, "Tell the vendor why (at least 5 characters)").max(500, "Keep remarks under 500 characters") })
    .safeParse(input);
  if (!pid.success) return { ok: false, error: "Payment not found." };
  if (!parsed.success) return invalid(parsed.error);
  const row = await loadPayment(pid.data);
  if (!row) return { ok: false, error: "Payment not found." };
  const { payment, invoice } = row;
  if (payment.status !== "submitted") return { ok: false, error: `This payment has already been ${payment.status}.` };

  const ok = await getDb().transaction(async (tx) => {
    const [res] = await tx
      .update(insPayments)
      .set({ status: "rejected", remarks: parsed.data.remarks, verifiedBy: me.id, verifiedAt: new Date() })
      .where(and(eq(insPayments.id, payment.id), eq(insPayments.status, "submitted")));
    if (!res.affectedRows) return false;
    const [other] = await tx
      .select({ id: insPayments.id })
      .from(insPayments)
      .where(and(eq(insPayments.invoiceId, invoice.id), eq(insPayments.status, "submitted"), ne(insPayments.id, payment.id)))
      .limit(1);
    // Due again ("overdue" is derived from the due date).
    if (!other) await tx.update(insInvoices).set({ status: "due" }).where(and(eq(insInvoices.id, invoice.id), eq(insInvoices.status, "verifying")));
    return true;
  });
  if (!ok) return { ok: false, error: CHANGED };

  await recordInsApproval({ vendorId: payment.vendorId, target: "payment", targetId: payment.id, action: "rejected", fromStatus: "submitted", toStatus: "rejected", remarks: parsed.data.remarks, actorUserId: me.id, actorSide: "admin" });
  await notifyInsurer(payment.vendorId, {
    kind: "billing",
    title: `Payment for invoice ${invoice.number} couldn't be verified`,
    body: `Ref ${payment.utr}: ${parsed.data.remarks} Please check and record the payment again.`,
    href: invoiceHref(invoice.id),
  });
  await audit(me.id, "status", "ins_payment", payment.id, `Rejected payment ref ${payment.utr} (${rupees(payment.amount)}) for invoice ${invoice.number}: ${parsed.data.remarks}`);
  return { ok: true };
}

/* ── Invoices ───────────────────────────────────────────────── */

const markPaidSchema = z.object({
  method: z.enum(["bank_transfer", "upi", "cheque"], { error: "Choose how it was paid" }),
  utr: z
    .string({ error: "Enter the payment reference" })
    .trim()
    .min(4, "Enter the full reference (UTR, UPI transaction ID or cheque number)")
    .max(40, "Keep the reference under 40 characters")
    .regex(/^[A-Za-z0-9/-]+$/, "Letters, numbers, / and - only"),
  paidOn: day,
  remarks: z.string().trim().max(500, "Keep remarks under 500 characters").optional(),
});

/** Staff saw the money arrive (e.g. paid without recording it): records a verified payment for the balance. */
export async function markInsInvoicePaidAction(invoiceId: unknown, input: unknown): Promise<ActionResult<{ paymentId: number }>> {
  const me = await requireStaff();
  const iid = id.safeParse(invoiceId);
  const parsed = markPaidSchema.safeParse(input);
  if (!iid.success) return { ok: false, error: "Invoice not found." };
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  if (d.paidOn > istDate()) return { ok: false, fieldErrors: { paidOn: "The payment date can't be in the future" } };

  const db = getDb();
  const [inv0] = await db.select().from(insInvoices).where(eq(insInvoices.id, iid.data));
  if (!inv0) return { ok: false, error: "Invoice not found." };
  if (inv0.status === "verifying") return { ok: false, error: "A payment from the vendor is waiting for verification — verify or reject it first." };
  if (inv0.status !== "due") return { ok: false, error: `This invoice is already ${inv0.status}.` };
  const [dupe] = await db.select({ id: insPayments.id }).from(insPayments).where(and(eq(insPayments.vendorId, inv0.vendorId), eq(insPayments.utr, d.utr), ne(insPayments.status, "rejected"))).limit(1);
  if (dupe) return { ok: false, fieldErrors: { utr: "This reference is already recorded against one of this vendor's payments" } };

  const result = await db.transaction(async (tx) => {
    const [inv] = await tx.select().from(insInvoices).where(eq(insInvoices.id, inv0.id)).for("update");
    if (!inv || inv.status !== "due") return null;
    const balance = inv.total - (await verifiedOn(tx, inv.id));
    if (balance <= 0) return null;
    const now = new Date();
    const [res] = await tx.insert(insPayments).values({
      vendorId: inv.vendorId,
      invoiceId: inv.id,
      amount: balance,
      method: d.method,
      utr: d.utr,
      paidOn: d.paidOn,
      proof: null,
      status: "verified",
      remarks: d.remarks || "Recorded by MarchGear staff",
      verifiedBy: me.id,
      verifiedAt: now,
    });
    await tx.update(insInvoices).set({ status: "paid", paidAt: now }).where(eq(insInvoices.id, inv.id));
    const plan = await applySubscription(tx, inv);
    return { paymentId: res.insertId, balance, plan };
  });
  if (!result) return { ok: false, error: CHANGED };

  await recordInsApproval({
    vendorId: inv0.vendorId,
    target: "payment",
    targetId: result.paymentId,
    action: "marked_paid",
    fromStatus: null,
    toStatus: "verified",
    remarks: `${rupees(result.balance)} by ${METHOD[d.method]} (ref ${d.utr}, paid ${formatDate(d.paidOn)}) recorded by MarchGear. Invoice ${inv0.number} is paid.${d.remarks ? ` ${d.remarks}` : ""}`,
    actorUserId: me.id,
    actorSide: "admin",
  });
  await notifyInsurer(inv0.vendorId, {
    kind: "billing",
    title: `Invoice ${inv0.number} marked paid`,
    body: `MarchGear recorded your payment of ${rupees(result.balance)} (ref ${d.utr}).${result.plan ? ` Your ${await planName(result.plan.plan)} plan is paid up to ${formatDate(addDays(result.plan.renewsAt, -1))}.` : ""}`,
    href: invoiceHref(inv0.id),
  });
  await audit(me.id, "status", "ins_invoice", inv0.id, `Marked invoice ${inv0.number} paid: ${rupees(result.balance)} by ${METHOD[d.method]}, ref ${d.utr}`);
  return { ok: true, paymentId: result.paymentId };
}

/** Admins only. An unpaid invoice raised in error is cancelled; the vendor owes nothing for it. */
export async function voidInsInvoiceAction(invoiceId: unknown, input: unknown): Promise<ActionResult> {
  const me = await requireStaff(["admin"]);
  const iid = id.safeParse(invoiceId);
  const parsed = z.object({ reason: z.string({ error: "Give a reason" }).trim().min(5, "Give a reason (at least 5 characters)").max(300, "Keep the reason under 300 characters") }).safeParse(input);
  if (!iid.success) return { ok: false, error: "Invoice not found." };
  if (!parsed.success) return invalid(parsed.error);
  const db = getDb();
  const [inv] = await db.select().from(insInvoices).where(eq(insInvoices.id, iid.data));
  if (!inv) return { ok: false, error: "Invoice not found." };
  if (inv.status === "verifying") return { ok: false, error: "A payment is being verified — verify or reject it first." };
  if (inv.status !== "due") return { ok: false, error: `This invoice is already ${inv.status}.` };
  const [paid] = await db.select({ id: insPayments.id }).from(insPayments).where(and(eq(insPayments.invoiceId, inv.id), eq(insPayments.status, "verified"))).limit(1);
  if (paid) return { ok: false, error: "Part of this invoice has been paid, so it can't be voided. Record a refund instead once it's settled." };
  const [res] = await db.update(insInvoices).set({ status: "void" }).where(and(eq(insInvoices.id, inv.id), eq(insInvoices.status, "due")));
  if (!res.affectedRows) return { ok: false, error: CHANGED };
  await notifyInsurer(inv.vendorId, { kind: "billing", title: `Invoice ${inv.number} was cancelled`, body: `${parsed.data.reason} No payment is needed for this invoice.`, href: invoiceHref(inv.id) });
  await audit(me.id, "status", "ins_invoice", inv.id, `Voided invoice ${inv.number} (${rupees(inv.total)}): ${parsed.data.reason}`);
  return { ok: true };
}

const createSchema = z
  .object({
    vendorId: z.coerce.number({ error: "Choose a vendor" }).int().positive("Choose a vendor"),
    kind: z.enum(["other", "lead_fee"], { error: "Choose what the invoice is for" }),
    description: z.string({ error: "Describe the charge" }).trim().min(5, "Describe the charge (at least 5 characters)").max(300, "Keep the description under 300 characters"),
    periodStart: day,
    periodEnd: day,
    amount: z.coerce.number({ error: "Enter the amount before GST" }).int("Whole rupees only").min(1, "Enter the amount before GST").max(10_000_000, "That's more than ₹1 crore — check the amount"),
    dueOn: day,
  })
  .refine((v) => !realDay(v.periodStart) || !realDay(v.periodEnd) || v.periodEnd >= v.periodStart, { path: ["periodEnd"], message: "The period must end on or after it starts" })
  .refine((v) => !realDay(v.periodStart) || !realDay(v.periodEnd) || v.periodEnd <= addDays(v.periodStart, 366), { path: ["periodEnd"], message: "Keep the period to a year or less" });

/** A one-off charge (lead fee or other) for a vendor. 18% GST is added. */
export async function createInsInvoiceAction(input: unknown): Promise<ActionResult<{ id: number; number: string; total: number }>> {
  const me = await requireStaff();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  if (d.dueOn < istDate()) return { ok: false, fieldErrors: { dueOn: "The due date can't be in the past" } };
  const [v] = await getDb().select({ id: insVendors.id, status: insVendors.status, brand: insVendors.brandName, legal: insVendors.legalName, reference: insVendors.reference }).from(insVendors).where(eq(insVendors.id, d.vendorId));
  if (!v) return { ok: false, fieldErrors: { vendorId: "Choose a vendor" } };
  if (!["approved", "suspended"].includes(v.status)) return { ok: false, fieldErrors: { vendorId: "Invoices can only be raised for approved (or suspended) vendors" } };
  if (d.kind === "lead_fee" && !(await getCatalog()).content.insuranceSettings.leadFeeEnabled)
    return { ok: false, fieldErrors: { kind: "Lead fees are switched off in insurance settings. Use “Other” or turn lead fees on first." } };

  const inv = await insertInsInvoice({ vendorId: v.id, kind: d.kind, description: d.description, periodStart: d.periodStart, periodEnd: d.periodEnd, amount: d.amount, dueOn: d.dueOn });
  await notifyInsurer(v.id, {
    kind: "billing",
    title: `New invoice ${inv.number} from MarchGear`,
    body: `${d.description}. Total ${rupees(inv.total)} incl. 18% GST, due ${d.dueOn}.`,
    href: invoiceHref(inv.id),
  });
  await audit(me.id, "create", "ins_invoice", inv.id, `Raised ${INS_INVOICE_KIND_LABEL[d.kind].toLowerCase()} invoice ${inv.number} for ${v.brand || v.legal || v.reference}: ${d.description}, ${rupees(inv.total)}`);
  return { ok: true, id: inv.id, number: inv.number, total: inv.total };
}

/* ── Refunds ────────────────────────────────────────────────── */

const refundSchema = z.object({
  invoiceId: z.coerce.number({ error: "Choose an invoice" }).int().positive("Choose an invoice"),
  amount: z.coerce.number({ error: "Enter the amount refunded" }).int("Whole rupees only").min(1, "Enter the amount refunded"),
  reason: z.string({ error: "Give a reason" }).trim().min(5, "Give a reason (at least 5 characters)").max(300, "Keep the reason under 300 characters"),
  reference: z
    .string({ error: "Enter the refund's bank or UPI reference" })
    .trim()
    .min(4, "Enter the refund's bank or UPI reference")
    .max(60, "Keep the reference under 60 characters")
    .regex(/^[A-Za-z0-9/ -]+$/, "Letters, numbers, spaces, / and - only"),
  refundedOn: day,
});

/** Admins only. Records money MarchGear paid back (no gateway — the transfer happens outside the site). */
export async function recordInsRefundAction(input: unknown): Promise<ActionResult<{ id: number; refundable: number }>> {
  const me = await requireStaff(["admin"]);
  const parsed = refundSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  if (d.refundedOn > istDate()) return { ok: false, fieldErrors: { refundedOn: "The refund date can't be in the future" } };

  const db = getDb();
  type Refused = { error: Record<string, string> };
  const refuse = (field: string, message: string): Refused => ({ error: { [field]: message } });
  const result = await db.transaction(async (tx) => {
    const [inv] = await tx.select().from(insInvoices).where(eq(insInvoices.id, d.invoiceId)).for("update");
    if (!inv) return refuse("invoiceId", "Choose an invoice");
    if (inv.status !== "paid") return refuse("invoiceId", "Refunds can only be recorded against paid invoices");
    const verified = await verifiedOn(tx, inv.id);
    const [r] = await tx.select({ refunded: sql<string>`COALESCE(SUM(${insRefunds.amount}), 0)` }).from(insRefunds).where(eq(insRefunds.invoiceId, inv.id));
    const refundable = verified - Number(r?.refunded ?? 0);
    if (refundable <= 0) return refuse("invoiceId", "Everything paid on this invoice has already been refunded");
    if (d.amount > refundable) return refuse("amount", `At most ${rupees(refundable)} — verified payments less earlier refunds`);
    const [pay] = await tx
      .select({ id: insPayments.id })
      .from(insPayments)
      .where(and(eq(insPayments.invoiceId, inv.id), inArray(insPayments.status, ["verified"])))
      .orderBy(desc(insPayments.verifiedAt), desc(insPayments.id))
      .limit(1);
    const [res] = await tx.insert(insRefunds).values({ vendorId: inv.vendorId, invoiceId: inv.id, paymentId: pay?.id ?? null, amount: d.amount, reason: d.reason, reference: d.reference, refundedOn: d.refundedOn, createdBy: me.id });
    return { id: res.insertId, inv, paymentId: pay?.id ?? null, left: refundable - d.amount };
  });
  if ("error" in result) return { ok: false, fieldErrors: result.error };

  const { inv } = result;
  if (result.paymentId)
    await recordInsApproval({ vendorId: inv.vendorId, target: "payment", targetId: result.paymentId, action: "refunded", fromStatus: null, toStatus: null, remarks: `${rupees(d.amount)} refunded on ${formatDate(d.refundedOn)} (ref ${d.reference}): ${d.reason}`, actorUserId: me.id, actorSide: "admin" });
  await notifyInsurer(inv.vendorId, {
    kind: "billing",
    title: `Refund of ${rupees(d.amount)} on invoice ${inv.number}`,
    body: `MarchGear refunded ${rupees(d.amount)} on ${formatDate(d.refundedOn)} (ref ${d.reference}). ${d.reason}`,
    href: invoiceHref(inv.id),
  });
  await audit(me.id, "create", "ins_refund", result.id, `Recorded refund of ${rupees(d.amount)} on invoice ${inv.number} (ref ${d.reference}): ${d.reason}`);
  return { ok: true, id: result.id, refundable: result.left };
}
