"use server";

import { z } from "zod";
import { and, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { partnerFiles, partnerInvoices, partnerPayments, partners } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { formatDate } from "@/lib/format";
import type { FileRef } from "@/partner/types";
import { PAYMENT_METHODS, PAYMENT_METHOD_SHORT, PLAN_IDS, addDays, invoiceDisplayStatus, istDate, rupees } from "@/components/portal/billing/shared";
import { ensureBillingState, getPlans, insertInvoice, planNameOf, quoteFor } from "@/server/partner/billing";
import { isActionError, partnerAction } from "@/server/partner/context";
import { logPartnerActivity, notifyPartner, recordApproval } from "@/server/partner/records";
import { HOUR, take } from "@/server/rate-limit";
import { invalid, isoDate } from "@/server/validation";

/* Subscription plan changes and payment records from the dealer portal (billing.manage). */

/** Requests a plan change. The rule (prorated upgrade / next-period downgrade / trial switch) is recomputed here. */
export async function requestPlanChangeAction(input: unknown): Promise<ActionResult<{ message: string; invoices: string[] }>> {
  const ctx = await partnerAction("billing.manage");
  if (isActionError(ctx)) return ctx;
  const parsed = z.object({ plan: z.enum(PLAN_IDS, { error: "Choose a plan" }) }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!take(`plan-change:${ctx.partner.id}`, 10, HOUR)) return { ok: false, error: "Too many plan changes in a short time. Please try again later." };

  const pid = ctx.partner.id;
  await ensureBillingState(pid);
  const plans = await getPlans();
  const db = getDb();

  const result = await db.transaction(async (tx) => {
    const [p] = await tx.select().from(partners).where(eq(partners.id, pid)).for("update");
    if (!p) return { ok: false as const, error: "Dealership not found." };
    const invoices = await tx.select().from(partnerInvoices).where(eq(partnerInvoices.partnerId, pid));
    const quote = quoteFor(p, invoices, plans, parsed.data.plan);
    if (quote.blocked || !quote.kind) return { ok: false as const, error: quote.blocked ?? "That change isn't possible right now." };

    if (quote.kind === "trial_switch") {
      await tx.update(partners).set({ plan: parsed.data.plan }).where(eq(partners.id, pid));
      return { ok: true as const, quote, from: p.plan, numbers: [] as string[] };
    }
    if (quote.replaces.length)
      await tx
        .update(partnerInvoices)
        .set({ status: "void" })
        .where(and(eq(partnerInvoices.partnerId, pid), inArray(partnerInvoices.number, quote.replaces), eq(partnerInvoices.status, "due")));
    const numbers: string[] = [];
    for (const inv of quote.invoices) numbers.push((await insertInvoice(tx, { partnerId: pid, ...inv })).number);
    return { ok: true as const, quote, from: p.plan, numbers };
  });
  if (!result.ok) return result;

  const { quote, from, numbers } = result;
  const fromName = planNameOf(plans, from);
  const toName = planNameOf(plans, quote.target);
  const what =
    quote.kind === "trial_switch"
      ? `Switched trial plan from ${fromName} to ${toName}`
      : quote.kind === "prorated_upgrade"
        ? `Requested upgrade from ${fromName} to ${toName} — prorated invoice ${numbers[0]}`
        : quote.kind === "next_period"
          ? `Requested change from ${fromName} to ${toName} from ${formatDate(quote.effective)} — invoice ${numbers.join(", ")}`
          : `Requested change from ${fromName} to ${toName} — invoice ${numbers.join(", ")}`;
  await logPartnerActivity(pid, ctx.user.id, "plan_change", "subscription", null, `${what}${quote.replaces.length ? ` (replaces ${quote.replaces.join(", ")})` : ""}`);
  if (numbers.length)
    await notifyPartner(pid, { kind: "billing", title: `Invoice ${numbers.join(", ")} issued for the ${toName} plan`, body: quote.summary, href: "/dealer/invoices" });
  const message =
    quote.kind === "trial_switch" ? `Your trial is now on the ${toName} plan.` : `Plan change requested. Invoice ${numbers.join(", ")} is ready — pay it and record the payment to complete the change.`;
  return { ok: true, message, invoices: numbers };
}

const paymentSchema = z.object({
  invoiceId: z.coerce.number().int().positive(),
  method: z.enum(PAYMENT_METHODS, { error: "Choose how you paid" }),
  utr: z
    .string({ error: "Enter the transaction reference" })
    .trim()
    .min(4, "Enter the full reference (at least 4 characters)")
    .max(40, "Keep this under 40 characters")
    .regex(/^[A-Za-z0-9][A-Za-z0-9 /-]*$/, "Use letters, numbers, spaces, / and - only")
    .transform((v) => v.toUpperCase()),
  paidOn: isoDate,
  amount: z.coerce.number({ error: "Enter the amount you paid" }).int("Enter the amount in whole rupees").min(1, "Enter the amount you paid").max(100_000_000),
  proofId: z.coerce.number().int().positive().nullish(),
});

/** Records a bank transfer / UPI / cheque payment against an invoice for MarchGear to verify. */
export async function recordPaymentAction(input: unknown): Promise<ActionResult<{ paymentId: number }>> {
  const ctx = await partnerAction("billing.manage");
  if (isActionError(ctx)) return ctx;
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const pid = ctx.partner.id;
  const today = istDate();
  if (!take(`record-payment:${ctx.user.id}`, 20, HOUR)) return { ok: false, error: "Too many attempts. Please try again later." };

  const db = getDb();
  const [inv] = await db.select().from(partnerInvoices).where(and(eq(partnerInvoices.id, d.invoiceId), eq(partnerInvoices.partnerId, pid)));
  if (!inv) return { ok: false, error: "Invoice not found." };
  if (inv.status === "verifying") return { ok: false, error: "A payment for this invoice is already being verified." };
  if (inv.status !== "due") return { ok: false, error: `This invoice is ${inv.status === "paid" ? "already paid" : "void"} — no payment is needed.` };

  const errors: Record<string, string> = {};
  if (d.paidOn > today) errors.paidOn = "The payment date can't be in the future";
  else if (d.paidOn < addDays(istDate(inv.createdAt), -30)) errors.paidOn = "That's well before this invoice was issued — check the date";
  if (d.amount > inv.total) errors.amount = `That's more than the invoice total (${rupees(inv.total)})`;
  const [dup] = await db
    .select({ id: partnerPayments.id })
    .from(partnerPayments)
    .where(and(eq(partnerPayments.partnerId, pid), eq(partnerPayments.utr, d.utr), ne(partnerPayments.status, "rejected")))
    .limit(1);
  if (dup) errors.utr = "This reference has already been recorded for another payment";

  let proof: FileRef | null = null;
  if (d.proofId) {
    const [f] = await db
      .select({ id: partnerFiles.id, filename: partnerFiles.filename, mime: partnerFiles.mime, size: partnerFiles.size })
      .from(partnerFiles)
      .where(and(eq(partnerFiles.id, d.proofId), eq(partnerFiles.partnerId, pid), eq(partnerFiles.kind, "payment_proof")));
    if (!f) errors.proof = "Upload the payment proof again";
    else proof = f;
  }
  if (Object.keys(errors).length) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: errors };

  const from = invoiceDisplayStatus(inv, today);
  const paymentId = await db.transaction(async (tx) => {
    const [res] = await tx.update(partnerInvoices).set({ status: "verifying" }).where(and(eq(partnerInvoices.id, inv.id), eq(partnerInvoices.status, "due")));
    if (!res.affectedRows) return null;
    const [ins] = await tx.insert(partnerPayments).values({ partnerId: pid, invoiceId: inv.id, amount: d.amount, method: d.method, utr: d.utr, paidOn: d.paidOn, proof, status: "submitted" });
    return ins.insertId;
  });
  if (!paymentId) return { ok: false, error: "This invoice changed in the meantime. Refresh the page and try again." };

  const summary = `${PAYMENT_METHOD_SHORT[d.method]} ${rupees(d.amount)} · ref ${d.utr} · paid ${formatDate(d.paidOn)} for invoice ${inv.number}`;
  await recordApproval({ partnerId: pid, target: "payment", targetId: paymentId, action: "submitted", fromStatus: from, toStatus: "submitted", remarks: summary, actorUserId: ctx.user.id, actorSide: "dealer" });
  await logPartnerActivity(pid, ctx.user.id, "payment", "invoice", inv.number, `Recorded payment: ${summary}`);
  return { ok: true, paymentId };
}
