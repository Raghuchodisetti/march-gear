"use client";

import { useState } from "react";
import { Check, ImageOff, ImagePlus, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { filterInput } from "./ui";
import { MediaDropzone, UploadQueue, checkerboard, dimensions, useMediaList, useMediaUploads } from "./media-client";
import type { MediaItem } from "./media-shared";

/** "Upload / choose" for image fields: opens the picker and hands back the chosen /media/… URL(s). */
export function MediaPickerButton({ multiple = false, onPick, look = "button", className }: { multiple?: boolean; onPick: (urls: string[]) => void; look?: "button" | "link"; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {look === "link" ? (
        <button type="button" onClick={() => setOpen(true)} className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium text-red hover:underline", className)}>
          <ImagePlus aria-hidden className="size-4" /> Upload / choose
        </button>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} className={className} icon={<ImagePlus aria-hidden className="size-4" />}>
          Upload / choose
        </Button>
      )}
      <MediaPicker open={open} multiple={multiple} onClose={() => setOpen(false)} onPick={onPick} />
    </>
  );
}

export function MediaPicker({ open, onClose, multiple = false, onPick }: { open: boolean; onClose: () => void; multiple?: boolean; onPick: (urls: string[]) => void }) {
  return (
    <Modal open={open} onClose={onClose} size="xl" title={multiple ? "Add images" : "Choose an image"} description="Upload new images or pick from the media library.">
      {/* Mounted only while open, so each opening starts fresh and loads the latest library. */}
      <PickerBody
        multiple={multiple}
        onCancel={onClose}
        onPick={(urls) => {
          onPick(urls);
          onClose();
        }}
      />
    </Modal>
  );
}

function PickerBody({ multiple, onPick, onCancel }: { multiple: boolean; onPick: (urls: string[]) => void; onCancel: () => void }) {
  const list = useMediaList();
  const [selected, setSelected] = useState<MediaItem[]>([]);
  const uploads = useMediaUploads((item) => {
    list.prepend(item);
    // Fresh uploads are selected straight away.
    setSelected((s) => (multiple ? [...s.filter((x) => x.id !== item.id), item] : [item]));
  });
  const toggle = (m: MediaItem) => setSelected((s) => (s.some((x) => x.id === m.id) ? s.filter((x) => x.id !== m.id) : multiple ? [...s, m] : [m]));
  const n = selected.length;

  return (
    <div className="flex flex-col">
      <div className="space-y-3 border-b border-line px-4 py-4 sm:px-6">
        <MediaDropzone compact onFiles={uploads.add} />
        <UploadQueue tasks={uploads.tasks} onDismiss={uploads.dismiss} />
        <div className="flex items-center gap-3">
          <label className="relative block min-w-0 flex-1 sm:max-w-80">
            <span className="sr-only">Search the library</span>
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input type="search" value={list.q} onChange={(e) => list.search(e.target.value)} placeholder="Search file name or alt text…" className={cn(filterInput, "w-full pl-9")} />
          </label>
          <p className="ml-auto flex shrink-0 items-center gap-2 text-[12.5px] text-muted num" aria-live="polite">
            {list.loading && <Loader2 aria-hidden className="size-3.5 animate-spin" />}
            {!list.loading && `${list.total.toLocaleString("en-IN")} ${list.q.trim() ? "matching" : list.total === 1 ? "image" : "images"}`}
          </p>
        </div>
      </div>

      <div className="min-h-56 px-4 py-4 sm:px-6">
        {list.error && <p className="mb-3 text-[13px] text-red">{list.error}</p>}
        {list.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-[13.5px] text-muted">
            {list.loading ? <Loader2 aria-hidden className="size-5 animate-spin" /> : <ImageOff aria-hidden className="size-5" />}
            <p className="mt-2">{list.loading ? "Loading the library…" : list.q.trim() ? `No images match “${list.q.trim()}”.` : "The library is empty — upload an image above."}</p>
          </div>
        ) : (
          <ul className={cn("grid grid-cols-2 gap-2.5 min-[480px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-5", list.loading && "opacity-60")}>
            {list.items.map((m) => {
              const order = selected.findIndex((x) => x.id === m.id);
              const on = order !== -1;
              return (
                <li key={m.id} className="min-w-0">
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(m)}
                    onDoubleClick={() => !multiple && onPick([m.url])}
                    className={cn("group block w-full text-left outline-offset-2", on && "outline-2 outline-red")}
                  >
                    <span className={cn("relative block aspect-[4/3] overflow-hidden border", on ? "border-red" : "border-line group-hover:border-ink/40")} style={checkerboard}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.url} alt={m.alt ?? ""} loading="lazy" decoding="async" className="size-full object-contain" />
                      {on && (
                        <span className="absolute right-1.5 top-1.5 inline-flex size-6 items-center justify-center rounded-full bg-red text-[11.5px] font-semibold text-white num">
                          {multiple ? order + 1 : <Check aria-hidden className="size-3.5" strokeWidth={3} />}
                        </span>
                      )}
                    </span>
                    <span className="mt-1.5 block truncate text-[12px] font-medium" title={m.filename}>
                      {m.filename}
                    </span>
                    <span className="block text-[11.5px] text-muted num">{dimensions(m)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {list.hasMore && (
          <div className="mt-4 flex justify-center">
            <Button type="button" variant="outline" size="sm" onClick={list.loadMore} disabled={list.loadingMore} icon={list.loadingMore ? <Loader2 aria-hidden className="size-4 animate-spin" /> : undefined}>
              Load more
            </Button>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-white px-4 py-3 sm:px-6">
        <p className="text-[13px] text-muted num">{n ? `${n} selected` : multiple ? "Select one or more images" : "Select an image"}</p>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" size="sm" disabled={!n || uploads.busy} onClick={() => onPick(selected.map((m) => m.url))} icon={<Check aria-hidden className="size-4" />}>
            {multiple ? (n > 1 ? `Add ${n} images` : "Add image") : "Use image"}
          </Button>
        </div>
      </div>
    </div>
  );
}
