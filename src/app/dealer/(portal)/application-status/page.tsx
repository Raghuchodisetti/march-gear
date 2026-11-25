import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import {
  ArrowRight,
  BadgeCheck,
  Ban,
  CarFront,
  ChartColumn,
  Check,
  CircleAlert,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  Inbox,
  Lock,
  Mail,
  Phone,
  Sparkles,
  Store,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { getDb } from "@/db";
import { partnerApprovals, partnerBrands, partnerFiles, users } from "@/db/schema";
import type { ApprovalTarget, PartnerStatus } from "@/db/enums";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { WIZARD_STEPS } from "@/partner/application";
import {
  BRAND_STATUS_LABEL,
  BRAND_STATUS_TONE,
  BUSINESS_TYPE_LABEL,
  DOC_KIND_LABEL,
  FILE_STATUS_LABEL,
  FILE_STATUS_TONE,
  PARTNER_EDITABLE,
  PARTNER_STATUS_LABEL,
  PARTNER_STATUS_TONE,
} from "@/partner/labels";
import { correctionsFor } from "@/partner/schemas";
import { getCatalog } from "@/server/catalog";
import { requirePartner } from "@/server/partner/context";
import { furthestSlug, referencedFiles, toWizard } from "@/server/partner/application";
import { Badge, Panel, PortalHeader, formatDateTime, formatDay } from "@/components/portal/ui";

export const metadata: Metadata = { title: "Application status" };

/** partner_approvals targets that belong to the dealership's own verification. */
const ACCOUNT_TARGETS: ApprovalTarget[] = ["partner", "document", "brand", "profile_change"];

const STAGES = [
  { key: "draft", label: "Draft" },
  { key: "submitted", label: "Submitted" },
  { key: "pending_approval", label: "Pending approval" },
  { key: "under_review", label: "Under review" },
  { key: "approved", label: "Approved" },
] as const;

const POSITION: Record<PartnerStatus, number> = {
  draft: 0,
  submitted: 1,
  pending_approval: 2,
  under_review: 3,
  documents_required: 3,
  changes_requested: 3,
  rejected: 3,
  approved: 4,
  suspended: 4,
  deactivated: 4,
};

const HEADLINE: Record<PartnerStatus, { title: string; body: string }> = {
  draft: { title: "Your application isn't submitted yet", body: "Finish the remaining steps and submit it — our partner team starts verifying as soon as it arrives." },
  submitted: { title: "Application received", body: "Your application is in our verification queue. We'll review your business details, showrooms, brand authorisations and documents." },
  pending_approval: { title: "Application received — pending approval", body: "Your application is in our verification queue. We'll review your business details, showrooms, brand authorisations and documents." },
  under_review: { title: "Our team is reviewing your application", body: "A partner specialist is verifying your details and documents. We'll contact you here if anything needs clarifying." },
  documents_required: { title: "We need more documents", body: "Upload the documents listed below, then resubmit your application. Everything else you entered is kept." },
  changes_requested: { title: "A few changes are needed", body: "Update the items listed below, then resubmit your application. Everything else you entered is kept." },
  approved: { title: "You're a verified MarchGear partner", body: "Your dealership is approved and the full portal is unlocked. New-car listings go live when you publish them; used cars and offers are reviewed by MarchGear before they go live." },
  rejected: { title: "Your application wasn't approved", body: "We couldn't approve this application. The reason is below — contact partner support if you'd like to discuss it." },
  suspended: { title: "Your partner account is suspended", body: "Your public listings and offers are hidden while the account is suspended. The reason is below — contact partner support to resolve it." },
  deactivated: { title: "Your partner account is deactivated", body: "This dealership is no longer active on MarchGear. Contact partner support if you think this is a mistake." },
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
  deactivated: "Account deactivated",
  deactivate: "Account deactivated",
  verified: "Verified",
  verify: "Verified",
  note: "Note from MarchGear",
};

const humanise = (s: string) => s.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** Decisions on a single document or brand read better with their subject. */
function targetLabel(target: string, action: string): string | null {
  const noun = target === "document" ? "Document" : target === "brand" ? "Brand authorisation" : null;
  if (!noun) return null;
  if (/^(verif|approv)/.test(action)) return `${noun} ${target === "document" ? "verified" : "approved"}`;
  if (/^reject/.test(action)) return `${noun} rejected`;
  if (/^expir/.test(action)) return `${noun} expired`;
  return `${noun} ${humanise(action).toLowerCase()}`;
}

const UNLOCKS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Store, title: "Public dealer page", body: "Your showrooms, brands and reviews on MarchGear" },
  { icon: CarFront, title: "New & used inventory", body: "List stock from the MarchGear catalogue — new cars go live when you publish, used cars after review" },
  { icon: Sparkles, title: "Offers & campaigns", body: "Festival, finance and exchange offers" },
  { icon: Inbox, title: "Enquiries & test drives", body: "Leads, follow-ups and bookings for your team" },
  { icon: Users, title: "Staff accounts", body: "Invite your team with role-based access" },
  { icon: ChartColumn, title: "Analytics", body: "Views, enquiries and conversions" },
];

