"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText, Loader2, RotateCcw, Send, X } from "lucide-react";
import type { TicketPriority, TicketStatus } from "@/db/enums";
import type { ActionFailure } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import type { FileRef } from "@/partner/types";
import { createInsTicketAction, reopenInsTicketAction, replyInsTicketAction, resolveInsTicketAction } from "@/server/actions/ins-support";
import { useUI } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Label, SelectField, TextField } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/portal/profile/kit";
import { InsDocumentUploader, fileSize, insFileUrl } from "@/components/insurance/vendor/uploader";
import { INS_PRIORITY_HINT, INS_TICKET_CATEGORIES, INS_TICKET_PRIORITY_LABEL, MAX_TICKET_FILES } from "./shared";
import { useUploadWatch } from "./upload-watch";

/* Raising a support ticket and replying on one (vendor side). */

const OFFLINE: ActionFailure = { ok: false, error: "Couldn't reach the server. Please try again." };

function MessageBox({ id, label, value, onChange, error, placeholder, rows = 6 }: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string; placeholder?: string; rows?: number }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <Label htmlFor={id} className="mb-0">
          {label}
        </Label>
        <span className={cn("text-[11.5px] num", value.length > 4500 ? "text-[#9a5b00]" : "text-muted")}>{value.length} / 5000</span>
      </div>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        maxLength={5000}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        className={cn(
          "w-full rounded-[3px] border bg-white px-4 py-3 text-[14.5px] leading-relaxed outline-none transition-colors placeholder:text-muted hover:border-ink/30 focus:border-ink",
          error ? "border-red" : "border-line",
        )}
      />
      {error && <p className="mt-1.5 text-xs text-red">{error}</p>}
    </div>
  );
}

