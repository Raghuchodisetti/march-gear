"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BadgeCheck, FilePenLine, Landmark, Loader2, Undo2 } from "lucide-react";
import { BUSINESS_TYPES } from "@/db/enums";
import { BUSINESS_TYPE_LABEL } from "@/partner/labels";
import { cn } from "@/lib/utils";
import { requestDetailsChangeAction, withdrawChangeRequestAction } from "@/server/actions/partner-profile";
import { Badge } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { ConfirmDialog, FieldError, inputCls, useAction } from "./kit";

export interface DetailField {
  key: string;
  label: string;
  value: string;
  /** How to enter a new value. */
  input?: "text" | "date" | "email" | "type" | "account";
  hint?: string;
}

export interface ChangeRequestView {
  id: number;
  status: "pending" | "approved" | "rejected";
  fields: { key: string; label: string; from: string; to: string }[];
  reason: string | null;
  remarks: string | null;
  requestedBy: string | null;
  createdAt: string;
  decidedAt: string | null;
}

const STATUS = { pending: { label: "Awaiting review", tone: "blue" }, approved: { label: "Approved", tone: "green" }, rejected: { label: "Declined", tone: "red" } } as const;

const display = (f: DetailField) => (f.input === "type" ? (BUSINESS_TYPE_LABEL[f.value as keyof typeof BUSINESS_TYPE_LABEL] ?? f.value) : f.value) || "—";

