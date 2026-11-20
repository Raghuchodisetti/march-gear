import "server-only";
import { and, count, desc, eq, gte, like, lte } from "drizzle-orm";
import { getDb, type Database } from "@/db";
import { partnerActivity, partnerInvoices, partnerMembers, partnerOffers, partnerPayments, partnerShowrooms, partnerVehicles, partners, users } from "@/db/schema";
import { formatDate } from "@/lib/format";
import { getCatalog } from "@/server/catalog";
import { isDuplicate } from "@/server/db-errors";
import {
  PAYMENT_TERMS_DAYS,
  RENEWAL_NOTICE_DAYS,
  TRIAL_DAYS,
  addDays,
  gstOn,
  invoiceDisplayStatus,
  invoiceLine,
  isProrated,
  istDate,
  periodEndFor,
  plansFromContent,
  quoteChange,
  rupees,
  trialFor,
  type BillingParty,
  type InvoiceView,
  type PaymentDetails,
  type Plan,
  type PlanId,
} from "@/components/portal/billing/shared";
import { logPartnerActivity, notifyPartner } from "./records";
import type { PartnerRow } from "./context";

/* ──────────────────────────────────────────────────────────────
   Dealer subscriptions, invoices and payments.
   There's no payment gateway: dealers pay by bank transfer / UPI /
   cheque and record the UTR; MarchGear staff verify it in
   /admin/partner-billing. There's no cron either — trial-end and
   renewal invoices are generated on demand (ensureBillingState)
   when the subscription or invoices pages load.
   ────────────────────────────────────────────────────────────── */

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Db = Database | Tx;
export type InvoiceRow = typeof partnerInvoices.$inferSelect;
export type PaymentRow = typeof partnerPayments.$inferSelect;

export async function getPlans(): Promise<Plan[]> {
  return plansFromContent((await getCatalog()).content.partnerPlans);
}

export const planNameOf = (plans: Plan[], id: string) => plans.find((p) => p.id === id)?.name ?? id.charAt(0).toUpperCase() + id.slice(1);

/** What the dealership uses against its plan's limits right now. */
export async function getUsage(partnerId: number) {
  const db = getDb();
  const now = new Date();
  const [[l], [o], [s], [r]] = await Promise.all([
    db.select({ n: count() }).from(partnerVehicles).where(and(eq(partnerVehicles.partnerId, partnerId), eq(partnerVehicles.status, "published"))),
    db
      .select({ n: count() })
      .from(partnerOffers)
      .where(and(eq(partnerOffers.partnerId, partnerId), eq(partnerOffers.status, "approved"), lte(partnerOffers.startsAt, now), gte(partnerOffers.endsAt, now))),
    db.select({ n: count() }).from(partnerMembers).where(and(eq(partnerMembers.partnerId, partnerId), eq(partnerMembers.isActive, true))),
    db.select({ n: count() }).from(partnerShowrooms).where(and(eq(partnerShowrooms.partnerId, partnerId), eq(partnerShowrooms.isActive, true))),
  ]);
  return { listings: l.n, activeOffers: o.n, staff: s.n, showrooms: r.n };
}

/* ── Invoices ─────────────────────────────────────────────────── */

/** Indian financial year prefix, e.g. 20 Nov 2026 → "MG/26-27/". */
function fyPrefix(today: string) {
  const y = Number(today.slice(0, 4));
  const start = Number(today.slice(5, 7)) >= 4 ? y : y - 1;
  return `MG/${String(start % 100).padStart(2, "0")}-${String((start + 1) % 100).padStart(2, "0")}/`;
}

/** Inserts an invoice with the next serial number of the financial year (MG/26-27/00001). */
export async function insertInvoice(db: Db, inv: { partnerId: number; plan: string; periodStart: string; periodEnd: string; amount: number; dueOn: string; paid?: boolean }) {
  const prefix = fyPrefix(istDate());
  const [last] = await db
    .select({ number: partnerInvoices.number })
    .from(partnerInvoices)
    .where(like(partnerInvoices.number, `${prefix}%`))
    .orderBy(desc(partnerInvoices.number))
    .limit(1);
  const base = last ? Number(last.number.slice(prefix.length)) || 0 : 0;
  const gst = gstOn(inv.amount);
  for (let attempt = 1; attempt <= 5; attempt++) {
    const number = `${prefix}${String(base + attempt).padStart(5, "0")}`;
    try {
      const [res] = await db.insert(partnerInvoices).values({
        partnerId: inv.partnerId,
        number,
        plan: inv.plan,
        periodStart: inv.periodStart,
        periodEnd: inv.periodEnd,
        amount: inv.amount,
        gst,
        total: inv.amount + gst,
        status: inv.paid ? "paid" : "due",
        dueOn: inv.dueOn,
        paidAt: inv.paid ? new Date() : null,
      });
      return { id: res.insertId, number, total: inv.amount + gst };
    } catch (err) {
      if (!isDuplicate(err) || attempt === 5) throw err;
    }
  }
  throw new Error("Couldn't number the invoice");
}

