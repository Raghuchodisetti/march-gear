import type { InsInvoiceKind, InvoiceStatus, PlanStatus } from "@/db/enums";
import type { InsurerPlanId } from "@/content/blocks/insurer-plans";
import type { Tone } from "@/partner/labels";
import { formatDate } from "@/lib/format";
import { INS_INVOICE_KIND_LABEL } from "@/insurance/labels";
import { addDays, addMonths, daysBetween, isProrated, istDate, periodDays, periodEndFor, rupees, type BillingParty, type PaymentDetails } from "@/components/portal/billing/shared";

/* ──────────────────────────────────────────────────────────────
   Insurance vendor billing rules, shared by the vendor portal, the
   invoice PDF and the server (src/server/insurance/subscription.ts).
   Client-safe: no database imports. Dates are IST calendar days
   ("YYYY-MM-DD"). Prices come from the `insurerPlans` content block,
   the trial and payment terms from `insuranceSettings`.

   Plan status (ins_vendors.plan_status):
   - trial      no paid period yet; free until vendorTrialDays after approval
   - active     a paid (or free-plan) period runs until plan_renews_at − 1
   - past_due   the trial or the paid period ended and its invoice is unpaid
   - cancelled  the vendor chose a free plan: the paid plan runs until
                plan_renews_at − 1, then the free plan starts
   A ₹0 plan never raises an invoice.
   ────────────────────────────────────────────────────────────── */

export { addDays, istDate, rupees };

/** Renewal invoices are issued this many days before the renewal date (and are due on it). */
export const INS_RENEWAL_NOTICE_DAYS = 7;

export interface InsLimits {
  products: number | null;
  activeCampaigns: number | null;
  members: number | null;
}
export type InsUsage = Record<keyof InsLimits, number>;

export interface InsPlan {
  id: InsurerPlanId;
  name: string;
  monthly: number;
  summary: string;
  limits: InsLimits;
  features: string[];
}

const PLAN_ORDER: InsurerPlanId[] = ["basic", "professional", "enterprise"];

/** Plans from the `insurerPlans` content block, cheapest first. */
export function insPlansFromContent(block: {
  plans: { id: InsurerPlanId; name: string; monthly: number; summary: string; products: number | null; activeCampaigns: number | null; members: number | null; features: string[] }[];
}): InsPlan[] {
  return block.plans
    .map((p) => ({
      id: p.id,
      name: p.name,
      monthly: p.monthly,
      summary: p.summary,
      limits: { products: p.products, activeCampaigns: p.activeCampaigns, members: p.members },
      features: p.features,
    }))
    .sort((a, b) => a.monthly - b.monthly || PLAN_ORDER.indexOf(a.id) - PLAN_ORDER.indexOf(b.id));
}

export const insPlanName = (plans: InsPlan[], id: string | null | undefined) =>
  !id ? "—" : (plans.find((p) => p.id === id)?.name ?? id.charAt(0).toUpperCase() + id.slice(1));

export const INS_USAGE_LABEL: Record<keyof InsLimits, string> = {
  products: "Published products",
  activeCampaigns: "Promotional campaigns",
  members: "Team members",
};
export const INS_USAGE_NOTE: Record<keyof InsLimits, string> = {
  products: "Products live on the insurance pages.",
  activeCampaigns: "Live, scheduled, paused or awaiting approval.",
  members: "Active people in your team.",
};

/* ── Trial ────────────────────────────────────────────────────── */

export interface InsTrial {
  days: number;
  start: string;
  /** Last free day. */
  lastDay: string;
  /** First billable day — the first invoice's period starts here. */
  firstBillable: string;
  daysLeft: number;
  ended: boolean;
}

export function insTrialFor(approvedAt: Date | string | null, createdAt: Date | string, trialDays: number, today = istDate()): InsTrial {
  const start = istDate(approvedAt ?? createdAt);
  const firstBillable = addDays(start, trialDays);
  return {
    days: trialDays,
    start,
    lastDay: addDays(firstBillable, -1),
    firstBillable,
    daysLeft: Math.max(0, daysBetween(today, firstBillable)),
    ended: today >= firstBillable,
  };
}

