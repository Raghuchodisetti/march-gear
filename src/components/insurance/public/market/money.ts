import { formatINR } from "@/lib/format";

/* Money and file-size formatting for the marketplace pages. Client-safe. */

/** ₹12,345 */
export const inr = (n: number) => formatINR(n);

/** File size like "420 KB". */
export const fileSize = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
