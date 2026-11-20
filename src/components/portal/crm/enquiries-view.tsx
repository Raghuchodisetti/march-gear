"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CarFront, Check, ChevronDown, Download, FileSpreadsheet, Kanban, Loader2, Rows3, Sparkles, UserPlus, X } from "lucide-react";
import { CRM_STATUS, type CrmStatus } from "@/db/enums";
import { CRM_STATUS_LABEL, CRM_STATUS_TONE } from "@/partner/labels";
import { cn } from "@/lib/utils";
import { bulkUpdateLeadsAction, updateLeadStatusAction } from "@/server/actions/partner-crm";
import { Drawer, Modal } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { FollowUp, Initials, LeadStatusBadge, SourceTag } from "./badges";
import { Menu, Select, menuItem } from "./controls";
import { LeadWorkspace, type LeadPermissions } from "./lead-workspace";
import { AddLeadModal, type AddLeadOptions } from "./add-lead-modal";
import { LOST_REASONS, formatIstDateTime, formatIstDay, formatTime, isOverdue } from "./pipeline";
import type { LeadDetail, LeadListItem, MemberOption } from "./types";
import { useRun } from "./use-run";
import type { TestDriveOptions } from "@/components/portal/test-drives/schedule-form";

const TONE_DOT: Record<string, string> = {
  red: "bg-red",
  amber: "bg-[#d68a00]",
  blue: "bg-[#2456a6]",
  green: "bg-[#1e7a3c]",
  neutral: "bg-muted",
  dark: "bg-ink",
};

export function EnquiriesView({
  rows,
  view,
  members,
  can,
  viewAll,
  now,
  selected,
  tdOptions,
  addOptions,
  exportQuery,
  boardTruncated,
}: {
  rows: LeadListItem[];
  view: "table" | "board";
  members: MemberOption[];
  can: LeadPermissions;
  viewAll: boolean;
  now: number;
  selected: LeadDetail | null;
  tdOptions: TestDriveOptions | null;
  addOptions: AddLeadOptions;
  exportQuery: string;
  boardTruncated: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [clicked, setClicked] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());

  const go = (patch: Record<string, string | null>, mode: "push" | "replace" = "push") => {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) q.delete(k);
      else q.set(k, v);
    }
    const s = q.toString();
    startTransition(() => router[mode](s ? `${pathname}?${s}` : pathname, { scroll: false }));
  };
  const open = (id: number) => {
    setClicked(id);
    go({ lead: String(id) });
  };
  // The row being opened shows a spinner until the drawer's data arrives.
  const opening = pending ? clicked : null;

  // Drop selections that are no longer on screen (filters changed, page changed).
  const visible = useMemo(() => new Set(rows.map((r) => r.id)), [rows]);
  const chosen = [...picked].filter((id) => visible.has(id));
  const toggle = (id: number) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allOn = rows.length > 0 && rows.every((r) => picked.has(r.id));

  const exportHref = (format: "csv" | "excel", only?: number[]) => `/dealer/enquiries/export?${[exportQuery, `format=${format}`, only?.length ? `ids=${only.join(",")}` : ""].filter(Boolean).join("&")}`;

  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="radiogroup" aria-label="View" className="inline-flex w-fit rounded-[3px] border border-line bg-white p-1">
          {(
            [
              { value: "table", label: "Table", icon: Rows3 },
              { value: "board", label: "Pipeline board", icon: Kanban },
            ] as const
          ).map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={view === o.value}
              onClick={() => go({ view: o.value === "table" ? null : "board", page: null })}
              className={cn(
                "inline-flex h-8 items-center gap-2 rounded-[2px] px-3 text-[13px] font-medium transition-colors duration-300",
                view === o.value ? "bg-ink text-white" : "text-muted hover:text-ink",
              )}
            >
              <o.icon aria-hidden className="size-4" /> {o.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {pending && <Loader2 aria-label="Loading" className="size-4 animate-spin text-muted" />}
          <Menu
            trigger={({ open: isOpen, toggle: t }) => (
              <Button variant="outline" size="sm" onClick={t} aria-expanded={isOpen} aria-haspopup="menu" icon={<Download className="size-4" aria-hidden />}>
                Export <ChevronDown aria-hidden className="size-3.5" />
              </Button>
            )}
          >
            {(close) => (
              <>
                <a role="menuitem" href={exportHref("csv")} className={menuItem} onClick={close}>
                  <Download aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
                  <span>
                    <span className="block font-medium">CSV</span>
                    <span className="block text-[12px] text-muted">Every enquiry matching the filters</span>
                  </span>
                </a>
                <a role="menuitem" href={exportHref("excel")} className={menuItem} onClick={close}>
                  <FileSpreadsheet aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
                  <span>
                    <span className="block font-medium">Excel</span>
                    <span className="block text-[12px] text-muted">CSV with a UTF-8 BOM so Excel shows ₹ and names correctly — not an .xlsx file</span>
                  </span>
                </a>
                {chosen.length > 0 && (
                  <a role="menuitem" href={exportHref("csv", chosen)} className={cn(menuItem, "border-t border-line")} onClick={close}>
                    <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
                    <span>
                      <span className="block font-medium">Selected only ({chosen.length})</span>
                      <span className="block text-[12px] text-muted">CSV of the rows you ticked</span>
                    </span>
                  </a>
                )}
              </>
            )}
          </Menu>
          {can.manage && (
            <Button variant="primary" size="sm" onClick={() => setAdding(true)} icon={<UserPlus className="size-4" aria-hidden />}>
              Add enquiry
            </Button>
          )}
        </div>
      </div>

      {view === "table" && chosen.length > 0 && <BulkBar ids={chosen} members={members} can={can} viewAll={viewAll} onDone={() => setPicked(new Set())} />}

      {view === "table" ? (
        <LeadTable rows={rows} now={now} picked={picked} allOn={allOn} onToggle={toggle} onToggleAll={() => setPicked(allOn ? new Set() : new Set(rows.map((r) => r.id)))} onOpen={open} opening={opening} />
      ) : (
        <Board rows={rows} now={now} onOpen={open} opening={opening} canMove={can.manage} truncated={boardTruncated} />
      )}

      <Drawer open={Boolean(selected)} onClose={() => go({ lead: null }, "replace")} title="Enquiry" className="max-w-[680px]">
        {selected && <LeadWorkspace lead={selected} members={members} can={can} tdOptions={tdOptions} now={now} />}
      </Drawer>
      <AddLeadModal open={adding} onClose={() => setAdding(false)} options={addOptions} />
    </div>
  );
}

