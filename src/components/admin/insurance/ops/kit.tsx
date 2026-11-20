import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, Info, Lock, ShieldAlert } from "lucide-react";
import type { InsApprovalTarget, InsLeadStatus, InsQuoteAuthorization, InsRenewalStatus, InvoiceStatus, PaymentStatus, TicketPriority, TicketStatus } from "@/db/enums";
import {
  INS_CAMPAIGN_STATUS_LABEL,
  INS_CAMPAIGN_STATUS_TONE,
  INS_LEAD_STATUS_LABEL,
  INS_LEAD_STATUS_TONE,
  INS_QUOTE_AUTH_SHORT,
  INS_QUOTE_AUTH_TONE,
  INS_QUOTE_STATUS_LABEL,
  INS_QUOTE_STATUS_TONE,
  INS_RENEWAL_STATUS_LABEL,
  INS_RENEWAL_STATUS_TONE,
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_TONE,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
  type InsCampaignDisplay,
  type Tone,
} from "@/insurance/labels";
import { TICKET_PRIORITY_LABEL } from "@/partner/labels";
import { cn } from "@/lib/utils";
import { StatusPill, EmptyState } from "@/components/admin/partner-ui";
import { filterInput, formatDateTime } from "@/components/admin/ui";
import { PRIORITY_TONE } from "@/components/portal/support/shared";
import { CONVERSION_LABEL, CONVERSION_TONE, INS_TARGET_LABEL, INS_TICKET_STATUS_LABEL, INS_TICKET_STATUS_TONE, humanize, opsActionLabel, opsActionTone, type ConversionState } from "./labels";

/* Server-safe building blocks shared by the insurance operations and billing screens. */

export const LeadPill = ({ status }: { status: InsLeadStatus }) => (
  <StatusPill tone={INS_LEAD_STATUS_TONE[status]} pulse={status === "new"}>
    {INS_LEAD_STATUS_LABEL[status]}
  </StatusPill>
);
export const QuotePill = ({ status }: { status: keyof typeof INS_QUOTE_STATUS_LABEL }) => <StatusPill tone={INS_QUOTE_STATUS_TONE[status]}>{INS_QUOTE_STATUS_LABEL[status]}</StatusPill>;
export const AuthPill = ({ a }: { a: InsQuoteAuthorization }) => <StatusPill tone={INS_QUOTE_AUTH_TONE[a]}>{INS_QUOTE_AUTH_SHORT[a]}</StatusPill>;
export const RenewalPill = ({ status }: { status: InsRenewalStatus }) => <StatusPill tone={INS_RENEWAL_STATUS_TONE[status]}>{INS_RENEWAL_STATUS_LABEL[status]}</StatusPill>;
export const CampaignPill = ({ status }: { status: InsCampaignDisplay }) => (
  <StatusPill tone={INS_CAMPAIGN_STATUS_TONE[status]} pulse={status === "active" || status === "pending_approval"}>
    {INS_CAMPAIGN_STATUS_LABEL[status]}
  </StatusPill>
);
export const InvoicePill = ({ status }: { status: InvoiceStatus }) => <StatusPill tone={INVOICE_STATUS_TONE[status]}>{INVOICE_STATUS_LABEL[status]}</StatusPill>;
export const PaymentPill = ({ status }: { status: PaymentStatus }) => (
  <StatusPill tone={PAYMENT_STATUS_TONE[status]} pulse={status === "submitted"}>
    {PAYMENT_STATUS_LABEL[status]}
  </StatusPill>
);
export const TicketPill = ({ status }: { status: TicketStatus }) => <StatusPill tone={INS_TICKET_STATUS_TONE[status]}>{INS_TICKET_STATUS_LABEL[status]}</StatusPill>;
export const PriorityPill = ({ priority }: { priority: TicketPriority }) => <StatusPill tone={PRIORITY_TONE[priority]}>{TICKET_PRIORITY_LABEL[priority]}</StatusPill>;
export const ConversionPill = ({ state }: { state: ConversionState }) => <StatusPill tone={CONVERSION_TONE[state]}>{CONVERSION_LABEL[state]}</StatusPill>;
export const OpsActionPill = ({ action }: { action: string }) => <StatusPill tone={opsActionTone(action)}>{opsActionLabel(action)}</StatusPill>;

export function conversionState(e: { status: string; conversionVerifiedAt: Date | string | null }): ConversionState {
  if (e.conversionVerifiedAt) return "verified";
  return e.status === "policy_issued" ? "reported" : "none";
}

/** Status pills next to a page title (keeps them in the body font, not the display face). */
export function TitlePills({ children }: { children: ReactNode }) {
  return <span className="inline-flex flex-wrap items-center gap-2 font-sans text-[13px] font-normal tracking-normal">{children}</span>;
}

/** The vendor's name, linked to its admin record. */
export function VendorLink({ id, name, reference, className }: { id: number; name: string; reference?: string | null; className?: string }) {
  return (
    <span className={cn("block min-w-0", className)}>
      <Link href={`/admin/insurance/vendors/${id}`} className="block truncate font-medium hover:text-red">
        {name}
      </Link>
      {reference && <span className="block text-[12px] text-muted num">{reference}</span>}
    </span>
  );
}

const NOTICE: Record<"info" | "warn" | "danger", { box: string; icon: typeof Info }> = {
  info: { box: "border-[#2456a6] bg-[#e9f0fb] text-[#1c3f78]", icon: Info },
  warn: { box: "border-[#9a5b00] bg-[#fdf3e1] text-[#6b4000]", icon: AlertTriangle },
  danger: { box: "border-red bg-red-50 text-[#8f1014]", icon: ShieldAlert },
};

