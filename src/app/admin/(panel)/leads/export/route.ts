import type { NextRequest } from "next/server";
import { LEAD_STATUS_LABEL, LEAD_TYPE_LABEL, detailLabel, detailValue } from "@/lib/leads";
import { csvResponse } from "@/server/admin/csv";
import { exportLeads, leadDateRange } from "@/server/admin/leads";

const IST_OFFSET_MS = 330 * 60_000;

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const get = (k: string) => p.get(k)?.trim() || undefined;
  const range = leadDateRange({ from: get("from"), to: get("to") });
  // Same filters as the list page, so the file matches what's on screen.
  const rows = await exportLeads({ q: get("q"), type: get("type"), status: get("status"), assigned: get("assigned"), ...range });

  // The phone is the bare 10-digit number: a "+91 …" cell would be read as a formula by spreadsheets.
  const header = ["Reference", "Received (IST)", "Type", "Status", "Name", "Phone (+91)", "Email", "City", "About", "Message", "Details", "Owner", "Source page"];
  const lines = rows.map((l) => [
    l.reference,
    new Date(l.createdAt.getTime() + IST_OFFSET_MS).toISOString().replace("T", " ").slice(0, 19),
    LEAD_TYPE_LABEL[l.type] ?? l.type,
    LEAD_STATUS_LABEL[l.status],
    l.name,
    l.phone,
    l.email,
    l.city,
    l.subject,
    l.message,
    Object.entries(l.details ?? {})
      .map(([k, v]) => `${detailLabel(k)}: ${detailValue(k, v)}`)
      .join("; "),
    l.assigneeName,
    l.source,
  ]);
  const suffix = range.from || range.to ? `${range.from ?? "start"}-to-${range.to ?? "today"}` : new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
  return csvResponse(`marchgear-leads-${suffix}.csv`, header, lines);
}
