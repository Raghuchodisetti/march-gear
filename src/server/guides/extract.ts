import "server-only";
import { getDocumentProxy } from "unpdf";
import { GUIDE_MAX_CHARS, GUIDE_MAX_PAGES, contentChars, type GuideBlock } from "@/lib/guides";

/* ──────────────────────────────────────────────────────────────
   PDF → guide blocks. PDF.js (via unpdf, pure JavaScript) gives
   each run of text with its position, size and font; from those we
   rebuild the page:
   - lines, in the order the PDF draws them (which keeps columns and
     cards together);
   - tables, from a header row's columns: every piece of text below
     it is placed by column and grouped into rows by the gaps between
     them (so two-line cells and group rows survive), and a table
     that continues on the next page is joined back up;
   - headings from bigger or bold type, lists from bullet/number
     markers or indented runs, paragraphs from the rest;
   - running headers/footers, page numbers, decorative numbers and
     the PDF's own title banner are dropped (the page has its own).
   It's a best effort — the admin reviews and edits the result.
   Images and drawings aren't carried over (the PDF itself can be
   offered as a download).
   ────────────────────────────────────────────────────────────── */

export class PdfReadError extends Error {}

// PDF.js calls Promise.try, which Node only has from v23; hosts may run Node 20 or 22 (Next 16 needs ≥ 20.9).
// Checked: with this, text extraction works on Node 20.18, 22.12 and 24.
const P = Promise as unknown as { try?: unknown };
if (typeof P.try !== "function") P.try = (fn: (...a: unknown[]) => unknown, ...args: unknown[]) => new Promise((resolve) => resolve(fn(...args)));

/** One run of text, in PDF points (y grows upwards; y is the baseline). */
interface Item {
  str: string;
  x: number;
  y: number;
  w: number;
  size: number;
  bold: boolean;
}

interface Cell {
  text: string;
  x0: number;
  x1: number;
}

interface Line {
  text: string;
  /** Font size (the one most of the line's characters use). */
  size: number;
  /** Share of the line's characters set in a bold font (0–1). */
  bold: number;
  x0: number;
  x1: number;
  y: number;
  page: number;
  /** Pieces separated by wide gaps on one baseline (table cells, or text side by side). */
  cells: Cell[] | null;
  /** A table rebuilt from a region of the page: rows of cells, header row first. */
  table?: string[][];
}

const chars = (...codes: number[]) => String.fromCodePoint(...codes);
/** Bullets drawn with symbol fonts (Wingdings, Symbol) land in the Private Use Area. */
const SYMBOL_BULLETS = new RegExp(`[${chars(0xf0b7, 0xf0a7, 0xf076, 0xf0d8, 0xf0fc, 0xf0a8)}]`, "g");
const PRIVATE_USE = new RegExp(`[${chars(0xe000)}-${chars(0xf8ff)}]`, "g");
const SOFT_HYPHEN = new RegExp(chars(0xad), "g");
const CONTROL = new RegExp(`[${chars(0)}-${chars(8)}${chars(0x0b)}-${chars(0x1f)}${chars(0x7f)}]`, "g");
/** Typographic ligatures (ﬀ ﬁ ﬂ ﬃ ﬄ ﬅ ﬆ) → letters. Not full NFKC, which would also turn "v²" into "v2". */
const LIGATURES = new Map([0xfb00, 0xfb01, 0xfb02, 0xfb03, 0xfb04, 0xfb05, 0xfb06].map((c, k) => [chars(c), ["ff", "fi", "fl", "ffi", "ffl", "st", "st"][k]]));
const LIGATURE = new RegExp(`[${chars(0xfb00)}-${chars(0xfb06)}]`, "g");

