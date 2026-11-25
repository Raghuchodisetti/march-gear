"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, LockOpen, Lock, Plus, Send, X } from "lucide-react";
import type { TicketPriority } from "@/db/enums";
import type { ActionFailure } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { TICKET_PRIORITY_LABEL } from "@/partner/labels";
import type { FileRef } from "@/partner/types";
import { createTicketAction, replyTicketAction, setTicketOpenAction } from "@/server/actions/partner-support";
import { useUI } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Label, SelectField, TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { DocumentUploader, fileSize, fileUrl } from "@/components/portal/uploader";
import { ConfirmDialog } from "@/components/portal/profile/kit";
import { PRIORITY_HINT, TICKET_CATEGORIES } from "./shared";

const OFFLINE: ActionFailure = { ok: false, error: "Couldn't reach the server. Please try again." };
const MAX_FILES = 5;

export function MessageBox({ id, label, value, onChange, error, placeholder, rows = 6 }: { id: string; label: string; value: string; onChange: (v: string) => void; error?: string; placeholder?: string; rows?: number }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
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
export function Attachments({ value, onChange, error }: { value: FileRef[]; onChange: (v: FileRef[]) => void; error?: string }) {
  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((f) => (
            <li key={f.id} className="flex items-center gap-3 rounded-[3px] border border-line bg-white px-3 py-2">
              <FileText className="size-4 shrink-0 text-red" aria-hidden />
              <a href={fileUrl(f)} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-[13px] font-medium hover:text-red">
                {f.filename}
              </a>
              <span className="shrink-0 text-[12px] text-muted">{fileSize(f.size)}</span>
              <button type="button" onClick={() => onChange(value.filter((x) => x.id !== f.id))} className="inline-flex size-7 items-center justify-center rounded-full text-muted hover:bg-mist hover:text-red" aria-label={`Remove ${f.filename}`}>
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {value.length < MAX_FILES ? (
        <DocumentUploader
          kind="ticket_attachment"
          value={null}
          onChange={(f) => f && onChange([...value, f])}
          label={value.length ? "Add another attachment" : "Attachments"}
          hint={`Screenshots or documents · up to ${MAX_FILES} files`}
          error={error}
        />
      ) : (
        <p className="text-[12px] text-muted">That&apos;s the maximum of {MAX_FILES} attachments.</p>
      )}
    </div>
  );
}

/**
 * "New ticket" and its compose modal. `prefill` opens it straight away with a category, subject and message —
 * e.g. /dealer/support?new=catalogue for "Request a new model" from the vehicle form.
 */
export function NewTicketButton({
  defaultCategory,
  label = "New ticket",
  prefill,
}: {
  defaultCategory?: string;
  label?: string;
  prefill?: { category: string; subject: string; message: string; closeHref: string };
}) {
  const router = useRouter();
  const { toast } = useUI();
  const [open, setOpenState] = useState(Boolean(prefill));
  const [subject, setSubject] = useState(prefill?.subject ?? "");
  const [category, setCategory] = useState(prefill?.category ?? defaultCategory ?? "");
  const [priority, setPriority] = useState<TicketPriority>("normal");
  const [message, setMessage] = useState(prefill?.message ?? "");
  // Closing a prefilled form drops the ?new= link so a refresh doesn't reopen it.
  const setOpen = (next: boolean) => {
    setOpenState(next);
    if (!next && prefill) router.replace(prefill.closeHref, { scroll: false });
  };
  const [files, setFiles] = useState<FileRef[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
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
    const res = await createTicketAction({ subject, category, priority, message, attachments: files.map((f) => f.id) }).catch(() => OFFLINE);
    setBusy(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      return toast(res.error ?? "Couldn't create the ticket", { tone: "error" });
    }
    setOpenState(false);
    setSubject("");
    setMessage("");
    setFiles([]);
    setErrors({});
    toast(`Ticket ${res.reference} raised — the MarchGear partner team will reply here.`, { tone: "success" });
    router.push(`/dealer/support/${res.id}`);
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} icon={<Plus className="size-4" aria-hidden />}>
        {label}
      </Button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title="New support ticket" description="Tell us what you need — the MarchGear partner team replies here and in your notifications." size="lg">
        <form onSubmit={submit} className="space-y-5 px-6 py-6 sm:px-8" noValidate>
          <TextField label="Subject" value={subject} onChange={(e) => {
              setSubject(e.target.value);
              clear("subject");
            }}
            error={errors.subject} placeholder="e.g. Listing stuck in pending approval" maxLength={200} data-autofocus />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Category" value={category} onChange={(e) => {
                setCategory(e.target.value);
                clear("category");
              }}
              placeholder="Choose a category" options={TICKET_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} error={errors.category} />
            <div>
              <SelectField
                label="Priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                options={(["low", "normal", "high", "urgent"] as const).map((p) => ({ value: p, label: TICKET_PRIORITY_LABEL[p] }))}
                error={errors.priority}
              />
              {!errors.priority && <p className="mt-1.5 text-xs text-muted">{PRIORITY_HINT[priority]}</p>}
            </div>
          </div>
          <MessageBox
            id="ticket-message"
            label="Message"
            value={message}
            onChange={(v) => {
              setMessage(v);
              clear("message");
            }} error={errors.message} placeholder="What happened, what you expected, and any reference numbers (vehicle, offer, invoice)…" />
          <Attachments value={files} onChange={setFiles} error={errors.attachments} />
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}>
              Raise ticket
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function TicketReply({ ticketId, closed }: { ticketId: number; closed: boolean }) {
  const router = useRouter();
  const { toast } = useUI();
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<FileRef[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"reply" | "toggle" | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  const reply = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("reply");
    const res = await replyTicketAction(ticketId, { message, attachments: files.map((f) => f.id) }).catch(() => OFFLINE);
    setBusy(null);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      return toast(res.error ?? "Couldn't send the reply", { tone: "error" });
    }
    setMessage("");
    setFiles([]);
    setErrors({});
    toast("Reply sent", { tone: "success" });
    router.refresh();
  };

  const toggle = async () => {
    setBusy("toggle");
    const res = await setTicketOpenAction(ticketId, closed).catch(() => OFFLINE);
    setBusy(null);
    setConfirmClose(false);
    if (!res.ok) return toast(res.error ?? "Couldn't update the ticket", { tone: "error" });
    toast(closed ? "Ticket reopened" : "Ticket closed", { tone: "success" });
    router.refresh();
  };

  if (closed)
    return (
      <div className="flex flex-col gap-3 border border-dashed border-line bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[14px] text-muted">This ticket is closed. Reopen it to send another message.</p>
        <Button variant="outline" size="sm" onClick={toggle} disabled={busy !== null} icon={busy === "toggle" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LockOpen className="size-4" aria-hidden />}>
          Reopen ticket
        </Button>
      </div>
    );

  return (
    <form onSubmit={reply} className="space-y-4 border border-line bg-white p-5" noValidate>
      <MessageBox
        id="ticket-reply"
        label="Your reply"
        value={message}
        onChange={(v) => {
          setMessage(v);
          setErrors({});
        }} error={errors.message} rows={4} placeholder="Add details or answer the team's question…" />
      <Attachments value={files} onChange={setFiles} error={errors.attachments} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" size="sm" onClick={() => setConfirmClose(true)} disabled={busy !== null} icon={<Lock className="size-4" aria-hidden />}>
          Close ticket
        </Button>
        <Button type="submit" disabled={busy !== null || !message.trim()} icon={busy === "reply" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}>
          Send reply
        </Button>
      </div>
      <ConfirmDialog
        open={confirmClose}
        onClose={() => busy === null && setConfirmClose(false)}
        title="Close this ticket?"
        body="You can reopen it any time if you need more help."
        confirm="Close ticket"
        busy={busy === "toggle"}
        onConfirm={toggle}
      />
    </form>
  );
}
