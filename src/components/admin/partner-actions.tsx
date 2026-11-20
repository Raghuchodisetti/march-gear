"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  Check,
  ClipboardList,
  Copy,
  Eye,
  EyeOff,
  FileSearch,
  FileText,
  FileUp,
  Loader2,
  Lock,
  MessageSquarePlus,
  PlayCircle,
  Plus,
  Power,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import type { PartnerStatus } from "@/db/enums";
import { DOC_KIND_LABEL } from "@/partner/labels";
import {
  addInternalNoteAction,
  decideChangeRequestAction,
  partnerAccountAction,
  partnerDecisionAction,
  revealBankAccountAction,
  reviewBrandAction,
  reviewDocumentAction,
} from "@/server/actions/partner-admin";
import { useUI } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { cn } from "@/lib/utils";
import { CORRECTION_AREAS, KYC_DOC_KINDS, splitCorrection, type CorrectionArea } from "./partner-ui";

/* ──────────────────────────────────────────────────────────────
   Client pieces of the dealer approvals: one consistent decision
   dialog (remarks, corrections, document picks, dates) and the
   review widgets built on it.
   ────────────────────────────────────────────────────────────── */

const OFFLINE: { ok: false; error: string; fieldErrors?: Record<string, string> } = { ok: false, error: "Couldn't reach the server. Please try again." };

export type DialogValues = Record<string, string | string[] | boolean>;
export type DialogField =
  | { name: string; kind: "textarea"; label: string; placeholder?: string; hint?: string; optional?: boolean; rows?: number }
  | { name: string; kind: "datetime" | "date"; label: string; hint?: string; min?: string }
  | { name: string; kind: "list"; label: string; placeholder?: string; hint?: string; suggestions?: string[] }
  | { name: string; kind: "checks"; label: string; hint?: string; options: { value: string; label: string; note?: string }[] }
  | { name: string; kind: "toggle"; label: string; hint?: string };

export interface DialogSpec {
  title: string;
  description?: ReactNode;
  notice?: ReactNode;
  fields: DialogField[];
  initial?: DialogValues;
  submitLabel: string;
  tone?: "primary" | "dark" | "danger";
  icon?: ReactNode;
  run: (values: DialogValues) => Promise<ActionResult<object>>;
  done: string | ((res: Record<string, unknown>) => string);
  toastAction?: (res: Record<string, unknown>) => { label: string; href: string } | undefined;
}

const control = "w-full rounded-[3px] border border-line bg-white px-3.5 text-[14px] outline-none transition-colors hover:border-ink/30 focus:border-ink aria-[invalid=true]:border-red";

function errorFor(errors: Record<string, string>, name: string) {
  return errors[name] ?? Object.entries(errors).find(([k]) => k.startsWith(`${name}.`))?.[1];
}

function ListField({ field, value, onChange, error }: { field: Extract<DialogField, { kind: "list" }>; value: string[]; onChange: (v: string[]) => void; error?: string }) {
  const [draft, setDraft] = useState("");
  const [area, setArea] = useState<CorrectionArea | "">("");
  /** Items are stored as "area: text" when an area is chosen, so the dealer's "Fix now" link opens that step. */
  const add = (text: string) => {
    const t = text.trim();
    const item = splitCorrection(t).area || !area ? t : `${area}: ${t}`;
    if (!t || value.includes(item)) return;
    onChange([...value, item]);
    setDraft("");
  };
  const unused = (field.suggestions ?? []).filter((s) => !value.includes(s));
  return (
    <div>
      <p className="mb-2 text-[12.5px] font-medium">{field.label}</p>
      {value.length > 0 && (
        <ol className="mb-2 space-y-1.5">
          {value.map((v, i) => (
            <li key={v} className="flex items-start gap-2 rounded-[3px] border border-line bg-mist/50 px-3 py-2 text-[13.5px]">
              <span className="mt-px text-[12px] font-semibold text-muted num">{i + 1}.</span>
              <span className="min-w-0 flex-1 break-words">
                {splitCorrection(v).area && (
                  <span className="mr-1.5 rounded-full bg-white px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted ring-1 ring-line">{CORRECTION_AREAS[splitCorrection(v).area!]}</span>
                )}
                {splitCorrection(v).text}
              </span>
              <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`Remove “${v}”`} className="-mr-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted hover:bg-white hover:text-red">
                <X aria-hidden className="size-3.5" />
              </button>
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-wrap gap-2 sm:flex-nowrap">
        <select value={area} onChange={(e) => setArea(e.target.value as CorrectionArea | "")} aria-label="Application section" className={cn(control, "h-10 w-full cursor-pointer sm:w-36")}>
          <option value="">Any section</option>
          {Object.entries(CORRECTION_AREAS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            }
          }}
          placeholder={field.placeholder ?? "Describe what to fix…"}
          aria-label={`Add to ${field.label}`}
          aria-invalid={error ? true : undefined}
          className={cn(control, "h-10 min-w-0 flex-1")}
        />
        <Button type="button" variant="outline" size="sm" className="h-10" onClick={() => add(draft)} disabled={!draft.trim()} icon={<Plus aria-hidden className="size-4" />}>
          Add
        </Button>
      </div>
      {unused.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {unused.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="inline-flex max-w-full items-center gap-1 rounded-full border border-dashed border-line px-2.5 py-1 text-left text-[12px] text-muted transition-colors hover:border-ink hover:text-ink">
              <Plus aria-hidden className="size-3 shrink-0" /> <span className="truncate">{splitCorrection(s).text}</span>
            </button>
          ))}
        </div>
      )}
      {(error || field.hint) && <p className={cn("mt-1.5 text-xs", error ? "text-red" : "text-muted")}>{error ?? field.hint}</p>}
    </div>
  );
}

