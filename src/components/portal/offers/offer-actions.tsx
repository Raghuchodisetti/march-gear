"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CheckCircle2,
  Copy,
  History,
  Loader2,
  MoreHorizontal,
  PauseCircle,
  Pencil,
  PlayCircle,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Drawer, Modal, useIsClient } from "@/components/ui/overlay";
import { useUI } from "@/components/providers/app-provider";
import { OFFER_STATUS_LABEL, type OfferDisplayStatus } from "@/partner/labels";
import {
  cancelOfferAction,
  deleteOfferDraftAction,
  duplicateOfferAction,
  offerHistoryAction,
  pauseOfferAction,
  resumeOfferAction,
  submitOfferByIdAction,
  withdrawOfferAction,
} from "@/server/actions/partner-offers";
import { formatIst } from "@/components/offers/offer-utils";
import { OFFER_STEPS, stepOfField, type ApprovalEntry, type OfferListItem } from "./offer-input";
import { Callout, StatusPill } from "./offer-ui";

/* ──────────────────────────────────────────────────────────────
   What a dealer can do with an offer from the list and calendar,
   with the confirmation dialogs and the approval-history drawer.
   ────────────────────────────────────────────────────────────── */

export type OfferCommand = "edit" | "editLive" | "submit" | "withdraw" | "pause" | "resume" | "cancel" | "duplicate" | "delete" | "history";

/** The commands that apply to an offer in its current state. */
export function commandsFor(o: Pick<OfferListItem, "status" | "display" | "approvedAt">, canManage: boolean): OfferCommand[] {
  if (!canManage) return ["history"];
  const d: OfferDisplayStatus = o.display;
  const out: OfferCommand[] = [];
  if (d === "draft" || d === "changes_requested") out.push("edit", "submit");
  if (d === "submitted" || d === "pending_approval") out.push("withdraw");
  if (d === "scheduled" || d === "active") out.push("pause", "editLive");
  if (d === "paused") out.push("resume", "editLive");
  if (d === "expired") out.push("editLive");
  out.push("duplicate", "history");
  if (["submitted", "pending_approval", "changes_requested", "scheduled", "active", "paused"].includes(d)) out.push("cancel");
  if (d === "draft" && !o.approvedAt) out.push("delete");
  return out;
}

const META: Record<OfferCommand, { label: string; icon: ReactNode; danger?: boolean }> = {
  edit: { label: "Edit", icon: <Pencil /> },
  editLive: { label: "Edit offer", icon: <Pencil /> },
  submit: { label: "Submit for approval", icon: <Send /> },
  withdraw: { label: "Withdraw from review", icon: <Undo2 /> },
  pause: { label: "Pause offer", icon: <PauseCircle /> },
  resume: { label: "Resume offer", icon: <PlayCircle /> },
  cancel: { label: "Cancel offer", icon: <Ban />, danger: true },
  duplicate: { label: "Duplicate", icon: <Copy /> },
  delete: { label: "Delete draft", icon: <Trash2 />, danger: true },
  history: { label: "Approval history", icon: <History /> },
};

type Failure = { ok: false; error?: string; fieldErrors?: Record<string, string> };
const failure = (r: { ok: boolean }): Failure | null => (r.ok ? null : (r as Failure));

/** Everything needed to run commands and show their dialogs. Mount once per page. */
export function useOfferCommands() {
  const router = useRouter();
  const { toast } = useUI();
  const [dialog, setDialog] = useState<{ cmd: OfferCommand; item: OfferListItem } | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const refresh = () => startTransition(() => router.refresh());

  const run = async (cmd: OfferCommand, item: OfferListItem) => {
    if (cmd === "edit") return router.push(`/dealer/offers/${item.id}/edit`);
    if (cmd === "duplicate") {
      setBusy(true);
      try {
        const res = await duplicateOfferAction({ id: item.id, mode: "duplicate" });
        const f = failure(res);
        if (f || !res.ok) return toast(f?.error ?? "Couldn't duplicate the offer.", { tone: "error" });
        toast(`Duplicated as draft ${res.reference}`, { tone: "success", action: { label: "Open draft", href: `/dealer/offers/${res.id}/edit` } });
        refresh();
      } catch {
        toast("Couldn't reach the server. Check your connection.", { tone: "error" });
      } finally {
        setBusy(false);
      }
      return;
    }
    setDialog({ cmd, item });
  };

  const node = <CommandDialogs dialog={dialog} onClose={() => setDialog(null)} onDone={refresh} />;
  return { run, busy, node };
}

