import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatDate } from "@/lib/format";
import { INVOICE_STATUS_LABEL, INVOICE_STATUS_TONE } from "@/insurance/labels";
import { Badge } from "@/components/portal/ui";
import { amountInWords, gstSplit, hasPaymentDetails, type BillingParty } from "@/components/portal/billing/shared";
import { INS_NO_PAYMENT_DETAILS, istDate, rupees, type InsInvoicePdfData } from "./shared";
import { cn } from "@/lib/utils";

/* An insurance vendor invoice as a printed page — the same content as the PDF. Server-safe. */

function Party({ title, party }: { title: string; party: BillingParty }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{title}</p>
      <p className="mt-2 text-[15px] font-semibold leading-snug">{party.name}</p>
      <div className="mt-1 space-y-0.5 text-[13px] leading-relaxed text-muted">
        {party.lines.map((l) => (
          <p key={l} className="break-words">
            {l}
          </p>
        ))}
        {party.gst && <p className="num">GSTIN {party.gst}</p>}
      </div>
    </div>
  );
}

export function InsInvoiceDocument({ invoice: inv, from, to, payment, intraState, placeOfSupply }: InsInvoicePdfData) {
  const split = gstSplit(inv.gst, intraState);
  const open = inv.display !== "paid" && inv.display !== "void";
  const period = `${formatDate(inv.periodStart)} – ${formatDate(inv.periodEnd)}`;
  return (
    <article className="min-w-0 overflow-hidden border border-line bg-white">
      <header className="flex flex-wrap items-center justify-between gap-4 bg-ink px-6 py-5 text-white sm:px-8">
        <p className="font-display text-[20px] tracking-[-0.02em]">
          <span className="font-semibold">March</span>Gear
          <span className="ml-2 rounded-[3px] border border-white/60 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-[0.08em]">Insurance</span>
        </p>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">Invoice</p>
          <p className="text-[15px] font-semibold num">{inv.number}</p>
        </div>
      </header>
      <div className="h-[3px] bg-red" />

      <div className="space-y-8 p-5 sm:p-8">
        <div className="flex flex-col-reverse items-start justify-between gap-4 sm:flex-row">
          <div className="grid w-full flex-1 gap-6 sm:grid-cols-2">
            <Party title="From" party={from} />
            <Party title="Billed to" party={to} />
          </div>
          <Badge tone={INVOICE_STATUS_TONE[inv.display]}>{INVOICE_STATUS_LABEL[inv.display]}</Badge>
        </div>

        {/* The invoice number never wraps: full width on phones, its own auto-sized column from sm up. */}
        <dl className="grid grid-cols-2 gap-px overflow-hidden border border-line bg-line sm:grid-cols-[auto_repeat(3,minmax(0,1fr))]">
          {[
            ["Invoice no.", inv.number, true],
            ["Issued", formatDate(inv.issuedOn), false],
            ["Due", formatDate(inv.dueOn), false],
            ["Place of supply", placeOfSupply || "—", true],
          ].map(([k, v, wide]) => (
            <div key={String(k)} className={cn("min-w-0 bg-[#F6F6F6] px-4 py-3", wide && "col-span-2 sm:col-span-1")}>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{k}</dt>
              <dd className={cn("mt-1 text-[13.5px] font-semibold num", k === "Invoice no." ? "whitespace-nowrap" : "break-words")}>{v}</dd>
            </div>
          ))}
        </dl>

        <div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-y border-ink py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted sm:grid-cols-[minmax(0,1fr)_200px_120px]">
            <span>Description</span>
            <span className="hidden sm:block">Period</span>
            <span className="text-right">Amount</span>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-line py-4 sm:grid-cols-[minmax(0,1fr)_200px_120px]">
            <div className="min-w-0">
              <p className="break-words text-[14px] font-medium">{inv.line}</p>
              <p className="mt-0.5 break-words text-[12.5px] text-muted">{inv.detail}</p>
              {inv.kind === "advertising" && inv.adCampaignId && (
                <Link href={`/insurance-vendor/advertising/${inv.adCampaignId}`} className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-medium text-ink underline-offset-4 hover:text-red hover:underline print:hidden">
                  View ad campaign{inv.adCampaignRef ? ` ${inv.adCampaignRef}` : ""} <ArrowUpRight className="size-3.5" aria-hidden />
                </Link>
              )}
              <p className="mt-0.5 text-[12.5px] text-muted sm:hidden">{period}</p>
            </div>
            <p className="hidden text-[13.5px] text-muted sm:block">{period}</p>
            <p className="text-right text-[14px] font-medium num">{rupees(inv.amount)}</p>
          </div>

          <dl className="ml-auto mt-4 max-w-xs space-y-2 text-[13.5px]">
            <div className="flex justify-between gap-6">
              <dt className="text-muted">Subtotal</dt>
              <dd className="num">{rupees(inv.amount)}</dd>
            </div>
            {split.intraState ? (
              <>
                <div className="flex justify-between gap-6">
                  <dt className="text-muted">CGST @ 9%</dt>
                  <dd className="num">{rupees(split.cgst)}</dd>
                </div>
                <div className="flex justify-between gap-6">
                  <dt className="text-muted">SGST @ 9%</dt>
                  <dd className="num">{rupees(split.sgst)}</dd>
                </div>
              </>
            ) : (
              <div className="flex justify-between gap-6">
                <dt className="text-muted">IGST @ 18%</dt>
                <dd className="num">{rupees(split.igst)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-6 border-t border-ink pt-2.5 text-[16px] font-semibold">
              <dt>Total</dt>
              <dd className="num">{rupees(inv.total)}</dd>
            </div>
            <p className="text-right text-[12px] text-muted">{amountInWords(inv.total)}</p>
            {inv.paidAt && <p className="text-right text-[12.5px] font-semibold text-[#1e7a3c]">Paid on {formatDate(istDate(inv.paidAt))}</p>}
          </dl>
        </div>

        {open && (
          <section className="border-l-[3px] border-red bg-[#F6F6F6] px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">How to pay</p>
            {hasPaymentDetails(payment) ? (
              <dl className="mt-2 grid gap-x-8 gap-y-1.5 text-[13.5px] sm:grid-cols-2">
                {(
                  [
                    ["Account name", payment.accountName],
                    ["Bank", payment.bankName],
                    ["Account number", payment.accountNumber],
                    ["IFSC", payment.ifsc],
                    ["UPI", payment.upi],
                  ] as const
                )
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k} className="flex min-w-0 flex-wrap gap-x-2">
                      <dt className="text-muted">{k}</dt>
                      <dd className="break-all font-medium num">{v}</dd>
                    </div>
                  ))}
              </dl>
            ) : (
              <p className="mt-2 text-[13.5px] font-medium">{INS_NO_PAYMENT_DETAILS}</p>
            )}
            {payment.instructions && <p className="mt-2 text-[13px] text-muted">{payment.instructions}</p>}
            <p className="mt-2 text-[12.5px] text-muted">
              Quote <span className="font-medium text-ink num">{inv.number}</span> as the reference. There&apos;s no online payment gateway — pay by bank transfer, UPI or cheque, then record the
              UTR / transaction ID so MarchGear can verify it.
            </p>
          </section>
        )}
        <p className="text-[11.5px] text-muted">Computer-generated invoice from the MarchGear insurance vendor portal. Amounts in Indian rupees; GST at 18%.</p>
      </div>
    </article>
  );
}
