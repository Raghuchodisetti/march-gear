"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Ban, CheckCircle2, ExternalLink, FilePlus2, Loader2, Lock, ReceiptText, Undo2, XCircle } from "lucide-react";
import type { ActionFailure } from "@/lib/action-result";
import type { FileRef } from "@/insurance/types";
import { cn } from "@/lib/utils";
import {
  createInsInvoiceAction,
  markInsInvoicePaidAction,
  recordInsRefundAction,
  rejectInsPaymentAction,
  verifyInsPaymentAction,
  voidInsInvoiceAction,
} from "@/server/actions/admin-insurance-billing";
import { useUI } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { MessageBox } from "@/components/portal/support/compose";
import { actionBtn, btnTone } from "@/components/admin/partner-actions";
import { addDays, gstOn, istDate, rupees } from "@/components/portal/billing/shared";
import { METHOD_LABEL, REF_LABEL, type Method } from "../ops/labels";

/* Client pieces of insurance vendor billing: payment review, manual payment, void, new invoice, refunds. */

const OFFLINE: ActionFailure = { ok: false, error: "Couldn't reach the server. Please try again." };
const spin = <Loader2 className="size-4 animate-spin" aria-hidden />;
const fmtDay = (d: string) => new Date(`${d}T00:00:00+05:30`).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });

function useErrors() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const clear = (k: string) =>
    setErrors((e) => {
      if (!(k in e)) return e;
      const next = { ...e };
      delete next[k];
      return next;
    });
  return { errors, setErrors, clear };
}

function Footer({ onCancel, busy, children }: { onCancel: () => void; busy: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
      <Button variant="ghost" onClick={onCancel} disabled={busy}>
        Cancel
      </Button>
      {children}
    </div>
  );
}

function AdminOnly({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <span title="Only MarchGear admins can do this" aria-disabled="true" className={cn(actionBtn, "cursor-not-allowed border-dashed border-line text-muted")}>
      {icon} {label} <Lock aria-hidden className="size-3.5" />
    </span>
  );
}

/* ── Payment review ─────────────────────────────────────────── */

export interface InsReviewPayment {
  id: number;
  amount: number;
  method: Method;
  utr: string;
  paidOn: string;
  proof: FileRef | null;
  submittedAt: string;
  vendor: string;
  invoice: { number: string; total: number; description: string; alreadyVerified: number; dueOn: string };
}

