import type { InvoiceStatus, PaymentStatus, PlanStatus } from "@/db/enums";
import { GST_RATE } from "@/partner/plans";
import type { Tone } from "@/partner/labels";
import { formatDate } from "@/lib/format";

/* ──────────────────────────────────────────────────────────────
   Billing rules shared by the dealer portal, the admin panel and
   the PDF builder. Client-safe: no database imports.
   Dates are IST calendar days as "YYYY-MM-DD" strings.
   ────────────────────────────────────────────────────────────── */

export { GST_RATE };

/** Free trial for newly approved dealerships, counted from the approval day. */
export const TRIAL_DAYS = 30;
/** Invoices are due this many days after they're issued. */
export const PAYMENT_TERMS_DAYS = 7;
/** Renewal invoices are issued this many days before the renewal date (and are due on it). */
export const RENEWAL_NOTICE_DAYS = 7;

export type PlanId = "starter" | "growth" | "enterprise";
export const PLAN_IDS: PlanId[] = ["starter", "growth", "enterprise"];

export interface Plan {
  id: PlanId;
  name: string;
  monthly: number;
  summary: string;
  limits: { listings: number | null; activeOffers: number | null; staff: number | null; showrooms: number | null };
  features: string[];
}

/** Plans from the `partnerPlans` content block, cheapest first. */
export function plansFromContent(block: {
  plans: { id: PlanId; name: string; monthly: number; summary: string; listings: number | null; activeOffers: number | null; staff: number | null; showrooms: number | null; features: string[] }[];
}): Plan[] {
  return block.plans
    .map((p) => ({
      id: p.id,
      name: p.name,
      monthly: p.monthly,
      summary: p.summary,
      limits: { listings: p.listings, activeOffers: p.activeOffers, staff: p.staff, showrooms: p.showrooms },
      features: p.features,
    }))
    .sort((a, b) => a.monthly - b.monthly || PLAN_IDS.indexOf(a.id) - PLAN_IDS.indexOf(b.id));
}

export const USAGE_LABEL: Record<keyof Plan["limits"], string> = {
  listings: "Live listings",
  activeOffers: "Active offers",
  staff: "Staff accounts",
  showrooms: "Showrooms",
};

/* ── Dates (IST days) ─────────────────────────────────────────── */

const DAY = 86_400_000;
const IST_OFFSET = 5.5 * 3_600_000;

/** The IST calendar day of an instant. */
export const istDate = (d: Date | string = new Date()) => new Date(new Date(d).getTime() + IST_OFFSET).toISOString().slice(0, 10);

const utc = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const addDays = (iso: string, n: number) => fromUtc(utc(iso) + n * DAY);
/** Whole days from a to b (b − a). */
export const daysBetween = (a: string, b: string) => Math.round((utc(b) - utc(a)) / DAY);

/** Same day next month, clamped to the month's last day (31 Jan → 28/29 Feb). */
export function addMonths(iso: string, n: number) {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7)) - 1 + n;
  const d = Number(iso.slice(8, 10));
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return fromUtc(Date.UTC(y, m, Math.min(d, last)));
}

/** A monthly billing period starting on `start`: start … the day before the same date next month. */
export const periodEndFor = (start: string) => addDays(addMonths(start, 1), -1);
export const periodDays = (start: string, end: string) => daysBetween(start, end) + 1;
/** A period shorter than a full month is a prorated charge (e.g. a mid-period upgrade). */
export const isProrated = (start: string, end: string) => end < periodEndFor(start);

/* ── Trial ────────────────────────────────────────────────────── */

export interface TrialInfo {
  start: string;
  /** Last free day. */
  lastDay: string;
  /** First billable day — the first invoice's period starts here. */
  firstBillable: string;
  daysLeft: number;
  ended: boolean;
}

export function trialFor(approvedAt: Date | string | null, createdAt: Date | string, today = istDate()): TrialInfo {
  const start = istDate(approvedAt ?? createdAt);
  const firstBillable = addDays(start, TRIAL_DAYS);
  const daysLeft = Math.max(0, daysBetween(today, firstBillable));
  return { start, lastDay: addDays(firstBillable, -1), firstBillable, daysLeft, ended: today >= firstBillable };
}

/* ── Money ────────────────────────────────────────────────────── */

export const gstOn = (amount: number) => Math.round(amount * GST_RATE);

/**
 * GST split: CGST 9% + SGST 9% when the dealer is in the same state as MarchGear's registered
 * address, otherwise IGST 18%. Halves are rounded so they always add up to the invoice's GST.
 */
export function gstSplit(gst: number, intraState: boolean) {
  if (!intraState) return { intraState, cgst: 0, sgst: 0, igst: gst };
  const cgst = Math.round(gst / 2);
  return { intraState, cgst, sgst: gst - cgst, igst: 0 };
}

