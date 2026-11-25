/**
 * Compresses files already in the database, the way new uploads are handled:
 * - photos (media) get their 960 px WebP card copy, if they're wider than that and don't have one;
 * - PDFs (guide PDFs, dealer and insurance vendor documents) are stored deflated when that saves 10% or more;
 * - photos of documents over 300 KB are re-encoded as WebP (at most 2000 px).
 * Safe to run again — finished files are skipped.
 *
 *   npm run db:compress-stored            do it
 *   npm run db:compress-stored -- --dry-run   only report
 *
 * Needs `sharp` (installed with Next.js) — run it where that works (e.g. locally), then export the database.
 */
import { deflateSync } from "node:zlib";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import sharp from "sharp";
import { closeDb, getDb, type Database } from "./index";
import { MEDIA_THUMB_MAX_BYTES, MEDIA_THUMB_WIDTH } from "@/components/admin/media-shared";

const DRY = process.argv.includes("--dry-run");
const pool = () => (getDb() as Database & { $client: Pool }).$client;
const kb = (n: number) => `${Math.round(n / 1024)} KB`;

/** Same rule as src/server/stored-files.ts: deflate a PDF only when that saves at least 10%. */
function packPdf(data: Buffer) {
  const packed = deflateSync(data, { level: 9 });
  return packed.length <= data.length * 0.9 ? packed : null;
}

async function cardCopy(data: Buffer): Promise<Buffer | null> {
  for (const quality of [80, 70, 60]) {
    const out = await sharp(data, { failOn: "error" }).rotate().resize({ width: MEDIA_THUMB_WIDTH, withoutEnlargement: true }).webp({ quality }).toBuffer();
    if (out.length <= MEDIA_THUMB_MAX_BYTES) return out;
  }
  return null;
}

async function photos() {
  const [rows] = await pool().query<RowDataPacket[]>(
    "SELECT `id`, `filename`, `width` FROM `media` WHERE `thumb` IS NULL AND `mime` <> 'image/gif' AND `width` > ? ORDER BY `id`",
    [MEDIA_THUMB_WIDTH],
  );
  let made = 0;
  let bytes = 0;
  for (const r of rows) {
    const [[m]] = await pool().query<RowDataPacket[]>("SELECT `data` FROM `media` WHERE `id` = ?", [r.id]);
    const thumb = await cardCopy(m.data as Buffer).catch(() => null);
    if (!thumb) {
      console.log(`  ! media ${r.id} (${r.filename}): couldn't make a card copy`);
      continue;
    }
    made++;
    bytes += (m.data as Buffer).length - thumb.length;
    if (!DRY) await pool().execute<ResultSetHeader>("UPDATE `media` SET `thumb` = ? WHERE `id` = ?", [thumb, r.id]);
  }
  console.log(`Photos: ${rows.length} without a card copy · ${made} ${DRY ? "would get" : "got"} one (cards load ${kb(bytes)} less in all)`);
}

async function documents(table: "partner_files" | "ins_files") {
  const [rows] = await pool().query<RowDataPacket[]>(
    `SELECT \`id\`, \`filename\`, \`mime\`, \`size\` FROM \`${table}\` WHERE \`encoding\` IS NULL AND (\`mime\` = 'application/pdf' OR \`size\` > ?) ORDER BY \`id\``,
    [300 * 1024],
  );
  let saved = 0;
  let changed = 0;
  for (const r of rows) {
    const [[f]] = await pool().query<RowDataPacket[]>(`SELECT \`data\` FROM \`${table}\` WHERE \`id\` = ?`, [r.id]);
    const data = f.data as Buffer;
    if (r.mime === "application/pdf") {
      const packed = packPdf(data);
      if (!packed) continue;
      changed++;
      saved += data.length - packed.length;
      if (!DRY) await pool().execute(`UPDATE \`${table}\` SET \`data\` = ?, \`encoding\` = 'deflate' WHERE \`id\` = ?`, [packed, r.id]);
    } else {
      const out = await sharp(data, { failOn: "error" })
        .rotate()
        .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer()
        .catch(() => null);
      if (!out || out.length >= data.length * 0.9) continue;
      changed++;
      saved += data.length - out.length;
      const filename = `${String(r.filename).replace(/\.[^.]*$/, "") || "document"}.webp`;
      if (!DRY) await pool().execute(`UPDATE \`${table}\` SET \`data\` = ?, \`mime\` = 'image/webp', \`size\` = ?, \`filename\` = ? WHERE \`id\` = ?`, [out, out.length, filename, r.id]);
    }
  }
  console.log(`${table}: ${rows.length} to check · ${changed} ${DRY ? "would be" : ""} compressed (${kb(saved)} saved)`);
}

async function guidePdfs() {
  const [rows] = await pool().query<RowDataPacket[]>("SELECT `id`, `title` FROM `guides` WHERE `pdf_name` IS NOT NULL AND `pdf_encoding` IS NULL ORDER BY `id`");
  let changed = 0;
  let saved = 0;
  for (const g of rows) {
    const [pieces] = await pool().query<RowDataPacket[]>("SELECT `data` FROM `guide_files` WHERE `guide_id` = ? ORDER BY `seq`", [g.id]);
    if (!pieces.length) continue;
    const data = Buffer.concat(pieces.map((p) => p.data as Buffer));
    const packed = packPdf(data);
    if (!packed) continue;
    changed++;
    saved += data.length - packed.length;
    if (DRY) continue;
    // Same 512 KB pieces as writeGuidePdf (each insert stays under MySQL's 1 MB packet limit), in one transaction.
    const conn = await pool().getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute("DELETE FROM `guide_files` WHERE `guide_id` = ?", [g.id]);
      for (let seq = 0, at = 0; at < packed.length; seq++, at += 512 * 1024) {
        await conn.execute("INSERT INTO `guide_files` (`guide_id`, `seq`, `data`) VALUES (?, ?, ?)", [g.id, seq, packed.subarray(at, at + 512 * 1024)]);
      }
      await conn.execute("UPDATE `guides` SET `pdf_encoding` = 'deflate' WHERE `id` = ?", [g.id]);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
  console.log(`Guide PDFs: ${rows.length} to check · ${changed} ${DRY ? "would be" : ""} compressed (${kb(saved)} saved; most PDFs are compressed inside already)`);
}

async function main() {
  if (DRY) console.log("Dry run — nothing is changed.\n");
  await photos();
  await documents("partner_files");
  await documents("ins_files");
  await guidePdfs();
  const [[big]] = await pool().query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM `media` WHERE `size` > 900 * 1024");
  if (big.n) console.log(`\nNote: ${big.n} stored photo(s) are over 900 KB — upload a smaller version in the media library.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
