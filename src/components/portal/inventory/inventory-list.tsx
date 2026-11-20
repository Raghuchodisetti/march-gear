"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Copy,
  ExternalLink,
  Eye,
  History,
  ImageOff,
  Loader2,
  MessageSquareWarning,
  MoreHorizontal,
  PencilLine,
  Search,
  Send,
  Undo2,
  X,
} from "lucide-react";
import { PARTNER_VEHICLE_STATUS, type PartnerVehicleStatus } from "@/db/enums";
import { cn } from "@/lib/utils";
import { formatINR, formatPriceShort } from "@/lib/format";
import { VEHICLE_STATUS_LABEL } from "@/partner/labels";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { formatDateTime } from "@/components/portal/ui";
import { useUI } from "@/components/providers/app-provider";
import { archiveVehiclesAction, duplicateVehicleAction, restoreVehicleAction, submitVehiclesAction, updateStockAction, withdrawVehicleAction } from "@/server/actions/partner-inventory";
import { ConfirmDialog, HistoryDrawer, PreviewModal, StatusBadge } from "./dialogs";
import { NEEDS_ATTENTION, SORTS, SUBMITTABLE, WITHDRAWABLE, vehicleTitle, type InventorySort, type InventoryTab, type VehicleListRow } from "./shared";

/* ──────────────────────────────────────────────────────────────
   /dealer/inventory: tabs, search, status filter, sortable table
   (cards on phones), inline stock, row actions and bulk actions.
   Filters live in the URL so the server renders each page.
   ────────────────────────────────────────────────────────────── */

export interface InventoryFiltersState {
  tab: InventoryTab;
  status: PartnerVehicleStatus | "";
  q: string;
  sort: InventorySort;
  dir: "asc" | "desc";
  page: number;
}

interface Props {
  rows: VehicleListRow[];
  total: number;
  pageSize: number;
  filters: InventoryFiltersState;
  tabCounts: Record<InventoryTab, number>;
  statusCounts: Record<PartnerVehicleStatus, number>;
  canManage: boolean;
}

const control =
  "h-10 rounded-[3px] border border-line bg-white px-3 text-[13.5px] text-ink outline-none transition-[border-color] duration-[250ms] hover:border-ink/30 focus:border-ink";

function useFilterNav(filters: InventoryFiltersState) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const go = (patch: Partial<InventoryFiltersState>) => {
    const next = { ...filters, page: 1, ...patch };
    const q = new URLSearchParams();
    if (next.tab !== "all") q.set("tab", next.tab);
    if (next.status) q.set("status", next.status);
    if (next.q) q.set("q", next.q);
    if (next.sort !== "updated") q.set("sort", next.sort);
    if (next.dir !== "desc") q.set("dir", next.dir);
    if (next.page > 1) q.set("page", String(next.page));
    const s = q.toString();
    start(() => router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false }));
  };
  return { go, pending };
}

/* ── Row menu (portalled so the table never clips it) ───────── */

type MenuItem = { label: string; icon: ReactNode; onSelect?: () => void; href?: string; external?: boolean; tone?: "danger" } | "divider";

