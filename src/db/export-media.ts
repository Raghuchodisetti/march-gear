/**
 * Copies the public images out of the database into a folder you can upload as static files (e.g. to
 * https://cloud.marchgear.in), so the database stays small:
 *
 *   <folder>/media/<id>/<filename>        the image
 *   <folder>/media/<id>/960/<filename>    its 960 px card copy (a copy of the image when it has none)
 *   <folder>/.htaccess                    long cache headers, no directory listings (Apache / LiteSpeed)
 *
 *   npm run media:export                          write the files (the database is unchanged)
 *   npm run media:export -- --offload             …then empty those images from the database (storage = "cloud")
 *   npm run media:export -- --dir path/to/folder  another folder (default: MEDIA_CLOUD_DIR, else ./media-export)
 *
 * After --offload the site serves those images from the folder: set MEDIA_CLOUD_URL to its public address
 * (and/or MEDIA_CLOUD_DIR to it on this server's disk) — see src/server/media-store.ts. Every file is written and
 * read back before its image is emptied from the database. Safe to run again: only images still in the database
 * are exported. Private files (dealer/vendor documents, guide PDFs) stay in the database.
 */
import { readFile, stat, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { Pool, RowDataPacket } from "mysql2/promise";
import sharp from "sharp";
import { closeDb, getDb, type Database } from "./index";

const args = process.argv.slice(2);
const OFFLOAD = args.includes("--offload");
const dirArg = args.includes("--dir") ? args[args.indexOf("--dir") + 1] : undefined;
const DIR = path.resolve(dirArg ?? process.env.MEDIA_CLOUD_DIR ?? "media-export");
const pool = () => (getDb() as Database & { $client: Pool }).$client;
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

const HTACCESS = `# MarchGear images — each file's address never changes, so browsers may keep it for a year.
Options -Indexes
<IfModule mod_mime.c>
  AddType image/webp .webp
  AddType image/avif .avif
</IfModule>
<IfModule mod_headers.c>
  Header set Cache-Control "public, max-age=31536000, immutable"
  Header set X-Content-Type-Options "nosniff"
  Header set Access-Control-Allow-Origin "*"
</IfModule>
`;

/** The image format from the first bytes. */
const kind = (b: Buffer) =>
  b[0] === 0xff && b[1] === 0xd8 ? "jpeg" : b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP" ? "webp" : b[0] === 0x89 && b.toString("latin1", 1, 4) === "PNG" ? "png" : "other";

/**
 * Static hosts label files by extension, so the card copy (saved under the image's own name) must be in the image's
 * format — e.g. older JPEG uploads have WebP card copies: re-encode those (or use the image itself).
 */
async function matchingCard(image: Buffer, card: Buffer): Promise<Buffer> {
  const want = kind(image);
  if (kind(card) === want) return card;
  if (want === "jpeg") return sharp(card).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  if (want === "webp") return sharp(card).webp({ quality: 80 }).toBuffer();
  if (want === "png") return sharp(card).png({ compressionLevel: 9 }).toBuffer();
  return image;
}

async function sameFile(file: string, bytes: Buffer) {
  try {
    const st = await stat(file);
    return st.size === bytes.length && (await readFile(file)).equals(bytes);
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(path.join(DIR, "media"), { recursive: true });
  await writeFile(path.join(DIR, ".htaccess"), HTACCESS);
  const [rows] = await pool().query<RowDataPacket[]>("SELECT `id`, `filename` FROM `media` WHERE `storage` = 'db' ORDER BY `id`");
  console.log(`${rows.length} image(s) in the database → ${DIR}${OFFLOAD ? " (and emptied from the database)" : ""}\n`);

  let files = 0;
  let bytes = 0;
  let offloaded = 0;
  for (const r of rows as { id: number; filename: string }[]) {
    // Two reads keep each result under MySQL's packet limit (an image and its card copy can pass 1 MB together).
    const [[a]] = await pool().query<RowDataPacket[]>("SELECT `data` FROM `media` WHERE `id` = ?", [r.id]);
    const [[b]] = await pool().query<RowDataPacket[]>("SELECT `thumb` FROM `media` WHERE `id` = ?", [r.id]);
    const data = a?.data as Buffer | null;
    if (!data?.length) {
      console.log(`  ! ${r.id}/${r.filename}: no image data — skipped`);
      continue;
    }
    const card = await matchingCard(data, (b?.thumb as Buffer | null) ?? data);
    const name = path.basename(r.filename);
    const base = path.join(DIR, "media", String(r.id));
    await mkdir(path.join(base, "960"), { recursive: true });
    await writeFile(path.join(base, name), data);
    await writeFile(path.join(base, "960", name), card);
    // Read back before anything is removed from the database.
    if (!(await sameFile(path.join(base, name), data)) || !(await sameFile(path.join(base, "960", name), card))) {
      console.log(`  ! ${r.id}/${r.filename}: the written files don't match — left in the database`);
      continue;
    }
    files += 2;
    bytes += data.length + card.length;
    if (OFFLOAD) {
      await pool().execute("UPDATE `media` SET `data` = NULL, `thumb` = NULL, `storage` = 'cloud' WHERE `id` = ? AND `storage` = 'db'", [r.id]);
      offloaded++;
    }
  }

  const [[left]] = await pool().query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM `media` WHERE `storage` = 'db'");
  const [[cloud]] = await pool().query<RowDataPacket[]>("SELECT COUNT(*) AS n FROM `media` WHERE `storage` = 'cloud'");
  console.log(`Wrote ${files} file(s), ${mb(bytes)}, to ${path.join(DIR, "media")}`);
  if (OFFLOAD) console.log(`Emptied ${offloaded} image(s) from the database.`);
  console.log(`Images now in the database: ${left.n} · in the cloud folder: ${cloud.n}`);
  console.log(`\nUpload the contents of ${DIR} (the "media" folder and .htaccess) to the cloud site's root, so that`);
  console.log(`  <MEDIA_CLOUD_URL>/media/<id>/<filename> is each image. Then set MEDIA_CLOUD_URL on the server.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
