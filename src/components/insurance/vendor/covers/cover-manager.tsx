"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  ArrowUpRight,
  Clock3,
  FilePlus2,
  History,
  Layers,
  Loader2,
  Lock,
  MessageSquareWarning,
  PencilLine,
  Plus,
  Save,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import { INS_COVER_STATUS, type InsCoverStatus, type InsCoverType } from "@/db/enums";
import { COVER_PRICING_BASIS_LABEL, STANDARD_COVERS, STANDARD_COVER_BY_KEY, type StandardCover } from "@/insurance/covers";
import { INS_COVER_STATUS_LABEL, INS_COVER_STATUS_TONE, INS_PRODUCT_STATUS_LABEL, INS_PRODUCT_STATUS_TONE } from "@/insurance/labels";
import { FUELS } from "@/insurance/search";
import type { CoverPricing, FuelName } from "@/insurance/types";
import { cn } from "@/lib/utils";
import { Badge, formatDateTime } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { Drawer, Modal } from "@/components/ui/overlay";
import { Tabs } from "@/components/ui/tabs";
import { useUI } from "@/components/providers/app-provider";
import { ConfirmDialog } from "@/components/portal/profile/kit";
import { archiveCoverAction, coverDetailAction, deleteCoverAction, saveCoverAction, withdrawCoverAction } from "@/server/actions/ins-covers";
import { HistoryTimeline } from "@/components/insurance/vendor/approvals/timeline";
import type { HistoryEntry } from "@/components/insurance/vendor/approvals/shared";
import { ChipGroup, Field, LineList, RadioCards, UnitInput, control } from "@/components/insurance/vendor/products/controls";
import { RowMenu, type MenuItem } from "@/components/insurance/vendor/products/row-menu";
import {
  COVER_LIVE,
  COVER_LOCKED,
  COVER_MAX,
  COVER_MIN_DESCRIPTION,
  COVER_SUBMITTABLE,
  COVER_TYPE_META,
  PRICING_RANGE,
  coverFromTemplate,
  coverToForm,
  emptyCover,
  pricingSummary,
  type CoverFormValue,
  type CoverView,
} from "./shared";

/* ──────────────────────────────────────────────────────────────
   /insurance-vendor/coverage and /add-ons: the list (status tabs,
   search), the template picker and the editor drawer with the
   cover's approval history and the products that use it.
   ────────────────────────────────────────────────────────────── */

type Filter = "all" | InsCoverStatus;
type EditorState = { session: number; id: number | null; initial: CoverFormValue; template: StandardCover | null };

export function CoverStatusBadge({ status }: { status: InsCoverStatus }) {
  return <Badge tone={INS_COVER_STATUS_TONE[status]}>{INS_COVER_STATUS_LABEL[status]}</Badge>;
}

