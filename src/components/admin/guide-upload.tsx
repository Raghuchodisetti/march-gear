"use client";

import { useId, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useDeskHref, useDeskRouter as useRouter } from "@/components/admin/desk";
import { FileText, Loader2, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { useUI } from "@/components/providers/app-provider";
import { GUIDE_PDF_MAX_BYTES, GUIDE_MAX_PAGES, GUIDE_SUBJECT_MAX, GUIDE_TITLE_MAX, formatMB } from "@/lib/guides";

type UploadResult = { ok: true; id: number; slug: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };
type Stage = { kind: "idle" } | { kind: "uploading"; pct: number } | { kind: "reading" };

/** Sends the form to the guides upload route (this desk's) with upload progress (fetch can't report it). */
function send(url: string, form: FormData, onProgress: (pct: number) => void, onSent: () => void) {
  return new Promise<UploadResult>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.upload.onload = onSent;
    xhr.onload = () => resolve((xhr.response as UploadResult | null) ?? { ok: false, error: `The server answered ${xhr.status}. Please try again.` });
    xhr.onerror = () => resolve({ ok: false, error: "Couldn't reach the server. Check your connection and try again." });
    xhr.send(form);
  });
}

function PdfDrop({ file, onFile, error, label = "PDF", hint }: { file: File | null; onFile: (f: File | null) => void; error?: string; label?: string; hint?: string }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  };
  return (
    <div>
      <p className="mb-2 block text-[12.5px] font-medium text-ink" id={`${id}-label`}>
        {label}
      </p>
      {file ? (
        <div className={cn("flex items-center gap-3 rounded-[3px] border bg-mist/40 px-4 py-3.5", error ? "border-red" : "border-line")}>
          <FileText aria-hidden className="size-5 shrink-0 text-red" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium">{file.name}</p>
            <p className="text-[12px] text-muted num">{formatMB(file.size)}</p>
          </div>
          <button type="button" onClick={() => onFile(null)} className="inline-flex size-8 items-center justify-center rounded-[3px] text-muted hover:bg-white hover:text-ink" aria-label="Remove this file">
            <X aria-hidden className="size-4" />
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={drop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[3px] border border-dashed px-6 py-10 text-center transition-colors hover:border-ink/40",
            over ? "border-ink bg-mist" : error ? "border-red" : "border-line",
          )}
        >
          <UploadCloud aria-hidden className="size-7 text-muted" />
          <span className="text-[14px] font-medium">Drop the PDF here, or choose a file</span>
          <span className="text-[12.5px] text-muted">
            PDF with selectable text · up to {formatMB(GUIDE_PDF_MAX_BYTES)} and {GUIDE_MAX_PAGES} pages
          </span>
        </label>
      )}
      <input
        ref={input}
        id={id}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        aria-labelledby={`${id}-label`}
        aria-invalid={error ? true : undefined}
        onChange={(e) => {
          onFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      {(error || hint) && <p className={cn("mt-1.5 text-xs", error ? "text-red" : "text-muted")}>{error ?? hint}</p>}
    </div>
  );
}

function stageText(stage: Stage) {
  if (stage.kind === "uploading") return stage.pct < 100 ? `Uploading… ${stage.pct}%` : "Uploading…";
  if (stage.kind === "reading") return "Reading the PDF and building the page…";
  return null;
}

