/* Media library types and limits, shared by the upload/serve routes, Server Actions and the admin UI.
   Deliberately free of "use client" and server-only imports so both sides can use it. */

/**
 * Largest file we store. The MySQL server's max_allowed_packet is 1 MB and the whole
 * INSERT (blob + other columns) must fit in one packet, so this leaves ~120 KB of headroom.
 */
export const MEDIA_MAX_BYTES = 900 * 1024;
/** The browser downscales photos so their longest side is at most this before uploading. */
export const MEDIA_RESIZE_TO = 2000;
/** Hard server-side cap on either side, whatever the client did (guards against "pixel bombs"). */
export const MEDIA_MAX_SIDE = 8000;
/** Files accepted per upload request. */
export const MEDIA_MAX_FILES = 10;
export const MEDIA_ALT_MAX = 300;
export const MEDIA_PAGE_SIZE = 40;
export const MEDIA_UPLOAD_URL = "/admin/media/upload";

/** Raster formats we accept (verified by magic bytes on the server). No SVG: it can carry script. */
export const MEDIA_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
} as const;
export type MediaMime = keyof typeof MEDIA_TYPES;
export const MEDIA_ACCEPT = Object.keys(MEDIA_TYPES).join(",");
export const MEDIA_FORMATS_LABEL = "JPEG, PNG, WebP, GIF or AVIF";

export interface MediaItem {
  id: number;
  url: string;
  filename: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  /** ISO timestamp. */
  createdAt: string;
  uploader: string | null;
}

export interface MediaPage {
  items: MediaItem[];
  /** Pass as `before` to get the next page; null when there are no more. */
  nextCursor: number | null;
  total: number;
}

/** A record whose image fields point at a media item. */
export interface MediaUsage {
  kind: string;
  label: string;
  href: string;
}

/** JSON returned by POST /admin/media/upload. `id`/`url` mirror the first stored item. */
export interface UploadResponse {
  items: MediaItem[];
  errors: { name: string; error: string }[];
  id?: number;
  url?: string;
  error?: string;
}

export const mediaUrl = (id: number, filename: string) => `/media/${id}/${filename}`;

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
