"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Send, StickyNote } from "lucide-react";
import { TICKET_PRIORITY, TICKET_STATUS, type TicketPriority, type TicketStatus } from "@/db/enums";
import type { ActionFailure } from "@/lib/action-result";
import { TICKET_PRIORITY_LABEL } from "@/partner/labels";
import { addInsTicketNoteAction, staffReplyInsTicketAction, staffUpdateInsTicketAction } from "@/server/actions/admin-insurance-support";
import { useUI } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/field";
import { MessageBox } from "@/components/portal/support/compose";
import { Panel } from "@/components/admin/ui";
import { INS_TICKET_STATUS_LABEL, VENDOR_TICKET_STATUS_LABEL } from "../ops/labels";

/* Staff side of an insurance vendor's support ticket: reply, status/priority, internal notes. */

const OFFLINE: ActionFailure = { ok: false, error: "Couldn't reach the server. Please try again." };
const spin = <Loader2 className="size-4 animate-spin" aria-hidden />;

export function InsTicketReply({ ticketId, vendorName }: { ticketId: number; vendorName: string }) {
  const router = useRouter();
  const { toast } = useUI();
  const [message, setMessage] = useState("");
  const [after, setAfter] = useState<"awaiting_dealer" | "resolved" | "closed">("awaiting_dealer");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await staffReplyInsTicketAction(ticketId, { message, status: after }).catch(() => OFFLINE);
    setBusy(false);
    if (!res.ok) {
      setError(res.fieldErrors?.message);
      return toast(res.error ?? "Couldn't send the reply", { tone: "error" });
    }
    setMessage("");
    setError(undefined);
    toast(`Reply sent — ${vendorName} has been notified`, { tone: "success" });
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-4 border border-line bg-white p-5" noValidate>
      <MessageBox
        id="ins-staff-reply"
        label={`Reply to ${vendorName}`}
        value={message}
        onChange={(v) => {
          setMessage(v);
          setError(undefined);
        }}
        error={error}
        rows={5}
        placeholder="Write your reply…"
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="sm:w-64">
          <SelectField
            label="Then set the ticket to"
            value={after}
            onChange={(e) => setAfter(e.target.value as typeof after)}
            options={(["awaiting_dealer", "resolved", "closed"] as const).map((s) => ({ value: s, label: INS_TICKET_STATUS_LABEL[s] }))}
          />
          <p className="mt-1.5 text-xs text-muted">The vendor sees “{VENDOR_TICKET_STATUS_LABEL[after]}”.</p>
        </div>
        <Button type="submit" className="sm:mt-[26px]" disabled={busy || !message.trim()} icon={busy ? spin : <Send className="size-4" aria-hidden />}>
          Send reply
        </Button>
      </div>
      <p className="text-[12px] text-muted">The vendor sees your name with “MarchGear support” and gets a portal notification. Only the vendor can attach files.</p>
    </form>
  );
}

export function InsTicketSettings({ ticketId, status: s0, priority: p0 }: { ticketId: number; status: TicketStatus; priority: TicketPriority }) {
  const router = useRouter();
  const { toast } = useUI();
  const [status, setStatus] = useState(s0);
  const [priority, setPriority] = useState(p0);
  const [busy, setBusy] = useState(false);
  const changed = status !== s0 || priority !== p0;

  const save = async () => {
    setBusy(true);
    const res = await staffUpdateInsTicketAction(ticketId, { status: status !== s0 ? status : undefined, priority: priority !== p0 ? priority : undefined }).catch(() => OFFLINE);
    setBusy(false);
    if (!res.ok) return toast(res.error ?? "Couldn't update the ticket", { tone: "error" });
    toast(status !== s0 ? "Ticket updated — the vendor has been notified" : "Priority updated", { tone: "success" });
    router.refresh();
  };

  return (
    <Panel title="Manage">
      <div className="space-y-4">
        <SelectField label="Status" value={status} onChange={(e) => setStatus(e.target.value as TicketStatus)} options={TICKET_STATUS.map((v) => ({ value: v, label: INS_TICKET_STATUS_LABEL[v] }))} />
        <SelectField label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)} options={TICKET_PRIORITY.map((v) => ({ value: v, label: TICKET_PRIORITY_LABEL[v] }))} />
        <Button className="w-full" variant="dark" onClick={save} disabled={!changed || busy} icon={busy ? spin : undefined}>
          Save changes
        </Button>
        <p className="text-[12px] text-muted">Changing the status notifies the vendor. Priority changes are internal.</p>
      </div>
    </Panel>
  );
}

export interface TicketNote {
  id: number;
  summary: string;
  by: string | null;
  at: string;
}

export function InsTicketNotes({ ticketId, notes }: { ticketId: number; notes: TicketNote[] }) {
  const router = useRouter();
  const { toast } = useUI();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const add = async () => {
    setBusy(true);
    const res = await addInsTicketNoteAction(ticketId, { note }).catch(() => OFFLINE);
    setBusy(false);
    if (!res.ok) {
      setError(res.fieldErrors?.note);
      return toast(res.error ?? "Couldn't save the note", { tone: "error" });
    }
    setNote("");
    setError(undefined);
    toast("Internal note added", { tone: "success" });
    router.refresh();
  };

  return (
    <Panel
      title={
        <span className="inline-flex items-center gap-2">
          Internal handling <Lock aria-hidden className="size-3.5 text-muted" />
        </span>
      }
    >
      <p className="mb-3 text-[12.5px] text-muted">Staff-only notes — never shown to the vendor.</p>
      {notes.length > 0 && (
        <ol className="mb-4 space-y-2.5">
          {notes.map((n) => (
            <li key={n.id} className="rounded-[3px] border border-dashed border-ink/20 bg-mist/50 px-3 py-2.5">
              <p className="whitespace-pre-line break-words text-[13px] leading-relaxed">{n.summary}</p>
              <p className="mt-1 text-[11.5px] text-muted">
                {n.by ?? "Staff"} · {n.at}
              </p>
            </li>
          ))}
        </ol>
      )}
      <div className="space-y-3">
        <div>
          <label htmlFor="ins-ticket-note" className="sr-only">
            Internal note
          </label>
          <textarea
            id="ins-ticket-note"
            rows={3}
            maxLength={300}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setError(undefined);
            }}
            aria-invalid={error ? true : undefined}
            placeholder="e.g. Checked with accounts — UTR matches 14 Nov credit."
            className="w-full rounded-[3px] border border-line bg-white px-3.5 py-2.5 text-[13.5px] leading-relaxed outline-none transition-colors hover:border-ink/30 focus:border-ink aria-[invalid=true]:border-red"
          />
          <p className={error ? "mt-1 text-xs text-red" : "mt-1 text-right text-[11.5px] text-muted num"}>{error ?? `${note.length}/300`}</p>
        </div>
        <Button variant="outline" size="sm" className="w-full" onClick={add} disabled={busy || note.trim().length < 3} icon={busy ? spin : <StickyNote className="size-4" aria-hidden />}>
          Add internal note
        </Button>
      </div>
    </Panel>
  );
}
