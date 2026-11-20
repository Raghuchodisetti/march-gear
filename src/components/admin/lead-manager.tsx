"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquarePlus, Trash2 } from "lucide-react";
import { LEAD_STATUS, type LeadStatus } from "@/db/enums";
import { LEAD_STATUS_LABEL } from "@/lib/leads";
import { cn } from "@/lib/utils";
import { addLeadNoteAction, deleteLeadAction, updateLeadAction } from "@/server/actions/admin";
import { useUI } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/field";
import { Panel } from "./ui";

// A failed request must not leave the buttons stuck on "busy".
const OFFLINE = { ok: false as const, error: "Couldn't reach the server. Please try again." };

interface Note {
  id: number;
  kind: "note" | "status" | "assign";
  body: string;
  createdAt: string;
  authorName: string | null;
}

export function LeadManager({
  leadId,
  status: initialStatus,
  assignedTo: initialAssignee,
  staff,
  notes,
  canDelete,
}: {
  leadId: number;
  status: LeadStatus;
  assignedTo: number | null;
  staff: { id: number; name: string }[];
  notes: Note[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const { toast } = useUI();
  const [status, setStatus] = useState(initialStatus);
  const [assignee, setAssignee] = useState(initialAssignee ? String(initialAssignee) : "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"save" | "note" | "delete" | null>(null);
  const changed = status !== initialStatus || assignee !== (initialAssignee ? String(initialAssignee) : "");

  const save = async () => {
    setBusy("save");
    const res = await updateLeadAction(leadId, { status, assignedTo: assignee }).catch(() => OFFLINE);
    setBusy(null);
    if (!res.ok) return toast(res.error ?? "Couldn't update the lead", { tone: "error" });
    toast("Lead updated", { tone: "success" });
    router.refresh();
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    setBusy("note");
    const res = await addLeadNoteAction(leadId, note).catch(() => OFFLINE);
    setBusy(null);
    if (!res.ok) return toast(res.error ?? "Couldn't add the note", { tone: "error" });
    setNote("");
    router.refresh();
  };

  const remove = async () => {
    if (!window.confirm("Delete this lead and its notes? This can't be undone.")) return;
    setBusy("delete");
    const res = await deleteLeadAction(leadId).catch(() => OFFLINE);
    if (!res.ok) {
      setBusy(null);
      return toast(res.error ?? "Couldn't delete the lead", { tone: "error" });
    }
    toast("Lead deleted");
    router.replace("/admin/leads");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <Panel title="Manage">
        <div className="space-y-4">
          <SelectField label="Status" value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)} options={LEAD_STATUS.map((s) => ({ value: s, label: LEAD_STATUS_LABEL[s] }))} />
          <SelectField label="Owner" value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Unassigned" options={staff.map((s) => ({ value: String(s.id), label: s.name }))} />
          <Button className="w-full" onClick={save} disabled={!changed || busy !== null} icon={busy === "save" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
            Save changes
          </Button>
        </div>
      </Panel>

      <Panel title="Activity">
        <form onSubmit={addNote}>
          <label htmlFor="lead-note" className="sr-only">
            Add a note
          </label>
          <textarea
            id="lead-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Called, left a message…"
            className="w-full rounded-[3px] border border-line px-3 py-2.5 text-[14px] outline-none transition-colors hover:border-ink/30 focus:border-ink"
          />
          <Button type="submit" variant="outline" size="sm" className="mt-2" disabled={!note.trim() || busy !== null} icon={<MessageSquarePlus className="size-4" aria-hidden />}>
            Add note
          </Button>
        </form>
        <ol className="mt-5 space-y-4 border-t border-line pt-5">
          {notes.length === 0 && <li className="text-[13px] text-muted">No activity yet.</li>}
          {notes.map((n) => (
            <li key={n.id} className="relative pl-4">
              <span aria-hidden className={cn("absolute left-0 top-1.5 size-1.5 rounded-full", n.kind === "note" ? "bg-ink" : "bg-red")} />
              <p className={cn("whitespace-pre-line text-[13.5px] leading-relaxed", n.kind !== "note" && "text-muted")}>{n.body}</p>
              <p className="mt-0.5 text-[11.5px] text-muted">
                {n.authorName ?? "Staff"} · {n.createdAt}
              </p>
            </li>
          ))}
        </ol>
      </Panel>

      {canDelete && (
        <button type="button" onClick={remove} disabled={busy !== null} className="inline-flex items-center gap-2 text-[13px] font-medium text-muted transition-colors hover:text-red disabled:opacity-40">
          <Trash2 aria-hidden className="size-4" /> Delete lead
        </button>
      )}
    </div>
  );
}
