import { formatDate } from "@/lib/format";
import { INK, LINE, M, MIST, MUTED, RED, footer, header, label, newDoc, pdfSafe, table } from "@/components/portal/billing/pdf-kit";
import { METRICS, delta, fmtDuration, fmtPct, pct, type AnalyticsReport, type MetricKey } from "./report";

/* Exports of the analytics view, built in the browser from fresh server data. */

const istStamp = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const change = (m: { value: number; prev: number }) => {
  const d = delta(m);
  return d === null ? "" : d.pct === null ? "new" : `${d.pct >= 0 ? "+" : ""}${d.pct.toFixed(1)}%`;
};
const slug = (r: AnalyticsReport) => `MarchGear-analytics-${r.range.from}-to-${r.range.to}`;

/* ── CSV ── */

function cell(v: string | number) {
  if (typeof v === "number") return String(Number.isInteger(v) ? v : Number(v.toFixed(2)));
  // Spreadsheet formula injection: text starting with = + - @ is shown as text.
  const s = /^[=+\-@\t\r]/.test(v) && !/^[+-]?\d+(\.\d+)?%?$/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function reportCsv(r: AnalyticsReport, compare: boolean) {
  const rows: (string | number)[][] = [];
  const section = (title: string, head: string[], body: (string | number)[][]) => {
    rows.push([], [title], head, ...body);
  };
  rows.push(["MarchGear partner analytics"], ["Dealer", `${r.dealer.name} (${r.dealer.reference})`], ["Period", `${formatDate(r.range.from)} to ${formatDate(r.range.to)} (${r.range.days} days, IST)`]);
  if (compare) rows.push(["Compared with", `${formatDate(r.range.prevFrom)} to ${formatDate(r.range.prevTo)}`]);
  rows.push(["Generated", istStamp(r.generatedAt)]);

  section(
    "Summary",
    compare ? ["Metric", "This period", "Previous period", "Change"] : ["Metric", "This period"],
    [
      ...(Object.keys(METRICS) as MetricKey[]).map((k) => (compare ? [METRICS[k], r.totals[k].value, r.totals[k].prev, change(r.totals[k])] : [METRICS[k], r.totals[k].value])),
      ...(
        [
          ["Lead conversion rate (%)", r.rates.leadConversion],
          ["Test-drive conversion rate (%)", r.rates.testDriveConversion],
          ["Views to enquiry rate (%)", r.rates.viewToEnquiry],
        ] as const
      ).map(([k, m]) => (compare ? [k, m.value, m.prev, ""] : [k, m.value])),
    ],
  );
  section("Contact clicks", ["Channel", "Clicks"], [
    ["Phone", r.clicks.phone],
    ["WhatsApp", r.clicks.whatsapp],
    ["Directions", r.clicks.directions],
  ]);
  section(
    `Trend (${r.bucket === "day" ? "daily" : "weekly"})`,
    compare ? ["From", "To", "Views", "Enquiries", "Previous views", "Previous enquiries"] : ["From", "To", "Views", "Enquiries"],
    r.series.map((p) => (compare ? [p.date, p.end, p.views, p.enquiries, p.prevViews, p.prevEnquiries] : [p.date, p.end, p.views, p.enquiries])),
  );
  section("Lead funnel", ["Stage", "Leads", "% of previous stage"], r.funnel.map((s, i) => [s.label, s.value, i ? fmtPct(pct(s.value, r.funnel[i - 1].value)) : ""]));
  section("Enquiries by source", ["Source", "Enquiries", "Share"], r.sources.map((s) => [s.label, s.value, fmtPct(pct(s.value, r.totals.enquiries.value))]));
  section("Popular vehicles", ["Reference", "Vehicle", "Type", "Status", "Views", "Enquiries", "Won"], r.vehicles.map((v) => [v.reference, v.label, v.kind, v.status, v.views, v.enquiries, v.won]));
  section("Best-performing campaigns", ["Reference", "Offer", "Campaign", "Status", "Views", "Enquiries", "Won"], r.campaigns.map((c) => [c.reference, c.title, c.campaign, c.status, c.views, c.enquiries, c.won]));
  section(
    "Sales team",
    ["Name", "Role", "Assigned", "Contacted", "Converted", "Conversion %", "Avg first response"],
    r.team.map((t) => [t.name, t.role, t.assigned, t.contacted, t.converted, t.assigned ? fmtPct(pct(t.converted, t.assigned)) : "", fmtDuration(t.avgResponseMins)]),
  );
  return rows.map((row) => row.map(cell).join(",")).join("\r\n");
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** CSV, or "Excel": the same CSV with a UTF-8 byte-order mark so Excel opens names and ₹ correctly. */
export function downloadCsv(r: AnalyticsReport, compare: boolean, excel: boolean) {
  const csv = reportCsv(r, compare);
  save(new Blob([excel ? "﻿" : "", csv], { type: "text/csv;charset=utf-8" }), `${slug(r)}${excel ? "-excel" : ""}.csv`);
}

/* ── PDF ── */

export async function downloadPdf(r: AnalyticsReport, compare: boolean) {
  const doc = await newDoc();
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const innerW = W - M * 2;
  const bottom = H - 64;
  const next = () => {
    doc.addPage();
    return header(doc, "ANALYTICS REPORT", undefined, true) + 26;
  };
  const ensure = (y: number, need: number) => (y + need > bottom ? next() : y);
  const heading = (y: number, title: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    doc.setFillColor(...RED);
    doc.rect(M, y - 8, 6, 6, "F");
    doc.text(pdfSafe(title), M + 12, y - 2);
    return y + 12;
  };

  let y = header(doc, "ANALYTICS REPORT", r.dealer.reference) + 36;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...INK);
  doc.text(pdfSafe(r.dealer.name), M, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(pdfSafe(`${formatDate(r.range.from)} - ${formatDate(r.range.to)}  |  ${r.range.days} days (IST)${compare ? `  |  vs ${formatDate(r.range.prevFrom)} - ${formatDate(r.range.prevTo)}` : ""}`), M, y);
  y += 13;
  doc.text(pdfSafe(`Generated ${istStamp(r.generatedAt)}`), M, y);
  y += 26;

  // KPI grid: 2 columns × 5 rows
  const keys = Object.keys(METRICS) as MetricKey[];
  const cw = (innerW - 12) / 2;
  const ch = 50;
  keys.forEach((k, i) => {
    const cx = M + (i % 2) * (cw + 12);
    const cy = y + Math.floor(i / 2) * (ch + 8);
    doc.setFillColor(...MIST);
    doc.rect(cx, cy, cw, ch, "F");
    label(doc, METRICS[k], cx + 12, cy + 16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.setTextColor(...INK);
    doc.text(r.totals[k].value.toLocaleString("en-IN"), cx + 12, cy + 38);
    if (compare) {
      const c = change(r.totals[k]);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      const d = delta(r.totals[k]);
      const rgb: readonly [number, number, number] = d && d.up ? [30, 122, 60] : d ? RED : MUTED;
      doc.setTextColor(rgb[0], rgb[1], rgb[2]);
      doc.text(pdfSafe(`${c || "-"}  (prev ${r.totals[k].prev.toLocaleString("en-IN")})`), cx + cw - 12, cy + 38, { align: "right" });
    }
  });
  y += Math.ceil(keys.length / 2) * (ch + 8) + 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(
    pdfSafe(
      `Lead conversion ${fmtPct(r.rates.leadConversion.value)}  |  Test-drive conversion ${fmtPct(r.rates.testDriveConversion.value)}  |  Views to enquiry ${fmtPct(r.rates.viewToEnquiry.value)}  |  Calls ${r.clicks.phone}, WhatsApp ${r.clicks.whatsapp}, directions ${r.clicks.directions}`,
    ),
    M,
    y,
    { maxWidth: innerW },
  );
  y += 30;

  // Trend chart (views), with the previous period dashed
  y = ensure(y, 210);
  y = heading(y, `Views and enquiries (${r.bucket === "day" ? "daily" : "weekly"})`);
  const chartH = 150;
  const top = y + 6;
  const n = r.series.length;
  const peak = Math.max(1, ...r.series.map((p) => Math.max(p.views, compare ? p.prevViews : 0, p.enquiries)));
  const mag = 10 ** Math.floor(Math.log10(peak / 4 || 1));
  const tick = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s * 4 >= peak) ?? 10 * mag;
  const maxV = Math.max(4, tick * 4);
  const px = (i: number) => M + 30 + (n <= 1 ? 0 : (i / (n - 1)) * (innerW - 30));
  const py = (v: number) => top + chartH - (v / maxV) * chartH;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.5);
  for (let t = 0; t <= 4; t++) {
    const v = (maxV / 4) * t;
    doc.line(M + 30, py(v), W - M, py(v));
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(String(Math.round(v)), M + 24, py(v) + 2, { align: "right" });
  }
  const plot = (vals: number[], rgb: readonly [number, number, number], width: number, dash?: number[]) => {
    doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
    doc.setLineWidth(width);
    if (dash) doc.setLineDashPattern(dash, 0);
    for (let i = 1; i < vals.length; i++) doc.line(px(i - 1), py(vals[i - 1]), px(i), py(vals[i]));
    if (dash) doc.setLineDashPattern([], 0);
  };
  if (compare) plot(r.series.map((p) => p.prevViews), [154, 154, 154], 1, [3, 3]);
  plot(r.series.map((p) => p.enquiries), INK, 1.4);
  plot(r.series.map((p) => p.views), RED, 1.8);
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  const every = Math.max(1, Math.ceil(n / 7));
  r.series.forEach((p, i) => {
    if (i % every === 0 || i === n - 1) doc.text(pdfSafe(formatDate(p.date).replace(/ \d{4}$/, "")), px(i), top + chartH + 12, { align: i === 0 ? "left" : i === n - 1 ? "right" : "center" });
  });
  y = top + chartH + 26;
  const legend = (x: number, rgb: readonly [number, number, number], text: string, dash = false) => {
    doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
    doc.setLineWidth(1.6);
    if (dash) doc.setLineDashPattern([3, 3], 0);
    doc.line(x, y - 3, x + 14, y - 3);
    doc.setLineDashPattern([], 0);
    doc.setTextColor(...MUTED);
    doc.text(pdfSafe(text), x + 18, y);
    return x + 18 + doc.getTextWidth(pdfSafe(text)) + 16;
  };
  let lx = legend(M + 30, RED, "Views");
  lx = legend(lx, INK, "Enquiries");
  if (compare) legend(lx, [154, 154, 154], "Views, previous period", true);
  y += 26;

  // Funnel
  y = ensure(y, 150);
  y = heading(y, "Lead funnel");
  const topV = Math.max(1, r.funnel[0]?.value ?? 0);
  r.funnel.forEach((s, i) => {
    const bw = (s.value / topV) * (innerW - 190);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(pdfSafe(s.label), M, y + 11);
    doc.setFillColor(...MIST);
    doc.rect(M + 130, y, innerW - 190, 15, "F");
    doc.setFillColor(...(i === r.funnel.length - 1 ? RED : INK));
    if (s.value) doc.rect(M + 130, y, Math.max(bw, 2), 15, "F");
    doc.setFont("helvetica", "bold");
    doc.text(`${s.value}${i ? `  (${r.funnel[i - 1].value ? fmtPct(pct(s.value, r.funnel[i - 1].value)) : "-"})` : ""}`, W - M, y + 11, { align: "right" });
    y += 22;
  });
  y += 16;

  const onPage = () => header(doc, "ANALYTICS REPORT", undefined, true) + 26;
  const block = (title: string, cols: Parameters<typeof table>[2], rows: string[][], empty: string) => {
    y = ensure(y, 90);
    y = heading(y, title);
    y = table(doc, y, cols, rows, { onPage, empty }) + 26;
  };
  block(
    "Enquiries by source",
    [
      { title: "Source", width: innerW - 160 },
      { title: "Enquiries", width: 80, align: "right" },
      { title: "Share", width: 80, align: "right" },
    ],
    r.sources.map((s) => [s.label, String(s.value), fmtPct(pct(s.value, r.totals.enquiries.value))]),
    "No enquiries in this period.",
  );
  block(
    "Popular vehicles",
    [
      { title: "Vehicle", width: innerW - 230 },
      { title: "Status", width: 80 },
      { title: "Views", width: 50, align: "right" },
      { title: "Enquiries", width: 60, align: "right" },
      { title: "Won", width: 40, align: "right" },
    ],
    r.vehicles.map((v) => [`${v.label} (${v.reference})`, v.status, String(v.views), String(v.enquiries), String(v.won)]),
    "No vehicle views or enquiries in this period.",
  );
  block(
    "Best-performing campaigns",
    [
      { title: "Offer / campaign", width: innerW - 230 },
      { title: "Status", width: 80 },
      { title: "Views", width: 50, align: "right" },
      { title: "Enquiries", width: 60, align: "right" },
      { title: "Won", width: 40, align: "right" },
    ],
    r.campaigns.map((c) => [`${c.title} - ${c.campaign}`, c.status, String(c.views), String(c.enquiries), String(c.won)]),
    "No offer views or enquiries in this period.",
  );
  block(
    "Sales team",
    [
      { title: "Name", width: innerW - 300 },
      { title: "Assigned", width: 60, align: "right" },
      { title: "Contacted", width: 65, align: "right" },
      { title: "Converted", width: 65, align: "right" },
      { title: "Avg response", width: 110, align: "right" },
    ],
    r.team.map((t) => [`${t.name} - ${t.role}`, String(t.assigned), String(t.contacted), `${t.converted}${t.assigned ? ` (${fmtPct(pct(t.converted, t.assigned))})` : ""}`, fmtDuration(t.avgResponseMins)]),
    "No enquiries assigned in this period.",
  );

  footer(doc, "MarchGear dealer partner portal | Views and clicks are counted on marchgear.in; enquiries and conversions come from your CRM. Times in IST.");
  doc.setProperties({ title: `MarchGear analytics - ${r.dealer.name}`, author: "MarchGear", subject: `Analytics ${r.range.from} to ${r.range.to}` });
  doc.save(`${slug(r)}.pdf`);
}
