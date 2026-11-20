import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import {
  ArrowRight,
  BadgeCheck,
  Ban,
  ChartColumn,
  Check,
  CircleAlert,
  Clock3,
  Download,
  ExternalLink,
  FileSignature,
  FileText,
  Inbox,
  LifeBuoy,
  Lock,
  Mail,
  Megaphone,
  Phone,
  RefreshCw,
  Shield,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { getDb } from "@/db";
import { insApprovals, insFiles, users } from "@/db/schema";
import type { InsApprovalTarget, InsVendorStatus } from "@/db/enums";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { INS_REQUIRED_DOCUMENTS, INS_STEPS } from "@/insurance/application";
import {
  FILE_REVIEW_LABEL,
  FILE_REVIEW_TONE,
  INS_DOC_KIND_LABEL,
  INS_VENDOR_CATEGORY_LABEL,
  INS_VENDOR_EDITABLE,
  INS_VENDOR_IN_REVIEW,
  INS_VENDOR_STATUS_LABEL,
  INS_VENDOR_STATUS_TONE,
} from "@/insurance/labels";
import { insCorrectionsFor, insReferencedFiles } from "@/insurance/schemas";
import type { FileRef } from "@/insurance/types";
import { trimStop } from "@/partner/schemas";
import { getCatalog } from "@/server/catalog";
import { requireInsurer, vendorName } from "@/server/insurance/context";
import { furthestKey, toWizard } from "@/app/insurance-vendor/register/_lib/wizard";
import { Badge, Panel, PortalHeader, formatDateTime, formatDay } from "@/components/portal/ui";
import { StatusGuide } from "@/components/insurance/vendor/application-status/status-guide";

export const metadata: Metadata = { title: "Application status" };

/** ins_approvals targets that belong to the vendor's own verification. */
const ACCOUNT_TARGETS: InsApprovalTarget[] = ["vendor", "document"];

const STAGES = [
  { key: "draft", label: "Draft" },
  { key: "submitted", label: "Submitted" },
  { key: "pending_approval", label: "Pending approval" },
  { key: "under_review", label: "Under review" },
  { key: "approved", label: "Approved" },
] as const;

const POSITION: Record<InsVendorStatus, number> = {
  draft: 0,
  submitted: 1,
  pending_approval: 2,
  under_review: 3,
  documents_required: 3,
  changes_requested: 3,
  rejected: 3,
  approved: 4,
  suspended: 4,
};

const HEADLINE: Record<InsVendorStatus, { title: string; body: string }> = {
  draft: { title: "Your application isn't submitted yet", body: "Finish the remaining steps and submit — MarchGear's vendor team starts verifying as soon as it arrives." },
  submitted: { title: "Application received", body: "Your application is joining the verification queue. We'll verify your company, regulatory registration, branches, bank account and documents." },
  pending_approval: { title: "Application received — pending approval", body: "Your application is in the verification queue. We'll verify your company, regulatory registration, branches, bank account and documents." },
  under_review: { title: "Our team is reviewing your application", body: "A vendor specialist is verifying your details and documents. If anything needs clarifying, we'll tell you here." },
  documents_required: { title: "We need more documents", body: "Upload the documents listed below, then resubmit. Everything else you entered is kept." },
  changes_requested: { title: "A few changes are needed", body: "Update the items listed below, then resubmit. Everything else you entered is kept." },
  approved: { title: "You're a verified MarchGear insurance vendor", body: "Your company is approved and the full portal is open. Products, campaigns and adverts are reviewed separately before they go live." },
  rejected: { title: "Your application wasn't approved", body: "We couldn't approve this application. The reason is below — contact vendor support if you'd like to discuss it." },
  suspended: { title: "Your vendor account is suspended", body: "Your products and campaigns are hidden while the account is suspended. The reason is below — contact vendor support to resolve it." },
};

const ACTION_LABEL: Record<string, string> = {
  created: "Application started",
  submitted: "Application submitted",
  resubmitted: "Application resubmitted",
  queued: "Added to the verification queue",
  review: "Review started",
  review_started: "Review started",
  under_review: "Review started",
  documents_required: "Documents requested",
  request_documents: "Documents requested",
  changes_requested: "Changes requested",
  request_changes: "Changes requested",
  approved: "Approved",
  approve: "Approved",
  rejected: "Not approved",
  reject: "Not approved",
  suspended: "Account suspended",
  suspend: "Account suspended",
  reactivated: "Account reactivated",
  reactivate: "Account reactivated",
  verified: "Verified",
  verify: "Verified",
  note: "Note from MarchGear",
  comment: "Note from MarchGear",
};

const humanise = (s: string) => s.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

function docLabel(action: string) {
  if (/^(verif|approv)/.test(action)) return "Document verified";
  if (/^reject/.test(action)) return "Document rejected";
  return `Document ${humanise(action).toLowerCase()}`;
}

const UNLOCKS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Shield, title: "Products, coverage & add-ons", body: "List motor products — each approved before it's public" },
  { icon: Inbox, title: "Quote requests", body: "Enquiries from car owners, for your team" },
  { icon: FileSignature, title: "Quotations", body: "Indicative or insurer-authorised, shared by link" },
  { icon: RefreshCw, title: "Renewals", body: "Every upcoming expiry in one pipeline" },
  { icon: Megaphone, title: "Campaigns & advertising", body: "Promotions and placements across MarchGear" },
  { icon: ChartColumn, title: "Analytics", body: "Views, requests, quotations and conversions" },
];

