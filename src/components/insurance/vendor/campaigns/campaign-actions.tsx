"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Ban, Copy, History, Loader2, MoreHorizontal, PauseCircle, Pencil, PlayCircle, Send, ShieldAlert, Trash2, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE } from "@/lib/motion";
import { INS_CAMPAIGN_STATUS_LABEL, INS_CAMPAIGN_STATUS_TONE } from "@/insurance/labels";
import {
  cancelInsCampaignAction,
  deleteInsCampaignDraftAction,
  duplicateInsCampaignAction,
  insCampaignHistoryAction,
  pauseInsCampaignAction,
  resumeInsCampaignAction,
  submitInsCampaignByIdAction,
  withdrawInsCampaignAction,
} from "@/server/actions/ins-campaigns";
import { useUI } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Drawer, Modal, useIsClient } from "@/components/ui/overlay";
import { Badge, formatDateTime } from "@/components/portal/ui";
import { Callout } from "@/components/portal/offers/offer-ui";
import { formatIst } from "@/components/offers/offer-utils";
import { COMPLIANCE_RULES, campaignCommands, type CampaignApprovalEntry, type CampaignCommand, type CampaignListItem } from "./shared";

/* What a vendor can do with a campaign from the list and the detail page: confirmations and the approval history. */

type Item = Pick<CampaignListItem, "id" | "reference" | "title" | "status" | "display" | "approvedAt" | "startsAt" | "endsAt">;

const META: Record<CampaignCommand, { label: string; icon: ReactNode; danger?: boolean }> = {
  edit: { label: "Edit", icon: <Pencil /> },
  editLive: { label: "Edit campaign", icon: <Pencil /> },
  submit: { label: "Submit for approval", icon: <Send /> },
  withdraw: { label: "Withdraw from review", icon: <Undo2 /> },
  pause: { label: "Pause campaign", icon: <PauseCircle /> },
  resume: { label: "Resume campaign", icon: <PlayCircle /> },
  cancel: { label: "Cancel campaign", icon: <Ban />, danger: true },
  duplicate: { label: "Duplicate", icon: <Copy /> },
  delete: { label: "Delete draft", icon: <Trash2 />, danger: true },
  history: { label: "Approval history", icon: <History /> },
};
const SHORT: Partial<Record<CampaignCommand, string>> = { submit: "Submit", history: "History", resume: "Resume", withdraw: "Withdraw", pause: "Pause" };

type Failure = { ok: false; error?: string; fieldErrors?: Record<string, string> };
const OFFLINE = "Couldn't reach the server. Check your connection and try again.";

/** Mount once per page; `run(cmd, item)` opens the right dialog (or acts straight away). */
export function useCampaignCommands({ onDetail = false }: { onDetail?: boolean } = {}) {
  const router = useRouter();
  const { toast } = useUI();
  const [dialog, setDialog] = useState<{ cmd: CampaignCommand; item: Item } | null>(null);
  const [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());

  const run = async (cmd: CampaignCommand, item: Item) => {
    if (cmd === "edit") return router.push(`/insurance-vendor/campaigns/${item.id}/edit`);
    if (cmd === "duplicate") {
      try {
        const res = await duplicateInsCampaignAction({ id: item.id });
        if (!res.ok) return toast(res.error ?? "Couldn't duplicate the campaign.", { tone: "error" });
        toast(`Duplicated as draft ${res.reference}`, { tone: "success", action: { label: "Open draft", href: `/insurance-vendor/campaigns/${res.id}/edit` } });
        refresh();
      } catch {
        toast(OFFLINE, { tone: "error" });
      }
      return;
    }
    setDialog({ cmd, item });
  };

  const done = (cmd: CampaignCommand) => {
    if (cmd === "delete" && onDetail) return router.push("/insurance-vendor/campaigns");
    refresh();
  };
  const node = <CommandDialogs dialog={dialog} onClose={() => setDialog(null)} onDone={done} />;
  return { run, node };
}

/** Primary action + "more" menu for one campaign. */
export function CampaignActions({ item, canManage, run, className, compact }: { item: Item; canManage: boolean; run: (c: CampaignCommand, i: Item) => void; className?: string; compact?: boolean }) {
  // On the detail page the edit button sits beside this bar, so "edit" leaves the menu there.
  const cmds = campaignCommands(item, canManage).filter((c) => compact || (c !== "edit" && c !== "editLive"));
  const primary: CampaignCommand =
    compact && item.display === "changes_requested" && cmds.includes("edit")
      ? "edit"
      : cmds.includes("submit")
        ? "submit"
        : cmds.includes("resume")
          ? "resume"
          : cmds.includes("withdraw")
            ? "withdraw"
            : cmds.includes("pause") && !compact
              ? "pause"
              : "history";
  const rest = cmds.filter((c) => c !== primary);
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Button
        size="sm"
        variant={primary === "submit" ? "primary" : "outline"}
        onClick={() => run(primary, item)}
        icon={<span className="[&>svg]:size-3.5">{META[primary].icon}</span>}
      >
        {primary === "edit" ? "Make changes" : compact ? (SHORT[primary] ?? META[primary].label) : META[primary].label}
      </Button>
      {rest.length > 0 && <MoreMenu items={rest} onPick={(c) => run(c, item)} label={`More actions for ${item.title || item.reference}`} />}
    </div>
  );
}

