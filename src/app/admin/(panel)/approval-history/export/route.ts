import type { NextRequest } from "next/server";
import { csvResponse } from "@/server/admin/csv";
import { exportApprovalHistory, isCalendarDay } from "@/server/admin/partners";
import { statusLabel } from "@/components/admin/partner-history";
import { TARGET_LABEL, actionLabel } from "@/components/admin/partner-ui";

const IST_OFFSET_MS = 330 * 60_000;
const SIDE = { admin: "MarchGear", dealer: "Dealer", system: "System" } as const;

/** The approval history as CSV, with the same filters as the page (staff only — checked in exportApprovalHistory). */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const get = (k: string) => p.get(k)?.trim() || undefined;
  const day = (k: string) => (isCalendarDay(get(k)) ? get(k) : undefined);
  const filters = { q: get("q"), partner: get("partner"), target: get("target"), action: get("action"), side: get("side"), from: day("from"), to: day("to") };
  const rows = await exportApprovalHistory(filters);
  const header = ["When (IST)", "Dealer", "Dealer reference", "Workflow", "About", "Action", "From status", "To status", "Remarks", "By", "Side", "Staff only"];
  const lines = rows.map((r) => [
    new Date(r.createdAt.getTime() + IST_OFFSET_MS).toISOString().replace("T", " ").slice(0, 19),
    r.partnerName,
    r.partnerRef,
    TARGET_LABEL[r.target],
    r.targetLabel,
    actionLabel(r.action),
    statusLabel(r.target, r.fromStatus),
    statusLabel(r.target, r.toStatus),
    r.remarks,
    r.actorName,
    SIDE[r.actorSide],
    r.action === "internal_note" ? "Yes" : "",
  ]);
  const suffix = filters.from || filters.to ? `${filters.from ?? "start"}-to-${filters.to ?? "today"}` : new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
  return csvResponse(`marchgear-approval-history-${suffix}.csv`, header, lines);
}