const BULLET_MARK = /^(?:[•●▪■◦○‣∙·➢➤►▶✓✔❖]\s*|[-–—*]\s+)/;
const NUMBER_MARK = /^(?:\(?\d{1,2}[.)]|\(?[a-hA-H][.)]|\(?(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)\))\s+/;
const MARKER_ONLY = /^(?:[•●▪■◦○‣∙·➢➤►▶✓✔❖*–—-]|\(?\d{1,2}[.)]|\(?[a-hA-H][.)])$/;
const SENTENCE_END = /[.!?:;"”’)\]]$/;
const PAGE_NUMBER = /^(?:page\s*)?\d{1,4}(?:\s*(?:of|\/)\s*\d{1,4})?$/i;
const BOLD_FONT = /bold|black|heavy|demi/i;
const HAS_LETTER = /\p{L}/u;

const clean = (s: string) => {
  const t = s
    .normalize("NFC")
    .replace(LIGATURE, (l) => LIGATURES.get(l) ?? l)
    .replace(SOFT_HYPHEN, "")
    .replace(SYMBOL_BULLETS, "•")
    .replace(PRIVATE_USE, "")
    .replace(CONTROL, "")
    .replace(/\s+/g, " ")
    .trim();
  // Letter-spaced display type ("M A R C H G E A R") → one word.
  return /^(?:\S ){3,}\S$/.test(t) ? t.replace(/ /g, "") : t;
};

function mode(values: { value: number; weight: number }[]) {
  const m = new Map<number, number>();
  for (const { value, weight } of values) m.set(value, (m.get(value) ?? 0) + weight);
  let best = 0;
  let bestWeight = -1;
  for (const [v, w] of m) if (w > bestWeight) [best, bestWeight] = [v, w];
  return best;
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

type Pdf = Awaited<ReturnType<typeof getDocumentProxy>>;
type Page = Awaited<ReturnType<Pdf["getPage"]>>;

/** A page's text runs, with which ones are bold (from the font names, e.g. "Inter-Bold"). */
async function readPage(page: Page): Promise<Item[]> {
  // Loading the drawing instructions loads the page's fonts, so their names can be read.
  try {
    await page.getOperatorList();
  } catch {
    /* fonts unknown — no bold detection on this page */
  }
  const content = await page.getTextContent();
  const boldFonts = new Map<string, boolean>();
  const isBold = (font: string) => {
    let b = boldFonts.get(font);
    if (b === undefined) {
      try {
        b = BOLD_FONT.test(String((page.commonObjs.get(font) as { name?: unknown } | undefined)?.name ?? ""));
      } catch {
        b = false;
      }
      boldFonts.set(font, b);
    }
    return b;
  };
  return content.items.flatMap((i) => {
    if (!("str" in i)) return [];
    const [, , c, d, x, y] = i.transform;
    return [{ str: i.str, x, y, w: i.width || 0, size: Math.hypot(c, d) || i.height || 0, bold: isBold(i.fontName) }];
  });
}

/** Text runs → lines, in the order the PDF draws them. */
function pageLines(items: Item[], page: number): Line[] {
  type Open = { parts: string[]; cells: { parts: string[]; x0: number; x1: number }[]; sizes: { value: number; weight: number }[]; boldChars: number; chars: number; x0: number; x1: number; y: number; size: number };
  const lines: Line[] = [];
  let cur: Open | null = null;

  const finish = () => {
    if (!cur) return;
    const text = clean(cur.parts.join(""));
    if (text) {
      const cells = cur.cells.map((c) => ({ text: clean(c.parts.join("")), x0: c.x0, x1: c.x1 })).filter((c) => c.text);
      lines.push({ text, size: mode(cur.sizes), bold: cur.chars ? cur.boldChars / cur.chars : 0, x0: cur.x0, x1: cur.x1, y: cur.y, page, cells: cells.length >= 2 ? cells : null });
    }
    cur = null;
  };

  for (const it of items) {
    const size = Math.round(it.size * 2) / 2;
    // PDF.js fills gaps with whitespace runs as wide as the gap; skip them so the gap itself decides. Its end-of-line
    // flags aren't trusted either (zero-width glyphs, e.g. in Telugu, set them mid-line): position alone decides.
    if (!it.str.trim()) continue;
    // A new baseline, or a jump back to the left on the same one (the next card or column), starts a new line.
    if (cur && (Math.abs(it.y - cur.y) > Math.max(size, cur.size, 1) * 0.5 || it.x < cur.x1 - Math.max(size, cur.size, 1) * 2)) finish();
    if (!cur) {
      cur = { parts: [], cells: [{ parts: [], x0: it.x, x1: it.x }], sizes: [], boldChars: 0, chars: 0, x0: it.x, x1: it.x, y: it.y, size };
    } else {
      const gap = it.x - cur.x1;
      const em = Math.max(size, cur.size, 1);
      const markerOnly = MARKER_ONLY.test(clean(cur.parts.join("")));
      if (gap > em * 1.6 && !markerOnly) {
        // A wide gap on one baseline: a new cell (not after a lone list marker like "•" or "1.").
        cur.parts.push(" · ");
        cur.cells.push({ parts: [], x0: it.x, x1: it.x });
      } else if (gap > em * 0.12 && !/\s$/.test(cur.parts.at(-1) ?? "") && !/^\s/.test(it.str)) {
        cur.parts.push(" ");
        cur.cells.at(-1)!.parts.push(" ");
      }
    }
    const cell = cur.cells.at(-1)!;
    cur.parts.push(it.str);
    cell.parts.push(it.str);
    cell.x1 = Math.max(cell.x1, it.x + it.w);
    const n = it.str.trim().length;
    cur.sizes.push({ value: size, weight: n });
    cur.chars += n;
    if (it.bold) cur.boldChars += n;
    cur.size = mode(cur.sizes) || size;
    cur.x1 = Math.max(cur.x1, it.x + it.w);
  }
  finish();
  return lines;
}

/* ── Tables ─────────────────────────────────────────────────── */

/** A table's header: three or more short labels side by side, with more lines just below. */
const isHeaderRow = (h: Line, next: Line | undefined) => {
  const cells = h.cells;
  if (!cells || cells.length < 3 || !next || next.page !== h.page) return false;
  const below = h.y - next.y;
  return (
    below > 0 &&
    below < h.size * 6 &&
    cells.every((c) => c.text.length <= 40 && !/[.!?]$/.test(c.text)) &&
    cells.reduce((n, c) => n + c.text.length, 0) / cells.length <= 24 &&
    cells.filter((c) => HAS_LETTER.test(c.text)).length >= Math.ceil(cells.length * 0.66)
  );
};

/** One cell's runs, top to bottom: pieces of one line joined as they sit, lines joined with a space (or " · " between a value and its smaller unit line). */
function joinCell(items: Item[]): string {
  const byY = [...items].sort((a, b) => b.y - a.y);
  const rows: Item[][] = [];
  for (const it of byY) {
    const row = rows.at(-1);
    if (row && Math.abs(row[0].y - it.y) <= Math.max(row[0].size, it.size) * 0.5) row.push(it);
    else rows.push([it]);
  }
  let out = "";
  let prev: Item | null = null;
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    row.forEach((it, k) => {
      if (prev) {
        if (k > 0) {
          if (it.x - (prev.x + prev.w) > Math.max(prev.size, it.size) * 0.12 && !/\s$/.test(out) && !/^\s/.test(it.str)) out += " ";
        } else out += Math.abs(prev.size - it.size) > Math.max(prev.size, it.size) * 0.2 ? " · " : " ";
      }
      out += it.str;
      prev = it;
    });
  }
  return clean(out);
}

/** The runs under a header row → rows of cells (by the header's columns and the gaps between rows). */
function buildRows(header: Line, region: Item[]): string[][] {
  const boxes = header.cells!;
  // Column boundaries: the widest strip of empty space between neighbouring columns' text (labels may be centred
  // over their column, and text may run past its label); failing that, just before the next label.
  const covered: [number, number][] = [];
  for (const [a, b] of region.map((it) => [it.x, it.x + it.w] as [number, number]).sort((p, q) => p[0] - q[0])) {
    const last = covered.at(-1);
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else covered.push([a, b]);
  }
  const gaps = covered.slice(1).map((c, k) => [covered[k][1], c[0]] as [number, number]);
  const bounds = boxes.slice(1).map((b, k) => {
    const inside = gaps.filter(([g0, g1]) => (g0 + g1) / 2 > boxes[k].x0 && (g0 + g1) / 2 <= b.x0 + 2);
    const widest = inside.sort((p, q) => q[1] - q[0] - (p[1] - p[0]))[0];
    return widest ? (widest[0] + widest[1]) / 2 : b.x0 - Math.min(10, (b.x0 - boxes[k].x1) / 2);
  });
  const column = (x: number) => {
    let c = 0;
    while (c < bounds.length && x >= bounds[c]) c++;
    return c;
  };
  const rows: Item[][] = [];
  let bottom = Infinity;
  for (const it of [...region].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const top = it.y + it.size * 0.8;
    // A clear gap above this run (row padding) starts a new row; overlapping runs (centred cells, two-line cells) share one.
    if (!rows.length || top < bottom - Math.max(1.5, it.size * 0.3)) {
      rows.push([]);
      bottom = Infinity;
    }
    rows.at(-1)!.push(it);
    bottom = Math.min(bottom, it.y - it.size * 0.25);
  }
  return rows
    .map((r) => {
      const cells = boxes.map(() => [] as Item[]);
      for (const it of r) cells[column(it.x)].push(it);
      return cells.map(joinCell);
    })
    .filter((r) => r.some(Boolean));
}

/** Replaces each table region on a page (header row and everything under it) with one table line. */
function extractTables(lines: Line[], items: Item[]): Line[] {
  const out: Line[] = [];
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i];
    if (!isHeaderRow(h, lines[i + 1])) {
      out.push(h);
      continue;
    }
    const x0 = Math.min(...h.cells!.map((c) => c.x0));
    const x1 = Math.max(...h.cells!.map((c) => c.x1));
    const width = Math.max(x1 - x0, 1);
    let bottom = h.y - h.size * 0.3;
    let j = i + 1;
    for (; j < lines.length; j++) {
      const l = lines[j];
      // Past the table: a jump down the page, something above it, a paragraph across it or a section heading.
      if (l.y + l.size < bottom - h.size * 3.5 || l.y > h.y + h.size) break;
      const span = l.x1 - l.x0;
      if (!l.cells && span > width * 0.55 && l.text.length > 50) break;
      // A line starting left of the first column (a heading or paragraph at the page margin).
      if (!l.cells && l.x0 < x0 - 3) break;
      if (!l.cells && l.size >= h.size * 1.3 && l.bold >= 0.6 && span > width * 0.3) break;
      bottom = Math.min(bottom, l.y - l.size * 0.3);
    }
    const region = items.filter((it) => it.str.trim() && it.y <= h.y + h.size * 0.5 && it.y >= bottom);
    const rows = j > i + 1 ? buildRows(h, region) : [];
    if (rows.length < 2) {
      out.push(h);
      continue;
    }
    out.push({ ...h, text: rows[0].join(" · "), cells: null, table: rows });
    i = j - 1;
  }
  return out;
}

