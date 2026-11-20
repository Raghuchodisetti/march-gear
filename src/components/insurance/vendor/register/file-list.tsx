"use client";

import { useRef, useState } from "react";
import { BadgeCheck, CircleX, FileText, Image as ImageIcon, Loader2, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InsDocKind } from "@/db/enums";
import { fileSize, insFileUrl, uploadInsurerDocument } from "@/components/insurance/vendor/uploader";
import { FieldError } from "@/components/portal/register/controls";
import { INS_MAX_SUPPORTING, type FileReview } from "@/insurance/schemas";
import type { FileRef } from "@/insurance/types";
import { trimStop } from "@/partner/schemas";

/** What MarchGear's team decided about an uploaded file (nothing while it awaits review). */
export function ReviewLine({ review }: { review?: FileReview }) {
  if (!review || review.status === "pending") return null;
  return review.status === "verified" ? (
    <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-[#1e7a3c]">
      <BadgeCheck aria-hidden className="size-3.5" /> Verified by MarchGear
    </p>
  ) : (
    <p className="mt-1.5 flex items-start gap-1 text-xs font-medium text-red" data-error="true">
      <CircleX aria-hidden className="mt-px size-3.5 shrink-0" />
      <span>Rejected by MarchGear{review.remarks ? ` — ${trimStop(review.remarks)}` : ""}. Replace this file.</span>
    </p>
  );
}

/** Several private documents of one kind: upload with progress, open, remove. */
export function FileList({
  kind,
  files,
  onChange,
  errors,
  errorKey,
  reviews,
  addLabel,
  max = INS_MAX_SUPPORTING,
}: {
  kind: InsDocKind;
  files: FileRef[];
  onChange: (f: FileRef[]) => void;
  errors: Record<string, string>;
  errorKey: string;
  reviews: Record<number, FileReview>;
  addLabel: string;
  max?: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<{ name: string; progress: number } | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const room = max - files.length;

  const pick = async (list: FileList | null) => {
    if (!list?.length) return;
    const chosen = Array.from(list).slice(0, room);
    const failed: string[] = list.length > chosen.length ? [`Only ${room} more ${room === 1 ? "file fits" : "files fit"} — the rest were skipped.`] : [];
    const added: FileRef[] = [];
    for (const f of chosen) {
      setBusy({ name: f.name, progress: 0 });
      const res = await uploadInsurerDocument(f, kind, (p) => setBusy({ name: f.name, progress: p }));
      if (res.file) added.push(res.file);
      else failed.push(`${f.name}: ${res.error}`);
    }
    setBusy(null);
    setProblems(failed);
    if (added.length) onChange([...files, ...added]);
    if (input.current) input.current.value = "";
  };

  return (
    <div data-error={errors[errorKey] ? "true" : undefined}>
      {files.length > 0 && (
        <ul className="mb-3 divide-y divide-line border border-line">
          {files.map((f, i) => {
            const err = errors[`${errorKey}.${i}`];
            return (
              <li key={f.id} className="flex items-center gap-3 px-3 py-2.5" data-error={err ? "true" : undefined}>
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[3px] bg-red-50 text-red">
                  {f.mime.startsWith("image/") ? <ImageIcon aria-hidden className="size-4" /> : <FileText aria-hidden className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <a href={insFileUrl(f)} target="_blank" rel="noreferrer" className="block truncate text-[13.5px] font-medium hover:text-red">
                    {f.filename}
                  </a>
                  <p className="text-[12px] text-muted">
                    {f.mime === "application/pdf" ? "PDF" : "Image"} · {fileSize(f.size)}
                  </p>
                  {err ? <p className="text-xs text-red">{err}</p> : <ReviewLine review={reviews[f.id]} />}
                </div>
                <button
                  type="button"
                  onClick={() => onChange(files.filter((x) => x.id !== f.id))}
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-mist hover:text-red"
                  aria-label={`Remove ${f.filename}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {busy && (
        <div className="mb-3 border border-line px-3 py-3 text-[13px] text-muted">
          <div className="flex items-center gap-3">
            <Loader2 aria-hidden className="size-4 animate-spin" />
            <span className="min-w-0 flex-1 truncate">Uploading {busy.name}…</span>
            <span className="num">{Math.round(busy.progress * 100)}%</span>
          </div>
          <span className="mt-2 block h-1 w-full overflow-hidden rounded-full bg-mist">
            <span className="block h-full bg-red transition-[width] duration-200" style={{ width: `${Math.round(busy.progress * 100)}%` }} />
          </span>
        </div>
      )}
      {room > 0 && !busy && (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void pick(e.dataTransfer.files);
          }}
          className={cn("flex w-full flex-col items-center justify-center gap-1 border border-dashed bg-white px-4 py-6 text-center transition-colors duration-300 hover:border-ink", errors[errorKey] ? "border-red" : "border-ink/20")}
        >
          <span className="inline-flex items-center gap-2 text-[13.5px] font-medium">
            <Plus aria-hidden className="size-4" /> {addLabel}
          </span>
          <span className="text-[12px] text-muted">Drop files or click · PDF, JPEG, PNG or WebP · up to 900 KB each</span>
        </button>
      )}
      {room <= 0 && <p className="text-[12.5px] text-muted">That&apos;s the maximum of {max} files — remove one to add another.</p>}
      <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => void pick(e.target.files)} />
      {problems.map((p, i) => (
        <p key={i} className="mt-1.5 text-xs text-red">
          {p}
        </p>
      ))}
      <FieldError>{errors[errorKey]}</FieldError>
    </div>
  );
}