/** Up to five private attachments (ticket_attachment) — uploaded straight away, sent with the message. */
function Attachments({ value, onChange, error, watchRef }: { value: FileRef[]; onChange: (v: FileRef[]) => void; error?: string; watchRef: (el: HTMLElement | null) => void }) {
  return (
    <div ref={watchRef} className="space-y-2">
      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((f) => (
            <li key={f.id} className="flex min-w-0 items-center gap-3 rounded-[3px] border border-line bg-white px-3 py-2">
              <FileText className="size-4 shrink-0 text-red" aria-hidden />
              <a href={insFileUrl(f)} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-[13px] font-medium hover:text-red">
                {f.filename}
              </a>
              <span className="shrink-0 text-[12px] text-muted">{fileSize(f.size)}</span>
              <button type="button" onClick={() => onChange(value.filter((x) => x.id !== f.id))} className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-mist hover:text-red" aria-label={`Remove ${f.filename}`}>
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {value.length < MAX_TICKET_FILES ? (
        <InsDocumentUploader
          kind="ticket_attachment"
          value={null}
          onChange={(f) => f && onChange([...value, f])}
          label={value.length ? "Add another attachment" : "Attachments"}
          hint={`Screenshots or documents · up to ${MAX_TICKET_FILES} files`}
          error={error}
        />
      ) : (
        <p className="text-[12px] text-muted">That&apos;s the maximum of {MAX_TICKET_FILES} attachments.</p>
      )}
    </div>
  );
}

/** The full-page "new ticket" form. */
export function NewInsTicketForm({ defaultCategory }: { defaultCategory?: string }) {
  const router = useRouter();
  const { toast } = useUI();
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState(INS_TICKET_CATEGORIES.some((c) => c.value === defaultCategory) ? defaultCategory! : "");
  const [priority, setPriority] = useState<TicketPriority>("normal");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<FileRef[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const { ref: watchRef, uploading } = useUploadWatch();
  const clear = (k: string) =>
    setErrors((e) => {
      if (!(k in e)) return e;
      const next = { ...e };
      delete next[k];
      return next;
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await createInsTicketAction({ subject, category, priority, message, attachments: files.map((f) => f.id) }).catch(() => OFFLINE);
    if (!res.ok) {
      setBusy(false);
      setErrors(res.fieldErrors ?? {});
      return toast(res.error ?? "Couldn't create the ticket", { tone: "error" });
    }
    toast(`Ticket ${res.reference} raised — MarchGear's vendor team will reply here.`, { tone: "success" });
    router.push(`/insurance-vendor/support/${res.id}`);
  };

  return (
    <form onSubmit={submit} className="space-y-5 border border-line bg-white p-5 sm:p-7" noValidate>
      <TextField
        label="Subject"
        value={subject}
        onChange={(e) => {
          setSubject(e.target.value);
          clear("subject");
        }}
        error={errors.subject}
        placeholder="e.g. Product stuck in pending approval"
        maxLength={200}
        autoFocus
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Category"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            clear("category");
          }}
          placeholder="Choose a category"
          options={INS_TICKET_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
          error={errors.category}
        />
        <div>
          <SelectField
            label="Priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TicketPriority)}
            options={(["low", "normal", "high", "urgent"] as const).map((p) => ({ value: p, label: INS_TICKET_PRIORITY_LABEL[p] }))}
            error={errors.priority}
          />
          {!errors.priority && <p className="mt-1.5 text-xs text-muted">{INS_PRIORITY_HINT[priority]}</p>}
        </div>
      </div>
      <MessageBox
        id="ticket-message"
        label="Message"
        value={message}
        onChange={(v) => {
          setMessage(v);
          clear("message");
        }}
        error={errors.message}
        rows={7}
        placeholder="What happened, what you expected, and any reference numbers (product, enquiry, invoice, campaign)…"
      />
      <Attachments
        value={files}
        onChange={(v) => {
          setFiles(v);
          clear("attachments");
        }}
        error={errors.attachments}
        watchRef={watchRef}
      />
      <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
        <Button href="/insurance-vendor/support" variant="ghost">
          Cancel
        </Button>
        <Button type="submit" disabled={busy || uploading} icon={busy || uploading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}>
          {uploading ? "Uploading…" : "Raise ticket"}
        </Button>
      </div>
    </form>
  );
}

/** Reply box + resolve / reopen on a ticket. */
export function InsTicketReply({ ticketId, status }: { ticketId: number; status: TicketStatus }) {
  const router = useRouter();
  const { toast } = useUI();
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<FileRef[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"reply" | "resolve" | "reopen" | null>(null);
  const [confirmResolve, setConfirmResolve] = useState(false);
  const { ref: watchRef, uploading } = useUploadWatch();
  const finished = status === "resolved" || status === "closed";

  const reply = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("reply");
    const res = await replyInsTicketAction(ticketId, { message, attachments: files.map((f) => f.id) }).catch(() => OFFLINE);
    setBusy(null);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      return toast(res.error ?? "Couldn't send the reply", { tone: "error" });
    }
    setMessage("");
    setFiles([]);
    setErrors({});
    toast(status === "resolved" ? "Reply sent — the ticket is open again" : "Reply sent", { tone: "success" });
    router.refresh();
  };

  const act = async (what: "resolve" | "reopen") => {
    setBusy(what);
    const res = await (what === "resolve" ? resolveInsTicketAction(ticketId) : reopenInsTicketAction(ticketId)).catch(() => OFFLINE);
    setBusy(null);
    setConfirmResolve(false);
    if (!res.ok) return toast(res.error ?? "Couldn't update the ticket", { tone: "error" });
    toast(what === "resolve" ? "Marked as resolved — thanks for letting us know" : "Ticket reopened", { tone: "success" });
    router.refresh();
  };

  if (status === "closed")
    return (
      <div className="flex flex-col gap-3 border border-dashed border-line bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[14px] text-muted">This ticket is closed. Reopen it to send another message.</p>
        <Button variant="outline" size="sm" onClick={() => act("reopen")} disabled={busy !== null} icon={busy === "reopen" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RotateCcw className="size-4" aria-hidden />}>
          Reopen ticket
        </Button>
      </div>
    );

  return (
    <form onSubmit={reply} className="space-y-4 border border-line bg-white p-5" noValidate>
      {finished && (
        <div className="flex flex-col gap-3 rounded-[3px] bg-[#e8f5ec] px-4 py-3 text-[13.5px] text-[#1e5c33] sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden /> Resolved. Replying reopens the ticket.
          </p>
          <Button variant="outline" size="sm" onClick={() => act("reopen")} disabled={busy !== null} icon={busy === "reopen" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RotateCcw className="size-4" aria-hidden />}>
            Reopen
          </Button>
        </div>
      )}
      <MessageBox
        id="ticket-reply"
        label="Your reply"
        value={message}
        onChange={(v) => {
          setMessage(v);
          setErrors((e) => (e.message ? { ...e, message: "" } : e));
        }}
        error={errors.message || undefined}
        rows={4}
        placeholder="Add details or answer the team's question…"
      />
      <Attachments value={files} onChange={setFiles} error={errors.attachments} watchRef={watchRef} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        {!finished ? (
          <Button variant="ghost" size="sm" onClick={() => setConfirmResolve(true)} disabled={busy !== null} icon={<CheckCircle2 className="size-4" aria-hidden />}>
            Mark as resolved
          </Button>
        ) : (
          <span />
        )}
        <Button
          type="submit"
          disabled={busy !== null || uploading || message.trim().length < 2}
          icon={busy === "reply" || uploading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
        >
          {uploading ? "Uploading…" : "Send reply"}
        </Button>
      </div>
      <ConfirmDialog
        open={confirmResolve}
        onClose={() => busy === null && setConfirmResolve(false)}
        title="Mark this ticket as resolved?"
        body="Let MarchGear know you're sorted. You can reopen it any time if you need more help."
        confirm="Mark resolved"
        busy={busy === "resolve"}
        onConfirm={() => act("resolve")}
      />
    </form>
  );
}