function RowMenu({ items, label }: { items: MenuItem[]; label: string }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const place = () => {
      const r = btn.current!.getBoundingClientRect();
      const width = 232;
      const height = menu.current?.offsetHeight ?? 320;
      const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
      setPos(r.bottom + height + 12 > window.innerHeight && r.top > height + 12 ? { bottom: window.innerHeight - r.top + 6, left } : { top: r.bottom + 6, left });
    };
    place();
    const close = () => setOpen(false);
    const outside = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) close();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        btn.current?.focus();
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const nodes = Array.from(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);
        const i = nodes.indexOf(document.activeElement as HTMLElement);
        nodes[(i + (e.key === "ArrowDown" ? 1 : -1) + nodes.length) % nodes.length]?.focus();
      }
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    requestAnimationFrame(() => menu.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus());
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  const item = "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13.5px] outline-none transition-colors hover:bg-mist focus-visible:bg-mist";
  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${label}`}
        className="inline-flex size-9 items-center justify-center rounded-full text-ink/70 transition-colors hover:bg-mist hover:text-ink"
      >
        <MoreHorizontal className="size-[18px]" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            aria-label={`Actions for ${label}`}
            style={{ position: "fixed", width: 232, visibility: pos ? "visible" : "hidden", ...pos }}
            className="z-[90] overflow-hidden rounded-[4px] border border-line bg-white py-1.5 shadow-lift"
          >
            {items.map((it, i) =>
              it === "divider" ? (
                <div key={`d${i}`} role="separator" className="my-1.5 h-px bg-line" />
              ) : it.href ? (
                <Link
                  key={it.label}
                  role="menuitem"
                  href={it.href}
                  {...(it.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  onClick={() => setOpen(false)}
                  className={item}
                >
                  <span className="text-muted">{it.icon}</span>
                  {it.label}
                </Link>
              ) : (
                <button
                  key={it.label}
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    it.onSelect?.();
                  }}
                  className={cn(item, it.tone === "danger" && "text-red")}
                >
                  <span className={it.tone === "danger" ? "text-red" : "text-muted"}>{it.icon}</span>
                  {it.label}
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

/* ── Inline stock ───────────────────────────────────────────── */

function StockCell({ row, canManage }: { row: VehicleListRow; canManage: boolean }) {
  const router = useRouter();
  const { toast } = useUI();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(row.stock));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  const save = async () => {
    setBusy(true);
    setError(null);
    const res = await updateStockAction(row.id, value);
    setBusy(false);
    if (!res.ok) {
      setError(res.fieldErrors?.stock ?? res.error ?? "Couldn't update the stock.");
      return;
    }
    setEditing(false);
    toast(`Stock for ${row.reference} is now ${res.stock}`, { tone: "success" });
    router.refresh();
  };

  if (!editing)
    return (
      <div className="flex items-center gap-2">
        <span className={cn("font-semibold num", row.stock === 0 && "text-red")}>{row.stock}</span>
        {canManage && row.status !== "archived" && (
          <button
            type="button"
            onClick={() => {
              setValue(String(row.stock));
              setEditing(true);
            }}
            className="rounded-[3px] px-1.5 py-0.5 text-[12px] font-medium text-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            Update<span className="sr-only"> stock for {row.reference}</span>
          </button>
        )}
      </div>
    );
  return (
    <div>
      <div className="flex items-center gap-1">
        <input
          ref={input}
          type="number"
          inputMode="numeric"
          min={0}
          max={999}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          aria-label={`Units in stock for ${row.reference}`}
          aria-invalid={error ? true : undefined}
          className={cn(control, "h-9 w-16 px-2 num", error && "border-red")}
        />
        <button type="button" onClick={save} disabled={busy} aria-label="Save stock" className="inline-flex size-9 items-center justify-center rounded-full bg-ink text-white transition-colors hover:bg-ink-3 disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        </button>
        <button type="button" onClick={() => setEditing(false)} disabled={busy} aria-label="Cancel" className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-mist hover:text-ink">
          <X className="size-4" />
        </button>
      </div>
      {error && <p className="mt-1 max-w-[12rem] text-[11.5px] text-red">{error}</p>}
    </div>
  );
}

/* ── Table pieces ───────────────────────────────────────────── */

function Thumb({ src, alt }: { src: string | null; alt: string }) {
  return (
    <span className="relative inline-flex aspect-[4/3] w-[72px] shrink-0 self-start items-center justify-center overflow-hidden rounded-[3px] border border-line bg-mist text-muted">
      {/* Dealer-uploaded photo from /media. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt={alt} loading="lazy" className="size-full object-cover" /> : <ImageOff aria-hidden className="size-4" />}
    </span>
  );
}

function KindChip({ kind }: { kind: "new" | "used" }) {
  return <span className="inline-flex h-5 items-center rounded-[3px] border border-line px-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">{kind === "new" ? "New" : "Used"}</span>;
}

function SortHeader({ label, sort, filters, go, className }: { label: string; sort: InventorySort; filters: InventoryFiltersState; go: (p: Partial<InventoryFiltersState>) => void; className?: string }) {
  const active = filters.sort === sort;
  const Icon = !active ? ArrowUpDown : filters.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={cn("border-b border-line bg-[#fafafa] px-4 py-3 text-[12px] font-semibold text-muted", className)} aria-sort={active ? (filters.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => go({ sort, dir: active && filters.dir === "desc" ? "asc" : "desc" })}
        className={cn("inline-flex items-center gap-1 transition-colors hover:text-ink", active && "text-ink")}
      >
        {label}
        <Icon aria-hidden className={cn("size-3.5", !active && "opacity-50")} />
      </button>
    </th>
  );
}

function Remarks({ row, onOpen }: { row: VehicleListRow; onOpen: () => void }) {
  if (!NEEDS_ATTENTION.includes(row.status)) return null;
  const rejected = row.status === "rejected";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn("mt-2 flex w-full max-w-md items-start gap-1.5 rounded-[3px] px-2 py-1.5 text-left text-[12.5px]", rejected ? "bg-red-50 text-red" : "bg-[#fdf3e1] text-[#9a5b00]")}
    >
      <MessageSquareWarning aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <span className="line-clamp-2 min-w-0">
        <span className="font-semibold">MarchGear: </span>
        {row.adminRemarks || "See the approval history for details."}
      </span>
    </button>
  );
}

/* ── The list ───────────────────────────────────────────────── */

export function InventoryList({ rows, total, pageSize, filters, tabCounts, statusCounts, canManage }: Props) {
  const router = useRouter();
  const { toast } = useUI();
  const { go, pending } = useFilterNav(filters);
  const [q, setQ] = useState(filters.q);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [history, setHistory] = useState<number | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "archive" | "withdraw" | "submit"; ids: number[]; label: string; live?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{ submitted: string[]; skipped: { reference: string; reason: string }[] } | null>(null);
  const [lastRows, setLastRows] = useState(rows);

  // A new page of rows (filters changed, or a refresh) clears selections that no longer show.
  if (lastRows !== rows) {
    setLastRows(rows);
    const visible = new Set(rows.map((r) => r.id));
    setSelected((s) => new Set([...s].filter((id) => visible.has(id))));
  }

  // Search as you type, gently debounced. `sentQ` is the last search we asked for, so a link that
  // changes the URL elsewhere (a summary card) resets the box without fighting the person typing.
  const [sentQ, setSentQ] = useState(filters.q);
  const [seenQ, setSeenQ] = useState(filters.q);
  if (seenQ !== filters.q) {
    setSeenQ(filters.q);
    if (filters.q !== sentQ) {
      setQ(filters.q);
      setSentQ(filters.q);
    }
  }
  const search = (value: string, patch: Partial<InventoryFiltersState> = {}) => {
    setSentQ(value);
    go({ ...patch, q: value });
  };
  useEffect(() => {
    if (q.trim() === sentQ) return;
    const t = setTimeout(() => search(q.trim()), 450);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const byId = new Map(rows.map((r) => [r.id, r]));
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const runSubmit = async (ids: number[]) => {
    setBusy(true);
    const res = await submitVehiclesAction(ids);
    setBusy(false);
    setConfirm(null);
    if (!res.ok) return toast(res.error ?? "Couldn't submit.", { tone: "error" });
    setSelected(new Set());
    if (res.skipped.length || ids.length > 1) setReport({ submitted: res.submitted, skipped: res.skipped });
    else toast(`${res.submitted[0]} sent to MarchGear for approval`, { tone: "success" });
    router.refresh();
  };

  const finish = (message: string, failed: boolean) => {
    setBusy(false);
    setConfirm(null);
    toast(message, { tone: failed ? "error" : "success" });
  };

  const runConfirmed = async () => {
    if (!confirm) return;
    if (confirm.kind === "submit") return runSubmit(confirm.ids);
    setBusy(true);
    let message: string;
    if (confirm.kind === "archive") {
      const res = await archiveVehiclesAction(confirm.ids);
      message = res.ok ? `Archived ${res.archived.length === 1 ? res.archived[0] : `${res.archived.length} vehicles`}` : (res.error ?? "Couldn't archive. Please try again.");
      if (!res.ok) return finish(message, true);
    } else {
      const res = await withdrawVehicleAction(confirm.ids[0]);
      message = res.ok ? `${confirm.label} is back to draft` : (res.error ?? "Couldn't withdraw. Please try again.");
      if (!res.ok) return finish(message, true);
    }
    setSelected(new Set());
    finish(message, false);
    router.refresh();
  };

  const duplicate = async (row: VehicleListRow) => {
    toast(`Duplicating ${row.reference}…`);
    const res = await duplicateVehicleAction(row.id);
    if (!res.ok) return toast(res.error ?? "Couldn't duplicate.", { tone: "error" });
    toast(`Draft copy ${res.reference} created`, { tone: "success" });
    router.push(`/dealer/inventory/${res.id}`);
  };

  const restore = async (row: VehicleListRow) => {
    const res = await restoreVehicleAction(row.id);
    if (!res.ok) return toast(res.error ?? "Couldn't restore.", { tone: "error" });
    toast(`${row.reference} restored as a draft`, { tone: "success" });
    router.refresh();
  };

  const menuFor = (row: VehicleListRow): MenuItem[] => {
    const label = row.reference;
    const items: MenuItem[] = [];
    if (canManage) items.push({ label: row.status === "archived" ? "Open" : "Edit", icon: <PencilLine className="size-4" />, href: `/dealer/inventory/${row.id}` });
    items.push({ label: "Preview", icon: <Eye className="size-4" />, onSelect: () => setPreview(row.id) });
    if (row.publicHref) items.push({ label: "View on website", icon: <ExternalLink className="size-4" />, href: row.publicHref, external: true });
    items.push({ label: "Approval history", icon: <History className="size-4" />, onSelect: () => setHistory(row.id) });
    if (canManage) {
      items.push("divider");
      if (SUBMITTABLE.includes(row.status)) items.push({ label: "Submit for approval", icon: <Send className="size-4" />, onSelect: () => runSubmit([row.id]) });
      if (WITHDRAWABLE.includes(row.status))
        items.push({ label: "Withdraw to draft", icon: <Undo2 className="size-4" />, onSelect: () => setConfirm({ kind: "withdraw", ids: [row.id], label, live: row.status === "published" }) });
      items.push({ label: "Duplicate", icon: <Copy className="size-4" />, onSelect: () => duplicate(row) });
      if (row.status === "archived") items.push({ label: "Restore to draft", icon: <ArchiveRestore className="size-4" />, onSelect: () => restore(row) });
      else items.push({ label: "Archive", icon: <Archive className="size-4" />, tone: "danger", onSelect: () => setConfirm({ kind: "archive", ids: [row.id], label, live: row.status === "published" }) });
    }
    return items;
  };

  const tabs: { value: InventoryTab; label: string }[] = [
    { value: "all", label: "All vehicles" },
    { value: "new", label: "New cars" },
    { value: "used", label: "Used cars" },
  ];
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = Boolean(filters.q || filters.status);
  const selectedRows = [...selected].map((id) => byId.get(id)).filter((r): r is VehicleListRow => Boolean(r));
  const selLive = selectedRows.some((r) => r.status === "published");

  return (
    <div>
      {/* Tabs */}
      <div role="tablist" aria-label="Vehicle type" className="no-scrollbar flex gap-7 overflow-x-auto border-b border-line">
        {tabs.map((t) => {
          const active = filters.tab === t.value;
          return (
            <button
              key={t.value}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => go({ tab: t.value, status: "" })}
              className={cn("relative shrink-0 whitespace-nowrap pb-3.5 text-[14.5px] font-medium transition-colors duration-[250ms]", active ? "text-ink" : "text-muted hover:text-ink")}
            >
              {t.label}
              <span className={cn("ml-2 rounded-full px-1.5 py-0.5 text-[11px] num", active ? "bg-ink text-white" : "bg-mist text-muted")}>{tabCounts[t.value]}</span>
              {active && <span aria-hidden className="absolute inset-x-0 -bottom-px h-[2px] bg-red" />}
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="mt-5 flex flex-col gap-2 md:flex-row md:items-center">
        <label className="relative block md:w-80">
          <span className="sr-only">Search vehicles</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search(q.trim())}
            placeholder="Model, variant, VIN or reference"
            className={cn(control, "w-full pl-9")}
          />
        </label>
        <div className="grid grid-cols-2 gap-2 md:flex">
          <select aria-label="Status" value={filters.status} onChange={(e) => go({ status: e.target.value as PartnerVehicleStatus | "" })} className={cn(control, "min-w-0 cursor-pointer md:w-52")}>
            <option value="">All active statuses</option>
            {PARTNER_VEHICLE_STATUS.map((s) => (
              <option key={s} value={s}>
                {VEHICLE_STATUS_LABEL[s]} ({statusCounts[s]})
              </option>
            ))}
          </select>
          <div className="flex min-w-0 gap-2">
            <select aria-label="Sort by" value={filters.sort} onChange={(e) => go({ sort: e.target.value as InventorySort })} className={cn(control, "min-w-0 flex-1 cursor-pointer md:w-44")}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => go({ dir: filters.dir === "asc" ? "desc" : "asc" })}
              aria-label={filters.dir === "asc" ? "Ascending — switch to descending" : "Descending — switch to ascending"}
              className={cn(control, "inline-flex w-10 shrink-0 items-center justify-center px-0")}
            >
              {filters.dir === "asc" ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 md:ml-auto">
          {pending && <Loader2 aria-label="Loading" className="size-4 animate-spin text-muted" />}
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                search("", { status: "" });
              }}
              className="text-[13px] font-medium text-muted transition-colors hover:text-ink"
            >
              Clear filters
            </button>
          )}
          <p className="text-[13px] text-muted num" aria-live="polite">
            {total} {total === 1 ? "vehicle" : "vehicles"}
          </p>
        </div>
      </div>

      {/* Bulk bar */}
      {canManage && selected.size > 0 && (
        <div className="mt-4 flex animate-[rise_0.45s_var(--ease-premium)_both] flex-col gap-3 border border-ink bg-ink px-4 py-3 text-white sm:flex-row sm:items-center">
          <p className="text-[13.5px] font-medium num">
            {selected.size} selected
          </p>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <Button size="sm" variant="light" icon={<Send className="size-4" />} disabled={busy} onClick={() => setConfirm({ kind: "submit", ids: [...selected], label: `${selected.size} vehicles` })}>
              Submit for approval
            </Button>
            <Button size="sm" variant="outline-light" icon={<Archive className="size-4" />} disabled={busy} onClick={() => setConfirm({ kind: "archive", ids: [...selected], label: `${selected.size} vehicles`, live: selLive })}>
              Archive
            </Button>
            <Button size="sm" variant="outline-light" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}

      <div className={cn("mt-4 transition-opacity duration-300", pending && "opacity-60")}>
        {rows.length === 0 ? (
          <div className="border border-line bg-white px-6 py-16 text-center">
            <p className="text-[15px] font-semibold">{hasFilters || filters.tab !== "all" ? "No vehicles match" : "No vehicles yet"}</p>
            <p className="mx-auto mt-1.5 max-w-sm text-[13.5px] text-muted">
              {hasFilters ? "Try a different search or status." : "Add new-car stock or a pre-owned car. MarchGear reviews every listing before it goes live."}
            </p>
            {canManage && !hasFilters && (
              <Button href="/dealer/inventory/add" className="mt-6" arrow>
                Add a vehicle
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden border border-line bg-white md:block">
              <table className="w-full table-fixed border-collapse text-left text-[13.5px]">
                <thead>
                  <tr>
                    {canManage && (
                      <th className="w-11 border-b border-line bg-[#fafafa] py-3 pl-4">
                        <input
                          type="checkbox"
                          checked={allOnPage}
                          onChange={() => setSelected(allOnPage ? new Set() : new Set(rows.map((r) => r.id)))}
                          aria-label="Select all vehicles on this page"
                          className="size-4 cursor-pointer accent-[var(--color-ink)]"
                        />
                      </th>
                    )}
                    <th className="border-b border-line bg-[#fafafa] px-4 py-3 text-[12px] font-semibold text-muted">Vehicle</th>
                    <SortHeader label="Price" sort="price" filters={filters} go={go} className="w-32" />
                    <SortHeader label="Stock" sort="stock" filters={filters} go={go} className="w-36" />
                    <th className="w-[8.75rem] border-b border-line bg-[#fafafa] px-4 py-3 text-[12px] font-semibold text-muted">Status</th>
                    <th className="w-28 border-b border-line bg-[#fafafa] px-4 py-3 text-[12px] font-semibold text-muted max-xl:hidden">
                      <span className="inline-flex gap-1.5">
                        <button type="button" onClick={() => go({ sort: "views", dir: filters.sort === "views" && filters.dir === "desc" ? "asc" : "desc" })} className={cn("hover:text-ink", filters.sort === "views" && "text-ink")}>
                          Views
                        </button>
                        /
                        <button type="button" onClick={() => go({ sort: "enquiries", dir: filters.sort === "enquiries" && filters.dir === "desc" ? "asc" : "desc" })} className={cn("hover:text-ink", filters.sort === "enquiries" && "text-ink")}>
                          Enq.
                        </button>
                      </span>
                    </th>
                    <SortHeader label="Updated" sort="updated" filters={filters} go={go} className="w-32 max-xl:hidden" />
                    <th className="w-14 border-b border-line bg-[#fafafa] px-2 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const title = vehicleTitle(row);
                    return (
                      <tr key={row.id} className={cn("align-top transition-colors duration-200 hover:bg-[#fcfcfc]", selected.has(row.id) && "bg-mist/60 hover:bg-mist/60")}>
                        {canManage && (
                          <td className="border-b border-line py-4 pl-4">
                            <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} aria-label={`Select ${row.reference}`} className="mt-1 size-4 cursor-pointer accent-[var(--color-ink)]" />
                          </td>
                        )}
                        <td className="border-b border-line px-4 py-4">
                          <div className="flex min-w-0 gap-3">
                            <Thumb src={row.image} alt={title} />
                            <div className="min-w-0">
                              <p className="flex items-center gap-2">
                                <KindChip kind={row.kind} />
                                <span className="text-[11.5px] text-muted num">{row.reference}</span>
                              </p>
                              {canManage ? (
                                <Link href={`/dealer/inventory/${row.id}`} className="mt-1 block truncate font-semibold transition-colors hover:text-red">
                                  {title}
                                </Link>
                              ) : (
                                <p className="mt-1 truncate font-semibold">{title}</p>
                              )}
                              <p className="truncate text-[12.5px] text-muted">{[row.variant, row.colour, row.showroom].filter(Boolean).join(" · ") || "Details not filled in yet"}</p>
                              <Remarks row={row} onOpen={() => setHistory(row.id)} />
                            </div>
                          </div>
                        </td>
                        <td className="border-b border-line px-4 py-4">
                          <p className="font-semibold num">{row.sellingPrice > 0 ? formatPriceShort(row.sellingPrice) : "—"}</p>
                          {row.exShowroom ? <p className="whitespace-nowrap text-[11.5px] text-muted num" title="Ex-showroom price">Ex-sh. {formatPriceShort(row.exShowroom)}</p> : null}
                        </td>
                        <td className="border-b border-line px-4 py-4">
                          <StockCell key={`${row.id}-${row.stock}`} row={row} canManage={canManage} />
                        </td>
                        <td className="border-b border-line px-4 py-4">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="border-b border-line px-4 py-4 text-[13px] num max-xl:hidden">
                          {row.views.toLocaleString("en-IN")} <span className="text-muted">/</span> {row.enquiries.toLocaleString("en-IN")}
                        </td>
                        <td className="border-b border-line px-4 py-4 text-[12.5px] text-muted max-xl:hidden">{formatDateTime(row.updatedAt)}</td>
                        <td className="border-b border-line px-2 py-3 text-right">
                          <RowMenu label={row.reference} items={menuFor(row)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Phone cards */}
            <ul className="space-y-3 md:hidden">
              {canManage && (
                <li className="flex items-center justify-between px-1">
                  <label className="inline-flex items-center gap-2 text-[13px] text-muted">
                    <input
                      type="checkbox"
                      checked={allOnPage}
                      onChange={() => setSelected(allOnPage ? new Set() : new Set(rows.map((r) => r.id)))}
                      className="size-4 accent-[var(--color-ink)]"
                    />
                    Select all
                  </label>
                </li>
              )}
              {rows.map((row) => {
                const title = vehicleTitle(row);
                return (
                  <li key={row.id} className={cn("border bg-white p-4", selected.has(row.id) ? "border-ink" : "border-line")}>
                    <div className="flex gap-3">
                      {canManage && <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} aria-label={`Select ${row.reference}`} className="mt-1 size-4 shrink-0 accent-[var(--color-ink)]" />}
                      <Thumb src={row.image} alt={title} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2">
                          <KindChip kind={row.kind} />
                          <span className="truncate text-[11.5px] text-muted num">{row.reference}</span>
                        </p>
                        <p className="mt-1 truncate text-[14px] font-semibold">{title}</p>
                        <p className="truncate text-[12.5px] text-muted">{[row.variant, row.colour].filter(Boolean).join(" · ") || "Details not filled in yet"}</p>
                      </div>
                      <div className="-mr-2 -mt-1 shrink-0">
                        <RowMenu label={row.reference} items={menuFor(row)} />
                      </div>
                    </div>
                    <Remarks row={row} onOpen={() => setHistory(row.id)} />
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line pt-3">
                      <StatusBadge status={row.status} />
                      <span className="text-[14px] font-semibold num">{row.sellingPrice > 0 ? formatINR(row.sellingPrice) : "No price"}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-[12.5px] text-muted">
                      <div className="flex items-center gap-1.5">
                        <span>Stock</span>
                        <StockCell key={`${row.id}-${row.stock}`} row={row} canManage={canManage} />
                      </div>
                      <span className="num">
                        {row.views} views · {row.enquiries} enq.
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>

            {pages > 1 && (
              <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-4 text-[13px] text-muted">
                <p className="num">
                  {(filters.page - 1) * pageSize + 1}–{Math.min(total, filters.page * pageSize)} of {total}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={filters.page <= 1} onClick={() => go({ page: filters.page - 1 })}>
                    Previous
                  </Button>
                  <Button size="sm" variant="outline" disabled={filters.page >= pages} onClick={() => go({ page: filters.page + 1 })}>
                    Next
                  </Button>
                </div>
              </nav>
            )}
          </>
        )}
      </div>

      <HistoryDrawer vehicleId={history} onClose={() => setHistory(null)} />
      <PreviewModal vehicleId={preview} onClose={() => setPreview(null)} />

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirmed}
        busy={busy}
        tone={confirm?.kind === "archive" ? "danger" : "dark"}
        title={confirm?.kind === "archive" ? `Archive ${confirm.label}?` : confirm?.kind === "withdraw" ? `Withdraw ${confirm.label}?` : `Submit ${confirm?.label ?? ""} for approval?`}
        confirmLabel={confirm?.kind === "archive" ? "Archive" : confirm?.kind === "withdraw" ? "Withdraw to draft" : "Submit for approval"}
      >
        {confirm?.kind === "archive" && (
          <>
            <p>Archived vehicles leave your active list and can&rsquo;t receive enquiries. You can restore them as drafts at any time.</p>
            {confirm.live && <p className="font-medium text-ink">Live listings will be taken off the website straight away.</p>}
          </>
        )}
        {confirm?.kind === "withdraw" && (
          <>
            <p>It goes back to draft so you can keep editing. Submit it again when you&rsquo;re ready.</p>
            {confirm.live && <p className="font-medium text-ink">This listing is live — it will be removed from the website until MarchGear approves it again.</p>}
          </>
        )}
        {confirm?.kind === "submit" && <p>MarchGear checks each listing before it goes live. Incomplete vehicles are skipped and listed with what&rsquo;s missing.</p>}
      </ConfirmDialog>

      <Modal open={Boolean(report)} onClose={() => setReport(null)} title="Submission summary" size="md">
        {report && (
          <div className="px-6 pb-6 pt-5 sm:px-8">
            {report.submitted.length > 0 && (
              <p className="flex items-start gap-2 text-[14px]">
                <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-[#1e7a3c]" />
                <span>
                  <span className="font-semibold">{report.submitted.length}</span> sent for approval: <span className="num">{report.submitted.join(", ")}</span>
                </span>
              </p>
            )}
            {report.skipped.length > 0 && (
              <div className={cn(report.submitted.length > 0 && "mt-5")}>
                <p className="text-[13.5px] font-semibold">Not submitted ({report.skipped.length})</p>
                <ul className="mt-2 divide-y divide-line border border-line">
                  {report.skipped.map((s) => {
                    const row = rows.find((r) => r.reference === s.reference);
                    return (
                      <li key={s.reference} className="flex flex-col gap-1 px-3 py-2.5 text-[13px] sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <div className="min-w-0">
                          <p className="font-medium num">{s.reference}</p>
                          <p className="text-muted">{s.reason}</p>
                        </div>
                        {row && canManage && (
                          <Link href={`/dealer/inventory/${row.id}`} className="shrink-0 text-[13px] font-medium text-red underline-offset-4 hover:underline">
                            Complete it
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <Button variant="dark" onClick={() => setReport(null)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
