"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, ClipboardList, Copy, Eye, EyeOff, FileSearch, FileText, FileUp, Loader2, Lock, MessageSquarePlus, PlayCircle, Power, RotateCcw, ShieldCheck, X } from "lucide-react";
import type { InsVendorStatus } from "@/db/enums";
import { INS_DOC_KIND_LABEL } from "@/insurance/labels";
import {
  addInsInternalNoteAction,
  decideInsChangeRequestAction,
  revealInsBankAccountAction,
  reviewInsDocumentAction,
  vendorAccountAction,
  vendorDecisionAction,
} from "@/server/actions/admin-insurance-vendors";
import { useUI } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { INS_CORRECTION_AREAS, INS_KYC_DOC_KINDS } from "../ui";
import { DialogNotice, OFFLINE, actionBtn, btnTone, control, useInsDialog, useQuickRun } from "./decision-dialog";

/* Client pieces of the vendor review: decisions, documents, bank reveal, notes, change requests and the detail tabs. */

function AdminOnly({ label, icon }: { label: string; icon: ReactNode }) {
  return (
    <span title="Only MarchGear admins can do this" className={cn(actionBtn, "cursor-not-allowed border-dashed border-line text-muted")} aria-disabled="true">
      {icon}
      {label}
      <Lock aria-hidden className="size-3.5" />
    </span>
  );
}

/* ── Account decisions ──────────────────────────────────────── */

const CORRECTION_SUGGESTIONS = [
  "registration: The PAN doesn't match the GSTIN",
  "regulatory: The licence number doesn't match the uploaded authorisation",
  "regulatory: Add the authorised representative's official email",
  "company: The legal name must match the registration certificate",
  "branches: Add the head office with its full address and PIN code",
  "bank: The account holder must match the legal name",
];

export interface CompanyChoice {
  /** The company already linked to this vendor. */
  linked: { id: number; name: string } | null;
  /** Companies with no vendor yet. */
  free: { id: number; name: string; isActive: boolean }[];
  /** The name a new company would get. */
  createName: string;
}

