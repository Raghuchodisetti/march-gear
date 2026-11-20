import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, Lock } from "lucide-react";
import type { FileReviewStatus, InsApprovalTarget, InsCampaignStatus, InsCoverStatus, InsDocKind, InsProductStatus, InsVendorStatus } from "@/db/enums";
import {
  AD_CREATIVE_STATUS_LABEL,
  AD_STATUS_LABEL,
  FILE_REVIEW_LABEL,
  FILE_REVIEW_TONE,
  INS_CAMPAIGN_STATUS_LABEL,
  INS_CAMPAIGN_STATUS_TONE,
  INS_COVER_STATUS_LABEL,
  INS_COVER_STATUS_TONE,
  INS_PRODUCT_STATUS_LABEL,
  INS_PRODUCT_STATUS_TONE,
  INS_VENDOR_IN_REVIEW,
  INS_VENDOR_STATUS_LABEL,
  INS_VENDOR_STATUS_TONE,
  PAYMENT_STATUS_LABEL,
  campaignDisplayStatus,
  type Tone,
} from "@/insurance/labels";
import { cn } from "@/lib/utils";
import { formatDateTime, formatDay } from "@/components/admin/ui";
import { StatusPill, humanize, overdue, waitingLabel } from "@/components/admin/partner-ui";

/* ──────────────────────────────────────────────────────────────
   Shared, server-safe pieces of the insurance admin screens:
   status pills, workflow labels, SLA ages, the approval-history
   timeline and correction helpers. Client components import from
   here too (no server-only imports). Other admin teams may import
   it — keep the exports stable.
   ────────────────────────────────────────────────────────────── */

export { Check, EmptyState, Facts, LinkTabs, OpenLink, SLA_HOURS, StatusPill, fileSize, humanize, overdue, rupees, waitingLabel } from "@/components/admin/partner-ui";

/* ── Workflow groups ────────────────────────────────────────── */

/** Vendor applications waiting for MarchGear staff. */
export const INS_VENDOR_QUEUE: InsVendorStatus[] = INS_VENDOR_IN_REVIEW;
/** Vendor applications sent back and waiting for the vendor. */
export const INS_VENDOR_WITH_VENDOR: InsVendorStatus[] = ["documents_required", "changes_requested"];
/** Vendor applications that have a decision. */
export const INS_VENDOR_DECIDED: InsVendorStatus[] = ["approved", "rejected", "suspended"];

/** Products waiting for staff ("submitted" is normally only a history entry, but count it if it's ever stored). */
export const INS_PRODUCT_QUEUE: InsProductStatus[] = ["submitted", "pending_approval"];
export const INS_PRODUCT_WITH_VENDOR: InsProductStatus[] = ["changes_requested"];
export const INS_PRODUCT_DECIDED: InsProductStatus[] = ["approved", "published", "rejected", "suspended"];

/** Account documents reviewed on the vendor's Documents tab (others belong to products, tickets and payments). */
export const INS_KYC_DOC_KINDS = [
  "business_registration",
  "gst",
  "pan",
  "regulatory_licence",
  "address_proof",
  "representative_id",
  "representative_authorisation",
  "bank_proof",
  "supporting",
] as const satisfies readonly InsDocKind[];
export type InsKycDocKind = (typeof INS_KYC_DOC_KINDS)[number];

/* ── Required corrections ───────────────────────────────────── */

/**
 * Wizard steps a vendor correction can point at. Stored as "<step>: text" in `ins_vendors.required_corrections`
 * (e.g. "documents: Upload your GST certificate") so the vendor's "Fix now" link can open that step.
 * Keys match INS_STEPS in src/insurance/application.ts. Use splitInsCorrection() to display them.
 */
export const INS_CORRECTION_AREAS = {
  contact: "Contact",
  company: "Company",
  registration: "Registration",
  regulatory: "Regulatory",
  branches: "Branches",
  bank: "Bank",
  documents: "Documents",
} as const;
export type InsCorrectionArea = keyof typeof INS_CORRECTION_AREAS;

/** Splits "documents: Upload…" into its wizard step and text. Plain items have no area. */
export function splitInsCorrection(item: string): { area: InsCorrectionArea | null; text: string } {
  const m = /^(contact|company|registration|regulatory|branches|bank|documents):\s*([\s\S]*)$/.exec(item);
  return m ? { area: m[1] as InsCorrectionArea, text: m[2] } : { area: null, text: item };
}

