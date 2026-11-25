import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Circle, XCircle } from "lucide-react";
import type { OfferDiscount } from "@/partner/types";
import type { ApprovalTarget, BrandAuthStatus, FileReviewStatus, OfferStatus, PartnerDocKind, PartnerStatus, PartnerVehicleStatus } from "@/db/enums";
import {
  BRAND_STATUS_LABEL,
  BRAND_STATUS_TONE,
  FILE_STATUS_LABEL,
  FILE_STATUS_TONE,
  OFFER_STATUS_LABEL,
  OFFER_STATUS_TONE,
  PARTNER_STATUS_LABEL,
  PARTNER_STATUS_TONE,
  VEHICLE_STATUS_LABEL,
  VEHICLE_STATUS_TONE,
  offerDisplayStatus,
  type OfferDisplayStatus,
  type Tone,
} from "@/partner/labels";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────
   Shared, server-safe pieces of the dealer-partner admin screens:
   status pills, labels, links and small layout helpers. Client
   components import from here too (no server-only imports).
   ────────────────────────────────────────────────────────────── */

/** Waiting for MarchGear staff. */
export const IN_REVIEW: PartnerStatus[] = ["submitted", "pending_approval", "under_review"];
/** Waiting for the dealer to fix something. */
export const WITH_DEALER: PartnerStatus[] = ["documents_required", "changes_requested"];

/** Account documents reviewed in the Documents tab (others belong to vehicles, tickets and payments). */
export const KYC_DOC_KINDS = ["pan", "gst", "registration", "identity", "address", "brand_authorization", "cancelled_cheque", "supporting"] as const satisfies readonly PartnerDocKind[];
export type KycDocKind = (typeof KYC_DOC_KINDS)[number];

/** Documents every application needs; authorised dealers also need a brand certificate. */
export function requiredDocKinds(mode: string): KycDocKind[] {
  const base: KycDocKind[] = ["pan", "gst", "registration", "identity", "address", "cancelled_cheque"];
  return mode === "authorized" ? [...base, "brand_authorization"] : base;
}

export const isBankPath = (path: string) => path === "bank.accountNumber";

/** Wizard areas a required correction can point at ("documents: Upload a clearer PAN card") — the dealer's "Fix now" link opens that step. */
export const CORRECTION_AREAS = { personal: "Personal", business: "Business", showrooms: "Showrooms", brands: "Brands", documents: "Documents", bank: "Bank" } as const;
export type CorrectionArea = keyof typeof CORRECTION_AREAS;
/** Splits "documents: Upload…" into its area and text. */
export function splitCorrection(item: string): { area: CorrectionArea | null; text: string } {
  const m = /^(personal|business|showrooms|brands|documents|bank):\s*([\s\S]*)$/.exec(item);
  return m ? { area: m[1] as CorrectionArea, text: m[2] } : { area: null, text: item };
}

/** The name staff know a dealership by. */
export function partnerName(p: { tradeName?: string | null; legalName?: string | null; ownerName?: string | null; reference?: string | null }) {
  return p.tradeName?.trim() || p.legalName?.trim() || (p.ownerName ? `${p.ownerName} (applicant)` : null) || p.reference || "Dealer partner";
}

/** Human labels for application fields that change requests touch. */
export const FIELD_LABEL: Record<string, string> = {
  "personal.fullName": "Owner name",
  "personal.designation": "Designation",
  "personal.mobile": "Mobile",
  "personal.email": "Email",
  "business.legalName": "Legal business name",
  "business.tradeName": "Trade name",
  "business.businessType": "Business type",
  "business.gst": "GST number",
  "business.pan": "PAN",
  "business.registrationNumber": "Registration number",
  "business.establishedOn": "Established on",
  "business.email": "Business email",
  "business.phone": "Business phone",
  "business.website": "Website",
  "bank.holder": "Account holder",
  "bank.bankName": "Bank",
  "bank.accountNumber": "Account number",
  "bank.ifsc": "IFSC",
  "bank.branch": "Branch",
};
export const fieldLabel = (path: string) => FIELD_LABEL[path] ?? humanize(path.split(".").pop() ?? path);

export const humanize = (s: string) =>
  s
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());

export const ACTION_LABEL: Record<string, string> = {
  created: "Started application",
  submitted: "Submitted",
  resubmitted: "Resubmitted",
  queued: "Queued for review",
  under_review: "Marked under review",
  changes_requested: "Requested corrections",
  documents_requested: "Requested documents",
  documents_required: "Requested documents",
  approved: "Approved",
  approved_published: "Approved & published",
  published: "Published",
  unpublished: "Unpublished",
  rejected: "Rejected",
  suspended: "Suspended",
  reactivated: "Reactivated",
  deactivated: "Deactivated",
  verified: "Verified",
  reset: "Reset to pending",
  scheduled: "Scheduled",
  paused: "Paused",
  resumed: "Resumed",
  cancelled: "Cancelled",
  extended: "Extended",
  internal_note: "Internal note",
  requested: "Requested change",
  withdrawn: "Withdrawn",
};
export const actionLabel = (a: string) => ACTION_LABEL[a] ?? humanize(a);

