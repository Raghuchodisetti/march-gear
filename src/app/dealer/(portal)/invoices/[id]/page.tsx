import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { CheckCircle2, Clock3, Paperclip, XCircle } from "lucide-react";
import { getDb } from "@/db";
import { partnerInvoices, partnerPayments } from "@/db/schema";
import { formatDate } from "@/lib/format";
import { INVOICE_STATUS_LABEL, INVOICE_STATUS_TONE } from "@/partner/labels";
import { requirePartner } from "@/server/partner/context";
import { dealerParty, getBillingContent, getPlans, toInvoiceView } from "@/server/partner/billing";
import { Badge, Panel, PortalHeader, formatDateTime } from "@/components/portal/ui";
import { fileHref } from "@/components/portal/support/shared";
import { InvoiceDocument } from "@/components/portal/billing/invoice-document";
import { InvoicePdfButtons, RecordPaymentButton } from "@/components/portal/billing/invoice-actions";
import { PAYMENT_METHOD_SHORT, istDate, rupees, sameState } from "@/components/portal/billing/shared";

export const metadata: Metadata = { title: "Invoice" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePartner({ perm: "billing.manage" });
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const db = getDb();
  const [row] = await db.select().from(partnerInvoices).where(and(eq(partnerInvoices.id, Number(id)), eq(partnerInvoices.partnerId, ctx.partner.id)));
  if (!row) notFound();
  const [plans, content, payments] = await Promise.all([
    getPlans(),
    getBillingContent(),
    db.select().from(partnerPayments).where(and(eq(partnerPayments.invoiceId, row.id), eq(partnerPayments.partnerId, ctx.partner.id))).orderBy(desc(partnerPayments.createdAt)),
  ]);
  const invoice = toInvoiceView(row, plans, istDate());
  const to = await dealerParty(ctx.partner);
  const state = to.state ?? "";
  const data = { invoice, from: content.marchGear, to, payment: content.payment, intraState: sameState(state, content.marchGearAddress), placeOfSupply: state };
  const payable = invoice.display === "due" || invoice.display === "overdue";

  return (
    <>
      <PortalHeader
        back={{ href: "/dealer/invoices", label: "Invoices & payments" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="num">{invoice.number}</span>
            <Badge tone={INVOICE_STATUS_TONE[invoice.display]}>{INVOICE_STATUS_LABEL[invoice.display]}</Badge>
          </span>
        }
        description={`${invoice.line} · ${rupees(invoice.total)} incl. GST · due ${formatDate(invoice.dueOn)}`}
        actions={<InvoicePdfButtons data={data} />}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <InvoiceDocument {...data} />

        <div className="space-y-6">
          <Panel title="Payment">
            {invoice.display === "paid" ? (
              <p className="flex gap-2.5 text-[14px]">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#1e7a3c]" aria-hidden />
                <span>
                  Paid{invoice.paidAt ? ` — verified ${formatDateTime(invoice.paidAt)}` : ""}. Thank you.
                </span>
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
                <RecordPaymentButton invoice={invoice} payment={content.payment} className="w-full" />
              </div>
            )}
          </Panel>

          <Panel title="Payments recorded" padded={false}>
            {payments.length === 0 ? (
              <p className="px-5 py-6 text-[13.5px] text-muted">{payable ? "No payment recorded yet." : "None."}</p>
            ) : (
              <ol className="divide-y divide-line">
                {payments.map((pm) => (
                  <li key={pm.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[14px] font-semibold num">{rupees(pm.amount)}</p>
                      {pm.status === "verified" ? (
                        <Badge tone="green">Verified</Badge>
                      ) : pm.status === "rejected" ? (
                        <Badge tone="red">Not verified</Badge>
                      ) : (
                        <Badge tone="blue">Being verified</Badge>
                      )}
                    </div>
                    <p className="mt-1 break-words text-[12.5px] text-muted">
                      {PAYMENT_METHOD_SHORT[pm.method]} · ref <span className="break-all num">{pm.utr}</span> · <span className="whitespace-nowrap">paid {formatDate(pm.paidOn)}</span>
                    </p>
                    <p className="text-[12px] text-muted">Recorded {formatDateTime(pm.createdAt)}</p>
                    {pm.proof && (
                      <a href={fileHref(pm.proof)} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-medium hover:text-red">
                        <Paperclip className="size-3.5" aria-hidden /> {pm.proof.filename}
                      </a>
                    )}
                    {pm.remarks && (
                      <p className={pm.status === "rejected" ? "mt-2 flex gap-1.5 text-[13px] text-red" : "mt-2 text-[13px] text-muted"}>
                        {pm.status === "rejected" && <XCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
                        MarchGear: {pm.remarks}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
