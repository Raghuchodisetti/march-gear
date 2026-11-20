import { AlarmClock, BellRing } from "lucide-react";
import type { CrmStatus, LeadSource, TestDriveStatus } from "@/db/enums";
import { CRM_STATUS_LABEL, CRM_STATUS_TONE, LEAD_SOURCE_LABEL, TEST_DRIVE_STATUS_LABEL, TEST_DRIVE_STATUS_TONE } from "@/partner/labels";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/portal/ui";
import { formatWhen, isOverdue, relativeTime } from "./pipeline";

/* Small, server-safe pieces shared by the CRM, test-drive and customer screens. */

export function LeadStatusBadge({ status }: { status: CrmStatus }) {
  return <Badge tone={CRM_STATUS_TONE[status]}>{CRM_STATUS_LABEL[status]}</Badge>;
}

export function TestDriveBadge({ status }: { status: TestDriveStatus }) {
  return <Badge tone={TEST_DRIVE_STATUS_TONE[status]}>{TEST_DRIVE_STATUS_LABEL[status]}</Badge>;
}

export function SourceTag({ source }: { source: LeadSource }) {
  return <span className="inline-flex h-6 items-center whitespace-nowrap rounded-[3px] border border-line px-2 text-[11.5px] font-medium text-ink/70">{LEAD_SOURCE_LABEL[source]}</span>;
}

/** The next follow-up, red when overdue. Pass the server's `now` from client components so hydration agrees. */
export function FollowUp({ at, status, className, now }: { at: string | null; status: CrmStatus; className?: string; now?: number }) {
  if (!at) return <span className={cn("text-[12.5px] text-muted", className)}>—</span>;
  const overdue = isOverdue(at, status, now);
  const date = formatWhen(at);
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
      <span className="whitespace-nowrap text-[12px] text-muted num">{date}</span>
    </span>
  );
}

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