/** A vendor's name as staff know it (client-safe twin of vendorName() in the server context). */
export function insVendorName(v: { brandName?: string | null; legalName?: string | null; reference?: string | null; application?: { company?: { brandName?: string; legalName?: string } } | null }) {
  return v.brandName?.trim() || v.legalName?.trim() || v.application?.company?.brandName?.trim() || v.application?.company?.legalName?.trim() || v.reference || "Insurance vendor";
}

/** Human labels for the vendor application fields that change requests touch ("company.legalName" → "Legal name"). */
export const INS_FIELD_LABEL: Record<string, string> = {
  "contact.name": "Contact name",
  "contact.designation": "Designation",
  "contact.mobile": "Mobile",
  "contact.email": "Email",
  "company.legalName": "Legal name",
  "company.brandName": "Brand name",
  "company.businessType": "Business type",
  "company.website": "Website",
  "company.address": "Registered address",
  "company.city": "City",
  "company.state": "State",
  "company.pin": "PIN code",
  "registration.gstin": "GSTIN",
  "registration.pan": "PAN",
  "registration.cin": "CIN / registration number",
  "registration.establishedOn": "Established on",
  "regulatory.category": "Category",
  "regulatory.registrationType": "Registration type",
  "regulatory.licenceNumber": "Licence number",
  "regulatory.licenceValidUntil": "Licence valid until",
  "regulatory.representative.name": "Representative name",
  "regulatory.representative.designation": "Representative designation",
  "regulatory.representative.mobile": "Representative mobile",
  "regulatory.representative.email": "Representative email",
  "bank.holder": "Account holder",
  "bank.bankName": "Bank",
  "bank.accountNumber": "Account number",
  "bank.ifsc": "IFSC",
};
export const insFieldLabel = (path: string) => INS_FIELD_LABEL[path] ?? humanize(path.split(".").pop() ?? path);

/* ── History labels ─────────────────────────────────────────── */

export const INS_ACTION_LABEL: Record<string, string> = {
  created: "Started application",
  submitted: "Submitted",
  resubmitted: "Resubmitted",
  under_review: "Marked under review",
  changes_requested: "Requested changes",
  documents_required: "Requested documents",
  approved: "Approved",
  approved_published: "Approved & published",
  published: "Published",
  unpublished: "Unpublished",
  rejected: "Rejected",
  suspended: "Suspended",
  reactivated: "Reactivated",
  reinstated: "Reinstated",
  verified: "Verified",
  reset: "Reset to pending",
  paused: "Paused",
  resumed: "Resumed",
  cancelled: "Cancelled",
  withdrawn: "Withdrawn",
  requested: "Requested change",
  linked: "Linked",
  internal_note: "Internal note",
};
export const insActionLabel = (a: string) => INS_ACTION_LABEL[a] ?? humanize(a);

export function insActionTone(a: string): Tone {
  if (/^(approved|approved_published|published|verified|reactivated|reinstated|resumed|linked)$/.test(a)) return "green";
  if (/^(rejected|suspended)$/.test(a)) return "red";
  if (/^(changes_requested|documents_required|paused)$/.test(a)) return "amber";
  if (a === "internal_note") return "dark";
  if (/^(submitted|resubmitted|under_review|requested)$/.test(a)) return "blue";
  return "neutral";
}

export const INS_TARGET_LABEL: Record<InsApprovalTarget, string> = {
  vendor: "Vendor account",
  product: "Product",
  cover: "Cover",
  campaign: "Campaign",
  ad_campaign: "Ad campaign",
  ad_creative: "Ad creative",
  document: "Document",
  profile_change: "Change request",
  payment: "Payment",
  conversion: "Policy conversion",
  company: "Insurance company",
};

/** Where staff review the thing an approval entry is about. */
export function insTargetHref(target: InsApprovalTarget, targetId: number | null, vendorId: number) {
  const vendor = (tab?: string) => `/admin/insurance/vendors/${vendorId}${tab ? `?tab=${tab}` : ""}`;
  switch (target) {
    case "product":
      return targetId ? `/admin/insurance/products/${targetId}` : vendor("products");
    case "cover":
      return targetId ? `/admin/insurance/coverage?review=${targetId}` : vendor("products");
    case "document":
      return vendor("documents");
    case "profile_change":
      return vendor("changes");
    case "campaign":
      return "/admin/insurance/campaigns";
    case "ad_campaign":
    case "ad_creative":
      return "/admin/advertising";
    case "payment":
      return "/admin/insurance/payments";
    case "conversion":
      return "/admin/insurance/enquiries";
    case "company":
      return targetId ? `/admin/insurance/companies/${targetId}` : "/admin/insurance/companies";
    default:
      return vendor();
  }
}

