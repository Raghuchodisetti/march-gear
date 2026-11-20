import type { NextRequest } from "next/server";
import { CRM_STATUS_LABEL, LEAD_SOURCE_LABEL } from "@/partner/labels";
import { getPartnerContext } from "@/server/partner/context";
import { allLeads, leadAccess, parseLeadFilters } from "@/server/partner/crm";
import { logPartnerActivity } from "@/server/partner/records";
import { formatIstDateTime, istDay } from "@/components/portal/crm/pipeline";

/*
 * GET /dealer/enquiries/export?<filters>&format=csv|excel[&ids=1,2,3]
 * The enquiries matching the list filters as CSV. "excel" is the same CSV with a UTF-8 byte-order
 * mark so Excel opens names and ₹ correctly — it is not an .xlsx file.
 */

const MAX_ROWS = 10_000;

// Quote every cell; neutralise spreadsheet formulas (CSV injection).
const cell = (v: string | number | null | undefined) => {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export async function GET(req: NextRequest) {
  const ctx = await getPartnerContext();
  if (!ctx) return new Response("Please sign in to the dealer portal.", { status: 401 });
  if (!ctx.approved || !leadAccess(ctx)) return new Response("You don't have access to enquiries.", { status: 403 });

  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const filters = parseLeadFilters(sp);
  const excel = sp.format === "excel";
  const ids = new Set(
    (sp.ids ?? "")
      .split(",")
      .map((v) => Number.parseInt(v, 10))
      .filter((n) => Number.isFinite(n) && n > 0),
  );

  let rows = await allLeads(ctx, filters, MAX_ROWS);
  if (ids.size) rows = rows.filter((r) => ids.has(r.id));

  const header = ["Reference", "Received (IST)", "Name", "Mobile", "Email", "Interested in", "Variant", "Offer", "Vehicle", "Budget", "Location", "Source", "Status", "Lost reason", "Assigned to", "Next follow-up (IST)", "Last updated (IST)"];
  const lines = [header.map(cell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.reference,
        formatIstDateTime(r.createdAt),
        r.name,
        r.mobile,
        r.email,
        r.carLabel,
        r.variant,
        r.offer ? `${r.offer.title} (${r.offer.reference})` : "",
        r.vehicle ? `${r.vehicle.label} (${r.vehicle.reference})` : "",
        r.budget,
        r.location,
        LEAD_SOURCE_LABEL[r.source],
        CRM_STATUS_LABEL[r.status],
        r.lostReason,
        r.assigned?.name ?? "",
        r.followUpAt ? formatIstDateTime(r.followUpAt) : "",
        formatIstDateTime(r.updatedAt),
      ]
        .map(cell)
        .join(","),
    );
  }

  await logPartnerActivity(ctx.partner.id, ctx.user.id, "export", "lead", null, `Exported ${rows.length} enquir${rows.length === 1 ? "y" : "ies"} (${excel ? "Excel CSV" : "CSV"})`);
  const body = `${excel ? "﻿" : ""}${lines.join("\r\n")}\r\n`;
  const name = `enquiries-${ctx.partner.reference.toLowerCase()}-${istDay(new Date())}${excel ? "-excel" : ""}.csv`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