export function VendorDecisionPanel({
  vendorId,
  name,
  status,
  isAdmin,
  isInsurer,
  issues,
  companies,
  trialDays,
  layout = "stack",
}: {
  vendorId: number;
  name: string;
  status: InsVendorStatus;
  isAdmin: boolean;
  isInsurer: boolean;
  /** Checklist items that didn't pass, shown before approving. */
  issues: string[];
  companies: CompanyChoice;
  trialDays: number;
  layout?: "stack" | "row";
}) {
  const dialog = useInsDialog();
  const inReview = status === "submitted" || status === "pending_approval" || status === "under_review";
  const withVendor = status === "documents_required" || status === "changes_requested";

  const approve = () => {
    const companyField =
      isInsurer && !companies.linked
        ? [
            {
              name: "company",
              kind: "select" as const,
              label: "Insurance company (underwriter)",
              hint: "Insurers are linked to the company customers see as the provider. Pick an existing one, or create it from the application.",
              options: [
                ...(companies.createName ? [{ value: "create", label: `Create “${companies.createName}” from the application` }] : []),
                ...companies.free.map((c) => ({ value: String(c.id), label: `Link ${c.name}${c.isActive ? "" : " (inactive)"}` })),
              ],
            },
          ]
        : [];
    dialog.open({
      title: `Approve ${name}`,
      description: `Unlocks the full vendor portal and starts ${trialDays > 0 ? `a ${trialDays}-day free trial` : "their plan"}. Branch offices from the application become branch records.`,
      notice: (
        <div className="space-y-3">
          {issues.length > 0 ? (
            <DialogNotice tone="amber">
              <p className="font-semibold">{issues.length === 1 ? "1 check still needs attention" : `${issues.length} checks still need attention`}</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
              <p className="mt-1.5">You can still approve if you&apos;ve confirmed these another way.</p>
            </DialogNotice>
          ) : (
            <DialogNotice tone="green">
              <span className="flex items-center gap-2">
                <ShieldCheck aria-hidden className="size-4" /> Every verification check has passed.
              </span>
            </DialogNotice>
          )}
          {isInsurer && companies.linked && <DialogNotice>Already linked to the insurance company {companies.linked.name}.</DialogNotice>}
        </div>
      ),
      fields: [...companyField, { name: "remarks", kind: "textarea", label: "Message to the vendor", optional: true, placeholder: "Welcome aboard! Your partner manager will be in touch this week.", rows: 3 }],
      submitLabel: "Approve vendor",
      icon: <ShieldCheck aria-hidden className="size-4" />,
      run: (v) => vendorDecisionAction(vendorId, { op: "approve", company: v.company || undefined, remarks: v.remarks }),
      done: "Vendor approved — portal unlocked",
    });
  };

  const underReview = () =>
    dialog.open({
      title: "Mark as under review",
      description: "Tells the vendor a partner manager has picked up their application.",
      fields: [{ name: "remarks", kind: "textarea", label: "Message to the vendor", optional: true, rows: 3 }],
      submitLabel: "Mark under review",
      tone: "dark",
      icon: <FileSearch aria-hidden className="size-4" />,
      run: (v) => vendorDecisionAction(vendorId, { op: "under_review", remarks: v.remarks }),
      done: "Marked as under review",
    });

  const corrections = () =>
    dialog.open({
      title: "Request corrections",
      description: "The vendor sees each item on their application status page, fixes it and resubmits.",
      fields: [
        { name: "corrections", kind: "list", label: "Required corrections", areas: INS_CORRECTION_AREAS, suggestions: CORRECTION_SUGGESTIONS, hint: "Pick the step so the vendor's “Fix now” link opens it. Press Enter to add each item." },
        { name: "remarks", kind: "textarea", label: "Note to the vendor", optional: true, rows: 3 },
      ],
      submitLabel: "Send corrections",
      tone: "dark",
      icon: <ClipboardList aria-hidden className="size-4" />,
      run: (v) => vendorDecisionAction(vendorId, { op: "request_changes", corrections: v.corrections, remarks: v.remarks }),
      done: "Corrections sent to the vendor",
    });

  const documents = () =>
    dialog.open({
      title: "Request additional documents",
      description: "Choose what the vendor needs to upload. Their application reopens for those documents.",
      fields: [
        { name: "documents", kind: "checks", label: "Documents needed", options: INS_KYC_DOC_KINDS.map((k) => ({ value: k, label: INS_DOC_KIND_LABEL[k] })) },
        { name: "extra", kind: "list", label: "Anything else", optional: true, placeholder: "e.g. Latest IRDAI renewal letter", hint: "Press Enter to add each item." },
        { name: "remarks", kind: "textarea", label: "Note to the vendor", optional: true, placeholder: "e.g. The GST certificate is cut off at the bottom.", rows: 3 },
      ],
      submitLabel: "Request documents",
      tone: "dark",
      icon: <FileUp aria-hidden className="size-4" />,
      run: (v) => vendorDecisionAction(vendorId, { op: "request_documents", documents: v.documents, extra: v.extra, remarks: v.remarks }),
      done: "Document request sent",
    });

  const reject = () =>
    dialog.open({
      title: `Reject ${name}`,
      description: "The application is closed. The vendor sees your reason.",
      fields: [{ name: "remarks", kind: "textarea", label: "Reason (shown to the vendor)", placeholder: "Explain why the application can't be approved.", rows: 4 }],
      submitLabel: "Reject application",
      tone: "danger",
      icon: <Ban aria-hidden className="size-4" />,
      run: (v) => vendorDecisionAction(vendorId, { op: "reject", remarks: v.remarks }),
      done: "Application rejected",
    });

  const account = (op: "suspend" | "reactivate") =>
    dialog.open({
      title: op === "suspend" ? `Suspend ${name}` : `Reactivate ${name}`,
      description:
        op === "suspend"
          ? "Locks the vendor portal. Their published products disappear from the website automatically (only approved vendors' products are public); nothing is deleted."
          : "Restores portal access. Their published products appear on the website again.",
      fields: [{ name: "remarks", kind: "textarea", label: op === "reactivate" ? "Message to the vendor" : "Reason (shown to the vendor)", optional: op === "reactivate", rows: 3 }],
      submitLabel: op === "suspend" ? "Suspend vendor" : "Reactivate vendor",
      tone: op === "reactivate" ? "primary" : "danger",
      icon: op === "reactivate" ? <PlayCircle aria-hidden className="size-4" /> : <Power aria-hidden className="size-4" />,
      run: (v) => vendorAccountAction(vendorId, { op, remarks: v.remarks }),
      done: op === "suspend" ? "Vendor suspended — products hidden" : "Vendor reactivated — products visible again",
    });

  const items: ReactNode[] = [];
  if (inReview || withVendor) {
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
    if (status !== "documents_required")
      items.push(
        <button key="docs" type="button" onClick={documents} className={cn(actionBtn, btnTone.outline)}>
          <FileUp aria-hidden className="size-4" /> Request documents
        </button>,
      );
    if (status !== "changes_requested")
      items.push(
        <button key="corr" type="button" onClick={corrections} className={cn(actionBtn, btnTone.outline)}>
          <ClipboardList aria-hidden className="size-4" /> Request corrections
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
  if (status === "approved") items.push(adminBtn("suspend", "Suspend", <Power aria-hidden className="size-4" />, () => account("suspend"), "danger"));
  if (status === "suspended") items.push(adminBtn("reactivate", "Reactivate", <PlayCircle aria-hidden className="size-4" />, () => account("reactivate"), "primary"));

  return (
    <div>
      {status === "draft" && <p className="text-[13px] text-muted">The vendor hasn&apos;t submitted the application yet — there&apos;s nothing to decide.</p>}
      {status === "rejected" && <p className="text-[13px] text-muted">This application was rejected. The vendor can&apos;t resubmit it.</p>}
      {withVendor && <p className="mb-3 text-[13px] text-muted">Waiting for the vendor to resubmit. You can still decide now if needed.</p>}
      {items.length > 0 && <div className={cn("flex gap-2", layout === "stack" ? "flex-col [&>*]:w-full" : "flex-wrap")}>{items}</div>}
      {!isAdmin && (status === "approved" || status === "suspended") && <p className="mt-3 text-[12px] text-muted">Suspending and reactivating vendors is limited to admins.</p>}
      {status === "suspended" && <p className="mt-3 text-[12px] text-muted">While suspended, none of this vendor&apos;s products are shown on the website.</p>}
      {dialog.element}
    </div>
  );
}

/* ── Documents ──────────────────────────────────────────────── */

export interface InsDocItem {
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
const FILE_LABEL = { pending: "Awaiting review", verified: "Verified", rejected: "Rejected" };
const fileUrl = (id: number, download = false) => `/insurance-vendor/files/${id}${download ? "?download=1" : ""}`;

function useRejectDoc() {
  const dialog = useInsDialog();
  const open = (d: { id: number; label: string }) =>
    dialog.open({
      title: `Reject ${d.label.toLowerCase()}`,
      description: "The vendor is notified and sees your remark next to the document.",
      fields: [{ name: "remarks", kind: "textarea", label: "What's wrong with it?", placeholder: "e.g. The scan is blurred — upload a clear copy of every page.", rows: 3 }],
      submitLabel: "Reject document",
      tone: "danger",
      icon: <X aria-hidden className="size-4" />,
      run: (v) => reviewInsDocumentAction(d.id, { status: "rejected", remarks: v.remarks }),
      done: `${d.label} rejected`,
    });
  return { open, element: dialog.element };
}

/** Document list with an inline viewer and verify / reject decisions. */
export function InsDocumentReview({ docs }: { docs: InsDocItem[] }) {
  const [selected, setSelected] = useState<number | null>(docs[0]?.id ?? null);
  const { busy, run } = useQuickRun();
  const reject = useRejectDoc();
  const doc = docs.find((d) => d.id === selected) ?? null;

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
                if (window.innerWidth < 1024) requestAnimationFrame(() => document.getElementById("ins-doc-viewer")?.scrollIntoView({ behavior: "smooth", block: "start" }));
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
                {d.remarks && <span className="mt-1 block break-words text-[12.5px] text-ink/80">“{d.remarks}”</span>}
              </span>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", FILE_TONE[d.status])}>{FILE_LABEL[d.status]}</span>
            </button>
          </li>
        ))}
      </ul>

      <div id="ins-doc-viewer" className="min-w-0 scroll-mt-20">
        {doc && (
          <div className="border border-line lg:sticky lg:top-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-semibold">{doc.kindLabel}</p>
                <p className="truncate text-[12px] text-muted">{doc.filename}</p>
              </div>
              <div className="flex gap-2">
                <a href={fileUrl(doc.id)} target="_blank" rel="noreferrer" className={cn(actionBtn, btnTone.outline, "h-8 px-2.5 text-[12.5px]")}>
                  Open
                </a>
                <a href={fileUrl(doc.id, true)} className={cn(actionBtn, btnTone.outline, "h-8 px-2.5 text-[12.5px]")}>
                  Download
                </a>
              </div>
            </div>
            <div className="flex h-[420px] items-center justify-center bg-mist/60 sm:h-[520px] lg:h-[min(520px,calc(100dvh-210px))]">
              {doc.mime.startsWith("image/") ? (
                // Private file served from our own origin to staff only.
                // eslint-disable-next-line @next/next/no-img-element
                <img key={doc.id} src={fileUrl(doc.id)} alt={`${doc.kindLabel} uploaded by the vendor`} className="max-h-full max-w-full object-contain" />
              ) : doc.mime === "application/pdf" ? (
                <object key={doc.id} data={fileUrl(doc.id)} type="application/pdf" className="size-full" aria-label={`${doc.kindLabel} (PDF)`}>
                  <p className="p-6 text-center text-[13px] text-muted">
                    This browser can&apos;t show PDFs inline.{" "}
                    <a className="text-red underline" href={fileUrl(doc.id)} target="_blank" rel="noreferrer">
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
                <button type="button" disabled={busy !== null} onClick={() => run(`v${doc.id}`, () => reviewInsDocumentAction(doc.id, { status: "verified" }), `${doc.kindLabel} verified`)} className={cn(actionBtn, btnTone.dark)}>
                  {busy === `v${doc.id}` ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Check aria-hidden className="size-4" />} Mark verified
                </button>
              )}
              {doc.status !== "rejected" && (
                <button type="button" disabled={busy !== null} onClick={() => reject.open({ id: doc.id, label: doc.kindLabel })} className={cn(actionBtn, btnTone.danger)}>
                  <X aria-hidden className="size-4" /> Reject
                </button>
              )}
              {doc.status !== "pending" && (
                <button type="button" disabled={busy !== null} onClick={() => run(`p${doc.id}`, () => reviewInsDocumentAction(doc.id, { status: "pending" }), "Reset to awaiting review")} className={cn(actionBtn, btnTone.outline)}>
                  {busy === `p${doc.id}` ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <RotateCcw aria-hidden className="size-4" />} Reset
                </button>
              )}
              <span className="ml-auto text-[12px] text-muted">{FILE_LABEL[doc.status]}</span>
            </div>
          </div>
        )}
      </div>
      {reject.element}
    </div>
  );
}

