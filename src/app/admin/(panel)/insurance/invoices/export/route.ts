import type { NextRequest } from "next/server";
import { INS_INVOICE_KIND_LABEL, INVOICE_STATUS_LABEL } from "@/insurance/labels";
import { requireStaff } from "@/server/auth";
import { csvResponse } from "@/server/admin/csv";
import { dayRange, exportInsInvoices, vendorLabel } from "@/server/admin/insurance-ops";
import { istDate } from "@/components/portal/billing/shared";

const IST_OFFSET_MS = 330 * 60_000;
const ist = (d: Date | null) => (d ? new Date(d.getTime() + IST_OFFSET_MS).toISOString().replace("T", " ").slice(0, 19) : "");

/** The invoices list as CSV, with the same filters (formula-safe cells via csvCell). */
export async function GET(req: NextRequest) {
  await requireStaff();
  const p = req.nextUrl.searchParams;
  const get = (k: string) => p.get(k)?.trim() || undefined;
  const range = dayRange(get("from"), get("to"));
  const rows = await exportInsInvoices({ q: get("q")?.slice(0, 60), vendor: get("vendor"), kind: get("kind"), status: get("status"), ...range });
  return csvResponse(
    `marchgear-insurance-invoices-${istDate()}.csv`,
    ["Invoice", "Issued (IST)", "Vendor", "Vendor reference", "Kind", "Description", "Period start", "Period end", "Amount before GST (₹)", "GST (₹)", "Total (₹)", "Status", "Due on", "Verified payments (₹)", "Refunded (₹)", "Balance due (₹)", "Paid (IST)"],
    rows.map((i) => [
      i.number,
      ist(i.createdAt),
      vendorLabel(i),
      i.vendorRef,
      INS_INVOICE_KIND_LABEL[i.kind],
      i.description,
      i.periodStart,
      i.periodEnd,
      i.amount,
      i.gst,
      i.total,
      INVOICE_STATUS_LABEL[i.display],
      i.dueOn,
      i.verified,
      i.refunded,
      i.status === "void" ? 0 : Math.max(0, i.total - i.verified),
      ist(i.paidAt),
    ]),
  );
}