/** Open the proof, check the bank statement, then verify or reject with remarks. */
export function InsPaymentReview({ p, label = "Review" }: { p: InsReviewPayment; label?: string }) {
  const router = useRouter();
  const { toast } = useUI();
  const [open, setOpen] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<"verify" | "reject" | null>(null);
  const balanceBefore = p.invoice.total - p.invoice.alreadyVerified;
  const after = balanceBefore - p.amount;

  const decide = async (kind: "verify" | "reject") => {
    if (kind === "reject" && remarks.trim().length < 5) return setError("Tell the vendor why (at least 5 characters)");
    setBusy(kind);
    let message: string | null = null;
    if (kind === "verify") {
      const res = await verifyInsPaymentAction(p.id, { remarks: remarks || undefined }).catch(() => OFFLINE);
      if (res.ok) message = res.invoicePaid ? `Verified — invoice ${p.invoice.number} is paid` : `Verified — ${rupees(res.balance)} still due on ${p.invoice.number}`;
      else {
        setError(res.fieldErrors?.remarks);
        toast(res.error ?? (res.fieldErrors ? "Check the highlighted fields." : "Couldn't save the decision"), { tone: "error" });
      }
    } else {
      const res = await rejectInsPaymentAction(p.id, { remarks }).catch(() => OFFLINE);
      if (res.ok) message = "Payment rejected — the vendor has been told why";
      else {
        setError(res.fieldErrors?.remarks);
        toast(res.error ?? (res.fieldErrors ? "Check the highlighted fields." : "Couldn't save the decision"), { tone: "error" });
      }
    }
    setBusy(null);
    if (!message) return;
    setOpen(false);
    toast(message, { tone: "success" });
    router.refresh();
  };

  return (
    <>
      <Button size="sm" variant="dark" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title="Review payment" description={`${p.vendor} · invoice ${p.invoice.number}`} size="lg">
        <div className="space-y-5 px-6 py-6 sm:px-8">
          <dl className="grid grid-cols-2 gap-px overflow-hidden border border-line bg-line sm:grid-cols-3">
            {[
              ["Amount paid", rupees(p.amount)],
              ["Invoice total", rupees(p.invoice.total)],
              ["Already verified", rupees(p.invoice.alreadyVerified)],
              ["Method", METHOD_LABEL[p.method]],
              [REF_LABEL[p.method], p.utr],
              ["Paid on", fmtDay(p.paidOn)],
            ].map(([k, v]) => (
              <div key={k} className="min-w-0 bg-white px-4 py-3">
                <dt className="text-[11.5px] text-muted">{k}</dt>
                <dd className="mt-0.5 break-all text-[14px] font-semibold num">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[13px] text-muted">
            {p.invoice.description} · due {fmtDay(p.invoice.dueOn)} · recorded {p.submittedAt}
          </p>
          {after !== 0 && (
            <p className="flex gap-2 border-l-[3px] border-[#9a5b00] bg-[#fdf3e1] px-4 py-3 text-[13px] text-[#6b4000]">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {after > 0
                ? `${rupees(after)} less than the balance due. Verifying records this part-payment and the invoice goes back to due for ${rupees(after)}.`
                : `${rupees(-after)} more than the balance due. Verifying marks the invoice paid; record a refund for the excess if you return it.`}
            </p>
          )}
          {p.proof ? (
            <a href={`/insurance-vendor/files/${p.proof.id}`} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 border border-line px-4 py-3 text-[13.5px] transition-colors hover:border-ink">
              <span className="min-w-0 truncate font-medium">{p.proof.filename}</span>
              <span className="inline-flex shrink-0 items-center gap-1 text-red">
                Open proof <ExternalLink className="size-3.5" aria-hidden />
              </span>
            </a>
          ) : (
            <p className="text-[13px] text-muted">No proof was uploaded — check the reference against the bank statement.</p>
          )}
          <MessageBox
            id={`ins-pay-remarks-${p.id}`}
            label="Remarks (required to reject, shown to the vendor)"
            value={remarks}
            onChange={(v) => {
              setRemarks(v);
              setError(undefined);
            }}
            error={error}
            rows={3}
            placeholder="e.g. No credit found for this UTR on 18 Nov — please check the reference."
          />
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => decide("reject")} disabled={busy !== null} icon={busy === "reject" ? spin : <XCircle className="size-4" aria-hidden />}>
              Reject
            </Button>
            <Button onClick={() => decide("verify")} disabled={busy !== null} icon={busy === "verify" ? spin : <CheckCircle2 className="size-4" aria-hidden />}>
              Verify payment
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ── Mark paid manually ─────────────────────────────────────── */

export function MarkPaidButton({ invoiceId, number, balance }: { invoiceId: number; number: string; balance: number }) {
  const router = useRouter();
  const { toast } = useUI();
  const today = istDate();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<Method>("bank_transfer");
  const [utr, setUtr] = useState("");
  const [paidOn, setPaidOn] = useState(today);
  const [remarks, setRemarks] = useState("");
  const { errors, setErrors, clear } = useErrors();
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await markInsInvoicePaidAction(invoiceId, { method, utr, paidOn, remarks: remarks || undefined }).catch(() => OFFLINE);
    setBusy(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      return toast(res.error ?? (res.fieldErrors ? "Check the highlighted fields." : "Couldn't record the payment"), { tone: "error" });
    }
    setOpen(false);
    toast(`Invoice ${number} marked paid — the vendor has been notified`, { tone: "success" });
    router.refresh();
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn(actionBtn, btnTone.outline)}>
        <ReceiptText className="size-4" aria-hidden /> Mark paid
      </button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title={`Mark ${number} paid`} description="For money that reached MarchGear without the vendor recording it. Records a verified payment for the balance." size="md">
        <form onSubmit={submit} noValidate className="space-y-4 px-6 py-6 sm:px-8">
          <p className="border border-line bg-mist/50 px-4 py-3 text-[13.5px]">
            Balance to record: <span className="font-semibold num">{rupees(balance)}</span>
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Paid by" value={method} onChange={(e) => setMethod(e.target.value as Method)} options={(Object.keys(METHOD_LABEL) as Method[]).map((m) => ({ value: m, label: METHOD_LABEL[m] }))} error={errors.method} />
            <TextField
              label="Paid on"
              type="date"
              max={today}
              value={paidOn}
              onChange={(e) => {
                setPaidOn(e.target.value);
                clear("paidOn");
              }}
              error={errors.paidOn}
            />
          </div>
          <TextField
            label={REF_LABEL[method]}
            value={utr}
            onChange={(e) => {
              setUtr(e.target.value.toUpperCase());
              clear("utr");
            }}
            error={errors.utr}
            maxLength={40}
            placeholder="As it appears on the bank statement"
            data-autofocus
          />
          <MessageBox id={`mark-paid-${invoiceId}`} label="Remarks (optional, shown to the vendor)" value={remarks} onChange={setRemarks} error={errors.remarks} rows={2} />
          <Footer onCancel={() => setOpen(false)} busy={busy}>
            <Button type="submit" disabled={busy} icon={busy ? spin : <CheckCircle2 className="size-4" aria-hidden />}>
              Record payment
            </Button>
          </Footer>
        </form>
      </Modal>
    </>
  );
}

/* ── Void ───────────────────────────────────────────────────── */

export function VoidInsInvoiceButton({ invoiceId, number, isAdmin }: { invoiceId: number; number: string; isAdmin: boolean }) {
  const router = useRouter();
  const { toast } = useUI();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  if (!isAdmin) return <AdminOnly label="Void" icon={<Ban className="size-4" aria-hidden />} />;
  const submit = async () => {
    setBusy(true);
    const res = await voidInsInvoiceAction(invoiceId, { reason }).catch(() => OFFLINE);
    setBusy(false);
    if (!res.ok) {
      setError(res.fieldErrors?.reason);
      return toast(res.error ?? (res.fieldErrors ? "Check the highlighted fields." : "Couldn't void the invoice"), { tone: "error" });
    }
    setOpen(false);
    toast(`Invoice ${number} voided — the vendor has been notified`, { tone: "success" });
    router.refresh();
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn(actionBtn, btnTone.danger)}>
        <Ban className="size-4" aria-hidden /> Void
      </button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title={`Void invoice ${number}?`} description="The vendor is notified and nothing is due for it. Only unpaid invoices with no verified payment can be voided." size="sm">
        <div className="space-y-4 px-6 py-6 sm:px-8">
          <MessageBox
            id={`void-ins-${invoiceId}`}
            label="Reason (shown to the vendor)"
            value={reason}
            onChange={(v) => {
              setReason(v);
              setError(undefined);
            }}
            error={error}
            rows={3}
            placeholder="e.g. Raised in error — replaced by MGI/26-27/00012."
          />
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

/* ── New manual invoice ─────────────────────────────────────── */

export function CreateInvoiceButton({
  vendors,
  leadFeeEnabled,
  leadFeeAmount,
  paymentTermsDays,
  defaultVendor,
}: {
  vendors: { value: string; label: string }[];
  leadFeeEnabled: boolean;
  leadFeeAmount: number;
  paymentTermsDays: number;
  defaultVendor?: string;
}) {
  const router = useRouter();
  const { toast } = useUI();
  const today = istDate();
  const [open, setOpen] = useState(false);
  const [vendorId, setVendorId] = useState(defaultVendor && vendors.some((v) => v.value === defaultVendor) ? defaultVendor : "");
  const [kind, setKind] = useState<"other" | "lead_fee">("other");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [amount, setAmount] = useState("");
  const [dueOn, setDueOn] = useState(addDays(today, paymentTermsDays));
  const { errors, setErrors, clear } = useErrors();
  const [busy, setBusy] = useState(false);
  const amt = Number(amount) || 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await createInsInvoiceAction({ vendorId, kind, description, periodStart: start, periodEnd: end, amount, dueOn }).catch(() => OFFLINE);
    setBusy(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      return toast(res.error ?? (res.fieldErrors ? "Check the highlighted fields." : "Couldn't create the invoice"), { tone: "error" });
    }
    const r = res as { id: number; number: string };
    setErrors({});
    setOpen(false);
    setDescription("");
    setAmount("");
    toast(`Invoice ${r.number} raised — the vendor has been notified`, { tone: "success", action: { label: "Open", href: `/admin/insurance/invoices/${r.id}` } });
    router.refresh();
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} icon={<FilePlus2 className="size-4" aria-hidden />} disabled={!vendors.length} title={vendors.length ? undefined : "No approved vendors yet"}>
        New invoice
      </Button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title="Raise an invoice" description="A one-off charge for a vendor. Subscription and advertising invoices are raised automatically." size="lg">
        <form onSubmit={submit} className="space-y-4 px-6 py-6 sm:px-8" noValidate>
          <SelectField
            label="Vendor"
            value={vendorId}
            onChange={(e) => {
              setVendorId(e.target.value);
              clear("vendorId");
            }}
            placeholder="Choose a vendor"
            options={vendors}
            error={errors.vendorId}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Invoice for"
              value={kind}
              onChange={(e) => {
                const k = e.target.value as "other" | "lead_fee";
                setKind(k);
                clear("kind");
                if (k === "lead_fee" && !amount && leadFeeAmount) setAmount(String(leadFeeAmount));
              }}
              options={[
                { value: "other", label: "Other charge" },
                { value: "lead_fee", label: leadFeeEnabled ? "Lead fee" : "Lead fee (switched off in settings)" },
              ]}
              error={errors.kind}
            />
            <TextField
              label="Amount before GST"
              prefix="₹"
              inputMode="numeric"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value.replace(/[^\d]/g, ""));
                clear("amount");
              }}
              error={errors.amount}
              hint={amt ? `+ ${rupees(gstOn(amt))} GST = ${rupees(amt + gstOn(amt))}` : "18% GST is added"}
            />
          </div>
          <TextField
            label="Description (printed on the invoice)"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              clear("description");
            }}
            error={errors.description}
            maxLength={300}
            placeholder={kind === "lead_fee" ? "e.g. Lead fees — 4 verified conversions, October 2026" : "e.g. Featured placement setup fee"}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              label="Period starts"
              type="date"
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                if (end < e.target.value) setEnd(e.target.value);
                clear("periodStart");
              }}
              error={errors.periodStart}
            />
            <TextField
              label="Period ends"
              type="date"
              min={start}
              value={end}
              onChange={(e) => {
                setEnd(e.target.value);
                clear("periodEnd");
              }}
              error={errors.periodEnd}
            />
            <TextField
              label="Due on"
              type="date"
              min={today}
              value={dueOn}
              onChange={(e) => {
                setDueOn(e.target.value);
                clear("dueOn");
              }}
              error={errors.dueOn}
              hint={`Default: ${paymentTermsDays}-day terms`}
            />
          </div>
          <Footer onCancel={() => setOpen(false)} busy={busy}>
            <Button type="submit" disabled={busy} icon={busy ? spin : undefined}>
              Raise invoice
            </Button>
          </Footer>
        </form>
      </Modal>
    </>
  );
}

