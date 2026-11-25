import type { Metadata } from "next";
import Link from "@/components/admin/desk";
import { notFound } from "next/navigation";
import { Paperclip } from "lucide-react";
import { INS_INVOICE_KIND_LABEL } from "@/insurance/labels";
import { insInvoiceDisplayStatus } from "@/server/insurance/billing";
import { requireStaff } from "@/server/auth";
import { getCatalog } from "@/server/catalog";
import { getInsInvoice } from "@/server/admin/insurance-ops";
import { vendorName } from "@/server/insurance/context";
import { getBillingContent } from "@/server/partner/billing";
import { AdminHeader, Panel, formatDateTime, formatDay } from "@/components/admin/ui";
import { istDate, rupees, sameState } from "@/components/portal/billing/shared";
import { FactGrid, InsHistoryList, InvoicePill, Notice, PaymentPill, TitlePills } from "@/components/admin/insurance/ops/kit";
import { METHOD_LABEL } from "@/components/admin/insurance/ops/labels";
import { InsInvoiceDocument, vendorParty } from "@/components/admin/insurance/billing/kit";
import { InsPaymentReview, MarkPaidButton, RecordRefundButton, VoidInsInvoiceButton } from "@/components/admin/insurance/billing/actions";

export const metadata: Metadata = { title: "Insurance invoice" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireStaff();
  const { id } = await params;
  const data = /^\d{1,9}$/.test(id) ? await getInsInvoice(Number(id)) : null;
  if (!data) notFound();
  const { i, v, payments, refunds, ad, history, verifiedTotal, refundedTotal } = data;
  const [content, catalog] = await Promise.all([getBillingContent(), getCatalog()]);
  const today = istDate();
  const display = insInvoiceDisplayStatus(i, today);
  const to = vendorParty(v);
  const vendor = vendorName(v);
  const isAdmin = me.role === "admin";
  const pending = payments.filter((p) => p.p.status === "submitted");
  const balance = i.status === "void" ? 0 : Math.max(0, i.total - verifiedTotal);
  const refundable = verifiedTotal - refundedTotal;
  const plan = i.plan ? catalog.content.insurerPlans.plans.find((p) => p.id === i.plan) : null;

  return (
    <>
      <AdminHeader
        back={{ href: "/admin/insurance/invoices", label: "All invoices" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="num">{i.number}</span>
            <TitlePills>
              <InvoicePill status={display} />
            </TitlePills>
          </span>
        }
        description={`${vendor} · ${INS_INVOICE_KIND_LABEL[i.kind]} · ${rupees(i.total)} incl. GST · issued ${formatDay(istDate(i.createdAt))}`}
        actions={
          <>
            {i.status === "due" && !pending.length && balance > 0 && <MarkPaidButton invoiceId={i.id} number={i.number} balance={balance} />}
            {i.status === "due" && verifiedTotal === 0 && <VoidInsInvoiceButton invoiceId={i.id} number={i.number} isAdmin={isAdmin} />}
            {i.status === "paid" && refundable > 0 && (
              <RecordRefundButton
                size="inline"
                isAdmin={isAdmin}
                defaultInvoice={i.id}
                invoices={[{ id: i.id, number: i.number, vendor, total: i.total, verified: verifiedTotal, refunded: refundedTotal, refundable }]}
              />
            )}
          </>
        }
      />

      {pending.length > 0 && (
        <Notice tone="info" className="mb-6" title={`${pending.length} payment${pending.length > 1 ? "s" : ""} waiting for verification`}>
          Review {pending.length > 1 ? "them" : "it"} in the Payments panel to mark this invoice paid or send it back to due.
        </Notice>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-3">
          <p className="text-[12.5px] text-muted">What the vendor sees in their portal:</p>
          <InsInvoiceDocument
            inv={{
              number: i.number,
              kind: i.kind,
              description: i.description,
              periodStart: i.periodStart,
              periodEnd: i.periodEnd,
              amount: i.amount,
              gst: i.gst,
              total: i.total,
              display,
              issuedOn: istDate(i.createdAt),
              dueOn: i.dueOn,
              paidOn: i.paidAt ? istDate(i.paidAt) : null,
            }}
            from={content.marchGear}
            to={to}
            payment={content.payment}
            intraState={sameState(to.state, content.marchGearAddress)}
          />
        </div>

        <aside className="min-w-0 space-y-6">
          <Panel title="Balance">
            <FactGrid
              cols={2}
              items={[
                ["Invoice total", rupees(i.total)],
                ["Verified payments", rupees(verifiedTotal)],
                ["Refunded", rupees(refundedTotal)],
                [i.status === "void" ? "Due (void)" : "Still due", <span key="b" className={balance > 0 ? "text-[#9a5b00]" : "text-[#1e7a3c]"}>{rupees(balance)}</span>],
              ]}
            />
            <p className="mt-3 text-[12.5px] text-muted">
              <Link href={`/admin/insurance/vendors/${v.id}`} className="font-medium text-ink hover:text-red">
                {vendor}
              </Link>{" "}
              · <span className="num">{v.reference}</span>
              {plan ? ` · ${plan.name} plan` : ""}
            </p>
            {ad && (
              <p className="mt-1 text-[12.5px] text-muted">
                Ad campaign{" "}
                <Link href="/admin/advertising" className="font-medium text-ink hover:text-red">
                  {ad.name}
                </Link>{" "}
                · {ad.placement} · {formatDay(ad.startsOn)} – {formatDay(ad.endsOn)}
              </p>
            )}
            <Link href={`/admin/insurance/invoices?vendor=${v.id}`} className="mt-3 inline-block text-[13px] font-medium text-red hover:underline">
              All invoices for this vendor
            </Link>
          </Panel>

          <Panel title={`Payments (${payments.length})`} padded={false}>
            {payments.length === 0 ? (
              <p className="px-5 py-6 text-[13.5px] text-muted">No payment recorded for this invoice.</p>
            ) : (
              <ol className="divide-y divide-line">
                {payments.map(({ p, verifier }) => (
                  <li key={p.id} className="space-y-1 px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold num">{rupees(p.amount)}</p>
                      <PaymentPill status={p.status} />
                    </div>
                    <p className="break-all text-[12.5px] text-muted">
                      {METHOD_LABEL[p.method]} · <span className="num">{p.utr}</span> · paid {formatDay(p.paidOn)}
                    </p>
                    <p className="text-[12px] text-muted">
                      Recorded {formatDateTime(p.createdAt)}
                      {p.verifiedAt ? ` · ${p.status === "verified" ? "verified" : "decided"} by ${verifier ?? "staff"} ${formatDateTime(p.verifiedAt)}` : ""}
                    </p>
                    {p.proof && (
                      <a href={`/insurance-vendor/files/${p.proof.id}`} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 text-[12.5px] font-medium hover:text-red">
                        <Paperclip className="size-3.5 shrink-0" aria-hidden /> <span className="truncate">{p.proof.filename}</span>
                      </a>
                    )}
                    {p.remarks && <p className="text-[13px] text-muted">Remarks: {p.remarks}</p>}
                    {p.status === "submitted" && (
                      <div className="pt-2">
                        <InsPaymentReview
                          p={{
                            id: p.id,
                            amount: p.amount,
                            method: p.method,
                            utr: p.utr,
                            paidOn: p.paidOn,
                            proof: p.proof,
                            submittedAt: formatDateTime(p.createdAt),
                            vendor,
                            invoice: { number: i.number, total: i.total, description: i.description, alreadyVerified: verifiedTotal, dueOn: i.dueOn },
                          }}
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel title={`Refunds (${refunds.length})`} padded={false}>
            {refunds.length === 0 ? (
              <p className="px-5 py-6 text-[13.5px] text-muted">No refunds on this invoice.</p>
            ) : (
              <ol className="divide-y divide-line">
                {refunds.map(({ r, by }) => (
                  <li key={r.id} className="space-y-1 px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold num">− {rupees(r.amount)}</p>
                      <span className="text-[12.5px] text-muted">{formatDay(r.refundedOn)}</span>
                    </div>
                    <p className="break-all text-[12.5px] text-muted">
                      Ref <span className="num">{r.reference}</span> · recorded by {by ?? "staff"}
                    </p>
                    <p className="text-[13px]">{r.reason}</p>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel title="Payment history">
            <InsHistoryList entries={history} empty="No payment decisions yet." />
          </Panel>
        </aside>
      </div>
    </>
  );
}