/** Compact verify / reject buttons for one document (verification workspace). */
export function InsDocumentQuickActions({ id, label, status }: { id: number; label: string; status: "pending" | "verified" | "rejected" }) {
  const { busy, run } = useQuickRun();
  const reject = useRejectDoc();
  return (
    <span className="flex shrink-0 gap-1.5">
      {status !== "verified" && (
        <button type="button" disabled={busy !== null} onClick={() => run("v", () => reviewInsDocumentAction(id, { status: "verified" }), `${label} verified`)} className={cn(actionBtn, btnTone.outline, "h-8 px-2.5 text-[12.5px]")} aria-label={`Verify ${label}`}>
          {busy ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Check aria-hidden className="size-3.5" />} Verify
        </button>
      )}
      {status !== "rejected" && (
        <button type="button" disabled={busy !== null} onClick={() => reject.open({ id, label })} className={cn(actionBtn, btnTone.danger, "h-8 px-2.5 text-[12.5px]")} aria-label={`Reject ${label}`}>
          <X aria-hidden className="size-3.5" /> Reject
        </button>
      )}
      {reject.element}
    </span>
  );
}

/* ── Change requests ────────────────────────────────────────── */

export function InsChangeRequestActions({ id, fields }: { id: number; fields: string[] }) {
  const dialog = useInsDialog();
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() =>
          dialog.open({
            title: "Approve change request",
            description: `Applies the new ${fields.join(", ")} to the verified application and the vendor's record.`,
            fields: [{ name: "remarks", kind: "textarea", label: "Message to the vendor", optional: true, rows: 2 }],
            submitLabel: "Approve & apply",
            icon: <Check aria-hidden className="size-4" />,
            run: (v) => decideInsChangeRequestAction(id, { decision: "approve", remarks: v.remarks }),
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
            fields: [{ name: "remarks", kind: "textarea", label: "Reason (shown to the vendor)", rows: 3 }],
            submitLabel: "Reject request",
            tone: "danger",
            icon: <X aria-hidden className="size-4" />,
            run: (v) => decideInsChangeRequestAction(id, { decision: "reject", remarks: v.remarks }),
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

/** `canReveal` false (editors): the masked number only — revealing is for administrators. */
export function InsBankReveal({ vendorId, masked, hasNumber, canReveal = true }: { vendorId: number; masked: string; hasNumber: boolean; canReveal?: boolean }) {
  const { toast } = useUI();
  const [full, setFull] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reveal = async () => {
    setBusy(true);
    const res = await revealInsBankAccountAction(vendorId).catch(() => OFFLINE);
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
  if (!hasNumber) return <span className="text-muted">Not provided{masked ? ` (${masked})` : ""}</span>;
  if (!canReveal)
    return (
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[14px] tracking-wider num">{masked || "••••"}</span>
        <span className="text-[12px] text-muted">Administrators can reveal the full number</span>
      </span>
    );
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-[14px] tracking-wider num" aria-live="polite">
        {full ?? (masked || "••••")}
      </span>
      {full ? (
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
          {busy ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Eye aria-hidden className="size-3.5" />} Reveal account number
        </button>
      )}
    </span>
  );
}

/* ── Internal comments ──────────────────────────────────────── */

export function InsInternalNoteForm({ vendorId }: { vendorId: number }) {
  const router = useRouter();
  const { toast } = useUI();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await addInsInternalNoteAction(vendorId, { note }).catch(() => OFFLINE);
    setBusy(false);
    if (!res.ok) {
      setError("fieldErrors" in res ? res.fieldErrors?.note : undefined);
      return toast(res.error ?? "Couldn't save the note", { tone: "error" });
    }
    setNote("");
    setError(undefined);
    toast("Internal comment added", { tone: "success" });
    router.refresh();
  };
  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor="ins-internal-note" className="mb-2 block text-[12.5px] font-medium">
        Add an internal comment
      </label>
      <textarea
        id="ins-internal-note"
        rows={3}
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          if (error) setError(undefined);
        }}
        placeholder="Visible to MarchGear staff only — e.g. Called the compliance officer; licence renewal letter expected Monday."
        aria-invalid={error ? true : undefined}
        className={cn(control, "py-2.5 leading-relaxed")}
      />
      {error && <p className="mt-1.5 text-xs text-red">{error}</p>}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-1.5 text-[12px] text-muted">
          <Lock aria-hidden className="size-3.5" /> Never shown to the vendor
        </p>
        <Button type="submit" size="sm" variant="dark" disabled={busy || !note.trim()} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <MessageSquarePlus className="size-4" aria-hidden />}>
          Add comment
        </Button>
      </div>
    </form>
  );
}

/* ── Detail tabs ────────────────────────────────────────────── */

/** Client-side tabs over server-rendered panels; the open tab is kept in `?tab=` for deep links. */
export function InsDetailTabs({ tabs, initial, label = "Vendor sections" }: { tabs: { key: string; label: string; count?: number; content: ReactNode }[]; initial: string; label?: string }) {
  const [active, setActive] = useState(tabs.some((t) => t.key === initial) ? initial : tabs[0].key);
  const change = (key: string) => {
    setActive(key);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", key);
    window.history.replaceState(null, "", url);
  };
  return (
    <div>
      <Tabs items={tabs.map((t) => ({ value: t.key, label: t.label, count: t.count }))} value={active} onChange={change} size="sm" ariaLabel={label} className="mb-6 gap-6" />
      {tabs.map((t) => (
        <div key={t.key} role="tabpanel" aria-label={t.label} hidden={t.key !== active}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
