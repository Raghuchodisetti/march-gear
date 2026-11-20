import "server-only";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getDb, type Database } from "@/db";
import type { InsDocKind } from "@/db/enums";
import type { FileRef } from "@/insurance/types";
import { sniffImage } from "@/server/admin/media";
import { safeFilename, type DocMime } from "@/server/partner/files";

/* ──────────────────────────────────────────────────────────────
   Insurance vendor uploads.
   - Private files (KYC, licences, cheques, brochures, wordings,
     ticket attachments) → ins_files, served only to the vendor's
     members and MarchGear staff via /insurance-vendor/files/<id>.
     Brochures and policy wordings of a published product are also
     served publicly by /insurance/products/<ref>/documents/<kind>.
   - Public images (logos, campaign banners, ad creatives) → the
     shared `media` table with ins_vendor_id, served from /media.
   Written with prepared statements (see src/server/partner/files.ts).
   ────────────────────────────────────────────────────────────── */

export { sniffDocument, safeFilename, PARTNER_FILE_MAX as INS_FILE_MAX } from "@/server/partner/files";

const pool = () => (getDb() as Database & { $client: Pool }).$client;

export async function saveInsurerFile(f: { vendorId: number; kind: InsDocKind; filename: string; mime: DocMime; data: Buffer; uploadedBy: number }): Promise<FileRef> {
  const filename = safeFilename(f.filename, f.mime);
  const [res] = await pool().execute<ResultSetHeader>(
    "INSERT INTO `ins_files` (`vendor_id`, `kind`, `filename`, `mime`, `size`, `data`, `uploaded_by`) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [f.vendorId, f.kind, filename, f.mime, f.data.length, f.data, f.uploadedBy],
  );
  return { id: res.insertId, filename, mime: f.mime, size: f.data.length };
}

export async function readInsurerFile(id: number) {
  const [rows] = await pool().execute<RowDataPacket[]>("SELECT `vendor_id`, `kind`, `filename`, `mime`, `size`, `data`, `created_at` FROM `ins_files` WHERE `id` = ?", [id]);
  const r = rows[0];
  if (!r) return null;
  return {
    vendorId: r.vendor_id as number,
    kind: r.kind as string,
    filename: r.filename as string,
    mime: r.mime as string,
    size: r.size as number,
    data: r.data as Buffer,
    createdAt: r.created_at as Date,
  };
}

/** Saves a public image for a vendor (already downscaled in the browser). Returns its /media URL. */
export async function saveInsurerMedia(f: { vendorId: number; userId: number; filename: string; data: Buffer; alt?: string | null }) {
  const img = sniffImage(f.data);
  if (!img) return null;
  const filename = safeFilename(f.filename, img.mime);
  const [res] = await pool().execute<ResultSetHeader>(
    "INSERT INTO `media` (`filename`, `mime`, `size`, `width`, `height`, `alt`, `data`, `created_by`, `ins_vendor_id`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [filename, img.mime, f.data.length, img.width, img.height, f.alt ?? null, f.data, f.userId, f.vendorId],
  );
  return { id: res.insertId, url: `/media/${res.insertId}/${filename}`, width: img.width, height: img.height, mime: img.mime, size: f.data.length };
}

/** Response headers for serving a private file (images locked down; PDFs in the browser's own viewer). */
export function privateFileHeaders(file: { mime: string; size: number; filename: string }, download: boolean, cache = "private, no-store") {
  return {
    "Content-Type": file.mime,
    "Content-Length": String(file.size),
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${file.filename}"`,
    "Cache-Control": cache,
    "X-Content-Type-Options": "nosniff",
    ...(file.mime === "application/pdf" ? {} : { "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" }),
    "X-Frame-Options": "SAMEORIGIN",
  };
}
