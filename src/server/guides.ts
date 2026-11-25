import "server-only";
import { cache } from "react";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import type { Pool, ResultSetHeader } from "mysql2/promise";
import { and, asc, desc, eq, like, or, sql } from "drizzle-orm";
import { getDb, type Database } from "@/db";
import { guideFiles, guides, users } from "@/db/schema";
import { subjectSlug, type GuideBlock } from "@/lib/guides";
import { requireStaff } from "@/server/auth";
import { packPdf, unpack } from "@/server/stored-files";

/* ──────────────────────────────────────────────────────────────
   Guides: public reads (cached until an admin change expires them),
   the stored PDFs, and the admin's reads and writes. Callers of the
   write helpers must already have checked the user is staff.
   ────────────────────────────────────────────────────────────── */

export const GUIDES_TAG = "guides";

export interface GuideSummary {
  slug: string;
  subject: string;
  subjectSlug: string;
  title: string;
  summary: string;
  words: number;
  pdfPages: number | null;
  /** ISO timestamps. */
  createdAt: string;
  updatedAt: string;
}

export interface Guide extends GuideSummary {
  content: GuideBlock[];
  /** The original PDF, when it's offered as a download. */
  pdf: { name: string; size: number } | null;
}

const listColumns = {
  slug: guides.slug,
  subject: guides.subject,
  title: guides.title,
  summary: guides.summary,
  words: guides.words,
  pdfPages: guides.pdfPages,
  createdAt: guides.createdAt,
  updatedAt: guides.updatedAt,
};

