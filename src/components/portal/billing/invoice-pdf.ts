import { formatDate } from "@/lib/format";
import { INVOICE_STATUS_LABEL } from "@/partner/labels";
import {
  NO_PAYMENT_DETAILS,
  amountInWords,
  gstSplit,
  hasPaymentDetails,
  istDate,
  rs,
  type BillingParty,
  type InvoiceView,
  type PaymentDetails,
} from "./shared";
import { AMBER, BLUE, GREEN, INK, LINE, M, MIST, MUTED, RED, footer, header, label, newDoc, pdfSafe, type RGB } from "./pdf-kit";

export interface InvoicePdfData {
  invoice: InvoiceView;
  from: BillingParty;
  to: BillingParty;
  payment: PaymentDetails;
  intraState: boolean;
  placeOfSupply: string;
}

const STAMP: Record<string, RGB> = { paid: GREEN, verifying: BLUE, due: AMBER, overdue: RED, void: MUTED };

/** Builds the branded A4 invoice and either downloads it or opens it for printing. */
export async function invoicePdf(d: InvoicePdfData, mode: "download" | "print" = "download") {
  const doc = await newDoc();
  const W = doc.internal.pageSize.getWidth();
  const inv = d.invoice;
  const split = gstSplit(inv.gst, d.intraState);
  const right = W - M;

  let y = header(doc, "INVOICE", inv.number) + 34;

  // Status stamp
  const tone = STAMP[inv.display] ?? INK;
  const stamp = pdfSafe(INVOICE_STATUS_LABEL[inv.display].toUpperCase());
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  const sw = doc.getTextWidth(stamp) + 16;
  doc.setDrawColor(...tone);
  doc.setTextColor(...tone);
  doc.setLineWidth(1);
  doc.roundedRect(right - sw, y - 13, sw, 19, 2, 2, "S");
  doc.text(stamp, right - sw / 2, y, { align: "center" });

  // Parties
  const colW = (W - M * 2 - 24) / 2;
  const party = (title: string, p: BillingParty, x: number, top: number) => {
    label(doc, title, x, top);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(...INK);
    const name = doc.splitTextToSize(pdfSafe(p.name), colW) as string[];
    doc.text(name, x, top + 16);
    let yy = top + 16 + name.length * 13;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    for (const line of [...p.lines, ...(p.gst ? [`GSTIN ${p.gst}`] : [])]) {
      const wrapped = doc.splitTextToSize(pdfSafe(line), colW) as string[];
      doc.text(wrapped, x, yy);
      yy += wrapped.length * 12;
    }
    return yy;
  };
  const yA = party("From", d.from, M, y + 24);
  const yB = party("Billed to", d.to, M + colW + 24, y + 24);
  y = Math.max(yA, yB) + 18;

  // Meta strip
  const meta: [string, string][] = [
    ["Invoice no.", inv.number],
    ["Issued", formatDate(inv.issuedOn)],
    ["Due", formatDate(inv.dueOn)],
    ["Place of supply", d.placeOfSupply || "-"],
  ];
  doc.setFillColor(...MIST);
  doc.rect(M, y, W - M * 2, 44, "F");
  const mw = (W - M * 2) / meta.length;
  meta.forEach(([k, v], i) => {
    label(doc, k, M + 12 + i * mw, y + 16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(pdfSafe(v), M + 12 + i * mw, y + 32);
  });
  y += 66;

  // Line items
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.8);
  doc.line(M, y, right, y);
  label(doc, "Description", M, y + 15);
  label(doc, "Period", M + 270, y + 15);
  doc.text("AMOUNT", right, y + 15, { align: "right" });
  y += 24;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.5);
  doc.line(M, y, right, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  const desc = doc.splitTextToSize(pdfSafe(`${inv.line}\nMarchGear dealer partner subscription`), 250) as string[];
  doc.text(desc, M, y + 18);
  doc.text(pdfSafe(`${formatDate(inv.periodStart)} - ${formatDate(inv.periodEnd)}`), M + 270, y + 18);
  doc.text(rs(inv.amount), right, y + 18, { align: "right" });
  y += 18 + desc.length * 12 + 10;
  doc.line(M, y, right, y);

  // Totals
  const tx = right - 220;
  const row = (k: string, v: string, bold = false) => {
    y += 18;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 11 : 9.5);
    doc.setTextColor(...(bold ? INK : MUTED));
    doc.text(pdfSafe(k), tx, y);
    doc.setTextColor(...INK);
    doc.text(pdfSafe(v), right, y, { align: "right" });
  };
  row("Subtotal", rs(inv.amount));
  if (split.intraState) {
    row("CGST @ 9%", rs(split.cgst));
    row("SGST @ 9%", rs(split.sgst));
  } else row("IGST @ 18%", rs(split.igst));
  y += 8;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.8);
  doc.line(tx, y, right, y);
  row("Total", rs(inv.total), true);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(pdfSafe(amountInWords(inv.total)), right, y, { align: "right" });
  if (inv.paidAt) {
    y += 14;
    doc.setTextColor(...GREEN);
    doc.setFont("helvetica", "bold");
    doc.text(pdfSafe(`Paid on ${formatDate(istDate(inv.paidAt))}`), right, y, { align: "right" });
  }
  y += 34;

  // How to pay
  if (inv.display !== "paid" && inv.display !== "void") {
    const lines: string[] = [];
    const p = d.payment;
    if (hasPaymentDetails(p)) {
      if (p.accountName) lines.push(`Account name: ${p.accountName}`);
      if (p.bankName) lines.push(`Bank: ${p.bankName}`);
      if (p.accountNumber) lines.push(`Account number: ${p.accountNumber}`);
      if (p.ifsc) lines.push(`IFSC: ${p.ifsc}`);
      if (p.upi) lines.push(`UPI: ${p.upi}`);
      if (p.instructions) lines.push(p.instructions);
    } else lines.push(NO_PAYMENT_DETAILS);
    lines.push(`Quote ${inv.number} as the payment reference. There is no online payment gateway: pay by bank transfer, UPI or cheque, then record the UTR / transaction ID in the partner portal (Invoices) so MarchGear can verify it.`);
    const wrapped = lines.flatMap((l) => doc.splitTextToSize(pdfSafe(l), W - M * 2 - 32) as string[]);
    const h = wrapped.length * 12.5 + 38;
    doc.setFillColor(...MIST);
    doc.rect(M, y, W - M * 2, h, "F");
    doc.setFillColor(...RED);
    doc.rect(M, y, 3, h, "F");
    label(doc, "How to pay", M + 16, y + 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(wrapped, M + 16, y + 34);
  }

  footer(doc, "Computer-generated invoice from the MarchGear dealer partner portal. Prices are in Indian rupees; GST at 18%.");
  doc.setProperties({ title: `MarchGear invoice ${inv.number}`, author: "MarchGear", subject: `Invoice ${inv.number}` });
  const filename = `MarchGear-Invoice-${inv.number.replace(/\//g, "-")}.pdf`;
  if (mode === "print") {
    const url = doc.output("bloburl");
    const w = window.open(String(url), "_blank");
    if (!w) doc.save(filename);
  } else doc.save(filename);
}
