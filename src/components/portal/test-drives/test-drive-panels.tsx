"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Ban, CalendarClock, CalendarPlus, CheckCircle2, Loader2, MessageCircle, Phone, Star, UserX, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { closeTestDriveAction, completeTestDriveAction, updateTestDriveAction } from "@/server/actions/partner-test-drives";
import { Drawer, Modal } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { Initials, LeadStatusBadge, TestDriveBadge } from "@/components/portal/crm/badges";
import { Input, Select, Textarea } from "@/components/portal/crm/controls";
import { useRun } from "@/components/portal/crm/use-run";
import { formatIstDateTime, formatWhen, whatsappHref } from "@/components/portal/crm/pipeline";
import type { TestDriveItem } from "@/components/portal/crm/types";
import { TestDriveFormModal, type TestDriveOptions } from "./schedule-form";

const REJECT_REASONS = ["Car not available on that date", "Outside our service area", "Duplicate request", "Couldn't reach the customer", "Other"];
const CANCEL_REASONS = ["Customer cancelled", "Customer postponed", "Car no longer available", "Executive unavailable", "Other"];

/** Opens / closes the ?td= drawer while keeping the other params. */
function useDrawerParam() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const href = (id: number | null) => {
    const q = new URLSearchParams(params.toString());
    if (id === null) q.delete("td");
    else q.set("td", String(id));
    const s = q.toString();
    return s ? `${pathname}?${s}` : pathname;
  };
  return { pending, href, close: () => start(() => router.replace(href(null), { scroll: false })) };
}

/* ── "New test drive" ─────────────────────────────────────── */

export function NewTestDriveButton({ options }: { options: TestDriveOptions }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)} icon={<CalendarPlus className="size-4" aria-hidden />}>
        New test drive
      </Button>
      <TestDriveFormModal open={open} onClose={() => setOpen(false)} options={options} mode={{ kind: "create" }} />
    </>
  );
}

/* ── Requests queue ───────────────────────────────────────── */

export function RequestQueue({ items, options }: { items: TestDriveItem[]; options: TestDriveOptions }) {
  const [accepting, setAccepting] = useState<TestDriveItem | null>(null);
  const [rejecting, setRejecting] = useState<TestDriveItem | null>(null);
  const { href } = useDrawerParam();
  if (!items.length)
    return (
      <div className="border border-line bg-white px-6 py-14 text-center">
        <p className="font-display text-[18px] font-semibold">You&apos;re all caught up</p>
        <p className="mx-auto mt-2 max-w-md text-[14px] text-muted">Test-drive requests from your listings and showroom page land here for you to accept and schedule.</p>
      </div>
    );
  return (
    <>
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {items.map((t) => (
          <li key={t.id} className="flex flex-col border border-line bg-white transition-colors duration-300 hover:border-ink/25">
            <Link href={href(t.id)} scroll={false} className="flex items-start gap-3.5 p-5">
              <Initials name={t.customerName} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="truncate text-[15px] font-semibold">{t.customerName}</p>
                  <span className="shrink-0 font-mono text-[11px] text-muted">{t.reference}</span>
                </div>
                <p className="mt-1 truncate text-[13.5px] text-ink/80">{t.carLabel}</p>
                <p className="mt-2.5 inline-flex items-center gap-1.5 text-[12.5px] text-muted num">
                  <CalendarClock aria-hidden className="size-3.5" />
                  {t.requestedFor ? `Asked for ${formatWhen(t.requestedFor, { weekday: true })}` : "No preferred time"}
                </p>
                <p className="mt-1 text-[12px] text-muted num">Received {formatIstDateTime(t.createdAt)}</p>
              </div>
            </Link>
            <div className="mt-auto flex flex-wrap gap-2 border-t border-line px-5 py-3.5">
              <Button variant="dark" size="sm" onClick={() => setAccepting(t)} icon={<CheckCircle2 className="size-4" aria-hidden />}>
                Accept
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setRejecting(t)} icon={<XCircle className="size-4" aria-hidden />}>
                Reject
              </Button>
              <Button href={`tel:+91${t.mobile}`} variant="ghost" size="sm" className="ml-auto" icon={<Phone className="size-4" aria-hidden />}>
                Call
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {accepting && <TestDriveFormModal open onClose={() => setAccepting(null)} options={options} mode={{ kind: "schedule", drive: accepting }} />}
      <ReasonModal drive={rejecting} outcome="rejected" onClose={() => setRejecting(null)} />
    </>
  );
}

/* ── Reject / cancel with a reason ────────────────────────── */

function ReasonModal({ drive, outcome, onClose }: { drive: TestDriveItem | null; outcome: "rejected" | "cancelled"; onClose: () => void }) {
  return (
    <Modal open={Boolean(drive)} onClose={onClose} title={outcome === "rejected" ? "Reject request" : "Cancel test drive"} description={drive ? `${drive.reference} · ${drive.customerName}` : undefined} size="sm">
      {drive && <ReasonForm drive={drive} outcome={outcome} onClose={onClose} />}
    </Modal>
  );
}

function ReasonForm({ drive, outcome, onClose }: { drive: TestDriveItem; outcome: "rejected" | "cancelled"; onClose: () => void }) {
  const { run, busy, errors } = useRun();
  const presets = outcome === "rejected" ? REJECT_REASONS : CANCEL_REASONS;
  const [preset, setPreset] = useState("");
  const [other, setOther] = useState("");
  const reason = preset === "Other" ? other : preset;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await run("save", () => closeTestDriveAction({ id: drive.id, outcome, reason }), outcome === "rejected" ? "Request rejected" : "Test drive cancelled")) onClose();
  };
  return (
    <form onSubmit={submit} noValidate className="space-y-4 px-6 py-6 sm:px-8">
      <Select label="Reason" value={preset} onChange={(e) => setPreset(e.target.value)} options={presets.map((r) => ({ value: r, label: r }))} placeholder="Choose a reason" error={preset !== "Other" ? errors.reason : undefined} data-autofocus />
      {preset === "Other" && <Input label="Describe it" value={other} onChange={(e) => setOther(e.target.value)} maxLength={500} error={errors.reason} />}
      <p className="text-[12px] text-muted">Logged on the enquiry&apos;s timeline. The customer isn&apos;t messaged automatically — call or WhatsApp them.</p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Back
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={busy !== null} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
          {outcome === "rejected" ? "Reject request" : "Cancel test drive"}
        </Button>
      </div>
    </form>
  );
}