export function BusinessDetails({ groups, requests, verified }: { groups: { title: string; icon: "business" | "bank"; fields: DetailField[] }[]; requests: ChangeRequestView[]; verified: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [withdrawing, setWithdrawing] = useState<number | null>(null);
  const { busy, errors, setErrors, run } = useAction();
  const pending = requests.find((r) => r.status === "pending");

  const start = (focus?: string) => {
    setDraft(focus ? { [focus]: "" } : {});
    setReason("");
    setErrors({});
    setOpen(true);
  };
  const submit = async () => {
    const changes = Object.fromEntries(Object.entries(draft).filter(([, v]) => v.trim() !== ""));
    const res = await run(() => requestDetailsChangeAction({ changes, reason }), "Change request sent to MarchGear for review.");
    if (res) {
      setOpen(false);
      router.refresh();
    }
  };
  const withdraw = async () => {
    if (withdrawing === null) return;
    const res = await run(() => withdrawChangeRequestAction(withdrawing), "Change request withdrawn.");
    setWithdrawing(null);
    if (res) router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border border-line bg-white p-5 sm:flex-row sm:items-center sm:justify-between md:px-6">
        <div className="flex items-start gap-3">
          <BadgeCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-ink" />
          <div>
            <p className="text-[14px] font-semibold">{verified ? "Verified by MarchGear" : "Submitted with your application"}</p>
            <p className="mt-0.5 max-w-xl text-[13px] leading-relaxed text-muted">
              These details were checked against your documents, so they can&apos;t be edited directly. Send a change request — MarchGear reviews it and updates your record once approved.
            </p>
          </div>
        </div>
        <Button variant="dark" size="sm" onClick={() => start()} disabled={Boolean(pending)} icon={<FilePenLine className="size-4" aria-hidden />}>
          Request a change
        </Button>
      </div>

      {pending && (
        <div className="border border-line border-l-2 border-l-[#2456a6] bg-white px-5 py-4 text-[13.5px] md:px-6">
          <span className="font-medium">A change request is waiting for review.</span> <span className="text-muted">You can send another once MarchGear has decided, or withdraw it below.</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
        {groups.map((g) => (
          <section key={g.title} className="border border-line bg-white">
            <header className="flex items-center gap-2.5 border-b border-line px-5 py-3.5 md:px-6">
              {g.icon === "bank" ? <Landmark aria-hidden className="size-4 text-muted" /> : <BadgeCheck aria-hidden className="size-4 text-muted" />}
              <h2 className="text-[14px] font-semibold">{g.title}</h2>
            </header>
            <dl className="divide-y divide-line">
              {g.fields.map((f) => (
                <div key={f.key} className="group grid grid-cols-1 gap-1 px-5 py-3 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-center sm:gap-4 md:px-6">
                  <dt className="text-[12.5px] text-muted">{f.label}</dt>
                  <dd className={cn("min-w-0 break-words text-[13.5px] font-medium", f.key.includes("gst") || f.key.includes("pan") || f.key.includes("ifsc") || f.key.includes("account") ? "font-mono text-[13px] tracking-wide" : "")}>{display(f)}</dd>
                  <dd>
                    <button
                      type="button"
                      onClick={() => start(f.key)}
                      disabled={Boolean(pending)}
                      className="text-[12.5px] font-medium text-muted transition-colors hover:text-red disabled:pointer-events-none disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                    >
                      Request change
                    </button>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <section className="border border-line bg-white">
        <header className="border-b border-line px-5 py-3.5 md:px-6">
          <h2 className="text-[14px] font-semibold">Change requests</h2>
        </header>
        {requests.length ? (
          <ul className="divide-y divide-line">
            {requests.map((r) => (
              <li key={r.id} className="px-5 py-4 md:px-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                    <span className="text-[12.5px] text-muted">
                      Sent {r.createdAt}
                      {r.requestedBy ? ` by ${r.requestedBy}` : ""}
                      {r.decidedAt ? ` · Decided ${r.decidedAt}` : ""}
                    </span>
                  </div>
                  {r.status === "pending" && (
                    <button type="button" onClick={() => setWithdrawing(r.id)} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted hover:text-red">
                      <Undo2 aria-hidden className="size-3.5" /> Withdraw
                    </button>
                  )}
                </div>
                <ul className="mt-3 space-y-1.5">
                  {r.fields.map((f) => (
                    <li key={f.key} className="grid grid-cols-1 gap-1 text-[13px] sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-3">
                      <span className="text-muted">{f.label}</span>
                      <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="break-all text-muted line-through decoration-ink/20">{f.from || "—"}</span>
                        <ArrowRight aria-hidden className="size-3.5 shrink-0 text-muted" />
                        <span className="break-all font-medium">{f.to}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                {r.reason && <p className="mt-3 text-[12.5px] text-muted">Your note: {r.reason}</p>}
                {r.remarks && (
                  <p className="mt-2 border-l-2 border-line pl-3 text-[13px]">
                    <span className="font-medium">MarchGear:</span> {r.remarks}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-8 text-center text-[13px] text-muted md:px-6">No change requests yet.</p>
        )}
      </section>

      <Modal open={open} onClose={() => setOpen(false)} title="Request a change" description="Fill in only what should change. Your current details stay live until MarchGear approves." size="lg">
        <div className="space-y-6 px-6 py-6 sm:px-8">
          {groups.map((g) => (
            <fieldset key={g.title}>
              <legend className="mb-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">{g.title}</legend>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {g.fields.map((f) => {
                  const err = errors[`changes.${f.key}`];
                  const id = `chg-${f.key}`;
                  const common = { id, value: draft[f.key] ?? "", "aria-invalid": Boolean(err) || undefined, onChange: (e: { target: { value: string } }) => setDraft((d) => ({ ...d, [f.key]: e.target.value })) };
                  return (
                    <div key={f.key}>
                      <label htmlFor={id} className="mb-1.5 block text-[12.5px] font-medium">
                        {f.label}
                      </label>
                      {f.input === "type" ? (
                        <select {...common} className={cn(inputCls, "cursor-pointer")}>
                          <option value="">No change</option>
                          {BUSINESS_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {BUSINESS_TYPE_LABEL[t]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input {...common} type={f.input === "date" ? "date" : f.input === "email" ? "email" : "text"} inputMode={f.input === "account" ? "numeric" : undefined} placeholder={f.input === "date" ? undefined : `Now: ${display(f)}`} className={inputCls} />
                      )}
                      <FieldError msg={err} />
                    </div>
                  );
                })}
              </div>
            </fieldset>
          ))}
          <div>
            <label htmlFor="chg-reason" className="mb-1.5 block text-[12.5px] font-medium">
              Reason for the change
            </label>
            <textarea id="chg-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} placeholder="e.g. We converted from a partnership to a private limited company; the new GST certificate is dated 1 Oct." className={cn(inputCls, "h-auto py-2.5 leading-relaxed")} aria-invalid={Boolean(errors.reason) || undefined} />
            <FieldError msg={errors.reason} />
            <p className="mt-1.5 text-xs text-muted">MarchGear may ask for a supporting document (for example a new GST certificate) through your notifications or support.</p>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="dark" size="sm" onClick={submit} disabled={busy || !Object.values(draft).some((v) => v.trim())} icon={busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
              Send for review
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={withdrawing !== null}
        onClose={() => setWithdrawing(null)}
        title="Withdraw this request?"
        body="MarchGear won't review it and your current details stay as they are."
        confirm="Withdraw request"
        busy={busy}
        onConfirm={withdraw}
      />
    </div>
  );
}