export default async function ApplicationStatusPage() {
  const ctx = await requirePartner({ approved: false });
  const { partner } = ctx;
  const db = getDb();
  const { app } = toWizard(partner.application);
  const refs = referencedFiles(app);
  const brandCerts = new Map(app.brands.items.filter((i) => i.certificate).map((i) => [i.certificate!.id, i.brand]));

  const [approvals, files, brandRows, catalog] = await Promise.all([
    db
      .select({ a: partnerApprovals, actor: users.name })
      .from(partnerApprovals)
      .leftJoin(users, eq(users.id, partnerApprovals.actorUserId))
      // Only the dealership's own verification (vehicles and offers have their own histories); staff-only notes never reach the dealer.
      .where(and(eq(partnerApprovals.partnerId, partner.id), inArray(partnerApprovals.target, ACCOUNT_TARGETS), ne(partnerApprovals.action, "internal_note")))
      .orderBy(desc(partnerApprovals.createdAt), desc(partnerApprovals.id))
      .limit(60),
    refs.length
      ? db
          .select({ id: partnerFiles.id, kind: partnerFiles.kind, filename: partnerFiles.filename, mime: partnerFiles.mime, status: partnerFiles.status, remarks: partnerFiles.remarks, createdAt: partnerFiles.createdAt })
          .from(partnerFiles)
          .where(
            and(
              eq(partnerFiles.partnerId, partner.id),
              inArray(
                partnerFiles.id,
                refs.map((f) => f.id),
              ),
            ),
          )
      : Promise.resolve([]),
    db.select().from(partnerBrands).where(eq(partnerBrands.partnerId, partner.id)),
    getCatalog(),
  ]);

  const status = partner.status;
  const editable = PARTNER_EDITABLE.includes(status);
  const reopened = status === "changes_requested" || status === "documents_required";
  const corrections = correctionsFor(partner.requiredCorrections, status);
  const site = catalog.content.site;
  const name = partner.tradeName || partner.legalName || app.business.tradeName || app.business.legalName || "Your dealership";
  const docTargets = approvals.filter((r) => r.a.target === "document" && r.a.targetId).map((r) => r.a.targetId!);
  const older = docTargets.length
    ? await db
        .select({ id: partnerFiles.id, filename: partnerFiles.filename })
        .from(partnerFiles)
        .where(and(eq(partnerFiles.partnerId, partner.id), inArray(partnerFiles.id, docTargets)))
    : [];
  const fileName = new Map([...older, ...files].map((f) => [f.id, f.filename]));
  const order = new Map(refs.map((f, i) => [f.id, i]));
  const docs = [...files].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  const lastUpdate = approvals[0]?.a.createdAt ?? partner.updatedAt;

  // When each stage was (last) reached on the way to the current one — walked backwards so the dates always read in order.
  const steps = approvals.filter((r) => r.a.target === "partner");
  const reached = (to: string, notAfter?: Date | null) => steps.find((r) => r.a.toStatus === to && (!notAfter || r.a.createdAt <= notAfter))?.a.createdAt ?? null;
  const pos = POSITION[status];
  const special = status === "documents_required" || status === "changes_requested" || status === "rejected" || status === "suspended" || status === "deactivated";
  const stageDates: (Date | null)[] = STAGES.map(() => null);
  for (let i = pos, bound: Date | null = null; i >= 0; i--) {
    const key = STAGES[i].key;
    const date: Date | null =
      key === "draft"
        ? partner.createdAt
        : i === pos
          ? special
            ? reached(status)
            : key === "approved"
              ? (partner.approvedAt ?? reached(key))
              : reached(key)
          : (reached(key, bound) ?? (key === "submitted" ? partner.submittedAt : null));
    stageDates[i] = date;
    if (date) bound = date;
  }
  const tone = PARTNER_STATUS_TONE[status];

  const continueHref = `/dealer/register/${status === "draft" ? furthestSlug(partner) : (corrections[0]?.slug ?? "review")}`;

  return (
    <>
      <PortalHeader
        title="Application status"
        description={
          <>
            Reference <span className="font-medium text-ink num">{partner.reference}</span>
            {partner.submittedAt ? <> · Submitted {formatDateTime(partner.submittedAt)}</> : <> · Not submitted yet</>}
          </>
        }
        actions={
          editable && ctx.can("profile.manage") ? (
            <Button href={continueHref} arrow>
              {status === "draft" ? "Continue application" : "Fix & resubmit"}
            </Button>
          ) : status === "approved" ? (
            <Button href="/dealer/dashboard" variant="dark" arrow>
              Go to dashboard
            </Button>
          ) : undefined
        }
      />

      {/* Status + progress */}
      <section className="animate-rise border border-line bg-white">
        <div className="grid gap-6 px-5 py-6 md:px-8 md:py-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="min-w-0">
            <Badge tone={tone}>{PARTNER_STATUS_LABEL[status]}</Badge>
            <h2 className="mt-4 font-display text-[24px] font-semibold leading-tight tracking-[-0.02em] md:text-[28px]">{HEADLINE[status].title}</h2>
            <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-muted">{HEADLINE[status].body}</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-[13px] sm:grid-cols-4 lg:grid-cols-2">
            <div>
              <dt className="text-muted">Dealership</dt>
              <dd className="mt-0.5 font-medium">{name}</dd>
            </div>
            <div>
              <dt className="text-muted">Reference</dt>
              <dd className="mt-0.5 font-medium num">{partner.reference}</dd>
            </div>
            <div>
              <dt className="text-muted">Submitted</dt>
              <dd className="mt-0.5 font-medium">{partner.submittedAt ? formatDay(partner.submittedAt) : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Last update</dt>
              <dd className="mt-0.5 font-medium">{formatDay(lastUpdate)}</dd>
            </div>
          </dl>
        </div>

        <ol className="grid border-t border-line md:grid-cols-5" aria-label="Application progress">
          {STAGES.map((s, i) => {
            // Approval is the last stage: it reads as complete, not as "in progress".
            const done = i < pos || (i === pos && status === "approved");
            const current = i === pos;
            const halted = current && special;
            const label = halted ? PARTNER_STATUS_LABEL[status] : s.label;
            const date = done || current ? stageDates[i] : null;
            const red = halted && (status === "rejected" || status === "suspended");
            const amber = halted && reopened;
            const grey = halted && status === "deactivated";
            return (
              <li key={s.key} aria-current={current ? "step" : undefined} className={cn("relative flex gap-3 border-line px-5 py-4 md:flex-col md:gap-2.5 md:px-6 md:py-5", i > 0 && "border-t md:border-l md:border-t-0", current && "bg-[#FAFAFA]")}>
                <span
                  className={cn(
                    "inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold transition-colors duration-700 num",
                    done && "border-ink bg-ink text-white",
                    current && !halted && !done && "border-red bg-white text-red shadow-[0_0_0_4px_rgba(227,30,36,0.08)]",
                    amber && "border-[#e3b04b] bg-[#fdf3e1] text-[#9a5b00]",
                    red && "border-red bg-red text-white",
                    grey && "border-ink/30 bg-mist text-muted",
                    !done && !current && "border-line bg-white text-muted",
                  )}
                >
                  {done ? <Check aria-hidden className="size-3.5" strokeWidth={3} /> : red ? <X aria-hidden className="size-3.5" strokeWidth={3} /> : amber ? <CircleAlert aria-hidden className="size-3.5" /> : grey ? <Ban aria-hidden className="size-3.5" /> : i + 1}
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

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {(partner.adminRemarks || corrections.length > 0) && (
            <section className={cn("border bg-white", reopened ? "border-[#f0d9a8]" : status === "rejected" || status === "suspended" ? "border-red/30" : "border-line")}>
              <header className="flex items-center gap-2 border-b border-line px-5 py-3.5">
                {status === "approved" ? <BadgeCheck aria-hidden className="size-4 text-[#1e7a3c]" /> : <CircleAlert aria-hidden className={cn("size-4", reopened ? "text-[#9a5b00]" : "text-red")} />}
                <h2 className="text-[14px] font-semibold">{reopened ? "What we need from you" : "Remarks from MarchGear"}</h2>
              </header>
              <div className="space-y-4 p-5">
                {partner.adminRemarks && <blockquote className="border-l-2 border-ink/20 pl-4 text-[14px] leading-relaxed whitespace-pre-line">{partner.adminRemarks}</blockquote>}
                {corrections.length > 0 && (
                  <ul className="divide-y divide-line border border-line">
                    {corrections.map((c, i) => (
                      <li key={i} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-[14px]">{c.text}</p>
                          <p className="mt-0.5 text-[12px] text-muted">{WIZARD_STEPS.find((s) => s.slug === c.slug)?.title}</p>
                        </div>
                        {editable && ctx.can("profile.manage") && (
                          <Link href={`/dealer/register/${c.slug}`} className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-[3px] bg-ink px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-ink-3 sm:self-auto">
                            Fix now <ArrowRight aria-hidden className="size-3.5" />
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
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
                  const label = targetLabel(a.target, a.action) ?? ACTION_LABEL[a.action] ?? (a.toStatus && a.toStatus in PARTNER_STATUS_LABEL ? PARTNER_STATUS_LABEL[a.toStatus as PartnerStatus] : humanise(a.action));
                  const who = a.actorSide === "admin" ? "MarchGear team" : a.actorSide === "system" ? "Automatic" : a.actorUserId === ctx.user.id ? "You" : (actor ?? "Your team");
                  const subject =
                    a.target === "document" && a.targetId
                      ? (fileName.get(a.targetId) ?? "Document")
                      : a.target === "brand"
                        ? (catalog.brandName(brandRows.find((b) => b.id === a.targetId)?.brand ?? "") || "Brand authorisation")
                        : a.target !== "partner"
                          ? humanise(a.target)
                          : null;
                  const dot = a.actorSide === "admin" ? (/reject|suspend/.test(a.action) ? "bg-red" : /approv|verif/.test(a.action) ? "bg-[#1e7a3c]" : "bg-[#c98a12]") : a.actorSide === "system" ? "bg-ink/30" : "bg-ink";
                  return (
                    <li key={a.id} className="relative flex gap-4 pb-6 last:pb-0">
                      {i < approvals.length - 1 && <span aria-hidden className="absolute left-[5px] top-4 h-[calc(100%-8px)] w-px bg-line" />}
                      <span aria-hidden className={cn("relative mt-1.5 size-[11px] shrink-0 rounded-full ring-4 ring-white", dot)} />
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-medium">
                          {label}
                          {subject && <span className="inline-flex h-5 items-center rounded-full bg-mist px-2 text-[11px] font-medium text-muted">{subject}</span>}
                        </p>
                        {a.remarks && a.remarks.trim().toLowerCase() !== label.toLowerCase() && <p className="mt-1 text-[13.5px] leading-relaxed text-ink/80 whitespace-pre-line">{a.remarks}</p>}
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

          <Panel title="Documents" padded={false} action={<span className="text-[12px] text-muted">{docs.length} uploaded</span>}>
            {docs.length === 0 ? (
              <p className="px-5 py-10 text-center text-[14px] text-muted">No documents uploaded yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {docs.map((f) => {
                  const brand = brandCerts.get(f.id);
                  const label = brand ? `Brand authorisation — ${catalog.brandName(brand)}` : (DOC_KIND_LABEL[f.kind as keyof typeof DOC_KIND_LABEL] ?? humanise(f.kind));
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
                        <Badge tone={FILE_STATUS_TONE[f.status]}>{FILE_STATUS_LABEL[f.status]}</Badge>
                        <a href={`/dealer/files/${f.id}`} target="_blank" rel="noreferrer" className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-mist hover:text-ink" aria-label={`Open ${label}`}>
                          <ExternalLink className="size-4" />
                        </a>
                        <a href={`/dealer/files/${f.id}?download=1`} className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-mist hover:text-ink" aria-label={`Download ${label}`}>
                          <Download className="size-4" />
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {brandRows.length > 0 && (
            <Panel title="Brand authorisations" padded={false}>
              <ul className="divide-y divide-line">
                {brandRows.map((b) => (
                  <li key={b.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium">{catalog.brandName(b.brand)}</p>
                      <p className="text-[12.5px] text-muted">
                        {b.models.length} {b.models.length === 1 ? "model" : "models"} · {b.variants.length} {b.variants.length === 1 ? "variant" : "variants"}
                        {b.validUntil ? ` · valid until ${formatDay(b.validUntil)}` : ""}
                      </p>
                      {b.remarks && <p className="mt-1 text-[13px] text-ink/80">{b.remarks}</p>}
                    </div>
                    <Badge tone={BRAND_STATUS_TONE[b.status]}>{BRAND_STATUS_LABEL[b.status]}</Badge>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <aside className="space-y-6">
          <Panel title="Your application">
            <dl className="space-y-3 text-[13.5px]">
              {[
                ["Legal name", app.business.legalName],
                ["Business type", app.business.businessType ? BUSINESS_TYPE_LABEL[app.business.businessType] : ""],
                ["GSTIN", app.business.gst],
                ["Showrooms", app.showrooms.length ? `${app.showrooms.length} · ${app.showrooms.find((s) => s.isPrimary)?.city || app.showrooms[0].city}` : ""],
                ["Brands", app.brands.items.map((i) => catalog.brandName(i.brand)).join(", ")],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="shrink-0 text-muted">{k}</dt>
                  <dd className="min-w-0 truncate text-right font-medium" title={v}>
                    {v || "—"}
                  </dd>
                </div>
              ))}
            </dl>
            {editable && ctx.can("profile.manage") && (
              <Link href={continueHref} className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink underline-offset-4 hover:text-red hover:underline">
                {status === "draft" ? "Continue where you left off" : "Edit your application"} <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            )}
          </Panel>

          <Panel title={status === "approved" ? "Unlocked for you" : "Unlocks after approval"}>
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
            {status !== "approved" && <p className="mt-4 border-t border-line pt-4 text-[12.5px] leading-relaxed text-muted">Until then, nothing from your dealership is published on MarchGear.</p>}
          </Panel>

          <Panel title="Partner support">
            <p className="text-[13.5px] leading-relaxed text-muted">Questions about your application or documents? Our partner team can help.</p>
            <ul className="mt-4 space-y-2.5 text-[13.5px]">
              <li>
                <a href={`tel:${site.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-2 font-medium hover:text-red">
                  <Phone aria-hidden className="size-4 text-muted" /> <span className="num">{site.phone}</span>
                </a>
              </li>
              <li>
                <a href={`mailto:${site.supportEmail}?subject=${encodeURIComponent(`Partner application ${partner.reference}`)}`} className="inline-flex items-center gap-2 font-medium hover:text-red">
                  <Mail aria-hidden className="size-4 text-muted" /> {site.supportEmail}
                </a>
              </li>
              <li className="inline-flex items-center gap-2 text-muted">
                <Clock3 aria-hidden className="size-4" /> {site.hours}
              </li>
            </ul>
            {ctx.can("support.use") && (
              <Button href="/dealer/support" variant="outline" size="sm" className="mt-5 w-full">
                Raise a support ticket
              </Button>
            )}
            <p className="mt-4 text-[12px] text-muted">
              Quote your reference <span className="font-medium text-ink num">{partner.reference}</span>.
            </p>
          </Panel>
        </aside>
      </div>
    </>
  );
}