/* ── Page furniture ─────────────────────────────────────────── */

/** Drops running headers/footers (repeated at the top or bottom of most pages) and bare page numbers. */
function dropFurniture(lines: Line[], pages: number) {
  const text = lines.filter((l) => !l.table);
  const byPage = new Map<number, Line[]>();
  for (const l of text) byPage.set(l.page, [...(byPage.get(l.page) ?? []), l]);
  const edge = new Set<Line>();
  for (const ls of byPage.values()) {
    const sorted = [...ls].sort((a, b) => b.y - a.y);
    for (const l of [...sorted.slice(0, 2), ...sorted.slice(-2)]) edge.add(l);
  }
  // Headers and footers are short or set in small type; body text that happens to repeat at a page's top isn't.
  const body = mode(text.map((l) => ({ value: l.size, weight: l.text.length }))) || 10;
  const small = (l: Line) => l.size < body * 0.95;
  const furnitureLike = (l: Line) => small(l) || l.text.length <= 60;
  // Page numbers inside a header/footer ("Page 3 of 9", "2 / 3") differ per page — compare those without digits.
  const key = (l: Line) => (/\bpage\b|\d\s*(?:\/|of)\s*\d/i.test(l.text) ? l.text.toLowerCase().replace(/\d+/g, "#") : l.text.toLowerCase());
  const counts = new Map<string, Set<number>>();
  for (const l of edge) if (furnitureLike(l)) counts.set(key(l), (counts.get(key(l)) ?? new Set()).add(l.page));
  // On short documents a header must be on every page (or all but a title page); on longer ones, on most.
  const needed = pages <= 3 ? Math.max(2, pages - 1) : Math.ceil(pages * 0.5);
  const repeated = (l: Line) => pages >= 2 && furnitureLike(l) && (counts.get(key(l))?.size ?? 0) >= needed;
  return lines.filter((l) => !(edge.has(l) && (PAGE_NUMBER.test(l.text) || repeated(l))));
}