export function Notice({ tone = "info", title, children, className }: { tone?: "info" | "warn" | "danger"; title?: ReactNode; children?: ReactNode; className?: string }) {
  const { box, icon: Icon } = NOTICE[tone];
  return (
    <div className={cn("flex gap-3 border-l-[3px] px-4 py-3 text-[13px] leading-relaxed", box, className)}>
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5")}>{children}</div>}
      </div>
    </div>
  );
}

/** A white box holding an EmptyState (for lists with nothing to show). */
export function EmptyBox({ icon, title, children }: { icon?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="border border-line bg-white">
      <EmptyState icon={icon} title={title}>
        {children}
      </EmptyState>
    </div>
  );
}

/** From / to IST day inputs for a FilterForm. */
export function DateRangeFields({ from, to, label = "Between (IST)", fromName = "from", toName = "to" }: { from?: string; to?: string; label?: string; fromName?: string; toName?: string }) {
  return (
    <fieldset className="flex min-w-0 items-center gap-2">
      <legend className="sr-only">{label}</legend>
      <input type="date" name={fromName} defaultValue={from} aria-label={`${label} — from`} className={cn(filterInput, "min-w-0 flex-1 md:w-[150px] md:flex-none")} />
      <span className="text-[12.5px] text-muted">to</span>
      <input type="date" name={toName} defaultValue={to} aria-label={`${label} — to`} className={cn(filterInput, "min-w-0 flex-1 md:w-[150px] md:flex-none")} />
    </fieldset>
  );
}

/** Small label/value tiles in a hairline grid (invoice and payment summaries). */
export function FactGrid({ items, cols = 3, className }: { items: [ReactNode, ReactNode][]; cols?: 2 | 3 | 4; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-2 gap-px overflow-hidden border border-line bg-line", cols === 3 && "sm:grid-cols-3", cols === 4 && "sm:grid-cols-4", className)}>
      {items.map(([k, v], i) => (
        <div key={i} className="min-w-0 bg-white px-4 py-3">
          <dt className="text-[11.5px] text-muted">{k}</dt>
          <dd className="mt-0.5 break-words text-[14px] font-semibold num">{v === null || v === undefined || v === "" ? <span className="font-normal text-muted">—</span> : v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A section title above a table or grid. */
export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 mt-10 flex flex-wrap items-end justify-between gap-3", className)}>
      <h2 className="text-[15px] font-semibold">{children}</h2>
      {action}
    </div>
  );
}

/* ── Approval history (ins_approvals) ───────────────────────── */

export interface InsHistoryEntry {
  id: number;
  vendorId: number;
  vendorName?: string | null;
  target: InsApprovalTarget;
  targetId: number | null;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  remarks: string | null;
  actorSide: "vendor" | "admin" | "system";
  actorName: string | null;
  createdAt: Date;
}

const SIDE: Record<InsHistoryEntry["actorSide"], string> = { vendor: "Vendor", admin: "MarchGear", system: "System" };
export const sideLabel = (s: InsHistoryEntry["actorSide"]) => SIDE[s];

export function InsHistoryList({ entries, empty = "No history yet.", showTarget }: { entries: InsHistoryEntry[]; empty?: string; showTarget?: boolean }) {
  if (!entries.length) return <p className="py-6 text-center text-[13.5px] text-muted">{empty}</p>;
  return (
    <ol className="relative">
      {entries.map((e, i) => {
        const internal = e.action === "internal_note";
        return (
          <li key={e.id} className="relative flex gap-4 pb-5 last:pb-0">
            {i < entries.length - 1 && <span aria-hidden className="absolute left-[7px] top-5 h-[calc(100%-12px)] w-px bg-line" />}
            <span aria-hidden className={cn("relative mt-1.5 size-[15px] shrink-0 rounded-full border-[3px] border-white ring-1", e.actorSide === "admin" ? "bg-ink ring-ink/20" : e.actorSide === "vendor" ? "bg-red ring-red/20" : "bg-muted ring-line")} />
            <div className={cn("min-w-0 flex-1", internal && "rounded-[3px] border border-dashed border-ink/20 bg-mist/50 px-3 py-2.5")}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <OpsActionPill action={e.action} />
                {showTarget && <span className="text-[13px] font-medium">{INS_TARGET_LABEL[e.target]}</span>}
                {e.fromStatus && e.toStatus && e.fromStatus !== e.toStatus && (
                  <span className="text-[12.5px] text-muted">
                    {humanize(e.fromStatus)} → <span className="text-ink">{humanize(e.toStatus)}</span>
                  </span>
                )}
                {internal && (
                  <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-muted">
                    <Lock aria-hidden className="size-3" /> Staff only
                  </span>
                )}
              </div>
              {e.remarks && <p className="mt-1.5 whitespace-pre-line break-words text-[13.5px] leading-relaxed text-ink/85">{e.remarks}</p>}
              <p className="mt-1 text-[11.5px] text-muted">
                {e.actorName ? `${e.actorName} · ${SIDE[e.actorSide]}` : SIDE[e.actorSide]} · {formatDateTime(e.createdAt)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Tone helper for numbers that should draw the eye only when non-zero. */
export const alertTone = (n: number): Tone | undefined => (n ? "red" : undefined);
