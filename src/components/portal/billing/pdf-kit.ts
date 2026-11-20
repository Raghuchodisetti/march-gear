import type { jsPDF as JsPDF } from "jspdf";

/* Shared look for the portal's jsPDF documents (invoices, analytics reports). Browser-only at run time. */

export type RGB = [number, number, number];
export const INK: RGB = [17, 17, 17];
export const INK2: RGB = [32, 32, 32];
export const RED: RGB = [227, 30, 36];
export const MUTED: RGB = [119, 119, 119];
export const LINE: RGB = [232, 232, 232];
export const MIST: RGB = [246, 246, 246];
export const GREEN: RGB = [30, 122, 60];
export const BLUE: RGB = [36, 86, 166];
export const AMBER: RGB = [154, 91, 0];

/** The PDF's built-in fonts only cover Latin-1: swap the few typographic characters we use, drop the rest. */
export function pdfSafe(s: string) {
  return s
    .replace(/₹\s?/g, "Rs. ")
    .replace(/[–—]/g, "-")
    .replace(/[·•]/g, "|")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/→/g, "->")
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "");
}

export async function newDoc() {
  const { jsPDF } = await import("jspdf");
  return new jsPDF({ unit: "pt", format: "a4" });
}

export const M = 48;

/** Black band with the wordmark; `kicker` on the right (e.g. "INVOICE"). Returns the y below it. */
export function header(doc: JsPDF, kicker: string, sub?: string, compact = false) {
  const W = doc.internal.pageSize.getWidth();
  const h = compact ? 44 : 92;
  doc.setFillColor(...INK);
  doc.rect(0, 0, W, h, "F");
  doc.setFillColor(...RED);
  doc.rect(0, h, W, 2.5, "F");
  const y = compact ? 28 : 52;
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(compact ? 12 : 20);
  doc.text("March", M, y);
  const mw = doc.getTextWidth("March");
  doc.setFont("helvetica", "normal");
  doc.text("Gear", M + mw, y);
  const gw = doc.getTextWidth("Gear");
  doc.setFontSize(compact ? 6.5 : 7.5);
  doc.setFont("helvetica", "bold");
  const tag = "PARTNER";
  const tx = M + mw + gw + 8;
  const tw = doc.getTextWidth(tag) + 8;
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.6);
  doc.roundedRect(tx, y - (compact ? 8 : 10), tw, compact ? 11 : 13, 1.5, 1.5, "S");
  doc.text(tag, tx + 4, y - (compact ? 0 : 1));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(compact ? 8 : 10);
  doc.setTextColor(255, 255, 255);
  doc.text(pdfSafe(kicker), W - M, compact ? y : y - 6, { align: "right" });
  if (sub && !compact) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(190, 190, 190);
    doc.text(pdfSafe(sub), W - M, y + 9, { align: "right" });
  }
  return h + 2.5;
}

export function footer(doc: JsPDF, note: string) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.5);
    doc.line(M, H - 44, W - M, H - 44);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(pdfSafe(note), M, H - 28, { maxWidth: W - M * 2 - 70 });
    doc.text(`Page ${i} of ${pages}`, W - M, H - 28, { align: "right" });
  }
}

export function label(doc: JsPDF, text: string, x: number, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(pdfSafe(text.toUpperCase()), x, y);
}

export interface Column {
  title: string;
  width: number;
  align?: "left" | "right";
}

/** A simple table with a header row and hairlines; adds pages as needed. Returns the y after it. */
export function table(doc: JsPDF, y: number, cols: Column[], rows: string[][], opts: { onPage?: () => number; empty?: string } = {}) {
  const H = doc.internal.pageSize.getHeight();
  const bottom = H - 64;
  const drawHead = (yy: number) => {
    doc.setFillColor(...MIST);
    doc.rect(M, yy, cols.reduce((s, c) => s + c.width, 0), 20, "F");
    let x = M;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    for (const c of cols) {
      doc.text(pdfSafe(c.title.toUpperCase()), c.align === "right" ? x + c.width - 6 : x + 6, yy + 13, { align: c.align === "right" ? "right" : "left" });
      x += c.width;
    }
    return yy + 20;
  };
  y = drawHead(y);
  if (!rows.length && opts.empty) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(pdfSafe(opts.empty), M + 6, y + 16);
    return y + 28;
  }
  for (const row of rows) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const cells = row.map((v, i) => doc.splitTextToSize(pdfSafe(v), cols[i].width - 12) as string[]);
    const h = Math.max(...cells.map((c) => c.length)) * 11 + 10;
    if (y + h > bottom) {
      doc.addPage();
      y = drawHead(opts.onPage ? opts.onPage() : 72);
    }
    let x = M;
    doc.setTextColor(...INK);
    cells.forEach((c, i) => {
      const col = cols[i];
      doc.text(c, col.align === "right" ? x + col.width - 6 : x + 6, y + 14, { align: col.align === "right" ? "right" : "left" });
      x += col.width;
    });
    y += h;
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.5);
    doc.line(M, y, x, y);
  }
  return y;
}