/* ── Menu ───────────────────────────────────────────────────── */

/** Shorter primary-button labels for tight table rows. */
const SHORT_LABEL: Partial<Record<OfferCommand, string>> = { submit: "Submit", history: "History", resume: "Resume", withdraw: "Withdraw" };

/** Primary action button + "more" menu for one offer. */
export function OfferActions({ item, canManage, run, className, compact }: { item: OfferListItem; canManage: boolean; run: (c: OfferCommand, i: OfferListItem) => void; className?: string; compact?: boolean }) {
  const cmds = commandsFor(item, canManage);
  // Changes requested: fixing comes first. Drafts: submitting (the dialog lists anything still missing).
  const primary: OfferCommand = item.display === "changes_requested" && cmds.includes("edit") ? "edit" : cmds.includes("submit") ? "submit" : cmds.includes("edit") ? "edit" : cmds.includes("resume") ? "resume" : cmds.includes("withdraw") ? "withdraw" : "history";
  const rest = cmds.filter((c) => c !== primary);
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {primary === "edit" ? (
        <Button href={`/dealer/offers/${item.id}/edit`} size="sm" variant="outline" icon={<Pencil className="size-3.5" aria-hidden />}>
          {item.display === "changes_requested" ? "Make changes" : compact ? "Edit" : "Continue editing"}
        </Button>
      ) : (
        <Button size="sm" variant={primary === "submit" ? "primary" : "outline"} onClick={() => run(primary, item)} icon={<span className="[&>svg]:size-3.5">{META[primary].icon}</span>}>
          {compact ? (SHORT_LABEL[primary] ?? META[primary].label) : META[primary].label}
        </Button>
      )}
      {rest.length > 0 && <MoreMenu items={rest} onPick={(c) => run(c, item)} label={`More actions for ${item.title || item.reference}`} />}
    </div>
  );
}