const toSummary = (r: { slug: string; subject: string; title: string; summary: string; words: number; pdfPages: number | null; createdAt: Date; updatedAt: Date }): GuideSummary => ({
  ...r,
  subjectSlug: subjectSlug(r.subject),
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

/* ── Public ─────────────────────────────────────────────────── */

const loadPublished = unstable_cache(
  async () => (await getDb().select(listColumns).from(guides).where(eq(guides.status, "published")).orderBy(asc(guides.subject), asc(guides.title))).map(toSummary),
  ["guides-list", "v1"],
  { tags: [GUIDES_TAG], revalidate: 3600 },
);

/** Published guides, by subject then title — deduplicated per request. */
export const listGuides = cache((): Promise<GuideSummary[]> => loadPublished());

const loadGuide = unstable_cache(
  async (slug: string): Promise<Guide | null> => {
    const [r] = await getDb()
      .select({ ...listColumns, content: guides.content, pdfName: guides.pdfName, pdfSize: guides.pdfSize, showPdf: guides.showPdf })
      .from(guides)
      .where(and(eq(guides.slug, slug), eq(guides.status, "published")))
      .limit(1);
    if (!r) return null;
    const { content, pdfName, pdfSize, showPdf, ...rest } = r;
    return { ...toSummary(rest), content, pdf: showPdf && pdfName && pdfSize ? { name: pdfName, size: pdfSize } : null };
  },
  ["guide", "v1"],
  { tags: [GUIDES_TAG], revalidate: 3600 },
);

/** One published guide with its content, or null. */
export const getGuide = cache((slug: string) => (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 160 ? loadGuide(slug) : Promise.resolve(null)));

/** Call after any change to guides. */
export function expireGuides() {
  revalidateTag(GUIDES_TAG, { expire: 0 });
  revalidatePath("/guides", "layout");
}

/* ── The stored PDF ─────────────────────────────────────────── */

/** 512 KB pieces: each insert stays well under MySQL's default 1 MB max_allowed_packet. */
const PIECE = 512 * 1024;

const pool = () => (getDb() as Database & { $client: Pool }).$client;

/**
 * Replaces a guide's stored PDF — deflated first when that saves space (most PDFs are compressed inside already).
 * Uses mysql2's binary protocol so the bytes aren't hex-doubled (see insertMedia).
 */
export async function writeGuidePdf(guideId: number, pdf: Buffer) {
  const { data, encoding } = packPdf(pdf);
  const conn = await pool().getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute("DELETE FROM `guide_files` WHERE `guide_id` = ?", [guideId]);
    for (let seq = 0, at = 0; at < data.length; seq++, at += PIECE) {
      await conn.execute<ResultSetHeader>("INSERT INTO `guide_files` (`guide_id`, `seq`, `data`) VALUES (?, ?, ?)", [guideId, seq, data.subarray(at, at + PIECE)]);
    }
    await conn.execute("UPDATE `guides` SET `pdf_encoding` = ? WHERE `id` = ?", [encoding, guideId]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function readPdfBytes(guideId: number, encoding: string | null) {
  const pieces = await getDb().select({ data: guideFiles.data }).from(guideFiles).where(eq(guideFiles.guideId, guideId)).orderBy(asc(guideFiles.seq));
  return pieces.length ? unpack(Buffer.concat(pieces.map((p) => p.data)), encoding) : null;
}

/** A published guide's PDF, when the page offers it. */
export async function publicGuidePdf(slug: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  const [g] = await getDb()
    .select({ id: guides.id, pdfName: guides.pdfName, pdfEncoding: guides.pdfEncoding, showPdf: guides.showPdf, updatedAt: guides.updatedAt })
    .from(guides)
    .where(and(eq(guides.slug, slug), eq(guides.status, "published")))
    .limit(1);
  if (!g || !g.showPdf || !g.pdfName) return null;
  const data = await readPdfBytes(g.id, g.pdfEncoding);
  return data ? { name: g.pdfName, data, updatedAt: g.updatedAt } : null;
}

/** Any guide's PDF, for staff (drafts included). */
export async function adminGuidePdf(id: number) {
  await requireStaff();
  const [g] = await getDb().select({ pdfName: guides.pdfName, pdfEncoding: guides.pdfEncoding }).from(guides).where(eq(guides.id, id)).limit(1);
  if (!g?.pdfName) return null;
  const data = await readPdfBytes(id, g.pdfEncoding);
  return data ? { name: g.pdfName, data } : null;
}

/* ── Admin ──────────────────────────────────────────────────── */

const term = (q: string) => `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;

export async function listGuidesAdmin(q?: string) {
  await requireStaff();
  const query = q?.trim();
  return getDb()
    .select({
      id: guides.id,
      slug: guides.slug,
      subject: guides.subject,
      title: guides.title,
      status: guides.status,
      words: guides.words,
      pdfName: guides.pdfName,
      pdfPages: guides.pdfPages,
      updatedAt: guides.updatedAt,
      author: users.name,
    })
    .from(guides)
    .leftJoin(users, eq(users.id, guides.createdBy))
    .where(query ? or(like(guides.title, term(query)), like(guides.subject, term(query)), like(guides.slug, term(query))) : undefined)
    .orderBy(desc(guides.updatedAt), desc(guides.id));
}

export async function guideForAdmin(id: number) {
  await requireStaff();
  const [g] = await getDb()
    .select({
      id: guides.id,
      slug: guides.slug,
      subject: guides.subject,
      title: guides.title,
      summary: guides.summary,
      content: guides.content,
      words: guides.words,
      pdfName: guides.pdfName,
      pdfSize: guides.pdfSize,
      pdfPages: guides.pdfPages,
      showPdf: guides.showPdf,
      status: guides.status,
      createdAt: guides.createdAt,
      updatedAt: guides.updatedAt,
      author: users.name,
    })
    .from(guides)
    .leftJoin(users, eq(users.id, guides.createdBy))
    .where(eq(guides.id, id))
    .limit(1);
  return g ?? null;
}

/** Subjects already in use (for the subject suggestions), most used first. */
export async function guideSubjects() {
  await requireStaff();
  const rows = await getDb()
    .select({ subject: guides.subject, n: sql<number>`COUNT(*)`.mapWith(Number) })
    .from(guides)
    .groupBy(guides.subject)
    .orderBy(desc(sql`COUNT(*)`), asc(guides.subject));
  return rows.map((r) => r.subject);
}

/** `base`, or `base-2`, `base-3`… — the first slug no other guide uses. */
export async function freeGuideSlug(base: string, exceptId?: number) {
  const root = (base || "guide").slice(0, 150);
  const taken = new Set(
    (await getDb().select({ slug: guides.slug, id: guides.id }).from(guides).where(or(eq(guides.slug, root), like(guides.slug, `${term(root).slice(0, -1)}-%`))))
      .filter((r) => r.id !== exceptId)
      .map((r) => r.slug),
  );
  if (!taken.has(root)) return root;
  for (let n = 2; ; n++) if (!taken.has(`${root}-${n}`)) return `${root}-${n}`;
}
