"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, ImagePlus, Images, Loader2, Search, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import { formatDateTime } from "@/components/portal/ui";
import { fileSize, uploadDealerImage } from "@/components/portal/uploader";
import { useUI } from "@/components/providers/app-provider";
import { ConfirmDialog } from "@/components/portal/inventory/dialogs";
import { deletePartnerMediaAction, listPartnerMediaAction, partnerMediaUsageAction, updatePartnerMediaAltAction } from "@/server/actions/partner-media";
import type { PartnerMediaItem, PartnerMediaUsage } from "@/server/partner/inventory";

/* ──────────────────────────────────────────────────────────────
   /dealer/media — the dealership's own public images: upload many
   at once, search, describe (alt text), copy the link, see where an
   image is used, and delete it (with a warning when it's in use).
   ────────────────────────────────────────────────────────────── */

const MAX_BATCH = 20;
const ALT_MAX = 300;

interface Page {
  items: PartnerMediaItem[];
  nextCursor: number | null;
  total: number;
}

const dims = (m: Pick<PartnerMediaItem, "width" | "height">) => (m.width && m.height ? `${m.width} × ${m.height}` : null);

export function MediaLibrary({ initial }: { initial: Page }) {
  const { toast } = useUI();
  const [page, setPage] = useState<Page>(initial);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(false);
  const [uploads, setUploads] = useState<{ name: string; progress: number; error?: string }[]>([]);
  const [dragging, setDragging] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const uploading = uploads.some((u) => u.progress < 1 && !u.error);

  const load = async (search: string) => {
    setLoading(true);
    const res = await listPartnerMediaAction({ q: search || undefined });
    setLoading(false);
    if (!res.ok) return toast(res.error ?? "Couldn't load your images.", { tone: "error" });
    setPage({ items: res.items, nextCursor: res.nextCursor, total: res.total });
  };

  // Search as you type.
  useEffect(() => {
    const term = q.trim();
    if (term === query) return;
    const t = setTimeout(() => {
      setQuery(term);
      load(term);
    }, 400);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = async () => {
    if (!page.nextCursor) return;
    setMore(true);
    const res = await listPartnerMediaAction({ q: query || undefined, before: page.nextCursor });
    setMore(false);
    if (!res.ok) return toast(res.error ?? "Couldn't load more images.", { tone: "error" });
    setPage((p) => ({ items: [...p.items, ...res.items.filter((i) => !p.items.some((x) => x.id === i.id))], nextCursor: res.nextCursor, total: res.total }));
  };

  const upload = async (files: FileList | File[] | null) => {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return toast("Choose JPEG, PNG, WebP, GIF or AVIF images.", { tone: "error" });
    if (list.length > MAX_BATCH) toast(`Uploading the first ${MAX_BATCH} images — add the rest in another batch.`);
    const batch = list.slice(0, MAX_BATCH);
    setUploads(batch.map((f) => ({ name: f.name, progress: 0 })));
    let ok = 0;
    for (const [i, f] of batch.entries()) {
      const res = await uploadDealerImage(f, (p) => setUploads((u) => u.map((x, j) => (j === i ? { ...x, progress: Math.min(0.99, p) } : x))));
      setUploads((u) => u.map((x, j) => (j === i ? { ...x, progress: 1, error: res.url ? undefined : res.error } : x)));
      if (res.url) ok++;
    }
    if (input.current) input.current.value = "";
    if (ok) {
      toast(`${ok} ${ok === 1 ? "image" : "images"} uploaded`, { tone: "success" });
      setQ("");
      setQuery("");
      await load("");
    }
    // Keep failures on screen; clear a clean batch after a moment.
    setUploads((u) => (u.some((x) => x.error) ? u.filter((x) => x.error) : []));
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!uploading) upload(e.dataTransfer.files);
  };

  const selected = page.items.find((m) => m.id === openId) ?? null;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!dragging) setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={onDrop}
      className="relative"
    >
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border border-line bg-white p-3 sm:flex-row sm:items-center">
        <label className="relative block sm:w-80">
          <span className="sr-only">Search images</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by file name or description"
            className="h-10 w-full rounded-[3px] border border-line bg-white pl-9 pr-3 text-[13.5px] outline-none transition-colors hover:border-ink/30 focus:border-ink"
          />
        </label>
        <p className="text-[13px] text-muted num sm:ml-2" aria-live="polite">
          {loading ? <Loader2 aria-label="Loading" className="inline size-4 animate-spin" /> : `${page.total} ${page.total === 1 ? "image" : "images"}${query ? ` matching “${query}”` : ""}`}
        </p>
        <div className="sm:ml-auto">
          <Button onClick={() => input.current?.click()} disabled={uploading} icon={uploading ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Upload aria-hidden className="size-4" />} className="w-full sm:w-auto">
            {uploading ? "Uploading…" : "Upload images"}
          </Button>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple hidden onChange={(e) => upload(e.target.files)} />
        </div>
      </div>

      {/* Upload progress */}
      {uploads.length > 0 && (
        <ul className="mt-3 divide-y divide-line border border-line bg-white" aria-label="Uploads">
          {uploads.map((u, i) => (
            <li key={`${u.name}-${i}`} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
              {u.error ? (
                <span className="size-4 shrink-0 rounded-full bg-red" aria-hidden />
              ) : u.progress >= 1 ? (
                <Check aria-hidden className="size-4 shrink-0 text-[#1e7a3c]" />
              ) : (
                <Loader2 aria-hidden className="size-4 shrink-0 animate-spin text-muted" />
              )}
              <span className="min-w-0 flex-1 truncate">{u.name}</span>
              {u.error ? (
                <span className="max-w-[55%] text-right text-[12px] text-red">{u.error}</span>
              ) : (
                <span className="block h-1 w-24 shrink-0 overflow-hidden rounded-full bg-mist">
                  <span className="block h-full bg-red transition-[width] duration-200" style={{ width: `${Math.round(u.progress * 100)}%` }} />
                </span>
              )}
            </li>
          ))}
          {!uploading && (
            <li className="flex justify-end px-4 py-2">
              <button type="button" onClick={() => setUploads([])} className="text-[12.5px] font-medium text-muted hover:text-ink">
                Dismiss
              </button>
            </li>
          )}
        </ul>
      )}

      {/* Grid */}
      <div className={cn("mt-4 transition-opacity duration-300", loading && "opacity-60")}>
        {page.items.length === 0 ? (
          <div className="flex flex-col items-center border border-dashed border-ink/20 bg-white px-6 py-16 text-center">
            <Images aria-hidden className="size-8 text-muted" strokeWidth={1.5} />
            <p className="mt-4 text-[15px] font-semibold">{query ? "No images match" : "No images yet"}</p>
            <p className="mt-1.5 max-w-sm text-[13.5px] text-muted">
              {query ? "Try another file name or description." : "Drop photos here or upload them. Vehicle photos, logos and banners you upload anywhere in the portal also land here."}
            </p>
            {!query && (
              <Button className="mt-6" icon={<ImagePlus aria-hidden className="size-4" />} onClick={() => input.current?.click()}>
                Upload images
              </Button>
            )}
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {page.items.map((m) => (
              <li key={m.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => setOpenId(m.id)}
                  className="group/tile block w-full overflow-hidden border border-line bg-white text-left transition-[border-color] duration-[400ms] ease-[var(--ease-premium)] hover:border-ink/30 focus-visible:border-ink"
                >
                  <span className="relative block aspect-square overflow-hidden bg-mist">
                    {/* Dealer upload from /media, shown as-is. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img decoding="async" src={m.url} alt={m.alt ?? ""} loading="lazy" className="size-full object-cover transition-transform duration-[700ms] ease-[var(--ease-premium)] group-hover/tile:scale-[1.04]" />
                    {!m.alt && <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10.5px] font-semibold text-[#9a5b00]">No description</span>}
                  </span>
                  <span className="block px-3 py-2.5">
                    <span className="block truncate text-[12.5px] font-medium">{m.filename}</span>
                    <span className="mt-0.5 block text-[11.5px] text-muted num">{[dims(m), fileSize(m.size)].filter(Boolean).join(" · ")}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {page.nextCursor && (
          <div className="mt-6 flex justify-center">
            <Button variant="outline" onClick={loadMore} disabled={more} icon={more ? <Loader2 aria-hidden className="size-4 animate-spin" /> : undefined}>
              Load more ({page.total - page.items.length} left)
            </Button>
          </div>
        )}
      </div>

      {dragging && !uploading && (
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 backdrop-blur-[2px] lg:left-[264px]">
          <p className="rounded-[4px] bg-white px-6 py-4 text-[15px] font-semibold shadow-lift">Drop to upload to your media library</p>
        </div>
      )}

      <MediaDrawer
        item={selected}
        onClose={() => setOpenId(null)}
        onSaved={(item) => setPage((p) => ({ ...p, items: p.items.map((x) => (x.id === item.id ? item : x)) }))}
        onDeleted={(id) => {
          setOpenId(null);
          setPage((p) => ({ ...p, items: p.items.filter((x) => x.id !== id), total: Math.max(0, p.total - 1) }));
        }}
      />
    </div>
  );
}

function MediaDrawer({ item, onClose, onSaved, onDeleted }: { item: PartnerMediaItem | null; onClose: () => void; onSaved: (m: PartnerMediaItem) => void; onDeleted: (id: number) => void }) {
  const { toast } = useUI();
  const [alt, setAlt] = useState("");
  const [altError, setAltError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [usage, setUsage] = useState<{ id: number; list: PartnerMediaUsage[] } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastId, setLastId] = useState<number | null>(null);
  const urlInput = useRef<HTMLInputElement>(null);

  if ((item?.id ?? null) !== lastId) {
    setLastId(item?.id ?? null);
    setAlt(item?.alt ?? "");
    setAltError(null);
    setCopied(false);
  }

  useEffect(() => {
    if (!item) return;
    let live = true;
    partnerMediaUsageAction(item.id).then((res) => live && res.ok && setUsage({ id: item.id, list: res.usage }));
    return () => {
      live = false;
    };
  }, [item]);

  const used = item && usage?.id === item.id ? usage.list : null;
  const absolute = (url: string) => (typeof window === "undefined" ? url : `${window.location.origin}${url}`);

  const copy = async () => {
    if (!item) return;
    try {
      await navigator.clipboard.writeText(absolute(item.url));
      setCopied(true);
      toast("Link copied", { tone: "success" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      urlInput.current?.select();
      toast("Press Ctrl+C (or ⌘C) to copy the selected link.");
    }
  };

  const saveAlt = async () => {
    if (!item) return;
    setSaving(true);
    setAltError(null);
    const res = await updatePartnerMediaAltAction(item.id, alt);
    setSaving(false);
    if (!res.ok) {
      setAltError(res.fieldErrors?.alt ?? res.error ?? "Couldn't save.");
      return;
    }
    onSaved(res.item);
    toast("Description saved", { tone: "success" });
  };

  const remove = async () => {
    if (!item) return;
    setDeleting(true);
    const res = await deletePartnerMediaAction(item.id);
    setDeleting(false);
    setConfirm(false);
    if (!res.ok) return toast(res.error ?? "Couldn't delete the image.", { tone: "error" });
    toast(`Deleted ${item.filename}`, { tone: "success" });
    onDeleted(item.id);
  };

  const dirty = item ? (alt.trim() || null) !== (item.alt ?? null) : false;

  return (
    <>
      <Drawer
        open={Boolean(item)}
        onClose={onClose}
        title="Image details"
        className="sm:max-w-lg"
        footer={
          item ? (
            <div className="flex items-center justify-between gap-3">
              <Button variant="ghost" size="sm" className="text-red hover:bg-red-50" icon={<Trash2 aria-hidden className="size-4" />} onClick={() => setConfirm(true)}>
                Delete
              </Button>
              <Button size="sm" variant="dark" onClick={saveAlt} disabled={saving || !dirty} icon={saving ? <Loader2 aria-hidden className="size-4 animate-spin" /> : undefined}>
                Save description
              </Button>
            </div>
          ) : undefined
        }
      >
        {item && (
          <div className="p-5">
            <div className="flex aspect-[4/3] items-center justify-center overflow-hidden border border-line bg-[repeating-conic-gradient(#f5f5f5_0%_25%,#fff_0%_50%)] bg-[length:20px_20px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img loading="lazy" decoding="async" src={item.url} alt={item.alt ?? ""} className="max-h-full max-w-full object-contain" />
            </div>
            <p className="mt-4 break-all text-[14px] font-semibold">{item.filename}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px]">
              <div>
                <dt className="text-muted">Dimensions</dt>
                <dd className="num">{dims(item) ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Size</dt>
                <dd className="num">{fileSize(item.size)}</dd>
              </div>
              <div>
                <dt className="text-muted">Uploaded</dt>
                <dd>{formatDateTime(item.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-muted">By</dt>
                <dd className="truncate">{item.uploader ?? "—"}</dd>
              </div>
            </dl>

            <div className="mt-6">
              <label htmlFor="media-url" className="mb-2 block text-[12.5px] font-medium">
                Public link
              </label>
              <div className="flex gap-2">
                <input ref={urlInput} id="media-url" readOnly value={absolute(item.url)} onFocus={(e) => e.currentTarget.select()} className="h-10 min-w-0 flex-1 rounded-[3px] border border-line bg-mist px-3 font-mono text-[12px] text-ink/80 outline-none focus:border-ink" />
                <Button variant="outline" size="sm" className="h-10" onClick={copy} icon={copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}>
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-muted hover:text-ink">
                Open original <ExternalLink aria-hidden className="size-3.5" />
              </a>
            </div>

            <div className="mt-6">
              <label htmlFor="media-alt" className="mb-2 block text-[12.5px] font-medium">
                Description (alt text)
              </label>
              <textarea
                id="media-alt"
                value={alt}
                onChange={(e) => {
                  setAlt(e.target.value);
                  setAltError(null);
                }}
                maxLength={ALT_MAX + 50}
                rows={3}
                placeholder="e.g. Front three-quarter view of a red Hyundai Creta in our showroom"
                aria-invalid={altError ? true : undefined}
                className={cn("w-full rounded-[3px] border bg-white px-3 py-2.5 text-[14px] leading-relaxed outline-none transition-colors hover:border-ink/30 focus:border-ink", altError ? "border-red" : "border-line")}
              />
              <p className={cn("mt-1 flex justify-between gap-3 text-xs", altError ? "text-red" : "text-muted")}>
                <span>{altError ?? "Read aloud by screen readers and used by search engines."}</span>
                <span className="shrink-0 num">
                  {alt.trim().length}/{ALT_MAX}
                </span>
              </p>
            </div>

            <div className="mt-6">
              <p className="text-[12.5px] font-medium">Where it&rsquo;s used</p>
              {!used ? (
                <p className="mt-2 flex items-center gap-2 text-[12.5px] text-muted">
                  <Loader2 aria-hidden className="size-3.5 animate-spin" /> Checking…
                </p>
              ) : used.length === 0 ? (
                <p className="mt-2 text-[12.5px] text-muted">Not used in any of your vehicles, profile, showrooms or offers.</p>
              ) : (
                <ul className="mt-2 divide-y divide-line border border-line">
                  {used.map((u, i) => (
                    <li key={`${u.href}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2 text-[12.5px]">
                      <span className="min-w-0">
                        <span className="text-muted">{u.kind} · </span>
                        <span className="font-medium">{u.label}</span>
                      </span>
                      <Link href={u.href} className="shrink-0 font-medium text-red underline-offset-4 hover:underline">
                        Open
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={remove} busy={deleting} tone="danger" title="Delete this image?" confirmLabel="Delete image">
        {used && used.length > 0 ? (
          <>
            <p className="font-medium text-ink">
              It&rsquo;s used in {used.length} {used.length === 1 ? "place" : "places"} — {used.length === 1 ? "that spot" : "those spots"} will show a broken image:
            </p>
            <ul className="list-disc space-y-0.5 pl-5 text-[13px]">
              {used.slice(0, 6).map((u, i) => (
                <li key={i}>
                  {u.kind}: {u.label}
                </li>
              ))}
              {used.length > 6 && <li>and {used.length - 6} more</li>}
            </ul>
            <p>Replace it there first if you still need it. Deleting can&rsquo;t be undone.</p>
          </>
        ) : (
          <p>{used ? "It isn't used anywhere in your listings, profile or offers." : "We couldn't check where it's used yet."} Deleting can&rsquo;t be undone.</p>
        )}
      </ConfirmDialog>
    </>
  );
}
