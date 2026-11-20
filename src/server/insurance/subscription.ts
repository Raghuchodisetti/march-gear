import "server-only";
import { and, count, desc, eq, gte, inArray, ne, notInArray } from "drizzle-orm";
import { getDb } from "@/db";
import { adCampaigns, insActivity, insBranches, insCampaigns, insInvoices, insMembers, insPayments, insProducts, insRefunds, insVendors, users } from "@/db/schema";
import { formatDate } from "@/lib/format";
import { getCatalog } from "@/server/catalog";
import type { BillingParty, PaymentDetails } from "@/components/portal/billing/shared";
import { isProrated, periodEndFor } from "@/components/portal/billing/shared";
import {
  INS_KIND_DETAIL,
  INS_RENEWAL_NOTICE_DAYS,
  addDays,
  insKindLabel,
  insPlanName,
  insPlansFromContent,
  insQuoteChange,
  insSubscriptionLine,
  insTrialFor,
  istDate,
  nextAnniversary,
  rupees,
  type InsBillingState,
  type InsInvoiceView,
  type InsPlan,
  type InsUsage,
} from "@/components/insurance/vendor/billing/shared";
import type { InsurerPlanId } from "@/content/blocks/insurer-plans";
import { insInvoiceDisplayStatus, insertInsInvoice, type InsInvoiceRow } from "./billing";
import type { VendorRow } from "./context";
import { logInsurerActivity, notifyInsurer } from "./records";

/* ──────────────────────────────────────────────────────────────
   Insurance vendor subscriptions (plans from `insurerPlans`, trial
   and payment terms from `insuranceSettings`), plan limits, and the
   data behind Billing, Invoices and Transactions.

   There's no cron and no payment gateway: trial-end and renewal
   invoices are raised on demand by ensureInsBillingState() when the
   billing or invoices pages load; vendors pay by bank transfer / UPI
   / cheque and record the UTR; staff verify it. A ₹0 plan never
   raises an invoice.
   ────────────────────────────────────────────────────────────── */

export async function getInsPlans(): Promise<InsPlan[]> {
  return insPlansFromContent((await getCatalog()).content.insurerPlans);
}

export async function getInsBillingSettings() {
  const s = (await getCatalog()).content.insuranceSettings;
  return { trialDays: s.vendorTrialDays, paymentTermsDays: s.paymentTermsDays };
}

/* ── Limits ───────────────────────────────────────────────────── */

/**
 * Campaigns that take a slot of the plan's `activeCampaigns`: approved ones that haven't ended (running or
 * scheduled), paused ones that haven't ended (they resume without review, so they keep their slot), and ones
 * waiting for approval.
 */
export async function campaignSlotsUsed(vendorId: number, excludeId?: number) {
  const now = new Date();
  const scope = and(eq(insCampaigns.vendorId, vendorId), excludeId ? notInArray(insCampaigns.id, [excludeId]) : undefined);
  const db = getDb();
  const [[{ live }], [{ pending }]] = await Promise.all([
    db.select({ live: count() }).from(insCampaigns).where(and(scope, inArray(insCampaigns.status, ["approved", "paused"]), gte(insCampaigns.endsAt, now))),
    db.select({ pending: count() }).from(insCampaigns).where(and(scope, eq(insCampaigns.status, "pending_approval"))),
  ]);
  return live + pending;
}

/** Null when one more campaign fits the vendor's plan; otherwise a message for the vendor. */
export async function campaignLimitError(vendorId: number, plan: string, excludeId?: number) {
  const plans = await getInsPlans();
  const limit = plans.find((p) => p.id === plan)?.limits.activeCampaigns ?? null;
  if (limit === null) return null;
  const used = await campaignSlotsUsed(vendorId, excludeId);
  if (used < limit) return null;
  return `Your ${insPlanName(plans, plan)} plan allows ${limit} promotional campaign${limit === 1 ? "" : "s"} at a time and you have ${used} (live, scheduled, paused or awaiting approval). Let one end, cancel one, or upgrade in Billing.`;
}

/** What the vendor uses against its plan's limits right now. */
export async function getInsUsage(vendorId: number): Promise<InsUsage> {
  const db = getDb();
  const [[p], campaigns, [m]] = await Promise.all([
    db.select({ n: count() }).from(insProducts).where(and(eq(insProducts.vendorId, vendorId), eq(insProducts.status, "published"))),
    campaignSlotsUsed(vendorId),
    db.select({ n: count() }).from(insMembers).where(and(eq(insMembers.vendorId, vendorId), eq(insMembers.isActive, true))),
  ]);
  return { products: p.n, activeCampaigns: campaigns, members: m.n };
}