/* ── Refunds ────────────────────────────────────────────────── */

export interface RefundableInvoice {
  id: number;
  number: string;
  vendor: string;
  total: number;
  verified: number;
  refunded: number;
  refundable: number;
}

export function RecordRefundButton({ invoices, isAdmin, defaultInvoice, size = "sm" }: { invoices: RefundableInvoice[]; isAdmin: boolean; defaultInvoice?: number; size?: "sm" | "inline" }) {
  const router = useRouter();
  const { toast } = useUI();
  const today = istDate();
  const [open, setOpen] = useState(false);
  const [invoiceId, setInvoiceId] = useState(defaultInvoice && invoices.some((i) => i.id === defaultInvoice) ? String(defaultInvoice) : invoices.length === 1 ? String(invoices[0].id) : "");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [refundedOn, setRefundedOn] = useState(today);
  const { errors, setErrors, clear } = useErrors();
  const [busy, setBusy] = useState(false);
  const inv = invoices.find((i) => String(i.id) === invoiceId);

  if (!isAdmin) return <AdminOnly label="Record refund" icon={<Undo2 className="size-4" aria-hidden />} />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await recordInsRefundAction({ invoiceId, amount, reason, reference, refundedOn }).catch(() => OFFLINE);
    setBusy(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      return toast(res.error ?? (res.fieldErrors ? "Check the highlighted fields." : "Couldn't record the refund"), { tone: "error" });
    }
    setOpen(false);
    setAmount("");
    setReason("");
    setReference("");
    setErrors({});
    toast(`Refund of ${rupees(Number(amount))} recorded — the vendor has been notified`, { tone: "success" });
    router.refresh();
  };

  return (
    <>
      {size === "sm" ? (
        <Button size="sm" variant="dark" onClick={() => setOpen(true)} icon={<Undo2 className="size-4" aria-hidden />} disabled={!invoices.length} title={invoices.length ? undefined : "No paid invoice has money left to refund"}>
          Record refund
        </Button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} disabled={!invoices.length} className={cn(actionBtn, btnTone.outline)}>
          <Undo2 className="size-4" aria-hidden /> Record refund
        </button>
      )}
      <Modal open={open} onClose={() => !busy && setOpen(false)} title="Record a refund" description="For money MarchGear has already paid back by bank transfer or UPI. There's no gateway — this only records it." size="lg">
        <form onSubmit={submit} noValidate className="space-y-4 px-6 py-6 sm:px-8">
          <SelectField
            label="Paid invoice"
            value={invoiceId}
            onChange={(e) => {
              setInvoiceId(e.target.value);
              clear("invoiceId");
              clear("amount");
            }}
            placeholder="Choose a paid invoice"
            options={invoices.map((i) => ({ value: String(i.id), label: `${i.number} · ${i.vendor} · up to ${rupees(i.refundable)}` }))}
            error={errors.invoiceId}
          />
          {inv && (
            <dl className="grid grid-cols-2 gap-px overflow-hidden border border-line bg-line sm:grid-cols-4">
              {[
                ["Invoice total", rupees(inv.total)],
                ["Verified payments", rupees(inv.verified)],
                ["Refunded before", rupees(inv.refunded)],
                ["Can refund", rupees(inv.refundable)],
              ].map(([k, v]) => (
                <div key={k} className="bg-white px-3.5 py-2.5">
                  <dt className="text-[11.5px] text-muted">{k}</dt>
                  <dd className="mt-0.5 text-[13.5px] font-semibold num">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Amount refunded"
              prefix="₹"
              inputMode="numeric"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value.replace(/[^\d]/g, ""));
                clear("amount");
              }}
              error={errors.amount}
              hint={inv ? `At most ${rupees(inv.refundable)}, incl. GST` : undefined}
            />
            <TextField
              label="Refunded on"
              type="date"
              max={today}
              value={refundedOn}
              onChange={(e) => {
                setRefundedOn(e.target.value);
                clear("refundedOn");
              }}
              error={errors.refundedOn}
            />
          </div>
          <TextField
            label="Refund reference (bank UTR / UPI ID)"
            value={reference}
            onChange={(e) => {
              setReference(e.target.value.toUpperCase());
              clear("reference");
            }}
            error={errors.reference}
            maxLength={60}
          />
          <MessageBox
            id="refund-reason"
            label="Reason (shown to the vendor)"
            value={reason}
            onChange={(v) => {
              setReason(v);
              clear("reason");
            }}
            error={errors.reason}
            rows={3}
            placeholder="e.g. Campaign cancelled before it started — unused days refunded."
          />
          <Footer onCancel={() => setOpen(false)} busy={busy}>
            <Button type="submit" disabled={busy} icon={busy ? spin : <Undo2 className="size-4" aria-hidden />}>
              Record refund
            </Button>
          </Footer>
        </form>
      </Modal>
    </>
  );
}
