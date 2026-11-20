import { AlarmClock, BellRing } from "lucide-react";
import type { InsIntent, InsLeadStatus, InsQuoteAuthorization, InsQuoteStatus, InsRenewalStatus } from "@/db/enums";
import {
  INS_INTENT_LABEL,
  INS_LEAD_STATUS_LABEL,
  INS_LEAD_STATUS_TONE,
  INS_QUOTE_AUTH_SHORT,
  INS_QUOTE_AUTH_TONE,
  INS_QUOTE_STATUS_LABEL,
  INS_QUOTE_STATUS_TONE,
  INS_RENEWAL_STATUS_LABEL,
  INS_RENEWAL_STATUS_TONE,
} from "@/insurance/labels";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/portal/ui";
import { formatWhen, relativeTime } from "@/components/portal/crm/pipeline";
import { INS_LEAD_FINISHED, sourceLabel } from "./shared";

/* Small, server-safe pieces shared by the enquiry, quote and renewal screens. */

export const EnquiryStatusBadge = ({ status }: { status: InsLeadStatus }) => <Badge tone={INS_LEAD_STATUS_TONE[status]}>{INS_LEAD_STATUS_LABEL[status]}</Badge>;
export const RenewalStatusBadge = ({ status }: { status: InsRenewalStatus }) => <Badge tone={INS_RENEWAL_STATUS_TONE[status]}>{INS_RENEWAL_STATUS_LABEL[status]}</Badge>;
export const QuoteStatusBadge = ({ status }: { status: InsQuoteStatus | "viewed" | "expired" }) => <Badge tone={INS_QUOTE_STATUS_TONE[status]}>{INS_QUOTE_STATUS_LABEL[status]}</Badge>;
export const AuthBadge = ({ auth }: { auth: InsQuoteAuthorization }) => <Badge tone={INS_QUOTE_AUTH_TONE[auth]}>{INS_QUOTE_AUTH_SHORT[auth]}</Badge>;

export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex h-6 items-center whitespace-nowrap rounded-[3px] border border-line px-2 text-[11.5px] font-medium text-ink/70", className)}>{children}</span>;
}

export const SourceTag = ({ source }: { source: string }) => <Tag>{sourceLabel(source)}</Tag>;
export const IntentTag = ({ intent }: { intent: InsIntent }) => <Tag className={intent === "renewal" ? "border-[#2456a6]/25 text-[#2456a6]" : undefined}>{INS_INTENT_LABEL[intent]}</Tag>;

/** The next follow-up, red when overdue. Pass the server's `now` so hydration agrees. */
export function FollowUp({ at, finished, now, className }: { at: string | null; finished: boolean; now: number; className?: string }) {
  if (!at) return <span className={cn("text-[12.5px] text-muted", className)}>—</span>;
  const overdue = !finished && new Date(at).getTime() < now;
  return (
    <span className={cn("inline-flex flex-col gap-1", className)}>
      {overdue ? (
        <span className="inline-flex h-6 w-fit items-center gap-1 whitespace-nowrap rounded-full bg-red-50 px-2.5 text-[11.5px] font-semibold text-red">
          <AlarmClock aria-hidden className="size-3.5" /> Overdue
        </span>
      ) : (
        <span className="inline-flex w-fit items-center gap-1 whitespace-nowrap text-[11.5px] font-medium text-ink/70">
          <BellRing aria-hidden className="size-3.5" /> {relativeTime(at, now)}
        </span>
      )}
      <span className="whitespace-nowrap text-[12px] text-muted num">{formatWhen(at)}</span>
    </span>
  );
}

export const leadFinished = (s: InsLeadStatus) => INS_LEAD_FINISHED.includes(s);

export function Initials({ name, className }: { name: string; className?: string }) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span aria-hidden className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-mist text-[12px] font-semibold text-ink", className)}>
      {letters || "?"}
    </span>
  );
}

/** "12 Dec 2026 · in 22 days" with a tone for how close it is. */
export function ExpiryCell({ date, days, muted }: { date: string; days: number; muted?: boolean }) {
  const tone = muted ? "text-muted" : days < 0 ? "text-red" : days <= 7 ? "text-[#9a5b00]" : "text-ink/70";
  const label = days === 0 ? "Expires today" : days > 0 ? `${days} day${days === 1 ? "" : "s"} left` : `Expired ${-days} day${days === -1 ? "" : "s"} ago`;
  return (
    <span className="inline-flex flex-col">
      <span className="whitespace-nowrap text-[13px] num">{formatDayShort(date)}</span>
      <span className={cn("whitespace-nowrap text-[11.5px] font-medium num", tone)}>{label}</span>
    </span>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "12 Dec 2026" from a YYYY-MM-DD calendar day (no time-zone maths). */
export const formatDayShort = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