/** The first monthly anniversary of `anchor` that is after `today` (a free plan's next "renewal"). */
export function nextAnniversary(anchor: string, today = istDate()) {
  let n = 0;
  let r = anchor;
  while (r <= today && n < 1200) r = addMonths(anchor, ++n);
  return r;
}

export const INS_PLAN_STATUS_LABEL: Record<PlanStatus, string> = { trial: "Free trial", active: "Active", past_due: "Payment due", cancelled: "Ending" };
export const INS_PLAN_STATUS_TONE: Record<PlanStatus, Tone> = { trial: "blue", active: "green", past_due: "red", cancelled: "amber" };

/* ── Plan changes ─────────────────────────────────────────────── */

export interface InsBillingState {
  plan: string;
  planStatus: PlanStatus;
  planRenewsAt: string | null;
  trial: InsTrial;
  /** Subscription invoices that aren't void, with their display status. */
  invoices: { id: number; number: string; plan: string | null; periodStart: string; periodEnd: string; status: InvoiceStatus }[];
  /** The free plan a cancelled (ending) paid plan moves to. */
  scheduledPlan: string | null;
}

/** Where the vendor is in the billing cycle. */
export type InsPhase = "trial" | "unpaid" | "free" | "paid";

export function insPhase(s: Pick<InsBillingState, "plan" | "planStatus" | "planRenewsAt" | "trial">, plans: InsPlan[], today = istDate()): InsPhase {
  if (!s.planRenewsAt && s.planStatus !== "past_due" && !s.trial.ended) return "trial";
  if (s.planStatus === "past_due" || !s.planRenewsAt) return "unpaid";
  const price = plans.find((p) => p.id === s.plan)?.monthly ?? 0;
  if (price === 0) return "free";
  return s.planRenewsAt > today ? "paid" : "unpaid";
}

export const insPlanChangeRules = (paymentTermsDays: number) => [
  "Free trial: switch plans as often as you like at no charge. Your first invoice uses the plan you're on when the trial ends.",
  "Upgrade during a paid period: you're invoiced now for the price difference for the days left in the period (prorated daily). The new plan starts as soon as MarchGear verifies the payment.",
  "Move to a cheaper paid plan: takes effect at your next renewal. We issue that period's invoice at the lower price — there's no refund for the current period.",
  "Move to a free plan: your paid plan runs to the end of the period you've paid for, then the free plan starts. Free plans never raise invoices.",
  "Trial ended or renewal unpaid: the unpaid invoice is replaced with one for the new plan.",
  `Invoices are due within ${paymentTermsDays} day${paymentTermsDays === 1 ? "" : "s"}. Changes are paused while a payment is being verified.`,
];

export type InsChangeKind = "trial_switch" | "free_now" | "start_paid" | "replace_unpaid" | "prorated_upgrade" | "next_period" | "free_at_renewal" | "keep_plan";

export interface InsChangeInvoice {
  plan: InsurerPlanId;
  periodStart: string;
  periodEnd: string;
  amount: number;
  dueOn: string;
  prorated: boolean;
}

export interface InsChangeQuote {
  target: InsurerPlanId;
  kind: InsChangeKind | null;
  /** Why the change can't be requested right now. */
  blocked?: string;
  /** Invoices the change raises (pre-GST amounts). Never for a ₹0 plan. */
  invoices: InsChangeInvoice[];
  /** Unpaid subscription invoices (numbers) the change voids. */
  replaces: string[];
  /** When the new plan applies. */
  effective: string;
  /** What changes on the vendor row straight away. */
  vendor: { plan?: InsurerPlanId; planStatus?: PlanStatus; planRenewsAt?: string | null };
  summary: string;
}