/* ── Lines → blocks ─────────────────────────────────────────── */

function toBlocks(input: Line[]): GuideBlock[] {
  const textLines = input.filter((l) => !l.table);
  const body = mode(textLines.map((l) => ({ value: l.size, weight: l.text.length }))) || 10;

  // Decorations: big numbers or ornaments with no words (card numbers like "01", "02"), and list markers the PDF
  // draws apart from their items ("1.", "•" on their own) — the items still become a list.
  let lines = input.filter((l) => l.table || ((HAS_LETTER.test(l.text) || l.size < body * 1.12) && !MARKER_ONLY.test(l.text)));

  // The PDF's own title banner: the biggest type in the file, at the top of page 1 (one to three lines), with the
  // short line above it (a kicker like "MARCH GEAR"). The page shows the topic name instead, so it's dropped.
  const sizes = lines.filter((l) => !l.table).map((l) => l.size);
  const maxSize = sizes.length ? Math.max(...sizes) : 0;
  const start = lines.findIndex((l, k) => k < 8 && l.page === 1 && !l.table && l.size === maxSize);
  if (start >= 0 && maxSize >= body * 1.5) {
    let end = start;
    while (end + 1 < lines.length && lines[end + 1].page === 1 && lines[end + 1].size === maxSize) end++;
    const run = lines.slice(start, end + 1);
    if (run.length <= 3 && lines.filter((l) => !l.table && l.size === maxSize).length === run.length) {
      const drop = new Set(run);
      const kicker = lines[start - 1];
      if (kicker && kicker.page === 1 && !kicker.table && kicker.text.length <= 30 && kicker.size < maxSize && kicker.y > run[0].y) drop.add(kicker);
      lines = lines.filter((l) => !drop.has(l));
    }
  }

  const bodyLines = lines.filter((l) => !l.table && !l.cells && l.size === body);
  // Typical distance between consecutive body lines (the leading) and the usual line width.
  const leading =
    median(
      lines.flatMap((l, k) => {
        const p = lines[k - 1];
        const gap = p && p.page === l.page ? p.y - l.y : 0;
        return p && l.size === body && p.size === body && gap > 0 && gap < body * 3 ? [gap] : [];
      }),
    ) || body * 1.25;
  const widths = bodyLines.map((l) => l.x1 - l.x0);
  const fullWidth = widths.length ? [...widths].sort((a, b) => a - b)[Math.floor(widths.length * 0.9)] : 0;
  const leftMargin = median(bodyLines.map((l) => l.x0));

  // Headings: bigger type (bold, or short), or a short line set entirely in bold (e.g. a card's title).
  const sizeHeading = (l: Line) =>
    !l.cells && !l.table && l.text.length <= 160 && (l.size >= body * 1.35 || (l.size >= body * 1.12 && (l.bold >= 0.6 || (l.text.length <= 60 && !/[.,;:]$/.test(l.text)))));
  const boldHeading = (l: Line) => !l.cells && !l.table && l.bold >= 0.9 && l.size >= body * 0.98 && l.text.length <= 120 && !/[.,;:]$/.test(l.text);
  const allCapsHeading = (l: Line) =>
    !l.table && l.size >= body * 0.95 && l.text.length >= 4 && l.text.length <= 70 && /[A-Z]{3}/.test(l.text) && l.text === l.text.toUpperCase() && !/[.,;]$/.test(l.text);
  const headingSizes = [...new Set(lines.filter(sizeHeading).map((l) => l.size))].sort((a, b) => b - a);
  const level = (l: Line): "h2" | "h3" => {
    if (!sizeHeading(l)) return headingSizes.length ? "h3" : "h2";
    return headingSizes.length > 1 && l.size < headingSizes[0] ? "h3" : "h2";
  };

  type Open = { kind: "p" | "li" | "h" | "table"; line: Line; markerX?: number; implicit?: boolean; right?: number };
  const blocks: GuideBlock[] = [];
  // (Declared with `as` so TypeScript doesn't narrow them to null: `step` below updates them.)
  let prev = null as Line | null;
  // Where the open paragraph / list item / heading / table is.
  let open = null as Open | null;
  // The latest line that isn't part of an indented run (what an indented run is measured from).
  let anchor = null as Line | null;

  const gapFrom = (p: Line | null, l: Line) => (p && p.page === l.page ? p.y - l.y : Number.NaN);
  const appendText = (target: string, next: string) => (/\w-$/.test(target) && /^[a-z]/.test(next) ? target.slice(0, -1) + next : `${target} ${next}`);
  const sameIndent = (a: Line | null | undefined, b: Line) => Boolean(a) && a!.page === b.page && Math.abs(a!.x0 - b.x0) < 2;

  for (const [i, l] of lines.entries()) {
    const gap = gapFrom(prev, l);
    // The next line of the same block: no further below than usual (bigger type has wider line spacing).
    const sameFlow = !Number.isNaN(gap) && gap > 0 && gap <= Math.max(leading * 1.35, l.size * 1.85);
    const last = blocks.at(-1);
    const step = (kind: Open["kind"], extra: Partial<Open> = {}) => {
      open = { kind, line: l, ...extra };
      prev = l;
      if (!extra.implicit) anchor = l;
    };

    // Tables (a table continued on the next page, under the same header, is joined to it).
    if (l.table) {
      if (last?.type === "table" && last.rows[0]?.join("|") === l.table[0].join("|")) last.rows.push(...l.table.slice(1));
      else blocks.push({ type: "table", rows: l.table });
      step("table");
      continue;
    }

    // Headings.
    if (sizeHeading(l) || boldHeading(l) || (allCapsHeading(l) && (!sameFlow || open?.kind === "h"))) {
      const t = sizeHeading(l) || boldHeading(l) ? level(l) : "h3";
      if (open?.kind === "h" && last && last.type === t && sameFlow && l.size === open.line.size) last.text = appendText(last.text, l.text);
      else blocks.push({ type: t, text: l.text });
      step("h");
      continue;
    }

    // Simple tables without a header row: consecutive lines of short cells.
    if (l.cells && l.cells.every((c) => c.text.length <= 60)) {
      const cells = l.cells.map((c) => c.text);
      // Rows sit further apart than lines of text (cell padding), so allow a wider gap.
      if (open?.kind === "table" && last?.type === "table" && (Number.isNaN(gap) || (gap > 0 && gap <= leading * 2.6))) last.rows.push(cells);
      else blocks.push({ type: "table", rows: [cells] });
      step("table");
      continue;
    }

    // List items with a marker.
    const bullet = BULLET_MARK.exec(l.text);
    const numbered = !bullet ? NUMBER_MARK.exec(l.text) : null;
    const marker = bullet ?? numbered;
    if (marker && l.text.length > marker[0].length) {
      const kind = bullet ? "ul" : "ol";
      const item = l.text.slice(marker[0].length).trim();
      const continuesList = last && last.type === kind && (open?.kind === "li" || open?.kind === "p") && (sameFlow || Number.isNaN(gap) || gap <= leading * 2);
      if (continuesList && (last.type === "ul" || last.type === "ol")) last.items.push(item);
      else blocks.push({ type: kind, items: [item] });
      step("li", { markerX: l.x0 });
      continue;
    }

    // Lists whose bullets are drawn as shapes rather than text (common in PDFs printed from browsers and Word): a run of
    // lines indented past the line before them. A short line — or a sentence end before a capital — ends an item.
    const next = lines[i + 1];
    const inRun = open?.kind === "li" && open.implicit;
    const continueRun = inRun && sameFlow && sameIndent(prev, l);
    const startRun =
      !inRun &&
      anchor !== null &&
      anchor.page === l.page &&
      !anchor.table &&
      l.x0 > anchor.x0 + body &&
      anchor.y > l.y &&
      anchor.y - l.y < leading * 4 &&
      sameIndent(next, l) &&
      l.y - next!.y > 0 &&
      l.y - next!.y <= leading * 1.35;
    if (continueRun || startRun) {
      const right = Math.max(open?.right ?? 0, l.x1);
      if (continueRun && last?.type === "ul" && prev) {
        const p: Line = prev;
        // Smaller text under an item (e.g. a source's web address) belongs to it.
        const smaller = l.size < p.size * 0.9;
        const itemEnded = !smaller && (p.x1 - p.x0 < (right - p.x0) * 0.85 || (SENTENCE_END.test(p.text) && /^[A-Z0-9₹"“(]/.test(l.text)));
        if (itemEnded) last.items.push(l.text);
        else last.items[last.items.length - 1] = appendText(last.items[last.items.length - 1], l.text);
      } else blocks.push({ type: "ul", items: [l.text] });
      step("li", { implicit: true, right });
      continue;
    }

    // Wrapped list item text: indented past its marker and in the same flow.
    if (open?.kind === "li" && !open.implicit && last && (last.type === "ul" || last.type === "ol") && sameFlow && l.x0 > (open.markerX ?? 0) + body * 0.3) {
      last.items[last.items.length - 1] = appendText(last.items[last.items.length - 1], l.text);
      prev = l;
      continue;
    }

    // Paragraph text.
    if (open?.kind === "p" && last?.type === "p" && prev) {
      const p: Line = prev;
      const endedSentence = SENTENCE_END.test(p.text);
      const shortLine = fullWidth > 0 && p.x1 - p.x0 < fullWidth * 0.7;
      const indented = l.x0 > leftMargin + body * 0.8 && p.x0 <= leftMargin + body * 0.4;
      const resized = Math.abs(l.size - p.size) > p.size * 0.12;
      const pageTurn = p.page !== l.page;
      const continues = resized ? false : pageTurn ? !endedSentence && /^[a-z(,;]/.test(l.text) : sameFlow && !(endedSentence && (shortLine || indented));
      if (continues) {
        last.text = appendText(last.text, l.text);
        prev = l;
        continue;
      }
    }
    blocks.push({ type: "p", text: l.text });
    step("p");
  }

  return blocks.map((b) => {
    // A "heading" that ran on for several lines was a bold paragraph.
    if ((b.type === "h2" || b.type === "h3") && b.text.length > 160) return { type: "p" as const, text: b.text };
    // Single-row "tables" are just spaced-out lines (e.g. "Name · Value" once) — keep them as text.
    if (b.type === "table" && b.rows.length < 2) return { type: "p" as const, text: b.rows[0].filter(Boolean).join(" · ") };
    return b;
  });
}

export interface ExtractedGuide {
  blocks: GuideBlock[];
  pages: number;
}

/** Reads a PDF's text into guide blocks. Throws PdfReadError with a message for the admin. */
export async function extractGuide(data: Uint8Array): Promise<ExtractedGuide> {
  let pdf: Pdf;
  try {
    pdf = await getDocumentProxy(new Uint8Array(data), { isEvalSupported: false, disableFontFace: true, useSystemFonts: false, stopAtErrors: false, verbosity: 0 });
  } catch (err) {
    const name = (err as { name?: string })?.name;
    if (name === "PasswordException") throw new PdfReadError("This PDF is password-protected. Remove the password and upload it again.");
    throw new PdfReadError("Couldn't read this file as a PDF — it may be damaged. Try exporting it to PDF again.");
  }
  try {
    if (pdf.numPages > GUIDE_MAX_PAGES) throw new PdfReadError(`This PDF has ${pdf.numPages} pages — the limit is ${GUIDE_MAX_PAGES}. Split it into separate topics.`);
    let lines: Line[] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const items = await readPage(page);
      lines.push(...extractTables(pageLines(items, n), items));
      page.cleanup();
    }
    lines = dropFurniture(lines, pdf.numPages);
    const blocks = toBlocks(lines);
    if (!blocks.length) {
      throw new PdfReadError("This PDF has no text we can read — it's probably scanned pages (pictures of text). Upload a PDF with selectable text, e.g. exported from Word or Google Docs.");
    }
    const count = contentChars(blocks);
    if (count > GUIDE_MAX_CHARS) {
      throw new PdfReadError(`This PDF has more text than one guide page can hold (about ${Math.round(count / 6).toLocaleString("en-IN")} words; the limit is about ${Math.round(GUIDE_MAX_CHARS / 6).toLocaleString("en-IN")}). Split it into separate topics.`);
    }
    return { blocks, pages: pdf.numPages };
  } finally {
    await pdf.destroy();
  }
}
