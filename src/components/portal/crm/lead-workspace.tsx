"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BellRing,
  CalendarClock,
  CarFront,
  CircleDot,
  Globe,
  Loader2,
  Mail,
  MessageCircle,
  NotebookPen,
  Pencil,
  Phone,
  PhoneCall,
  Sparkles,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";
import { CRM_STATUS, type LeadEventKind } from "@/db/enums";
import { CRM_STATUS_LABEL, LEAD_SOURCE_LABEL } from "@/partner/labels";
import { LEAD_TYPE_LABEL } from "@/lib/leads";
import { cn } from "@/lib/utils";
import {
  addLeadNoteAction,
  assignLeadAction,
  logLeadContactAction,
  setFollowUpAction,
  updateLeadDetailsAction,
  updateLeadStatusAction,
} from "@/server/actions/partner-crm";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { FollowUp, Initials, LeadStatusBadge, SourceTag, TestDriveBadge } from "./badges";
import { Input, Select, Textarea } from "./controls";
import { CALL_OUTCOMES, CRM_FINISHED, LOST_REASONS, formatIstDateTime, formatWhen, toISTInput, whatsappHref } from "./pipeline";
import type { LeadDetail, MemberOption } from "./types";
import { useRun } from "./use-run";
import { TestDriveFormModal, type TestDriveOptions } from "@/components/portal/test-drives/schedule-form";

export interface LeadPermissions {
  manage: boolean;
  assign: boolean;
  testDrives: boolean;
}

const EVENT_ICON: Record<LeadEventKind, LucideIcon> = {
  created: Sparkles,
  note: NotebookPen,
  call: PhoneCall,
  status: CircleDot,
  assign: UserRoundCheck,
  reminder: BellRing,
  email: Mail,
  whatsapp: MessageCircle,
  test_drive: CalendarClock,
};

const sectionTitle = "text-[11px] font-semibold uppercase tracking-[0.12em] text-muted";