/* ── On-demand billing (no cron) ──────────────────────────────── */

/** The free plan an ending (cancelled) paid plan moves to: the one the vendor chose, else the cheapest free plan. */
export async function scheduledFreePlan(vendorId: number, plans: InsPlan[]): Promise<InsurerPlanId | null> {
  const free = plans.filter((p) => p.monthly === 0);
  if (!free.length) return null;
  const [row] = await getDb()
    .select({ to: insActivity.entityId })
    .from(insActivity)
    .where(and(eq(insActivity.vendorId, vendorId), eq(insActivity.entity, "subscription"), eq(insActivity.action, "plan_scheduled")))
    .orderBy(desc(insActivity.id))
    .limit(1);
  return free.find((p) => p.id === row?.to)?.id ?? free[0].id;
}

/**
 * Brings the vendor's subscription up to date. Idempotent; the vendor row is locked so two page loads
 * can't both raise an invoice.
 * - trial running → plan status "trial";
 * - trial over → first invoice for the plan they're on ("payment due"), or straight to "active" on a free plan;
 * - a paid subscription invoice extends the paid period (and starts its plan once its period begins);
 * - renewal within INS_RENEWAL_NOTICE_DAYS → renewal invoice, due on the renewal date; unpaid after it → "payment due";
 * - an ending (cancelled) paid plan moves to the chosen free plan on its renewal date;
 * - free plans just roll their monthly anniversary forward.
 */
export async function ensureInsBillingState(vendorId: number) {
  const today = istDate();
  const [plans, settings] = await Promise.all([getInsPlans(), getInsBillingSettings()]);
  const scheduled = await scheduledFreePlan(vendorId, plans);
  const price = (id: string | null) => plans.find((p) => p.id === id)?.monthly ?? 0;
  const issued: { id: number; number: string; title: string; body: string }[] = [];
  const events: { action: string; summary: string }[] = [];

  await getDb().transaction(async (tx) => {
    const [v] = await tx.select().from(insVendors).where(eq(insVendors.id, vendorId)).for("update");
    if (!v || v.status !== "approved") return;
    const subs = await tx
      .select()
      .from(insInvoices)
      .where(and(eq(insInvoices.vendorId, vendorId), eq(insInvoices.kind, "subscription"), ne(insInvoices.status, "void")));
    let plan = v.plan;
    let status = v.planStatus;
    let renewsAt = v.planRenewsAt;

    const issue = async (forPlan: string, periodStart: string, dueOn: string, title: string) => {
      const amount = price(forPlan);
      if (amount <= 0) return;
      const periodEnd = periodEndFor(periodStart);
      const name = insPlanName(plans, forPlan);
      const inv = await insertInsInvoice(
        { vendorId, kind: "subscription", description: insSubscriptionLine(name, periodStart, periodEnd), plan: forPlan, periodStart, periodEnd, amount, dueOn },
        tx,
      );
      issued.push({ id: inv.id, number: inv.number, title, body: `${name} plan, ${formatDate(periodStart)} – ${formatDate(periodEnd)}. Total ${rupees(inv.total)} incl. 18% GST, due ${formatDate(dueOn)}.` });
    };

    // Paid invoices extend the paid period (this also self-heals when staff only marked an invoice paid).
    const paid = subs.filter((i) => i.status === "paid");
    for (const i of paid) {
      const next = addDays(i.periodEnd, 1);
      if (!renewsAt || next > renewsAt) renewsAt = next;
    }
    const covering = paid
      .filter((i) => i.periodStart <= today && i.periodEnd >= today)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id)[0];
    if (covering?.plan && covering.plan !== plan) {
      plan = covering.plan;
      events.push({ action: "plan_start", summary: `${insPlanName(plans, plan)} plan started` });
    }
    if (covering && (status === "past_due" || status === "trial")) status = "active";

    if (!renewsAt) {
      const trial = insTrialFor(v.approvedAt, v.createdAt, settings.trialDays, today);
      if (!trial.ended) status = "trial";
      else if (price(plan) === 0) {
        status = "active";
        renewsAt = nextAnniversary(trial.firstBillable, today);
        events.push({ action: "trial_end", summary: `Free trial ended — the ${insPlanName(plans, plan)} plan is free, so no invoice was raised` });
      } else {
        status = "past_due";
        if (!subs.some((i) => i.periodStart === trial.firstBillable && !isProrated(i.periodStart, i.periodEnd)))
          await issue(plan, trial.firstBillable, addDays(today, settings.paymentTermsDays), "Your free trial has ended — first invoice issued");
      }
    } else if (status === "cancelled") {
      if (today >= renewsAt) {
        if (scheduled) {
          events.push({ action: "plan_start", summary: `${insPlanName(plans, plan)} plan ended — moved to ${insPlanName(plans, scheduled)} (free)` });
          plan = scheduled;
          status = "active";
          renewsAt = nextAnniversary(renewsAt, today);
        } else {
          // No free plan is offered any more: bill the plan they're on.
          status = "past_due";
          if (!subs.some((i) => i.periodStart === renewsAt)) await issue(plan, renewsAt, addDays(today, settings.paymentTermsDays), "Renewal invoice issued");
        }
      }
    } else if (price(plan) === 0) {
      status = "active";
      if (today >= renewsAt) renewsAt = nextAnniversary(renewsAt, today);
    } else {
      if (today >= addDays(renewsAt, -INS_RENEWAL_NOTICE_DAYS) && !subs.some((i) => i.periodStart === renewsAt)) {
        // A pending (unpaid or verifying) upgrade decides the renewal's plan.
        const upgrade = subs.find((i) => i.status !== "paid" && isProrated(i.periodStart, i.periodEnd) && i.periodEnd === addDays(renewsAt!, -1));
        await issue(upgrade?.plan ?? plan, renewsAt, renewsAt > today ? renewsAt : addDays(today, settings.paymentTermsDays), "Renewal invoice issued");
      }
      if (today >= renewsAt) status = "past_due";
    }

    const patch: Partial<typeof insVendors.$inferInsert> = {};
    if (plan !== v.plan) patch.plan = plan;
    if (status !== v.planStatus) patch.planStatus = status;
    if (renewsAt !== v.planRenewsAt) patch.planRenewsAt = renewsAt;
    if (Object.keys(patch).length) await tx.update(insVendors).set(patch).where(eq(insVendors.id, vendorId));
  });

  // Outside the transaction: these rows reference the locked vendor row.
  for (const e of events) await logInsurerActivity(vendorId, null, e.action, "subscription", null, e.summary);
  for (const i of issued) {
    await notifyInsurer(vendorId, { kind: "billing", title: `${i.title}: ${i.number}`, body: i.body, href: `/insurance-vendor/invoices/${i.id}` });
    await logInsurerActivity(vendorId, null, "invoice", "subscription", i.number, `${i.title} (${i.number})`);
  }
}