/** New guide: subject, topic name and the PDF whose text becomes the page. */
export function GuideUploadForm({ subjects }: { subjects: string[] }) {
  const router = useRouter();
  const deskHref = useDeskHref();
  const { toast } = useUI();
  const listId = useId();
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [publish, setPublish] = useState(true);
  const [showPdf, setShowPdf] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const busy = stage.kind !== "idle";
  const clearError = (key: string) =>
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!subject.trim()) local.subject = "Enter the subject";
    if (!title.trim()) local.title = "Enter the topic name";
    if (!file) local.file = "Choose the PDF to upload";
    else if (file.size > GUIDE_PDF_MAX_BYTES) local.file = `${formatMB(file.size)} is over the ${formatMB(GUIDE_PDF_MAX_BYTES)} limit`;
    else if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") local.file = "Choose a PDF file";
    setErrors(local);
    if (Object.keys(local).length) return;

    const form = new FormData();
    form.set("subject", subject.trim());
    form.set("title", title.trim());
    form.set("status", publish ? "published" : "draft");
    form.set("showPdf", String(showPdf));
    form.set("file", file!);
    setStage({ kind: "uploading", pct: 0 });
    const res = await send(
      deskHref("/admin/guides/upload"),
      form,
      (pct) => setStage({ kind: "uploading", pct }),
      () => setStage({ kind: "reading" }),
    );
    if (!res.ok) {
      setStage({ kind: "idle" });
      setErrors(res.fieldErrors ?? {});
      toast(res.error, { tone: "error" });
      return;
    }
    toast(publish ? "Guide published" : "Guide saved as a draft", { tone: "success" });
    router.push(`/admin/guides/${res.id}?created=1`);
  };

  return (
    <form onSubmit={submit} noValidate className="max-w-3xl space-y-6">
      <section className="border border-line bg-white">
        <header className="border-b border-line px-5 py-4 md:px-6">
          <h2 className="text-[15px] font-semibold">Topic</h2>
          <p className="mt-0.5 text-[13px] text-muted">Guides are grouped by subject on /guides. Each topic gets its own page and link.</p>
        </header>
        <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2 md:p-6">
          <div>
            <TextField
              label="Subject"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                clearError("subject");
              }}
              list={subjects.length ? listId : undefined}
              placeholder="e.g. Car buying"
              maxLength={GUIDE_SUBJECT_MAX}
              error={errors.subject}
              hint={subjects.length ? "Pick an existing subject or type a new one." : "The group this topic belongs to."}
              disabled={busy}
              autoComplete="off"
            />
            {subjects.length > 0 && (
              <datalist id={listId}>
                {subjects.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            )}
          </div>
          <TextField
            label="Topic name"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              clearError("title");
            }}
            placeholder="e.g. How to read an on-road price"
            maxLength={GUIDE_TITLE_MAX}
            error={errors.title}
            hint="The page's heading. Its link is made from it, e.g. /guides/how-to-read-an-on-road-price."
            disabled={busy}
          />
          <div className="sm:col-span-2">
            <PdfDrop
              file={file}
              onFile={(f) => {
                setFile(f);
                clearError("file");
              }}
              error={errors.file}
              hint="All of its text becomes the page: headings, paragraphs, lists and tables. Pictures stay in the PDF."
            />
          </div>
        </div>
      </section>

      <section className="border border-line bg-white">
        <header className="border-b border-line px-5 py-4 md:px-6">
          <h2 className="text-[15px] font-semibold">Publishing</h2>
        </header>
        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 md:p-6">
          {[
            { on: publish, set: setPublish, label: "Publish now", hint: "Goes live on /guides straight away. Untick to save it as a draft and review it first." },
            { on: showPdf, set: setShowPdf, label: "Offer the PDF as a download", hint: "Adds a “Download PDF” button — useful when the PDF has pictures or diagrams." },
          ].map((o) => (
            <label key={o.label} className="flex cursor-pointer items-start gap-3 rounded-[3px] border border-line px-4 py-3.5 transition-colors hover:border-ink/30">
              <input type="checkbox" checked={o.on} onChange={(e) => o.set(e.target.checked)} disabled={busy} className="mt-0.5 size-4 accent-[var(--color-red)]" />
              <span>
                <span className="block text-[14px] font-medium">{o.label}</span>
                <span className="mt-0.5 block text-[12.5px] text-muted">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={busy} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <UploadCloud className="size-4" aria-hidden />}>
          {busy ? "Creating…" : "Create topic page"}
        </Button>
        <Button href="/admin/guides" variant="ghost">
          Cancel
        </Button>
        <p className="text-[13px] text-muted" aria-live="polite">
          {stageText(stage)}
        </p>
      </div>
    </form>
  );
}

/** Edit page: replace the guide's PDF (and the page text read from it). */
export function GuidePdfReplace({ guideId }: { guideId: number }) {
  const router = useRouter();
  const deskHref = useDeskHref();
  const { toast } = useUI();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>();
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const busy = stage.kind !== "idle";

  const replace = async () => {
    if (!file) return setError("Choose the new PDF");
    if (file.size > GUIDE_PDF_MAX_BYTES) return setError(`${formatMB(file.size)} is over the ${formatMB(GUIDE_PDF_MAX_BYTES)} limit`);
    if (!window.confirm("Replace the PDF? The page text is rebuilt from the new PDF, and any edits you made to the text are lost.")) return;
    const form = new FormData();
    form.set("id", String(guideId));
    form.set("file", file);
    setStage({ kind: "uploading", pct: 0 });
    const res = await send(
      deskHref("/admin/guides/upload"),
      form,
      (pct) => setStage({ kind: "uploading", pct }),
      () => setStage({ kind: "reading" }),
    );
    setStage({ kind: "idle" });
    if (!res.ok) {
      setError(res.fieldErrors?.file ?? res.error);
      toast(res.error, { tone: "error" });
      return;
    }
    setFile(null);
    setError(undefined);
    toast("PDF replaced — the page text was rebuilt from it", { tone: "success" });
    // The editor is keyed on the guide's update time, so it remounts with the new text.
    router.refresh();
  };

  return (
    <div className="space-y-3">
      <PdfDrop
        file={file}
        onFile={(f) => {
          setFile(f);
          setError(undefined);
        }}
        error={error}
        label="Replace the PDF"
        hint="Rebuilds the page text from the new PDF."
      />
      {file && (
        <Button type="button" size="sm" variant="dark" onClick={replace} disabled={busy} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <UploadCloud className="size-4" aria-hidden />}>
          {busy ? stageText(stage) : "Replace and rebuild"}
        </Button>
      )}
    </div>
  );
}
