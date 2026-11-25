"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import Link from "@/components/admin/desk";
import { AlertTriangle, BadgeCheck, Check, Copy, ExternalLink, ImageOff, Loader2, Lock, Pencil, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteMediaAction, mediaUsageAction, updateMediaAltAction } from "@/server/actions/media";
import { useUI } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { filterInput, formatDateTime, formatDay } from "./ui";
import { MediaDropzone, UploadQueue, checkerboard, copyText, dimensions, useMediaList, useMediaUploads } from "./media-client";
import { MEDIA_ALT_MAX, MEDIA_TYPES, formatBytes, previewUrl, type MediaCredit, type MediaItem, type MediaMime, type MediaPage, type MediaUsage } from "./media-shared";
import { sourceName } from "@/lib/photo-credits";

const typeLabel = (mime: string) => (MEDIA_TYPES[mime as MediaMime] ?? mime.replace(/^image\//, "")).toUpperCase();

/** The /admin/media page: upload, search, browse, edit alt text, copy links and delete. */
export function MediaLibrary({ initial, initialQuery }: { initial: MediaPage; initialQuery: string }) {
  const { toast } = useUI();
  const list = useMediaList({ ...initial, q: initialQuery });
  const uploads = useMediaUploads(list.prepend);
  const [open, setOpen] = useState<{ id: number; confirm: boolean } | null>(null);
  const selected = open ? (list.items.find((m) => m.id === open.id) ?? null) : null;
  const titleId = useId();

  const copy = async (m: MediaItem) => {
    const ok = await copyText(m.url);
    toast(ok ? `Copied ${m.url}` : "Couldn't copy — open the image and copy its URL from there.", { tone: ok ? "success" : "error" });
  };

  const search = (value: string) => {
    list.search(value);
    // Keep the search in the address bar so a refresh or shared link shows the same results.
    const q = value.trim();
    window.history.replaceState(null, "", q ? `?q=${encodeURIComponent(q)}` : window.location.pathname);
  };

  return (
    <div className="space-y-5">
      <MediaDropzone onFiles={uploads.add} />
      <UploadQueue tasks={uploads.tasks} onDismiss={uploads.dismiss} />

      <div className="flex flex-col gap-3 border border-line bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block sm:w-80">
          <span className="sr-only">Search by file name, alt text or photographer</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input type="search" value={list.q} onChange={(e) => search(e.target.value)} placeholder="Search file name, alt text or author…" className={cn(filterInput, "w-full pl-9")} />
        </label>
        <p className="flex items-center gap-2 px-1 text-[13px] text-muted num" aria-live="polite">
          {list.loading && <Loader2 aria-hidden className="size-3.5 animate-spin" />}
          {list.q.trim()
            ? `${list.total.toLocaleString("en-IN")} matching`
            : `${list.total.toLocaleString("en-IN")} ${list.total === 1 ? "image" : "images"}`}
        </p>
      </div>

      {list.error && <p className="border border-red/30 bg-red-50/50 px-4 py-3 text-[13.5px] text-red">{list.error}</p>}

      {list.items.length === 0 ? (
        <div className="border border-line bg-white px-6 py-16 text-center">
          <ImageOff aria-hidden className="mx-auto size-6 text-muted" />
          <p className="mt-3 text-[14px] text-muted">
            {list.loading ? "Searching…" : list.q.trim() ? `No images match “${list.q.trim()}”.` : "No images yet. Drop some above to get started."}
          </p>
        </div>
      ) : (
        <ul className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5", list.loading && "opacity-60 transition-opacity")}>
          {list.items.map((m) => (
            <li key={m.id} className="group flex min-w-0 flex-col border border-line bg-white">
              <button type="button" onClick={() => setOpen({ id: m.id, confirm: false })} className="relative block aspect-[4/3] overflow-hidden outline-offset-[-2px]" style={checkerboard}>
                <span className="sr-only">Open {m.filename}</span>
                {/* Library thumbnails of uploaded files — plain <img> on purpose. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl(m)} alt={m.alt ?? ""} loading="lazy" decoding="async" className="size-full object-contain transition-transform duration-300 group-hover:scale-[1.02]" />
                <span className="absolute left-2 top-2 rounded-full bg-ink/80 px-2 py-0.5 text-[10.5px] font-semibold tracking-wide text-white">{typeLabel(m.mime)}</span>
                {m.credit && (
                  <span title={`${m.credit.license} · ${m.credit.author}`} className="absolute right-2 top-2 inline-flex max-w-[60%] items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[10.5px] font-semibold text-ink">
                    <BadgeCheck aria-hidden className="size-3 shrink-0 text-red" />
                    <span className="truncate">{m.credit.license}</span>
                  </span>
                )}
              </button>
              <div className="flex min-w-0 flex-1 items-start gap-1 border-t border-line p-3 pr-1.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium" title={m.filename}>
                    {m.filename}
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted num">
                    {formatBytes(m.size)} · {dimensions(m)}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-muted" title={m.uploader ? `Uploaded by ${m.uploader}` : undefined}>
                    <time dateTime={m.createdAt} suppressHydrationWarning>
                      {formatDay(m.createdAt)}
                    </time>
                    {m.uploader && ` · ${m.uploader}`}
                  </p>
                  {m.credit && (
                    <p className="mt-0.5 truncate text-[12px] text-muted" title={`Photo: ${m.credit.author} · ${m.credit.license} · via ${sourceName(m.credit.sourceUrl)}`}>
                      Photo: {m.credit.author}
                    </p>
                  )}
                  {!m.alt && <p className="mt-1 text-[11.5px] font-medium text-[#9a5b00]">No alt text</p>}
                </div>
                <div className="-mt-1 flex shrink-0 flex-col">
                  <IconAction label={`Copy URL of ${m.filename}`} title="Copy URL" onClick={() => copy(m)}>
                    <Copy className="size-4" />
                  </IconAction>
                  <IconAction label={`Edit ${m.filename}`} title="Edit alt text" onClick={() => setOpen({ id: m.id, confirm: false })}>
                    <Pencil className="size-4" />
                  </IconAction>
                  <IconAction label={`Delete ${m.filename}`} title="Delete" danger onClick={() => setOpen({ id: m.id, confirm: true })}>
                    <Trash2 className="size-4" />
                  </IconAction>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {list.hasMore && (
        <div className="flex flex-col items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={list.loadMore} disabled={list.loadingMore} icon={list.loadingMore ? <Loader2 aria-hidden className="size-4 animate-spin" /> : undefined}>
            Load more
          </Button>
          <p className="text-[12.5px] text-muted num">
            Showing {list.items.length.toLocaleString("en-IN")} of {list.total.toLocaleString("en-IN")}
          </p>
        </div>
      )}

      <Modal
        open={selected !== null}
        onClose={() => setOpen(null)}
        labelledBy={titleId}
        title={
          <span id={titleId} className="block break-all text-[20px] leading-snug">
            {selected?.filename}
          </span>
        }
        size="xl"
      >
        {selected && (
          <MediaDetails
            key={selected.id}
            item={selected}
            confirmFirst={open?.confirm ?? false}
            onCopy={() => copy(selected)}
            onSaved={list.replace}
            onDeleted={(id) => {
              setOpen(null);
              list.remove(id);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function IconAction({ label, title, onClick, danger, children }: { label: string; title: string; onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={title}
      className={cn("inline-flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-mist hover:text-ink", danger && "hover:bg-red-50 hover:text-red")}
    >
      {children}
    </button>
  );
}

function MediaDetails({
  item,
  confirmFirst,
  onCopy,
  onSaved,
  onDeleted,
}: {
  item: MediaItem;
  confirmFirst: boolean;
  onCopy: () => void;
  onSaved: (item: MediaItem) => void;
  onDeleted: (id: number) => void;
}) {
  const { toast } = useUI();
  const altId = useId();
  const [alt, setAlt] = useState(item.alt ?? "");
  const [altError, setAltError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [usage, setUsage] = useState<MediaUsage[] | null>(null);
  const [usageFailed, setUsageFailed] = useState(false);
  const [confirming, setConfirming] = useState(confirmFirst);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let live = true;
    mediaUsageAction(item.id)
      .then((res) => {
        if (!live) return;
        if (res.ok) setUsage(res.usage);
        else setUsageFailed(true);
      })
      .catch(() => live && setUsageFailed(true));
    return () => {
      live = false;
    };
  }, [item.id]);

  const altChanged = alt.trim() !== (item.alt ?? "");

  const saveAlt = async () => {
    setSaving(true);
    const res = await updateMediaAltAction(item.id, alt).catch(() => ({ ok: false as const, error: "Couldn't reach the server." }));
    setSaving(false);
    if (!res.ok) {
      setAltError(res.error ?? "Couldn't save the alt text.");
      return;
    }
    setAltError(null);
    setAlt(res.item.alt ?? "");
    onSaved(res.item);
    toast("Alt text saved", { tone: "success" });
  };

  const remove = async () => {
    setDeleting(true);
    const res = await deleteMediaAction(item.id).catch(() => ({ ok: false as const, error: "Couldn't reach the server." }));
    if (!res.ok) {
      setDeleting(false);
      toast(res.error ?? "Couldn't delete the image.", { tone: "error" });
      return;
    }
    toast(`Deleted ${item.filename}`);
    onDeleted(item.id);
  };

  return (
    <div className="grid grid-cols-1 gap-6 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-h-48 items-center justify-center border border-line" style={checkerboard}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img loading="lazy" decoding="async" src={item.url} alt={alt} className="max-h-[56vh] w-auto max-w-full object-contain" />
      </div>

      <div className="min-w-0 space-y-5">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[13px]">
          <dt className="text-muted">Type</dt>
          <dd>{typeLabel(item.mime)}</dd>
          <dt className="text-muted">Size</dt>
          <dd className="num">{formatBytes(item.size)}</dd>
          <dt className="text-muted">Dimensions</dt>
          <dd className="num">{dimensions(item)} px</dd>
          <dt className="text-muted">Uploaded</dt>
          <dd suppressHydrationWarning>{formatDateTime(item.createdAt)}</dd>
          <dt className="text-muted">By</dt>
          <dd className="truncate">{item.uploader ?? (item.credit ? "Photo importer" : "—")}</dd>
        </dl>

        {item.credit && <CreditDetails credit={item.credit} />}

        <div>
          <p className="mb-2 text-[12.5px] font-medium">URL</p>
          <div className="flex gap-2">
            <input readOnly value={item.url} aria-label="Image URL" onFocus={(e) => e.target.select()} className={cn(filterInput, "min-w-0 flex-1 font-mono text-[12px]")} />
            <Button type="button" variant="outline" size="sm" className="h-10" onClick={onCopy} icon={<Copy aria-hidden className="size-4" />}>
              Copy
            </Button>
          </div>
          <a href={item.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-ink">
            Open original <ExternalLink aria-hidden className="size-3.5" />
          </a>
        </div>

        <div>
          <label htmlFor={altId} className="mb-2 block text-[12.5px] font-medium">
            Alt text
          </label>
          <textarea
            id={altId}
            rows={3}
            maxLength={MEDIA_ALT_MAX}
            value={alt}
            onChange={(e) => {
              setAlt(e.target.value);
              setAltError(null);
            }}
            placeholder="Describe the picture for people who can't see it"
            aria-invalid={altError ? true : undefined}
            className="w-full rounded-[3px] border border-line bg-white px-3 py-2.5 text-[13.5px] leading-relaxed outline-none transition-colors hover:border-ink/30 focus:border-ink aria-[invalid=true]:border-red"
          />
          <div className="mt-1.5 flex items-center justify-between gap-3">
            <p className={cn("text-[12px]", altError ? "text-red" : "text-muted")}>{altError ?? `${alt.length}/${MEDIA_ALT_MAX}`}</p>
            <Button type="button" size="sm" variant="dark" disabled={!altChanged || saving} onClick={saveAlt} icon={saving ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Check aria-hidden className="size-4" />}>
              Save alt text
            </Button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-[12.5px] font-medium">Used in</p>
          <UsageList usage={usage} failed={usageFailed} />
        </div>

        {confirming ? (
          <div role="alert" className="border border-red/40 bg-red-50/50 p-4">
            <p className="flex items-center gap-2 text-[14px] font-semibold">
              <AlertTriangle aria-hidden className="size-4 text-red" /> Delete this image?
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink/80">
              {usage === null && !usageFailed
                ? "Checking where it's used…"
                : usage?.length
                  ? `It's used in ${usage.length} ${usage.length === 1 ? "place" : "places"} (listed above). Those pages will show a broken image until you choose another picture.`
                  : usageFailed
                    ? "We couldn't check where it's used. Any page that shows it will show a broken image."
                    : "It isn't used by any car, used car, news story, brand, dealer, upcoming car or site content. Anything else linking to it will show a broken image."}
              {item.credit && " It's an imported catalogue photo: if its model's image file still lists it, the next `npm run db:import-images` downloads it again."}
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={remove}
                disabled={deleting || (usage === null && !usageFailed)}
                icon={deleting ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Trash2 aria-hidden className="size-4" />}
              >
                {usage?.length ? `Delete anyway` : "Delete image"}
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="inline-flex h-9 items-center gap-2 rounded-[3px] border border-line bg-white px-3.5 text-[13px] font-medium text-muted transition-colors hover:border-red hover:text-red"
          >
            <Trash2 aria-hidden className="size-4" /> Delete image
          </button>
        )}
      </div>
    </div>
  );
}

function UsageList({ usage, failed }: { usage: MediaUsage[] | null; failed: boolean }) {
  if (failed) return <p className="text-[13px] text-muted">Couldn&apos;t check right now.</p>;
  if (!usage)
    return (
      <p className="flex items-center gap-2 text-[13px] text-muted">
        <Loader2 aria-hidden className="size-3.5 animate-spin" /> Checking…
      </p>
    );
  if (!usage.length) return <p className="text-[13px] text-muted">Not used in any catalogue record or site content.</p>;
  return (
    <>
      <p className="mb-1.5 text-[13px] font-medium text-[#9a5b00] num">
        Used in {usage.length} {usage.length === 1 ? "place" : "places"}
      </p>
      <ul className="max-h-40 space-y-1 overflow-y-auto text-[13px]">
        {usage.map((u) => (
          <li key={u.href} className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 text-[11.5px] text-muted">{u.kind}</span>
            <Link href={u.href} className="truncate font-medium hover:text-red hover:underline">
              {u.label}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/** The licence credit of an imported photo — read-only: it comes from the photo's source page and the licence requires it. */
function CreditDetails({ credit }: { credit: MediaCredit }) {
  const ext = { target: "_blank", rel: "noopener noreferrer" } as const;
  const linkClass = "underline decoration-ink/25 underline-offset-4 hover:decoration-ink";
  return (
    <section aria-label="Photo credit" className="border border-line bg-mist/50 p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
        <Lock aria-hidden className="size-3" /> Credit · read-only
      </p>
      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[13px]">
        <dt className="text-muted">Author</dt>
        <dd className="min-w-0 break-words">
          {credit.authorUrl ? (
            <a href={credit.authorUrl} {...ext} className={linkClass}>
              {credit.author}
            </a>
          ) : (
            credit.author
          )}
        </dd>
        <dt className="text-muted">Licence</dt>
        <dd>
          {credit.licenseUrl ? (
            <a href={credit.licenseUrl} {...ext} className={linkClass}>
              {credit.license}
            </a>
          ) : (
            credit.license
          )}
        </dd>
        <dt className="text-muted">Source</dt>
        <dd className="min-w-0">
          <a href={credit.sourceUrl} {...ext} className={cn(linkClass, "inline-flex items-center gap-1")}>
            {sourceName(credit.sourceUrl)} file page <ExternalLink aria-hidden className="size-3" />
          </a>
        </dd>
        {credit.note && (
          <>
            <dt className="text-muted">Changes</dt>
            <dd>{credit.note}</dd>
          </>
        )}
      </dl>
      <p className="mt-3 text-[12px] leading-relaxed text-muted">
        Set by the photo importer from the photo&apos;s source page. The licence requires this credit on the site (car pages and /photo-credits), so it
        can&apos;t be edited here: correct it in <code className="text-[11.5px]">src/db/catalogue-data/images/&lt;brand&gt;.json</code> and run{" "}
        <code className="text-[11.5px]">npm run db:import-images</code>. Alt text stays editable.
      </p>
    </section>
  );
}