export default async function InsuranceApplicationStatusPage() {
  const ctx = await requireInsurer({ approved: false });
  const { vendor } = ctx;
  const db = getDb();
  const { app, bank } = toWizard(vendor.application);
  const refs = insReferencedFiles(app);

  const [approvals, files, catalog] = await Promise.all([
    db
      .select({ a: insApprovals, actor: users.name })
      .from(insApprovals)
      .leftJoin(users, eq(users.id, insApprovals.actorUserId))
      // Only the vendor's own verification; staff-only notes never reach the vendor.
      .where(and(eq(insApprovals.vendorId, vendor.id), inArray(insApprovals.target, ACCOUNT_TARGETS), ne(insApprovals.action, "internal_note")))
      .orderBy(desc(insApprovals.createdAt), desc(insApprovals.id))
      .limit(60),
    refs.length
      ? db
          .select({ id: insFiles.id, kind: insFiles.kind, filename: insFiles.filename, mime: insFiles.mime, status: insFiles.status, remarks: insFiles.remarks, createdAt: insFiles.createdAt })
          .from(insFiles)
          .where(
            and(
              eq(insFiles.vendorId, vendor.id),
              inArray(
                insFiles.id,
                refs.map((f) => f.id),
              ),
            ),
          )
      : Promise.resolve([]),
    getCatalog(),
  ]);

  const status = vendor.status;
  const editable = INS_VENDOR_EDITABLE.includes(status);
  const canEdit = editable && ctx.can("profile.manage");
  const reopened = status === "changes_requested" || status === "documents_required";
  const corrections = insCorrectionsFor(vendor.requiredCorrections);
  const { content } = catalog;
  const support = {
    email: content.insuranceSettings.vendorSupportEmail || content.site.supportEmail,
    phone: content.insuranceSettings.vendorSupportPhone || content.site.phone,
    hours: content.site.hours,
  };

  // Names for documents mentioned in the timeline (including older, replaced files).
  const docTargets = approvals.filter((r) => r.a.target === "document" && r.a.targetId).map((r) => r.a.targetId!);
  const older = docTargets.length
    ? await db
        .select({ id: insFiles.id, filename: insFiles.filename })
        .from(insFiles)
        .where(and(eq(insFiles.vendorId, vendor.id), inArray(insFiles.id, docTargets)))
    : [];
  const fileName = new Map([...older, ...files].map((f) => [f.id, f.filename]));
  const byId = new Map(files.map((f) => [f.id, f]));

  // Which slot each referenced file fills, for clear labels.
  const slotLabel = new Map<number, string>();
  INS_REQUIRED_DOCUMENTS.forEach((d) => app.documents[d.key] && slotLabel.set(app.documents[d.key]!.id, d.label));
  app.regulatory.documents.forEach((f, i) => slotLabel.set(f.id, `Regulatory document ${i + 1}`));
  if (app.bank.proof) slotLabel.set(app.bank.proof.id, "Bank proof");
  app.documents.supporting.forEach((f, i) => slotLabel.set(f.id, `Supporting document ${i + 1}`));
  const docs = refs.map((r) => byId.get(r.id)).filter((f): f is NonNullable<typeof f> => Boolean(f));

  // Missing: staff corrections, required documents not uploaded or rejected (incl. bank proof).
  const required: { label: string; file: FileRef | null; step: "documents" | "bank" }[] = [
    ...INS_REQUIRED_DOCUMENTS.map((d) => ({ label: d.label, file: app.documents[d.key], step: "documents" as const })),
    { label: "Bank proof (cancelled cheque or statement)", file: app.bank.proof, step: "bank" as const },
  ];
  const missingDocs = required
    .map((r) => {
      const f = r.file ? byId.get(r.file.id) : undefined;
      if (!r.file || !f) return { ...r, reason: "Not uploaded" };
      if (f.status === "rejected") return { ...r, reason: `Rejected${f.remarks ? ` — ${trimStop(f.remarks)}` : ""}` };
      return null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const showMissing = status !== "approved" && (corrections.length > 0 || missingDocs.length > 0);

  // When each stage was (last) reached — walked backwards so dates always read in order.
  const steps = approvals.filter((r) => r.a.target === "vendor");
  const reached = (to: string, notAfter?: Date | null) => steps.find((r) => r.a.toStatus === to && (!notAfter || r.a.createdAt <= notAfter))?.a.createdAt ?? null;
  const pos = POSITION[status];
  const special = status === "documents_required" || status === "changes_requested" || status === "rejected" || status === "suspended";
  const stageDates: (Date | null)[] = STAGES.map(() => null);
  for (let i = pos, bound: Date | null = null; i >= 0; i--) {
    const key = STAGES[i].key;
    const date: Date | null =
      key === "draft"
        ? vendor.createdAt
        : i === pos
          ? special
            ? reached(status)
            : key === "approved"
              ? (vendor.approvedAt ?? reached(key))
              : reached(key)
          : (reached(key, bound) ?? (key === "submitted" || key === "pending_approval" ? vendor.submittedAt : null));
    stageDates[i] = date;
    if (date) bound = date;
  }
  const lastUpdate = approvals[0]?.a.createdAt ?? vendor.updatedAt;
  const continueHref = `/insurance-vendor/register/${status === "draft" ? furthestKey(vendor) : (corrections[0]?.step ?? "documents")}`;
  const primary = app.branches.find((b) => b.isPrimary) ?? app.branches[0];

  return (
    <>
      <PortalHeader
        title="Application status"
        description={
          <>
            Reference <span className="font-medium text-ink num">{vendor.reference}</span>
            {vendor.submittedAt ? <> · Submitted {formatDateTime(vendor.submittedAt)}</> : <> · Not submitted yet</>}
          </>
        }
        actions={
          canEdit ? (
            <Button href={continueHref} arrow>
              {status === "draft" ? "Continue application" : "Fix & resubmit"}
            </Button>
          ) : status === "approved" ? (
            <Button href="/insurance-vendor/dashboard" variant="dark" arrow>
              Go to dashboard
            </Button>
          ) : undefined
        }
      />

      {/* Status + progress */}
      <section className="animate-rise border border-line bg-white">
        <div className="grid gap-6 px-5 py-6 md:px-8 md:py-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="min-w-0">
            <Badge tone={INS_VENDOR_STATUS_TONE[status]}>{INS_VENDOR_STATUS_LABEL[status]}</Badge>
            <h2 className="mt-4 font-display text-[24px] font-semibold leading-tight tracking-[-0.02em] md:text-[28px]">{HEADLINE[status].title}</h2>
            <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-muted">{HEADLINE[status].body}</p>
            {editable && !ctx.can("profile.manage") && <p className="mt-3 text-[13px] text-muted">Only your company&apos;s owner or an administrator can edit the application.</p>}
          </div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-[13px] sm:grid-cols-4 lg:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-muted">Company</dt>
              <dd className="mt-0.5 truncate font-medium">{vendorName(vendor)}</dd>
            </div>
            <div>
              <dt className="text-muted">Reference</dt>
              <dd className="mt-0.5 font-medium num">{vendor.reference}</dd>
            </div>
            <div>
              <dt className="text-muted">Submitted</dt>
              <dd className="mt-0.5 font-medium">{vendor.submittedAt ? formatDay(vendor.submittedAt) : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Last update</dt>
              <dd className="mt-0.5 font-medium">{formatDay(lastUpdate)}</dd>
            </div>
          </dl>
        </div>

        <ol className="grid border-t border-line md:grid-cols-5" aria-label="Application progress">
          {STAGES.map((s, i) => {
            const done = i < pos || (i === pos && status === "approved");
            const current = i === pos;
            const halted = current && special;
            const label = halted ? INS_VENDOR_STATUS_LABEL[status] : s.label;
            const date = done || current ? stageDates[i] : null;
            const red = halted && status === "rejected";
            const amber = halted && reopened;
            const dark = halted && status === "suspended";
            return (
              <li key={s.key} aria-current={current ? "step" : undefined} className={cn("relative flex gap-3 border-line px-5 py-4 md:flex-col md:gap-2.5 md:px-6 md:py-5", i > 0 && "border-t md:border-l md:border-t-0", current && "bg-[#FAFAFA]")}>
                <span
                  className={cn(
                    "inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold transition-colors duration-700 num",
                    done && !dark && "border-ink bg-ink text-white",
                    current && !halted && !done && "border-red bg-white text-red shadow-[0_0_0_4px_rgba(227,30,36,0.08)]",
                    amber && "border-[#e3b04b] bg-[#fdf3e1] text-[#9a5b00]",
                    red && "border-red bg-red text-white",
                    dark && "border-ink bg-ink text-white",
                    !done && !current && "border-line bg-white text-muted",
                  )}
                >
                  {dark ? <Ban aria-hidden className="size-3.5" /> : done ? <Check aria-hidden className="size-3.5" strokeWidth={3} /> : red ? <X aria-hidden className="size-3.5" strokeWidth={3} /> : amber ? <CircleAlert aria-hidden className="size-3.5" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className={cn("block text-[13.5px]", current ? "font-semibold text-ink" : done ? "text-ink" : "text-muted")}>{label}</span>
                  <span className="mt-0.5 block text-[12px] text-muted">
                    {date ? formatDay(date) : current ? "Now" : done ? "Done" : "Upcoming"}
                    {amber ? " · action needed" : ""}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {!ctx.approved && (
        <div className="mt-4 flex items-start gap-3 border border-line bg-white px-5 py-4 text-[13.5px]">
          <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
          <p className="leading-relaxed text-ink/80">
            <span className="font-medium text-ink">Why you&apos;re seeing this page.</span>{" "}
            {status === "suspended"
              ? "While the account is suspended, products, quote requests, renewals, campaigns and the other portal pages are closed — the portal brings you here."
              : status === "rejected"
                ? "Products, quote requests, renewals, campaigns and the other portal pages aren't available because the application wasn't approved — the portal brings you here."
                : "Products, quote requests, renewals, campaigns and the other portal pages open once your company is approved — until then, the portal brings you here."}{" "}
            Notifications, support and settings work as normal.
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {(vendor.adminRemarks || showMissing) && (
            <section className={cn("border bg-white", reopened ? "border-[#f0d9a8]" : status === "rejected" || status === "suspended" ? "border-red/30" : "border-line")}>
              <header className="flex items-center gap-2 border-b border-line px-5 py-3.5">
                {status === "approved" ? <BadgeCheck aria-hidden className="size-4 text-[#1e7a3c]" /> : <CircleAlert aria-hidden className={cn("size-4", reopened ? "text-[#9a5b00]" : status === "draft" ? "text-muted" : "text-red")} />}
                <h2 className="text-[14px] font-semibold">{reopened ? "What we need from you" : status === "draft" ? "Still to do" : "Remarks from MarchGear"}</h2>
              </header>
              <div className="space-y-5 p-5">
                {vendor.adminRemarks && (
                  <div>
                    <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-muted">Comments from MarchGear</p>
                    <blockquote className="whitespace-pre-line border-l-2 border-ink/20 pl-4 text-[14px] leading-relaxed">{vendor.adminRemarks}</blockquote>
                  </div>
                )}
                {corrections.length > 0 && status !== "approved" && (
                  <div>
                    <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-muted">Required corrections</p>
                    <ul className="divide-y divide-line border border-line">
                      {corrections.map((c, i) => (
                        <li key={i} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-[14px]">{c.text}</p>
                            <p className="mt-0.5 text-[12px] text-muted">
                              Step {INS_STEPS.find((s) => s.key === c.step)?.n} · {INS_STEPS.find((s) => s.key === c.step)?.title}
                            </p>
                          </div>
                          {canEdit && (
                            <Link href={`/insurance-vendor/register/${c.step}`} className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-[3px] bg-ink px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-ink-3 sm:self-auto">
                              Fix now <ArrowRight aria-hidden className="size-3.5" />
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {missingDocs.length > 0 && status !== "approved" && (
                  <div>
                    <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-muted">Missing documents</p>
                    <ul className="divide-y divide-line border border-line">
                      {missingDocs.map((m) => (
                        <li key={m.label} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-[14px]">{m.label}</p>
                            <p className={cn("mt-0.5 text-[12px]", m.reason.startsWith("Rejected") ? "text-red" : "text-muted")}>{m.reason}</p>
                          </div>
                          {canEdit && (
                            <Link
                              href={`/insurance-vendor/register/${m.step}`}
                              className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-[3px] border border-line px-3.5 text-[13px] font-medium transition-colors hover:border-ink sm:self-auto"
                            >
                              Upload <ArrowRight aria-hidden className="size-3.5" />
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}

          <Panel title="Verification timeline" padded={false}>
            {approvals.length === 0 ? (
              <p className="px-5 py-10 text-center text-[14px] text-muted">Nothing here yet.</p>
            ) : (
              <ol className="px-5 py-5">
                {approvals.map(({ a, actor }, i) => {
                  const label =
                    a.target === "document"
                      ? docLabel(a.action)
                      : (ACTION_LABEL[a.action] ?? (a.toStatus && a.toStatus in INS_VENDOR_STATUS_LABEL ? INS_VENDOR_STATUS_LABEL[a.toStatus as InsVendorStatus] : humanise(a.action)));
                  const who = a.actorSide === "admin" ? "MarchGear team" : a.actorSide === "system" ? "Automatic" : a.actorUserId === ctx.user.id ? "You" : (actor ?? "Your team");
                  const subject = a.target === "document" && a.targetId ? (slotLabel.get(a.targetId) ?? fileName.get(a.targetId) ?? "Document") : null;
                  const dot = a.actorSide === "admin" ? (/reject|suspend/.test(a.action) ? "bg-red" : /approv|verif|reactiv/.test(a.action) ? "bg-[#1e7a3c]" : "bg-[#c98a12]") : a.actorSide === "system" ? "bg-ink/30" : "bg-ink";
                  return (
                    <li key={a.id} className="relative flex gap-4 pb-6 last:pb-0">
                      {i < approvals.length - 1 && <span aria-hidden className="absolute left-[5px] top-4 h-[calc(100%-8px)] w-px bg-line" />}
                      <span aria-hidden className={cn("relative mt-1.5 size-[11px] shrink-0 rounded-full ring-4 ring-white", dot)} />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-medium">
                          {label}
                          {subject && <span className="inline-flex h-5 max-w-full items-center truncate rounded-full bg-mist px-2 text-[11px] font-medium text-muted">{subject}</span>}
                        </p>
                        {a.remarks && a.remarks.trim().toLowerCase() !== label.toLowerCase() && <p className="mt-1 whitespace-pre-line text-[13.5px] leading-relaxed text-ink/80">{a.remarks}</p>}
                        <p className="mt-1 text-[12px] text-muted">
                          {who} · {formatDateTime(a.createdAt)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>

          <Panel title="Document status" padded={false} action={<span className="text-[12px] text-muted">{docs.length} uploaded</span>}>
            {docs.length === 0 ? (
              <p className="px-5 py-10 text-center text-[14px] text-muted">No documents uploaded yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {docs.map((f) => {
                  const label = slotLabel.get(f.id) ?? INS_DOC_KIND_LABEL[f.kind as keyof typeof INS_DOC_KIND_LABEL] ?? humanise(f.kind);
                  return (
                    <li key={f.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                      <span className="hidden size-10 shrink-0 items-center justify-center rounded-[3px] bg-red-50 text-red sm:inline-flex">
                        <FileText aria-hidden className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-medium">{label}</p>
                        <p className="truncate text-[12.5px] text-muted">
                          {f.filename} · uploaded {formatDay(f.createdAt)}
                        </p>
                        {f.remarks && <p className={cn("mt-1 text-[13px]", f.status === "rejected" ? "text-red" : "text-ink/80")}>{f.remarks}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge tone={FILE_REVIEW_TONE[f.status]}>{FILE_REVIEW_LABEL[f.status]}</Badge>
                        <a href={`/insurance-vendor/files/${f.id}`} target="_blank" rel="noreferrer" className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-mist hover:text-ink" aria-label={`Open ${label}`}>
                          <ExternalLink className="size-4" />
                        </a>
                        <a href={`/insurance-vendor/files/${f.id}?download=1`} className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-mist hover:text-ink" aria-label={`Download ${label}`}>
                          <Download className="size-4" />
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="What each status means" padded={false}>
            <StatusGuide current={status} />
          </Panel>
        </div>

        <aside className="min-w-0 space-y-6">
          <Panel title="Your application">
            <dl className="space-y-3 text-[13.5px]">
              {[
                ["Legal name", app.company.legalName],
                ["Brand name", app.company.brandName],
                ["Category", app.regulatory.category ? INS_VENDOR_CATEGORY_LABEL[app.regulatory.category] : ""],
                ["Licence", app.regulatory.licenceNumber],
                ["Valid until", app.regulatory.licenceValidUntil ? formatDay(app.regulatory.licenceValidUntil) : ""],
                ["GSTIN", app.registration.gstin],
                ["Branches", app.branches.length ? `${app.branches.length} · ${primary?.city || "—"}` : ""],
                ["Bank account", bank.hasAccount ? bank.masked : ""],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="shrink-0 text-muted">{k}</dt>
                  <dd className="min-w-0 truncate text-right font-medium" title={v}>
                    {v || "—"}
                  </dd>
                </div>
              ))}
            </dl>
            {canEdit && (
              <Link href={continueHref} className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink underline-offset-4 hover:text-red hover:underline">
                {status === "draft" ? "Continue where you left off" : "Edit your application"} <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            )}
            {INS_VENDOR_IN_REVIEW.includes(status) && <p className="mt-4 border-t border-line pt-4 text-[12.5px] leading-relaxed text-muted">The application is locked while it&apos;s reviewed. If anything needs changing, we&apos;ll reopen it for you.</p>}
            {status === "approved" && <p className="mt-4 border-t border-line pt-4 text-[12.5px] leading-relaxed text-muted">Verified details (legal name, GSTIN, PAN, licence, bank) change through a request from your company profile.</p>}
          </Panel>

          <Panel title={status === "approved" ? "Open to you" : status === "suspended" ? "Paused while suspended" : "Opens after approval"}>
            <ul className="space-y-3.5">
              {UNLOCKS.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-3">
                  <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-[3px]", status === "approved" ? "bg-ink text-white" : "bg-mist text-muted")}>
                    <Icon aria-hidden className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[13.5px] font-medium">
                      {title}
                      {status === "approved" ? <BadgeCheck aria-hidden className="size-3.5 text-[#1e7a3c]" /> : <Lock aria-hidden className="size-3 text-muted" />}
                    </span>
                    <span className="block text-[12.5px] text-muted">{body}</span>
                  </span>
                </li>
              ))}
            </ul>
            {status !== "approved" && (
              <p className="mt-4 border-t border-line pt-4 text-[12.5px] leading-relaxed text-muted">
                {status === "suspended" ? "Your products and campaigns are hidden from customers until the suspension is lifted." : "Until then, nothing from your company is published on MarchGear."}
              </p>
            )}
          </Panel>

          <Panel title="Vendor support">
            <p className="text-[13.5px] leading-relaxed text-muted">Questions about your application, registration or documents? MarchGear&apos;s vendor team can help.</p>
            <ul className="mt-4 space-y-2.5 text-[13.5px]">
              {support.phone && (
                <li>
                  <a href={`tel:${support.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-2 font-medium hover:text-red">
                    <Phone aria-hidden className="size-4 text-muted" /> <span className="num">{support.phone}</span>
                  </a>
                </li>
              )}
              {support.email && (
                <li className="min-w-0">
                  <a href={`mailto:${support.email}?subject=${encodeURIComponent(`Vendor application ${vendor.reference}`)}`} className="inline-flex max-w-full items-center gap-2 font-medium hover:text-red">
                    <Mail aria-hidden className="size-4 shrink-0 text-muted" /> <span className="truncate">{support.email}</span>
                  </a>
                </li>
              )}
              {support.hours && (
                <li className="inline-flex items-center gap-2 text-muted">
                  <Clock3 aria-hidden className="size-4" /> {support.hours}
                </li>
              )}
            </ul>
            {ctx.can("support.use") && (
              <Button href="/insurance-vendor/support" variant="outline" size="sm" className="mt-5 w-full" icon={<LifeBuoy aria-hidden className="size-4" />}>
                Raise a support ticket
              </Button>
            )}
            <p className="mt-4 text-[12px] text-muted">
              Quote your reference <span className="font-medium text-ink num">{vendor.reference}</span>.
            </p>
          </Panel>

          <Panel title="Your team">
            <p className="text-[13px] leading-relaxed text-muted">{ctx.can("team.manage") ? "Add colleagues and choose what each person can do." : "Your company's owner manages who can use the portal."}</p>
            <Link href={ctx.can("team.manage") ? "/insurance-vendor/settings?tab=team" : "/insurance-vendor/settings"} className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink underline-offset-4 hover:text-red hover:underline">
              <Users aria-hidden className="size-4" /> {ctx.can("team.manage") ? "Manage your team" : "Your account settings"}
            </Link>
          </Panel>
        </aside>
      </div>
    </>
  );
}
