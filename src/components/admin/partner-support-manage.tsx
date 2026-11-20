"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { TICKET_PRIORITY, TICKET_STATUS, type TicketPriority, type TicketStatus } from "@/db/enums";
import type { ActionFailure } from "@/lib/action-result";
import { TICKET_PRIORITY_LABEL } from "@/partner/labels";
import { staffReplyTicketAction, staffUpdateTicketAction } from "@/server/actions/partner-support";
import { useUI } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/field";
import { MessageBox } from "@/components/portal/support/compose";
import { STAFF_TICKET_STATUS_LABEL } from "@/components/portal/support/shared";
import { Panel } from "./ui";

const OFFLINE: ActionFailure = { ok: false, error: "Couldn't reach the server. Please try again." };

/** Reply as MarchGear support. Staff can't attach files (uploads go through the dealer portal). */
export function StaffTicketReply({ ticketId, dealerName }: { ticketId: number; dealerName: string }) {
  const router = useRouter();
  const { toast } = useUI();
  const [message, setMessage] = useState("");
  const [after, setAfter] = useState<"awaiting_dealer" | "resolved" | "closed">("awaiting_dealer");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await staffReplyTicketAction(ticketId, { message, status: after }).catch(() => OFFLINE);
    setBusy(false);
    if (!res.ok) {
      setError(res.fieldErrors?.message);
      return toast(res.error ?? "Couldn't send the reply", { tone: "error" });
    }
    setMessage("");
    setError(undefined);
    toast(`Reply sent — ${dealerName} has been notified`, { tone: "success" });
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-4 border border-line bg-white p-5" noValidate>
      <MessageBox id="staff-reply" label={`Reply to ${dealerName}`} value={message} onChange={setMessage} error={error} rows={5} placeholder="Write your reply…" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <SelectField
          label="Then set the ticket to"
          className="sm:w-64"
          value={after}
          onChange={(e) => setAfter(e.target.value as typeof after)}
          options={(["awaiting_dealer", "resolved", "closed"] as const).map((s) => ({ value: s, label: STAFF_TICKET_STATUS_LABEL[s] }))}
        />
        <Button type="submit" disabled={busy || !message.trim()} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}>
          Send reply
        </Button>
      </div>
      <p className="text-[12px] text-muted">The dealer sees your first name with “MarchGear support”, and gets a portal notification. Attachments can only be added by the dealer.</p>
    </form>
  );
}

export function StaffTicketSettings({ ticketId, status: s0, priority: p0 }: { ticketId: number; status: TicketStatus; priority: TicketPriority }) {
  const router = useRouter();
  const { toast } = useUI();
  const [status, setStatus] = useState(s0);
  const [priority, setPriority] = useState(p0);
  const [busy, setBusy] = useState(false);
  const changed = status !== s0 || priority !== p0;

  const save = async () => {
    setBusy(true);
    const res = await staffUpdateTicketAction(ticketId, { status, priority }).catch(() => OFFLINE);
    setBusy(false);
    if (!res.ok) return toast(res.error ?? "Couldn't update the ticket", { tone: "error" });
    toast(status !== s0 ? "Ticket updated — the dealer has been notified" : "Ticket updated", { tone: "success" });
    router.refresh();
  };

  return (
    <Panel title="Manage">
      <div className="space-y-4">
        <SelectField label="Status" value={status} onChange={(e) => setStatus(e.target.value as TicketStatus)} options={TICKET_STATUS.map((v) => ({ value: v, label: STAFF_TICKET_STATUS_LABEL[v] }))} />
        <SelectField label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)} options={TICKET_PRIORITY.map((v) => ({ value: v, label: TICKET_PRIORITY_LABEL[v] }))} />
        <Button className="w-full" variant="dark" onClick={save} disabled={!changed || busy} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
          Save changes
        </Button>
      </div>
    </Panel>
  );
}
