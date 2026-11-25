"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type DragEvent } from "react";
import { AlertCircle, CheckCircle2, ImageUp, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { listMediaAction } from "@/server/actions/media";
import { Button } from "@/components/ui/button";
import {
  MEDIA_ACCEPT,
  MEDIA_FORMATS_LABEL,
  MEDIA_MAX_BYTES,
  MEDIA_RESIZE_TO,
  MEDIA_TYPES,
  MEDIA_UPLOAD_URL,
  formatBytes,
  type MediaItem,
  type MediaMime,
  type MediaPage,
  type UploadResponse,
} from "./media-shared";

/* ── Preparing files in the browser ─────────────────────────── */

/** Files this size or smaller that don't need resizing are uploaded untouched. */
const KEEP_ORIGINAL_UNDER = 500 * 1024;
const QUALITIES = [0.85, 0.75, 0.65];

export interface PreparedFile {
  blob: Blob;
  filename: string;
  width: number;
  height: number;
  /** Size before resizing/re-encoding, when that happened. */
  originalSize?: number;
}

async function headerType(file: File): Promise<MediaMime | "image/svg+xml" | null> {
  const b = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const s = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && s(1, 4) === "PNG") return "image/png";
  if (s(0, 3) === "GIF") return "image/gif";
  if (s(0, 4) === "RIFF" && s(8, 12) === "WEBP") return "image/webp";
  if (s(4, 8) === "ftyp" && /avi[fs]/.test(s(8, 32))) return "image/avif";
  if (/^\s*(<\?xml|<svg)/i.test(s(0, 32))) return "image/svg+xml";
  return null;
}

const rename = (name: string, ext: string) => `${name.replace(/\.[^.]*$/, "") || "image"}.${ext}`;

