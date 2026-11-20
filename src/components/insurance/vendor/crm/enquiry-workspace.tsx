"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  BadgeCheck,
  BellRing,
  CircleDot,
  FilePlus2,
  FileText,
  Loader2,
  Mail,
  Megaphone,
  MessageCircle,
  NotebookPen,
  Phone,
  PhoneCall,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";
import { INS_LEAD_STATUS, type InsLeadEventKind } from "@/db/enums";
import { INDICATIVE_NOTE, INS_LEAD_STATUS_LABEL, INS_POLICY_STATUS_LABEL, INS_PRODUCT_CATEGORY_LABEL, INS_PRODUCT_STATUS_LABEL, INS_RENEWAL_STATUS_LABEL } from "@/insurance/labels";
import type { InsProductCategory, InsProductStatus } from "@/db/enums";
import { cn } from "@/lib/utils";
import {
  addEnquiryNoteAction,
  addEnquiryToRenewalsAction,
  assignEnquiryAction,
  logEnquiryContactAction,
  markPolicyIssuedAction,
  recordEnquiryContactLinkAction,
  setEnquiryFollowUpAction,
  updateEnquiryStatusAction,
} from "@/server/actions/ins-enquiries";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Modal } from "@/components/ui/overlay";
import { Input, Select, Textarea } from "@/components/portal/crm/controls";
import { useRun } from "@/components/portal/crm/use-run";
import { formatIstDateTime, toISTInput, whatsappHref } from "@/components/portal/crm/pipeline";
import { rupees } from "@/components/portal/billing/shared";
import { AuthBadge, EnquiryStatusBadge, ExpiryCell, FollowUp, Initials, IntentTag, QuoteStatusBadge, SourceTag, formatDayShort, leadFinished } from "./badges";
import { CALL_OUTCOMES, INS_LOST_REASONS, daysFrom, formatMobile, type EnquiryDetail, type MemberOption } from "./shared";

export interface EnquiryPermissions {
  manage: boolean;
  assign: boolean;
  quotes: boolean;
  renewals: boolean;
}

const EVENT_ICON: Record<InsLeadEventKind, LucideIcon> = {
  created: Sparkles,
  note: NotebookPen,
  call: PhoneCall,
  email: Mail,
  whatsapp: MessageCircle,
  status: CircleDot,
  assign: UserRoundCheck,
  reminder: BellRing,
  quote: FileText,
  policy: ShieldCheck,
  renewal: RefreshCw,
};

const sectionTitle = "text-[11px] font-semibold uppercase tracking-[0.12em] text-muted";

