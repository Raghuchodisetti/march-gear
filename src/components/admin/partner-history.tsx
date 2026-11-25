import Link from "@/components/admin/desk";
import { Lock } from "lucide-react";
import type { ApprovalTarget } from "@/db/enums";
import { BRAND_STATUS_LABEL, FILE_STATUS_LABEL, OFFER_STATUS_LABEL, PARTNER_STATUS_LABEL, VEHICLE_STATUS_LABEL } from "@/partner/labels";
import { cn } from "@/lib/utils";
import { formatDateTime } from "./ui";
import { ActionPill, TARGET_LABEL, humanize, targetHref } from "./partner-ui";

/* Server-safe approval-history timeline (dealer details, review drawers, dashboard). */

export interface HistoryEntry {
  id: number;
  partnerId: number;
  partnerName: string | null;
  partnerRef: string;
  target: ApprovalTarget;
  targetId: number | null;
  targetLabel?: string | null;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  remarks: string | null;
  actorSide: "dealer" | "admin" | "system";
  actorName: string | null;
  createdAt: Date;
}

/** A stored status as people read it, whichever workflow it belongs to. */
export function statusLabel(target: ApprovalTarget, s: string | null) {
  if (!s) return null;
  const maps: Record<string, Record<string, string>> = {
    partner: PARTNER_STATUS_LABEL,
    vehicle: VEHICLE_STATUS_LABEL,
    offer: OFFER_STATUS_LABEL,
    document: FILE_STATUS_LABEL,
    brand: BRAND_STATUS_LABEL,
  };
  return maps[target]?.[s] ?? humanize(s);
}

const SIDE: Record<HistoryEntry["actorSide"], string> = { dealer: "Dealer", admin: "MarchGear", system: "System" };

export function HistoryList({ entries, showPartner, showTarget = true, empty = "No history yet." }: { entries: HistoryEntry[]; showPartner?: boolean; showTarget?: boolean; empty?: string }) {
  if (!entries.length) return <p className="py-8 text-center text-[13.5px] text-muted">{empty}</p>;
  return (
    <ol className="relative space-y-0">
      {entries.map((e, i) => {
        const internal = e.action === "internal_note";
        const from = statusLabel(e.target, e.fromStatus);
        const to = statusLabel(e.target, e.toStatus);
        return (
          <li key={e.id} className="relative flex gap-4 pb-5">
            {i < entries.length - 1 && <span aria-hidden className="absolute left-[7px] top-5 h-[calc(100%-12px)] w-px bg-line" />}
            <span aria-hidden className={cn("relative mt-1.5 size-[15px] shrink-0 rounded-full border-[3px] border-white ring-1", e.actorSide === "admin" ? "bg-ink ring-ink/20" : e.actorSide === "dealer" ? "bg-red ring-red/20" : "bg-muted ring-line")} />
            <div className={cn("min-w-0 flex-1", internal && "rounded-[3px] border border-dashed border-ink/20 bg-mist/50 px-3 py-2.5")}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <ActionPill action={e.action} />
                {showTarget && e.target !== "partner" && (
                  <Link href={targetHref(e.target, e.targetId, e.partnerId)} className="text-[13px] font-medium hover:text-red">
                    {TARGET_LABEL[e.target]}
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
              {showPartner && (
                <Link href={`/admin/dealers/details?id=${e.partnerId}`} className="mt-1 block text-[13px] font-medium hover:text-red">
                  {e.partnerName || e.partnerRef} <span className="font-normal text-muted">· {e.partnerRef}</span>
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
  );
}
