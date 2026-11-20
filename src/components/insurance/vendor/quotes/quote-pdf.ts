import type { jsPDF as JsPDF } from "jspdf";
import { INDICATIVE_NOTE, INS_PRODUCT_CATEGORY_LABEL } from "@/insurance/labels";
import { AMBER, GREEN, INK, LINE, M, MIST, MUTED, RED, footer, label, newDoc, pdfSafe, table } from "@/components/portal/billing/pdf-kit";
import { formatDayShort } from "@/components/insurance/vendor/crm/badges";
import { istDate } from "@/components/portal/billing/shared";
import { breakdownLines } from "./pricing";
import type { QuoteView } from "./types";

/* The customer-facing quotation PDF, built in the browser with jsPDF. Always carries its authorisation label. */

const rs = (n: number) => `Rs. ${Math.round(n).toLocaleString("en-IN")}`;
export const PDF_FOOTER =
  "MarchGear does not issue policies, collect premiums or settle claims. The insurer issues the policy and sets the final premium, IDV and terms. MarchGear lists products from registered insurers and intermediaries.";

function brandHeader(doc: JsPDF, kicker: string, sub: string) {
  const W = doc.internal.pageSize.getWidth();
  const h = 92;
  doc.setFillColor(...INK);
  doc.rect(0, 0, W, h, "F");
  doc.setFillColor(...RED);
  doc.rect(0, h, W, 2.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("March", M, 52);
  const mw = doc.getTextWidth("March");
  doc.setFont("helvetica", "normal");
  doc.text("Gear", M + mw, 52);
  const gw = doc.getTextWidth("Gear");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  const tag = "INSURANCE";
  const tx = M + mw + gw + 8;
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.6);
  doc.roundedRect(tx, 42, doc.getTextWidth(tag) + 8, 13, 1.5, 1.5, "S");
  doc.text(tag, tx + 4, 51);
  doc.setFontSize(10);
  doc.text(pdfSafe(kicker), W - M, 46, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(190, 190, 190);
  doc.text(pdfSafe(sub), W - M, 59, { align: "right" });
  return h + 2.5;
}

export async function downloadQuotePdf(q: QuoteView, origin: string) {
  const doc = await newDoc();
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const innerW = W - M * 2;
  const bottom = H - 70;
  const authorised = q.authorization === "insurer_authorised";
  // Draws the continuation band on the current page (the table helper adds the page itself).
  const pageBand = () => {
    doc.setFillColor(...INK);
    doc.rect(0, 0, W, 40, "F");
    doc.setFillColor(...RED);
    doc.rect(0, 40, W, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(pdfSafe(`${q.reference}  |  ${authorised ? "Insurer-authorised quotation" : "Indicative estimate - not an insurer quotation"}`), M, 25);
    return 72;
  };
  const compactHeader = () => {
    doc.addPage();
    return pageBand();
  };
  const ensure = (y: number, need: number) => (y + need > bottom ? compactHeader() : y);
  /** Height a pdf-kit table will take, so short tables move to the next page whole instead of splitting. */
  const tableHeight = (widths: number[], rows: string[][]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    return 20 + rows.reduce((sum, row) => sum + Math.max(...row.map((v, i) => (doc.splitTextToSize(pdfSafe(v), widths[i] - 12) as string[]).length)) * 11 + 10, 0);
  };
  const heading = (y: number, title: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(...INK);
    doc.setFillColor(...RED);
    doc.rect(M, y - 8, 6, 6, "F");
    doc.text(pdfSafe(title), M + 12, y - 2);
    return y + 12;
  };

  let y = brandHeader(doc, authorised ? "QUOTATION" : "INDICATIVE ESTIMATE", q.reference) + 26;

  // The label — big and unmissable.
  const bandH = authorised ? 44 : 34;
  const band: [number, number, number] = authorised ? [232, 245, 236] : [253, 243, 225];
  doc.setFillColor(...band);
  doc.rect(M, y, innerW, bandH, "F");
  doc.setFillColor(...(authorised ? GREEN : AMBER));
  doc.rect(M, y, 4, bandH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(...(authorised ? GREEN : AMBER));
  doc.text(authorised ? "INSURER-AUTHORISED QUOTATION" : "INDICATIVE ESTIMATE - NOT AN INSURER QUOTATION", M + 16, y + 21);
  if (authorised) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(pdfSafe(`Insurer ref ${q.insurerQuoteRef ?? "-"}`), M + 16, y + 35);
  }
  y += bandH + 24;

  // Parties
  const colW = (innerW - 24) / 2;
  const block = (x: number, title: string, lines: string[]) => {
    label(doc, title, x, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    const head = doc.splitTextToSize(pdfSafe(lines[0] ?? ""), colW) as string[];
    doc.text(head, x, y + 16);
    const top = y + 16 + (head.length - 1) * 13;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    let used = 14;
    for (const l of lines.slice(1)) {
      const wrapped = doc.splitTextToSize(pdfSafe(l), colW) as string[];
      doc.text(wrapped, x, top + used);
      used += wrapped.length * 12;
    }
    return top - y + used;
  };
  const used = Math.max(
    block(M, "Prepared by", [q.vendor.name, q.vendor.supportPhone ? `Phone ${q.vendor.supportPhone}` : "", q.vendor.supportEmail, `Vendor ${q.vendor.reference}`].filter(Boolean)),
    block(M + colW + 24, "Prepared for", [q.enquiry.name, `+91 ${q.enquiry.mobile}`, q.enquiry.email ?? "", q.enquiry.city ?? "", `Enquiry ${q.enquiry.reference}`].filter(Boolean)),
  );
  y += used + 20;

  // Vehicle and plan
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.5);
  doc.line(M, y, W - M, y);
  y += 20;
  const vehicleText = [q.enquiry.vehicle || "Vehicle", q.enquiry.regNumber ? `Registration ${q.enquiry.regNumber}` : q.enquiry.isNew ? "New car" : ""].filter(Boolean);
  const plan = q.productDetail
    ? [q.productDetail.name, `${INS_PRODUCT_CATEGORY_LABEL[q.productDetail.category]}${q.productDetail.companyName ? ` - underwritten by ${q.productDetail.companyName}` : ""}`, q.productDetail.uin ? `UIN ${q.productDetail.uin}` : `Product code ${q.productDetail.code}`]
    : [q.product?.name ?? "Product no longer listed"];
  y += Math.max(block(M, "Vehicle", vehicleText), block(M + colW + 24, "Plan", plan)) + 18;

  // Key figures
  const figures: [string, string][] = [
    ...(q.breakdown.odYears > 0 ? ([["IDV", rs(q.breakdown.idv)]] as [string, string][]) : []),
    ["Deductible per claim", rs(q.breakdown.deductible)],
    ["Issued", formatDayShort(istDate(q.submittedAt ?? q.createdAt))],
    ["Valid until", formatDayShort(q.validUntil)],
  ];
  const fw = (innerW - (figures.length - 1) * 8) / figures.length;
  figures.forEach(([k, v], i) => {
    const x = M + i * (fw + 8);
    doc.setFillColor(...MIST);
    doc.rect(x, y, fw, 46, "F");
    label(doc, k, x + 10, y + 16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.setTextColor(...INK);
    doc.text(pdfSafe(v), x + 10, y + 35);
  });
  y += 46 + 30;

  // Coverage
  const coverRows = q.coverage.map((c) => [c.name, c.detail || "-"]);
  y = ensure(y, Math.min(tableHeight([150, innerW - 150], coverRows) + 24, bottom - 72));
  y = heading(y, "What's covered");
  y =
    table(
      doc,
      y,
      [
        { title: "Cover", width: 150 },
        { title: "Details", width: innerW - 150 },
      ],
      coverRows,
      { onPage: pageBand, empty: "No coverage lines." },
    ) + 26;

  // Premium — kept together with its total.
  const premiumRows = breakdownLines(q.breakdown)
    .filter((l) => l.kind !== "total")
    .map((l) => [l.label, l.kind === "included" ? "Included" : l.amount < 0 ? `- ${rs(-l.amount)}` : rs(l.amount)]);
  y = ensure(y, tableHeight([innerW - 140, 140], premiumRows) + 24 + 34);
  y = heading(y, authorised ? "Premium" : "Indicative premium");
  y =
    table(
      doc,
      y,
      [
        { title: "Item", width: innerW - 140 },
        { title: "Amount", width: 140, align: "right" },
      ],
      premiumRows,
      { onPage: pageBand },
    ) + 4;
  y = ensure(y, 40);
  doc.setFillColor(...INK);
  doc.rect(M, y, innerW, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.text(authorised ? "Total premium (incl. GST)" : "Indicative total (incl. GST)", M + 10, y + 19);
  doc.text(rs(q.breakdown.total), W - M - 10, y + 19, { align: "right" });
  y += 30 + 14;
  if (q.breakdown.notes.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    for (const n of q.breakdown.notes) {
      const wrapped = doc.splitTextToSize(pdfSafe(`- ${n}`), innerW) as string[];
      y = ensure(y, wrapped.length * 11);
      doc.text(wrapped, M, y);
      y += wrapped.length * 11;
    }
  }
  y += 14;

  const paragraph = (title: string, text: string, size = 9.5) => {
    if (!text.trim()) return;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    const wrapped = doc.splitTextToSize(pdfSafe(text), innerW) as string[];
    y = ensure(y, Math.min(wrapped.length, 6) * 12 + 30);
    y = heading(y, title);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    doc.setTextColor(...INK);
    for (const line of wrapped) {
      if (y + 12 > bottom) y = compactHeader();
      doc.text(line, M, y + 4);
      y += size + 3;
    }
    y += 16;
  };
  paragraph("Notes", q.notes ?? "");
  paragraph("Terms", q.terms ?? "", 8.5);
  if (q.productDetail?.exclusions.length) paragraph("Main exclusions", q.productDetail.exclusions.map((e) => `- ${e}`).join("\n"), 8.5);

  // Honesty + link
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const disclaimer = authorised
    ? `This quotation was issued by the insurer (ref ${q.insurerQuoteRef ?? "-"}) and shared by ${q.vendor.name}. The policy is subject to the insurer's proposal acceptance and terms.`
    : INDICATIVE_NOTE;
  const dl = doc.splitTextToSize(pdfSafe(disclaimer), innerW - 20) as string[];
  y = ensure(y, dl.length * 11 + 40);
  doc.setFillColor(...MIST);
  doc.rect(M, y, innerW, dl.length * 11 + 16, "F");
  doc.setTextColor(...MUTED);
  doc.text(dl, M + 10, y + 13);
  y += dl.length * 11 + 28;
  if (q.status !== "draft") {
    y = ensure(y, 20);
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(pdfSafe(`View or respond online: ${origin}/insurance/quote/${q.shareToken}`), M, y, { maxWidth: innerW });
  } else {
    y = ensure(y, 20);
    doc.setFontSize(9);
    doc.setTextColor(...RED);
    doc.text("DRAFT - not yet sent to the customer.", M, y);
  }

  footer(doc, PDF_FOOTER);
  doc.setProperties({ title: `${q.reference} - ${authorised ? "Insurer-authorised quotation" : "Indicative estimate"}`, author: q.vendor.name, subject: `Car insurance ${authorised ? "quotation" : "estimate"} for ${q.enquiry.name}`, creator: "MarchGear" });
  doc.save(`${q.reference}-${authorised ? "quotation" : "indicative-estimate"}.pdf`);
}
