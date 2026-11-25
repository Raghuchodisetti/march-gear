"use client";

import { useState } from "react";
import { useDeskRouter as useRouter } from "@/components/admin/desk";
import { AlertTriangle, Ban, CheckCircle2, ExternalLink, FilePlus2, Loader2, XCircle } from "lucide-react";
import type { ActionFailure } from "@/lib/action-result";
import { formatDate } from "@/lib/format";
import type { FileRef } from "@/partner/types";
import { issueInvoiceAction, rejectPaymentAction, verifyPaymentAction, voidInvoiceAction } from "@/server/actions/partner-admin-billing";
import { useUI } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { MessageBox } from "@/components/portal/support/compose";
import { PAYMENT_METHOD_SHORT, PAYMENT_TERMS_DAYS, addDays, gstOn, istDate, periodEndFor, rupees, type PaymentMethod, type Plan, type PlanId } from "@/components/portal/billing/shared";

const OFFLINE: ActionFailure = { ok: false, error: "Couldn't reach the server. Please try again." };
const spin = <Loader2 className="size-4 animate-spin" aria-hidden />;

export interface ReviewPayment {
  id: number;
  amount: number;
  method: PaymentMethod;
  utr: string;
  paidOn: string;
  proof: FileRef | null;
  submittedAt: string;
  dealer: string;
  invoice: { number: string; total: number; plan: string; period: string };
}