function encode(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

type OutputType = "image/webp" | "image/jpeg" | "image/png";
const OUTPUT_EXT: Record<OutputType, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

let webpSupport: Promise<boolean> | undefined;
/** Whether this browser's canvas can write WebP (some, e.g. older Safari, quietly write PNG instead). Checked once. */
function canEncodeWebp() {
  webpSupport ??= new Promise<boolean>((resolve) => {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    c.toBlob((b) => resolve(b?.type === "image/webp"), "image/webp", 0.8);
  });
  return webpSupport;
}

/**
 * Checks a file and makes it fit: JPEG and PNG images are converted to WebP (scaled so the longest
 * side is ≤ 2000 px, falling back to lower quality / smaller sizes until under the limit).
 * Small WebP/AVIF files are already efficient and go up untouched, and so does a converted file's
 * original when the WebP would be bigger. Browsers that can't write WebP keep JPEG/PNG (PNG stays
 * PNG while it fits, so transparency survives). GIFs are kept byte-for-byte so animations survive.
 */
export async function prepareImage(file: File): Promise<PreparedFile> {
  const type = await headerType(file);
  if (type === "image/svg+xml" || /\.svg$/i.test(file.name)) throw new Error("SVG files aren't allowed. Export it as PNG or WebP and upload that.");
  if (!type) {
    const claimed = file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|avif)$/i.test(file.name);
    throw new Error(claimed ? `This file isn't really an image — its contents don't match a ${MEDIA_FORMATS_LABEL} file.` : `Only ${MEDIA_FORMATS_LABEL} images can be uploaded.`);
  }

  if (type === "image/gif") {
    if (file.size > MEDIA_MAX_BYTES) throw new Error(`This GIF is ${formatBytes(file.size)}. GIFs are uploaded unchanged (to keep animation), so they must be under ${formatBytes(MEDIA_MAX_BYTES)}.`);
    const b = new Uint8Array(await file.slice(6, 10).arrayBuffer());
    return { blob: file, filename: rename(file.name, "gif"), width: b[0] | (b[1] << 8), height: b[2] | (b[3] << 8) };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This image couldn't be opened — it may be damaged or in a format your browser can't read.");
  }
  try {
    const { width, height } = bitmap;
    const longest = Math.max(width, height);
    const original = { blob: file, filename: rename(file.name, MEDIA_TYPES[type]), width, height };
    const small = longest <= MEDIA_RESIZE_TO && file.size <= KEEP_ORIGINAL_UNDER;
    const fits = longest <= MEDIA_RESIZE_TO && file.size <= MEDIA_MAX_BYTES;
    if (small && (type === "image/webp" || type === "image/avif")) return original;
    const webp = await canEncodeWebp();
    if (small && !webp) return original;

    // WebP where the browser can write it; otherwise the source's own family (PNG keeps transparency, then JPEG).
    const formats: OutputType[] = webp ? ["image/webp"] : type === "image/png" ? ["image/png", "image/jpeg"] : ["image/jpeg"];
    let scale = Math.min(1, MEDIA_RESIZE_TO / longest);
    for (let attempt = 0; attempt < 5; attempt++) {
      const w = Math.max(1, Math.round(width * scale));
      const h = Math.max(1, Math.round(height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Your browser couldn't resize this image.");
      for (const format of formats) {
        ctx.clearRect(0, 0, w, h);
        if (format === "image/jpeg") {
          ctx.fillStyle = "#fff"; // JPEG has no transparency
          ctx.fillRect(0, 0, w, h);
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(bitmap, 0, 0, w, h);
        // PNG is lossless, so quality doesn't apply: one try per size.
        for (const q of format === "image/png" ? [1] : QUALITIES) {
          const blob = await encode(canvas, format, q);
          if (!blob || blob.type !== format || blob.size > MEDIA_MAX_BYTES) continue;
          // Re-encoding an already compact file can make it bigger; keep the original when that happens and it fits as is.
          if (scale === 1 && fits && blob.size >= file.size) return original;
          return { blob, filename: rename(file.name, OUTPUT_EXT[format]), width: w, height: h, originalSize: file.size };
        }
      }
      scale *= 0.8;
    }
    throw new Error(`Couldn't shrink this image under ${formatBytes(MEDIA_MAX_BYTES)}. Try a smaller or simpler picture.`);
  } finally {
    bitmap.close();
  }
}

/** Sends one prepared file to the upload route, reporting progress from 0 to 1. */
export function uploadPrepared(file: PreparedFile, onProgress: (fraction: number) => void) {
  return new Promise<MediaItem>((resolve, reject) => {
    const form = new FormData();
    form.append("file", file.blob, file.filename);
    form.append("width", String(file.width));
    form.append("height", String(file.height));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", MEDIA_UPLOAD_URL);
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      const body = xhr.response as UploadResponse | null;
      const item = body?.items?.[0];
      if (xhr.status >= 200 && xhr.status < 300 && item) return resolve(item);
      reject(new Error(body?.error ?? body?.errors?.[0]?.error ?? (xhr.status === 401 ? "Your session has expired. Sign in again." : `Upload failed (error ${xhr.status}).`)));
    };
    xhr.onerror = () => reject(new Error("Couldn't reach the server. Check your connection and try again."));
    xhr.send(form);
  });
}

/* ── Upload queue ───────────────────────────────────────────── */

export interface UploadTask {
  key: number;
  name: string;
  status: "waiting" | "preparing" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
  note?: string;
}

/** Prepares and uploads files one at a time (resizing is heavy), calling `onUploaded` for each success. */
export function useMediaUploads(onUploaded: (item: MediaItem) => void) {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const nextKey = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const callback = useRef(onUploaded);
  useEffect(() => {
    callback.current = onUploaded;
  });

  const patch = useCallback((key: number, p: Partial<UploadTask>) => setTasks((ts) => ts.map((t) => (t.key === key ? { ...t, ...p } : t))), []);
  const dismiss = useCallback((key: number) => setTasks((ts) => ts.filter((t) => t.key !== key)), []);

  const run = useCallback(
    async (key: number, file: File) => {
      try {
        patch(key, { status: "preparing" });
        const prepared = await prepareImage(file);
        const note = prepared.originalSize
          ? `${formatBytes(prepared.originalSize)} → ${formatBytes(prepared.blob.size)} · ${prepared.width}×${prepared.height}`
          : `${formatBytes(prepared.blob.size)} · ${prepared.width}×${prepared.height}`;
        patch(key, { status: "uploading", note });
        const item = await uploadPrepared(prepared, (progress) => patch(key, { progress }));
        patch(key, { status: "done", progress: 1 });
        callback.current(item);
        setTimeout(() => dismiss(key), 6000);
      } catch (err) {
        patch(key, { status: "error", error: err instanceof Error ? err.message : "Upload failed." });
      }
    },
    [patch, dismiss],
  );

  const add = useCallback(
    (files: Iterable<File> | ArrayLike<File> | null | undefined) => {
      const list = files ? Array.from(files) : [];
      if (!list.length) return;
      const entries = list.map((f) => ({ key: ++nextKey.current, name: f.name || "image", status: "waiting" as const, progress: 0 }));
      setTasks((ts) => [...ts, ...entries]);
      list.forEach((file, i) => {
        queue.current = queue.current.then(() => run(entries[i].key, file));
      });
    },
    [run],
  );

  const busy = tasks.some((t) => t.status === "waiting" || t.status === "preparing" || t.status === "uploading");
  return { tasks, add, dismiss, busy };
}

export function UploadQueue({ tasks, onDismiss, className }: { tasks: UploadTask[]; onDismiss: (key: number) => void; className?: string }) {
  if (!tasks.length) return null;
  return (
    <ul className={cn("space-y-2", className)} aria-label="Uploads">
      {tasks.map((t) => (
        <li key={t.key} className={cn("flex items-start gap-3 border bg-white px-3.5 py-2.5", t.status === "error" ? "border-red/40 bg-red-50/40" : "border-line")}>
          <span className="mt-0.5 shrink-0">
            {t.status === "done" ? (
              <CheckCircle2 aria-hidden className="size-4 text-[#1e7a3c]" />
            ) : t.status === "error" ? (
              <AlertCircle aria-hidden className="size-4 text-red" />
            ) : (
              <Loader2 aria-hidden className="size-4 animate-spin text-muted" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className="truncate text-[13px] font-medium" title={t.name}>
                {t.name}
              </p>
              <p className="shrink-0 text-[12px] text-muted num" role="status">
                {t.status === "waiting" && "Waiting…"}
                {t.status === "preparing" && "Resizing…"}
                {t.status === "uploading" && `${Math.round(t.progress * 100)}%`}
                {t.status === "done" && "Uploaded"}
                {t.status === "error" && <span className="text-red">Failed</span>}
              </p>
            </div>
            {t.status === "error" ? (
              <p className="mt-0.5 text-[12.5px] text-red">{t.error}</p>
            ) : (
              <>
                {t.note && <p className="mt-0.5 text-[12px] text-muted num">{t.note}</p>}
                {(t.status === "uploading" || t.status === "done") && (
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-mist" aria-hidden>
                    <div className="h-full bg-ink transition-[width] duration-200" style={{ width: `${Math.round(t.progress * 100)}%` }} />
                  </div>
                )}
              </>
            )}
          </div>
          {(t.status === "error" || t.status === "done") && (
            <button type="button" onClick={() => onDismiss(t.key)} aria-label={`Dismiss ${t.name}`} className="-mr-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-mist hover:text-ink">
              <X aria-hidden className="size-4" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/* ── Drop zone ──────────────────────────────────────────────── */

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

/** Drag-and-drop target with a "Choose files" button. */
export function MediaDropzone({ onFiles, compact, className }: { onFiles: (files: FileList | null) => void; compact?: boolean; className?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragEnter={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragOver={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setOver(false);
        onFiles(e.dataTransfer.files);
      }}
      className={cn(
        "flex flex-col justify-center gap-3 border border-dashed transition-colors",
        compact ? "items-stretch px-4 py-4 text-left sm:flex-row sm:items-center sm:justify-between" : "items-center px-6 py-8 text-center",
        over ? "border-red bg-red-50/60" : "border-ink/20 bg-mist/40",
        className,
      )}
    >
      <div className={cn("flex items-center gap-3", !compact && "flex-col")}>
        <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-white text-ink", compact ? "size-9" : "size-12")}>
          <ImageUp aria-hidden className={compact ? "size-4" : "size-5"} />
        </span>
        <div>
          <p className="text-[14px] font-medium">{over ? "Drop to upload" : "Drag images here to upload"}</p>
          <p className="mt-0.5 text-[12.5px] text-muted">
            {MEDIA_FORMATS_LABEL}. Photos are saved as WebP and big ones resized to {MEDIA_RESIZE_TO} px; each file must end up under {formatBytes(MEDIA_MAX_BYTES)}.
          </p>
        </div>
      </div>
      <Button type="button" variant="dark" size="sm" className="shrink-0" onClick={() => input.current?.click()} icon={<ImageUp aria-hidden className="size-4" />}>
        Choose files
      </Button>
      <input
        ref={input}
        type="file"
        multiple
        accept={MEDIA_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/* ── Paged list with search ─────────────────────────────────── */

type ListState = MediaPage & { q: string };

/** Library contents with debounced search and "load more". Fetches on mount unless given a first page. */
export function useMediaList(initial?: ListState) {
  const [q, setQ] = useState(initial?.q ?? "");
  const [data, setData] = useState<ListState | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [needsFirstLoad] = useState(!initial);
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const load = useCallback((query: string) => {
    const n = ++seq.current;
    return listMediaAction({ q: query })
      .catch(() => ({ ok: false as const, error: "Couldn't reach the server." }))
      .then((res) => {
        if (n !== seq.current) return; // A newer search has started.
        if (!res.ok) {
          setError(res.error ?? "Couldn't load the library.");
          setData((d) => ({ items: d?.items ?? [], nextCursor: null, total: d?.total ?? 0, q: query }));
          return;
        }
        setError(null);
        setData({ items: res.items, nextCursor: res.nextCursor, total: res.total, q: query });
      });
  }, []);

  useEffect(() => {
    if (needsFirstLoad) void load("");
    return () => clearTimeout(timer.current);
  }, [needsFirstLoad, load]);

  const search = (value: string) => {
    setQ(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void load(value.trim()), 250);
  };

  const loadMore = async () => {
    if (!data?.nextCursor || loadingMore) return;
    const n = seq.current;
    setLoadingMore(true);
    const res = await listMediaAction({ q: data.q, before: data.nextCursor }).catch(() => ({ ok: false as const, error: "Couldn't reach the server." }));
    setLoadingMore(false);
    if (n !== seq.current) return;
    if (!res.ok) return setError(res.error ?? "Couldn't load more images.");
    setData((d) => d && { ...d, items: [...d.items, ...res.items.filter((x) => !d.items.some((y) => y.id === x.id))], nextCursor: res.nextCursor, total: res.total });
  };

  const prepend = useCallback((item: MediaItem) => setData((d) => d && { ...d, items: [item, ...d.items.filter((x) => x.id !== item.id)], total: d.total + 1 }), []);
  const replace = useCallback((item: MediaItem) => setData((d) => d && { ...d, items: d.items.map((x) => (x.id === item.id ? item : x)) }), []);
  const remove = useCallback((id: number) => setData((d) => d && { ...d, items: d.items.filter((x) => x.id !== id), total: Math.max(0, d.total - 1) }), []);

  return {
    q,
    search,
    items: data?.items ?? [],
    total: data?.total ?? 0,
    hasMore: Boolean(data?.nextCursor),
    loading: data === null || data.q !== q.trim(),
    loadingMore,
    error,
    loadMore,
    prepend,
    replace,
    remove,
  };
}

/* ── Bits ───────────────────────────────────────────────────── */

/** Checkerboard behind thumbnails so transparent PNG/WebP edges are visible. */
export const checkerboard: CSSProperties = {
  backgroundColor: "#fff",
  backgroundImage: "linear-gradient(45deg,#f0f0f0 25%,transparent 25%),linear-gradient(-45deg,#f0f0f0 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#f0f0f0 75%),linear-gradient(-45deg,transparent 75%,#f0f0f0 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
};

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Absolute URL for sharing outside the site; forms store the /media/… path. */
export const absoluteUrl = (path: string) => (typeof window === "undefined" ? path : new URL(path, window.location.origin).href);

export const dimensions = (m: Pick<MediaItem, "width" | "height">) => (m.width && m.height ? `${m.width}×${m.height}` : "—");
