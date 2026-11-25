import "server-only";
import { deflateSync, inflateSync } from "node:zlib";

/* Files kept in the database are stored compressed when that pays off. Images are already compressed when they're
   uploaded (WebP, resized — see prepareImage); most PDFs are compressed inside too, but some (from simple PDF
   generators) aren't — those are deflated before storing, and inflated again when they're served. */

export type StoredEncoding = "deflate" | null;

/** Deflates a PDF when that saves at least 10%; otherwise keeps it as is. */
export function packPdf(data: Buffer): { data: Buffer; encoding: StoredEncoding } {
  const packed = deflateSync(data, { level: 9 });
  return packed.length <= data.length * 0.9 ? { data: packed, encoding: "deflate" } : { data, encoding: null };
}

/** The original bytes of a stored file. */
export function unpack(data: Buffer, encoding: string | null | undefined): Buffer {
  return encoding === "deflate" ? inflateSync(data) : data;
}