export function toInvoiceView(r: InvoiceRow, plans: Plan[], today = istDate()): InvoiceView {
  const planName = planNameOf(plans, r.plan);
  return {
    id: r.id,
    number: r.number,
    plan: r.plan,
    planName,
    line: invoiceLine(r, planName),
    periodStart: r.periodStart,
    periodEnd: r.periodEnd,
    amount: r.amount,
    gst: r.gst,
    total: r.total,
    status: r.status,
    display: invoiceDisplayStatus(r, today),
    dueOn: r.dueOn,
    issuedOn: istDate(r.createdAt),
    paidAt: r.paidAt ? r.paidAt.toISOString() : null,
  };
}

/* ── On-demand billing (no cron) ──────────────────────────────── */

/**
 * Brings the dealership's subscription up to date:
 * - trial over → first invoice for the plan they're on, plan "payment due";
 * - renewal within RENEWAL_NOTICE_DAYS → renewal invoice (due on the renewal date);
 * - renewal date passed unpaid → "payment due";
 * - a paid period for another plan has started (a scheduled downgrade) → switch to it.
 * Idempotent; the partner row is locked so two page loads can't both issue an invoice.
 */
export async function ensureBillingState(partnerId: number) {
  const today = istDate();
  const plans = await getPlans();
  const price = (id: string) => plans.find((p) => p.id === id)?.monthly ?? 0;
  const issued: { number: string; title: string; body: string }[] = [];
  let started: string | null = null;

  await getDb().transaction(async (tx) => {
    const [p] = await tx.select().from(partners).where(eq(partners.id, partnerId)).for("update");
    if (!p || p.status !== "approved") return;
    const live = (await tx.select().from(partnerInvoices).where(eq(partnerInvoices.partnerId, partnerId))).filter((i) => i.status !== "void");
    const patch: Partial<typeof partners.$inferInsert> = {};

    const issue = async (plan: string, periodStart: string, dueOn: string, title: string) => {
      const amount = price(plan);
      const periodEnd = periodEndFor(periodStart);
      const inv = await insertInvoice(tx, { partnerId, plan, periodStart, periodEnd, amount, dueOn, paid: amount === 0 });
      if (amount === 0) {
        patch.planStatus = "active";
        patch.planRenewsAt = addDays(periodEnd, 1);
      }
      issued.push({ number: inv.number, title, body: `${planNameOf(plans, plan)} plan, ${formatDate(periodStart)} – ${formatDate(periodEnd)}. Total ${rupees(inv.total)} incl. 18% GST, due ${formatDate(dueOn)}.` });
    };

    if (p.planStatus === "trial") {
      const trial = trialFor(p.approvedAt, p.createdAt, today);
      if (trial.ended) {
        patch.planStatus = "past_due";
        if (!live.some((i) => i.periodStart === trial.firstBillable && !isProrated(i.periodStart, i.periodEnd)))
          await issue(p.plan, trial.firstBillable, addDays(today, PAYMENT_TERMS_DAYS), "Your free trial has ended — first invoice issued");
      }
    } else if ((p.planStatus === "active" || p.planStatus === "past_due") && p.planRenewsAt) {
      const renewsAt = p.planRenewsAt;
      if (today >= addDays(renewsAt, -RENEWAL_NOTICE_DAYS) && !live.some((i) => i.periodStart === renewsAt)) {
        // A pending (unpaid or verifying) upgrade decides the renewal's plan.
        const upgrade = live.find((i) => i.status !== "paid" && isProrated(i.periodStart, i.periodEnd) && i.periodEnd === addDays(renewsAt, -1));
        await issue(upgrade?.plan ?? p.plan, renewsAt, renewsAt > today ? renewsAt : addDays(today, PAYMENT_TERMS_DAYS), "Renewal invoice issued");
      }
      if (today >= renewsAt && p.planStatus === "active" && patch.planStatus !== "active") patch.planStatus = "past_due";
      const covering = live
        .filter((i) => i.status === "paid" && i.periodStart <= today && i.periodEnd >= today)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      if (covering && covering.plan !== p.plan) patch.plan = covering.plan;
    }

    if (Object.keys(patch).length) await tx.update(partners).set(patch).where(eq(partners.id, partnerId));
    if (patch.plan) started = patch.plan;
  });

  // Outside the transaction: these rows reference the locked partner row.
  if (started) await logPartnerActivity(partnerId, null, "plan_start", "subscription", null, `${planNameOf(plans, started)} plan started`);

  for (const i of issued) {
    await notifyPartner(partnerId, { kind: "billing", title: `${i.title}: ${i.number}`, body: i.body, href: "/dealer/invoices" });
    await logPartnerActivity(partnerId, null, "invoice", "subscription", i.number, `${i.title} (${i.number})`);
  }
}