export function actionTone(a: string): Tone {
  if (/^(approved|approved_published|published|verified|reactivated|resumed)$/.test(a)) return "green";
  if (/^(rejected|suspended)$/.test(a)) return "red";
  if (/^(changes_requested|documents_requested|documents_required|paused|extended)$/.test(a)) return "amber";
  if (a === "internal_note") return "dark";
  if (/^(submitted|resubmitted|queued|under_review|scheduled|requested)$/.test(a)) return "blue";
  return "neutral";
}

export const TARGET_LABEL: Record<ApprovalTarget, string> = {
  partner: "Dealer account",
  vehicle: "Vehicle",
  offer: "Offer",
  brand: "Brand authorisation",
  document: "Document",
  profile_change: "Change request",
  payment: "Payment",
};

/** Where staff review the thing an approval entry is about. */
export function targetHref(target: ApprovalTarget, targetId: number | null, partnerId: number) {
  const details = (tab?: string) => `/admin/dealers/details?id=${partnerId}${tab ? `&tab=${tab}` : ""}`;
  switch (target) {
    case "vehicle":
      return targetId ? `/admin/vehicle-approvals?view=all&review=${targetId}` : details("listings");
    case "offer":
      return targetId ? `/admin/offer-approvals?view=all&review=${targetId}` : details("listings");
    case "brand":
      return details("brands");
    case "document":
      return details("documents");
    case "profile_change":
      return details("changes");
    case "payment":
      return `/admin/partner-billing?tab=invoices&dealer=${partnerId}`;
    default:
      return details();
  }
}

