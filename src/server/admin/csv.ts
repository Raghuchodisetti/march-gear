import "server-only";

/** One CSV cell. Always quoted; text a spreadsheet would run as a formula gets a leading apostrophe. */
export function csvCell(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** A CSV download. UTF-8 with a BOM so Excel reads ₹ and accented names correctly. */
export function csvResponse(filename: string, header: string[], rows: unknown[][]) {
  const csv = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
