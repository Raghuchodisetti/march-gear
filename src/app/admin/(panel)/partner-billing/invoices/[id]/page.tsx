import type { Metadata } from "next";
import Link from "@/components/admin/desk";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { Paperclip } from "lucide-react";
import { getDb } from "@/db";
import { partnerInvoices, partnerPayments, partners } from "@/db/schema";
import { formatDate } from "@/lib/format";
import { INVOICE_STATUS_LABEL, INVOICE_STATUS_TONE, PAYMENT_STATUS_LABEL, PLAN_STATUS_LABEL } from "@/partner/labels";
import { requireStaff } from "@/server/auth";
import { dealerParty, getBillingContent, getPlans, planNameOf, toInvoiceView } from "@/server/partner/billing";
import { AdminHeader, Badge, Panel, formatDateTime } from "@/components/admin/ui";
import { PaymentReview, VoidInvoiceButton } from "@/components/admin/partner-billing-actions";
import { InvoiceDocument } from "@/components/portal/billing/invoice-document";
import { InvoicePdfButtons } from "@/components/portal/billing/invoice-actions";
import { PAYMENT_METHOD_SHORT, PAYMENT_STATUS_TONE, addDays, istDate, rupees, sameState } from "@/components/portal/billing/shared";

export const metadata: Metadata = { title: "Dealer invoice" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const db = getDb();
  const [row] = await db.select({ invoice: partnerInvoices, partner: partners }).from(partnerInvoices).innerJoin(partners, eq(partners.id, partnerInvoices.partnerId)).where(eq(partnerInvoices.id, Number(id)));
  if (!row) notFound();
  const { partner: p } = row;
  const [plans, content, payments] = await Promise.all([
    getPlans(),
    getBillingContent(),
    db.select().from(partnerPayments).where(eq(partnerPayments.invoiceId, row.invoice.id)).orderBy(desc(partnerPayments.createdAt)),
  ]);
  const invoice = toInvoiceView(row.invoice, plans, istDate());
  const to = await dealerParty(p);
  const state = to.state ?? "";
  const data = { invoice, from: content.marchGear, to, payment: content.payment, intraState: sameState(state, content.marchGearAddress), placeOfSupply: state };
  const dealer = p.tradeName || p.legalName || p.reference;

  return (
    <>
      <AdminHeader
        back={{ href: "/admin/partner-billing?tab=invoices", label: "Dealer billing" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="num">{invoice.number}</span>
            <Badge tone={INVOICE_STATUS_TONE[invoice.display]}>{INVOICE_STATUS_LABEL[invoice.display]}</Badge>
          </span>
        }
        description={`${dealer} · ${invoice.line} · ${rupees(invoice.total)} incl. GST`}
        actions={
          <>
            {row.invoice.status === "due" && <VoidInvoiceButton invoiceId={invoice.id} number={invoice.number} />}
            <InvoicePdfButtons data={data} />
          </>
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <InvoiceDocument {...data} />
        <aside className="space-y-6">
          <Panel title="Dealer">
            <p className="font-medium">
              <Link href={`/admin/dealers/details?id=${p.id}`} className="hover:text-red">
                {dealer}
              </Link>
              <span className="ml-2 text-[12px] text-muted num">{p.reference}</span>
            </p>
            <p className="mt-2 text-[13px] text-muted">
              {planNameOf(plans, p.plan)} plan · {PLAN_STATUS_LABEL[p.planStatus]}
              {p.planRenewsAt ? ` · paid until ${formatDate(addDays(p.planRenewsAt, -1))}` : ""}
            </p>
            <Link href={`/admin/partner-billing?tab=invoices&dealer=${p.id}`} className="mt-3 inline-block text-[13px] font-medium text-red hover:underline">
              All invoices for this dealer
            </Link>
          </Panel>
          <Panel title="Payments" padded={false}>
            {payments.length === 0 ? (
              <p className="px-5 py-6 text-[13.5px] text-muted">No payment recorded for this invoice.</p>
            ) : (
              <ol className="divide-y divide-line">
                {payments.map((pm) => (
                  <li key={pm.id} className="space-y-1 px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold num">{rupees(pm.amount)}</p>
                      <Badge tone={PAYMENT_STATUS_TONE[pm.status]}>{PAYMENT_STATUS_LABEL[pm.status]}</Badge>
                    </div>
                    <p className="break-all text-[12.5px] text-muted">
                      {PAYMENT_METHOD_SHORT[pm.method]} · <span className="num">{pm.utr}</span> · paid {formatDate(pm.paidOn)}
                    </p>
                    <p className="text-[12px] text-muted">Recorded {formatDateTime(pm.createdAt)}</p>
                    {pm.proof && (
                      <a href={`/dealer/files/${pm.proof.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] font-medium hover:text-red">
                        <Paperclip className="size-3.5" aria-hidden /> {pm.proof.filename}
                      </a>
                    )}
                    {pm.remarks && <p className="text-[13px] text-muted">Remarks: {pm.remarks}</p>}
                    {pm.status === "submitted" && (
                      <div className="pt-2">
                        <PaymentReview
                          p={{
                            id: pm.id,
                            amount: pm.amount,
                            method: pm.method,
                            utr: pm.utr,
                            paidOn: pm.paidOn,
                            proof: pm.proof,
                            submittedAt: formatDateTime(pm.createdAt),
                            dealer,
                            invoice: { number: invoice.number, total: invoice.total, plan: `${invoice.planName} plan`, period: `${formatDate(invoice.periodStart)} – ${formatDate(invoice.periodEnd)}` },
                          }}
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </aside>
      </div>
    </>
  );
}
