"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing, CheckCircle2, FilePlus2, Loader2, Mail, MessageCircle, Phone, XCircle } from "lucide-react";
import { INS_RENEWAL_STATUS } from "@/db/enums";
import { INS_LEAD_STATUS_LABEL, INS_RENEWAL_OPEN, INS_RENEWAL_STATUS_LABEL } from "@/insurance/labels";
import { cn } from "@/lib/utils";
import {
  addRenewalNoteAction,
  assignRenewalAction,
  prepareRenewalQuoteAction,
  recordRenewalContactAction,
  setRenewalFollowUpAction,
  updateRenewalStatusAction,
} from "@/server/actions/ins-renewals";
import { Button } from "@/components/ui/button";
import { formatDay } from "@/components/portal/ui";
import { Input, Select, Textarea } from "@/components/portal/crm/controls";
import { useRun } from "@/components/portal/crm/use-run";
import { formatIstDateTime, toISTInput, whatsappHref } from "@/components/portal/crm/pipeline";
import { rupees } from "@/components/portal/billing/shared";
import { ExpiryCell, FollowUp, Initials, RenewalStatusBadge, Tag } from "@/components/insurance/vendor/crm/badges";
import { RENEWAL_LOST_REASONS, RENEWAL_SOURCE_LABEL, daysFrom, formatMobile, type MemberOption, type RenewalActivity, type RenewalItem } from "@/components/insurance/vendor/crm/shared";

const sectionTitle = "text-[11px] font-semibold uppercase tracking-[0.12em] text-muted";

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
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

