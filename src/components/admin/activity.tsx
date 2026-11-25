import Link from "@/components/admin/desk";
import { Badge, formatDateTime, type BadgeTone } from "./ui";

/* Server-safe pieces for showing activity-log entries (the /admin/activity page and the dashboard). */

const ACTION: Record<string, { label: string; tone: BadgeTone }> = {
  create: { label: "Created", tone: "green" },
  update: { label: "Updated", tone: "blue" },
  delete: { label: "Deleted", tone: "red" },
  status: { label: "Status", tone: "amber" },
  assign: { label: "Assigned", tone: "neutral" },
  note: { label: "Note", tone: "neutral" },
  reset: { label: "Reset", tone: "amber" },
  upload: { label: "Upload", tone: "blue" },
  login: { label: "Sign-in", tone: "dark" },
  signout: { label: "Sign-out", tone: "dark" },
};

export function ActionBadge({ action }: { action: string }) {
  const a = ACTION[action] ?? { label: action, tone: "neutral" as const };
  return <Badge tone={a.tone}>{a.label}</Badge>;
}

export interface ActivityEntry {
  id: number;
  action: string;
  summary: string;
  createdAt: Date;
  userName: string | null;
  userId: number | null;
  href: string | null;
}

/** The summary, linked to the record when it still exists. */
export function ActivitySummary({ entry, className }: { entry: ActivityEntry; className?: string }) {
  return entry.href ? (
    <Link href={entry.href} className={`hover:text-red hover:underline ${className ?? ""}`}>
      {entry.summary}
    </Link>
  ) : (
    <span className={className}>{entry.summary}</span>
  );
}

export const who = (e: Pick<ActivityEntry, "userName" | "userId">) => e.userName ?? (e.userId === null ? "Deleted account" : `User #${e.userId}`);

/** Compact list for the dashboard. */
export function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  return (
    <ul className="divide-y divide-line">
      {entries.map((e) => (
        <li key={e.id} className="flex items-start gap-3 px-5 py-3">
          <span className="mt-0.5 shrink-0">
            <ActionBadge action={e.action} />
          </span>
          <span className="min-w-0">
            <ActivitySummary entry={e} className="block break-words text-[13.5px] leading-snug" />
            <span className="mt-0.5 block text-[12px] text-muted">
              {who(e)} · {formatDateTime(e.createdAt)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
