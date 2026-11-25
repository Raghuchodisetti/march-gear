import type { ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";
import type { GuideBlock } from "@/lib/guides";
import { cn } from "@/lib/utils";

/* A guide's blocks as page content. Presentation only — the blocks themselves stay plain:
   - a run of three or more short sub-sections (a "###" title and a few paragraphs or a list each, like the tip
     cards in a PDF) becomes a grid of numbered cards;
   - "Disclaimer:" / "Note:" / "Important:" paragraphs become callouts, "Source: 1, 3" lines small print;
   - web addresses become links; a table row with only its first cell filled is a group heading. */

type Heading = Extract<GuideBlock, { type: "h2" | "h3" }>;
type Card = { title: string; id: string | null; number: string | null; blocks: GuideBlock[] };
type Segment = { kind: "block"; block: GuideBlock; id: string | null } | { kind: "cards"; cards: Card[] };

const CALLOUT = /^(disclaimer|note|important|warning|caution|tip)\s*:\s*/i;
const SOURCE_NOTE = /^(sources?|src|ref(?:erences?)?)\s*[:.]\s*\S/i;
const NUMBERED_TITLE = /^(\d{1,2})[.)]\s+/;
const URL = /((?:https?:\/\/|www\.)[^\s<>()]+[^\s<>().,;:!?'"]|\b(?:[a-z0-9-]+\.)+(?:com|in|org|net|gov|edu|io|co|info|uk|eu|jp|de|au|sg)(?:\/[^\s<>()]*[^\s<>().,;:!?'"])?)/gi;

const words = (b: GuideBlock) => ("items" in b ? b.items.join(" ") : "rows" in b ? b.rows.flat().join(" ") : b.text).split(/\s+/).length;

/** Splits text around web addresses and links them (opened in a new tab, not endorsed). */
function linkify(text: string): ReactNode {
  const parts = text.split(URL);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={/^https?:\/\//i.test(part) ? part : `https://${part}`} target="_blank" rel="nofollow noopener noreferrer" className="break-all text-ink underline decoration-ink/25 underline-offset-[3px] hover:text-red hover:decoration-red">
        {part}
      </a>
    ) : (
      part
    ),
  );
}

/** Groups runs of short "###" sub-sections into card grids; everything else stays a single block. */
function segment(blocks: GuideBlock[], ids: (string | null)[]): Segment[] {
  const out: Segment[] = [];
  let i = 0;
  while (i < blocks.length) {
    const cards: Card[] = [];
    let j = i;
    while (j < blocks.length && blocks[j].type === "h3") {
      const h = blocks[j] as Heading;
      let k = j + 1;
      // A card is its title and the paragraphs/lists under it — up to a callout ("Disclaimer: …"), which stands apart.
      while (k < blocks.length && (blocks[k].type === "ul" || blocks[k].type === "ol" || (blocks[k].type === "p" && !CALLOUT.test((blocks[k] as { text: string }).text)))) k++;
      const body = blocks.slice(j + 1, k);
      if (!body.length || body.reduce((n, b) => n + words(b), 0) > 170) break;
      const m = NUMBERED_TITLE.exec(h.text);
      cards.push({ title: m ? h.text.slice(m[0].length) : h.text, id: ids[j], number: m ? m[1] : null, blocks: body });
      j = k;
    }
    if (cards.length >= 3) {
      out.push({ kind: "cards", cards });
      i = j;
    } else {
      out.push({ kind: "block", block: blocks[i], id: ids[i] });
      i++;
    }
  }
  return out;
}

function Paragraph({ text, small, meta }: { text: string; small?: boolean; meta?: boolean }) {
  const callout = CALLOUT.exec(text);
  if (callout) {
    const warn = /^(warning|caution|important)/i.test(callout[1]);
    return (
      <aside className={cn("my-7 flex gap-3 rounded-[4px] border-l-[3px] p-5 text-[14.5px] leading-relaxed", warn ? "border-red bg-red-50 text-ink" : "border-ink bg-mist text-ink/85")}>
        {warn ? <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-red" /> : <Info aria-hidden className="mt-0.5 size-4 shrink-0" />}
        <p>
          <strong className="font-semibold text-ink">{callout[1][0].toUpperCase() + callout[1].slice(1).toLowerCase()}:</strong> {linkify(text.slice(callout[0].length))}
        </p>
      </aside>
    );
  }
  if (SOURCE_NOTE.test(text)) return <p className="mb-5 text-[12.5px] leading-relaxed text-muted last:mb-0">{linkify(text)}</p>;
  // A cover line ("For owners · From the manuals · October 2026") opening the guide: small print.
  if (meta) return <p className="mb-6 text-[13px] font-medium uppercase leading-relaxed tracking-[0.08em] text-muted">{text}</p>;
  return <p className={cn("mb-5 text-pretty", small && "mb-3 last:mb-0")}>{linkify(text)}</p>;
}

function List({ block, compact }: { block: Extract<GuideBlock, { type: "ul" | "ol" }>; compact?: boolean }) {
  if (block.type === "ul")
    return (
      <ul className={cn("space-y-2.5 pl-1", compact ? "mb-3 last:mb-0" : "mb-6")}>
        {block.items.map((item, j) => (
          <li key={j} className="relative pl-6 text-pretty">
            <span aria-hidden className="absolute left-0.5 top-[0.72em] size-1.5 rounded-full bg-red" />
            {linkify(item)}
          </li>
        ))}
      </ul>
    );
  return (
    <ol className={cn("space-y-2.5", compact ? "mb-3 last:mb-0" : "mb-6")}>
      {block.items.map((item, j) => (
        <li key={j} className="flex gap-3.5 text-pretty">
          <span aria-hidden className="mt-[0.2em] inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-mist text-[12px] font-semibold text-ink num">
            {j + 1}
          </span>
          <span className="min-w-0">{linkify(item)}</span>
        </li>
      ))}
    </ol>
  );
}

/** A cell's " · "-separated parts (a value and its unit line, or alternatives) one per line. */
function CellText({ text }: { text: string }) {
  const parts = text.split(" · ");
  // Short values ("34 psi", "2.34 bar", "215/60 R16") never break.
  if (parts.length === 1) return text.length <= 16 ? <span className="whitespace-nowrap">{text}</span> : <>{linkify(text)}</>;
  return (
    <>
      {parts.map((p, i) => (
        <span key={i} className={cn("block", i > 0 && "mt-0.5", p.length <= 16 && "whitespace-nowrap")}>
          {linkify(p)}
        </span>
      ))}
    </>
  );
}

function Table({ rows }: { rows: string[][] }) {
  const cols = Math.max(...rows.map((r) => r.length));
  const [head, ...body] = rows;
  const pad = (r: string[]) => [...r, ...Array<string>(cols - r.length).fill("")];
  const isGroup = (r: string[]) => cols >= 3 && Boolean(r[0]) && r.slice(1).every((c) => !c);
  return (
    // Wide tables keep readable columns and scroll sideways on phones.
    <div className="my-8 overflow-x-auto rounded-[4px] border border-line">
      <table className="w-full border-collapse text-left text-[14px] leading-snug" style={{ minWidth: Math.max(480, cols * 118) }}>
        <thead className="bg-ink text-white">
          <tr>
            {pad(head).map((c, j) => (
              <th key={j} scope="col" className="px-4 py-3 text-[12.5px] font-semibold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((r, j) =>
            isGroup(r) ? (
              <tr key={j} className="border-t border-line bg-red-50/70">
                <th colSpan={cols} scope="rowgroup" className="px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-red-600">
                  {r[0]}
                </th>
              </tr>
            ) : (
              <tr key={j} className="border-t border-line even:bg-mist/40">
                {pad(r).map((c, k) =>
                  k === 0 ? (
                    <th key={k} scope="row" className="px-4 py-3 align-top font-semibold text-ink">
                      {c}
                    </th>
                  ) : (
                    <td key={k} className="px-4 py-3 align-top num">
                      <CellText text={c} />
                    </td>
                  ),
                )}
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

function Block({ block, id, first }: { block: GuideBlock; id: string | null; first?: boolean }) {
  switch (block.type) {
    case "h2":
      return (
        <h2 id={id ?? undefined} className="type-h3 mb-5 mt-14 scroll-mt-36 text-ink first:mt-0">
          {block.text}
        </h2>
      );
    case "h3":
      return (
        <h3 id={id ?? undefined} className="mb-3 mt-9 scroll-mt-36 text-[18px] font-semibold leading-snug tracking-[-0.01em] text-ink first:mt-0">
          {block.text}
        </h3>
      );
    case "p":
      return <Paragraph text={block.text} meta={first && block.text.length <= 180 && (block.text.match(/ · /g)?.length ?? 0) >= 2} />;
    case "ul":
    case "ol":
      return <List block={block} />;
    case "table":
      return <Table rows={block.rows} />;
  }
}

function Cards({ cards }: { cards: Card[] }) {
  return (
    <ol className="my-8 grid grid-cols-1 gap-4 md:grid-cols-2">
      {cards.map((c, i) => (
        <li key={i} className="relative flex flex-col rounded-[4px] border border-line bg-white p-6 transition-colors hover:border-ink/25">
          <span aria-hidden className="absolute right-5 top-4 font-display text-[30px] font-bold leading-none tracking-[-0.03em] text-ink/[0.08] num">
            {(c.number ?? String(i + 1)).padStart(2, "0")}
          </span>
          <span aria-hidden className="mb-4 h-[3px] w-8 bg-red" />
          <h3 id={c.id ?? undefined} className="scroll-mt-36 pr-12 text-[17px] font-semibold leading-snug tracking-[-0.01em] text-ink">
            {c.title}
          </h3>
          <div className="mt-3 text-[15px] leading-[1.7] text-ink/80">
            {c.blocks.map((b, k) => ("items" in b ? <List key={k} block={b as Extract<GuideBlock, { type: "ul" | "ol" }>} compact /> : <Paragraph key={k} text={(b as { text: string }).text} small />))}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function GuideContent({ blocks, ids }: { blocks: GuideBlock[]; ids: (string | null)[] }) {
  return (
    <div className="text-[16.5px] leading-[1.75] text-ink/85">
      {segment(blocks, ids).map((s, i) => (s.kind === "cards" ? <Cards key={i} cards={s.cards} /> : <Block key={i} block={s.block} id={s.id} first={i === 0} />))}
    </div>
  );
}
