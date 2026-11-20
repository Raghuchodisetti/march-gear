import type { NextRequest } from "next/server";
import { INS_INTENT_LABEL, INS_LEAD_STATUS_LABEL, INS_POLICY_STATUS_LABEL } from "@/insurance/labels";
import { getInsurerContext } from "@/server/insurance/context";
import { allEnquiries, enquiryAccess, parseEnquiryFilters } from "@/server/insurance/crm";
import { logInsurerActivity } from "@/server/insurance/records";
import { formatIstDateTime, istDay } from "@/components/portal/crm/pipeline";
import { sourceLabel } from "@/components/insurance/vendor/crm/shared";

/*
 * GET /insurance-vendor/enquiries/export?<list filters>
 * The enquiries matching the list filters (and the viewer's scope: own-only members get only theirs) as CSV.
 * UTF-8 with a byte-order mark so Excel shows names and ₹ correctly.
 */

const MAX_ROWS = 10_000;

// Quote every cell; neutralise spreadsheet formulas (CSV injection).
const cell = (v: string | number | null | undefined) => {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export async function GET(req: NextRequest) {
  const ctx = await getInsurerContext();
  if (!ctx) return new Response("Please sign in to the insurance vendor portal.", { status: 401 });
  if (!ctx.approved || !enquiryAccess(ctx)) return new Response("You don't have access to enquiries.", { status: 403 });

  const filters = parseEnquiryFilters(Object.fromEntries(req.nextUrl.searchParams.entries()));
  const rows = await allEnquiries(ctx, filters, MAX_ROWS);

  const header = [
    "Reference",
    "Enquiry date (IST)",
    "Customer name",
    "Mobile",
    "Email",
    "Intent",
    "Registration",
    "Brand",
    "Model",
    "Variant",
    "Year",
    "Fuel",
    "City",
    "State",
    "Current policy status",
    "Policy expiry",
    "Selected product",
    "Indicative premium shown (Rs)",
    "Source",
    "Status",
    "Lost reason",
    "Assigned to",
    "Next follow-up (IST)",
    "Last updated (IST)",
  ];
  const lines = [header.map(cell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.reference,
        formatIstDateTime(r.createdAt),
        r.name,
        r.mobile,
        r.email,
        INS_INTENT_LABEL[r.intent],
        r.regNumber ?? (r.vehicleIsNew ? "New car" : ""),
        r.brandName,
        r.modelName,
        r.variantName,
        r.year,
        r.fuel,
        r.city,
        r.state,
        r.policyStatus ? INS_POLICY_STATUS_LABEL[r.policyStatus] : "",
        r.policyExpiry,
        r.product ? `${r.product.name} (${r.product.reference})` : "",
        r.indicativePremium,
        sourceLabel(r.source),
        INS_LEAD_STATUS_LABEL[r.status],
        r.lostReason,
        r.assigned?.name ?? "",
        r.followUpAt ? formatIstDateTime(r.followUpAt) : "",
        formatIstDateTime(r.updatedAt),
      ]
        .map(cell)
        .join(","),
    );
  }

  await logInsurerActivity(ctx.vendor.id, ctx.user.id, "export", "enquiry", null, `Exported ${rows.length} enquir${rows.length === 1 ? "y" : "ies"} (CSV)`);
  const name = `enquiries-${ctx.vendor.reference.toLowerCase()}-${istDay(new Date())}.csv`;
  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
