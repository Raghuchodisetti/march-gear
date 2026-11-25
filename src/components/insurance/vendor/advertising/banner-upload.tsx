"use client";

import { useRef, useState } from "react";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUI } from "@/components/providers/app-provider";
import { InsImageUploader, uploadInsurerImage } from "@/components/insurance/vendor/uploader";
import { sizeLabel } from "@/components/ads/shared";
import type { ImageSlotProps } from "@/components/ads/creative-fields";

/**
 * A banner image for an ad creative: the portal uploader (kind media) while empty; once set, a
 * compact preview at the recommended ratio with Replace and Remove.
 */
export function BannerUpload({ slot, value, onChange, error, aspectClass, size }: ImageSlotProps) {
  const { toast } = useUI();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const label = slot === "desktop" ? "desktop banner" : "mobile banner";

  if (!value)
    return <InsImageUploader value={[]} onChange={(urls) => onChange(urls[0] ?? null)} label={`Upload ${label}`} hint={`${sizeLabel(size)} recommended`} error={error} aspect={aspectClass} />;

  const replace = async (file: File | undefined) => {
    if (!file) return;
    setProgress(0);
    const res = await uploadInsurerImage(file, setProgress);
    setProgress(null);
    if (input.current) input.current.value = "";
    if (res.url) onChange(res.url);
    else toast(`${file.name}: ${res.error ?? "Upload failed."}`, { tone: "error" });
  };

  return (
    <div className={cn(slot === "mobile" ? "max-w-[300px]" : "sm:max-w-sm")}>
      <figure className={cn("relative overflow-hidden rounded-[4px] border bg-mist", aspectClass, error ? "border-red" : "border-line")}>
        {/* Vendor-uploaded banner preview. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img loading="lazy" decoding="async" src={value} alt="" className="size-full object-cover" />
        {progress !== null && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/80 text-[12px] text-muted">
            <Loader2 aria-hidden className="size-4 animate-spin" /> Uploading… {Math.round(progress * 100)}%
          </span>
        )}
      </figure>
      <div className="mt-2 flex items-center gap-1">
        <button type="button" onClick={() => input.current?.click()} disabled={progress !== null} className="inline-flex h-8 items-center gap-1.5 rounded-[3px] border border-line bg-white px-2.5 text-[12.5px] font-medium transition-colors hover:border-ink disabled:opacity-40">
          <RefreshCw aria-hidden className="size-3.5" /> Replace
        </button>
        <button type="button" onClick={() => onChange(null)} disabled={progress !== null} aria-label={`Remove the ${label}`} className="inline-flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-red-50 hover:text-red disabled:opacity-40">
          <Trash2 aria-hidden className="size-4" />
        </button>
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" hidden onChange={(e) => replace(e.target.files?.[0])} />
      {error && <p className="mt-1.5 text-xs text-red">{error}</p>}
    </div>
  );
}
