import { cn } from "@/lib/utils";
import { formatDateTime } from "@/components/portal/ui";
import type { TimelineStep } from "@/server/customer/requests";

/* A request's progress, oldest first; the latest step is marked. Server-safe. */

export function RequestTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="relative space-y-6 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-line">
      {steps.map((s, i) => {
        const latest = i === steps.length - 1;
        return (
          <li key={`${s.at}-${i}`} className="relative flex gap-4">
            <span
              aria-hidden
              className={cn(
                "relative z-10 mt-[3px] inline-flex size-[15px] shrink-0 items-center justify-center rounded-full border-2 bg-white",
                latest ? "border-red" : s.mine ? "border-ink/30" : "border-ink",
              )}
            >
              {latest && <span className="size-[5px] rounded-full bg-red" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("text-[14px] leading-snug", latest ? "font-semibold text-ink" : "font-medium text-ink/85")}>{s.title}</p>
              {s.detail && <p className="mt-0.5 break-words text-[13px] text-muted">{s.detail}</p>}
              <p className="mt-1 text-[11.5px] text-muted num">{formatDateTime(s.at)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
