/* ──────────────────────────────────────────────────────────────
   Guides (/guides): topic pages the admin creates from a PDF.
   The PDF's text is turned into blocks (headings, paragraphs,
   lists, tables) and stored with the guide; the admin can edit
   them as plain text in a markdown-like form:

     ## Section heading          ### Sub-heading
     A paragraph is one line (or several, up to a blank line).
     - bullet item               1. numbered item
     | table | row |

   Shared by the admin (client) and the server, so no server imports.
   ────────────────────────────────────────────────────────────── */

export type GuideBlock =
  | { type: "h2" | "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul" | "ol"; items: string[] }
  | { type: "table"; rows: string[][] };

/** Upload limits. The PDF is stored too (offered as a download), in pieces — see guide_files. */
export const GUIDE_PDF_MAX_BYTES = 15 * 1024 * 1024;
export const GUIDE_MAX_PAGES = 150;
/** Text a single guide page may hold (≈ 60,000 words) — keeps the stored content well under MySQL's packet limit. */
export const GUIDE_MAX_CHARS = 400_000;

export const GUIDE_TITLE_MAX = 200;
export const GUIDE_SUBJECT_MAX = 120;
export const GUIDE_SUMMARY_MAX = 400;

/** File size for people: "640 KB", "2.4 MB", "15 MB". */
export const formatMB = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;

/* ── Text form (admin editor) ───────────────────────────────── */

const BULLET = /^[-*•]\s+/;
const NUMBERED = /^\d{1,3}[.)]\s+/;
const tableCells = (line: string) =>
  line
    .replace(/^\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((c) => c.trim());

/** Blocks → the editable text form. */
export function blocksToText(blocks: GuideBlock[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "h2":
          return `## ${b.text}`;
        case "h3":
          return `### ${b.text}`;
        case "p":
          return b.text;
        case "ul":
          return b.items.map((i) => `- ${i}`).join("\n");
        case "ol":
          return b.items.map((i, n) => `${n + 1}. ${i}`).join("\n");
        case "table":
          return b.rows.map((r) => `| ${r.map((c) => c.replace(/\|/g, "/")).join(" | ")} |`).join("\n");
      }
    })
    .join("\n\n");
}

/** The editable text form → blocks. Lenient: anything that isn't a heading, list or table row is paragraph text. */
export function textToBlocks(text: string): GuideBlock[] {
  const blocks: GuideBlock[] = [];
  let para: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  let table: string[][] | null = null;

  const flush = () => {
    if (para.length) blocks.push({ type: "p", text: para.join(" ") });
    if (list && list.items.length) blocks.push(list);
    if (table && table.length) blocks.push({ type: "table", rows: table });
    para = [];
    list = null;
    table = null;
  };

  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim().replace(/\s+/g, " ");
    if (!line) {
      flush();
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ type: heading[1].length === 3 ? "h3" : "h2", text: heading[2].trim() });
      continue;
    }
    if (line.startsWith("|")) {
      if (!table) flush();
      table ??= [];
      const cells = tableCells(line);
      // Skip markdown separator rows ("| --- | --- |").
      if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) table.push(cells);
      continue;
    }
    const kind = BULLET.test(line) ? "ul" : NUMBERED.test(line) ? "ol" : null;
    if (kind) {
      if (!list || list.type !== kind) flush();
      list ??= { type: kind, items: [] };
      list.items.push(line.replace(kind === "ul" ? BULLET : NUMBERED, ""));
      continue;
    }
    if (list && list.items.length) {
      // A plain line straight after an item (no blank line) continues it.
      list.items[list.items.length - 1] += ` ${line}`;
      continue;
    }
    if (table) flush();
    para.push(line);
  }
  flush();
  return blocks.filter((b) => ("items" in b ? b.items.some(Boolean) : "rows" in b ? b.rows.length > 0 : Boolean(b.text)));
}

/* ── Derived values ─────────────────────────────────────────── */

const blockText = (b: GuideBlock) => ("items" in b ? b.items.join(" ") : "rows" in b ? b.rows.flat().join(" ") : b.text);

export const contentChars = (blocks: GuideBlock[]) => blocks.reduce((n, b) => n + blockText(b).length, 0);

export function countWords(blocks: GuideBlock[]) {
  return blocks.reduce((n, b) => n + (blockText(b).match(/\S+/g)?.length ?? 0), 0);
}

export const readMinutes = (words: number) => Math.max(1, Math.round(words / 200));

/**
 * A summary from the first real paragraph — a sentence or more, not a cover line like "For owners · From the
 * manuals · October 2026" or a "Source: 1, 3" note — cut on a word boundary.
 */
export function summaryFrom(blocks: GuideBlock[], max = 220) {
  const paragraphs = blocks.flatMap((b) => (b.type === "p" ? [b.text] : []));
  const prose = (t: string) => t.length >= 60 && (t.match(/\S+/g)?.length ?? 0) >= 10 && (t.match(/ · /g)?.length ?? 0) <= 1 && !/^source[s]?:/i.test(t);
  const text = paragraphs.find(prose) ?? paragraphs.find((t) => t.length >= 40) ?? paragraphs[0] ?? "";
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 40)).replace(/[\s,;:.–—-]+$/, "")}…`;
}

/** Stable, unique ids for the page's headings (for the contents list and #links). */
export function headingIds(blocks: GuideBlock[]) {
  const used = new Map<string, number>();
  return blocks.map((b) => {
    if (b.type !== "h2" && b.type !== "h3") return null;
    const base =
      b.text
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "section";
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    return n ? `${base}-${n + 1}` : base;
  });
}

export const subjectSlug = (subject: string) =>
  subject
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "general";

export const guideHref = (slug: string) => `/guides/${slug}`;
export const guidePdfHref = (slug: string) => `/guides/${slug}/pdf`;

/** An ISO timestamp → its date in India (YYYY-MM-DD), for formatDate. */
export const istDay = (iso: string) => new Date(Date.parse(iso) + 5.5 * 3_600_000).toISOString().slice(0, 10);