const unpaid = (i: { status: InvoiceStatus }) => i.status === "due" || i.status === "overdue";
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const an = (w: string) => `${/^[aeiou]/i.test(w) ? "an" : "a"} ${w}`;

/** What requesting `target` would do right now. Pure — the server action recomputes it before acting. */
export function insQuoteChange(state: InsBillingState, plans: InsPlan[], target: InsurerPlanId, paymentTermsDays: number, today = istDate()): InsChangeQuote {
  const to = plans.find((p) => p.id === target);
  const from = plans.find((p) => p.id === state.plan);
  const none: InsChangeQuote = { target, kind: null, invoices: [], replaces: [], effective: today, vendor: {}, summary: "" };
  const ending = state.planStatus === "cancelled";
  if (!to) return { ...none, blocked: "That plan isn't offered any more." };
  if (target === state.plan && !ending) return { ...none, blocked: `You're already on the ${to.name} plan.` };
  if (state.invoices.some((i) => i.status === "verifying"))
    return { ...none, blocked: "A subscription payment is being verified by MarchGear. You can change plan once it's confirmed." };

  const dueOn = addDays(today, paymentTermsDays);
  const phase = insPhase(state, plans, today);
  const open = state.invoices.filter(unpaid);
  const gst = (n: number) => `${rupees(n)} + GST`;

  if (phase === "trial") {
    return {
      ...none,
      kind: "trial_switch",
      vendor: { plan: target },
      summary: to.monthly
        ? `Switches your trial to ${to.name} now, free. Your first invoice (${gst(to.monthly)} a month) is issued when the trial ends on ${formatDate(state.trial.lastDay)}.`
        : `Switches your trial to ${to.name} now. ${to.name} is free — it never raises an invoice, even after the trial ends on ${formatDate(state.trial.lastDay)}.`,
    };
  }

  if (phase === "unpaid" || phase === "free") {
    // No paid period running.
    if (to.monthly === 0) {
      const anchor = state.planRenewsAt ?? state.trial.firstBillable;
      return {
        target,
        kind: "free_now",
        invoices: [],
        replaces: open.map((i) => i.number),
        effective: today,
        vendor: { plan: target, planStatus: "active", planRenewsAt: nextAnniversary(anchor, today) },
        summary: `Moves you to ${to.name} straight away. ${to.name} is free, so no invoice is raised${open.length ? ` and unpaid invoice ${open.map((i) => i.number).join(", ")} is cancelled` : ""}. Its limits apply from today.`,
      };
    }
    if (phase === "unpaid") {
      // Replace the unpaid invoice(s) for the current period with the new plan's.
      const sorted = [...open].sort((a, b) => a.periodStart.localeCompare(b.periodStart));
      const base = sorted.find((i) => !isProrated(i.periodStart, i.periodEnd)) ?? null;
      const start = base?.periodStart ?? state.planRenewsAt ?? state.trial.firstBillable;
      const end = periodEndFor(start);
      const replaces = sorted.filter((i) => i.periodStart >= start || isProrated(i.periodStart, i.periodEnd)).map((i) => i.number);
      return {
        target,
        kind: "replace_unpaid",
        invoices: [{ plan: target, periodStart: start, periodEnd: end, amount: to.monthly, dueOn, prorated: false }],
        replaces,
        effective: today,
        vendor: {},
        summary: `Issues ${an(to.name)} invoice for ${formatDate(start)} – ${formatDate(end)} (${gst(to.monthly)})${replaces.length ? `, replacing unpaid invoice ${replaces.join(", ")}` : ""}. ${to.name} starts once MarchGear verifies your payment.`,
      };
    }
    // On a free plan → a paid one: a fresh monthly period from today.
    const end = periodEndFor(today);
    return {
      target,
      kind: "start_paid",
      invoices: [{ plan: target, periodStart: today, periodEnd: end, amount: to.monthly, dueOn, prorated: false }],
      replaces: open.map((i) => i.number),
      effective: today,
      vendor: {},
      summary: `Issues ${an(to.name)} invoice for ${formatDate(today)} – ${formatDate(end)} (${gst(to.monthly)}, due ${formatDate(dueOn)}). You stay on ${from?.name ?? "your current plan"} until MarchGear verifies the payment, then ${to.name} starts and renews monthly.`,
    };
  }

  // A paid period is running until renewsAt − 1.
  const renewsAt = state.planRenewsAt!;
  const lastPaid = addDays(renewsAt, -1);
  const current = from?.monthly ?? 0;
  const pendingRenewal = state.invoices.filter((i) => unpaid(i) && i.periodStart >= renewsAt);
  const pendingUpgrades = state.invoices.filter((i) => unpaid(i) && i.periodStart < renewsAt && isProrated(i.periodStart, i.periodEnd));
  const replaces = [...pendingUpgrades, ...pendingRenewal].map((i) => i.number);
  const nextEnd = periodEndFor(renewsAt);
  const next: InsChangeInvoice = { plan: target, periodStart: renewsAt, periodEnd: nextEnd, amount: to.monthly, dueOn: renewsAt > today ? renewsAt : dueOn, prorated: false };

  if (ending && target === state.plan) {
    return {
      target,
      kind: "keep_plan",
      invoices: [],
      replaces: [],
      effective: today,
      vendor: { planStatus: "active" },
      summary: `Keeps you on ${to.name} after ${formatDate(lastPaid)} instead of moving to ${insPlanName(plans, state.scheduledPlan)}. The renewal invoice (${gst(to.monthly)}) is issued ${INS_RENEWAL_NOTICE_DAYS} days before ${formatDate(renewsAt)}.`,
    };
  }

  if (to.monthly === 0) {
    if (ending && state.scheduledPlan === target) return { ...none, blocked: `Already scheduled — you move to ${to.name} on ${formatDate(renewsAt)}.` };
    return {
      target,
      kind: "free_at_renewal",
      invoices: [],
      replaces,
      effective: renewsAt,
      vendor: { planStatus: "cancelled" },
      summary: `Your ${from?.name ?? "current"} plan continues until ${formatDate(lastPaid)}, then you move to ${to.name} (free) on ${formatDate(renewsAt)}. No renewal invoice is issued${replaces.length ? ` and unpaid invoice ${replaces.join(", ")} is cancelled` : ""}. No refund for the current period. Make sure you're within ${to.name}'s limits by then.`,
    };
  }

  if (to.monthly > current) {
    const end = lastPaid;
    const paid = state.invoices.find((i) => i.status === "paid" && i.periodStart <= today && i.periodEnd >= today && !isProrated(i.periodStart, i.periodEnd));
    const full = paid ? periodDays(paid.periodStart, paid.periodEnd) : periodDays(addMonths(renewsAt, -1), end);
    const left = periodDays(today, end);
    const amount = Math.max(1, Math.round(((to.monthly - current) * left) / full));
    const invoices: InsChangeInvoice[] = [{ plan: target, periodStart: today, periodEnd: end, amount, dueOn, prorated: true }];
    if (pendingRenewal.length) invoices.push(next);
    return {
      target,
      kind: "prorated_upgrade",
      invoices,
      replaces,
      effective: today,
      vendor: ending ? { planStatus: "active" } : {},
      summary: `Invoices ${gst(amount)} now for ${plural(left, "remaining day")} at the ${to.name} price (${rupees(to.monthly - current)}/month more, prorated over ${full} days)${invoices.length > 1 ? `, and issues your renewal from ${formatDate(renewsAt)} at ${rupees(to.monthly)}` : ""}. ${to.name} starts as soon as MarchGear verifies the payment; renewals continue on ${formatDate(renewsAt)}.`,
    };
  }

  return {
    target,
    kind: "next_period",
    invoices: [next],
    replaces,
    effective: renewsAt,
    vendor: ending ? { planStatus: "active" } : {},
    summary: `Your ${from?.name ?? "current"} plan continues until ${formatDate(lastPaid)}. ${to.name} starts on ${formatDate(renewsAt)} — we issue that period's invoice now (${gst(to.monthly)}, due ${formatDate(next.dueOn)})${replaces.length ? `, replacing unpaid invoice ${replaces.join(", ")}` : ""}. No refund for the current period.`,
  };
}