/* ── Table ─────────────────────────────────────────────────── */

function Interest({ r }: { r: LeadListItem }) {
  return (
    <div className="min-w-0">
      {r.carLabel ? (
        <p className="truncate text-[13.5px]">
          {r.carLabel}
          {r.variant && !r.carLabel.endsWith(r.variant) ? <span className="text-muted"> · {r.variant}</span> : null}
        </p>
      ) : (
        <p className="text-[13px] text-muted">Not specified</p>
      )}
      <div className="mt-1 flex flex-wrap gap-1.5">
        {r.offer && (
          <span className="inline-flex max-w-full items-center gap-1 truncate text-[11.5px] font-medium text-red">
            <Sparkles aria-hidden className="size-3 shrink-0" /> <span className="truncate">{r.offer.title}</span>
          </span>
        )}
        {r.vehicle && (
          <span className="inline-flex items-center gap-1 text-[11.5px] text-muted">
            <CarFront aria-hidden className="size-3" /> {r.vehicle.reference}
          </span>
        )}
      </div>
    </div>
  );
}

function LeadTable({
  rows,
  now,
  picked,
  allOn,
  onToggle,
  onToggleAll,
  onOpen,
  opening,
}: {
  rows: LeadListItem[];
  now: number;
  picked: Set<number>;
  allOn: boolean;
  onToggle: (id: number) => void;
  onToggleAll: () => void;
  onOpen: (id: number) => void;
  opening: number | null;
}) {
  if (!rows.length)
    return (
      <div className="border border-line bg-white px-6 py-16 text-center">
        <p className="font-display text-[18px] font-semibold">No enquiries match</p>
        <p className="mx-auto mt-2 max-w-md text-[14px] text-muted">Website enquiries about your showroom page, listings and offers arrive here automatically. Clear the filters or add a walk-in.</p>
      </div>
    );
  const check = "size-4 cursor-pointer accent-[#111111]";
  return (
    <>
      {/* Phones: cards */}
      <ul className="space-y-2 md:hidden">
        {rows.map((r) => (
          <li key={r.id} className={cn("border bg-white transition-colors", picked.has(r.id) ? "border-ink" : "border-line")}>
            <div className="flex items-start gap-3 p-4">
              <input type="checkbox" className={cn(check, "mt-1")} checked={picked.has(r.id)} onChange={() => onToggle(r.id)} aria-label={`Select ${r.name}`} />
              <button type="button" onClick={() => onOpen(r.id)} className="min-w-0 flex-1 text-left">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14.5px] font-semibold">{r.name}</p>
                    <p className="mt-0.5 text-[12px] text-muted num">
                      {r.reference}
                      {r.mobile ? ` · ${r.mobile}` : ""}
                    </p>
                  </div>
                  {opening === r.id ? <Loader2 aria-hidden className="size-4 shrink-0 animate-spin text-muted" /> : <LeadStatusBadge status={r.status} />}
                </div>
                <div className="mt-3">
                  <Interest r={r} />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted">
                  <span>{r.assigned ? r.assigned.name : "Unassigned"}</span>
                  {r.followUpAt ? <FollowUp at={r.followUpAt} status={r.status} now={now} className="!flex-row !items-center !gap-2" /> : <span className="num">{formatIstDateTime(r.createdAt)}</span>}
                </div>
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* Tablets and up: table */}
      <div className="hidden overflow-x-auto border border-line bg-white md:block">
        <table className="w-full min-w-[960px] border-collapse text-left text-[13.5px]">
          <thead>
            <tr className="bg-mist/60 text-[12px] text-muted">
              <th className="w-10 border-b border-line px-4 py-3">
                <input type="checkbox" className={check} checked={allOn} onChange={onToggleAll} aria-label="Select all on this page" />
              </th>
              <th className="border-b border-line px-3 py-3 font-semibold">Customer</th>
              <th className="border-b border-line px-3 py-3 font-semibold">Interested in</th>
              <th className="border-b border-line px-3 py-3 font-semibold">Source</th>
              <th className="border-b border-line px-3 py-3 font-semibold">Status</th>
              <th className="border-b border-line px-3 py-3 font-semibold">Assigned to</th>
              <th className="border-b border-line px-3 py-3 font-semibold">Follow-up</th>
              <th className="border-b border-line px-3 py-3 font-semibold">Received</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("input,a,button")) return;
                  onOpen(r.id);
                }}
                className={cn("group cursor-pointer transition-colors duration-300 hover:bg-mist/50", picked.has(r.id) && "bg-mist/70")}
              >
                <td className="border-b border-line px-4 py-3.5 align-top">
                  <input type="checkbox" className={cn(check, "mt-1")} checked={picked.has(r.id)} onChange={() => onToggle(r.id)} aria-label={`Select ${r.name}`} />
                </td>
                <td className="border-b border-line px-3 py-3.5 align-top">
                  <button type="button" onClick={() => onOpen(r.id)} className="flex min-w-0 max-w-[220px] items-center gap-3 text-left">
                    <Initials name={r.name} className="size-8 text-[11px]" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 truncate font-semibold text-ink group-hover:underline group-hover:underline-offset-4">
                        {r.name} {opening === r.id && <Loader2 aria-hidden className="size-3.5 animate-spin text-muted" />}
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] text-muted num">
                        {r.reference}
                        {r.mobile ? ` · ${r.mobile}` : r.email ? ` · ${r.email}` : ""}
                      </span>
                    </span>
                  </button>
                </td>
                <td className="border-b border-line px-3 py-3.5 align-top">
                  {/* Auto table layout ignores a cell's max-width — cap the content instead. */}
                  <div className="max-w-[210px]">
                    <Interest r={r} />
                  </div>
                </td>
                <td className="border-b border-line px-3 py-3.5 align-top">
                  <SourceTag source={r.source} />
                </td>
                <td className="border-b border-line px-3 py-3.5 align-top">
                  <LeadStatusBadge status={r.status} />
                  {r.status === "lost" && r.lostReason && <p className="mt-1 max-w-[160px] truncate text-[11.5px] text-muted">{r.lostReason}</p>}
                </td>
                <td className="border-b border-line px-3 py-3.5 align-top text-[13px]">{r.assigned ? r.assigned.name : <span className="text-muted">Unassigned</span>}</td>
                <td className="border-b border-line px-3 py-3.5 align-top">
                  <FollowUp at={r.followUpAt} status={r.status} now={now} />
                </td>
                <td className="whitespace-nowrap border-b border-line px-3 py-3.5 align-top text-[12.5px] text-muted num">
                  <span className="block text-ink/80">{formatIstDay(r.createdAt)}</span>
                  <span className="block">{formatTime(r.createdAt)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ── Bulk actions ──────────────────────────────────────────── */

function BulkBar({ ids, members, can, viewAll, onDone }: { ids: number[]; members: MemberOption[]; can: LeadPermissions; viewAll: boolean; onDone: () => void }) {
  const { run, busy, errors } = useRun();
  const [member, setMember] = useState("");
  const [status, setStatus] = useState<CrmStatus | "">("");
  const [reason, setReason] = useState("");
  const canAssign = can.assign && viewAll;

  const apply = async (kind: "assign" | "status") => {
    const res = await run(
      kind,
      () =>
        bulkUpdateLeadsAction(
          kind === "assign" ? { ids, memberId: member === "none" ? null : Number(member) } : { ids, status: status as CrmStatus, lostReason: status === "lost" ? reason : undefined },
        ),
      (r) => `${r.updated} enquir${r.updated === 1 ? "y" : "ies"} updated`,
    );
    if (res) onDone();
  };

  return (
    <div className="mb-3 flex animate-[rise_0.5s_var(--ease-premium)_both] flex-col gap-3 border border-ink bg-ink px-4 py-3 text-white lg:flex-row lg:items-center">
      <p className="flex items-center justify-between gap-3 text-[13px] font-medium lg:mr-2">
        <span className="num">{ids.length} selected</span>
        <button type="button" onClick={onDone} className="inline-flex items-center gap-1 text-[12.5px] text-white/60 hover:text-white lg:hidden">
          <X aria-hidden className="size-3.5" /> Clear
        </button>
      </p>
      {canAssign && (
        <div className="flex items-center gap-2">
          <select aria-label="Assign selected to" value={member} onChange={(e) => setMember(e.target.value)} className="h-9 min-w-0 flex-1 rounded-[3px] border border-white/20 bg-ink-2 px-2.5 text-[13px] text-white outline-none focus:border-white lg:w-52 lg:flex-none">
            <option value="">Assign to…</option>
            <option value="none">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <Button variant="light" size="sm" disabled={!member || busy !== null} onClick={() => apply("assign")} icon={busy === "assign" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
            Assign
          </Button>
        </div>
      )}
      {can.manage && (
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Set status of selected" value={status} onChange={(e) => setStatus(e.target.value as CrmStatus | "")} className="h-9 min-w-0 flex-1 rounded-[3px] border border-white/20 bg-ink-2 px-2.5 text-[13px] text-white outline-none focus:border-white lg:w-48 lg:flex-none">
            <option value="">Set status…</option>
            {CRM_STATUS.map((s) => (
              <option key={s} value={s}>
                {CRM_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          {status === "lost" && (
            <select aria-label="Lost reason" value={reason} onChange={(e) => setReason(e.target.value)} className={cn("h-9 min-w-0 flex-1 rounded-[3px] border bg-ink-2 px-2.5 text-[13px] text-white outline-none lg:w-48 lg:flex-none", errors.lostReason ? "border-red" : "border-white/20")}>
              <option value="">Lost reason…</option>
              {LOST_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          )}
          <Button variant="light" size="sm" disabled={!status || busy !== null} onClick={() => apply("status")} icon={busy === "status" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
            Apply
          </Button>
        </div>
      )}
      <button type="button" onClick={onDone} className="ml-auto hidden items-center gap-1 text-[12.5px] text-white/60 hover:text-white lg:inline-flex">
        <X aria-hidden className="size-3.5" /> Clear selection
      </button>
    </div>
  );
}

/* ── Kanban board ──────────────────────────────────────────── */

function Board({ rows, now, onOpen, opening, canMove, truncated }: { rows: LeadListItem[]; now: number; onOpen: (id: number) => void; opening: number | null; canMove: boolean; truncated: boolean }) {
  const { run } = useRun();
  const [moved, setMoved] = useState<Record<number, CrmStatus>>({});
  const [dragging, setDragging] = useState<number | null>(null);
  // Read synchronously by dragover/drop, which fire before React re-renders.
  const dragRef = useRef<number | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [lostFor, setLostFor] = useState<number | null>(null);
  const [reason, setReason] = useState("");

  // Server data wins once it arrives.
  const [seen, setSeen] = useState(rows);
  if (seen !== rows) {
    setSeen(rows);
    setMoved({});
  }

  const statusOf = (r: LeadListItem) => moved[r.id] ?? r.status;
  const columns = CRM_STATUS.map((s) => ({ status: s, items: rows.filter((r) => statusOf(r) === s) }));

  const move = async (id: number, to: CrmStatus, lostReason?: string) => {
    const lead = rows.find((r) => r.id === id);
    if (!lead || statusOf(lead) === to) return;
    if (to === "lost" && !lostReason) {
      setLostFor(id);
      setReason("");
      return;
    }
    setMoved((m) => ({ ...m, [id]: to }));
    const res = await run("move", () => updateLeadStatusAction({ id, status: to, lostReason }), `${lead.name}: ${CRM_STATUS_LABEL[to]}`);
    if (!res)
      setMoved((m) => {
        const n = { ...m };
        delete n[id];
        return n;
      });
  };

  // The same drop behaviour for a column and for its pill in the "move to" bar.
  const dropTarget = (status: CrmStatus, key: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!canMove || dragRef.current === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (over !== key) setOver(key);
    },
    onDragLeave: () => setOver((o) => (o === key ? null : o)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setOver(null);
      const id = dragRef.current ?? (Number(e.dataTransfer.getData("text/plain")) || null);
      dragRef.current = null;
      setDragging(null);
      if (id !== null) void move(id, status);
    },
  });

  return (
    <>
      {truncated && <p className="mb-3 text-[12.5px] text-muted">Showing the 500 most recent enquiries that match — narrow the filters to see others.</p>}
      {/* While dragging, every status is one short move away — no scrolling to far columns. */}
      <div
        aria-hidden={dragging === null}
        className={cn(
          "fixed bottom-6 left-1/2 z-50 w-max max-w-[calc(100vw-32px)] -translate-x-1/2 transition-[opacity,transform] duration-500 ease-[var(--ease-premium)] lg:left-[calc(50%+132px)]",
          dragging === null ? "pointer-events-none translate-y-4 opacity-0" : "translate-y-0 opacity-100",
        )}
      >
        <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-[4px] border border-ink bg-ink p-2 shadow-lift">
          <span className="px-2 text-[12px] font-medium text-white/70">Move to</span>
          {CRM_STATUS.map((st) => (
            <span
              key={st}
              aria-label={`Move to ${CRM_STATUS_LABEL[st]}`}
              {...dropTarget(st, `pill-${st}`)}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-[3px] border px-3 text-[12.5px] font-medium transition-colors duration-200",
                over === `pill-${st}` ? "border-white bg-white text-ink" : "border-white/20 text-white",
              )}
            >
              <span aria-hidden className={cn("size-1.5 rounded-full", TONE_DOT[CRM_STATUS_TONE[st]])} /> {CRM_STATUS_LABEL[st]}
            </span>
          ))}
        </div>
      </div>
      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        <div className="flex w-max gap-3">
          {columns.map((col) => (
            <section
              key={col.status}
              aria-label={CRM_STATUS_LABEL[col.status]}
              {...dropTarget(col.status, col.status)}
              className={cn("flex w-[272px] shrink-0 flex-col border bg-[#fbfbfb] transition-colors duration-300", over === col.status ? "border-ink bg-white" : "border-line")}
            >
              <header className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-3">
                <span className="flex items-center gap-2 text-[12.5px] font-semibold">
                  <span aria-hidden className={cn("size-2 rounded-full", TONE_DOT[CRM_STATUS_TONE[col.status]])} /> {CRM_STATUS_LABEL[col.status]}
                </span>
                <span className="text-[12px] text-muted num">{col.items.length}</span>
              </header>
              <ul className="flex min-h-[120px] flex-1 flex-col gap-2 p-2">
                {col.items.map((r) => (
                  <li
                    key={r.id}
                    draggable={canMove}
                    onDragStart={(e) => {
                      dragRef.current = r.id;
                      setDragging(r.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", String(r.id));
                    }}
                    onDragEnd={() => {
                      dragRef.current = null;
                      setDragging(null);
                      setOver(null);
                    }}
                    className={cn("border bg-white transition-[border-color,opacity] duration-300 hover:border-ink/30", dragging === r.id ? "opacity-40" : "", isOverdue(r.followUpAt, statusOf(r), now) ? "border-red/40" : "border-line", canMove && "cursor-grab active:cursor-grabbing")}
                  >
                    {/* A div, not a <button>: browsers won't start a drag from a button. */}
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label={`Open ${r.name}`}
                      onClick={() => onOpen(r.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onOpen(r.id);
                        }
                      }}
                      className="block w-full p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate text-[13.5px] font-semibold">{r.name}</p>
                        {opening === r.id ? <Loader2 aria-hidden className="size-3.5 shrink-0 animate-spin text-muted" /> : <span className="shrink-0 font-mono text-[10.5px] text-muted">{r.reference}</span>}
                      </div>
                      <p className="mt-1 truncate text-[12.5px] text-ink/75">{r.carLabel ?? "Car not specified"}</p>
                      {r.offer && (
                        <p className="mt-1 flex items-center gap-1 truncate text-[11.5px] font-medium text-red">
                          <Sparkles aria-hidden className="size-3 shrink-0" /> <span className="truncate">{r.offer.title}</span>
                        </p>
                      )}
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <SourceTag source={r.source} />
                        {r.assigned ? (
                          <span title={r.assigned.name}>
                            <Initials name={r.assigned.name} className="size-6 text-[10px]" />
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted">Unassigned</span>
                        )}
                      </div>
                      {r.followUpAt && <FollowUp at={r.followUpAt} status={statusOf(r)} now={now} className="mt-2.5 !flex-row !items-center !gap-2" />}
                    </div>
                  </li>
                ))}
                {!col.items.length && <li className="flex flex-1 items-center justify-center border border-dashed border-line px-3 py-6 text-center text-[12px] text-muted">{canMove ? "Drop an enquiry here" : "Nothing here"}</li>}
              </ul>
            </section>
          ))}
        </div>
      </div>
      {canMove && <p className="mt-2 hidden text-[12px] text-muted md:block">Drag a card to another column to change its status, or open it for notes, calls and reminders.</p>}

      <Modal open={lostFor !== null} onClose={() => setLostFor(null)} title="Mark as lost" description="Recording why helps your team spot patterns." size="sm">
        <div className="space-y-4 px-6 py-6 sm:px-8">
          <Select label="Lost reason" value={reason} onChange={(e) => setReason(e.target.value)} options={LOST_REASONS.map((r) => ({ value: r, label: r }))} placeholder="Choose a reason" data-autofocus />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setLostFor(null)}>
              Cancel
            </Button>
            <Button
              variant="dark"
              size="sm"
              disabled={!reason}
              onClick={() => {
                const id = lostFor;
                setLostFor(null);
                if (id !== null) void move(id, "lost", reason);
              }}
            >
              Mark as lost
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