function DialogBody({ spec, onClose }: { spec: DialogSpec; onClose: () => void }) {
  const router = useRouter();
  const { toast } = useUI();
  const [values, setValues] = useState<DialogValues>(() => {
    const init: DialogValues = {};
    for (const f of spec.fields) init[f.name] = f.kind === "list" || f.kind === "checks" ? [] : f.kind === "toggle" ? false : "";
    return { ...init, ...spec.initial };
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (name: string, v: string | string[] | boolean) => {
    setValues((p) => ({ ...p, [name]: v }));
    // A field's error goes as soon as it's edited.
    setErrors((e) => (errorFor(e, name) ? Object.fromEntries(Object.entries(e).filter(([k]) => k !== name && !k.startsWith(`${name}.`))) : e));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = (await spec.run(values).catch(() => OFFLINE)) as ActionResult<Record<string, unknown>>;
    setBusy(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      toast(res.error ?? "Couldn't save that. Please try again.", { tone: "error" });
      return;
    }
    toast(typeof spec.done === "function" ? spec.done(res) : spec.done, { tone: "success", action: spec.toastAction?.(res) });
    onClose();
    router.refresh();
  };

  const tone = spec.tone ?? "primary";
  return (
    <form onSubmit={submit} noValidate>
      <div className="space-y-5 px-6 py-5 sm:px-8">
        {spec.notice}
        {spec.fields.map((f, i) => {
          const err = errorFor(errors, f.name);
          const auto = i === 0 ? { "data-autofocus": true } : {};
          if (f.kind === "textarea")
            return (
              <div key={f.name}>
                <label htmlFor={`dlg-${f.name}`} className="mb-2 block text-[12.5px] font-medium">
                  {f.label} {f.optional && <span className="font-normal text-muted">(optional)</span>}
                </label>
                <textarea
                  id={`dlg-${f.name}`}
                  rows={f.rows ?? 4}
                  value={String(values[f.name] ?? "")}
                  onChange={(e) => set(f.name, e.target.value)}
                  placeholder={f.placeholder}
                  aria-invalid={err ? true : undefined}
                  className={cn(control, "py-2.5 leading-relaxed")}
                  {...auto}
                />
                {(err || f.hint) && <p className={cn("mt-1.5 text-xs", err ? "text-red" : "text-muted")}>{err ?? f.hint}</p>}
              </div>
            );
          if (f.kind === "datetime" || f.kind === "date")
            return (
              <div key={f.name}>
                <label htmlFor={`dlg-${f.name}`} className="mb-2 block text-[12.5px] font-medium">
                  {f.label}
                </label>
                <input
                  id={`dlg-${f.name}`}
                  type={f.kind === "date" ? "date" : "datetime-local"}
                  min={f.min}
                  value={String(values[f.name] ?? "")}
                  onChange={(e) => set(f.name, e.target.value)}
                  aria-invalid={err ? true : undefined}
                  className={cn(control, "h-11")}
                  {...auto}
                />
                {(err || f.hint) && <p className={cn("mt-1.5 text-xs", err ? "text-red" : "text-muted")}>{err ?? f.hint}</p>}
              </div>
            );
          if (f.kind === "list") return <ListField key={f.name} field={f} value={(values[f.name] as string[]) ?? []} onChange={(v) => set(f.name, v)} error={err} />;
          if (f.kind === "checks") {
            const picked = (values[f.name] as string[]) ?? [];
            return (
              <fieldset key={f.name}>
                <legend className="mb-2 text-[12.5px] font-medium">{f.label}</legend>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {f.options.map((o) => {
                    const on = picked.includes(o.value);
                    return (
                      <label key={o.value} className={cn("flex cursor-pointer items-start gap-2.5 rounded-[3px] border px-3 py-2.5 text-[13px] transition-colors", on ? "border-ink bg-mist/60" : "border-line hover:border-ink/30")}>
                        <input type="checkbox" checked={on} onChange={() => set(f.name, on ? picked.filter((x) => x !== o.value) : [...picked, o.value])} className="mt-0.5 size-4 accent-[var(--color-red)]" />
                        <span className="min-w-0">
                          <span className="block font-medium">{o.label}</span>
                          {o.note && <span className="block text-[12px] text-muted">{o.note}</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {(err || f.hint) && <p className={cn("mt-1.5 text-xs", err ? "text-red" : "text-muted")}>{err ?? f.hint}</p>}
              </fieldset>
            );
          }
          return (
            <label key={f.name} className="flex cursor-pointer items-start gap-3 rounded-[3px] border border-line px-3.5 py-3">
              <input type="checkbox" checked={Boolean(values[f.name])} onChange={(e) => set(f.name, e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-red)]" />
              <span>
                <span className="block text-[13.5px] font-medium">{f.label}</span>
                {f.hint && <span className="block text-[12px] text-muted">{f.hint}</span>}
              </span>
            </label>
          );
        })}
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-line px-6 py-4 sm:flex-row sm:justify-end sm:px-8">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant={tone === "dark" ? "dark" : "primary"}
          className={cn(tone === "danger" && "bg-red hover:bg-red-600")}
          disabled={busy}
          icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : spec.icon}
        >
          {spec.submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** One dialog for every decision. `open(spec)` shows it; the returned element must be rendered. */
export function useDecisionDialog() {
  const [spec, setSpec] = useState<DialogSpec | null>(null);
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(0);
  const element = (
    <Modal open={open} onClose={() => setOpen(false)} title={spec?.title} description={spec?.description} size="lg">
      {spec && <DialogBody key={n} spec={spec} onClose={() => setOpen(false)} />}
    </Modal>
  );
  return {
    open: (s: DialogSpec) => {
      setSpec(s);
      setN((x) => x + 1);
      setOpen(true);
    },
    element,
  };
}

/** Runs a one-click action (no dialog) with a toast and a refresh. */
export function useQuickAction() {
  const router = useRouter();
  const { toast } = useUI();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<ActionResult<object>>, done: string) => {
    setBusy(key);
    const res = await fn().catch(() => OFFLINE);
    setBusy(null);
    if (!res.ok) return toast(res.error ?? "Something went wrong", { tone: "error" });
    toast(done, { tone: "success" });
    router.refresh();
  };
  return { busy, run };
}

export const actionBtn = "inline-flex h-9 items-center justify-center gap-1.5 rounded-[3px] border px-3 text-[13px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-40";
export const btnTone = {
  primary: "border-red bg-red text-white hover:bg-red-600",
  dark: "border-ink bg-ink text-white hover:bg-ink-3",
  outline: "border-line bg-white hover:border-ink",
  danger: "border-line bg-white text-red hover:border-red hover:bg-red-50",
};

function AdminOnly({ label, icon }: { label: string; icon: ReactNode }) {
  return (
    <span title="Only MarchGear admins can do this" className={cn(actionBtn, "cursor-not-allowed border-dashed border-line text-muted")} aria-disabled="true">
      {icon}
      {label}
      <Lock aria-hidden className="size-3.5" />
    </span>
  );
}

/* ── Dealer account decisions ───────────────────────────────── */

const CORRECTION_SUGGESTIONS = [
  "documents: Upload a clearer copy of the GST certificate",
  "business: The PAN doesn't match the GST number",
  "showrooms: Add the showroom's full address with PIN code",
  "brands: The brand authorisation certificate has expired",
  "bank: Bank account holder must match the legal business name",
  "showrooms: Add showroom photos (exterior and interior)",
];

export function PartnerDecisionPanel({
  partnerId,
  name,
  status,
  isAdmin,
  pendingBrands,
  issues,
  layout = "stack",
}: {
  partnerId: number;
  name: string;
  status: PartnerStatus;
  isAdmin: boolean;
  pendingBrands: number;
  /** Checklist items that didn't pass, shown before approving. */
  issues: string[];
  layout?: "stack" | "row";
}) {
  const dialog = useDecisionDialog();
  const inReview = ["submitted", "pending_approval", "under_review"].includes(status);
  const withDealer = status === "documents_required" || status === "changes_requested";

  const approve = () =>
    dialog.open({
      title: `Approve ${name}`,
      description: "Unlocks the full partner portal, starts a 30-day trial and creates (or refreshes) the public showroom listing.",
      notice:
        issues.length > 0 ? (
          <div className="rounded-[3px] border border-[#e09200]/30 bg-[#fdf3e1] px-4 py-3 text-[13px] text-[#7a4800]">
            <p className="font-semibold">{issues.length === 1 ? "1 check still needs attention" : `${issues.length} checks still need attention`}</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
            <p className="mt-1.5">You can still approve if you&apos;ve confirmed these another way.</p>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-[3px] border border-[#1e7a3c]/20 bg-[#e8f5ec] px-4 py-3 text-[13px] text-[#1e7a3c]">
            <ShieldCheck aria-hidden className="size-4" /> Every verification check has passed.
          </div>
        ),
      fields: [
        ...(pendingBrands > 0
          ? [{ name: "approveBrands", kind: "toggle" as const, label: `Also approve ${pendingBrands} pending brand authorisation${pendingBrands === 1 ? "" : "s"}`, hint: "Approved brands appear on the public listing." }]
          : []),
        { name: "remarks", kind: "textarea", label: "Message to the dealer", optional: true, placeholder: "Welcome aboard! Your account manager will call you this week.", rows: 3 },
      ],
      initial: { approveBrands: pendingBrands > 0 },
      submitLabel: "Approve dealer",
      icon: <ShieldCheck aria-hidden className="size-4" />,
      run: (v) => partnerDecisionAction(partnerId, { op: "approve", approveBrands: Boolean(v.approveBrands), remarks: v.remarks }),
      done: "Dealer approved — public listing is live",
      toastAction: (res) => (res.publicDealerId ? { label: "View listing", href: `/dealers/${res.publicDealerId}` } : undefined),
    });

  const underReview = () =>
    dialog.open({
      title: "Mark as under review",
      description: "Tells the dealer a partner manager has picked up their application.",
      fields: [{ name: "remarks", kind: "textarea", label: "Message to the dealer", optional: true, rows: 3 }],
      submitLabel: "Mark under review",
      tone: "dark",
      icon: <FileSearch aria-hidden className="size-4" />,
      run: (v) => partnerDecisionAction(partnerId, { op: "under_review", remarks: v.remarks }),
      done: "Marked as under review",
    });

  const corrections = () =>
    dialog.open({
      title: "Request corrections",
      description: "The dealer sees each item on their application status page, fixes it and resubmits.",
      fields: [
        { name: "corrections", kind: "list", label: "Required corrections", suggestions: CORRECTION_SUGGESTIONS, hint: "Pick the section so the dealer's “Fix now” link opens it. Press Enter to add each item." },
        { name: "remarks", kind: "textarea", label: "Note to the dealer", optional: true, rows: 3 },
      ],
      submitLabel: "Send corrections",
      tone: "dark",
      icon: <ClipboardList aria-hidden className="size-4" />,
      run: (v) => partnerDecisionAction(partnerId, { op: "request_changes", corrections: v.corrections, remarks: v.remarks }),
      done: "Corrections sent to the dealer",
    });

  const documents = () =>
    dialog.open({
      title: "Request documents",
      description: "Choose what the dealer needs to upload. Their application reopens for those documents.",
      fields: [
        { name: "documents", kind: "checks", label: "Documents needed", options: KYC_DOC_KINDS.map((k) => ({ value: k, label: DOC_KIND_LABEL[k] })) },
        { name: "remarks", kind: "textarea", label: "Note to the dealer", optional: true, placeholder: "e.g. The GST certificate is cut off at the bottom.", rows: 3 },
      ],
      submitLabel: "Request documents",
      tone: "dark",
      icon: <FileUp aria-hidden className="size-4" />,
      run: (v) => partnerDecisionAction(partnerId, { op: "request_documents", documents: v.documents, remarks: v.remarks }),
      done: "Document request sent",
    });

  const reject = () =>
    dialog.open({
      title: `Reject ${name}`,
      description: "The application is closed. The dealer sees your reason and can't resubmit.",
      fields: [{ name: "remarks", kind: "textarea", label: "Reason", placeholder: "Explain why the application can't be approved.", rows: 4 }],
      submitLabel: "Reject application",
      tone: "danger",
      icon: <Ban aria-hidden className="size-4" />,
      run: (v) => partnerDecisionAction(partnerId, { op: "reject", remarks: v.remarks }),
      done: "Application rejected",
    });

  const account = (op: "suspend" | "reactivate" | "deactivate") =>
    dialog.open({
      title: op === "suspend" ? `Suspend ${name}` : op === "reactivate" ? `Reactivate ${name}` : `Deactivate ${name}`,
      description:
        op === "suspend"
          ? "Locks the dealer portal and hides the public listing and mirrored used cars until reactivated."
          : op === "reactivate"
            ? "Restores portal access and puts the public listing and published used cars back online."
            : "Closes the account: portal locked, public listing and used cars hidden. You can reactivate later.",
      fields: [{ name: "remarks", kind: "textarea", label: op === "reactivate" ? "Message to the dealer" : "Reason (shown to the dealer)", optional: op === "reactivate", rows: 3 }],
      submitLabel: op === "suspend" ? "Suspend dealer" : op === "reactivate" ? "Reactivate dealer" : "Deactivate dealer",
      tone: op === "reactivate" ? "primary" : "danger",
      icon: op === "reactivate" ? <PlayCircle aria-hidden className="size-4" /> : <Power aria-hidden className="size-4" />,
      run: (v) => partnerAccountAction(partnerId, { op, remarks: v.remarks }),
      done: op === "suspend" ? "Dealer suspended — listing hidden" : op === "reactivate" ? "Dealer reactivated — listing restored" : "Dealer deactivated",
    });

  const items: ReactNode[] = [];
  if (inReview || withDealer) {
    items.push(
      <button key="approve" type="button" onClick={approve} className={cn(actionBtn, btnTone.primary)}>
        <ShieldCheck aria-hidden className="size-4" /> Approve
      </button>,
    );
    if (status === "submitted" || status === "pending_approval")
      items.push(
        <button key="review" type="button" onClick={underReview} className={cn(actionBtn, btnTone.outline)}>
          <FileSearch aria-hidden className="size-4" /> Mark under review
        </button>,
      );
    if (status !== "changes_requested")
      items.push(
        <button key="corr" type="button" onClick={corrections} className={cn(actionBtn, btnTone.outline)}>
          <ClipboardList aria-hidden className="size-4" /> Request corrections
        </button>,
      );
    if (status !== "documents_required")
      items.push(
        <button key="docs" type="button" onClick={documents} className={cn(actionBtn, btnTone.outline)}>
          <FileUp aria-hidden className="size-4" /> Request documents
        </button>,
      );
    items.push(
      <button key="reject" type="button" onClick={reject} className={cn(actionBtn, btnTone.danger)}>
        <Ban aria-hidden className="size-4" /> Reject
      </button>,
    );
  }
  const adminBtn = (key: string, label: string, icon: ReactNode, onClick: () => void, tone: keyof typeof btnTone) =>
    isAdmin ? (
      <button key={key} type="button" onClick={onClick} className={cn(actionBtn, btnTone[tone])}>
        {icon} {label}
      </button>
    ) : (
      <AdminOnly key={key} label={label} icon={icon} />
    );
  if (status === "approved") {
    items.push(adminBtn("suspend", "Suspend", <Power aria-hidden className="size-4" />, () => account("suspend"), "danger"));
    items.push(adminBtn("deactivate", "Deactivate", <Ban aria-hidden className="size-4" />, () => account("deactivate"), "danger"));
  }
  if (status === "suspended" || status === "deactivated") items.push(adminBtn("reactivate", "Reactivate", <PlayCircle aria-hidden className="size-4" />, () => account("reactivate"), "primary"));
  if (status === "suspended" || status === "rejected") items.push(adminBtn("deactivate", "Deactivate", <Ban aria-hidden className="size-4" />, () => account("deactivate"), "danger"));

  return (
    <div>
      {status === "draft" && <p className="text-[13px] text-muted">The dealer hasn&apos;t submitted the application yet — there&apos;s nothing to decide.</p>}
      {withDealer && <p className="mb-3 text-[13px] text-muted">Waiting for the dealer to resubmit. You can still decide now if needed.</p>}
      {items.length > 0 && <div className={cn("flex gap-2", layout === "stack" ? "flex-col [&>*]:w-full" : "flex-wrap")}>{items}</div>}
      {!isAdmin && (status === "approved" || status === "suspended" || status === "deactivated" || status === "rejected") && (
        <p className="mt-3 text-[12px] text-muted">Suspending, reactivating and deactivating dealers is limited to admins.</p>
      )}
      {dialog.element}
    </div>
  );
}

/* ── Documents ──────────────────────────────────────────────── */

export interface DocItem {
  id: number;
  kind: string;
  kindLabel: string;
  filename: string;
  mime: string;
  sizeLabel: string;
  uploaded: string;
  status: "pending" | "verified" | "rejected";
  remarks: string | null;
  current: boolean;
}

const FILE_TONE = { pending: "text-[#2456a6] bg-[#e9f0fb]", verified: "text-[#1e7a3c] bg-[#e8f5ec]", rejected: "text-red bg-red-50" };
const FILE_LABEL = { pending: "Awaiting check", verified: "Verified", rejected: "Rejected" };

/** Document list with an inline viewer and verify / reject decisions. */
export function DocumentReview({ docs }: { docs: DocItem[] }) {
  const [selected, setSelected] = useState<number | null>(docs[0]?.id ?? null);
  const { busy, run } = useQuickAction();
  const dialog = useDecisionDialog();
  const doc = docs.find((d) => d.id === selected) ?? null;

  const reject = (d: DocItem) =>
    dialog.open({
      title: `Reject ${d.kindLabel.toLowerCase()}`,
      description: "The dealer is notified and sees your remark next to the document.",
      fields: [{ name: "remarks", kind: "textarea", label: "What's wrong with it?", placeholder: "e.g. The image is blurred — upload a clear scan of both sides.", rows: 3 }],
      submitLabel: "Reject document",
      tone: "danger",
      icon: <X aria-hidden className="size-4" />,
      run: (v) => reviewDocumentAction(d.id, { status: "rejected", remarks: v.remarks }),
      done: `${d.kindLabel} rejected`,
    });

  if (!docs.length) return <p className="py-10 text-center text-[13.5px] text-muted">No account documents uploaded yet.</p>;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <ul className="divide-y divide-line border border-line">
        {docs.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => {
                setSelected(d.id);
                if (window.innerWidth < 1024) requestAnimationFrame(() => document.getElementById("doc-viewer")?.scrollIntoView({ behavior: "smooth", block: "start" }));
              }}
              aria-pressed={selected === d.id}
              className={cn("flex w-full items-start gap-3 px-4 py-3 text-left transition-colors", selected === d.id ? "bg-mist" : "hover:bg-mist/50")}
            >
              <FileText aria-hidden className={cn("mt-0.5 size-5 shrink-0", selected === d.id ? "text-red" : "text-muted")} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[13.5px] font-semibold">{d.kindLabel}</span>
                  {!d.current && <span className="rounded-full bg-mist px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted">Older copy</span>}
                </span>
                <span className="mt-0.5 block truncate text-[12.5px] text-muted">
                  {d.filename} · {d.sizeLabel} · {d.uploaded}
                </span>
                {d.remarks && <span className="mt-1 block text-[12.5px] text-ink/80">“{d.remarks}”</span>}
              </span>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", FILE_TONE[d.status])}>{FILE_LABEL[d.status]}</span>
            </button>
          </li>
        ))}
      </ul>

      <div id="doc-viewer" className="min-w-0 scroll-mt-20">
        {doc && (
          <div className="border border-line lg:sticky lg:top-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-semibold">{doc.kindLabel}</p>
                <p className="truncate text-[12px] text-muted">{doc.filename}</p>
              </div>
              <div className="flex gap-2">
                <a href={`/dealer/files/${doc.id}`} target="_blank" rel="noreferrer" className={cn(actionBtn, btnTone.outline, "h-8 px-2.5 text-[12.5px]")}>
                  Open
                </a>
                <a href={`/dealer/files/${doc.id}?download=1`} className={cn(actionBtn, btnTone.outline, "h-8 px-2.5 text-[12.5px]")}>
                  Download
                </a>
              </div>
            </div>
            <div className="flex h-[420px] items-center justify-center bg-mist/60 sm:h-[520px] lg:h-[min(520px,calc(100dvh-210px))]">
              {doc.mime.startsWith("image/") ? (
                // Private file served from our own origin to staff only.
                // eslint-disable-next-line @next/next/no-img-element
                <img key={doc.id} src={`/dealer/files/${doc.id}`} alt={`${doc.kindLabel} uploaded by the dealer`} className="max-h-full max-w-full object-contain" />
              ) : doc.mime === "application/pdf" ? (
                <object key={doc.id} data={`/dealer/files/${doc.id}`} type="application/pdf" className="size-full" aria-label={`${doc.kindLabel} (PDF)`}>
                  <p className="p-6 text-center text-[13px] text-muted">
                    This browser can&apos;t show PDFs inline.{" "}
                    <a className="text-red underline" href={`/dealer/files/${doc.id}`} target="_blank" rel="noreferrer">
                      Open the PDF
                    </a>
                  </p>
                </object>
              ) : (
                <p className="text-[13px] text-muted">No preview for this file type.</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
              {doc.status !== "verified" && (
                <button type="button" disabled={busy !== null} onClick={() => run(`v${doc.id}`, () => reviewDocumentAction(doc.id, { status: "verified" }), `${doc.kindLabel} verified`)} className={cn(actionBtn, btnTone.dark)}>
                  {busy === `v${doc.id}` ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Check aria-hidden className="size-4" />} Mark verified
                </button>
              )}
              {doc.status !== "rejected" && (
                <button type="button" disabled={busy !== null} onClick={() => reject(doc)} className={cn(actionBtn, btnTone.danger)}>
                  <X aria-hidden className="size-4" /> Reject
                </button>
              )}
              {doc.status !== "pending" && (
                <button type="button" disabled={busy !== null} onClick={() => run(`p${doc.id}`, () => reviewDocumentAction(doc.id, { status: "pending" }), "Reset to awaiting check")} className={cn(actionBtn, btnTone.outline)}>
                  {busy === `p${doc.id}` ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <RotateCcw aria-hidden className="size-4" />} Reset
                </button>
              )}
              <span className="ml-auto text-[12px] text-muted">{FILE_LABEL[doc.status]}</span>
            </div>
          </div>
        )}
      </div>
      {dialog.element}
    </div>
  );
}

/** Compact verify / reject buttons for one document (verification workspace). */
export function DocumentQuickActions({ id, label, status }: { id: number; label: string; status: "pending" | "verified" | "rejected" }) {
  const { busy, run } = useQuickAction();
  const dialog = useDecisionDialog();
  return (
    <span className="flex shrink-0 gap-1.5">
      {status !== "verified" && (
        <button type="button" disabled={busy !== null} onClick={() => run("v", () => reviewDocumentAction(id, { status: "verified" }), `${label} verified`)} className={cn(actionBtn, btnTone.outline, "h-8 px-2.5 text-[12.5px]")} aria-label={`Verify ${label}`}>
          {busy ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Check aria-hidden className="size-3.5" />} Verify
        </button>
      )}
      {status !== "rejected" && (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() =>
            dialog.open({
              title: `Reject ${label.toLowerCase()}`,
              fields: [{ name: "remarks", kind: "textarea", label: "What's wrong with it?", rows: 3 }],
              submitLabel: "Reject document",
              tone: "danger",
              icon: <X aria-hidden className="size-4" />,
              run: (v) => reviewDocumentAction(id, { status: "rejected", remarks: v.remarks }),
              done: `${label} rejected`,
            })
          }
          className={cn(actionBtn, btnTone.danger, "h-8 px-2.5 text-[12.5px]")}
          aria-label={`Reject ${label}`}
        >
          <X aria-hidden className="size-3.5" /> Reject
        </button>
      )}
      {dialog.element}
    </span>
  );
}

/* ── Brands ─────────────────────────────────────────────────── */

export function BrandActions({ id, brand, status, validUntil }: { id: number; brand: string; status: "pending" | "approved" | "rejected" | "expired"; validUntil: string | null }) {
  const dialog = useDecisionDialog();
  const { busy, run } = useQuickAction();
  const approve = () =>
    dialog.open({
      title: `Approve ${brand} authorisation`,
      description: "Approved brands show on the dealer's public listing and unlock that brand's models in their inventory.",
      fields: [
        { name: "validUntil", kind: "date", label: "Certificate valid until", hint: "Taken from the certificate — correct it if needed." },
        { name: "remarks", kind: "textarea", label: "Remarks", optional: true, rows: 2 },
      ],
      initial: { validUntil: validUntil ?? "" },
      submitLabel: "Approve brand",
      icon: <Check aria-hidden className="size-4" />,
      run: (v) => reviewBrandAction(id, { status: "approved", validUntil: v.validUntil, remarks: v.remarks }),
      done: `${brand} authorisation approved`,
    });
  const reject = () =>
    dialog.open({
      title: `Reject ${brand} authorisation`,
      fields: [{ name: "remarks", kind: "textarea", label: "Reason (shown to the dealer)", rows: 3, placeholder: "e.g. The certificate is issued to a different legal entity." }],
      submitLabel: "Reject brand",
      tone: "danger",
      icon: <X aria-hidden className="size-4" />,
      run: (v) => reviewBrandAction(id, { status: "rejected", remarks: v.remarks }),
      done: `${brand} authorisation rejected`,
    });
  return (
    <div className="flex flex-wrap gap-1.5">
      {status !== "approved" && (
        <button type="button" onClick={approve} className={cn(actionBtn, btnTone.dark, "h-8 px-2.5 text-[12.5px]")}>
          <Check aria-hidden className="size-3.5" /> Approve
        </button>
      )}
      {status !== "rejected" && (
        <button type="button" onClick={reject} className={cn(actionBtn, btnTone.danger, "h-8 px-2.5 text-[12.5px]")}>
          <X aria-hidden className="size-3.5" /> Reject
        </button>
      )}
      {status === "approved" && (
        <button type="button" disabled={busy !== null} onClick={() => run("exp", () => reviewBrandAction(id, { status: "expired" }), `${brand} marked expired`)} className={cn(actionBtn, btnTone.outline, "h-8 px-2.5 text-[12.5px]")}>
          {busy ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <RotateCcw aria-hidden className="size-3.5" />} Mark expired
        </button>
      )}
      {dialog.element}
    </div>
  );
}

/* ── Change requests ────────────────────────────────────────── */

export function ChangeRequestActions({ id, fields }: { id: number; fields: string[] }) {
  const dialog = useDecisionDialog();
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() =>
          dialog.open({
            title: "Approve change request",
            description: `Applies the new ${fields.join(", ")} to the verified business details and refreshes the public listing.`,
            fields: [{ name: "remarks", kind: "textarea", label: "Message to the dealer", optional: true, rows: 2 }],
            submitLabel: "Approve & apply",
            icon: <Check aria-hidden className="size-4" />,
            run: (v) => decideChangeRequestAction(id, { decision: "approve", remarks: v.remarks }),
            done: "Change applied",
          })
        }
        className={cn(actionBtn, btnTone.dark)}
      >
        <Check aria-hidden className="size-4" /> Approve & apply
      </button>
      <button
        type="button"
        onClick={() =>
          dialog.open({
            title: "Reject change request",
            fields: [{ name: "remarks", kind: "textarea", label: "Reason (shown to the dealer)", rows: 3 }],
            submitLabel: "Reject request",
            tone: "danger",
            icon: <X aria-hidden className="size-4" />,
            run: (v) => decideChangeRequestAction(id, { decision: "reject", remarks: v.remarks }),
            done: "Change request rejected",
          })
        }
        className={cn(actionBtn, btnTone.danger)}
      >
        <X aria-hidden className="size-4" /> Reject
      </button>
      {dialog.element}
    </div>
  );
}

/* ── Banking ────────────────────────────────────────────────── */

export function BankReveal({ partnerId, masked, isAdmin, hasNumber }: { partnerId: number; masked: string; isAdmin: boolean; hasNumber: boolean }) {
  const { toast } = useUI();
  const [full, setFull] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reveal = async () => {
    setBusy(true);
    const res = await revealBankAccountAction(partnerId).catch(() => OFFLINE);
    setBusy(false);
    if (!res.ok) return toast(res.error ?? "Couldn't reveal the number", { tone: "error" });
    setFull(res.accountNumber);
  };
  const copy = async () => {
    if (!full) return;
    try {
      await navigator.clipboard.writeText(full);
      toast("Account number copied", { tone: "success" });
    } catch {
      toast("Couldn't copy — select the number instead", { tone: "error" });
    }
  };
  if (!hasNumber) return <span className="text-muted">Not provided</span>;
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-[14px] tracking-wider num" aria-live="polite">
        {full ?? masked}
      </span>
      {isAdmin ? (
        full ? (
          <>
            <button type="button" onClick={copy} className={cn(actionBtn, btnTone.outline, "h-7 px-2 text-[12px]")}>
              <Copy aria-hidden className="size-3.5" /> Copy
            </button>
            <button type="button" onClick={() => setFull(null)} className={cn(actionBtn, btnTone.outline, "h-7 px-2 text-[12px]")}>
              <EyeOff aria-hidden className="size-3.5" /> Hide
            </button>
          </>
        ) : (
          <button type="button" onClick={reveal} disabled={busy} className={cn(actionBtn, btnTone.outline, "h-7 px-2 text-[12px]")}>
            {busy ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Eye aria-hidden className="size-3.5" />} Reveal
          </button>
        )
      ) : (
        <span title="Only admins can see the full account number" className="inline-flex items-center gap-1 text-[12px] text-muted">
          <Lock aria-hidden className="size-3.5" /> Admins only
        </span>
      )}
    </span>
  );
}

/* ── Internal remarks ───────────────────────────────────────── */

export function InternalNoteForm({ partnerId }: { partnerId: number }) {
  const router = useRouter();
  const { toast } = useUI();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await addInternalNoteAction(partnerId, { note }).catch(() => OFFLINE);
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
    <form onSubmit={submit} noValidate>
      <label htmlFor="internal-note" className="mb-2 block text-[12.5px] font-medium">
        Add an internal note
      </label>
      <textarea
        id="internal-note"
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Visible to MarchGear staff only — e.g. Called the owner, GST certificate re-issue expected Monday."
        aria-invalid={error ? true : undefined}
        className={cn(control, "py-2.5 leading-relaxed")}
      />
      {error && <p className="mt-1.5 text-xs text-red">{error}</p>}
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-1.5 text-[12px] text-muted">
          <Lock aria-hidden className="size-3.5" /> Never shown to the dealer
        </p>
        <Button type="submit" size="sm" variant="dark" disabled={busy || !note.trim()} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <MessageSquarePlus className="size-4" aria-hidden />}>
          Add note
        </Button>
      </div>
    </form>
  );
}