/* ── Completed / no-show + feedback ───────────────────────── */

function OutcomeModal({ drive, outcome, onClose }: { drive: TestDriveItem | null; outcome: "completed" | "no_show"; onClose: () => void }) {
  const editing = drive?.status === "completed";
  return (
    <Modal
      open={Boolean(drive)}
      onClose={onClose}
      title={outcome === "no_show" ? "Mark as no-show" : editing ? "Edit feedback" : "Mark as completed"}
      description={drive ? `${drive.reference} · ${drive.customerName}` : undefined}
      size="sm"
    >
      {drive && <OutcomeForm drive={drive} outcome={outcome} onClose={onClose} />}
    </Modal>
  );
}

function OutcomeForm({ drive, outcome, onClose }: { drive: TestDriveItem; outcome: "completed" | "no_show"; onClose: () => void }) {
  const { run, busy, errors } = useRun();
  const [rating, setRating] = useState(drive.status === "completed" ? (drive.rating ?? 0) : 0);
  const [feedback, setFeedback] = useState(drive.status === "completed" ? (drive.feedback ?? "") : "");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await run("save", () => completeTestDriveAction({ id: drive.id, outcome, feedback: feedback || undefined, rating: outcome === "completed" ? rating : undefined }), outcome === "no_show" ? "Marked as no-show" : "Feedback saved")) onClose();
  };
  return (
    <form onSubmit={submit} noValidate className="space-y-4 px-6 py-6 sm:px-8">
      {outcome === "completed" && (
        <fieldset>
          <legend className="mb-1.5 text-[12px] font-medium text-ink/80">Customer&apos;s rating of the drive</legend>
          <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n === 1 ? "" : "s"}`} onClick={() => setRating(rating === n ? 0 : n)} className="rounded-full p-1 transition-transform duration-300 hover:scale-110">
                <Star aria-hidden className={cn("size-6 transition-colors duration-300", n <= rating ? "fill-ink text-ink" : "fill-line text-line")} strokeWidth={0} />
              </button>
            ))}
            <span className="ml-2 text-[12.5px] text-muted num">{rating ? `${rating}/5` : "Not rated"}</span>
          </div>
          {errors.rating && <p className="mt-1.5 text-[12px] text-red">{errors.rating}</p>}
        </fieldset>
      )}
      <Textarea
        label={outcome === "completed" ? "Feedback (optional)" : "Notes (optional)"}
        placeholder={outcome === "completed" ? "What did they like? Ready to book?" : "Did they call to reschedule?"}
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        maxLength={2000}
        error={errors.feedback}
        data-autofocus
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Back
        </Button>
        <Button type="submit" variant="dark" size="sm" disabled={busy !== null} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
          {outcome === "no_show" ? "Mark no-show" : "Save"}
        </Button>
      </div>
    </form>
  );
}

/* ── The drawer ───────────────────────────────────────────── */

export function TestDriveDrawer({ drive, options }: { drive: TestDriveItem | null; options: TestDriveOptions }) {
  const { close, pending } = useDrawerParam();
  return (
    <Drawer open={Boolean(drive)} onClose={close} title="Test drive" className="max-w-[560px]">
      {drive && <DriveDetail key={`${drive.id}-${drive.updatedAt}`} drive={drive} options={options} />}
      {pending && <span className="sr-only">Loading</span>}
    </Drawer>
  );
}

function DriveDetail({ drive: t, options }: { drive: TestDriveItem; options: TestDriveOptions }) {
  const [scheduling, setScheduling] = useState(false);
  const [closing, setClosing] = useState<"rejected" | "cancelled" | null>(null);
  const [outcome, setOutcome] = useState<"completed" | "no_show" | null>(null);
  const [rebook, setRebook] = useState(false);
  const { run, busy, errors } = useRun();
  const [member, setMember] = useState(t.assigned ? String(t.assigned.id) : "");
  const active = ["requested", "accepted", "scheduled", "rescheduled"].includes(t.status);
  const booked = t.status === "accepted" || t.status === "scheduled" || t.status === "rescheduled";

  const saveMember = () => run("member", () => updateTestDriveAction({ id: t.id, assignedMemberId: member || undefined }), "Sales executive updated");

  const rows: [string, React.ReactNode][] = [
    ["Car", t.vehicle ? `${t.carLabel} · ${t.vehicle.reference}` : t.carLabel],
    ["Scheduled", t.scheduledAt ? formatWhen(t.scheduledAt, { weekday: true, year: true }) : "Not scheduled yet"],
    ["Customer asked for", t.requestedFor ? formatWhen(t.requestedFor, { weekday: true }) : "—"],
    ["Showroom", t.showroom?.name ?? "—"],
    ["Sales executive", t.assigned?.name ?? "Not assigned"],
    [
      "Enquiry",
      t.lead ? (
        <Link href={`/dealer/enquiries/${t.lead.id}`} className="inline-flex items-center gap-2 underline-offset-4 hover:underline">
          <span className="font-mono text-[12.5px]">{t.lead.reference}</span> <LeadStatusBadge status={t.lead.status} />
        </Link>
      ) : (
        "Booked in the portal"
      ),
    ],
    ["Created", formatIstDateTime(t.createdAt)],
  ];

  return (
    <div className="divide-y divide-line">
      <div className="px-5 py-5 sm:px-6">
        <div className="flex items-start gap-3.5">
          <Initials name={t.customerName} className="size-11 text-[13px]" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-[20px] font-semibold tracking-[-0.02em]">{t.customerName}</h2>
            <p className="mt-1 text-[12.5px] text-muted">
              <span className="font-mono text-ink/70">{t.reference}</span> · +91 {t.mobile}
            </p>
            <div className="mt-3">
              <TestDriveBadge status={t.status} />
            </div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button href={`tel:+91${t.mobile}`} variant="outline" size="sm" icon={<Phone className="size-4" aria-hidden />}>
            Call
          </Button>
          <Button href={whatsappHref(t.mobile, `Hello ${t.customerName.split(" ")[0]}, about your test drive of the ${t.carLabel}: `)} target="_blank" rel="noopener noreferrer" variant="outline" size="sm" icon={<MessageCircle className="size-4" aria-hidden />}>
            WhatsApp
          </Button>
        </div>
      </div>

      <section className="px-5 py-5 sm:px-6">
        <h3 className="mb-3.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Actions</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {t.status === "requested" && (
            <>
              <Button variant="dark" size="sm" onClick={() => setScheduling(true)} icon={<CheckCircle2 className="size-4" aria-hidden />}>
                Accept & schedule
              </Button>
              <Button variant="outline" size="sm" onClick={() => setClosing("rejected")} icon={<XCircle className="size-4" aria-hidden />}>
                Reject
              </Button>
            </>
          )}
          {booked && (
            <>
              <Button variant="dark" size="sm" onClick={() => setScheduling(true)} icon={<CalendarClock className="size-4" aria-hidden />}>
                {t.status === "accepted" ? "Schedule" : "Reschedule"}
              </Button>
              <Button variant="outline" size="sm" disabled={!t.scheduledAt} onClick={() => setOutcome("completed")} icon={<CheckCircle2 className="size-4" aria-hidden />}>
                Mark completed
              </Button>
              <Button variant="outline" size="sm" onClick={() => setOutcome("no_show")} icon={<UserX className="size-4" aria-hidden />}>
                No-show
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setClosing("cancelled")} icon={<Ban className="size-4" aria-hidden />}>
                Cancel
              </Button>
            </>
          )}
          {t.status === "completed" && (
            <Button variant="outline" size="sm" onClick={() => setOutcome("completed")} icon={<Star className="size-4" aria-hidden />}>
              Edit feedback
            </Button>
          )}
          {!active && (
            <Button variant="outline" size="sm" onClick={() => setRebook(true)} icon={<CalendarPlus className="size-4" aria-hidden />}>
              Book another drive
            </Button>
          )}
        </div>
        {t.status === "accepted" && !t.scheduledAt && <p className="mt-3 text-[12px] text-muted">Accepted — confirm a time with the customer, then schedule it.</p>}
      </section>

      {active && (
        <section className="px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Select
              label="Sales executive"
              className="flex-1"
              value={member}
              onChange={(e) => setMember(e.target.value)}
              options={(options.canAssign ? options.members : options.members.filter((m) => m.id === options.selfId)).map((m) => ({ value: String(m.id), label: `${m.name} · ${m.roleLabel}` }))}
              placeholder="Not assigned"
              error={errors.assignedMemberId}
            />
            <Button variant="outline" size="sm" className="h-10" disabled={busy !== null || !member || member === (t.assigned ? String(t.assigned.id) : "")} onClick={saveMember} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
              Assign
            </Button>
          </div>
        </section>
      )}

      <section className="px-5 py-5 sm:px-6">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-[12px] text-muted">{k}</dt>
              <dd className="mt-0.5 break-words text-[14px]">{v}</dd>
            </div>
          ))}
        </dl>
        {(t.feedback || t.rating) && (
          <div className="mt-5 border-l-2 border-ink bg-mist/60 px-4 py-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">{t.status === "rejected" || t.status === "cancelled" ? "Reason" : t.status === "no_show" ? "Notes" : "Feedback"}</p>
            {t.rating ? (
              <p className="mt-1.5 flex items-center gap-1" aria-label={`Rated ${t.rating} of 5`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} aria-hidden className={cn("size-4", n <= (t.rating ?? 0) ? "fill-ink text-ink" : "fill-line text-line")} strokeWidth={0} />
                ))}
              </p>
            ) : null}
            {t.feedback && <p className="mt-1.5 whitespace-pre-line text-[13.5px] leading-relaxed text-ink/80">{t.feedback}</p>}
          </div>
        )}
      </section>

      {scheduling && <TestDriveFormModal open onClose={() => setScheduling(false)} options={options} mode={{ kind: "schedule", drive: t }} />}
      <ReasonModal drive={closing ? t : null} outcome={closing ?? "cancelled"} onClose={() => setClosing(null)} />
      <OutcomeModal drive={outcome ? t : null} outcome={outcome ?? "completed"} onClose={() => setOutcome(null)} />
      {rebook && (
        <TestDriveFormModal
          open
          onClose={() => setRebook(false)}
          options={options}
          mode={{ kind: "create", lead: { id: t.lead?.id ?? 0, name: t.customerName, mobile: t.mobile, email: t.email, carSlug: null, variant: null, vehicleId: t.vehicle?.id ?? null } }}
        />
      )}
    </div>
  );
}
