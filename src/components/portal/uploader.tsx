"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, FileText, ImagePlus, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import type { PartnerDocKind } from "@/db/enums";
import type { FileRef } from "@/partner/types";
import { cn } from "@/lib/utils";
import { prepareImage } from "@/components/admin/media-client";
import { useUI } from "@/components/providers/app-provider";

/* ──────────────────────────────────────────────────────────────
   Uploads from the dealer portal → POST /dealer/upload.
   - ImageUploader: public images (showroom/vehicle photos, logos,
     banners), downscaled in the browser first; value = /media URLs.
   - DocumentUploader: private documents (PDF/JPEG/PNG/WebP);
     value = FileRef, opened via /dealer/files/<id>.
   ────────────────────────────────────────────────────────────── */

const MAX = 900 * 1024;

type UploadResult = { media?: { url: string }; file?: FileRef; error?: string };

function send(body: FormData, onProgress: (f: number) => void): Promise<UploadResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/dealer/upload");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText) as UploadResult;
        resolve(xhr.status >= 200 && xhr.status < 300 ? res : { error: res.error ?? "Upload failed." });
      } catch {
        resolve({ error: "Upload failed." });
      }
    };
    xhr.onerror = () => resolve({ error: "Couldn't reach the server. Check your connection." });
    xhr.send(body);
  });
}

/** Uploads one image (resized first) and returns its public URL, or an error message. */
export async function uploadDealerImage(file: File, onProgress: (f: number) => void = () => {}): Promise<{ url?: string; error?: string }> {
  let prepared: { blob: Blob; name: string };
  try {
    const p = await prepareImage(file);
    prepared = { blob: p.blob, name: p.filename };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "That image couldn't be read." };
  }
  const fd = new FormData();
  fd.append("kind", "media");
  fd.append("file", prepared.blob, prepared.name);
  const res = await send(fd, onProgress);
  return res.media ? { url: res.media.url } : { error: res.error ?? "Upload failed." };
}

/** Uploads one private document and returns its reference, or an error message. */
export async function uploadDealerDocument(file: File, kind: PartnerDocKind, onProgress: (f: number) => void = () => {}): Promise<{ file?: FileRef; error?: string }> {
  if (file.size > MAX) return { error: `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 900 KB — compress the scan or upload a smaller file.` };
  const fd = new FormData();
  fd.append("kind", kind);
  fd.append("file", file);
  const res = await send(fd, onProgress);
  return res.file ? { file: res.file } : { error: res.error ?? "Upload failed." };
}

export const fileUrl = (f: Pick<FileRef, "id">, download = false) => `/dealer/files/${f.id}${download ? "?download=1" : ""}`;
export const fileSize = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

function Progress({ value }: { value: number }) {
  return (
    <span className="block h-1 w-full overflow-hidden rounded-full bg-mist">
      <span className="block h-full bg-red transition-[width] duration-200" style={{ width: `${Math.round(value * 100)}%` }} />
    </span>
  );
}