function MoreMenu({ items, onPick, label }: { items: OfferCommand[]; onPick: (c: OfferCommand) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const isClient = useIsClient();

  // Anchored to the button; follows it while the page scrolls, closes once it leaves the screen.
  const place = useCallback(() => {
    if (!btn.current) return;
    const r = btn.current.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return setOpen(false);
    const width = 232;
    const height = items.length * 40 + 12;
    const up = r.bottom + height + 8 > window.innerHeight && r.top > height + 8;
    setPos({ top: up ? r.top - height - 6 : r.bottom + 6, left: Math.max(8, Math.min(window.innerWidth - width - 8, r.right - width)), up });
  }, [items.length]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e.type === "keydown" && (e as KeyboardEvent).key !== "Escape") return;
      if (e.type === "mousedown" && (panel.current?.contains(e.target as Node) || btn.current?.contains(e.target as Node))) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn("inline-flex size-9 items-center justify-center rounded-[3px] border border-line bg-white text-ink transition-colors hover:border-ink", open && "border-ink")}
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </button>
      {isClient &&
        createPortal(
          <AnimatePresence>
            {open && pos && (
              <motion.div
                ref={panel}
                role="menu"
                initial={{ opacity: 0, y: pos.up ? 6 : -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: pos.up ? 4 : -4 }}
                transition={{ duration: 0.22, ease: EASE }}
                style={{ top: pos.top, left: pos.left, width: 232 }}
                className="fixed z-[90] rounded-[4px] border border-line bg-white p-1.5 shadow-lift"
              >
                {items.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      onPick(c);
                    }}
                    className={cn(
                      "flex h-10 w-full items-center gap-2.5 rounded-[3px] px-3 text-left text-[13.5px] transition-colors [&>svg]:size-4 [&>svg]:shrink-0",
                      META[c].danger ? "text-red hover:bg-red-50" : "text-ink hover:bg-mist",
                    )}
                  >
                    {META[c].icon}
                    {META[c].label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

/* ── Dialogs ────────────────────────────────────────────────── */

const COPY: Partial<Record<OfferCommand, { title: string; body: (o: OfferListItem) => ReactNode; cta: string; danger?: boolean }>> = {
  withdraw: {
    title: "Withdraw from review?",
    body: () => "The offer goes back to draft so you can edit it. You'll need to submit it again for approval.",
    cta: "Withdraw to draft",
  },
  pause: {
    title: "Pause this offer?",
    body: (o) => (
      <>
        It disappears from the MarchGear website straight away{o.display === "scheduled" ? " and won't go live on its start date" : ""}. Resume it any time before{" "}
        <span className="font-medium text-ink">{formatIst(o.endsAt)}</span> — no new approval is needed.
      </>
    ),
    cta: "Pause offer",
  },
  resume: {
    title: "Resume this offer?",
    body: (o) =>
      new Date(o.endsAt).getTime() < Date.now()
        ? "Its end date has passed, so it will show as expired. Edit the dates (and resubmit) to run it again."
        : new Date(o.startsAt).getTime() > Date.now()
          ? `It goes back to scheduled and will go live on ${formatIst(o.startsAt)}.`
          : "It goes live on the website again straight away, with the approved details.",
    cta: "Resume offer",
  },
  delete: {
    title: "Delete this draft?",
    body: () => "The draft and its settings are removed for good. Uploaded images stay in your media library.",
    cta: "Delete draft",
    danger: true,
  },
};

const ACTION_FOR = {
  withdraw: withdrawOfferAction,
  pause: pauseOfferAction,
  resume: resumeOfferAction,
  delete: deleteOfferDraftAction,
} as const;

const DONE: Partial<Record<OfferCommand, string>> = {
  withdraw: "Withdrawn — the offer is a draft again",
  pause: "Offer paused and hidden from the website",
  resume: "Offer resumed",
  delete: "Draft deleted",
  cancel: "Offer cancelled",
};

function CommandDialogs({ dialog, onClose, onDone }: { dialog: { cmd: OfferCommand; item: OfferListItem } | null; onClose: () => void; onDone: () => void }) {
  const cmd = dialog?.cmd;
  const item = dialog?.item;
  return (
    <>
      <Modal open={Boolean(dialog && COPY[dialog.cmd])} onClose={onClose} size="sm" bare>
        {item && cmd && COPY[cmd] && <SimpleConfirm key={`${cmd}-${item.id}`} cmd={cmd as keyof typeof ACTION_FOR} item={item} onClose={onClose} onDone={onDone} />}
      </Modal>
      <Modal open={cmd === "submit"} onClose={onClose} size="md" bare>
        {item && cmd === "submit" && <SubmitConfirm key={item.id} item={item} onClose={onClose} onDone={onDone} />}
      </Modal>
      <Modal open={cmd === "cancel"} onClose={onClose} size="sm" bare>
        {item && cmd === "cancel" && <CancelConfirm key={item.id} item={item} onClose={onClose} onDone={onDone} />}
      </Modal>
      <Modal open={cmd === "editLive"} onClose={onClose} size="md" bare>
        {item && cmd === "editLive" && <EditLiveWarning item={item} onClose={onClose} />}
      </Modal>
      <Drawer open={cmd === "history"} onClose={onClose} title="Approval history">
        {item && cmd === "history" && <HistoryPanel key={item.id} item={item} />}
      </Drawer>
    </>
  );
}

function DialogShell({ icon, tone = "ink", title, children, footer }: { icon: ReactNode; tone?: "ink" | "red" | "amber"; title: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div>
      <div className="px-6 pb-2 pt-7 sm:px-7">
        <span
          className={cn(
            "inline-flex size-11 items-center justify-center rounded-full [&>svg]:size-5",
            tone === "red" ? "bg-red-50 text-red" : tone === "amber" ? "bg-[#fdf3e1] text-[#9a5b00]" : "bg-mist text-ink",
          )}
        >
          {icon}
        </span>
        <h2 className="type-h3 mt-4">{title}</h2>
        <div className="mt-2 text-[14px] leading-relaxed text-muted">{children}</div>
      </div>
      <div className="mt-5 flex flex-col-reverse gap-2 border-t border-line bg-[#F6F6F6] px-6 py-4 sm:flex-row sm:justify-end sm:px-7">{footer}</div>
    </div>
  );
}

function useSubmitting() {
  const [pending, setPending] = useState(false);
  const { toast } = useUI();
  const go = async <R extends { ok: boolean }>(fn: () => Promise<R>, onOk: (r: R) => void, onFail?: (f: Failure) => void) => {
    setPending(true);
    try {
      const r = await fn();
      const f = failure(r);
      if (f) {
        if (onFail) onFail(f);
        else toast(f.error ?? "Something went wrong.", { tone: "error" });
        return;
      }
      onOk(r);
    } catch {
      toast("Couldn't reach the server. Check your connection and try again.", { tone: "error" });
    } finally {
      setPending(false);
    }
  };
  return { pending, go };
}

function SimpleConfirm({ cmd, item, onClose, onDone }: { cmd: keyof typeof ACTION_FOR; item: OfferListItem; onClose: () => void; onDone: () => void }) {
  const { toast } = useUI();
  const { pending, go } = useSubmitting();
  const c = COPY[cmd]!;
  return (
    <DialogShell
      icon={META[cmd].icon}
      tone={c.danger ? "red" : cmd === "pause" ? "amber" : "ink"}
      title={c.title}
      footer={
        <>
          <Button variant="ghost" size="md" onClick={onClose}>
            Keep as is
          </Button>
          <Button
            variant={c.danger ? "primary" : "dark"}
            disabled={pending}
            icon={pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}
            onClick={() =>
              go(
                () => ACTION_FOR[cmd]({ id: item.id }),
                () => {
                  toast(DONE[cmd] ?? "Done", { tone: "success" });
                  onClose();
                  onDone();
                },
              )
            }
          >
            {c.cta}
          </Button>
        </>
      }
    >
      <p className="mb-2 font-medium text-ink">{item.title || item.reference}</p>
      {c.body(item)}
    </DialogShell>
  );
}

function CancelConfirm({ item, onClose, onDone }: { item: OfferListItem; onClose: () => void; onDone: () => void }) {
  const { toast } = useUI();
  const { pending, go } = useSubmitting();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  return (
    <DialogShell
      icon={<Ban />}
      tone="red"
      title="Cancel this offer?"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep offer
          </Button>
          <Button
            disabled={pending}
            icon={pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}
            onClick={() =>
              go(
                () => cancelOfferAction({ id: item.id, reason: reason.trim() || undefined }),
                () => {
                  toast(DONE.cancel!, { tone: "success" });
                  onClose();
                  onDone();
                },
                (f) => (f.fieldErrors?.reason ? setError(f.fieldErrors.reason) : toast(f.error ?? "Couldn't cancel the offer.", { tone: "error" })),
              )
            }
          >
            Cancel offer
          </Button>
        </>
      }
    >
      <p className="mb-2 font-medium text-ink">{item.title || item.reference}</p>
      <p>Cancelling is permanent{item.display === "active" ? " and removes it from the website immediately" : ""}. You can still duplicate it later.</p>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-[12.5px] font-medium text-ink">Reason (optional, kept in the approval history)</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={500}
          aria-invalid={error ? true : undefined}
          className="w-full rounded-[3px] border border-line px-3 py-2 text-[14px] text-ink outline-none transition-colors hover:border-ink/30 focus:border-ink aria-[invalid=true]:border-red"
        />
        {error && <span className="mt-1 block text-xs text-red">{error}</span>}
      </label>
    </DialogShell>
  );
}

function SubmitConfirm({ item, onClose, onDone }: { item: OfferListItem; onClose: () => void; onDone: () => void }) {
  const { toast } = useUI();
  const { pending, go } = useSubmitting();
  const [confirm, setConfirm] = useState(false);
  const [issues, setIssues] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string>();
  const list = issues ? Object.entries(issues).filter(([k]) => k !== "confirmTerms") : [];
  const firstStep = list.length ? stepOfField(list[0][0]) : null;

  if (list.length)
    return (
      <DialogShell
        icon={<AlertTriangle />}
        tone="amber"
        title={`${list.length} thing${list.length === 1 ? "" : "s"} to fix first`}
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button href={`/dealer/offers/${item.id}/edit${firstStep ? `?step=${firstStep}` : ""}`} variant="dark" arrow>
              Fix in the editor
            </Button>
          </>
        }
      >
        <ul className="mt-1 space-y-2">
          {list.map(([k, msg]) => {
            const step = OFFER_STEPS.find((s) => s.key === stepOfField(k))!;
            return (
              <li key={k} className="flex gap-3 rounded-[3px] border border-line bg-white px-3 py-2.5">
                <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-mist font-mono text-[11px] font-semibold text-ink">{step.letter}</span>
                <span className="min-w-0 text-[13px]">
                  <span className="block text-[11.5px] font-medium uppercase tracking-[0.08em] text-muted">{step.title}</span>
                  <span className="text-ink">{msg}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </DialogShell>
    );

  return (
    <DialogShell
      icon={<Send />}
      title="Submit for approval"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Not yet
          </Button>
          <Button
            disabled={pending}
            icon={pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
            onClick={() => {
              if (!confirm) return setError("Please confirm before submitting");
              go(
                () => submitOfferByIdAction({ id: item.id, confirmTerms: true }),
                () => {
                  toast("Submitted — MarchGear will review your offer", { tone: "success" });
                  onClose();
                  onDone();
                },
                (f) => (f.fieldErrors && Object.keys(f.fieldErrors).length ? setIssues(f.fieldErrors) : toast(f.error ?? "Couldn't submit the offer.", { tone: "error" })),
              );
            }}
          >
            Submit for approval
          </Button>
        </>
      }
    >
      <p className="mb-2 font-medium text-ink">{item.title || item.reference}</p>
      <p>MarchGear reviews every offer before it goes live. Once approved it appears on the website automatically on its start date and expires on its end date.</p>
      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-[3px] border border-line bg-white p-3 text-[13px] text-ink">
        <input
          type="checkbox"
          checked={confirm}
          onChange={(e) => {
            setConfirm(e.target.checked);
            setError(undefined);
          }}
          className="mt-0.5 size-4 shrink-0 accent-[var(--color-red)]"
        />
        <span>I confirm the offer details, benefits and terms are accurate, and the dealership will honour them for every eligible customer.</span>
      </label>
      {error && <p className="mt-1.5 text-xs text-red">{error}</p>}
    </DialogShell>
  );
}

function EditLiveWarning({ item, onClose }: { item: OfferListItem; onClose: () => void }) {
  const live = item.display === "active" || item.display === "scheduled";
  return (
    <DialogShell
      icon={<AlertTriangle />}
      tone="amber"
      title="Editing sends the offer back for approval"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button href={`/dealer/offers/${item.id}/edit`} variant="dark" arrow>
            Continue to editor
          </Button>
        </>
      }
    >
      <p className="mb-2 font-medium text-ink">{item.title || item.reference}</p>
      <p>
        Your changes are only saved when you resubmit. Until then the approved version {live ? "stays live" : "is unchanged"}. Once you resubmit, the offer{" "}
        {live ? "is removed from the website" : "stays off the website"} until MarchGear approves it again.
      </p>
      <Callout tone="neutral" className="mt-4">
        Just need to stop it for a while? <span className="font-medium text-ink">Pause</span> keeps the approval — resume any time.
      </Callout>
    </DialogShell>
  );
}

/* ── History ────────────────────────────────────────────────── */

const ACTION_LABEL: Record<string, string> = {
  submitted: "Submitted for approval",
  resubmitted: "Resubmitted for approval",
  withdrawn: "Withdrawn from review",
  approved: "Approved",
  approve: "Approved",
  rejected: "Rejected",
  reject: "Rejected",
  changes_requested: "Changes requested",
  request_changes: "Changes requested",
  paused: "Paused",
  resumed: "Resumed",
  cancelled: "Cancelled",
  under_review: "Review started",
  scheduled: "Scheduled by MarchGear",
  extended: "End date extended",
  created: "Created",
};
const humanise = (a: string) => ACTION_LABEL[a] ?? a.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const statusLabel = (s: string | null) => (s && s in OFFER_STATUS_LABEL ? OFFER_STATUS_LABEL[s as OfferDisplayStatus] : s);

function HistoryPanel({ item }: { item: OfferListItem }) {
  const [state, setState] = useState<{ items: ApprovalEntry[]; remarks: string | null } | { error: string } | null>(null);
  useEffect(() => {
    let alive = true;
    offerHistoryAction({ id: item.id })
      .then((r) => alive && setState(r.ok ? { items: r.items, remarks: r.remarks } : { error: (r as Failure).error ?? "Couldn't load the history." }))
      .catch(() => alive && setState({ error: "Couldn't reach the server." }));
    return () => {
      alive = false;
    };
  }, [item.id]);

  return (
    <div className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11.5px] text-muted">{item.reference}</p>
          <p className="mt-0.5 text-[15px] font-semibold leading-snug">{item.title || "Untitled offer"}</p>
        </div>
        <StatusPill status={item.display} />
      </div>
      {state && "items" in state && state.remarks && (
        <Callout tone={item.status === "rejected" ? "red" : "amber"} title="Remarks from MarchGear" className="mt-5">
          <p className="whitespace-pre-line">{state.remarks}</p>
        </Callout>
      )}
      <div className="mt-6">
        {!state ? (
          <div className="space-y-4" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-14 rounded-[3px]" />
            ))}
          </div>
        ) : "error" in state ? (
          <p className="text-[13.5px] text-red">{state.error}</p>
        ) : state.items.length === 0 ? (
          <p className="text-[13.5px] text-muted">Nothing yet — the history starts when the offer is first submitted.</p>
        ) : (
          <ol className="relative space-y-6 border-l border-line pl-6">
            {state.items.map((e) => (
              <li key={e.id} className="relative">
                <span
                  aria-hidden
                  className={cn(
                    "absolute -left-[31px] top-0.5 inline-flex size-[13px] items-center justify-center rounded-full border-2 border-white",
                    e.actorSide === "admin" ? "bg-red" : "bg-ink/70",
                  )}
                />
                <p className="text-[13.5px] font-semibold">{humanise(e.action)}</p>
                <p className="mt-0.5 text-[12px] text-muted">
                  {e.actorSide === "admin" ? "MarchGear" : (e.actorName ?? "Your team")} · {formatIst(e.createdAt)}
                </p>
                {(e.fromStatus || e.toStatus) && (
                  <p className="mt-1 inline-flex flex-wrap items-center gap-1.5 text-[12px] text-ink/70">
                    {statusLabel(e.fromStatus)} <ArrowRight aria-hidden className="size-3" /> {statusLabel(e.toStatus)}
                  </p>
                )}
                {e.remarks && <p className="mt-2 whitespace-pre-line rounded-[3px] bg-[#F6F6F6] px-3 py-2 text-[13px] text-ink/80">{e.remarks}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>
      {item.approvedAt && (
        <p className="mt-8 inline-flex items-center gap-2 text-[12.5px] text-muted">
          <CheckCircle2 aria-hidden className="size-4 text-[#1e7a3c]" /> Last approved {formatIst(item.approvedAt)}
        </p>
      )}
      <p className="mt-6 text-[12.5px]">
        <Link href={`/dealer/offers/${item.id}/edit`} className="font-medium text-ink underline-offset-4 hover:underline">
          Open the offer
        </Link>
      </p>
    </div>
  );
}