/** "3d 4h", "45 min" — how long something has waited. */
export function waitingLabel(since: Date | string | null | undefined, now = Date.now()) {
  if (!since) return "—";
  const mins = Math.max(0, Math.round((now - new Date(since).getTime()) / 60_000));
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days}d ${hours % 24}h` : `${days} days`;
}

/** Waiting longer than this is flagged in queues. */
export const SLA_HOURS = 48;
export const overdue = (since: Date | string | null | undefined, now = Date.now()) => Boolean(since) && now - new Date(since!).getTime() > SLA_HOURS * 3_600_000;

/* ── Status pills ───────────────────────────────────────────── */

const PILL: Record<Tone, string> = {
  neutral: "bg-mist text-ink/75 ring-ink/10",
  red: "bg-red-50 text-red-600 ring-red/20",
  green: "bg-[#e8f5ec] text-[#1e7a3c] ring-[#1e7a3c]/20",
  amber: "bg-[#fdf3e1] text-[#9a5b00] ring-[#9a5b00]/20",
  blue: "bg-[#e9f0fb] text-[#2456a6] ring-[#2456a6]/20",
  dark: "bg-ink text-white ring-ink",
};
const DOT: Record<Tone, string> = {
  neutral: "bg-ink/35",
  red: "bg-red",
  green: "bg-[#22a04f]",
  amber: "bg-[#e09200]",
  blue: "bg-[#2f6fd6]",
  dark: "bg-white",
};

export function StatusPill({ tone, children, pulse, className }: { tone: Tone; children: ReactNode; pulse?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[11.5px] font-semibold ring-1 ring-inset", PILL[tone], className)}>
      <span aria-hidden className="relative flex size-1.5">
        {pulse && <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-60", DOT[tone])} />}
        <span className={cn("relative inline-flex size-1.5 rounded-full", DOT[tone])} />
      </span>
      {children}
    </span>
  );
}

export const PartnerPill = ({ status }: { status: PartnerStatus }) => (
  <StatusPill tone={PARTNER_STATUS_TONE[status]} pulse={IN_REVIEW.includes(status)}>
    {PARTNER_STATUS_LABEL[status]}
  </StatusPill>
);
export const VehiclePill = ({ status }: { status: PartnerVehicleStatus }) => (
  <StatusPill tone={VEHICLE_STATUS_TONE[status]} pulse={status === "pending_approval"}>
    {VEHICLE_STATUS_LABEL[status]}
  </StatusPill>
);
export function OfferPill({ offer }: { offer: { status: OfferStatus; startsAt: Date | string; endsAt: Date | string } }) {
  const s: OfferDisplayStatus = offerDisplayStatus(offer);
  return (
    <StatusPill tone={OFFER_STATUS_TONE[s]} pulse={s === "active" || s === "submitted" || s === "pending_approval"}>
      {OFFER_STATUS_LABEL[s]}
    </StatusPill>
  );
}
export const FilePill = ({ status }: { status: FileReviewStatus }) => <StatusPill tone={FILE_STATUS_TONE[status]}>{FILE_STATUS_LABEL[status]}</StatusPill>;
export const BrandPill = ({ status }: { status: BrandAuthStatus }) => <StatusPill tone={BRAND_STATUS_TONE[status]}>{BRAND_STATUS_LABEL[status]}</StatusPill>;
export const ActionPill = ({ action }: { action: string }) => <StatusPill tone={actionTone(action)}>{actionLabel(action)}</StatusPill>;

/* ── Layout helpers ─────────────────────────────────────────── */

/** Label / value rows. Empty values show a muted dash. */
export function Facts({ rows, className }: { rows: [ReactNode, ReactNode][]; className?: string }) {
  return (
    <dl className={cn("divide-y divide-line", className)}>
      {rows.map(([k, v], i) => (
        <div key={i} className="grid grid-cols-1 gap-0.5 py-2.5 sm:grid-cols-[132px_minmax(0,1fr)] sm:gap-4">
          <dt className="text-[12.5px] text-muted">{k}</dt>
          <dd className="min-w-0 break-words text-[13.5px]">{v === null || v === undefined || v === "" ? <span className="text-muted">—</span> : v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Check({ ok, label, detail, warn }: { ok: boolean; label: ReactNode; detail?: ReactNode; warn?: boolean }) {
  const Icon = ok ? CheckCircle2 : warn ? AlertTriangle : XCircle;
  return (
    <li className="flex gap-3 py-2.5">
      <Icon aria-hidden className={cn("mt-0.5 size-[18px] shrink-0", ok ? "text-[#22a04f]" : warn ? "text-[#e09200]" : "text-red")} />
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium">
          {label}
          <span className="sr-only">{ok ? " — passed" : " — needs attention"}</span>
        </span>
        {detail && <span className="mt-0.5 block break-words text-[12.5px] text-muted">{detail}</span>}
      </span>
    </li>
  );
}

export function Pending({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted">
      <Circle aria-hidden className="size-3" /> {children}
    </span>
  );
}

/** A small "Open" link with an arrow, for queues and tables. */
export function OpenLink({ href, children = "Open", className }: { href: string; children?: ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-1 text-[13px] font-medium text-red hover:underline", className)}>
      {children} <ArrowUpRight aria-hidden className="size-3.5" />
    </Link>
  );
}

/** Link-style tabs for server-rendered views (filters live in the URL). */
export function LinkTabs({ items, active, className }: { items: { key: string; label: ReactNode; href: string; count?: number }[]; active: string; className?: string }) {
  return (
    <nav aria-label="Views" className={cn("no-scrollbar mb-5 flex gap-6 overflow-x-auto border-b border-line", className)}>
      {items.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={cn("relative shrink-0 whitespace-nowrap pb-3 text-[14px] font-medium transition-colors", on ? "text-ink" : "text-muted hover:text-ink")}
          >
            {t.label}
            {t.count !== undefined && <span className={cn("ml-1.5 text-[12px] num", on && "text-red-600")}>{t.count}</span>}
            {on && <span aria-hidden className="absolute inset-x-0 -bottom-px h-[2px] bg-red" />}
          </Link>
        );
      })}
    </nav>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <span className="mb-3 inline-flex size-11 items-center justify-center rounded-full bg-mist text-muted">{icon}</span>}
      <p className="text-[14.5px] font-semibold">{title}</p>
      {children && <p className="mt-1 max-w-md text-[13px] text-muted">{children}</p>}
    </div>
  );
}

/** ₹ figure for tables. */
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
export const rupees = (n: number | null | undefined) => (n === null || n === undefined ? "—" : inr.format(Math.round(n)));

/** "+12.4%" price deviation against the catalogue. */
export function deviation(price: number, reference: number | null | undefined) {
  if (!reference) return null;
  return (price - reference) / reference;
}

export const fileSize = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** "₹25,000 off · 5% off · Free insurance" — an offer's headline benefits. */
export function discountSummary(d: OfferDiscount) {
  const parts = [
    d.flat ? `${rupees(d.flat)} off` : null,
    d.percentage ? `${d.percentage}% off` : null,
    d.cash ? `${rupees(d.cash)} cash discount` : null,
    d.exchangeBonus ? `${rupees(d.exchangeBonus)} exchange bonus` : null,
    d.corporateBonus ? `${rupees(d.corporateBonus)} corporate bonus` : null,
    d.loyaltyBonus ? `${rupees(d.loyaltyBonus)} loyalty bonus` : null,
    d.freeInsurance ? "Free insurance" : null,
    d.freeAccessories ? "Free accessories" : null,
    d.financeBenefit ? "Finance benefit" : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "No discount details";
}
