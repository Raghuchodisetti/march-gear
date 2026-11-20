"use server";

import { z } from "zod";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { insFiles, insInvoices, insPayments, insVendors } from "@/db/schema";
import { INSURER_PLAN_IDS } from "@/content/blocks/insurer-plans";
import type { ActionResult } from "@/lib/action-result";
import { formatDate } from "@/lib/format";
import type { FileRef } from "@/partner/types";
import { PAYMENT_METHODS, PAYMENT_METHOD_SHORT } from "@/components/portal/billing/shared";
import { addDays, insPlanName, insSubscriptionLine, istDate, rupees } from "@/components/insurance/vendor/billing/shared";
import { insInvoiceDisplayStatus, insertInsInvoice } from "@/server/insurance/billing";
import { insurerAction, isInsurerError } from "@/server/insurance/context";
import { logInsurerActivity, notifyInsurer, recordInsApproval } from "@/server/insurance/records";
import { ensureInsBillingState, getInsBillingSettings, getInsPlans, insQuoteFor, scheduledFreePlan } from "@/server/insurance/subscription";
import { HOUR, take } from "@/server/rate-limit";
import { invalid, isoDate } from "@/server/validation";

/* Plan changes and payment records from the insurance vendor portal (billing.manage). */

/** Requests a plan change. The rule (trial switch, prorated upgrade, next-period change, free plan…) is recomputed here. */
export async function requestInsPlanChangeAction(input: unknown): Promise<ActionResult<{ message: string; invoices: { id: number; number: string }[] }>> {
  const ctx = await insurerAction("billing.manage");
  if (isInsurerError(ctx)) return ctx;
  const parsed = z.object({ plan: z.enum(INSURER_PLAN_IDS, { error: "Choose a plan" }) }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!take(`ins-plan-change:${ctx.vendor.id}`, 10, HOUR)) return { ok: false, error: "Too many plan changes in a short time. Please try again later." };

  const vid = ctx.vendor.id;
  await ensureInsBillingState(vid);
  const [plans, settings] = await Promise.all([getInsPlans(), getInsBillingSettings()]);
  const scheduled = await scheduledFreePlan(vid, plans);
  const target = parsed.data.plan;

  const result = await getDb().transaction(async (tx) => {
    const [v] = await tx.select().from(insVendors).where(eq(insVendors.id, vid)).for("update");
    if (!v) return { ok: false as const, error: "Company not found." };
    const invoices = await tx.select().from(insInvoices).where(eq(insInvoices.vendorId, vid));
    const quote = insQuoteFor(v, invoices, plans, target, settings, scheduled);
    if (quote.blocked || !quote.kind) return { ok: false as const, error: quote.blocked ?? "That change isn't possible right now." };
    // A part-paid invoice can't be replaced (voiding it would strand the payment MarchGear has received).
    const replaced = invoices.filter((i) => quote.replaces.includes(i.number) && i.status === "due");
    if (replaced.length) {
      const [partPaid] = await tx
        .select({ invoiceId: insPayments.invoiceId })
        .from(insPayments)
        .where(and(inArray(insPayments.invoiceId, replaced.map((i) => i.id)), eq(insPayments.status, "verified")))
        .limit(1);
      const number = replaced.find((i) => i.id === partPaid?.invoiceId)?.number;
      if (number) return { ok: false as const, error: `Invoice ${number} is part-paid. Pay the balance, or contact MarchGear support to change your plan.` };
    }

    if (quote.replaces.length)
      await tx
        .update(insInvoices)
        .set({ status: "void" })
        .where(and(eq(insInvoices.vendorId, vid), eq(insInvoices.kind, "subscription"), inArray(insInvoices.number, quote.replaces), eq(insInvoices.status, "due")));
    const issued: { id: number; number: string }[] = [];
    for (const inv of quote.invoices) {
      const r = await insertInsInvoice(
        {
          vendorId: vid,
          kind: "subscription",
          description: insSubscriptionLine(insPlanName(plans, inv.plan), inv.periodStart, inv.periodEnd),
          plan: inv.plan,
          periodStart: inv.periodStart,
          periodEnd: inv.periodEnd,
          amount: inv.amount,
          dueOn: inv.dueOn,
        },
        tx,
      );
      issued.push({ id: r.id, number: r.number });
    }
    if (Object.keys(quote.vendor).length) await tx.update(insVendors).set(quote.vendor).where(eq(insVendors.id, vid));
    return { ok: true as const, quote, from: v.plan, issued };
  });
  if (!result.ok) return result;

  const { quote, from, issued } = result;
  const numbers = issued.map((i) => i.number);
  const fromName = insPlanName(plans, from);
  const toName = insPlanName(plans, quote.target);
  const what: Record<NonNullable<typeof quote.kind>, string> = {
    trial_switch: `Switched trial plan from ${fromName} to ${toName}`,
    free_now: `Moved from ${fromName} to ${toName} (free)`,
    start_paid: `Requested upgrade from ${fromName} to ${toName} — invoice ${numbers.join(", ")}`,
    replace_unpaid: `Requested change from ${fromName} to ${toName} — invoice ${numbers.join(", ")}`,
    prorated_upgrade: `Requested upgrade from ${fromName} to ${toName} — prorated invoice ${numbers.join(", ")}`,
    next_period: `Requested change from ${fromName} to ${toName} from ${formatDate(quote.effective)} — invoice ${numbers.join(", ")}`,
    free_at_renewal: `Requested move from ${fromName} to ${toName} (free) on ${formatDate(quote.effective)}`,
    keep_plan: `Kept the ${toName} plan — the scheduled move to ${insPlanName(plans, scheduled)} was cancelled`,
  };
  const kind = quote.kind!;
  const replaced = quote.replaces.length ? ` (cancels ${quote.replaces.join(", ")})` : "";
  // "plan_scheduled" rows also tell ensureInsBillingState() which free plan an ending paid plan moves to.
  await logInsurerActivity(vid, ctx.user.id, kind === "free_at_renewal" ? "plan_scheduled" : "plan_change", "subscription", kind === "free_at_renewal" ? quote.target : null, `${what[kind]}${replaced}`);
  await notifyInsurer(vid, {
    kind: "billing",
    title: numbers.length ? `Invoice ${numbers.join(", ")} issued for the ${toName} plan` : `Plan updated: ${what[kind]}`,
    body: quote.summary,
    href: issued.length ? `/insurance-vendor/invoices/${issued[0].id}` : "/insurance-vendor/billing",
  });

  const message: Record<NonNullable<typeof quote.kind>, string> = {
    trial_switch: `Your trial is now on the ${toName} plan.`,
    free_now: `You're now on the ${toName} plan.`,
    start_paid: `Invoice ${numbers.join(", ")} is ready — pay it and record the payment to start ${toName}.`,
    replace_unpaid: `Invoice ${numbers.join(", ")} is ready — pay it and record the payment to complete the change.`,
    prorated_upgrade: `Invoice ${numbers.join(", ")} is ready — ${toName} starts once MarchGear verifies the payment.`,
    next_period: `${toName} starts on ${formatDate(quote.effective)}. Invoice ${numbers.join(", ")} has been issued for that period.`,
    free_at_renewal: `You'll move to ${toName} on ${formatDate(quote.effective)}.`,
    keep_plan: `You'll stay on ${toName}.`,
  };
  return { ok: true, message: message[kind], invoices: issued };
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

/** Records a bank transfer / UPI / cheque payment against an invoice; the invoice waits in "verifying" for MarchGear. */
export async function recordInsPaymentAction(input: unknown): Promise<ActionResult<{ paymentId: number }>> {
  const ctx = await insurerAction("billing.manage");
  if (isInsurerError(ctx)) return ctx;
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const vid = ctx.vendor.id;
  const today = istDate();
  if (!take(`ins-record-payment:${ctx.user.id}`, 20, HOUR)) return { ok: false, error: "Too many attempts. Please try again later." };

  const db = getDb();
  const [inv] = await db.select().from(insInvoices).where(and(eq(insInvoices.id, d.invoiceId), eq(insInvoices.vendorId, vid)));
  if (!inv) return { ok: false, error: "Invoice not found." };
  if (inv.status === "verifying") return { ok: false, error: "A payment for this invoice is already being verified." };
  if (inv.status !== "due") return { ok: false, error: `This invoice is ${inv.status === "paid" ? "already paid" : "void"} — no payment is needed.` };

  const errors: Record<string, string> = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.paidOn) || Number.isNaN(Date.parse(`${d.paidOn}T00:00:00Z`))) errors.paidOn = "Choose a valid date";
  else if (d.paidOn > today) errors.paidOn = "The payment date can't be in the future";
  else if (d.paidOn < addDays(istDate(inv.createdAt), -30)) errors.paidOn = "That's well before this invoice was issued — check the date";
  // Never more than what's still owed: verified part-payments already count against the total.
  const [{ paid }] = await db
    .select({ paid: sql<string>`COALESCE(SUM(${insPayments.amount}), 0)` })
    .from(insPayments)
    .where(and(eq(insPayments.invoiceId, inv.id), eq(insPayments.status, "verified")));
  const balance = Math.max(0, inv.total - Number(paid ?? 0));
  if (d.amount > balance)
    errors.amount = balance < inv.total ? `That's more than the balance still due (${rupees(balance)} of ${rupees(inv.total)})` : `That's more than the invoice total (${rupees(inv.total)})`;
  const [dup] = await db
    .select({ id: insPayments.id })
    .from(insPayments)
    .where(and(eq(insPayments.vendorId, vid), eq(insPayments.utr, d.utr), ne(insPayments.status, "rejected")))
    .limit(1);
  if (dup) errors.utr = "This reference has already been recorded for another payment";

  let proof: FileRef | null = null;
  if (d.proofId) {
    const [f] = await db
      .select({ id: insFiles.id, filename: insFiles.filename, mime: insFiles.mime, size: insFiles.size })
      .from(insFiles)
      .where(and(eq(insFiles.id, d.proofId), eq(insFiles.vendorId, vid), eq(insFiles.kind, "payment_proof")));
    if (!f) errors.proof = "Upload the payment proof again";
    else proof = f;
  }
  if (Object.keys(errors).length) return { ok: false, error: "Please check the highlighted fields.", fieldErrors: errors };

  const from = insInvoiceDisplayStatus(inv, today);
  const paymentId = await db.transaction(async (tx) => {
    const [res] = await tx.update(insInvoices).set({ status: "verifying" }).where(and(eq(insInvoices.id, inv.id), eq(insInvoices.status, "due")));
    if (!res.affectedRows) return null;
    const [ins] = await tx.insert(insPayments).values({ vendorId: vid, invoiceId: inv.id, amount: d.amount, method: d.method, utr: d.utr, paidOn: d.paidOn, proof, status: "submitted" });
    return ins.insertId;
  });
  if (!paymentId) return { ok: false, error: "This invoice changed in the meantime. Refresh the page and try again." };

  const summary = `${PAYMENT_METHOD_SHORT[d.method]} ${rupees(d.amount)} · ref ${d.utr} · paid ${formatDate(d.paidOn)} for invoice ${inv.number}`;
  await recordInsApproval({ vendorId: vid, target: "payment", targetId: paymentId, action: "submitted", fromStatus: from, toStatus: "submitted", remarks: summary, actorUserId: ctx.user.id, actorSide: "vendor" });
  await logInsurerActivity(vid, ctx.user.id, "payment", inv.kind === "subscription" ? "subscription" : "invoice", inv.number, `Recorded payment: ${summary}`);
  return { ok: true, paymentId };
}
