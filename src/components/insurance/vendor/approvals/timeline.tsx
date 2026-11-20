import type { ReactNode } from "react";
import { CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/components/portal/ui";
import { historyLabel, statusText, type HistoryEntry } from "./shared";

/* The approval timeline (server- and client-safe): who did what, the status change and MarchGear's remarks. */

export function HistoryTimeline({ entries, empty, subject }: { entries: HistoryEntry[]; empty?: ReactNode; subject?: (e: HistoryEntry) => ReactNode }) {
  if (!entries.length)
    return (
      <p className="border border-dashed border-line px-4 py-10 text-center text-[13.5px] text-muted">
        {empty ?? "Nothing has been submitted yet. Every submission and MarchGear decision appears here."}
      </p>
    );
  return (
    <ol className="relative space-y-6 before:absolute before:inset-y-1 before:left-[7px] before:w-px before:bg-line">
      {entries.map((e) => (
        <li key={e.id} className="relative pl-8">
          <CircleDot aria-hidden className={cn("absolute left-0 top-0.5 size-[15px] bg-white", e.actorSide === "admin" ? "text-red" : "text-ink/40")} />
          {subject && <div className="mb-0.5 text-[12px] text-muted">{subject(e)}</div>}
          <p className="text-[14px] font-medium">{historyLabel(e.action)}</p>
          <p className="mt-0.5 text-[12.5px] text-muted">
            {e.actorSide === "admin" ? "MarchGear team" : e.actorSide === "system" ? "System" : e.actorName || "Your team"} · {formatDateTime(e.createdAt)}
          </p>
          {(e.fromStatus || e.toStatus) && e.fromStatus !== e.toStatus && (
            <p className="mt-1.5 text-[12px] text-muted">
              {statusText(e.target, e.fromStatus) ?? "—"} <span aria-hidden>→</span>
              <span className="sr-only">to</span> <span className="font-medium text-ink">{statusText(e.target, e.toStatus) ?? "—"}</span>
            </p>
          )}
          {e.remarks && <p className={cn("mt-2 whitespace-pre-line border-l-2 py-1 pl-3 text-[13px]", e.actorSide === "admin" ? "border-red text-ink" : "border-line text-ink/75")}>{e.remarks}</p>}
        </li>
      ))}
    </ol>
  );
}
