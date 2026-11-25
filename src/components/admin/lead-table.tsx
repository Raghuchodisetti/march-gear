"use client";

import { useEffect, useRef, useState } from "react";
import Link from "@/components/admin/desk";
import { useDeskRouter as useRouter } from "@/components/admin/desk";
import { Loader2 } from "lucide-react";
import { LEAD_STATUS, type LeadStatus } from "@/db/enums";
import { LEAD_STATUS_LABEL, LEAD_STATUS_TONE } from "@/lib/leads";
import { bulkDeleteLeadsAction, bulkUpdateLeadsAction } from "@/server/actions/admin";
import { useUI } from "@/components/providers/app-provider";
import { Badge, EmptyRow, Table, Td, Th, filterInput } from "./ui";
import { cn } from "@/lib/utils";

export interface LeadListRow {
  id: number;
  reference: string;
  typeLabel: string;
  status: LeadStatus;
  name: string | null;
  contact: string;
  about: string;
  city: string | null;
  received: string;
  assigneeName: string | null;
}

const checkbox = "size-4 cursor-pointer accent-[var(--color-red)] align-middle";

/** The leads list with row checkboxes and bulk status / owner / delete actions for the selected rows. */
export function LeadTable({ rows, staff, canDelete, emptyText }: { rows: LeadListRow[]; staff: { id: number; name: string }[]; canDelete: boolean; emptyText: string }) {
  const router = useRouter();
  const { toast } = useUI();
  const [picked, setPicked] = useState<number[]>([]);
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const allRef = useRef<HTMLInputElement>(null);

  // Only rows still on this page count (a refresh may have removed some).
  const selected = picked.filter((id) => rows.some((r) => r.id === id));
  const all = rows.length > 0 && selected.length === rows.length;
  const some = selected.length > 0 && !all;
  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = some;
  }, [some]);

  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleAll = () => setPicked(all ? [] : rows.map((r) => r.id));
  const plural = (n: number) => `${n} ${n === 1 ? "lead" : "leads"}`;

  const apply = async () => {
    if (!choice || !selected.length) return;
    const [op, value] = choice.split(":");
    if (op === "delete" && !window.confirm(`Delete ${plural(selected.length)} and their notes? This can't be undone.`)) return;
    setBusy(true);
    const res = await (op === "delete"
      ? bulkDeleteLeadsAction(selected)
      : bulkUpdateLeadsAction(selected, op === "status" ? { op, status: value } : { op: "assign", assignedTo: value })
    ).catch(() => null);
    setBusy(false);
    if (!res?.ok) return toast(res?.error ?? "Couldn't reach the server. Please try again.", { tone: "error" });
    if ("deleted" in res) toast(`Deleted ${plural(res.deleted)}`);
    else if ("changed" in res) toast(res.changed ? `Updated ${plural(res.changed)}` : "No changes — the selected leads already had that", { tone: res.changed ? "success" : undefined });
    setPicked([]);
    setChoice("");
    router.refresh();
  };

  return (
    <>
      <div
        className={cn(
          "mb-3 flex flex-col gap-2 border border-line bg-white p-3 transition-colors sm:flex-row sm:items-center",
          selected.length ? "border-ink/30" : "text-muted",
        )}
      >
        <p className="text-[13px] font-medium sm:mr-auto num" aria-live="polite">
          {selected.length ? `${plural(selected.length)} selected` : "Select leads to update several at once"}
          {selected.length > 0 && (
            <button type="button" onClick={() => setPicked([])} className="ml-3 text-[12.5px] font-normal text-muted underline-offset-2 hover:text-ink hover:underline">
              Clear
            </button>
          )}
        </p>
        <div className="flex gap-2">
          <select
            aria-label="Bulk action"
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            disabled={!selected.length || busy}
            className={cn(filterInput, "min-w-0 flex-1 cursor-pointer disabled:cursor-not-allowed disabled:bg-mist sm:w-60 sm:flex-none")}
          >
            <option value="">Choose an action…</option>
            <optgroup label="Set status">
              {LEAD_STATUS.map((s) => (
                <option key={s} value={`status:${s}`}>
                  Mark as {LEAD_STATUS_LABEL[s]}
                </option>
              ))}
            </optgroup>
            <optgroup label="Assign to">
              <option value="assign:">Nobody (unassign)</option>
              {staff.map((s) => (
                <option key={s.id} value={`assign:${s.id}`}>
                  {s.name}
                </option>
              ))}
            </optgroup>
            {canDelete && (
              <optgroup label="Admin">
                <option value="delete">Delete leads</option>
              </optgroup>
            )}
          </select>
          <button
            type="button"
            onClick={apply}
            disabled={!choice || !selected.length || busy}
            aria-label={choice === "delete" ? "Delete selected leads" : "Apply to selected leads"}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-2 rounded-[3px] px-4 text-[13px] font-medium text-white transition-colors disabled:opacity-40",
              choice === "delete" ? "bg-red hover:bg-red-600" : "bg-ink hover:bg-ink-3",
            )}
          >
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {choice === "delete" ? "Delete" : "Apply"}
          </button>
        </div>
      </div>

      <Table>
        <thead>
          <tr>
            <Th className="w-10 pr-0">
              <input ref={allRef} type="checkbox" checked={all} onChange={toggleAll} disabled={!rows.length} aria-label="Select all leads on this page" className={checkbox} />
            </Th>
            <Th>Received</Th>
            <Th>Type</Th>
            <Th>Customer</Th>
            <Th>About</Th>
            <Th>Status</Th>
            <Th>Owner</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow colSpan={7}>{emptyText}</EmptyRow>}
          {rows.map((l) => {
            const on = selected.includes(l.id);
            return (
              <tr key={l.id} className={cn("transition-colors", on ? "bg-red-50/40" : "hover:bg-mist/50")}>
                <Td className="pr-0">
                  <input type="checkbox" checked={on} onChange={() => toggle(l.id)} aria-label={`Select ${l.reference}`} className={checkbox} />
                </Td>
                <Td className="whitespace-nowrap">
                  <Link href={`/admin/leads/${l.id}`} className="font-medium hover:text-red">
                    {l.reference}
                  </Link>
                  <span className="mt-0.5 block text-[12px] text-muted">{l.received}</span>
                </Td>
                <Td className="whitespace-nowrap">{l.typeLabel}</Td>
                <Td>
                  <Link href={`/admin/leads/${l.id}`} className="font-medium hover:text-red">
                    {l.name ?? "Unnamed"}
                  </Link>
                  <span className="mt-0.5 block text-[12px] text-muted">{l.contact}</span>
                </Td>
                <Td className="max-w-[260px]">
                  <span className="line-clamp-2">{l.about}</span>
                  {l.city && <span className="mt-0.5 block text-[12px] text-muted">{l.city}</span>}
                </Td>
                <Td>
                  <Badge tone={LEAD_STATUS_TONE[l.status]}>{LEAD_STATUS_LABEL[l.status]}</Badge>
                </Td>
                <Td className="whitespace-nowrap text-muted">{l.assigneeName ?? "—"}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </>
  );
}