/** One or many public images with thumbnails, reordering and removal. */
export function ImageUploader({
  value,
  onChange,
  multiple = false,
  max = 12,
  label = "Upload images",
  hint,
  error,
  aspect = "aspect-[4/3]",
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  multiple?: boolean;
  max?: number;
  label?: string;
  hint?: string;
  error?: string;
  aspect?: string;
}) {
  const { toast } = useUI();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<{ name: string; progress: number }[]>([]);
  const room = multiple ? max - value.length : 1;

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, Math.max(0, room));
    if (files.length > list.length) toast(`You can add up to ${max} images.`, { tone: "error" });
    const added: string[] = [];
    setBusy(list.map((f) => ({ name: f.name, progress: 0 })));
    for (const [i, f] of list.entries()) {
      const res = await uploadDealerImage(f, (p) => setBusy((b) => b.map((x, j) => (j === i ? { ...x, progress: p } : x))));
      if (res.url) added.push(res.url);
      else toast(`${f.name}: ${res.error}`, { tone: "error" });
    }
    setBusy([]);
    if (added.length) onChange(multiple ? [...value, ...added] : [added[0]]);
    if (input.current) input.current.value = "";
  };

  const move = (from: number, to: number) => {
    const next = [...value];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    onChange(next);
  };

  return (
    <div>
      <div className={cn("grid gap-3", multiple ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : "grid-cols-1 sm:max-w-sm")}>
        {value.map((src, i) => (
          <figure key={`${src}-${i}`} className={cn("group relative overflow-hidden rounded-[4px] border border-line bg-mist", aspect)}>
            {/* Dealer-uploaded image preview. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" decoding="async" src={src} alt="" className="size-full object-cover" />
            {multiple && i === 0 && <span className="absolute left-2 top-2 rounded-full bg-ink px-2 py-0.5 text-[10.5px] font-semibold text-white">Cover</span>}
            <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-ink/70 to-transparent p-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
              {multiple && i > 0 && (
                <button type="button" onClick={() => move(i, i - 1)} className="inline-flex size-8 items-center justify-center rounded-full bg-white/90 text-ink" aria-label="Move earlier">
                  <ArrowUp className="size-4 -rotate-90" />
                </button>
              )}
              {multiple && i < value.length - 1 && (
                <button type="button" onClick={() => move(i, i + 1)} className="inline-flex size-8 items-center justify-center rounded-full bg-white/90 text-ink" aria-label="Move later">
                  <ArrowDown className="size-4 -rotate-90" />
                </button>
              )}
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="inline-flex size-8 items-center justify-center rounded-full bg-white/90 text-ink hover:text-red" aria-label="Remove image">
                <Trash2 className="size-4" />
              </button>
            </div>
          </figure>
        ))}
        {busy.map((b, i) => (
          <div key={`busy-${i}`} className={cn("flex flex-col justify-end gap-2 rounded-[4px] border border-line bg-white p-3", aspect)}>
            <p className="truncate text-[12px] text-muted">{b.name}</p>
            <Progress value={b.progress} />
          </div>
        ))}
        {room > 0 && busy.length === 0 && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              pick(e.dataTransfer.files);
            }}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-[4px] border border-dashed bg-white p-4 text-center text-[13px] text-muted transition-colors hover:border-ink hover:text-ink",
              error ? "border-red" : "border-ink/20",
              aspect,
            )}
          >
            <ImagePlus aria-hidden className="size-5" />
            <span className="font-medium text-ink">{value.length && !multiple ? "Replace image" : label}</span>
            <span className="text-[11.5px]">Drop files or click · JPEG, PNG, WebP</span>
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple={multiple} hidden onChange={(e) => pick(e.target.files)} />
      {hint && !error && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
      {error && <p className="mt-1.5 text-xs text-red">{error}</p>}
    </div>
  );
}

/** A single private document (PDF or image) with preview link, replace and remove. */
export function DocumentUploader({
  kind,
  value,
  onChange,
  label,
  hint,
  error,
  required,
}: {
  kind: PartnerDocKind;
  value: FileRef | null;
  onChange: (file: FileRef | null) => void;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setFailed(null);
    setProgress(0);
    const res = await uploadDealerDocument(file, kind, setProgress);
    setProgress(null);
    if (res.file) onChange(res.file);
    else setFailed(res.error ?? "Upload failed.");
    if (input.current) input.current.value = "";
  };

  const msg = failed ?? error;
  return (
    <div>
      <p className="mb-2 text-[12.5px] font-medium text-ink">
        {label}
        {!required && <span className="font-normal text-muted"> (optional)</span>}
      </p>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          pick(e.dataTransfer.files[0]);
        }}
        className={cn("flex items-center gap-3 rounded-[4px] border bg-white p-3", msg ? "border-red" : value ? "border-line" : "border-dashed border-ink/20")}
      >
        <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-[3px]", value ? "bg-red-50 text-red" : "bg-mist text-muted")}>
          {value ? <FileText className="size-5" aria-hidden /> : <Paperclip className="size-5" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          {progress !== null ? (
            <>
              <p className="text-[13px] text-muted">Uploading…</p>
              <Progress value={progress} />
            </>
          ) : value ? (
            <>
              <a href={fileUrl(value)} target="_blank" rel="noreferrer" className="block truncate text-[13.5px] font-medium hover:text-red">
                {value.filename}
              </a>
              <p className="text-[12px] text-muted">
                {value.mime === "application/pdf" ? "PDF" : "Image"} · {fileSize(value.size)}
              </p>
            </>
          ) : (
            <p className="text-[13px] text-muted">PDF, JPEG, PNG or WebP · up to 900 KB</p>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={progress !== null}
            className="inline-flex h-9 items-center gap-1.5 rounded-[3px] border border-line px-3 text-[13px] font-medium hover:border-ink disabled:opacity-40"
          >
            {progress !== null ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
            {value ? "Replace" : "Upload"}
          </button>
          {value && progress === null && (
            <button type="button" onClick={() => onChange(null)} className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-mist hover:text-red" aria-label={`Remove ${label}`}>
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      </div>
      <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" hidden onChange={(e) => pick(e.target.files?.[0])} />
      {hint && !msg && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
      {msg && <p className="mt-1.5 text-xs text-red">{msg}</p>}
    </div>
  );
}