export function LeadWorkspace({
  lead,
  members,
  can,
  tdOptions,
  now,
  layout = "drawer",
}: {
  lead: LeadDetail;
  members: MemberOption[];
  can: LeadPermissions;
  tdOptions: TestDriveOptions | null;
  now: number;
  layout?: "drawer" | "page";
}) {
  const [scheduling, setScheduling] = useState(false);
  // Re-mount forms after each saved change so they start from the fresh server state.
  const version = `${lead.updatedAt}-${lead.events.length}`;

  const header = (
    <div className="border-b border-line px-5 py-5 sm:px-6">
      <div className="flex items-start gap-3.5">
        <Initials name={lead.name} className="size-11 text-[13px]" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-[20px] font-semibold tracking-[-0.02em]">{lead.name}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted">
            <span className="font-mono tracking-wide text-ink/70">{lead.reference}</span>
            <span aria-hidden>·</span>
            <span className="num">Received {formatIstDateTime(lead.createdAt)}</span>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <LeadStatusBadge status={lead.status} />
            <SourceTag source={lead.source} />
            {lead.followUpAt && <FollowUp at={lead.followUpAt} status={lead.status} now={now} className="!flex-row !items-center !gap-2" />}
          </div>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {lead.mobile && (
          <>
            <Button href={`tel:+91${lead.mobile}`} variant="outline" size="sm" icon={<Phone className="size-4" aria-hidden />}>
              Call
            </Button>
            <Button href={whatsappHref(lead.mobile, `Hello ${lead.name.split(" ")[0]}, `)} target="_blank" rel="noopener noreferrer" variant="outline" size="sm" icon={<MessageCircle className="size-4" aria-hidden />}>
              WhatsApp
            </Button>
          </>
        )}
        {lead.email && (
          <Button href={`mailto:${lead.email}?subject=${encodeURIComponent(`Your enquiry ${lead.reference}`)}`} variant="outline" size="sm" icon={<Mail className="size-4" aria-hidden />}>
            Email
          </Button>
        )}
        {can.testDrives && tdOptions && lead.mobile && !CRM_FINISHED.includes(lead.status) && (
          <Button variant="dark" size="sm" onClick={() => setScheduling(true)} icon={<CalendarClock className="size-4" aria-hidden />} className="col-span-2 sm:col-span-1">
            Schedule test drive
          </Button>
        )}
        {layout === "drawer" && (
          <Button href={`/dealer/enquiries/${lead.id}`} variant="ghost" size="sm" icon={<ArrowUpRight className="size-4" aria-hidden />} className="col-span-2 sm:col-span-1 sm:ml-auto">
            Full page
          </Button>
        )}
      </div>
    </div>
  );

  const work = (
    <>
      <CustomerCard key={`c-${version}`} lead={lead} canEdit={can.manage} />
      {can.manage && <PipelineCard key={`p-${version}`} lead={lead} members={members} canAssign={can.assign} now={now} />}
      {!can.manage && lead.assigned && (
        <Section title="Assigned to">
          <p className="text-[14px]">{lead.assigned.name}</p>
        </Section>
      )}
      {can.manage && <Composer key={`m-${version}`} lead={lead} />}
      {lead.testDrives.length > 0 && (
        <Section title="Test drives">
          <ul className="divide-y divide-line border border-line">
            {lead.testDrives.map((t) => (
              <li key={t.id}>
                <Link href={`/dealer/test-drives?td=${t.id}`} className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-mist/60">
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-medium">{t.carLabel}</span>
                    <span className="mt-0.5 block text-[12px] text-muted num">
                      {t.reference} · {t.scheduledAt ? formatWhen(t.scheduledAt, { weekday: true }) : t.requestedFor ? `Requested for ${formatWhen(t.requestedFor)}` : "Time to be confirmed"}
                    </span>
                  </span>
                  <TestDriveBadge status={t.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );

  const timeline = (
    <Section title={`Activity · ${lead.events.length}`}>
      <Timeline lead={lead} />
    </Section>
  );

  return (
    <div className={cn(layout === "page" && "border border-line bg-white")}>
      {header}
      {layout === "page" ? (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:divide-x lg:divide-line">
          <div className="divide-y divide-line">{work}</div>
          <div>{timeline}</div>
        </div>
      ) : (
        <div className="divide-y divide-line">
          {work}
          {timeline}
        </div>
      )}
      {tdOptions && (
        <TestDriveFormModal
          open={scheduling}
          onClose={() => setScheduling(false)}
          options={tdOptions}
          mode={{ kind: "create", lead: { id: lead.id, name: lead.name, mobile: lead.mobile, email: lead.email, carSlug: lead.carSlug, variant: lead.variant, vehicleId: lead.vehicle?.id ?? null } }}
        />
      )}
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="px-5 py-5 sm:px-6">
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <h3 className={sectionTitle}>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/* ── Customer ─────────────────────────────────────────────── */

function CustomerCard({ lead, canEdit }: { lead: LeadDetail; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const { run, busy, errors } = useRun();
  const [form, setForm] = useState({
    name: lead.name,
    mobile: lead.mobile ?? "",
    email: lead.email ?? "",
    carLabel: lead.carLabel ?? "",
    variant: lead.variant ?? "",
    budget: lead.budget ?? "",
    location: lead.location ?? "",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await run("save", () => updateLeadDetailsAction({ id: lead.id, ...form }), "Customer details saved");
    if (res) setEditing(false);
  };

  if (editing)
    return (
      <Section title="Customer">
        <form onSubmit={save} noValidate className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Input label="Name" value={form.name} onChange={set("name")} error={errors.name} className="sm:col-span-2" />
          <Input label="Mobile" inputMode="tel" value={form.mobile} onChange={set("mobile")} error={errors.mobile} />
          <Input label="Email" type="email" value={form.email} onChange={set("email")} error={errors.email} />
          <Input label="Interested in" value={form.carLabel} onChange={set("carLabel")} error={errors.carLabel} />
          <Input label="Variant" value={form.variant} onChange={set("variant")} error={errors.variant} />
          <Input label="Budget" value={form.budget} onChange={set("budget")} error={errors.budget} placeholder="e.g. ₹12–15 lakh" />
          <Input label="Preferred location" value={form.location} onChange={set("location")} error={errors.location} />
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="dark" size="sm" disabled={busy !== null} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
              Save details
            </Button>
          </div>
        </form>
      </Section>
    );

  const rows: [string, ReactNode][] = [
    ["Mobile", lead.mobile ? <a href={`tel:+91${lead.mobile}`} className="num underline-offset-4 hover:underline">+91 {lead.mobile.replace(/(\d{5})(\d{5})/, "$1 $2")}</a> : null],
    ["Email", lead.email ? <a href={`mailto:${lead.email}`} className="break-all underline-offset-4 hover:underline">{lead.email}</a> : null],
    [
      "Interested in",
      lead.carLabel ? (
        <span>
          {lead.carLabel}
          {lead.variant && !lead.carLabel.endsWith(lead.variant) ? <span className="text-muted"> · {lead.variant}</span> : null}
        </span>
      ) : null,
    ],
    [
      "Vehicle",
      lead.vehicle ? (
        <Link href={`/dealer/enquiries?vehicle=${lead.vehicle.id}`} className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline">
          <CarFront aria-hidden className="size-3.5 text-muted" /> {lead.vehicle.reference}
        </Link>
      ) : null,
    ],
    [
      "Offer",
      lead.offer ? (
        <Link href={`/dealer/enquiries?offer=${lead.offer.id}`} className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline">
          <Sparkles aria-hidden className="size-3.5 text-red" /> {lead.offer.title} <span className="text-muted">· {lead.offer.reference}</span>
        </Link>
      ) : null,
    ],
    ["Budget", lead.budget],
    ["Preferred location", lead.location],
    ["Source", LEAD_SOURCE_LABEL[lead.source]],
  ];

  return (
    <Section
      title="Customer"
      action={
        <div className="flex items-center gap-3">
          {lead.customerKey && (
            <Link href={`/dealer/customers/${lead.customerKey}`} className="text-[12.5px] font-medium text-muted hover:text-ink">
              Customer history
            </Link>
          )}
          {canEdit && (
            <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-ink hover:text-red">
              <Pencil aria-hidden className="size-3.5" /> Edit
            </button>
          )}
        </div>
      }
    >
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[12px] text-muted">{k}</dt>
            <dd className="mt-0.5 text-[14px] text-ink">{v ?? <span className="text-muted">—</span>}</dd>
          </div>
        ))}
      </dl>
      {lead.siteLead && (
        <div className="mt-5 border border-line bg-mist/50 px-4 py-3.5">
          <p className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
            <Globe aria-hidden className="size-3.5" /> Website {LEAD_TYPE_LABEL[lead.siteLead.type as keyof typeof LEAD_TYPE_LABEL]?.toLowerCase() ?? "enquiry"} ·{" "}
            <span className="font-mono">{lead.siteLead.reference}</span>
            {lead.siteLead.page && <span className="truncate">· {lead.siteLead.page}</span>}
          </p>
          {lead.siteLead.message && <p className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-ink/80">“{lead.siteLead.message}”</p>}
        </div>
      )}
    </Section>
  );
}

/* ── Status, assignment, reminder ─────────────────────────── */

function PipelineCard({ lead, members, canAssign, now }: { lead: LeadDetail; members: MemberOption[]; canAssign: boolean; now: number }) {
  const { run, busy, errors } = useRun();
  const [status, setStatus] = useState(lead.status);
  const knownReason = LOST_REASONS.includes((lead.lostReason ?? "") as (typeof LOST_REASONS)[number]);
  const [reason, setReason] = useState(lead.lostReason ? (knownReason ? lead.lostReason : "Other") : "");
  const [otherReason, setOtherReason] = useState(lead.lostReason && !knownReason ? lead.lostReason : "");
  const [member, setMember] = useState(lead.assigned ? String(lead.assigned.id) : "");
  const [at, setAt] = useState(lead.followUpAt && new Date(lead.followUpAt).getTime() > now ? toISTInput(lead.followUpAt) : "");
  const [note, setNote] = useState("");
  const finished = CRM_FINISHED.includes(lead.status);

  const lostReason = reason === "Other" ? otherReason : reason;
  const saveStatus = () => run("status", () => updateLeadStatusAction({ id: lead.id, status, lostReason: status === "lost" ? lostReason : undefined }), `Status: ${CRM_STATUS_LABEL[status]}`);
  const saveAssign = () => run("assign", () => assignLeadAction({ id: lead.id, memberId: member ? Number(member) : null }), member ? "Enquiry assigned" : "Enquiry unassigned");
  const saveReminder = () => run("reminder", () => setFollowUpAction({ id: lead.id, at, note: note || undefined }), "Reminder set");
  const clearReminder = () => run("clear", () => setFollowUpAction({ id: lead.id, at: "" }), "Reminder cleared");

  return (
    <Section title="Pipeline">
      <div className="space-y-5">
        <div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Select
              label="Status"
              className="flex-1"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              options={CRM_STATUS.map((s) => ({ value: s, label: CRM_STATUS_LABEL[s] }))}
              error={errors.status}
            />
            <Button
              variant="dark"
              size="sm"
              className="h-10"
              disabled={busy !== null || (status === lead.status && (status !== "lost" || lostReason === lead.lostReason))}
              onClick={saveStatus}
              icon={busy === "status" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}
            >
              Update status
            </Button>
          </div>
          {status === "lost" && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select label="Lost reason" value={reason} onChange={(e) => setReason(e.target.value)} options={LOST_REASONS.map((r) => ({ value: r, label: r }))} placeholder="Choose a reason" error={reason !== "Other" ? errors.lostReason : undefined} />
              {reason === "Other" && <Input label="Describe it" value={otherReason} onChange={(e) => setOtherReason(e.target.value)} maxLength={200} error={errors.lostReason} />}
            </div>
          )}
        </div>

        {canAssign ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Select
              label="Sales executive"
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
              <FollowUp at={lead.followUpAt} status={lead.status} now={now} />
              <button type="button" disabled={busy !== null} onClick={clearReminder} className="text-[12.5px] font-medium text-muted hover:text-red disabled:opacity-50">
                Clear
              </button>
            </div>
          )}
          {finished && <p className="mt-2 text-[12px] text-muted">Reminders are off for {CRM_STATUS_LABEL[lead.status].toLowerCase()} enquiries.</p>}
        </div>
      </div>
    </Section>
  );
}

/* ── Notes and contact log ────────────────────────────────── */

function Composer({ lead }: { lead: LeadDetail }) {
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
      if (await run("note", () => addLeadNoteAction({ id: lead.id, body: note }), "Note added")) setNote("");
    } else if (tab === "call") {
      if (await run("call", () => logLeadContactAction({ id: lead.id, channel: "call", outcome: outcome || undefined, durationMin: duration || undefined, notes: callNotes || undefined }), "Call logged")) {
        setOutcome("");
        setDuration("");
        setCallNotes("");
      }
    } else if (await run("message", () => logLeadContactAction({ id: lead.id, channel, notes: message }), `${channel === "whatsapp" ? "WhatsApp" : "Email"} logged`)) setMessage("");
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
        {tab === "note" && <Textarea aria-label="Internal note" placeholder="Only your team sees notes." value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} error={errors.body} />}
        {tab === "call" && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
              <Select label="Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)} options={Object.entries(CALL_OUTCOMES).map(([value, label]) => ({ value, label }))} placeholder="How did it go?" error={errors.outcome} />
              <Input label="Duration (min)" type="number" min={0} max={600} inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} error={errors.durationMin} />
            </div>
            <Textarea aria-label="Call notes" placeholder="What was discussed (optional)" value={callNotes} onChange={(e) => setCallNotes(e.target.value)} maxLength={2000} error={errors.notes} />
            <p className="text-[12px] text-muted">A manual log of a call you made from your phone — the portal doesn&apos;t place or record calls.</p>
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
            <p className="text-[12px] text-muted">Messages are sent from your own WhatsApp or mailbox; log them here to keep the history in one place.</p>
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

function Timeline({ lead }: { lead: LeadDetail }) {
  if (!lead.events.length) return <p className="text-[13.5px] text-muted">No activity yet.</p>;
  return (
    <ol className="relative space-y-5 before:absolute before:inset-y-1 before:left-[15px] before:w-px before:bg-line">
      {lead.events.map((e) => {
        const Icon = EVENT_ICON[e.kind] ?? CircleDot;
        const [first, ...rest] = e.body.split("\n");
        return (
          <li key={e.id} className="relative flex gap-3.5">
            <span className={cn("relative z-10 inline-flex size-[31px] shrink-0 items-center justify-center rounded-full border bg-white", e.kind === "status" || e.kind === "created" ? "border-ink/20 text-ink" : "border-line text-muted")}>
              <Icon aria-hidden className="size-[15px]" />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p className="text-[13.5px] font-medium leading-snug text-ink">{first}</p>
              {rest.length > 0 && <p className="mt-1 whitespace-pre-line break-words text-[13px] leading-relaxed text-ink/70">{rest.join("\n")}</p>}
              <p className="mt-1 text-[11.5px] text-muted num">
                {e.memberName ?? "MarchGear"} · {formatIstDateTime(e.createdAt)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
