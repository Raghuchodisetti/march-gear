import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/* ──────────────────────────────────────────────────────────────
   Where public images live. Each media row is either:
   - "db"    — the image (and its card copy) in the row itself, or
   - "cloud" — files in the cloud folder, served as plain static files
               (e.g. https://cloud.marchgear.in):
                 media/<id>/<filename>       the image
                 media/<id>/960/<filename>   its 960 px card copy (a copy of the
                                             image when it has none, so it always exists)
   Settings (.env):
   - MEDIA_CLOUD_URL  the folder's public address (https://cloud.marchgear.in);
                      /media/<id>/<name> then redirects there.
   - MEDIA_CLOUD_DIR  the same folder on this server's disk, if it's reachable
                      (optional): new uploads are written there instead of the
                      database, and without MEDIA_CLOUD_URL the /media route reads
                      it directly (local development).
   `npm run media:export` copies images out of the database into the folder (and,
   with --offload, empties them from the database).

   Private files (dealer/vendor documents, guide PDFs) always stay in the database.
   ────────────────────────────────────────────────────────────── */

export const MEDIA_CLOUD_URL = (process.env.MEDIA_CLOUD_URL ?? "").trim().replace(/\/+$/, "");
export const MEDIA_CLOUD_DIR = process.env.MEDIA_CLOUD_DIR?.trim() ? path.resolve(process.env.MEDIA_CLOUD_DIR.trim()) : "";

/** Path of an image (or its card copy) inside the cloud folder. Filenames are already URL-safe (safeFilename). */
export const cloudPath = (id: number, filename: string, card = false) => `media/${id}/${card ? "960/" : ""}${path.basename(filename)}`;

/** The image's public address in the cloud, or null when MEDIA_CLOUD_URL isn't set. */
export const cloudUrl = (id: number, filename: string, card = false) => (MEDIA_CLOUD_URL ? `${MEDIA_CLOUD_URL}/${cloudPath(id, filename, card)}` : null);

const onDisk = (id: number, filename: string, card = false) => path.join(MEDIA_CLOUD_DIR, ...cloudPath(id, filename, card).split("/"));

/** Writes an image and its card copy (the image itself when there's no smaller copy) into the cloud folder. */
export async function writeCloudFiles(dir: string, id: number, filename: string, data: Buffer, thumb: Buffer | null) {
  const base = path.join(dir, "media", String(id));
  await mkdir(path.join(base, "960"), { recursive: true });
  await writeFile(path.join(base, path.basename(filename)), data);
  await writeFile(path.join(base, "960", path.basename(filename)), thumb ?? data);
}

/** Whether new uploads go to the cloud folder (MEDIA_CLOUD_DIR set) rather than the database. */
export const uploadsToCloud = () => Boolean(MEDIA_CLOUD_DIR);

/** Deletes an image's files from the cloud folder, when it's on this server's disk. */
export async function removeCloudFiles(id: number) {
  if (MEDIA_CLOUD_DIR) await rm(path.join(MEDIA_CLOUD_DIR, "media", String(id)), { recursive: true, force: true });
}

/** A cloud image's bytes from this server's disk (MEDIA_CLOUD_DIR), or null. */
export async function readCloudFile(id: number, filename: string, card = false): Promise<Buffer | null> {
  if (!MEDIA_CLOUD_DIR) return null;
  try {
    return await readFile(onDisk(id, filename, card));
  } catch {
    return null;
  }
}

/** An image's bytes wherever it is — for the server's own use (e.g. share images): the row, the disk, or the cloud URL. */
export async function imageBytes(row: { id: number; filename: string; storage: string; data: Buffer | null }): Promise<Buffer | null> {
  if (row.storage !== "cloud") return row.data;
  const local = await readCloudFile(row.id, row.filename);
  if (local) return local;
  const url = cloudUrl(row.id, row.filename);
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}