function Section({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("px-5 py-5 sm:px-6", className)}>
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <h3 className={sectionTitle}>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-[12px] text-muted">{k}</dt>
          <dd className="mt-0.5 break-words text-[14px] text-ink">{v === null || v === undefined || v === "" ? <span className="text-muted">—</span> : v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EnquiryWorkspace({ lead, members, can, now, today, vendorName }: { lead: EnquiryDetail; members: MemberOption[]; can: EnquiryPermissions; now: number; today: string; vendorName: string }) {
  const router = useRouter();
  const { run, busy } = useRun();
  const [policyOpen, setPolicyOpen] = useState(false);
  // Re-mount forms after each saved change so they start from the fresh server state.
  const version = `${lead.updatedAt}-${lead.events.length}`;
  const finished = leadFinished(lead.status);
  const hasPolicyRenewal = lead.renewals.some((r) => r.source === "policy");

  const logLink = (channel: "call" | "whatsapp" | "email") => {
    if (!can.manage) return;
    // Fire and forget: the link itself opens the dialler / WhatsApp / mail app.
    void recordEnquiryContactLinkAction({ id: lead.id, channel }).catch(() => null);
  };

  const addToRenewals = async () => {
    const res = await run("renewal", () => addEnquiryToRenewalsAction({ id: lead.id }), "Added to renewals");
    if (res) router.push(`/insurance-vendor/renewals?view=all&renewal=${res.renewalId}`);
  };

  const first = lead.name.split(" ")[0];

  return (
    <div className="border border-line bg-white">
      {/* Header */}
      <div className="border-b border-line px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-3.5">
            <Initials name={lead.name} className="size-11 text-[13px]" />
            <div className="min-w-0">
              <h2 className="truncate font-display text-[20px] font-semibold tracking-[-0.02em]">{lead.name}</h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted">
                <span className="font-mono tracking-wide text-ink/70">{lead.reference}</span>
                <span aria-hidden>·</span>
                <span className="num">Received {formatIstDateTime(lead.createdAt)}</span>
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <EnquiryStatusBadge status={lead.status} />
                <IntentTag intent={lead.intent} />
                <SourceTag source={lead.source} />
                {lead.followUpAt && <FollowUp at={lead.followUpAt} finished={finished} now={now} className="!flex-row !items-center !gap-2" />}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap xl:justify-end">
            <Button href={`tel:+91${lead.mobile}`} onClick={() => logLink("call")} variant="outline" size="sm" icon={<Phone className="size-4" aria-hidden />}>
              Call
            </Button>
            <Button
              href={whatsappHref(lead.mobile, `Hello ${first}, this is ${vendorName} about your car insurance enquiry ${lead.reference} on MarchGear.`)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => logLink("whatsapp")}
              variant="outline"
              size="sm"
              icon={<MessageCircle className="size-4" aria-hidden />}
            >
              WhatsApp
            </Button>
            {lead.email ? (
              <Button href={`mailto:${lead.email}?subject=${encodeURIComponent(`Your car insurance enquiry ${lead.reference}`)}`} onClick={() => logLink("email")} variant="outline" size="sm" icon={<Mail className="size-4" aria-hidden />}>
                Email
              </Button>
            ) : (
              <span title="The customer didn't share an email address" className="inline-flex h-9 items-center justify-center gap-2 rounded-[3px] border border-dashed border-line px-3.5 text-[13px] font-medium text-muted">
                <Mail className="size-4" aria-hidden /> No email
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:flex-wrap">
          {can.quotes && lead.status !== "policy_issued" && lead.status !== "closed" && (
            <Button href={`/insurance-vendor/quotes/new?enquiry=${lead.id}`} variant="dark" size="sm" icon={<FilePlus2 className="size-4" aria-hidden />}>
              Create quote
            </Button>
          )}
          {can.manage && !lead.conversionVerifiedAt && (
            <Button variant={lead.status === "policy_issued" ? "outline" : "primary"} size="sm" onClick={() => setPolicyOpen(true)} icon={<ShieldCheck className="size-4" aria-hidden />}>
              {lead.status === "policy_issued" ? "Edit reported policy" : "Mark policy issued"}
            </Button>
          )}
          {can.renewals && lead.status === "policy_issued" && !hasPolicyRenewal && (
            <Button variant="outline" size="sm" disabled={busy !== null} onClick={addToRenewals} icon={busy === "renewal" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}>
              Add to renewals
            </Button>
          )}
          <p className="text-[12px] leading-relaxed text-muted sm:ml-auto sm:max-w-[360px] sm:self-center sm:text-right">
            Calls and messages go from your own phone, WhatsApp or mailbox — using a link here records it on the timeline.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:divide-x lg:divide-line">
        <div className="divide-y divide-line">
          <Section title="Customer">
            <Facts
              rows={[
                ["Mobile", <a key="m" href={`tel:+91${lead.mobile}`} onClick={() => logLink("call")} className="num underline-offset-4 hover:underline">+91 {formatMobile(lead.mobile)}</a>],
                ["Email", lead.email ? <a key="e" href={`mailto:${lead.email}`} onClick={() => logLink("email")} className="break-all underline-offset-4 hover:underline">{lead.email}</a> : null],
                ["City", [lead.city, lead.state].filter(Boolean).join(", ")],
                ["MarchGear account", lead.userId ? "Signed in when they asked" : "Guest — not signed in"],
                ["Consent to be contacted", formatIstDateTime(lead.consentAt)],
                ["Assigned to", lead.assigned?.name ?? "Unassigned"],
              ]}
            />
            {lead.message && <p className="mt-5 whitespace-pre-line border-l-2 border-line pl-4 text-[13.5px] leading-relaxed text-ink/80">“{lead.message}”</p>}
          </Section>

          <Section title="Vehicle">
            <Facts
              rows={[
                ["Registration", lead.regNumber ? <span key="r" className="font-mono font-semibold tracking-wide">{lead.regNumber}</span> : lead.vehicleIsNew ? "New car — not registered yet" : null],
                ["Brand", lead.brandName],
                ["Model", lead.modelName],
                ["Variant", lead.variantName],
                ["Year", lead.vehicleIsNew ? "New" : lead.year],
                ["Fuel", lead.fuel],
              ]}
            />
          </Section>

          <Section title="Current policy">
            <Facts
              rows={[
                ["Policy status", lead.policyStatus ? INS_POLICY_STATUS_LABEL[lead.policyStatus] : null],
                ["Expiry", lead.policyExpiry ? <ExpiryCell key="x" date={lead.policyExpiry} days={daysFrom(today, lead.policyExpiry)} /> : null],
                ["Current insurer", lead.previousInsurer],
                ["No-claim bonus", `${lead.ncbPct}%`],
                ["Claimed last year", lead.claimedLastYear ? "Yes" : "No"],
              ]}
            />
          </Section>

          <Section title="Selected product">
            {lead.productDetail ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold">{lead.productDetail.name}</p>
                    <p className="mt-0.5 text-[12.5px] text-muted">
                      {INS_PRODUCT_CATEGORY_LABEL[lead.productDetail.category as InsProductCategory] ?? lead.productDetail.category} · <span className="font-mono">{lead.productDetail.code}</span>
                      {lead.productDetail.companyName ? ` · ${lead.productDetail.companyName}` : ""}
                    </p>
                  </div>
                  <span className="text-[12px] text-muted">{INS_PRODUCT_STATUS_LABEL[lead.productDetail.status as InsProductStatus] ?? lead.productDetail.status}</span>
                </div>
                {lead.productDetail.status === "published" && (
                  <Link href={`/insurance/products/${lead.productDetail.reference}`} target="_blank" className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-ink/70 hover:text-ink">
                    View the public product page <ArrowUpRight aria-hidden className="size-3.5" />
                  </Link>
                )}
              </>
            ) : (
              <p className="text-[13.5px] text-muted">No product was selected — the customer asked {lead.source === "renewal_desk" ? "your renewal desk" : "you"} generally.</p>
            )}
            {lead.addOns.length > 0 && (
              <div className="mt-4">
                <p className="text-[12px] text-muted">Add-ons the customer ticked</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {lead.addOns.map((a) => (
                    <span key={a} className="inline-flex h-6 items-center rounded-[3px] bg-mist px-2 text-[12px]">
                      {(lead.estimate?.addOns.find((x) => x.key === a)?.name ?? a).replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {(lead.campaign || lead.adCampaign) && (
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[12.5px]">
                {lead.campaign && (
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles aria-hidden className="size-3.5 text-red" /> Campaign: <span className="font-medium">{lead.campaign.title}</span> <span className="font-mono text-muted">{lead.campaign.reference}</span>
                  </span>
                )}
                {lead.adCampaign && (
                  <span className="inline-flex items-center gap-1.5">
                    <Megaphone aria-hidden className="size-3.5 text-red" /> Ad: <span className="font-medium">{lead.adCampaign.name}</span> <span className="font-mono text-muted">{lead.adCampaign.reference}</span>
                  </span>
                )}
              </div>
            )}
          </Section>

          <EstimateSnapshot lead={lead} />

          {can.manage && <PipelineCard key={`p-${version}`} lead={lead} members={members} canAssign={can.assign} now={now} />}

          <PolicyCard lead={lead} canEdit={can.manage} onEdit={() => setPolicyOpen(true)} />

          <Section
            title={`Quotes · ${lead.quotes.length}`}
            action={
              can.quotes && lead.status !== "policy_issued" && lead.status !== "closed" ? (
                <Link href={`/insurance-vendor/quotes/new?enquiry=${lead.id}`} className="text-[12.5px] font-medium text-ink hover:text-red">
                  + New quote
                </Link>
              ) : undefined
            }
          >
            {lead.quotes.length ? (
              <ul className="divide-y divide-line border border-line">
                {lead.quotes.map((q) => (
                  <li key={q.id}>
                    <Link href={`/insurance-vendor/quotes/${q.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-mist/60">
                      <span className="min-w-0">
                        <span className="block font-mono text-[12.5px] font-semibold">{q.reference}</span>
                        <span className="mt-0.5 block truncate text-[12px] text-muted">
                          {q.productName ?? "Product removed"} · valid until {formatDayShort(q.validUntil)}
                        </span>
                      </span>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[13.5px] font-semibold num">{rupees(q.total)}</span>
                        <AuthBadge auth={q.authorization} />
                        <QuoteStatusBadge status={q.display} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13.5px] text-muted">{can.quotes ? "No quotes yet. Build one from the customer's vehicle and your product." : "No quotes yet."}</p>
            )}
          </Section>

          {lead.renewals.length > 0 && (
            <Section title="Renewals">
              <ul className="divide-y divide-line border border-line">
                {lead.renewals.map((r) => (
                  <li key={r.id}>
                    <Link href={`/insurance-vendor/renewals?view=all&q=${encodeURIComponent(r.reference)}&renewal=${r.id}`} className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-mist/60">
                      <span className="min-w-0">
                        <span className="block font-mono text-[12.5px] font-semibold">{r.reference}</span>
                        <span className="mt-0.5 block text-[12px] text-muted">Expires {formatDayShort(r.expiryDate)}</span>
                      </span>
                      <span className="text-[12.5px] font-medium">{INS_RENEWAL_STATUS_LABEL[r.status]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        <div className="divide-y divide-line border-t border-line lg:border-t-0">
          {can.manage && <Composer key={`m-${version}`} id={lead.id} />}
          <Section title={`Activity · ${lead.events.length}`}>
            <Timeline lead={lead} />
          </Section>
          <History lead={lead} />
        </div>
      </div>

      <PolicyModal key={`pol-${version}`} open={policyOpen} onClose={() => setPolicyOpen(false)} lead={lead} today={today} />
    </div>
  );
}

/* ── The estimate the customer saw ────────────────────────── */

function EstimateSnapshot({ lead }: { lead: EnquiryDetail }) {
  const e = lead.estimate;
  return (
    <Section title="Estimate the customer saw">
      {e ? (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-[12.5px] font-medium text-[#9a5b00]">Indicative premium</p>
            <p className="font-display text-[26px] font-semibold leading-none tracking-[-0.02em] num">{rupees(e.total)}</p>
          </div>
          <dl className="mt-4 divide-y divide-line border-y border-line text-[13px]">
            {(
              [
                e.odYears > 0 ? [`IDV (range ${rupees(e.idvMin)} – ${rupees(e.idvMax)})`, rupees(e.idv)] : null,
                e.odYears > 0 ? [`Own damage · ${e.odYears} yr`, rupees(e.od)] : null,
                e.ncbDiscount ? [`No-claim bonus (${e.ncbPct}%)`, `− ${rupees(e.ncbDiscount)}`] : null,
                e.tpYears > 0 ? [`Third party · ${e.tpYears} yr`, rupees(e.tp)] : null,
                e.pa ? ["Personal accident (owner-driver)", rupees(e.pa)] : null,
                ...e.addOns.map((a) => [`${a.name}${a.included ? " (included)" : ""}`, a.included && !a.premium ? "Included" : rupees(a.premium)]),
                ["Net premium", rupees(e.net)],
                [`GST ${e.gstPct}%`, rupees(e.gst)],
              ].filter(Boolean) as [string, string][]
            ).map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-4 py-2">
                <dt className="min-w-0 text-ink/75">{k}</dt>
                <dd className="shrink-0 font-medium num">{v}</dd>
              </div>
            ))}
          </dl>
          {e.notes.length > 0 && (
            <ul className="mt-3 space-y-1 text-[12px] text-muted">
              {e.notes.map((n) => (
                <li key={n}>· {n}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[12px] leading-relaxed text-muted">{INDICATIVE_NOTE}</p>
        </>
      ) : (
        <p className="text-[13.5px] text-muted">{lead.indicativePremium ? `The customer saw an indicative premium of ${rupees(lead.indicativePremium)}.` : "No estimate was shown for this enquiry."}</p>
      )}
    </Section>
  );
}

/* ── Status, assignment, reminder ─────────────────────────── */

function PipelineCard({ lead, members, canAssign, now }: { lead: EnquiryDetail; members: MemberOption[]; canAssign: boolean; now: number }) {
  const { run, busy, errors } = useRun();
  const [status, setStatus] = useState(lead.status);
  const knownReason = INS_LOST_REASONS.includes((lead.lostReason ?? "") as (typeof INS_LOST_REASONS)[number]);
  const [reason, setReason] = useState(lead.lostReason ? (knownReason ? lead.lostReason : "Other") : "");
  const [otherReason, setOtherReason] = useState(lead.lostReason && !knownReason ? lead.lostReason : "");
  const [member, setMember] = useState(lead.assigned ? String(lead.assigned.id) : "");
  const [at, setAt] = useState(lead.followUpAt && new Date(lead.followUpAt).getTime() > now ? toISTInput(lead.followUpAt) : "");
  const [note, setNote] = useState("");
  const finished = leadFinished(lead.status);
  const locked = Boolean(lead.conversionVerifiedAt);

  const lostReason = reason === "Other" ? otherReason : reason;
  const saveStatus = () => run("status", () => updateEnquiryStatusAction({ id: lead.id, status, lostReason: status === "lost" ? lostReason : undefined }), `Status: ${INS_LEAD_STATUS_LABEL[status]}`);
  const saveAssign = () => run("assign", () => assignEnquiryAction({ id: lead.id, memberId: member ? Number(member) : null }), member ? "Enquiry assigned" : "Enquiry unassigned");
  const saveReminder = () => run("reminder", () => setEnquiryFollowUpAction({ id: lead.id, at, note: note || undefined }), "Reminder set");
  const clearReminder = () => run("clear", () => setEnquiryFollowUpAction({ id: lead.id, at: "" }), "Reminder cleared");

  return (
    <Section title="Pipeline">
      <div className="space-y-5">
        <div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Select
              label="Status"
              className="flex-1"
              value={status}
              disabled={locked}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              options={INS_LEAD_STATUS.map((s) => ({ value: s, label: s === "policy_issued" && lead.status !== "policy_issued" ? `${INS_LEAD_STATUS_LABEL[s]} (use “Mark policy issued”)` : INS_LEAD_STATUS_LABEL[s], disabled: s === "policy_issued" && lead.status !== "policy_issued" }))}
              error={errors.status}
            />
            <Button
              variant="dark"
              size="sm"
              className="h-10"
              disabled={locked || busy !== null || (status === lead.status && (status !== "lost" || lostReason === lead.lostReason))}
              onClick={saveStatus}
              icon={busy === "status" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}
            >
              Update status
            </Button>
          </div>
          {(locked || lead.status === "policy_issued") && (
            <p className="mt-1.5 text-[12px] text-muted">{locked ? "Locked — MarchGear has verified this conversion." : "Changing the status withdraws the reported policy."}</p>
          )}
          {status === "lost" && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select label="Lost reason" value={reason} onChange={(e) => setReason(e.target.value)} options={INS_LOST_REASONS.map((r) => ({ value: r, label: r }))} placeholder="Choose a reason" error={reason !== "Other" ? errors.lostReason : undefined} />
              {reason === "Other" && <Input label="Describe it" value={otherReason} onChange={(e) => setOtherReason(e.target.value)} maxLength={200} error={errors.lostReason} />}
            </div>
          )}
        </div>

        {canAssign ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Select
              label="Assigned to"
              className="flex-1"
              value={member}
              onChange={(e) => setMember(e.target.value)}
              options={members.map((m) => ({ value: String(m.id), label: `${m.name} · ${m.roleLabel}` }))}
              placeholder="Unassigned"
              error={errors.memberId}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-10"
              disabled={busy !== null || member === (lead.assigned ? String(lead.assigned.id) : "")}
              onClick={saveAssign}
              icon={busy === "assign" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}
            >
              Assign
            </Button>
          </div>
        ) : (
          <p className="text-[13px] text-muted">Assigned to {lead.assigned?.name ?? "nobody yet"}.</p>
        )}

        <div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Input label="Follow-up reminder (IST)" type="datetime-local" className="flex-1" min={toISTInput(new Date(now))} value={at} onChange={(e) => setAt(e.target.value)} error={errors.at} disabled={finished} />
            <Button variant="outline" size="sm" className="h-10" disabled={busy !== null || !at || finished} onClick={saveReminder} icon={busy === "reminder" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <BellRing className="size-4" aria-hidden />}>
              {lead.followUpAt ? "Update" : "Set reminder"}
            </Button>
          </div>
          {at && !finished && <Input aria-label="What to follow up on" placeholder="What to follow up on (optional)" className="mt-2" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />}
          {lead.followUpAt && (
            <div className="mt-3 flex items-center justify-between gap-3 border border-line px-3.5 py-2.5">
              <FollowUp at={lead.followUpAt} finished={finished} now={now} />
              <button type="button" disabled={busy !== null} onClick={clearReminder} className="text-[12.5px] font-medium text-muted hover:text-red disabled:opacity-50">
                Clear
              </button>
            </div>
          )}
          {finished && <p className="mt-2 text-[12px] text-muted">Reminders are off for {INS_LEAD_STATUS_LABEL[lead.status].toLowerCase()} enquiries.</p>}
        </div>
      </div>
    </Section>
  );
}

/* ── Reported policy ──────────────────────────────────────── */

function PolicyCard({ lead, canEdit, onEdit }: { lead: EnquiryDetail; canEdit: boolean; onEdit: () => void }) {
  if (lead.status !== "policy_issued" || !lead.policyNumber) return null;
  return (
    <Section
      title="Policy issued"
      action={
        canEdit && !lead.conversionVerifiedAt ? (
          <button type="button" onClick={onEdit} className="text-[12.5px] font-medium text-ink hover:text-red">
            Edit
          </button>
        ) : undefined
      }
    >
      <Facts
        rows={[
          ["Policy number", <span key="p" className="font-mono">{lead.policyNumber}</span>],
          ["Premium", lead.policyPremium ? rupees(lead.policyPremium) : null],
          ["Issued on", lead.policyIssuedAt ? formatIstDateTime(lead.policyIssuedAt).split(",")[0] : null],
          [
            "Verification",
            lead.conversionVerifiedAt ? (
              <span key="v" className="inline-flex items-center gap-1.5 font-medium text-[#1e7a3c]">
                <BadgeCheck aria-hidden className="size-4" /> Verified by MarchGear · {formatIstDateTime(lead.conversionVerifiedAt).split(",")[0]}
              </span>
            ) : (
              <span key="v" className="text-[#9a5b00]">Reported by your team — awaiting MarchGear verification</span>
            ),
          ],
        ]}
      />
      <p className="mt-3 text-[12px] text-muted">MarchGear verifies conversions. Until then this policy counts as reported, not verified, on your dashboards.</p>
    </Section>
  );
}

function PolicyModal({ open, onClose, lead, today }: { open: boolean; onClose: () => void; lead: EnquiryDetail; today: string }) {
  const { run, busy, errors } = useRun();
  const [policyNumber, setPolicyNumber] = useState(lead.policyNumber ?? "");
  const [premium, setPremium] = useState(lead.policyPremium ? String(lead.policyPremium) : "");
  const [issuedOn, setIssuedOn] = useState(lead.policyIssuedAt ? new Date(new Date(lead.policyIssuedAt).getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10) : today);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await run("policy", () => markPolicyIssuedAction({ id: lead.id, policyNumber, premium, issuedOn }), lead.status === "policy_issued" ? "Reported policy updated" : "Policy marked as issued");
    if (res) onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={lead.status === "policy_issued" ? "Edit the reported policy" : "Mark policy issued"} description="Record the policy the customer bought through you." size="sm">
      <form onSubmit={submit} noValidate className="space-y-4 px-6 py-6 sm:px-8">
        <Input label="Policy number" value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} maxLength={60} error={errors.policyNumber} data-autofocus autoComplete="off" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Total premium (₹, incl. GST)" inputMode="numeric" value={premium} onChange={(e) => setPremium(e.target.value.replace(/[^\d]/g, ""))} error={errors.premium} />
          <Input label="Issue date" type="date" max={today} value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} error={errors.issuedOn} />
        </div>
        <div className="border-l-[3px] border-[#d68a00] bg-[#fdf3e1] px-4 py-3 text-[12.5px] leading-relaxed text-[#6b4000]">
          This is reported by you. <strong className="font-semibold">MarchGear verifies conversions</strong> against your evidence before they count as verified{lead.renewals.length ? "" : " — you can then add the policy to your renewals"}.
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="dark" size="sm" disabled={busy !== null} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ShieldCheck className="size-4" aria-hidden />}>
            {lead.status === "policy_issued" ? "Save" : "Mark policy issued"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ── Notes and contact log ────────────────────────────────── */

function Composer({ id }: { id: number }) {
  const [tab, setTab] = useState<"note" | "call" | "message">("note");
  const { run, busy, errors } = useRun();
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState<keyof typeof CALL_OUTCOMES | "">("");
  const [duration, setDuration] = useState("");
  const [callNotes, setCallNotes] = useState("");
  const [channel, setChannel] = useState<"whatsapp" | "email">("whatsapp");
  const [message, setMessage] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === "note") {
      if (await run("note", () => addEnquiryNoteAction({ id, body: note }), "Note added")) setNote("");
    } else if (tab === "call") {
      if (await run("call", () => logEnquiryContactAction({ id, channel: "call", outcome: outcome || undefined, durationMin: duration || undefined, notes: callNotes || undefined }), "Call logged")) {
        setOutcome("");
        setDuration("");
        setCallNotes("");
      }
    } else if (await run("message", () => logEnquiryContactAction({ id, channel, notes: message }), `${channel === "whatsapp" ? "WhatsApp" : "Email"} logged`)) setMessage("");
  };

  return (
    <Section title="Add to the timeline">
      <Tabs
        size="sm"
        ariaLabel="What to add"
        value={tab}
        onChange={(v) => setTab(v as typeof tab)}
        items={[
          { value: "note", label: "Internal note" },
          { value: "call", label: "Log a call" },
          { value: "message", label: "WhatsApp / email" },
        ]}
      />
      <form onSubmit={submit} noValidate className="mt-4 space-y-3">
        {tab === "note" && <Textarea aria-label="Internal note" placeholder="Only your team sees notes — never the customer." value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} error={errors.body} />}
        {tab === "call" && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_130px]">
              <Select label="Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)} options={Object.entries(CALL_OUTCOMES).map(([value, label]) => ({ value, label }))} placeholder="How did it go?" error={errors.outcome} />
              <Input label="Duration (min)" type="number" min={0} max={600} inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} error={errors.durationMin} />
            </div>
            <Textarea aria-label="Call notes" placeholder="What was discussed (optional)" value={callNotes} onChange={(e) => setCallNotes(e.target.value)} maxLength={2000} error={errors.notes} />
            <p className="text-[12px] text-muted">A record of a call you made from your phone — the portal doesn&apos;t place or record calls.</p>
          </>
        )}
        {tab === "message" && (
          <>
            <Select
              label="Channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value as typeof channel)}
              options={[
                { value: "whatsapp", label: "WhatsApp" },
                { value: "email", label: "Email" },
              ]}
            />
            <Textarea aria-label="Conversation summary" placeholder="Summarise what you sent or what they replied" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} error={errors.notes} />
            <p className="text-[12px] text-muted">Messages go from your own WhatsApp or mailbox — MarchGear doesn&apos;t send them. Log them here to keep the history in one place.</p>
          </>
        )}
        <div className="flex justify-end">
          <Button type="submit" variant="dark" size="sm" disabled={busy !== null} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
            {tab === "note" ? "Add note" : tab === "call" ? "Log call" : "Log message"}
          </Button>
        </div>
      </form>
    </Section>
  );
}

/* ── Timeline ─────────────────────────────────────────────── */

function Timeline({ lead }: { lead: EnquiryDetail }) {
  if (!lead.events.length) return <p className="text-[13.5px] text-muted">No activity yet.</p>;
  return (
    <ol className="relative space-y-5 before:absolute before:inset-y-1 before:left-[15px] before:w-px before:bg-line">
      {lead.events.map((e) => {
        const Icon = EVENT_ICON[e.kind] ?? CircleDot;
        const [head, ...rest] = (e.body || "Updated").split("\n");
        const strong = e.kind === "status" || e.kind === "created" || e.kind === "policy" || e.kind === "quote";
        return (
          <li key={e.id} className="relative flex gap-3.5">
            <span className={cn("relative z-10 inline-flex size-[31px] shrink-0 items-center justify-center rounded-full border bg-white", strong ? "border-ink/20 text-ink" : "border-line text-muted", e.kind === "policy" && "border-[#1e7a3c]/30 text-[#1e7a3c]")}>
              <Icon aria-hidden className="size-[15px]" />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p className="break-words text-[13.5px] font-medium leading-snug text-ink">{head}</p>
              {rest.length > 0 && <p className="mt-1 whitespace-pre-line break-words text-[13px] leading-relaxed text-ink/70">{rest.join("\n")}</p>}
              <p className="mt-1 text-[11.5px] text-muted num">
                {e.author ?? "MarchGear"} · {formatIstDateTime(e.createdAt)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ── Customer history ─────────────────────────────────────── */

function History({ lead }: { lead: EnquiryDetail }) {
  const { enquiries, quotes } = lead.history;
  return (
    <Section title="Customer history">
      {enquiries.length === 0 ? (
        <p className="text-[13.5px] text-muted">This is the first enquiry from +91 {formatMobile(lead.mobile)} with your company.</p>
      ) : (
        <>
          <p className="mb-3 text-[12.5px] text-muted">
            {enquiries.length} other enquir{enquiries.length === 1 ? "y" : "ies"} and {quotes.length} quote{quotes.length === 1 ? "" : "s"} from this mobile number.
          </p>
          <ul className="divide-y divide-line border border-line">
            {enquiries.map((h) => {
              const q = quotes.filter((x) => x.enquiryId === h.id);
              return (
                <li key={h.id} className="px-4 py-3">
                  <Link href={`/insurance-vendor/enquiries/${h.id}`} className="flex items-start justify-between gap-3 hover:text-red">
                    <span className="min-w-0">
                      <span className="block font-mono text-[12.5px] font-semibold">{h.reference}</span>
                      <span className="mt-0.5 block truncate text-[12px] text-muted">
                        {h.product?.name ?? "No product"} · {formatIstDateTime(h.createdAt).split(",")[0]}
                      </span>
                    </span>
                    <EnquiryStatusBadge status={h.status} />
                  </Link>
                  {q.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {q.map((x) => (
                        <li key={x.id}>
                          <Link href={`/insurance-vendor/quotes/${x.id}`} className="flex items-center justify-between gap-3 text-[12px] text-ink/75 hover:text-ink">
                            <span className="font-mono">{x.reference}</span>
                            <span className="num">
                              {rupees(x.total)} · {x.display === "submitted" ? "sent" : x.display}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Section>
  );
}