/**
 * What a verified payment of a subscription invoice does to the vendor's plan — for the admin's payment
 * verification (the portal also self-heals this on its next page load via ensureInsBillingState()).
 * Null for other invoice kinds.
 */
export function insPlanAfterPaid(
  vendor: { plan: string; planRenewsAt: string | null },
  invoice: { kind: InsInvoiceKind; plan: string | null; periodStart: string; periodEnd: string },
  today = istDate(),
): { plan: string; planStatus: PlanStatus; planRenewsAt: string } | null {
  if (invoice.kind !== "subscription" || !invoice.plan) return null;
  const next = addDays(invoice.periodEnd, 1);
  const renewsAt = vendor.planRenewsAt && vendor.planRenewsAt > next ? vendor.planRenewsAt : next;
  return { plan: invoice.periodStart <= today ? invoice.plan : vendor.plan, planStatus: renewsAt > today ? "active" : "past_due", planRenewsAt: renewsAt };
}

/** The line on a subscription invoice. */
export function insSubscriptionLine(planName: string, periodStart: string, periodEnd: string) {
  return isProrated(periodStart, periodEnd) ? `${planName} plan — prorated upgrade (${periodDays(periodStart, periodEnd)} days)` : `${planName} plan — monthly subscription`;
}

/* ── Invoices ─────────────────────────────────────────────────── */