export function RenewalDrawer({
  renewal,
  activity,
  members,
  can,
  now,
  today,
  vendorName,
}: {
  renewal: RenewalItem;
  activity: RenewalActivity[];
  members: MemberOption[];
  can: { assign: boolean; quotes: boolean };
  now: number;
  today: string;
  vendorName: string;
}) {
  const router = useRouter();
  const { run, busy, errors } = useRun();
  const r = renewal;
  const open = INS_RENEWAL_OPEN.includes(r.status);
  const [status, setStatus] = useState(r.status);
  const [reason, setReason] = useState("");
  const [other, setOther] = useState("");
  const [member, setMember] = useState(r.assigned ? String(r.assigned.id) : "");
  const [at, setAt] = useState(r.followUpAt && new Date(r.followUpAt).getTime() > now ? toISTInput(r.followUpAt) : "");
  const [note, setNote] = useState("");
  const days = daysFrom(today, r.expiryDate);
  const lostReason = reason === "Other" ? other : reason;

  const logLink = (channel: "call" | "whatsapp" | "email") => void recordRenewalContactAction({ id: r.id, channel }).catch(() => null);
  const quick = (to: typeof status, why?: string) => run(`quick-${to}`, () => updateRenewalStatusAction({ id: r.id, status: to, reason: why }), `Marked ${INS_RENEWAL_STATUS_LABEL[to].toLowerCase()}`);
  const prepare = async () => {
    const res = await run("quote", () => prepareRenewalQuoteAction({ id: r.id }), (x) => (x.created ? "Renewal enquiry created" : null));
    if (res) router.push(`/insurance-vendor/quotes/new?enquiry=${res.enquiryId}`);
  };

  const car = [r.brandName, r.modelName, r.variantName].filter(Boolean).join(" ");
  const facts: [string, ReactNode][] = [
    ["Mobile", <a key="m" href={`tel:+91${r.mobile}`} onClick={() => logLink("call")} className="num underline-offset-4 hover:underline">+91 {formatMobile(r.mobile)}</a>],
    ["Email", r.email ? <a key="e" href={`mailto:${r.email}`} onClick={() => logLink("email")} className="break-all underline-offset-4 hover:underline">{r.email}</a> : null],
    ["City", r.city],
    ["Registration", r.regNumber ? <span key="r" className="font-mono font-semibold">{r.regNumber}</span> : null],
    ["Vehicle", car || null],
    ["Year · fuel", [r.year, r.fuel].filter(Boolean).join(" · ") || null],
    ["Current insurer", r.currentInsurer],
    ["Policy number", r.policyNumber ? <span key="p" className="font-mono">{r.policyNumber}</span> : null],
    ["Policy type", r.policyType],
    ["No-claim bonus", `${r.ncbPct}%`],
    ["Last premium", r.premium ? rupees(r.premium) : null],
    ["Source", RENEWAL_SOURCE_LABEL[r.source] ?? r.source],
  ];

  return (
    <div className="divide-y divide-line">
      <div className="px-5 py-5 sm:px-6">
        <div className="flex items-start gap-3.5">
          <Initials name={r.name} className="size-11 text-[13px]" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-[20px] font-semibold tracking-[-0.02em]">{r.name}</h2>
            <p className="mt-1 text-[12.5px] text-muted">
              <span className="font-mono text-ink/70">{r.reference}</span> · added {formatIstDateTime(r.createdAt).split(",")[0]}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <RenewalStatusBadge status={r.status} />
              <Tag>Expires {formatDay(r.expiryDate)}</Tag>
              {r.followUpAt && <FollowUp at={r.followUpAt} finished={!open} now={now} className="!flex-row !items-center !gap-2" />}
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border border-line px-4 py-3">
          <ExpiryCell date={r.expiryDate} days={days} muted={!open} />
          {r.renewedAt && <span className="text-[12.5px] font-medium text-[#1e7a3c]">Renewed {formatIstDateTime(r.renewedAt).split(",")[0]}</span>}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Button href={`tel:+91${r.mobile}`} onClick={() => logLink("call")} variant="outline" size="sm" icon={<Phone className="size-4" aria-hidden />}>
            Call
          </Button>
          <Button
            href={whatsappHref(r.mobile, `Hello ${r.name.split(" ")[0]}, this is ${vendorName}. Your car insurance${r.regNumber ? ` for ${r.regNumber}` : ""} is due for renewal on ${r.expiryDate.split("-").reverse().join("-")}.`)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => logLink("whatsapp")}
            variant="outline"
            size="sm"
            icon={<MessageCircle className="size-4" aria-hidden />}
          >
            WhatsApp
          </Button>
          {r.email ? (
            <Button href={`mailto:${r.email}?subject=${encodeURIComponent("Your car insurance renewal")}`} onClick={() => logLink("email")} variant="outline" size="sm" icon={<Mail className="size-4" aria-hidden />}>
              Email
            </Button>
          ) : (
            <span className="inline-flex h-9 items-center justify-center rounded-[3px] border border-dashed border-line text-[12.5px] text-muted">No email</span>
          )}
        </div>
        {can.quotes && open && (
          <Button variant="dark" size="sm" className="mt-2 w-full" onClick={prepare} disabled={busy !== null} icon={busy === "quote" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FilePlus2 className="size-4" aria-hidden />}>
            Prepare quote
          </Button>
        )}
        {can.quotes && open && !r.enquiry && <p className="mt-2 text-[11.5px] leading-relaxed text-muted">Creates a renewal enquiry for this policyholder (source: renewal desk) and opens the quote builder.</p>}
        {r.enquiry && (
          <p className="mt-3 text-[12.5px] text-muted">
            Enquiry{" "}
            <Link href={`/insurance-vendor/enquiries/${r.enquiry.id}`} className="font-mono font-medium text-ink underline-offset-4 hover:underline">
              {r.enquiry.reference}
            </Link>{" "}
            · {INS_LEAD_STATUS_LABEL[r.enquiry.status]}
          </p>
        )}
      </div>

      {open && (
        <Section title="Outcome">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Button variant="outline" size="sm" onClick={() => quick("renewed")} disabled={busy !== null} icon={busy === "quick-renewed" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CheckCircle2 className="size-4 text-[#1e7a3c]" aria-hidden />}>
              Mark renewed
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => quick("lapsed")}
              disabled={busy !== null || days > 0}
              title={days > 0 ? "A policy can only lapse after its expiry date" : undefined}
              icon={busy === "quick-lapsed" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <XCircle className="size-4 text-red" aria-hidden />}
            >
              Lapsed
            </Button>
            <Button variant="outline" size="sm" onClick={() => setStatus("lost")} disabled={busy !== null} icon={<XCircle className="size-4 text-muted" aria-hidden />}>
              Lost…
            </Button>
          </div>
          {days > 0 && <p className="mt-2 text-[11.5px] text-muted">“Lapsed” becomes available after the expiry date.</p>}
        </Section>
      )}

      <Section title="Status & assignment">
        <div className="space-y-5">
          <div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Select label="Status" className="flex-1" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} options={INS_RENEWAL_STATUS.map((s) => ({ value: s, label: INS_RENEWAL_STATUS_LABEL[s] }))} error={errors.status} />
              <Button
                variant="dark"
                size="sm"
                className="h-10"
                disabled={busy !== null || status === r.status || (status === "lost" && !lostReason)}
                onClick={() => run("status", () => updateRenewalStatusAction({ id: r.id, status, reason: status === "lost" ? lostReason : undefined }), `Status: ${INS_RENEWAL_STATUS_LABEL[status]}`)}
                icon={busy === "status" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}
              >
                Update status
              </Button>
            </div>
            {status === "lost" && (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Select label="Lost reason" value={reason} onChange={(e) => setReason(e.target.value)} options={RENEWAL_LOST_REASONS.map((x) => ({ value: x, label: x }))} placeholder="Choose a reason" error={reason !== "Other" ? errors.reason : undefined} />
                {reason === "Other" && <Input label="Describe it" value={other} onChange={(e) => setOther(e.target.value)} maxLength={200} error={errors.reason} />}
              </div>
            )}
          </div>
          {can.assign ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Select label="Assigned executive" className="flex-1" value={member} onChange={(e) => setMember(e.target.value)} options={members.map((m) => ({ value: String(m.id), label: `${m.name} · ${m.roleLabel}` }))} placeholder="Unassigned" error={errors.memberId} />
              <Button
                variant="outline"
                size="sm"
                className="h-10"
                disabled={busy !== null || member === (r.assigned ? String(r.assigned.id) : "")}
                onClick={() => run("assign", () => assignRenewalAction({ id: r.id, memberId: member ? Number(member) : null }), member ? "Renewal assigned" : "Renewal unassigned")}
                icon={busy === "assign" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}
              >
                Assign
              </Button>
            </div>
          ) : (
            <p className="text-[13px] text-muted">Assigned to {r.assigned?.name ?? "nobody yet"}.</p>
          )}
          <div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Input label="Follow-up reminder (IST)" type="datetime-local" className="flex-1" min={toISTInput(new Date(now))} value={at} disabled={!open} onChange={(e) => setAt(e.target.value)} error={errors.at} />
              <Button
                variant="outline"
                size="sm"
                className="h-10"
                disabled={busy !== null || !at || !open}
                onClick={() => run("reminder", () => setRenewalFollowUpAction({ id: r.id, at }), "Reminder set")}
                icon={busy === "reminder" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <BellRing className="size-4" aria-hidden />}
              >
                {r.followUpAt ? "Update" : "Set"}
              </Button>
            </div>
            {r.followUpAt && (
              <div className="mt-3 flex items-center justify-between gap-3 border border-line px-3.5 py-2.5">
                <FollowUp at={r.followUpAt} finished={!open} now={now} />
                <button type="button" disabled={busy !== null} onClick={() => run("clear", () => setRenewalFollowUpAction({ id: r.id, at: "" }), "Reminder cleared")} className="text-[12.5px] font-medium text-muted hover:text-red disabled:opacity-50">
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>
      </Section>

      <Section title="Policy & vehicle">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {facts.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-[12px] text-muted">{k}</dt>
              <dd className="mt-0.5 break-words text-[13.5px]">{v === null || v === undefined || v === "" ? <span className="text-muted">—</span> : v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Notes">
        {r.notes ? <div className="mb-4 max-h-[260px] overflow-y-auto whitespace-pre-line border-l-2 border-line pl-4 text-[13px] leading-relaxed text-ink/80">{r.notes}</div> : <p className="mb-4 text-[13px] text-muted">No notes yet.</p>}
        <form
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run("note", () => addRenewalNoteAction({ id: r.id, body: note }), "Note added")) setNote("");
          }}
          className="space-y-2"
        >
          <Textarea aria-label="Add a note" placeholder="Only your team sees notes." value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} error={errors.body} />
          <div className="flex justify-end">
            <Button type="submit" variant="dark" size="sm" disabled={busy !== null || !note.trim()} icon={busy === "note" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
              Add note
            </Button>
          </div>
        </form>
      </Section>

      <Section title={`Activity · ${activity.length}`}>
        {activity.length ? (
          <ol className="space-y-3">
            {activity.map((a) => (
              <li key={a.id} className={cn("border-l-2 border-line pl-3")}>
                <p className="text-[13px] leading-snug">{a.summary}</p>
                <p className="mt-0.5 text-[11.5px] text-muted num">
                  {a.author ?? "MarchGear"} · {formatIstDateTime(a.createdAt)}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[13px] text-muted">No activity yet.</p>
        )}
      </Section>
    </div>
  );
}
