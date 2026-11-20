import "server-only";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getDb, type Database } from "@/db";
import type { PartnerDocKind } from "@/db/enums";
import type { FileRef } from "@/partner/types";
import { sniffImage } from "@/server/admin/media";

/* ──────────────────────────────────────────────────────────────
   Dealer uploads.
   - Private files (KYC documents, certificates, cheques, inspection
     reports, ticket attachments) → partner_files, served only to the
     dealership's members and MarchGear staff via /dealer/files/<id>.
   - Public images (showroom/vehicle photos, logos, offer banners) →
     the shared `media` table with partner_id, served from /media.
   Both are written with a prepared statement: Drizzle sends Buffers
   as hex text, which would double their size past MySQL's 1 MB packet.
   ────────────────────────────────────────────────────────────── */

export const PARTNER_FILE_MAX = 900 * 1024;

export type DocMime = "application/pdf" | "image/jpeg" | "image/png" | "image/webp";

/** The real type of an uploaded document, from its first bytes. PDFs and common images only. */
export function sniffDocument(buf: Buffer): DocMime | null {
  if (buf.length < 12) return null;
  if (buf.toString("latin1", 0, 5) === "%PDF-") return "application/pdf";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.readUInt32BE(0) === 0x89504e47) return "image/png";
  if (buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") return "image/webp";
  return null;
}

const EXT: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" };

/** A filename that is safe in URLs and Content-Disposition, with the right extension. */
export function safeFilename(name: string, mime: string) {
  const base =
    name
      .replace(/\.[^.]*$/, "")
      .normalize("NFKD")
      .replace(/[^\w-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "file";
  return `${base}.${EXT[mime] ?? "bin"}`;
}

const pool = () => (getDb() as Database & { $client: Pool }).$client;

export async function savePartnerFile(f: { partnerId: number; kind: PartnerDocKind; filename: string; mime: DocMime; data: Buffer; uploadedBy: number }): Promise<FileRef> {
  const filename = safeFilename(f.filename, f.mime);
  const [res] = await pool().execute<ResultSetHeader>(
    "INSERT INTO `partner_files` (`partner_id`, `kind`, `filename`, `mime`, `size`, `data`, `uploaded_by`) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [f.partnerId, f.kind, filename, f.mime, f.data.length, f.data, f.uploadedBy],
  );
  return { id: res.insertId, filename, mime: f.mime, size: f.data.length };
}

export async function readPartnerFile(id: number) {
  const [rows] = await pool().execute<RowDataPacket[]>("SELECT `partner_id`, `filename`, `mime`, `size`, `data`, `created_at` FROM `partner_files` WHERE `id` = ?", [id]);
  const r = rows[0];
  if (!r) return null;
  return { partnerId: r.partner_id as number, filename: r.filename as string, mime: r.mime as string, size: r.size as number, data: r.data as Buffer, createdAt: r.created_at as Date };
}

/** Saves a public image for a dealer (already downscaled in the browser). Returns its /media URL. */
export async function savePartnerMedia(f: { partnerId: number; userId: number; filename: string; data: Buffer; alt?: string | null }) {
  const img = sniffImage(f.data);
  if (!img) return null;
  const filename = safeFilename(f.filename, img.mime);
  const [res] = await pool().execute<ResultSetHeader>(
    "INSERT INTO `media` (`filename`, `mime`, `size`, `width`, `height`, `alt`, `data`, `created_by`, `partner_id`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [filename, img.mime, f.data.length, img.width, img.height, f.alt ?? null, f.data, f.userId, f.partnerId],
  );
  return { id: res.insertId, url: `/media/${res.insertId}/${filename}`, width: img.width, height: img.height, mime: img.mime, size: f.data.length };
}
