import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowUpRight, CheckCircle2, Clock3, Paperclip, RotateCcw, XCircle } from "lucide-react";
import { getDb } from "@/db";
import { insInvoices } from "@/db/schema";
import { formatDate } from "@/lib/format";
import { INVOICE_STATUS_LABEL, INVOICE_STATUS_TONE } from "@/insurance/labels";
import { requireInsurer } from "@/server/insurance/context";
import { getAdRefs, getInsBillingContent, getInsPayments, getInsPlans, getInsRefunds, insVendorParty, toInsInvoiceView } from "@/server/insurance/subscription";
import { Badge, Panel, PortalHeader, formatDateTime } from "@/components/portal/ui";
import { PAYMENT_METHOD_SHORT, sameState } from "@/components/portal/billing/shared";
import { InsInvoiceDocument } from "@/components/insurance/vendor/billing/invoice-document";
import { InsInvoicePdfButtons, InsRecordPaymentButton } from "@/components/insurance/vendor/billing/invoice-actions";
import { isPayable, istDate, rupees } from "@/components/insurance/vendor/billing/shared";

export const metadata: Metadata = { title: "Invoice" };

const fileHref = (f: { id: number }) => `/insurance-vendor/files/${f.id}`;

export default async function Page({ params }: PageProps<"/insurance-vendor/invoices/[id]">) {
  const ctx = await requireInsurer({ perm: "billing.manage" });
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const [row] = await getDb()
    .select()
    .from(insInvoices)
    .where(and(eq(insInvoices.id, Number(id)), eq(insInvoices.vendorId, ctx.vendor.id)));
  if (!row) notFound();
  const [plans, content, payments, refunds, ads, to] = await Promise.all([
    getInsPlans(),
    getInsBillingContent(),
    getInsPayments(ctx.vendor.id, row.id),
    getInsRefunds(ctx.vendor.id, row.id),
    getAdRefs(ctx.vendor.id, [row.adCampaignId]),
    insVendorParty(ctx.vendor),
  ]);
  const invoice = toInsInvoiceView(row, plans, ads, istDate());
  const state = to.state ?? "";
  const data = { invoice, from: content.marchGear, to, payment: content.payment, intraState: sameState(state, content.marchGearAddress), placeOfSupply: state };
  const payable = isPayable(invoice.display);
  const refunded = refunds.reduce((s, r) => s + r.refund.amount, 0);

  return (
    <>
      <PortalHeader
        back={{ href: "/insurance-vendor/invoices", label: "Invoices" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="break-all num">{invoice.number}</span>
            <span className="tracking-normal"><Badge tone={INVOICE_STATUS_TONE[invoice.display]}>{INVOICE_STATUS_LABEL[invoice.display]}</Badge></span>
          </span>
        }
        description={`${invoice.kindLabel} · ${rupees(invoice.total)} incl. GST · due ${formatDate(invoice.dueOn)}`}
        actions={<InsInvoicePdfButtons data={data} />}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <InsInvoiceDocument {...data} />

        <div className="min-w-0 space-y-6">
          <Panel title="Payment">
            {invoice.display === "paid" ? (
              <p className="flex gap-2.5 text-[14px]">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#1e7a3c]" aria-hidden />
                <span>Paid{invoice.paidAt ? ` — verified ${formatDateTime(invoice.paidAt)}` : ""}. Thank you.</span>
              </p>
            ) : invoice.display === "void" ? (
              <p className="text-[14px] text-muted">This invoice was cancelled. No payment is needed.</p>
            ) : invoice.display === "verifying" ? (
              <p className="flex gap-2.5 text-[14px]">
                <Clock3 className="mt-0.5 size-4 shrink-0 text-[#2456a6]" aria-hidden />
                <span>MarchGear&apos;s accounts team is checking your payment against the bank statement. You&apos;ll get a notification when it&apos;s verified.</span>
              </p>
            ) : (
              <div className="space-y-4">
                <p className="text-[14px] leading-relaxed">
                  {invoice.display === "overdue" ? (
                    <span className="font-medium text-red">This invoice was due on {formatDate(invoice.dueOn)}. </span>
                  ) : (
                    <span>Due on {formatDate(invoice.dueOn)}. </span>
                  )}
                  After paying by bank transfer, UPI or cheque, record the reference here.
                </p>
                <InsRecordPaymentButton invoice={invoice} payment={content.payment} className="w-full" />
              </div>
            )}
          </Panel>

          {invoice.kind === "advertising" && invoice.adCampaignId && (
            <Panel title="Advertising booking">
              <p className="text-[13.5px] leading-relaxed text-muted">
                This invoice is for {invoice.adCampaignRef ? <span className="font-medium text-ink num">{invoice.adCampaignRef}</span> : "an ad campaign"} — billed when MarchGear approved the booking.
              </p>
              <Link href={`/insurance-vendor/advertising/${invoice.adCampaignId}`} className="mt-3 inline-flex items-center gap-1 text-[13.5px] font-medium hover:text-red">
                Open the ad campaign <ArrowUpRight className="size-4" aria-hidden />
              </Link>
            </Panel>
          )}

          <Panel title="Payment history" padded={false}>
            {payments.length === 0 ? (
              <p className="px-5 py-6 text-[13.5px] text-muted">{payable ? "No payment recorded yet." : "None."}</p>
            ) : (
              <ol className="divide-y divide-line">
                {payments.map(({ payment: pm }) => (
                  <li key={pm.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[14px] font-semibold num">{rupees(pm.amount)}</p>
                      {pm.status === "verified" ? <Badge tone="green">Verified</Badge> : pm.status === "rejected" ? <Badge tone="red">Not verified</Badge> : <Badge tone="blue">Being verified</Badge>}
                    </div>
                    <p className="mt-1 break-words text-[12.5px] text-muted">
                      {PAYMENT_METHOD_SHORT[pm.method]} · ref <span className="break-all num">{pm.utr}</span> · <span className="whitespace-nowrap">paid {formatDate(pm.paidOn)}</span>
                    </p>
                    <p className="text-[12px] text-muted">Recorded {formatDateTime(pm.createdAt)}</p>
                    {pm.proof && (
                      <a href={fileHref(pm.proof)} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex max-w-full items-center gap-1 text-[12.5px] font-medium hover:text-red">
                        <Paperclip className="size-3.5 shrink-0" aria-hidden /> <span className="truncate">{pm.proof.filename}</span>
                      </a>
                    )}
                    {pm.remarks && (
                      <p className={pm.status === "rejected" ? "mt-2 flex gap-1.5 text-[13px] text-red" : "mt-2 text-[13px] text-muted"}>
                        {pm.status === "rejected" && <XCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
                        <span className="min-w-0 break-words">MarchGear: {pm.remarks}</span>
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          {refunds.length > 0 && (
            <Panel title={`Refunds · ${rupees(refunded)}`} padded={false}>
              <ol className="divide-y divide-line">
                {refunds.map(({ refund: r }) => (
                  <li key={r.id} className="px-5 py-4">
                    <p className="flex items-center gap-2 text-[14px] font-semibold num">
                      <RotateCcw className="size-3.5 text-muted" aria-hidden /> {rupees(r.amount)}
                    </p>
                    <p className="mt-1 break-words text-[12.5px] text-muted">
                      Ref <span className="break-all num">{r.reference}</span> · refunded {formatDate(r.refundedOn)}
                    </p>
                    <p className="mt-1 break-words text-[13px]">{r.reason}</p>
                  </li>
                ))}
              </ol>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