/** The billing state the plan-change rules work from. */
export function insBillingStateFor(v: VendorRow, invoices: InsInvoiceRow[], trialDays: number, scheduled: string | null, today = istDate()): InsBillingState {
  return {
    plan: v.plan,
    planStatus: v.planStatus,
    planRenewsAt: v.planRenewsAt,
    trial: insTrialFor(v.approvedAt, v.createdAt, trialDays, today),
    invoices: invoices
      .filter((i) => i.kind === "subscription" && i.status !== "void")
      .map((i) => ({ id: i.id, number: i.number, plan: i.plan, periodStart: i.periodStart, periodEnd: i.periodEnd, status: insInvoiceDisplayStatus(i, today) })),
    scheduledPlan: scheduled,
  };
}

export const insQuoteFor = (v: VendorRow, invoices: InsInvoiceRow[], plans: InsPlan[], target: InsurerPlanId, settings: { trialDays: number; paymentTermsDays: number }, scheduled: string | null, today = istDate()) =>
  insQuoteChange(insBillingStateFor(v, invoices, settings.trialDays, scheduled, today), plans, target, settings.paymentTermsDays, today);

/* ── Invoices, payments, refunds ──────────────────────────────── */

export async function getInsInvoiceRows(vendorId: number) {
  return getDb().select().from(insInvoices).where(eq(insInvoices.vendorId, vendorId)).orderBy(desc(insInvoices.createdAt), desc(insInvoices.id));
}

/** References of the vendor's own ad campaigns (for advertising invoices). */
export async function getAdRefs(vendorId: number, ids: (number | null)[]) {
  const wanted = [...new Set(ids.filter((i): i is number => typeof i === "number"))];
  if (!wanted.length) return new Map<number, { reference: string; name: string }>();
  const rows = await getDb()
    .select({ id: adCampaigns.id, reference: adCampaigns.reference, name: adCampaigns.name })
    .from(adCampaigns)
    .where(and(eq(adCampaigns.insVendorId, vendorId), inArray(adCampaigns.id, wanted)));
  return new Map(rows.map((r) => [r.id, { reference: r.reference, name: r.name }]));
}