/* ── Page data ────────────────────────────────────────────────── */

export async function getInvoices(partnerId: number) {
  return getDb().select().from(partnerInvoices).where(eq(partnerInvoices.partnerId, partnerId)).orderBy(desc(partnerInvoices.createdAt), desc(partnerInvoices.id));
}

export async function getPayments(partnerId: number) {
  return getDb()
    .select({ payment: partnerPayments, number: partnerInvoices.number })
    .from(partnerPayments)
    .innerJoin(partnerInvoices, eq(partnerInvoices.id, partnerPayments.invoiceId))
    .where(eq(partnerPayments.partnerId, partnerId))
    .orderBy(desc(partnerPayments.createdAt), desc(partnerPayments.id));
}

export function billingState(p: PartnerRow, invoices: InvoiceRow[], today = istDate()) {
  return {
    plan: p.plan,
    planStatus: p.planStatus,
    planRenewsAt: p.planRenewsAt,
    trial: trialFor(p.approvedAt, p.createdAt, today),
    invoices: invoices
      .filter((i) => i.status !== "void")
      .map((i) => ({ id: i.id, number: i.number, plan: i.plan, periodStart: i.periodStart, periodEnd: i.periodEnd, status: invoiceDisplayStatus(i, today) })),
  };
}

export const quoteFor = (p: PartnerRow, invoices: InvoiceRow[], plans: Plan[], target: PlanId, today = istDate()) => quoteChange(billingState(p, invoices, today), plans, target, today);

/** The plan timeline: trial start plus every subscription event in the activity log. */
export async function getPlanHistory(p: PartnerRow) {
  const rows = await getDb()
    .select({ id: partnerActivity.id, action: partnerActivity.action, summary: partnerActivity.summary, createdAt: partnerActivity.createdAt, by: users.name })
    .from(partnerActivity)
    .leftJoin(users, eq(users.id, partnerActivity.userId))
    .where(and(eq(partnerActivity.partnerId, p.id), eq(partnerActivity.entity, "subscription")))
    .orderBy(desc(partnerActivity.createdAt), desc(partnerActivity.id))
    .limit(50);
  const start = p.approvedAt ?? p.createdAt;
  return [
    ...rows.map((r) => ({ id: String(r.id), action: r.action, summary: r.summary, at: r.createdAt.toISOString(), by: r.by })),
    { id: "trial", action: "trial", summary: `Dealership approved — ${TRIAL_DAYS}-day free trial started`, at: start.toISOString(), by: null },
  ];
}

/* ── Parties on the invoice ───────────────────────────────────── */

export async function getBillingContent() {
  const { site, billing } = (await getCatalog()).content;
  const marchGear: BillingParty = { name: "MarchGear", lines: [site.address, [site.email, site.phone].filter(Boolean).join(" · ")].filter(Boolean) };
  const payment: PaymentDetails = {
    accountName: billing.accountName,
    bankName: billing.bankName,
    accountNumber: billing.accountNumber,
    ifsc: billing.ifsc,
    upi: billing.upi,
    instructions: billing.instructions,
  };
  return { marchGear, payment, marchGearAddress: site.address };
}

/** The dealer's billing address: their primary active showroom (falling back to the application's). */
export async function dealerParty(p: PartnerRow): Promise<BillingParty> {
  const [row] = await getDb()
    .select({ address: partnerShowrooms.address, city: partnerShowrooms.city, state: partnerShowrooms.state, pin: partnerShowrooms.pin })
    .from(partnerShowrooms)
    .where(and(eq(partnerShowrooms.partnerId, p.id), eq(partnerShowrooms.isActive, true)))
    .orderBy(desc(partnerShowrooms.isPrimary), partnerShowrooms.id)
    .limit(1);
  const app = p.application;
  const showroom = row ?? app.showrooms.find((s) => s.isPrimary) ?? app.showrooms[0];
  const name = p.legalName || app.business.legalName || p.tradeName || app.business.tradeName || "Dealer partner";
  const lines = [
    p.tradeName && p.tradeName !== name ? `Trading as ${p.tradeName}` : "",
    showroom?.address ?? "",
    [showroom?.city || p.city, showroom?.state || p.state, showroom?.pin].filter(Boolean).join(", "),
    `Partner ID ${p.reference}`,
  ].filter(Boolean);
  return { name, lines, gst: p.gst || app.business.gst || undefined, state: showroom?.state || p.state || "" };
}
