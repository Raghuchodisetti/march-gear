import { Lock } from "lucide-react";
import { AD_CREATIVE_STATUS_LABEL, AD_STATUS_LABEL } from "@/insurance/labels";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/components/admin/ui";
import { ActionPill, humanize } from "@/components/admin/partner-ui";

/* The approval history of an ad booking and its creatives (vendor and admin). Server-safe. */

export interface AdHistoryItem {
  id: number;
  target: "ad_campaign" | "ad_creative";
  targetLabel: string | null;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  remarks: string | null;
  actorSide: "vendor" | "admin" | "system";
  actorName: string | null;
  createdAt: string;
}

const label = (target: AdHistoryItem["target"], s: string | null) => {
  if (!s) return null;
  const map: Record<string, string> = target === "ad_creative" ? AD_CREATIVE_STATUS_LABEL : AD_STATUS_LABEL;
  return map[s] ?? humanize(s);
};

export function AdHistory({ entries, viewer, empty = "No history yet." }: { entries: AdHistoryItem[]; viewer: "vendor" | "admin"; empty?: string }) {
  if (!entries.length) return <p className="py-8 text-center text-[13.5px] text-muted">{empty}</p>;
  const side = { vendor: viewer === "vendor" ? "Your team" : "Advertiser", admin: "MarchGear", system: "System" } as const;
  return (
    <ol>
      {entries.map((e, i) => {
        const internal = e.action === "internal_note";
        const from = label(e.target, e.fromStatus);
        const to = label(e.target, e.toStatus);
        return (
          <li key={e.id} className="relative flex gap-4 pb-5">
            {i < entries.length - 1 && <span aria-hidden className="absolute left-[7px] top-5 h-[calc(100%-12px)] w-px bg-line" />}
            <span aria-hidden className={cn("relative mt-1.5 size-[15px] shrink-0 rounded-full border-[3px] border-white ring-1", e.actorSide === "admin" ? "bg-ink ring-ink/20" : e.actorSide === "vendor" ? "bg-red ring-red/20" : "bg-muted ring-line")} />
            <div className={cn("min-w-0 flex-1", internal && "rounded-[3px] border border-dashed border-ink/20 bg-mist/50 px-3 py-2.5")}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <ActionPill action={e.action} />
                <span className="text-[13px] font-medium">{e.target === "ad_creative" ? `Creative${e.targetLabel ? `: ${e.targetLabel}` : ""}` : "Booking"}</span>
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
              {e.remarks && <p className="mt-1.5 whitespace-pre-line break-words text-[13.5px] leading-relaxed text-ink/85">{e.remarks}</p>}
              <p className="mt-1 text-[11.5px] text-muted">
                {/* Vendors see "MarchGear", not the name of the staff member. */}
                {e.actorName && !(viewer === "vendor" && e.actorSide === "admin") ? `${e.actorName} · ${side[e.actorSide]}` : side[e.actorSide]} · {formatDateTime(e.createdAt)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