export interface InsInvoiceView {
  id: number;
  number: string;
  kind: InsInvoiceKind;
  kindLabel: string;
  /** The main line, e.g. "Professional plan — monthly subscription". */
  line: string;
  /** What the line is for, e.g. "MarchGear insurance vendor subscription". */
  detail: string;
  plan: string | null;
  adCampaignId: number | null;
  adCampaignRef: string | null;
  periodStart: string;
  periodEnd: string;
  amount: number;
  gst: number;
  total: number;
  status: InvoiceStatus;
  display: InvoiceStatus;
  dueOn: string;
  issuedOn: string;
  paidAt: string | null;
}

export const INS_KIND_DETAIL: Record<InsInvoiceKind, string> = {
  subscription: "MarchGear insurance marketplace — vendor subscription",
  advertising: "MarchGear advertising placement",
  lead_fee: "Fee per verified policy conversion",
  other: "MarchGear insurance marketplace",
};

export const insKindLabel = (k: InsInvoiceKind) => INS_INVOICE_KIND_LABEL[k];

export const isPayable = (display: InvoiceStatus) => display === "due" || display === "overdue";

/** Shown wherever MarchGear's bank / UPI details would be, while the `billing` block is empty. */
export const INS_NO_PAYMENT_DETAILS = "MarchGear's accounts team will share payment details.";

export interface InsInvoicePdfData {
  invoice: InsInvoiceView;
  from: BillingParty;
  to: BillingParty;
  payment: PaymentDetails;
  intraState: boolean;
  placeOfSupply: string;
}

/* ── Transactions ─────────────────────────────────────────────── */

export interface InsTransaction {
  key: string;
  type: "payment" | "refund";
  id: number;
  invoiceId: number;
  invoiceNumber: string;
  invoiceKind: InsInvoiceKind;
  amount: number;
  /** Payments: bank_transfer / upi / cheque. */
  method: string | null;
  reference: string;
  /** IST day the money moved. */
  on: string;
  recordedAt: string;
  status: "submitted" | "verified" | "rejected" | "refunded";
  remarks: string | null;
  proof: { id: number; filename: string } | null;
}