/** Verify a dealer's payment against the bank statement, or reject it with remarks. */
export function PaymentReview({ p }: { p: ReviewPayment }) {
  const router = useRouter();
  const { toast } = useUI();
  const [open, setOpen] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<"verify" | "reject" | null>(null);
  const short = p.invoice.total - p.amount;

  const decide = async (kind: "verify" | "reject") => {
    if (kind === "reject" && remarks.trim().length < 5) return setError("Tell the dealer why (at least 5 characters)");
    setBusy(kind);
    const res = await (kind === "verify" ? verifyPaymentAction(p.id, { remarks: remarks || undefined }) : rejectPaymentAction(p.id, { remarks })).catch(() => OFFLINE);
    setBusy(null);
    if (!res.ok) {
      setError(res.fieldErrors?.remarks);
      return toast(res.error ?? "Couldn't save the decision", { tone: "error" });
    }
    setOpen(false);
    toast(kind === "verify" ? `Verified — invoice ${p.invoice.number} is paid and the plan is active` : "Payment rejected — the dealer has been told why", { tone: "success" });
    router.refresh();
  };

  return (
    <>
      <Button size="sm" variant="dark" onClick={() => setOpen(true)}>
        Review
      </Button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title="Review payment" description={`${p.dealer} · invoice ${p.invoice.number}`} size="lg">
        <div className="space-y-5 px-6 py-6 sm:px-8">
          <dl className="grid grid-cols-2 gap-px overflow-hidden border border-line bg-line sm:grid-cols-3">
            {[
              ["Amount paid", rupees(p.amount)],
              ["Invoice total", rupees(p.invoice.total)],
              ["Method", PAYMENT_METHOD_SHORT[p.method]],
              ["Reference (UTR)", p.utr],
              ["Paid on", formatDate(p.paidOn)],
              ["Recorded", p.submittedAt],
            ].map(([k, v]) => (
              <div key={k} className="bg-white px-4 py-3">
                <dt className="text-[11.5px] text-muted">{k}</dt>
                <dd className="mt-0.5 break-all text-[14px] font-semibold num">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[13px] text-muted">
            {p.invoice.plan} · {p.invoice.period}
          </p>
          {short !== 0 && (
            <p className="flex gap-2 border-l-[3px] border-[#9a5b00] bg-[#fdf3e1] px-4 py-3 text-[13px] text-[#6b4000]">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {short > 0 ? `${rupees(short)} less than the invoice total (TDS deducted?). Verifying marks the invoice fully paid.` : `${rupees(-short)} more than the invoice total.`}
            </p>
          )}
          {p.proof ? (
            <a href={`/dealer/files/${p.proof.id}`} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 border border-line px-4 py-3 text-[13.5px] transition-colors hover:border-ink">
              <span className="min-w-0 truncate font-medium">{p.proof.filename}</span>
              <span className="inline-flex shrink-0 items-center gap-1 text-red">
                Open proof <ExternalLink className="size-3.5" aria-hidden />
              </span>
            </a>
          ) : (
            <p className="text-[13px] text-muted">No proof was uploaded — check the reference against the bank statement.</p>
          )}
          <MessageBox id={`pay-remarks-${p.id}`} label="Remarks (required to reject, shown to the dealer)" value={remarks} onChange={(v) => { setRemarks(v); setError(undefined); }} error={error} rows={3} placeholder="e.g. No credit found for this UTR on 18 Nov — please check the reference." />
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => decide("reject")} disabled={busy !== null} icon={busy === "reject" ? spin : <XCircle className="size-4" aria-hidden />}>
              Reject
            </Button>
            <Button onClick={() => decide("verify")} disabled={busy !== null} icon={busy === "verify" ? spin : <CheckCircle2 className="size-4" aria-hidden />}>
              Verify &amp; mark paid
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export interface DealerOption {
  id: number;
  name: string;
  reference: string;
  plan: string;
}

export function IssueInvoiceButton({ dealers, plans, defaultDealer }: { dealers: DealerOption[]; plans: Plan[]; defaultDealer?: number }) {
  const router = useRouter();
  const { toast } = useUI();
  const today = istDate();
  const first = dealers.find((d) => d.id === defaultDealer) ?? null;
  const [open, setOpen] = useState(false);
  const [partnerId, setPartnerId] = useState(first ? String(first.id) : "");
  const [plan, setPlan] = useState<PlanId>((first?.plan as PlanId) ?? plans[0]?.id ?? "starter");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(periodEndFor(today));
  const [amount, setAmount] = useState(String(plans.find((x) => x.id === plan)?.monthly ?? ""));
  const [dueOn, setDueOn] = useState(addDays(today, PAYMENT_TERMS_DAYS));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const amt = Number(amount) || 0;
  const clear = (k: string) =>
    setErrors((e) => {
      if (!(k in e)) return e;
      const next = { ...e };
      delete next[k];
      return next;
    });

  const pickDealer = (v: string) => {
    setPartnerId(v);
    clear("partnerId");
    const d = dealers.find((x) => String(x.id) === v);
    if (d && plans.some((x) => x.id === d.plan)) {
      setPlan(d.plan as PlanId);
      setAmount(String(plans.find((x) => x.id === d.plan)?.monthly ?? ""));
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await issueInvoiceAction({ partnerId, plan, periodStart: start, periodEnd: end, amount, dueOn }).catch(() => OFFLINE);
    setBusy(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      return toast(res.error ?? "Couldn't issue the invoice", { tone: "error" });
    }
    setErrors({});
    setOpen(false);
    toast(`Invoice ${res.number} issued — the dealer has been notified`, { tone: "success" });
    router.refresh();
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} icon={<FilePlus2 className="size-4" aria-hidden />} disabled={!dealers.length} title={dealers.length ? undefined : "No approved dealers yet"}>
        Issue invoice
      </Button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title="Issue an invoice" description="For one-off charges or corrections. Regular trial-end and renewal invoices are issued automatically." size="lg">
        <form onSubmit={submit} className="space-y-4 px-6 py-6 sm:px-8" noValidate>
          <SelectField label="Dealer" value={partnerId} onChange={(e) => pickDealer(e.target.value)} placeholder="Choose an approved dealer" options={dealers.map((d) => ({ value: String(d.id), label: `${d.name} (${d.reference})` }))} error={errors.partnerId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Plan"
              value={plan}
              onChange={(e) => {
                const v = e.target.value as PlanId;
                setPlan(v);
                setAmount(String(plans.find((x) => x.id === v)?.monthly ?? ""));
              }}
              options={plans.map((x) => ({ value: x.id, label: `${x.name} — ${rupees(x.monthly)}/month` }))}
              error={errors.plan}
            />
            <TextField label="Amount before GST" prefix="₹" inputMode="numeric" value={amount} onChange={(e) => {
                setAmount(e.target.value.replace(/[^\d]/g, ""));
                clear("amount");
              }}
              error={errors.amount} hint={amt ? `+ ${rupees(gstOn(amt))} GST = ${rupees(amt + gstOn(amt))}` : undefined} />
            <TextField
              label="Period starts"
              type="date"
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) setEnd(periodEndFor(e.target.value));
              }}
              error={errors.periodStart}
            />
            <TextField label="Period ends" type="date" value={end} min={start} onChange={(e) => {
                setEnd(e.target.value);
                clear("periodEnd");
              }}
              error={errors.periodEnd} hint="A shorter period shows as prorated." />
            <TextField label="Due on" type="date" value={dueOn} min={today} onChange={(e) => {
                setDueOn(e.target.value);
                clear("dueOn");
              }}
              error={errors.dueOn} />
          </div>
          <p className="text-[12.5px] text-muted">When the dealer&apos;s payment for this invoice is verified, their plan becomes this plan and is paid up to the period&apos;s end.</p>
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy} icon={busy ? spin : undefined}>
              Issue invoice
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function VoidInvoiceButton({ invoiceId, number }: { invoiceId: number; number: string }) {
  const router = useRouter();
  const { toast } = useUI();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    const res = await voidInvoiceAction(invoiceId, { reason }).catch(() => OFFLINE);
    setBusy(false);
    if (!res.ok) {
      setError(res.fieldErrors?.reason);
      return toast(res.error ?? "Couldn't void the invoice", { tone: "error" });
    }
    setOpen(false);
    toast(`Invoice ${number} voided`, { tone: "success" });
    router.refresh();
  };
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} icon={<Ban className="size-4" aria-hidden />}>
        Void
      </Button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title={`Void invoice ${number}?`} description="The dealer is notified and no payment will be due for it." size="sm">
        <div className="space-y-4 px-6 py-6 sm:px-8">
          <MessageBox id={`void-${invoiceId}`} label="Reason (shown to the dealer)" value={reason} onChange={(v) => { setReason(v); setError(undefined); }} error={error} rows={3} placeholder="e.g. Issued in error — replaced by MG/26-27/00012." />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="dark" onClick={submit} disabled={busy} icon={busy ? spin : undefined}>
              Void invoice
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