export function toInsInvoiceView(r: InsInvoiceRow, plans: InsPlan[], ads: Map<number, { reference: string; name: string }>, today = istDate()): InsInvoiceView {
  const ad = r.adCampaignId ? ads.get(r.adCampaignId) : undefined;
  const line = r.description || (r.kind === "subscription" ? insSubscriptionLine(insPlanName(plans, r.plan), r.periodStart, r.periodEnd) : insKindLabel(r.kind));
  const detail = r.kind === "advertising" && ad ? `Advertising campaign ${ad.reference} · ${ad.name}` : INS_KIND_DETAIL[r.kind];
  return {
    id: r.id,
    number: r.number,
    kind: r.kind,
    kindLabel: insKindLabel(r.kind),
    line,
    detail,
    plan: r.plan,
    adCampaignId: r.adCampaignId,
    adCampaignRef: ad?.reference ?? null,
    periodStart: r.periodStart,
    periodEnd: r.periodEnd,
    amount: r.amount,
    gst: r.gst,
    total: r.total,
    status: r.status,
    display: insInvoiceDisplayStatus(r, today),
    dueOn: r.dueOn,
    issuedOn: istDate(r.createdAt),
    paidAt: r.paidAt ? r.paidAt.toISOString() : null,
  };
}

export async function getInsPayments(vendorId: number, invoiceId?: number) {
  return getDb()
    .select({ payment: insPayments, number: insInvoices.number, kind: insInvoices.kind })
    .from(insPayments)
    .innerJoin(insInvoices, eq(insInvoices.id, insPayments.invoiceId))
    .where(and(eq(insPayments.vendorId, vendorId), invoiceId ? eq(insPayments.invoiceId, invoiceId) : undefined))
    .orderBy(desc(insPayments.createdAt), desc(insPayments.id))
    .limit(1000);
}

export async function getInsRefunds(vendorId: number, invoiceId?: number) {
  return getDb()
    .select({ refund: insRefunds, number: insInvoices.number, kind: insInvoices.kind })
    .from(insRefunds)
    .innerJoin(insInvoices, eq(insInvoices.id, insRefunds.invoiceId))
    .where(and(eq(insRefunds.vendorId, vendorId), invoiceId ? eq(insRefunds.invoiceId, invoiceId) : undefined))
    .orderBy(desc(insRefunds.createdAt), desc(insRefunds.id))
    .limit(1000);
}

/* ── Parties on the invoice ───────────────────────────────────── */

/** MarchGear (from `site`) and its payment details (from the `billing` block — empty until the accounts team fills it in). */
export async function getInsBillingContent() {
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

/** The vendor's billing address: their primary active branch (falling back to the application's registered address). */
export async function insVendorParty(v: VendorRow): Promise<BillingParty> {
  const [b] = await getDb()
    .select({ address: insBranches.address, city: insBranches.city, state: insBranches.state, pin: insBranches.pin })
    .from(insBranches)
    .where(and(eq(insBranches.vendorId, v.id), eq(insBranches.isActive, true)))
    .orderBy(desc(insBranches.isPrimary), insBranches.id)
    .limit(1);
  const app = v.application;
  const name = v.legalName || app.company.legalName || v.brandName || app.company.brandName || "Insurance vendor";
  const brand = v.brandName || app.company.brandName;
  const addr = b ?? { address: app.company.address, city: app.company.city || v.city || "", state: app.company.state || v.state || "", pin: app.company.pin };
  const lines = [brand && brand !== name ? `Trading as ${brand}` : "", addr.address, [addr.city, addr.state, addr.pin].filter(Boolean).join(", "), `Vendor ID ${v.reference}`].filter(Boolean);
  return { name, lines, gst: v.gst || app.registration.gstin || undefined, state: addr.state || v.state || "" };
}

/* ── Plan history ─────────────────────────────────────────────── */

/** The plan timeline: trial start plus every subscription event in the activity log. */
export async function getInsPlanHistory(v: VendorRow, trialDays: number) {
  const rows = await getDb()
    .select({ id: insActivity.id, action: insActivity.action, summary: insActivity.summary, createdAt: insActivity.createdAt, by: users.name })
    .from(insActivity)
    .leftJoin(users, eq(users.id, insActivity.userId))
    .where(and(eq(insActivity.vendorId, v.id), eq(insActivity.entity, "subscription")))
    .orderBy(desc(insActivity.createdAt), desc(insActivity.id))
    .limit(50);
  const start = v.approvedAt ?? v.createdAt;
  return [
    ...rows.map((r) => ({ id: String(r.id), action: r.action, summary: r.summary, at: r.createdAt.toISOString(), by: r.by })),
    { id: "trial", action: "trial", summary: `Company approved — ${trialDays}-day free trial started`, at: start.toISOString(), by: null },
  ];
}
