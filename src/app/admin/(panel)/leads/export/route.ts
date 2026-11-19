import type { NextRequest } from "next/server";
import { LEAD_STATUS_LABEL, LEAD_TYPE_LABEL, detailLabel, detailValue } from "@/lib/leads";
import { csvResponse } from "@/server/admin/csv";
import { exportLeads } from "@/server/admin/leads";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const rows = await exportLeads({
    q: p.get("q") ?? undefined,
    type: p.get("type") ?? undefined,
    status: p.get("status") ?? undefined,
    assigned: p.get("assigned") ?? undefined,
  });

  // The phone is the bare 10-digit number: a "+91 …" cell would be read as a formula by spreadsheets.
  const header = ["Reference", "Received (UTC)", "Type", "Status", "Name", "Phone (+91)", "Email", "City", "About", "Message", "Details", "Owner", "Source page"];
  const lines = rows.map((l) => [
    l.reference,
    l.createdAt.toISOString().replace("T", " ").slice(0, 19),
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
  return csvResponse(`marchgear-leads-${new Date().toISOString().slice(0, 10)}.csv`, header, lines);
}
