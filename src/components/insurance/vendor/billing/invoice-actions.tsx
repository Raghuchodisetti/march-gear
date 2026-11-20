"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Printer, ReceiptText } from "lucide-react";
import type { ActionFailure } from "@/lib/action-result";
import type { FileRef } from "@/partner/types";
import { recordInsPaymentAction } from "@/server/actions/ins-billing";
import { useUI } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Segmented, TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { InsDocumentUploader } from "@/components/insurance/vendor/uploader";
import { useUploadWatch } from "@/components/insurance/vendor/support/upload-watch";
import { PAYMENT_METHOD_SHORT, UTR_LABEL, hasPaymentDetails, type PaymentDetails, type PaymentMethod } from "@/components/portal/billing/shared";
import { insInvoicePdf } from "./invoice-pdf";
import { INS_NO_PAYMENT_DETAILS, istDate, rupees, type InsInvoicePdfData } from "./shared";

const OFFLINE: ActionFailure = { ok: false, error: "Couldn't reach the server. Please try again." };

/** Download / print the branded PDF of an invoice (built in the browser with jsPDF). */
export function InsInvoicePdfButtons({ data }: { data: InsInvoicePdfData }) {
  const { toast } = useUI();
  const [busy, setBusy] = useState<"download" | "print" | null>(null);
  const run = async (mode: "download" | "print") => {
    setBusy(mode);
    try {
      await insInvoicePdf(data, mode);
    } catch (err) {
      console.error(err);
      toast("Couldn't build the PDF. Please try again.", { tone: "error" });
    } finally {
      setBusy(null);
    }
  };
  const spin = <Loader2 className="size-4 animate-spin" aria-hidden />;
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => run("print")} disabled={busy !== null} icon={busy === "print" ? spin : <Printer className="size-4" aria-hidden />}>
        Print
      </Button>
      <Button variant="dark" size="sm" onClick={() => run("download")} disabled={busy !== null} icon={busy === "download" ? spin : <Download className="size-4" aria-hidden />}>
        Download PDF
      </Button>
    </>
  );
}

/** "Record a payment" — the vendor's bank transfer / UPI / cheque reference, for MarchGear to verify. */
export function InsRecordPaymentButton({
  invoice,
  payment,
  size = "md",
  className,
}: {
  invoice: { id: number; number: string; total: number };
  payment: PaymentDetails;
  size?: "sm" | "md";
  className?: string;
}) {
  const router = useRouter();
  const { toast } = useUI();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [utr, setUtr] = useState("");
  const [paidOn, setPaidOn] = useState(istDate());
  const [amount, setAmount] = useState(String(invoice.total));
  const [proof, setProof] = useState<FileRef | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const { ref: proofRef, uploading: proofUploading } = useUploadWatch();
  const clear = (k: string) =>
    setErrors((e) => {
      if (!(k in e)) return e;
      const next = { ...e };
      delete next[k];
      return next;
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await recordInsPaymentAction({ invoiceId: invoice.id, method, utr, paidOn, amount, proofId: proof?.id ?? null }).catch(() => OFFLINE);
    setBusy(false);
    if (!res.ok) {
      setErrors(res.fieldErrors ?? {});
      return toast(res.error ?? "Couldn't record the payment", { tone: "error" });
    }
    setErrors({});
    setOpen(false);
    setUtr("");
    setProof(null);
    toast("Payment recorded — MarchGear will verify it against the bank statement.", { tone: "success" });
    router.refresh();
  };

  const short = Number(amount) > 0 && Number(amount) < invoice.total;
  return (
    <>
      <Button size={size} className={className} onClick={() => setOpen(true)} icon={<ReceiptText className="size-4" aria-hidden />}>
        Record a payment
      </Button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title="Record a payment" description={`Invoice ${invoice.number} · ${rupees(invoice.total)} incl. GST`} size="lg">
        <form onSubmit={submit} className="space-y-5 px-6 py-6 sm:px-8" noValidate>
          <div className="border-l-[3px] border-ink bg-[#F6F6F6] px-4 py-3 text-[13px] leading-relaxed text-muted">
            There&apos;s no online payment gateway. Pay by bank transfer, UPI or cheque
            {hasPaymentDetails(payment) ? " using the details on the invoice" : ` — ${INS_NO_PAYMENT_DETAILS.replace(/\.$/, "")}`}, then record it here.
            MarchGear&apos;s accounts team checks the reference against the bank statement and marks the invoice paid.
          </div>
          <div>
            <p className="mb-2 text-[12.5px] font-medium">How did you pay?</p>
            <Segmented
              ariaLabel="Payment method"
              className="w-full"
              value={method}
              onChange={(m) => {
                setMethod(m);
                clear("method");
              }}
              options={(["bank_transfer", "upi", "cheque"] as const).map((m) => ({ value: m, label: PAYMENT_METHOD_SHORT[m] }))}
            />
            {errors.method && <p className="mt-1.5 text-xs text-red">{errors.method}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={method === "bank_transfer" ? "UTR / reference" : UTR_LABEL[method]}
              value={utr}
              onChange={(e) => {
                setUtr(e.target.value);
                clear("utr");
              }}
              placeholder={method === "upi" ? "e.g. 432112345678" : method === "cheque" ? "e.g. 004512" : "e.g. HDFCR52026112012345"}
              error={errors.utr}
              hint={method === "cheque" ? "We'll verify once the cheque clears." : "From your bank's transaction confirmation."}
              autoComplete="off"
              data-autofocus
              maxLength={40}
            />
            <TextField
              label="Paid on"
              type="date"
              value={paidOn}
              max={istDate()}
              onChange={(e) => {
                setPaidOn(e.target.value);
                clear("paidOn");
              }}
              error={errors.paidOn}
            />
            <TextField
              label="Amount paid"
              inputMode="numeric"
              prefix="₹"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value.replace(/[^\d]/g, ""));
                clear("amount");
              }}
              error={errors.amount}
              hint={short ? `${rupees(invoice.total - Number(amount))} less than the invoice — e.g. TDS. Mention it in a support ticket if so.` : "Including GST."}
            />
          </div>
          <div ref={proofRef}>
            <InsDocumentUploader
            kind="payment_proof"
            value={proof}
            onChange={(f) => {
              setProof(f);
              clear("proof");
            }}
            label="Payment proof"
            hint="Screenshot or PDF of the transfer confirmation — helps us verify faster."
            error={errors.proof}
            />
          </div>
          {errors.invoiceId && <p className="text-xs text-red">{errors.invoiceId}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || proofUploading} icon={busy || proofUploading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : undefined}>
              {proofUploading ? "Uploading proof…" : "Submit for verification"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
