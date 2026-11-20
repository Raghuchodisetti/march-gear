import type { NextRequest } from "next/server";
import { INS_INVOICE_KIND_LABEL, INVOICE_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/insurance/labels";
import { requireStaff } from "@/server/auth";
import { csvResponse } from "@/server/admin/csv";
import { dayRange, exportInsInvoices, exportInsPayments, exportInsRefunds, loadLedger, summariseLedger, vendorLabel } from "@/server/admin/insurance-ops";
import { istDate } from "@/components/portal/billing/shared";
import { METHOD_LABEL } from "@/components/admin/insurance/ops/labels";

const IST_OFFSET_MS = 330 * 60_000;
const ist = (d: Date | null) => (d ? new Date(d.getTime() + IST_OFFSET_MS).toISOString().replace("T", " ").slice(0, 19) : "");

/**
 * Financial CSVs for /admin/insurance/revenue (staff only). Every cell goes through csvCell, which
 * neutralises spreadsheet formulas. Amounts are whole rupees.
 */
export async function GET(req: NextRequest) {
  await requireStaff();
  const p = req.nextUrl.searchParams;
  const range = dayRange(p.get("from") ?? undefined, p.get("to") ?? undefined);
  const type = p.get("type");
  const suffix = range.from || range.to ? `${range.from ?? "start"}-to-${range.to ?? istDate()}` : `all-to-${istDate()}`;

  if (type === "invoices") {
    // Issued in the period (the invoices list filters by billing period instead).
    const rows = (await exportInsInvoices({})).filter((i) => {
      const d = istDate(i.createdAt);
      return (!range.from || d >= range.from) && (!range.to || d <= range.to);
    });
    return csvResponse(
      `marchgear-insurance-invoices-${suffix}.csv`,
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

  if (type === "payments") {
    const rows = await exportInsPayments(range);
    return csvResponse(
      `marchgear-insurance-payments-${suffix}.csv`,
      ["Paid on", "Recorded (IST)", "Vendor", "Vendor reference", "Invoice", "Invoice kind", "Invoice total (₹)", "Amount (₹)", "Method", "Reference (UTR)", "Status", "Decided by", "Decided (IST)", "Remarks"],
      rows.map((r) => [
        r.p.paidOn,
        ist(r.p.createdAt),
        vendorLabel(r),
        r.vendorRef,
        r.invoiceNumber,
        INS_INVOICE_KIND_LABEL[r.invoiceKind],
        r.invoiceTotal,
        r.p.amount,
        METHOD_LABEL[r.p.method],
        r.p.utr,
        PAYMENT_STATUS_LABEL[r.p.status],
        r.verifier,
        ist(r.p.verifiedAt),
        r.p.remarks,
      ]),
    );
  }

  if (type === "refunds") {
    const rows = await exportInsRefunds(range);
    return csvResponse(
      `marchgear-insurance-refunds-${suffix}.csv`,
      ["Refunded on", "Recorded (IST)", "Vendor", "Vendor reference", "Invoice", "Invoice kind", "Amount (₹)", "Refund reference", "Against payment", "Reason", "Recorded by"],
      rows.map((r) => [r.r.refundedOn, ist(r.r.createdAt), vendorLabel(r), r.vendorRef, r.invoiceNumber, INS_INVOICE_KIND_LABEL[r.invoiceKind], r.r.amount, r.r.reference, r.paymentUtr, r.r.reason, r.by]),
    );
  }

  // Revenue summary: one sheet, sectioned.
  const s = summariseLedger(await loadLedger(), range);
  const period = `${range.from ?? "start"} to ${range.to ?? istDate()}`;
  const rows: unknown[][] = [
    ["Period", period, "", ""],
    ["", "", "", ""],
    ["Collected (verified payments − refunds, incl. GST)", s.collected, "", ""],
    ["Verified payments", s.gross, "", ""],
    ["Refunds", s.refunded, "", ""],
    ["Net revenue (collected, excl. GST)", s.net, "", ""],
    ["Invoiced in the period (excl. void)", s.invoiced, `${s.invoicedCount} invoices`, ""],
    ["Outstanding today (unpaid balance)", s.outstanding, `${s.outstandingCount} invoices`, ""],
    ["Overdue today", s.overdue, `${s.overdueCount} invoices`, ""],
    ["Awaiting verification", s.awaitingVerification, `${s.awaitingCount} payments`, ""],
    ["", "", "", ""],
    ["Stream", "Invoiced (₹)", "Collected (₹)", "Outstanding today (₹)"],
    ...s.kinds.map((k) => [k.label, k.invoiced, k.collected, k.outstanding]),
    ["", "", "", ""],
    ["Advertising placement", "Invoiced (₹)", "Collected (₹)", "Outstanding today (₹)"],
    ...s.byPlacement.map((k) => [k.label, k.invoiced, k.collected, k.outstanding]),
    ["", "", "", ""],
    ["Ad campaign", "Invoiced (₹)", "Collected (₹)", "Outstanding today (₹)"],
    ...s.byCampaign.map((k) => [`${k.label}${k.sub ? ` (${k.sub})` : ""}`, k.invoiced, k.collected, k.outstanding]),
    ["", "", "", ""],
    ["Product category", "Invoiced (₹)", "Collected (₹)", "Outstanding today (₹)"],
    ...s.byCategory.map((k) => [k.label, k.invoiced, k.collected, k.outstanding]),
    ["", "", "", ""],
    ["Vendor", "Invoiced (₹)", "Collected (₹)", "Outstanding today (₹)"],
    ...s.byVendor.map((k) => [`${k.label}${k.sub ? ` (${k.sub})` : ""}`, k.invoiced, k.collected, k.outstanding]),
    ["", "", "", ""],
    ["Month (last 12, any period)", "Invoiced (₹)", "Collected (₹)", ""],
    ...s.monthly.map((m) => [m.month, m.invoiced, m.collected, ""]),
  ];
  return csvResponse(`marchgear-insurance-revenue-summary-${suffix}.csv`, ["MarchGear insurance revenue summary", "", "", ""], rows);
}
