import type { jsPDF as JsPDF } from "jspdf";
import { checklistCount, checklistFor, type PdiChecklistContent } from "@/lib/pdi";
import type { FuelType } from "@/types";
import { formatDate } from "@/lib/format";

export interface PdfLead {
  name: string;
  email?: string;
  car?: string;
  fuel?: FuelType;
  delivery?: string;
}

const INK: [number, number, number] = [17, 17, 17];
const RED: [number, number, number] = [227, 30, 36];
const MUTED: [number, number, number] = [119, 119, 119];
const LINE: [number, number, number] = [232, 232, 232];

/** What the PDF is built from — the same content the page shows (`content.pdiChecklist`, `content.site.phone`). */
export interface PdfContent {
  checklist: PdiChecklistContent;
  /** Footer contact number. */
  phone: string;
}

/** Number of checks in the PDF for a fuel type (base list + fuel-specific checks). */
export const pdfCheckCount = (checklist: PdiChecklistContent, fuel?: FuelType) => checklistCount(checklistFor(checklist, fuel));
export const CHECKLIST_FILENAME = "MarchGear-PDI-Checklist.pdf";

/** Lays out the branded A4 checklist. Pure — used in the browser and in tests. */
export function buildChecklistPdf(doc: JsPDF, content: PdfContent, lead?: PdfLead | null) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  const textX = M + 22;
  const textW = W - textX - M;
  const bottom = H - 64;
  const groups = checklistFor(content.checklist, lead?.fuel);
  const total = checklistCount(groups);

  const header = (first: boolean) => {
    doc.setFillColor(...INK);
    doc.rect(0, 0, W, first ? 86 : 44, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(first ? 20 : 12);
    const y = first ? 50 : 28;
    // Wordmark as on the site: "March" bold, "Gear" regular, no space.
    doc.text("March", M, y);
    const mw = doc.getTextWidth("March");
    doc.setFont("helvetica", "normal");
    doc.text("Gear", M + mw, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(first ? 9 : 8);
    doc.setTextColor(200, 200, 200);
    doc.text("NEW CAR PDI CHECKLIST", W - M, y, { align: "right" });
  };

  // ── Page 1 header + intro
  header(true);
  let y = 132;
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Pre-delivery inspection checklist", M, y);
  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...MUTED);
  const intro = doc.splitTextToSize(
    `${total} simple checks, in the order you'd do them at the dealership. Tick each one before you sign the delivery papers and pay the balance.`,
    W - M * 2,
  );
  doc.text(intro, M, y);
  y += intro.length * 14 + 4;

  if (lead) {
    const parts = [`Prepared for ${lead.name}`];
    if (lead.car) parts.push(lead.fuel ? `${lead.car} (${lead.fuel})` : lead.car);
    if (lead.delivery) parts.push(`Delivery ${formatDate(lead.delivery)}`);
    doc.setFillColor(245, 245, 245);
    doc.rect(M, y, W - M * 2, 28, "F");
    doc.setFillColor(...RED);
    doc.rect(M, y, 3, 28, "F");
    doc.setTextColor(...INK);
    doc.setFontSize(10);
    doc.text(parts.join("   |   "), M + 14, y + 18);
    y += 44;
  } else {
    y += 8;
  }

  // ── Groups
  groups.forEach((group, gi) => {
    // Keep each heading with at least its first few checks.
    if (y > bottom - 130) {
      doc.addPage();
      header(false);
      y = 84;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.setTextColor(...INK);
    doc.setFillColor(...RED);
    doc.rect(M, y - 9, 8, 8, "F");
    doc.text(`${gi + 1}. ${group.title}`, M + 16, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(`${group.items.length} checks`, W - M, y, { align: "right" });
    y += 8;
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.8);
    doc.line(M, y, W - M, y);
    y += 18;

    group.items.forEach((item) => {
      doc.setFontSize(10.5);
      const lines = doc.splitTextToSize(item.text, textW);
      doc.setFontSize(8.5);
      const tip = item.tip ? doc.splitTextToSize(`Tip: ${item.tip}`, textW) : [];
      const blockH = lines.length * 13 + (tip.length ? tip.length * 11 + 3 : 0) + 12;
      if (y + blockH > bottom) {
        doc.addPage();
        header(false);
        y = 84;
      }
      // tick box
      doc.setDrawColor(...INK);
      doc.setLineWidth(1.1);
      doc.roundedRect(M + 2, y - 9, 11, 11, 1.5, 1.5, "S");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(...INK);
      doc.text(lines, textX, y);
      let iy = y + lines.length * 13;
      if (tip.length) {
        doc.setFontSize(8.5);
        doc.setTextColor(...MUTED);
        doc.text(tip, textX, iy - 1);
        iy += tip.length * 11 + 3;
      }
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.5);
      doc.line(textX, iy - 4, W - M, iy - 4);
      y = iy + 8;
    });
    y += 10;
  });

  // ── Sign-off box
  if (y > bottom - 70) {
    doc.addPage();
    header(false);
    y = 84;
  }
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.8);
  doc.rect(M, y, W - M * 2, 58, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text("Issues noted before delivery", M + 12, y + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text("Write every issue on the dealer's delivery note and get it signed before you accept the car.", M + 12, y + 32);

  // ── Footer on every page
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.5);
    doc.line(M, H - 44, W - M, H - 44);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Want an expert to do this for you? Book a PDI at marchgear.in/pdi-check  |  ${content.phone}`, M, H - 28);
    doc.text(`Page ${i} of ${pages}`, W - M, H - 28, { align: "right" });
  }
  return doc;
}

/** Builds the PDF in the browser and downloads it. */
export async function downloadChecklistPdf(content: PdfContent, lead?: PdfLead | null) {
  const { jsPDF } = await import("jspdf");
  const doc = buildChecklistPdf(new jsPDF({ unit: "pt", format: "a4" }), content, lead);
  doc.setProperties({ title: "MarchGear PDI checklist", author: "MarchGear", subject: "New car pre-delivery inspection checklist" });
  doc.save(CHECKLIST_FILENAME);
}