/** A stored status as people read it, whichever workflow it belongs to. */
export function insStatusLabel(target: InsApprovalTarget, s: string | null) {
  if (!s) return null;
  const maps: Partial<Record<InsApprovalTarget, Record<string, string>>> = {
    vendor: INS_VENDOR_STATUS_LABEL,
    product: INS_PRODUCT_STATUS_LABEL,
    cover: INS_COVER_STATUS_LABEL,
    campaign: INS_CAMPAIGN_STATUS_LABEL,
    document: FILE_REVIEW_LABEL,
    ad_campaign: AD_STATUS_LABEL,
    ad_creative: AD_CREATIVE_STATUS_LABEL,
    payment: PAYMENT_STATUS_LABEL,
  };
  return maps[target]?.[s] ?? humanize(s);
}

/* ── Status pills ───────────────────────────────────────────── */

export const VendorPill = ({ status }: { status: InsVendorStatus }) => (
  <StatusPill tone={INS_VENDOR_STATUS_TONE[status]} pulse={INS_VENDOR_QUEUE.includes(status)}>
    {INS_VENDOR_STATUS_LABEL[status]}
  </StatusPill>
);
export const ProductPill = ({ status }: { status: InsProductStatus }) => (
  <StatusPill tone={INS_PRODUCT_STATUS_TONE[status]} pulse={INS_PRODUCT_QUEUE.includes(status)}>
    {INS_PRODUCT_STATUS_LABEL[status]}
  </StatusPill>
);
export const CoverPill = ({ status }: { status: InsCoverStatus }) => (
  <StatusPill tone={INS_COVER_STATUS_TONE[status]} pulse={status === "pending_approval"}>
    {INS_COVER_STATUS_LABEL[status]}
  </StatusPill>
);
export const InsFilePill = ({ status }: { status: FileReviewStatus }) => <StatusPill tone={FILE_REVIEW_TONE[status]}>{FILE_REVIEW_LABEL[status]}</StatusPill>;
export function CampaignPill({ campaign, now }: { campaign: { status: InsCampaignStatus; startsAt: Date | string; endsAt: Date | string }; now?: Date }) {
  const s = campaignDisplayStatus(campaign, now);
  return (
    <StatusPill tone={INS_CAMPAIGN_STATUS_TONE[s]} pulse={s === "pending_approval" || s === "active"}>
      {INS_CAMPAIGN_STATUS_LABEL[s]}
    </StatusPill>
  );
}
export const InsActionPill = ({ action }: { action: string }) => <StatusPill tone={insActionTone(action)}>{insActionLabel(action)}</StatusPill>;

/* ── SLA and dates ──────────────────────────────────────────── */

/** How long something has waited, in red once it's past the 48-hour SLA. */
export function SlaAge({ since, now, prefix, className }: { since: Date | string | null | undefined; now: number; prefix?: string; className?: string }) {
  const late = overdue(since, now);
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[12px] num", late ? "font-semibold text-red" : "text-muted", className)} title={late ? "Waiting longer than the 48-hour review target" : undefined}>
      {late && <AlertTriangle aria-hidden className="size-3.5" />}
      {prefix ? `${prefix} ` : ""}
      {waitingLabel(since, now)}
      {late && <span className="sr-only"> — over the 48-hour target</span>}
    </span>
  );
}