export function CoverManager({
  type,
  covers,
  canManage,
  maxAge,
  initialStatus,
  initialOpen,
}: {
  type: InsCoverType;
  covers: CoverView[];
  canManage: boolean;
  maxAge: number;
  initialStatus: string;
  initialOpen: number | null;
}) {
  const router = useRouter();
  const { toast } = useUI();
  const meta = COVER_TYPE_META[type];
  const [filter, setFilter] = useState<Filter>((INS_COVER_STATUS as readonly string[]).includes(initialStatus) ? (initialStatus as InsCoverStatus) : "all");
  const [q, setQ] = useState("");
  const [picker, setPicker] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(() => {
    const c = initialOpen ? covers.find((x) => x.id === initialOpen) : undefined;
    return c ? { session: 1, id: c.id, initial: coverToForm(c), template: STANDARD_COVER_BY_KEY[c.key] ?? null } : null;
  });
  const [confirm, setConfirm] = useState<{ kind: "delete" | "archive" | "withdraw"; cover: CoverView } | null>(null);
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => {
    const c = Object.fromEntries(INS_COVER_STATUS.map((s) => [s, 0])) as Record<InsCoverStatus, number>;
    for (const x of covers) c[x.status]++;
    return c;
  }, [covers]);

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return covers.filter((c) => (filter === "all" || c.status === filter) && (!n || `${c.name} ${c.description} ${c.key} ${STANDARD_COVER_BY_KEY[c.key]?.name ?? ""}`.toLowerCase().includes(n)));
  }, [covers, filter, q]);

  const keepUrl = (patch: Record<string, string | null>) => {
    const url = new URL(window.location.href);
    for (const [k, v] of Object.entries(patch)) {
      if (v) url.searchParams.set(k, v);
      else url.searchParams.delete(k);
    }
    window.history.replaceState(window.history.state, "", url);
  };
  const changeFilter = (f: Filter) => {
    setFilter(f);
    keepUrl({ status: f === "all" ? null : f });
  };

  const openCover = (c: CoverView) => {
    setEditor((e) => ({ session: (e?.session ?? 0) + 1, id: c.id, initial: coverToForm(c), template: STANDARD_COVER_BY_KEY[c.key] ?? null }));
    keepUrl({ open: String(c.id) });
  };
  const startNew = (t: StandardCover | null) => {
    setPicker(false);
    setEditor((e) => ({ session: (e?.session ?? 0) + 1, id: null, initial: t ? coverFromTemplate(t) : emptyCover(type), template: t }));
  };
  const closeEditor = () => {
    setEditor(null);
    keepUrl({ open: null });
  };

  const runConfirmed = async () => {
    if (!confirm) return;
    setBusy(true);
    const { kind, cover } = confirm;
    const res = kind === "delete" ? await deleteCoverAction(cover.id) : kind === "archive" ? await archiveCoverAction(cover.id) : await withdrawCoverAction(cover.id);
    setBusy(false);
    setConfirm(null);
    if (!res.ok) return toast(res.error ?? "Couldn't do that. Please try again.", { tone: "error" });
    toast(kind === "delete" ? `“${cover.name}” deleted` : kind === "archive" ? `“${cover.name}” archived to draft` : `“${cover.name}” withdrawn from review`, { tone: "success" });
    if (kind === "delete" && editor?.id === cover.id) closeEditor();
    router.refresh();
  };

  const submitNow = async (c: CoverView) => {
    const res = await saveCoverAction({ id: c.id, type, intent: "submit", values: coverToForm(c) });
    if (!res.ok) {
      toast(res.error ?? "Couldn't submit.", { tone: "error" });
      openCover(c);
      return;
    }
    toast(`“${c.name}” sent to MarchGear for approval`, { tone: "success" });
    router.refresh();
  };

  const menuFor = (c: CoverView): MenuItem[] => {
    const items: MenuItem[] = [{ label: canManage && !COVER_LOCKED.includes(c.status) ? "Edit" : "Open", icon: <PencilLine className="size-4" />, onSelect: () => openCover(c) }];
    if (!canManage) return items;
    items.push("divider");
    if (COVER_SUBMITTABLE.includes(c.status)) items.push({ label: "Submit for approval", icon: <Send className="size-4" />, onSelect: () => submitNow(c) });
    if (c.status === "pending_approval") items.push({ label: "Withdraw from review", icon: <Undo2 className="size-4" />, onSelect: () => setConfirm({ kind: "withdraw", cover: c }) });
    const deletable = !c.usedBy.length && !c.everApproved;
    if (deletable) items.push({ label: "Delete", icon: <Trash2 className="size-4" />, tone: "danger", onSelect: () => setConfirm({ kind: "delete", cover: c }) });
    else if (c.status !== "draft") items.push({ label: "Archive to draft", icon: <Archive className="size-4" />, tone: "danger", onSelect: () => setConfirm({ kind: "archive", cover: c }) });
    return items;
  };

  const tabs: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "All", count: covers.length },
    { value: "approved", label: "Approved", count: counts.approved },
    { value: "pending_approval", label: "In review", count: counts.pending_approval },
    { value: "changes_requested", label: "Changes requested", count: counts.changes_requested },
    { value: "draft", label: "Drafts", count: counts.draft },
    { value: "rejected", label: "Rejected", count: counts.rejected },
  ];
  const editing = editor?.id ? (covers.find((c) => c.id === editor.id) ?? null) : null;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-[13.5px] leading-relaxed text-muted">{meta.blurb} Only approved ones appear on the website.</p>
        {canManage && (
          <Button onClick={() => setPicker(true)} icon={<Plus aria-hidden className="size-4" />} className="shrink-0">
            New {meta.singular}
          </Button>
        )}
      </div>

      <div role="tablist" aria-label="Status" className="no-scrollbar flex gap-6 overflow-x-auto border-b border-line">
        {tabs.map((t) => {
          const on = filter === t.value;
          return (
            <button
              key={t.value}
              role="tab"
              type="button"
              aria-selected={on}
              onClick={() => changeFilter(t.value)}
              className={cn("relative shrink-0 whitespace-nowrap pb-3.5 text-[14px] font-medium transition-colors duration-[250ms]", on ? "text-ink" : "text-muted hover:text-ink")}
            >
              {t.label}
              <span className={cn("ml-2 rounded-full px-1.5 py-0.5 text-[11px] num", on ? "bg-ink text-white" : "bg-mist text-muted")}>{t.count}</span>
              {on && <span aria-hidden className="absolute inset-x-0 -bottom-px h-[2px] bg-red" />}
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative block sm:w-80">
          <span className="sr-only">Search {meta.plural}</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${meta.plural}`} className={cn(control, "h-10 pl-9 text-[13.5px]")} />
        </label>
        <p className="text-[13px] text-muted num sm:ml-auto" aria-live="polite">
          {shown.length} {shown.length === 1 ? meta.singular : meta.plural}
        </p>
      </div>

      <div className="mt-4">
        {shown.length === 0 ? (
          <div className="border border-line bg-white px-6 py-16 text-center">
            <span className="mx-auto mb-4 inline-flex size-11 items-center justify-center rounded-full bg-mist text-ink/60">{type === "addon" ? <Sparkles className="size-5" /> : <ShieldCheck className="size-5" />}</span>
            <p className="text-[15px] font-semibold">{covers.length ? `No ${meta.plural} match` : `No ${meta.plural} yet`}</p>
            <p className="mx-auto mt-1.5 max-w-md text-[13.5px] text-muted">
              {covers.length ? "Try another status or search." : `Start from one of MarchGear's standard ${meta.plural} — each comes with a plain-language summary and typical pricing you can change — or create your own.`}
            </p>
            {canManage && !covers.length && (
              <Button className="mt-6" onClick={() => setPicker(true)} arrow>
                Choose a template
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden border border-line bg-white md:block">
              <table className="w-full table-fixed border-collapse text-left text-[13.5px]">
                <thead>
                  <tr>
                    <th className="border-b border-line bg-[#fafafa] px-4 py-3 text-[12px] font-semibold text-muted">{type === "addon" ? "Add-on cover" : "Coverage item"}</th>
                    <th className="w-44 border-b border-line bg-[#fafafa] px-4 py-3 text-[12px] font-semibold text-muted">Indicative price</th>
                    <th className="w-40 border-b border-line bg-[#fafafa] px-4 py-3 text-[12px] font-semibold text-muted">Status</th>
                    <th className="w-36 border-b border-line bg-[#fafafa] px-4 py-3 text-[12px] font-semibold text-muted">Used by</th>
                    <th className="w-44 border-b border-line bg-[#fafafa] px-4 py-3 text-[12px] font-semibold text-muted max-xl:hidden">Updated</th>
                    <th className="w-14 border-b border-line bg-[#fafafa] px-2 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((c) => (
                    <tr key={c.id} className="align-top transition-colors duration-200 hover:bg-[#fcfcfc]">
                      <td className="border-b border-line px-4 py-4">
                        <button type="button" onClick={() => openCover(c)} className="block max-w-full text-left">
                          <span className="flex items-center gap-2">
                            <TemplateChip coverKey={c.key} />
                          </span>
                          <span className="mt-1 block truncate font-semibold transition-colors hover:text-red">{c.name}</span>
                          <span className="line-clamp-1 text-[12.5px] text-muted">{c.description || "No description yet"}</span>
                        </button>
                        <Remarks cover={c} onOpen={() => openCover(c)} />
                      </td>
                      <td className="border-b border-line px-4 py-4">
                        <p className="font-medium">{pricingSummary(c.pricing)}</p>
                        {c.maxVehicleAgeYears !== null && <p className="text-[12px] text-muted">Cars up to {c.maxVehicleAgeYears} years</p>}
                      </td>
                      <td className="border-b border-line px-4 py-4">
                        <CoverStatusBadge status={c.status} />
                      </td>
                      <td className="border-b border-line px-4 py-4 text-[13px]">
                        {c.usedBy.length ? (
                          <span title={c.usedBy.map((p) => `${p.reference} ${p.name}`).join("\n")}>
                            <span className="font-semibold num">{c.usedBy.length}</span> {c.usedBy.length === 1 ? "product" : "products"}
                          </span>
                        ) : (
                          <span className="text-muted">Not used yet</span>
                        )}
                      </td>
                      <td className="border-b border-line px-4 py-4 text-[12.5px] text-muted max-xl:hidden">{formatDateTime(c.updatedAt)}</td>
                      <td className="border-b border-line px-2 py-3 text-right">
                        <RowMenu label={c.name} items={menuFor(c)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="space-y-3 md:hidden">
              {shown.map((c) => (
                <li key={c.id} className="border border-line bg-white p-4">
                  <div className="flex gap-3">
                    <button type="button" onClick={() => openCover(c)} className="min-w-0 flex-1 text-left">
                      <TemplateChip coverKey={c.key} />
                      <span className="mt-1 block truncate text-[14px] font-semibold">{c.name}</span>
                      <span className="line-clamp-2 text-[12.5px] text-muted">{c.description || "No description yet"}</span>
                    </button>
                    <div className="-mr-2 -mt-1 shrink-0">
                      <RowMenu label={c.name} items={menuFor(c)} />
                    </div>
                  </div>
                  <Remarks cover={c} onOpen={() => openCover(c)} />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line pt-3">
                    <CoverStatusBadge status={c.status} />
                    <span className="text-[13px] font-medium">{pricingSummary(c.pricing)}</span>
                  </div>
                  <p className="mt-2 text-[12.5px] text-muted">{c.usedBy.length ? `Used by ${c.usedBy.length} ${c.usedBy.length === 1 ? "product" : "products"}` : "Not used by any product yet"}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <TemplatePicker type={type} open={picker} onClose={() => setPicker(false)} existing={covers} onPick={startNew} onOpenExisting={(c) => { setPicker(false); openCover(c); }} />

      {editor && (
        <CoverEditor
          key={editor.session}
          type={type}
          cover={editing}
          coverId={editor.id}
          initial={editor.initial}
          template={editor.template}
          canManage={canManage}
          maxAge={maxAge}
          onClose={closeEditor}
          onSaved={(id) => {
            setEditor((e) => (e ? { ...e, id } : e));
            keepUrl({ open: String(id) });
            router.refresh();
          }}
          onAction={(kind) => editing && setConfirm({ kind, cover: editing })}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm?.kind === "delete" ? `Delete “${confirm.cover.name}”?` : confirm?.kind === "archive" ? `Archive “${confirm?.cover.name}”?` : `Withdraw “${confirm?.cover.name ?? ""}” from review?`}
        confirm={confirm?.kind === "delete" ? "Delete" : confirm?.kind === "archive" ? "Archive to draft" : "Withdraw"}
        tone={confirm?.kind === "withdraw" ? "dark" : "primary"}
        busy={busy}
        onConfirm={runConfirmed}
        body={
          confirm?.kind === "delete" ? (
            "It's removed for good. No product uses it and MarchGear never approved it."
          ) : confirm?.kind === "archive" ? (
            <>
              It goes back to draft and disappears from the website until you submit it and MarchGear approves it again.
              {confirm.cover.usedBy.length > 0 && <span className="mt-2 block font-medium text-ink">{confirm.cover.usedBy.length} of your products list it — it will stop showing on their pages.</span>}
            </>
          ) : (
            "It leaves MarchGear's queue and becomes a draft you can edit. Submit it again when you're ready."
          )
        }
      />
    </div>
  );
}

function TemplateChip({ coverKey }: { coverKey: string }) {
  const std = STANDARD_COVER_BY_KEY[coverKey];
  return <span className="inline-flex h-5 items-center rounded-[3px] border border-line px-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">{std ? "Standard" : "Custom"}</span>;
}

function Remarks({ cover, onOpen }: { cover: CoverView; onOpen: () => void }) {
  if (cover.status !== "changes_requested" && cover.status !== "rejected") return null;
  const rejected = cover.status === "rejected";
  return (
    <button type="button" onClick={onOpen} className={cn("mt-2 flex w-full max-w-md items-start gap-1.5 rounded-[3px] px-2 py-1.5 text-left text-[12.5px]", rejected ? "bg-red-50 text-red" : "bg-[#fdf3e1] text-[#9a5b00]")}>
      <MessageSquareWarning aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <span className="line-clamp-2 min-w-0">
        <span className="font-semibold">MarchGear: </span>
        {cover.adminRemarks || "Open the cover's history for details."}
      </span>
    </button>
  );
}

/* ── Template picker ────────────────────────────────────────── */

function TemplatePicker({
  type,
  open,
  onClose,
  existing,
  onPick,
  onOpenExisting,
}: {
  type: InsCoverType;
  open: boolean;
  onClose: () => void;
  existing: CoverView[];
  onPick: (t: StandardCover | null) => void;
  onOpenExisting: (c: CoverView) => void;
}) {
  const meta = COVER_TYPE_META[type];
  const templates = STANDARD_COVERS.filter((c) => c.type === type);
  const byKey = new Map(existing.map((c) => [c.key, c]));
  return (
    <Modal open={open} onClose={onClose} title={`New ${meta.singular}`} description="Start from a standard template — the summary and typical price are suggestions you can change — or write your own." size="xl">
      <div className="p-5 sm:p-6">
        <button
          type="button"
          onClick={() => onPick(null)}
          className="group/t flex w-full items-center gap-4 border border-line bg-white p-4 text-left transition-colors duration-300 hover:border-ink"
        >
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-red text-white">
            <FilePlus2 aria-hidden className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14.5px] font-semibold">Custom {meta.singular}</span>
            <span className="block text-[12.5px] text-muted">Something not in the standard list — you write the name, terms and price.</span>
          </span>
          <ArrowUpRight aria-hidden className="size-4 shrink-0 text-muted transition-transform duration-300 group-hover/t:-translate-y-0.5 group-hover/t:translate-x-0.5 group-hover/t:text-red" />
        </button>
        <p className="mb-3 mt-6 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Standard templates</p>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => {
            const have = byKey.get(t.key);
            return (
              <li key={t.key} className="min-w-0">
                <button
                  type="button"
                  onClick={() => (have ? onOpenExisting(have) : onPick(t))}
                  className={cn("flex h-full w-full flex-col border bg-white p-4 text-left transition-colors duration-300", have ? "border-line bg-[#fcfcfc] hover:border-ink/40" : "border-line hover:border-ink")}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-[14px] font-semibold leading-snug">{t.name}</span>
                    {have ? <CoverStatusBadge status={have.status} /> : null}
                  </span>
                  <span className="mt-1.5 line-clamp-3 text-[12.5px] leading-relaxed text-muted">{t.summary}</span>
                  <span className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-3 text-[12px] text-ink/75">
                    <span>{pricingSummary(t.defaultPricing)}</span>
                    {t.typicalMaxAge && <span>Up to {t.typicalMaxAge} yrs</span>}
                    {t.fuels?.length ? <span>{t.fuels.length === 1 ? `${t.fuels[0]} only` : `${t.fuels.length} fuels`}</span> : null}
                  </span>
                  {have && <span className="mt-2 text-[12px] font-medium text-red">Already added — open it</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}

/* ── Editor drawer ──────────────────────────────────────────── */

function CoverEditor({
  type,
  cover,
  coverId,
  initial,
  template,
  canManage,
  maxAge,
  onClose,
  onSaved,
  onAction,
}: {
  type: InsCoverType;
  cover: CoverView | null;
  coverId: number | null;
  initial: CoverFormValue;
  template: StandardCover | null;
  canManage: boolean;
  maxAge: number;
  onClose: () => void;
  onSaved: (id: number) => void;
  onAction: (kind: "delete" | "archive" | "withdraw") => void;
}) {
  const { toast } = useUI();
  const meta = COVER_TYPE_META[type];
  const [v, setV] = useState<CoverFormValue>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<"draft" | "submit" | null>(null);
  const [confirmLive, setConfirmLive] = useState(false);
  const [tab, setTab] = useState("details");
  const [history, setHistory] = useState<{ id: number; entries: HistoryEntry[] } | { id: number; error: string } | null>(null);

  const status = cover?.status;
  const live = status ? COVER_LIVE.includes(status) : false;
  const locked = !canManage || (status ? COVER_LOCKED.includes(status) : false);
  const dirty = JSON.stringify(v) !== saved;

  useEffect(() => {
    if (!coverId || tab !== "history") return;
    let on = true;
    coverDetailAction(coverId).then((res) => {
      if (!on) return;
      setHistory(res.ok ? { id: coverId, entries: res.history } : { id: coverId, error: res.error ?? "Couldn't load the history." });
    });
    return () => {
      on = false;
    };
  }, [coverId, tab, status]);

  const patch = (p: Partial<CoverFormValue>) => {
    setV((x) => ({ ...x, ...p }));
    setErrors((e) => {
      const n = { ...e };
      for (const k of Object.keys(p)) for (const ek of Object.keys(n)) if (ek === k || ek.startsWith(`${k}.`)) delete n[ek];
      return n;
    });
  };

  const save = async (intent: "draft" | "submit", acknowledgeLive = false) => {
    setConfirmLive(false);
    setSaving(intent);
    try {
      const res = await saveCoverAction({ id: coverId ?? undefined, type, intent, acknowledgeLive, values: v });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setTab("details");
        toast(res.error ?? "Couldn't save. Please try again.", { tone: "error" });
        return;
      }
      setErrors({});
      setSaved(JSON.stringify(v));
      toast(res.status === "pending_approval" ? `“${v.name}” sent to MarchGear for approval` : coverId ? `“${v.name}” saved` : `Draft “${v.name}” created`, { tone: "success" });
      onSaved(res.id);
    } catch {
      toast("Couldn't reach the server. Please try again.", { tone: "error" });
    } finally {
      setSaving(null);
    }
  };
  const request = (intent: "draft" | "submit") => (live ? setConfirmLive(true) : save(intent));

  const err = (k: string) => errors[k];
  const range = PRICING_RANGE[v.pricing.basis];
  const title = cover?.name || v.name || (template ? template.name : `New ${meta.singular}`);
  const historyFor = history && history.id === coverId ? history : null;
  const busy = saving !== null;

  const footer = canManage ? (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3 text-[12.5px]">
        {cover && !cover.usedBy.length && !cover.everApproved && (
          <button type="button" onClick={() => onAction("delete")} className="inline-flex items-center gap-1.5 font-medium text-muted hover:text-red">
            <Trash2 aria-hidden className="size-3.5" /> Delete
          </button>
        )}
        {cover && (cover.usedBy.length > 0 || cover.everApproved) && cover.status !== "draft" && (
          <button type="button" onClick={() => onAction("archive")} className="inline-flex items-center gap-1.5 font-medium text-muted hover:text-red">
            <Archive aria-hidden className="size-3.5" /> Archive to draft
          </button>
        )}
        {!cover && <span className="text-muted">{dirty ? "Not saved yet" : "Fill in the details, then save"}</span>}
      </div>
      {status === "pending_approval" ? (
        <Button size="sm" variant="outline" onClick={() => onAction("withdraw")} icon={<Undo2 aria-hidden className="size-4" />}>
          Withdraw from review
        </Button>
      ) : (
        <div className="flex gap-2">
          {!live && (
            <Button size="sm" variant="outline" className="flex-1 sm:flex-none" disabled={busy} onClick={() => request("draft")} icon={saving === "draft" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Save aria-hidden className="size-4" />}>
              Save draft
            </Button>
          )}
          <Button size="sm" className="flex-1 sm:flex-none" disabled={busy || (live && !dirty)} onClick={() => request("submit")} icon={saving === "submit" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Send aria-hidden className="size-4" />}>
            {live ? "Save and resubmit" : status && cover?.submittedAt ? "Resubmit for approval" : "Submit for approval"}
          </Button>
        </div>
      )}
    </div>
  ) : undefined;

  return (
    <Drawer open onClose={onClose} title={title} className="sm:max-w-2xl" footer={footer}>
      <div className="px-5 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          {status ? <CoverStatusBadge status={status} /> : <Badge tone="neutral">Not saved yet</Badge>}
          <span className="text-[12.5px] text-muted">{template ? `From the “${template.name}” template` : `Custom ${meta.singular}`}{cover ? " ·" : ""}</span>
          {cover && <span className="text-[12.5px] text-muted">Updated {formatDateTime(cover.updatedAt)}</span>}
        </div>
        {coverId && <Tabs items={[{ value: "details", label: "Details" }, { value: "history", label: "History" }]} value={tab} onChange={setTab} size="sm" className="mt-4" ariaLabel="Cover sections" />}
      </div>

      {tab === "history" && coverId ? (
        <div className="p-5">
          {!historyFor && (
            <p className="flex items-center gap-2 text-[13.5px] text-muted">
              <Loader2 aria-hidden className="size-4 animate-spin" /> Loading…
            </p>
          )}
          {historyFor && "error" in historyFor && <p className="text-[13.5px] text-red">{historyFor.error}</p>}
          {historyFor && "entries" in historyFor && <HistoryTimeline entries={historyFor.entries} empty="Not submitted yet. When you submit it, every step and MarchGear's remarks appear here." />}
        </div>
      ) : (
        <div className="space-y-6 p-5">
          {cover && (cover.status === "changes_requested" || cover.status === "rejected") && (
            <div className={cn("flex gap-3 border-l-2 px-4 py-3", cover.status === "rejected" ? "border-red bg-red-50" : "border-[#c98a1b] bg-[#fdf3e1]")} role="note">
              <MessageSquareWarning aria-hidden className={cn("mt-0.5 size-4 shrink-0", cover.status === "rejected" ? "text-red" : "text-[#9a5b00]")} />
              <div className="min-w-0 text-[13.5px]">
                <p className={cn("font-semibold", cover.status === "rejected" ? "text-red" : "text-[#9a5b00]")}>{cover.status === "rejected" ? "Rejected by MarchGear" : "MarchGear asked for changes"}</p>
                <p className="mt-0.5 whitespace-pre-line text-ink/85">{cover.adminRemarks || "No remarks were left. See the History tab or contact support."}</p>
              </div>
            </div>
          )}
          {status === "pending_approval" && (
            <p className="flex gap-3 border-l-2 border-[#2456a6] bg-[#e9f0fb] px-4 py-3 text-[13.5px]" role="note">
              <Clock3 aria-hidden className="mt-0.5 size-4 shrink-0 text-[#2456a6]" />
              <span>Waiting for MarchGear&rsquo;s review. It&rsquo;s locked until it&rsquo;s decided — withdraw it if you need to change something.</span>
            </p>
          )}
          {live && canManage && (
            <p className="flex gap-3 border-l-2 border-ink bg-white px-4 py-3 text-[13.5px] ring-1 ring-inset ring-line" role="note">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-red" />
              <span>
                <span className="font-semibold">This cover is approved.</span> Saving a change sends it back to MarchGear and hides it from product pages until it&rsquo;s approved again.
              </span>
            </p>
          )}
          {!canManage && (
            <p className="flex gap-2 text-[13px] text-muted">
              <Lock aria-hidden className="mt-0.5 size-4 shrink-0" /> You can view covers. Changing them needs the &ldquo;Create, edit and submit products&rdquo; permission.
            </p>
          )}

          <fieldset disabled={locked} className="space-y-5">
            <Field name="name" label="Name" htmlFor="cv-name" error={err("name")}>
              <input id="cv-name" className={control} value={v.name} maxLength={COVER_MAX.name} onChange={(e) => patch({ name: e.target.value })} placeholder={type === "addon" ? "e.g. Zero depreciation" : "e.g. Natural calamities"} aria-invalid={err("name") ? true : undefined} />
            </Field>
            <Field name="description" label="What it covers" htmlFor="cv-desc" error={err("description")} hint={`Plain language for customers. ${v.description.trim().length} / ${COVER_MIN_DESCRIPTION}+ characters.`}>
              <textarea
                id="cv-desc"
                rows={4}
                className={cn(control, "h-auto py-2.5 leading-relaxed")}
                value={v.description}
                maxLength={COVER_MAX.description}
                onChange={(e) => patch({ description: e.target.value })}
                aria-invalid={err("description") ? true : undefined}
              />
            </Field>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field name="eligibility" label="Eligibility" optional htmlFor="cv-elig" error={err("eligibility")} hint="e.g. “Cars up to 5 years old, first two claims a year”">
                <input id="cv-elig" className={control} value={v.eligibility} maxLength={COVER_MAX.eligibility} onChange={(e) => patch({ eligibility: e.target.value })} />
              </Field>
              <Field name="maxVehicleAgeYears" label="Maximum car age" optional htmlFor="cv-age" error={err("maxVehicleAgeYears")} hint={`Leave empty for any age (the site estimates up to ${maxAge} years).`}>
                <UnitInput id="cv-age" value={v.maxVehicleAgeYears} onChange={(x) => patch({ maxVehicleAgeYears: x.replace(/\D/g, "").slice(0, 2) })} suffix="years" inputMode="numeric" error={err("maxVehicleAgeYears")} />
              </Field>
            </div>
            <Field name="fuels" label="Only for these fuels" optional error={err("fuels")} hint={v.fuels.length ? undefined : "None selected — offered for every fuel."}>
              <ChipGroup ariaLabel="Fuels" options={FUELS.map((f) => ({ value: f, label: f }))} value={v.fuels} onChange={(fuels) => patch({ fuels: fuels as FuelName[] })} disabled={locked} />
            </Field>
            <Field name="limits" label="Limits" optional htmlFor="cv-limits" error={err("limits")} hint="e.g. “Up to 2 claims per policy year”">
              <input id="cv-limits" className={control} value={v.limits} maxLength={COVER_MAX.limits} onChange={(e) => patch({ limits: e.target.value })} />
            </Field>
            <Field name="exclusions" label="Exclusions" optional error={err("exclusions")}>
              <LineList ariaLabel="Add an exclusion" value={v.exclusions} onChange={(exclusions) => patch({ exclusions })} max={COVER_MAX.exclusions} placeholder="e.g. Tyres and tubes, unless damaged with the vehicle" disabled={locked} />
            </Field>

            <div data-field="pricing" className="border-t border-line pt-5">
              <p className="text-[13.5px] font-semibold">Pricing for the indicative estimate</p>
              <p className="mt-0.5 text-[12.5px] text-muted">The site shows this as part of an indicative premium — never as a quote.</p>
              <div className="mt-4">
                <RadioCards<CoverPricing["basis"]>
                  ariaLabel="Pricing basis"
                  value={v.pricing.basis}
                  disabled={locked}
                  onChange={(basis) => patch({ pricing: { basis, value: basis === "included" ? "0" : v.pricing.basis === "included" ? "" : v.pricing.value } })}
                  options={(Object.keys(COVER_PRICING_BASIS_LABEL) as CoverPricing["basis"][]).map((b) => ({ value: b, label: COVER_PRICING_BASIS_LABEL[b] }))}
                />
              </div>
              {v.pricing.basis !== "included" && (
                <Field name="pricing.value" label={v.pricing.basis === "flat" ? "Amount per year" : v.pricing.basis === "pct_idv" ? "Rate (% of IDV)" : "Rate (% of own-damage premium)"} htmlFor="cv-price" error={err("pricing.value")} className="mt-4 sm:max-w-xs" hint={`Between ${range.unit === "₹" ? "₹" : ""}${range.min.toLocaleString("en-IN")} and ${range.unit === "₹" ? "₹" : ""}${range.max.toLocaleString("en-IN")}${range.unit === "%" ? "%" : ""}.`}>
                  <UnitInput
                    id="cv-price"
                    value={v.pricing.value}
                    onChange={(x) => patch({ pricing: { ...v.pricing, value: x.replace(/[^\d.]/g, "").slice(0, 9) } })}
                    prefix={range.unit === "₹" ? "₹" : undefined}
                    suffix={range.unit === "%" ? "%" : undefined}
                    error={err("pricing.value")}
                  />
                </Field>
              )}
            </div>
          </fieldset>

          {cover && (
            <section className="border-t border-line pt-5">
              <p className="flex items-center gap-2 text-[13.5px] font-semibold">
                <Layers aria-hidden className="size-4 text-muted" /> Used by
              </p>
              {cover.usedBy.length ? (
                <ul className="mt-3 divide-y divide-line border border-line">
                  {cover.usedBy.map((p) => (
                    <li key={p.id}>
                      <Link href={`/insurance-vendor/products/${p.id}`} className="flex items-center justify-between gap-3 px-3 py-2.5 text-[13px] transition-colors hover:bg-mist/60">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{p.name}</span>
                          <span className="text-[11.5px] text-muted num">{p.reference}</span>
                        </span>
                        <Badge tone={INS_PRODUCT_STATUS_TONE[p.status]}>{INS_PRODUCT_STATUS_LABEL[p.status]}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[13px] text-muted">No product uses it yet. Add it from a product&rsquo;s {type === "addon" ? "Add-on covers" : "Coverage"} section.</p>
              )}
              {cover.status !== "approved" && cover.usedBy.some((p) => p.status === "published") && (
                <p className="mt-3 flex gap-2 text-[12.5px] text-[#9a5b00]">
                  <History aria-hidden className="mt-0.5 size-3.5 shrink-0" /> It isn&rsquo;t approved, so it doesn&rsquo;t show on those products&rsquo; public pages yet.
                </p>
              )}
            </section>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmLive}
        onClose={() => setConfirmLive(false)}
        title="Send this approved cover back for approval?"
        confirm="Save and resubmit"
        tone="primary"
        busy={busy}
        onConfirm={() => save("submit", true)}
        body={
          <>
            Your changes go to MarchGear for review. <strong className="font-semibold text-ink">It goes offline on product pages until it&rsquo;s approved again.</strong>
          </>
        }
      />
    </Drawer>
  );
}