/** Whether the dealer's state appears in MarchGear's address (content block `site.address`). */
export const sameState = (dealerState: string | null | undefined, marchGearAddress: string) =>
  Boolean(dealerState && marchGearAddress.toLowerCase().includes(dealerState.trim().toLowerCase()));

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
/** ₹12,999 */
export const rupees = (n: number) => `₹${inr.format(Math.round(n))}`;
/** Rs. 12,999 — for the PDF (its built-in fonts have no ₹ glyph). */
export const rs = (n: number) => `Rs. ${inr.format(Math.round(n))}`;

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const below100 = (n: number) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`);
const below1000 = (n: number) => (n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${below100(n % 100)}` : ""}` : below100(n));

/** 35397 → "Rupees Thirty-Five Thousand Three Hundred Ninety Seven only" (Indian numbering). */
export function amountInWords(amount: number) {
  let n = Math.round(Math.abs(amount));
  if (n === 0) return "Rupees Zero only";
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  n %= 10_000_000;
  const lakh = Math.floor(n / 100_000);
  n %= 100_000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(`${below1000(crore)} Crore`);
  if (lakh) parts.push(`${below100(lakh)} Lakh`);
  if (thousand) parts.push(`${below100(thousand)} Thousand`);
  if (n) parts.push(below1000(n));
  return `Rupees ${parts.join(" ")} only`;
}

/* ── Statuses ─────────────────────────────────────────────────── */

/** "Overdue" is derived: a due invoice past its due date. */
export function invoiceDisplayStatus(inv: { status: InvoiceStatus; dueOn: string }, today = istDate()): InvoiceStatus {
  return inv.status === "due" && inv.dueOn < today ? "overdue" : inv.status;
}

export const UNPAID: InvoiceStatus[] = ["due", "overdue"];

export const PLAN_STATUS_TONE: Record<PlanStatus, Tone> = { trial: "blue", active: "green", past_due: "red", cancelled: "neutral" };
export const PAYMENT_STATUS_TONE: Record<PaymentStatus, Tone> = { submitted: "blue", verified: "green", rejected: "red" };

export const PAYMENT_METHODS = ["bank_transfer", "upi", "cheque"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = { bank_transfer: "Bank transfer (NEFT/RTGS/IMPS)", upi: "UPI", cheque: "Cheque" };
export const PAYMENT_METHOD_SHORT: Record<PaymentMethod, string> = { bank_transfer: "Bank transfer", upi: "UPI", cheque: "Cheque" };
export const UTR_LABEL: Record<PaymentMethod, string> = { bank_transfer: "UTR number", upi: "UPI transaction ID", cheque: "Cheque number" };

/** What a line on an invoice is for. */
export function invoiceLine(inv: { plan: string; periodStart: string; periodEnd: string }, planName: string) {
  return isProrated(inv.periodStart, inv.periodEnd) ? `${planName} plan — prorated upgrade (${periodDays(inv.periodStart, inv.periodEnd)} days)` : `${planName} plan — monthly subscription`;
}

/* ── Serialised shapes passed to client components ───────────── */

export interface InvoiceView {
  id: number;
  number: string;
  plan: string;
  planName: string;
  line: string;
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

export interface BillingParty {
  name: string;
  lines: string[];
  gst?: string;
  /** Place of supply (the dealer's state). */
  state?: string;
}

/** MarchGear's payment details from the `billing` block — only the filled-in parts. */
export interface PaymentDetails {
  accountName: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  upi: string;
  instructions: string;
}

export const hasPaymentDetails = (b: PaymentDetails) => Boolean(b.accountNumber || b.upi);
export const NO_PAYMENT_DETAILS = "Our accounts team will share payment details.";

/* ── Plan changes ─────────────────────────────────────────────── */

export const PLAN_CHANGE_RULES = [
  "Free trial: switch plans as often as you like at no charge. Your first invoice uses the plan you're on when the trial ends.",
  "Upgrade during a paid period: you're invoiced now for the price difference for the days left in the period (prorated daily). The new plan starts as soon as MarchGear verifies the payment.",
  "Downgrade: takes effect at your next renewal. We issue the next period's invoice at the lower price — there's no refund for the current period.",
  "Trial ended or renewal unpaid: the unpaid invoice is replaced with one for the new plan's full monthly price.",
  "Requesting another change replaces any unpaid plan-change or renewal invoice. Changes are paused while a payment is being verified.",
];

export type ChangeKind = "trial_switch" | "replace_unpaid" | "prorated_upgrade" | "next_period";

export interface ChangeInvoice {
  plan: PlanId;
  periodStart: string;
  periodEnd: string;
  amount: number;
  dueOn: string;
}

export interface ChangeQuote {
  target: PlanId;
  kind: ChangeKind | null;
  /** Why the change can't be requested right now. */
  blocked?: string;
  /** Invoices issued by the change (pre-GST amounts). */
  invoices: ChangeInvoice[];
  /** Unpaid invoices (numbers) the change voids and replaces. */
  replaces: string[];
  /** When the new plan applies. */
  effective: string;
  summary: string;
}

export interface BillingStateInput {
  plan: string;
  planStatus: PlanStatus;
  planRenewsAt: string | null;
  trial: TrialInfo;
  invoices: { id: number; number: string; plan: string; periodStart: string; periodEnd: string; status: InvoiceStatus }[];
}

const unpaid = (i: { status: InvoiceStatus }) => i.status === "due" || i.status === "overdue";

/** What requesting `target` would do right now. Pure — the server action recomputes it before acting. */
export function quoteChange(state: BillingStateInput, plans: Plan[], target: PlanId, today = istDate()): ChangeQuote {
  const to = plans.find((p) => p.id === target);
  const from = plans.find((p) => p.id === state.plan);
  const none: ChangeQuote = { target, kind: null, invoices: [], replaces: [], effective: today, summary: "" };
  if (!to) return { ...none, blocked: "That plan isn't offered any more." };
  if (target === state.plan) return { ...none, blocked: `You're already on the ${to.name} plan.` };
  if (state.invoices.some((i) => i.status === "verifying"))
    return { ...none, blocked: "A payment is being verified by MarchGear. You can change plan once it's confirmed." };

  if (state.planStatus === "trial" && !state.trial.ended) {
    return {
      ...none,
      kind: "trial_switch",
      summary: `Switches your trial to ${to.name} now, free. Your first invoice (${rupees(to.monthly)} + GST) is issued when the trial ends on ${formatDate(state.trial.lastDay)}.`,
    };
  }

  const renewsAt = state.planRenewsAt;
  const paidRunning = state.planStatus === "active" && renewsAt && renewsAt > today;

  if (!paidRunning) {
    // No paid period running: replace the unpaid invoice(s) for the current period with the new plan's.
    const open = state.invoices.filter(unpaid).sort((a, b) => a.periodStart.localeCompare(b.periodStart));
    const base = open.find((i) => !isProrated(i.periodStart, i.periodEnd)) ?? null;
    const start = base?.periodStart ?? renewsAt ?? today;
    const end = periodEndFor(start);
    const replaces = open.filter((i) => i.periodStart >= start || isProrated(i.periodStart, i.periodEnd)).map((i) => i.number);
    return {
      target,
      kind: "replace_unpaid",
      invoices: [{ plan: target, periodStart: start, periodEnd: end, amount: to.monthly, dueOn: addDays(today, PAYMENT_TERMS_DAYS) }],
      replaces,
      effective: today,
      summary: `Issues a ${to.name} invoice for ${formatDate(start)} – ${formatDate(end)} (${rupees(to.monthly)} + GST)${replaces.length ? `, replacing unpaid invoice ${replaces.join(", ")}` : ""}. ${to.name} starts once MarchGear verifies your payment.`,
    };
  }

  const current = from?.monthly ?? 0;
  const pendingRenewal = state.invoices.filter((i) => unpaid(i) && i.periodStart >= renewsAt);
  const pendingUpgrades = state.invoices.filter((i) => unpaid(i) && i.periodStart < renewsAt && isProrated(i.periodStart, i.periodEnd));
  const replaces = [...pendingUpgrades, ...pendingRenewal].map((i) => i.number);
  const nextEnd = periodEndFor(renewsAt);
  const next: ChangeInvoice = { plan: target, periodStart: renewsAt, periodEnd: nextEnd, amount: to.monthly, dueOn: renewsAt };

  if (to.monthly > current) {
    const end = addDays(renewsAt, -1);
    const paid = state.invoices.find((i) => i.status === "paid" && i.periodStart <= today && i.periodEnd >= today);
    const full = paid ? periodDays(paid.periodStart, paid.periodEnd) : periodDays(addMonths(renewsAt, -1), end);
    const left = periodDays(today, end);
    const amount = Math.max(1, Math.round(((to.monthly - current) * left) / full));
    const invoices: ChangeInvoice[] = [{ plan: target, periodStart: today, periodEnd: end, amount, dueOn: addDays(today, PAYMENT_TERMS_DAYS) }];
    if (pendingRenewal.length) invoices.push(next);
    return {
      target,
      kind: "prorated_upgrade",
      invoices,
      replaces,
      effective: today,
      summary: `Invoices ${rupees(amount)} + GST now for ${left} remaining day${left === 1 ? "" : "s"} at the ${to.name} price (${rupees(to.monthly - current)}/month more, prorated over ${full} days)${pendingRenewal.length ? `, and reissues your upcoming renewal at ${rupees(to.monthly)}` : ""}. ${to.name} starts as soon as MarchGear verifies the payment; renewals continue on ${formatDate(renewsAt)}.`,
    };
  }

  return {
    target,
    kind: "next_period",
    invoices: [next],
    replaces,
    effective: renewsAt,
    summary: `Your ${from?.name ?? "current"} plan continues until ${formatDate(addDays(renewsAt, -1))}. ${to.name} starts on ${formatDate(renewsAt)} — we issue that period's invoice now (${rupees(to.monthly)} + GST, due ${formatDate(renewsAt)})${replaces.length ? `, replacing unpaid invoice ${replaces.join(", ")}` : ""}. No refund for the current period.`,
  };
}