/** The action bar on a campaign's own page (delete returns to the list). */
export function CampaignDetailActions({ item, canManage }: { item: Item; canManage: boolean }) {
  const { run, node } = useCampaignCommands({ onDetail: true });
  const cmds = campaignCommands(item, canManage);
  const editable = cmds.includes("edit") || cmds.includes("editLive");
  return (
    <>
      {editable && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => run(cmds.includes("edit") ? "edit" : "editLive", item)}
          icon={<Pencil className="size-3.5" aria-hidden />}
        >
          {item.display === "changes_requested" ? "Make changes" : "Edit"}
        </Button>
      )}
      <CampaignActions item={item} canManage={canManage} run={run} />
      {node}
    </>
  );
}

function MoreMenu({ items, onPick, label }: { items: CampaignCommand[]; onPick: (c: CampaignCommand) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const isClient = useIsClient();

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
        className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-[3px] border border-line bg-white text-ink transition-colors hover:border-ink", open && "border-ink")}
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

const COPY: Partial<Record<CampaignCommand, { title: string; body: (c: Item) => ReactNode; cta: string; danger?: boolean }>> = {
  withdraw: {
    title: "Withdraw from review?",
    body: () => "The campaign goes back to draft so you can edit it. You'll need to submit it again for approval.",
    cta: "Withdraw to draft",
  },
  pause: {
    title: "Pause this campaign?",
    body: (c) => (
      <>
        It comes off the insurance pages straight away{c.display === "scheduled" ? " and won't go live on its start date" : ""}. Resume it any time before{" "}
        <span className="font-medium text-ink">{formatIst(c.endsAt)}</span> — no new approval is needed. A paused campaign keeps its plan slot.
      </>
    ),
    cta: "Pause campaign",
  },
  resume: {
    title: "Resume this campaign?",
    body: (c) => (new Date(c.startsAt).getTime() > Date.now() ? `It goes back to scheduled and goes live on ${formatIst(c.startsAt)}.` : "It goes back on the insurance pages straight away, with the approved details."),
    cta: "Resume campaign",
  },
  delete: {
    title: "Delete this draft?",
    body: () => "The draft is removed for good. Uploaded banners stay in your uploads.",
    cta: "Delete draft",
    danger: true,
  },
};

const ACTION_FOR = { withdraw: withdrawInsCampaignAction, pause: pauseInsCampaignAction, resume: resumeInsCampaignAction, delete: deleteInsCampaignDraftAction } as const;
const DONE: Partial<Record<CampaignCommand, string>> = {
  withdraw: "Withdrawn — the campaign is a draft again",
  pause: "Campaign paused and taken off the insurance pages",
  resume: "Campaign resumed",
  delete: "Draft deleted",
  cancel: "Campaign cancelled",
  submit: "Sent to MarchGear for approval",
};

function CommandDialogs({ dialog, onClose, onDone }: { dialog: { cmd: CampaignCommand; item: Item } | null; onClose: () => void; onDone: (cmd: CampaignCommand) => void }) {
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
        <span className={cn("inline-flex size-11 items-center justify-center rounded-full [&>svg]:size-5", tone === "red" ? "bg-red-50 text-red" : tone === "amber" ? "bg-[#fdf3e1] text-[#9a5b00]" : "bg-mist text-ink")}>{icon}</span>
        <h2 className="type-h3 mt-4">{title}</h2>
        <div className="mt-2 text-[14px] leading-relaxed text-muted">{children}</div>
      </div>
      <div className="mt-5 flex flex-col-reverse gap-2 border-t border-line bg-[#F6F6F6] px-6 py-4 sm:flex-row sm:justify-end sm:px-7">{footer}</div>
    </div>
  );
}

function usePending() {
  const [pending, setPending] = useState(false);
  const { toast } = useUI();
  const go = async <R extends { ok: boolean }>(fn: () => Promise<R>, onOk: (r: R) => void, onFail?: (f: Failure) => void) => {
    setPending(true);
    try {
      const r = await fn();
      if (!r.ok) {
        const f = r as unknown as Failure;
        if (onFail) onFail(f);
        else toast(f.error ?? "Something went wrong.", { tone: "error" });
        return;
      }
      onOk(r);
    } catch {
      toast(OFFLINE, { tone: "error" });
    } finally {
      setPending(false);
    }
  };
  return { pending, go };
}

const spin = <Loader2 className="size-4 animate-spin" aria-hidden />;

function SimpleConfirm({ cmd, item, onClose, onDone }: { cmd: keyof typeof ACTION_FOR; item: Item; onClose: () => void; onDone: (c: CampaignCommand) => void }) {
  const { toast } = useUI();
  const { pending, go } = usePending();
  const c = COPY[cmd]!;
  return (
    <DialogShell
      icon={META[cmd].icon}
      tone={c.danger ? "red" : cmd === "pause" ? "amber" : "ink"}
      title={c.title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep as is
          </Button>
          <Button
            variant={c.danger ? "primary" : "dark"}
            disabled={pending}
            icon={pending ? spin : undefined}
            onClick={() =>
              go(
                () => ACTION_FOR[cmd]({ id: item.id }),
                () => {
                  toast(DONE[cmd] ?? "Done", { tone: "success" });
                  onClose();
                  onDone(cmd);
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

function CancelConfirm({ item, onClose, onDone }: { item: Item; onClose: () => void; onDone: (c: CampaignCommand) => void }) {
  const { toast } = useUI();
  const { pending, go } = usePending();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  return (
    <DialogShell
      icon={<Ban />}
      tone="red"
      title="Cancel this campaign?"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep campaign
          </Button>
          <Button
            disabled={pending}
            icon={pending ? spin : undefined}
            onClick={() =>
              go(
                () => cancelInsCampaignAction({ id: item.id, reason: reason.trim() || undefined }),
                () => {
                  toast(DONE.cancel!, { tone: "success" });
                  onClose();
                  onDone("cancel");
                },
                (f) => (f.fieldErrors?.reason ? setError(f.fieldErrors.reason) : toast(f.error ?? "Couldn't cancel the campaign.", { tone: "error" })),
              )
            }
          >
            Cancel campaign
          </Button>
        </>
      }
    >
      <p className="mb-2 font-medium text-ink">{item.title || item.reference}</p>
      <p>Cancelling is permanent{item.display === "active" ? " and removes it from the insurance pages immediately" : ""}. It frees up a plan slot, and you can duplicate it later.</p>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-[12.5px] font-medium text-ink">Reason (optional, kept in the approval history)</span>
        <textarea
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setError(undefined);
          }}
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

const ISSUE_LABEL: Record<string, string> = { title: "Title", type: "Campaign type", summary: "Summary", productIds: "Products", banner: "Banner", ctaLabel: "Button label", startsAt: "Start", endsAt: "End" };

function SubmitConfirm({ item, onClose, onDone }: { item: Item; onClose: () => void; onDone: (c: CampaignCommand) => void }) {
  const { toast } = useUI();
  const router = useRouter();
  const { pending, go } = usePending();
  const [agreed, setAgreed] = useState(false);
  const [issues, setIssues] = useState<[string, string][]>([]);

  if (issues.length)
    return (
      <DialogShell
        icon={<AlertTriangle />}
        tone="amber"
        title={`${issues.length} thing${issues.length === 1 ? "" : "s"} to fix first`}
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button variant="dark" arrow onClick={() => router.push(`/insurance-vendor/campaigns/${item.id}/edit`)}>
              Fix in the editor
            </Button>
          </>
        }
      >
        <ul className="mt-1 space-y-2">
          {issues.map(([k, msg]) => (
            <li key={k} className="rounded-[3px] border border-line bg-white px-3 py-2.5">
              <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">{ISSUE_LABEL[k] ?? k}</p>
              <p className="text-[13.5px] text-ink">{msg}</p>
            </li>
          ))}
        </ul>
      </DialogShell>
    );

  return (
    <DialogShell
      icon={<Send />}
      title="Submit for approval?"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Not yet
          </Button>
          <Button
            disabled={pending || !agreed}
            icon={pending ? spin : undefined}
            onClick={() =>
              go(
                () => submitInsCampaignByIdAction({ id: item.id, confirmRules: agreed }),
                () => {
                  toast(DONE.submit!, { tone: "success" });
                  onClose();
                  onDone("submit");
                },
                (f) => {
                  const list = Object.entries(f.fieldErrors ?? {}).filter(([k]) => k !== "confirmRules");
                  if (list.length) setIssues(list);
                  else toast(f.error ?? "Couldn't submit the campaign.", { tone: "error" });
                },
              )
            }
          >
            Submit
          </Button>
        </>
      }
    >
      <p className="mb-3 font-medium text-ink">{item.title || item.reference}</p>
      <ul className="space-y-1.5">
        {COMPLIANCE_RULES.slice(0, 2).map((r) => (
          <li key={r} className="flex gap-2 text-[13px]">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-red" aria-hidden />
            {r}
          </li>
        ))}
      </ul>
      <label className="mt-4 flex cursor-pointer gap-3 rounded-[4px] border border-line bg-white p-3.5">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[#111111]" />
        <span className="text-[13px] leading-relaxed text-ink">This campaign follows the insurance advertising rules.</span>
      </label>
    </DialogShell>
  );
}

function EditLiveWarning({ item, onClose }: { item: Item; onClose: () => void }) {
  const router = useRouter();
  const expired = item.display === "expired";
  return (
    <DialogShell
      icon={<Pencil />}
      tone="amber"
      title={expired ? "Run this campaign again?" : "Edit an approved campaign?"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep as is
          </Button>
          <Button variant="dark" arrow onClick={() => router.push(`/insurance-vendor/campaigns/${item.id}/edit`)}>
            Continue to edit
          </Button>
        </>
      }
    >
      {expired ? (
        <p>Its end date has passed. Edit the dates (and anything else), then resubmit it — MarchGear approves it again before it goes live.</p>
      ) : (
        <p>
          Saving changes sends it back to MarchGear for approval, and it comes <span className="font-medium text-ink">off the insurance pages</span> until it&apos;s approved again. Nothing changes until you
          resubmit.
        </p>
      )}
    </DialogShell>
  );
}

const ACTION_TEXT: Record<string, string> = {
  submitted: "Submitted for approval",
  resubmitted: "Resubmitted for approval",
  withdrawn: "Withdrawn to draft",
  approved: "Approved",
  rejected: "Rejected",
  changes_requested: "Changes requested",
  paused: "Paused",
  resumed: "Resumed",
  cancelled: "Cancelled",
  suspended: "Suspended by MarchGear",
};
const actionTone = (a: string) => (a === "approved" || a === "resumed" ? "green" : a === "rejected" || a === "suspended" ? "red" : a === "changes_requested" || a === "paused" ? "amber" : "neutral");

function HistoryPanel({ item }: { item: Item }) {
  const [state, setState] = useState<{ items: CampaignApprovalEntry[]; remarks: string | null } | "loading" | "error">("loading");
  useEffect(() => {
    let live = true;
    insCampaignHistoryAction({ id: item.id })
      .then((r) => live && setState(r.ok ? { items: r.items, remarks: r.remarks } : "error"))
      .catch(() => live && setState("error"));
    return () => {
      live = false;
    };
  }, [item.id]);

  return (
    <div className="px-6 py-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-mono text-[12px] text-muted">{item.reference}</p>
        <Badge tone={INS_CAMPAIGN_STATUS_TONE[item.display]}>{INS_CAMPAIGN_STATUS_LABEL[item.display]}</Badge>
      </div>
      <p className="mt-1 text-[15px] font-semibold">{item.title}</p>
      {state === "loading" ? (
        <p className="mt-8 flex items-center gap-2 text-[13.5px] text-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Loading history…
        </p>
      ) : state === "error" ? (
        <p className="mt-8 text-[13.5px] text-red">Couldn&apos;t load the history. Close and try again.</p>
      ) : (
        <>
          {state.remarks && (
            <Callout tone="amber" title="Latest from MarchGear" className="mt-5">
              <p className="whitespace-pre-line">{state.remarks}</p>
            </Callout>
          )}
          {state.items.length === 0 ? (
            <p className="mt-8 text-[13.5px] text-muted">Nothing yet — the history starts when you submit the campaign.</p>
          ) : (
            <ol className="mt-6">
              {[...state.items].reverse().map((h, i, all) => (
                <li key={h.id} className="relative flex gap-4 pb-6 last:pb-0">
                  {i < all.length - 1 && <span aria-hidden className="absolute bottom-0 left-[11px] top-7 w-px bg-line" />}
                  <span className={cn("relative z-10 mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border bg-white text-[10px] font-semibold", h.actorSide === "admin" ? "border-ink bg-ink text-white" : "border-line text-muted")}>
                    {h.actorSide === "admin" ? "MG" : "•"}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={actionTone(h.action)}>{ACTION_TEXT[h.action] ?? h.action.replace(/_/g, " ")}</Badge>
                    </div>
                    <p className="mt-1 text-[12px] text-muted">
                      {formatDateTime(h.createdAt)}
                      {h.actorName ? ` · ${h.actorName}` : ""}
                    </p>
                    {h.remarks && <p className="mt-1.5 whitespace-pre-line break-words text-[13.5px]">{h.remarks}</p>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
