import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, CreditCard, FileText, Paperclip } from "lucide-react";
import { formatDate } from "@/lib/format";
import { INVOICE_STATUS_LABEL, INVOICE_STATUS_TONE, PAYMENT_STATUS_LABEL } from "@/partner/labels";
import { requirePartner } from "@/server/partner/context";
import { ensureBillingState, getBillingContent, getInvoices, getPayments, getPlans, toInvoiceView } from "@/server/partner/billing";
import { Badge, EmptyRow, Panel, PortalHeader, StatCard, Table, Td, Th, formatDateTime } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { fileHref } from "@/components/portal/support/shared";
import { RecordPaymentButton } from "@/components/portal/billing/invoice-actions";
import { NO_PAYMENT_DETAILS, PAYMENT_METHOD_SHORT, PAYMENT_STATUS_TONE, hasPaymentDetails, istDate, rupees } from "@/components/portal/billing/shared";

export const metadata: Metadata = { title: "Invoices & payments" };

export default async function Page() {
  const ctx = await requirePartner({ perm: "billing.manage" });
  await ensureBillingState(ctx.partner.id);
  const [rows, payments, plans, content] = await Promise.all([getInvoices(ctx.partner.id), getPayments(ctx.partner.id), getPlans(), getBillingContent()]);
  const today = istDate();
  const invoices = rows.map((r) => toInvoiceView(r, plans, today));
  const unpaid = invoices.filter((i) => i.display === "due" || i.display === "overdue");
  const overdue = invoices.filter((i) => i.display === "overdue");
  const verifying = invoices.filter((i) => i.display === "verifying");
  const fyStart = `${Number(today.slice(5, 7)) >= 4 ? today.slice(0, 4) : Number(today.slice(0, 4)) - 1}-04-01`;
  const paidThisYear = invoices.filter((i) => i.display === "paid" && i.paidAt && istDate(i.paidAt) >= fyStart).reduce((s, i) => s + i.total, 0);
  const pay = content.payment;

  return (
    <>
      <PortalHeader
        title="Invoices & payments"
        description="Subscription invoices from MarchGear, and the payments you've recorded against them."
        actions={
          <Button href="/dealer/subscriptions" variant="outline" size="sm" icon={<CreditCard className="size-4" aria-hidden />}>
            Subscription
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Outstanding" value={rupees(unpaid.reduce((s, i) => s + i.total, 0))} note={`${unpaid.length} unpaid invoice${unpaid.length === 1 ? "" : "s"}`} tone={unpaid.length ? "red" : undefined} />
        <StatCard label="Overdue" value={overdue.length} note={overdue.length ? `Oldest due ${formatDate(overdue[overdue.length - 1].dueOn)}` : "Nothing overdue"} />
        <StatCard label="Being verified" value={verifying.length} note="Payments MarchGear is checking" />
        <StatCard label="Paid this financial year" value={rupees(paidThisYear)} note={`Since ${formatDate(fyStart)}`} />
      </div>

      <section className="mt-6 grid gap-4 border border-line bg-white p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:p-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">How to pay</p>
          <p className="mt-2 text-[14px] leading-relaxed">
            There&apos;s no online payment gateway. Pay each invoice by <strong className="font-semibold">bank transfer, UPI or cheque</strong>, quoting the invoice number, then use{" "}
            <em className="not-italic font-medium">Record a payment</em> with your UTR or transaction ID. MarchGear&apos;s accounts team verifies it against the bank statement and marks the invoice paid.
          </p>
        </div>
        <div className="border-t border-line pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
          {hasPaymentDetails(pay) ? (
            <dl className="grid gap-x-6 gap-y-2 text-[13.5px] sm:grid-cols-2">
              {(
                [
                  ["Account name", pay.accountName],
                  ["Bank", pay.bankName],
                  ["Account number", pay.accountNumber],
                  ["IFSC", pay.ifsc],
                  ["UPI ID", pay.upi],
                ] as const
              )
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <dt className="text-[12px] text-muted">{k}</dt>
                    <dd className="font-medium break-all num">{v}</dd>
                  </div>
                ))}
              {pay.instructions && <p className="text-[12.5px] text-muted sm:col-span-2">{pay.instructions}</p>}
            </dl>
          ) : (
            <div className="flex h-full items-center gap-3 text-[14px]">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[#F6F6F6]">
                <FileText className="size-4" aria-hidden />
              </span>
              <p>
                <span className="font-medium">{NO_PAYMENT_DETAILS}</span>
                <span className="block text-[12.5px] text-muted">Bank and UPI details will appear here and on your invoices once MarchGear adds them.</span>
              </p>
            </div>
          )}
        </div>
      </section>

      <h2 className="mb-3 mt-10 text-[15px] font-semibold">Invoices</h2>
      {/* Phone: cards */}
      <ul className="space-y-3 md:hidden">
        {invoices.length === 0 && <li className="border border-line bg-white px-5 py-10 text-center text-[14px] text-muted">No invoices yet. Your first one is issued when your free trial ends.</li>}
        {invoices.map((i) => (
          <li key={i.id} className="border border-line bg-white">
            <Link href={`/dealer/invoices/${i.id}`} className="block p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold num">{i.number}</p>
                  <p className="mt-0.5 text-[12.5px] text-muted">{i.line}</p>
                </div>
                <Badge tone={INVOICE_STATUS_TONE[i.display]}>{INVOICE_STATUS_LABEL[i.display]}</Badge>
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <p className="text-[12.5px] text-muted">
                  {formatDate(i.periodStart)} – {formatDate(i.periodEnd)}
                  <span className={i.display === "overdue" ? "block font-medium text-red" : "block"}>Due {formatDate(i.dueOn)}</span>
                </p>
                <p className="text-[16px] font-semibold num">{rupees(i.total)}</p>
              </div>
            </Link>
            {(i.display === "due" || i.display === "overdue") && (
              <div className="border-t border-line p-3">
                <RecordPaymentButton invoice={i} payment={pay} size="sm" className="w-full" />
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="hidden md:block">
        <Table>
          <thead>
            <tr>
              <Th>Invoice</Th>
              <Th>Period</Th>
              <Th>Issued</Th>
              <Th>Due</Th>
              <Th className="text-right">Total</Th>
              <Th>Status</Th>
              <Th className="relative text-right">
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && <EmptyRow colSpan={7}>No invoices yet. Your first one is issued when your free trial ends.</EmptyRow>}
            {invoices.map((i) => (
              <tr key={i.id} className="transition-colors hover:bg-[#FAFAFA]">
                <Td>
                  <Link href={`/dealer/invoices/${i.id}`} className="font-semibold num hover:text-red">
                    {i.number}
                  </Link>
                  <p className="mt-0.5 text-[12px] text-muted">{i.line}</p>
                </Td>
                <Td className="whitespace-nowrap text-muted">
                  {formatDate(i.periodStart)} – {formatDate(i.periodEnd)}
                </Td>
                <Td className="whitespace-nowrap text-muted">{formatDate(i.issuedOn)}</Td>
                <Td className={i.display === "overdue" ? "whitespace-nowrap font-medium text-red" : "whitespace-nowrap"}>{formatDate(i.dueOn)}</Td>
                <Td className="text-right font-semibold num">{rupees(i.total)}</Td>
                <Td>
                  <Badge tone={INVOICE_STATUS_TONE[i.display]}>{INVOICE_STATUS_LABEL[i.display]}</Badge>
                </Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-2">
                    {(i.display === "due" || i.display === "overdue") && <RecordPaymentButton invoice={i} payment={pay} size="sm" />}
                    <Link href={`/dealer/invoices/${i.id}`} className="inline-flex h-9 items-center gap-1 rounded-[3px] border border-line px-3 text-[13px] font-medium hover:border-ink">
                      View <ChevronRight className="size-3.5" aria-hidden />
                    </Link>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <Panel title="Payment history" className="mt-10" padded={false}>
        {payments.length === 0 ? (
          <p className="px-5 py-10 text-center text-[14px] text-muted">No payments recorded yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {payments.map(({ payment: pm, number }) => (
              <li key={pm.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px]">
                    <span className="font-semibold num">{rupees(pm.amount)}</span>
                    <span className="text-muted">·</span>
                    <span>{PAYMENT_METHOD_SHORT[pm.method]}</span>
                    <span className="text-muted">·</span>
                    <span className="break-all text-muted num">ref {pm.utr}</span>
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-muted">
                    For{" "}
                    <Link href={`/dealer/invoices/${pm.invoiceId}`} className="font-medium text-ink hover:text-red num">
                      {number}
                    </Link>{" "}
                    · paid {formatDate(pm.paidOn)} · recorded {formatDateTime(pm.createdAt)}
                    {pm.proof && (
                      <>
                        {" "}
                        ·{" "}
                        <a href={fileHref(pm.proof)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-ink hover:text-red">
                          <Paperclip className="size-3" aria-hidden /> Proof
                        </a>
                      </>
                    )}
                  </p>
                  {pm.remarks && <p className={pm.status === "rejected" ? "mt-1.5 text-[13px] text-red" : "mt-1.5 text-[13px] text-muted"}>MarchGear: {pm.remarks}</p>}
                </div>
                <div className="justify-self-start sm:justify-self-end">
                  <Badge tone={PAYMENT_STATUS_TONE[pm.status]}>{pm.status === "submitted" ? "Being verified" : PAYMENT_STATUS_LABEL[pm.status]}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