/** Days from `today` (IST YYYY-MM-DD) to `day`; negative once it has passed. */
export const daysUntil = (day: string, today: string) => Math.round((Date.parse(`${day.slice(0, 10)}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);

/** A regulatory licence's validity with a warning when it has expired or expires within 60 days. */
export function LicenceValidity({ until, today }: { until: string | null | undefined; today: string }) {
  if (!until) return <span className="text-muted">Not provided</span>;
  const d = daysUntil(until, today);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="num">{formatDay(until)}</span>
      {d < 0 ? (
        <StatusPill tone="red">Expired {Math.abs(d)} day{Math.abs(d) === 1 ? "" : "s"} ago</StatusPill>
      ) : d <= 60 ? (
        <StatusPill tone="amber">Expires in {d} day{d === 1 ? "" : "s"}</StatusPill>
      ) : (
        <StatusPill tone="green">Valid</StatusPill>
      )}
    </span>
  );
}

/* ── Approval-history timeline ──────────────────────────────── */

export interface InsHistoryEntry {
  id: number;
  vendorId: number;
  vendorName: string | null;
  vendorRef: string;
  target: InsApprovalTarget;
  targetId: number | null;
  /** e.g. "PRD-7KQ2X9 · Comprehensive Plus" */
  targetLabel?: string | null;
  /** Overrides insTargetHref() for the target link. */
  href?: string | null;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  remarks: string | null;
  actorSide: "vendor" | "admin" | "system";
  actorName: string | null;
  createdAt: Date | string;
}

const SIDE: Record<InsHistoryEntry["actorSide"], string> = { vendor: "Vendor", admin: "MarchGear", system: "System" };

/**
 * The approval timeline. Staff screens only: it shows internal notes (marked "Staff only").
 * Never render internal_note rows on vendor-facing pages.
 */
export function InsHistoryList({
  entries,
  showVendor,
  showTarget = true,
  empty = "No history yet.",
  footer,
}: {
  entries: InsHistoryEntry[];
  showVendor?: boolean;
  showTarget?: boolean;
  empty?: string;
  footer?: ReactNode;
}) {
  if (!entries.length) return <p className="py-8 text-center text-[13.5px] text-muted">{empty}</p>;
  return (
    <>
      <ol className="relative">
        {entries.map((e, i) => {
          const internal = e.action === "internal_note";
          const from = insStatusLabel(e.target, e.fromStatus);
          const to = insStatusLabel(e.target, e.toStatus);
          return (
            <li key={e.id} className="relative flex gap-4 pb-5">
              {i < entries.length - 1 && <span aria-hidden className="absolute left-[7px] top-5 h-[calc(100%-12px)] w-px bg-line" />}
              <span
                aria-hidden
                className={cn(
                  "relative mt-1.5 size-[15px] shrink-0 rounded-full border-[3px] border-white ring-1",
                  e.actorSide === "admin" ? "bg-ink ring-ink/20" : e.actorSide === "vendor" ? "bg-red ring-red/20" : "bg-muted ring-line",
                )}
              />
              <div className={cn("min-w-0 flex-1", internal && "rounded-[3px] border border-dashed border-ink/20 bg-mist/50 px-3 py-2.5")}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <InsActionPill action={e.action} />
                  {showTarget && e.target !== "vendor" && (
                    <Link href={e.href ?? insTargetHref(e.target, e.targetId, e.vendorId)} className="min-w-0 break-words text-[13px] font-medium hover:text-red">
                      {INS_TARGET_LABEL[e.target]}
                      {e.targetLabel ? `: ${e.targetLabel}` : ""}
                    </Link>
                  )}
                  {from && to && from !== to && (
                    <span className="text-[12.5px] text-muted">
                      {from} → <span className="text-ink">{to}</span>
                    </span>
                  )}
                  {internal && (
                    <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-muted">
                      <Lock aria-hidden className="size-3" /> Staff only
                    </span>
                  )}
                </div>
                {showVendor && (
                  <Link href={`/admin/insurance/vendors/${e.vendorId}`} className="mt-1 block text-[13px] font-medium hover:text-red">
                    {e.vendorName || e.vendorRef} <span className="font-normal text-muted">· {e.vendorRef}</span>
                  </Link>
                )}
                {e.remarks && <p className="mt-1.5 whitespace-pre-line break-words text-[13.5px] leading-relaxed text-ink/85">{e.remarks}</p>}
                <p className="mt-1 text-[11.5px] text-muted">
                  {e.actorName ?? SIDE[e.actorSide]} {e.actorName && e.actorSide !== "admin" ? `(${SIDE[e.actorSide].toLowerCase()})` : e.actorName ? "· MarchGear" : ""} · {formatDateTime(e.createdAt)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      {footer}
    </>
  );
}

/** The staff message and required fixes currently shown to the vendor. */
export function VendorMessage({ remarks, corrections, title = "Latest message to the vendor" }: { remarks: string | null; corrections: string[] | null; title?: string }) {
  if (!remarks && !(corrections && corrections.length)) return null;
  return (
    <section className="border border-[#e09200]/30 bg-[#fdf3e1]/60 p-5">
      <h2 className="text-[13.5px] font-semibold text-[#7a4800]">{title}</h2>
      {remarks && <p className="mt-1.5 whitespace-pre-line break-words text-[13.5px]">{remarks}</p>}
      {corrections && corrections.length > 0 && (
        <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-[13.5px]">
          {corrections.map((c) => {
            const { area, text } = splitInsCorrection(c);
            return (
              <li key={c} className="break-words">
                {area && <span className="mr-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#7a4800]/70">{INS_CORRECTION_AREAS[area]}</span>}
                {text}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
