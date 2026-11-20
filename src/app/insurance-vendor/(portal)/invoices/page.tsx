import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, CircleDollarSign, CreditCard, FileText } from "lucide-react";
import { INS_INVOICE_KINDS, INVOICE_STATUS, type InsInvoiceKind, type InvoiceStatus } from "@/db/enums";
import { formatDate } from "@/lib/format";
import { INS_INVOICE_KIND_LABEL, INVOICE_STATUS_LABEL, INVOICE_STATUS_TONE } from "@/insurance/labels";
import { requireInsurer } from "@/server/insurance/context";
import { ensureInsBillingState, getAdRefs, getInsBillingContent, getInsInvoiceRows, getInsPayments, getInsPlans, toInsInvoiceView } from "@/server/insurance/subscription";
import { Badge, EmptyRow, FilterForm, FilterSelect, Pagination, PortalHeader, StatCard, Table, Td, Th, pageParam, strParam } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { hasPaymentDetails } from "@/components/portal/billing/shared";
import { InsRecordPaymentButton } from "@/components/insurance/vendor/billing/invoice-actions";
import { INS_NO_PAYMENT_DETAILS, isPayable, istDate, rupees } from "@/components/insurance/vendor/billing/shared";

export const metadata: Metadata = { title: "Invoices" };

const PAGE_SIZE = 25;

export default async function Page({ searchParams }: PageProps<"/insurance-vendor/invoices">) {
  const ctx = await requireInsurer({ perm: "billing.manage" });
  const sp = await searchParams;
  const kindParam = strParam(sp.kind);
  const statusParam = strParam(sp.status);
  const kind = kindParam && (INS_INVOICE_KINDS as readonly string[]).includes(kindParam) ? (kindParam as InsInvoiceKind) : undefined;
  const status = statusParam && (INVOICE_STATUS as readonly string[]).includes(statusParam) ? (statusParam as InvoiceStatus) : undefined;
  const page = pageParam(sp.page);

  await ensureInsBillingState(ctx.vendor.id);
  const [rows, plans, content, payments] = await Promise.all([getInsInvoiceRows(ctx.vendor.id), getInsPlans(), getInsBillingContent(), getInsPayments(ctx.vendor.id)]);
  const ads = await getAdRefs(ctx.vendor.id, rows.map((r) => r.adCampaignId));
  const today = istDate();
  const invoices = rows.map((r) => toInsInvoiceView(r, plans, ads, today));
  const unpaid = invoices.filter((i) => isPayable(i.display));
  // What's still owed: verified part-payments come off the total (as on MarchGear's side).
  const verifiedOn = new Map<number, number>();
  for (const { payment: p } of payments) if (p.status === "verified") verifiedOn.set(p.invoiceId, (verifiedOn.get(p.invoiceId) ?? 0) + p.amount);
  const owed = unpaid.reduce((s, i) => s + Math.max(0, i.total - (verifiedOn.get(i.id) ?? 0)), 0);
  const overdue = invoices.filter((i) => i.display === "overdue").sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  const verifying = invoices.filter((i) => i.display === "verifying");
  const fyStart = `${Number(today.slice(5, 7)) >= 4 ? today.slice(0, 4) : Number(today.slice(0, 4)) - 1}-04-01`;
  const paidThisYear = invoices.filter((i) => i.display === "paid" && i.paidAt && istDate(i.paidAt) >= fyStart).reduce((s, i) => s + i.total, 0);
  const pay = content.payment;

  const filtered = invoices.filter((i) => (!kind || i.kind === kind) && (!status || i.display === status));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const hasFilters = Boolean(kind || status);
  const params = { kind, status };
  const empty = hasFilters ? "No invoices match these filters." : "No invoices yet. Subscription invoices appear when your free trial ends; advertising invoices when MarchGear approves a booking.";

  return (
    <>
      <PortalHeader
        title="Invoices"
        description="Subscription, advertising and other invoices from MarchGear. Record your bank transfer, UPI or cheque payment against each one."
        actions={
          <>
            <Button href="/insurance-vendor/transactions" variant="ghost" size="sm" icon={<CircleDollarSign className="size-4" aria-hidden />}>
              Transactions
            </Button>
            <Button href="/insurance-vendor/billing" variant="outline" size="sm" icon={<CreditCard className="size-4" aria-hidden />}>
              Billing & plan
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Outstanding"
          value={rupees(owed)}
          note={`${unpaid.length} unpaid invoice${unpaid.length === 1 ? "" : "s"}`}
          tone={unpaid.length ? "red" : undefined}
          href={unpaid.length ? "/insurance-vendor/invoices?status=due" : undefined}
        />
        <StatCard label="Overdue" value={overdue.length} note={overdue.length ? `Oldest due ${formatDate(overdue[0].dueOn)}` : "Nothing overdue"} href={overdue.length ? "/insurance-vendor/invoices?status=overdue" : undefined} />
        <StatCard label="Being verified" value={verifying.length} note="Payments MarchGear is checking" href={verifying.length ? "/insurance-vendor/invoices?status=verifying" : undefined} />
        <StatCard label="Paid this financial year" value={rupees(paidThisYear)} note={`Since ${formatDate(fyStart)}`} />
      </div>

      <section className="mt-6 grid gap-4 border border-line bg-white p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:p-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">How to pay</p>
          <p className="mt-2 text-[14px] leading-relaxed">
            There&apos;s no online payment gateway. Pay each invoice by <strong className="font-semibold">bank transfer, UPI or cheque</strong>, quoting the invoice number, then use{" "}
            <em className="not-italic font-medium">Record a payment</em> with your UTR or transaction ID. MarchGear&apos;s accounts team verifies it against the bank statement and marks the invoice paid.
          </p>
        </div>
        <div className="min-w-0 border-t border-line pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
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
                .filter(([, val]) => val)
                .map(([k, val]) => (
                  <div key={k} className="min-w-0">
                    <dt className="text-[12px] text-muted">{k}</dt>
                    <dd className="break-all font-medium num">{val}</dd>
                  </div>
                ))}
              {pay.instructions && <p className="text-[12.5px] text-muted sm:col-span-2">{pay.instructions}</p>}
            </dl>
          ) : (
            <div className="flex h-full items-center gap-3 text-[14px]">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[#F6F6F6]">
                <FileText className="size-4" aria-hidden />
              </span>
              <p className="min-w-0">
                <span className="font-medium">{INS_NO_PAYMENT_DETAILS}</span>
                <span className="block text-[12.5px] text-muted">Bank and UPI details will appear here and on your invoices once MarchGear adds them.</span>
                {pay.instructions && <span className="mt-1 block text-[12.5px] text-muted">{pay.instructions}</span>}
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="mt-10">
        <FilterForm resetHref="/insurance-vendor/invoices" hasFilters={hasFilters}>
          <FilterSelect name="kind" label="All kinds" value={kind} options={INS_INVOICE_KINDS.map((k) => ({ value: k, label: INS_INVOICE_KIND_LABEL[k] }))} />
          <FilterSelect name="status" label="All statuses" value={status} options={INVOICE_STATUS.map((s) => ({ value: s, label: INVOICE_STATUS_LABEL[s] }))} />
          <p className="text-[12.5px] text-muted md:ml-2 num">
            {filtered.length} invoice{filtered.length === 1 ? "" : "s"}
          </p>
        </FilterForm>

        {/* Phone: cards */}
        <ul className="space-y-3 md:hidden">
          {shown.length === 0 && <li className="border border-line bg-white px-5 py-10 text-center text-[14px] text-muted">{empty}</li>}
          {shown.map((i) => (
            <li key={i.id} className="border border-line bg-white">
              <Link href={`/insurance-vendor/invoices/${i.id}`} className="block p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold num">{i.number}</p>
                    <p className="mt-0.5 break-words text-[12.5px] text-muted">
                      {i.kindLabel} · {i.line}
                    </p>
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
              {isPayable(i.display) && (
                <div className="border-t border-line p-3">
                  <InsRecordPaymentButton invoice={i} payment={pay} size="sm" className="w-full" />
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
                <Th>Kind</Th>
                <Th>Period · due</Th>
                <Th className="text-right">Total</Th>
                <Th>Status</Th>
                <Th className="relative text-right">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && <EmptyRow colSpan={6}>{empty}</EmptyRow>}
              {shown.map((i) => (
                <tr key={i.id} className="transition-colors hover:bg-[#FAFAFA]">
                  <Td>
                    <Link href={`/insurance-vendor/invoices/${i.id}`} className="font-semibold num hover:text-red">
                      {i.number}
                    </Link>
                    <p className="mt-0.5 max-w-[220px] truncate text-[12px] text-muted" title={i.line}>
                      {i.line}
                    </p>
                  </Td>
                  <Td className="whitespace-nowrap">{i.kindLabel}</Td>
                  <Td className="whitespace-nowrap">
                    <p className="text-muted">
                      {formatDate(i.periodStart)} – {formatDate(i.periodEnd)}
                    </p>
                    <p className={i.display === "overdue" ? "mt-0.5 text-[12.5px] font-medium text-red" : "mt-0.5 text-[12.5px]"}>Due {formatDate(i.dueOn)}</p>
                  </Td>
                  <Td className="text-right font-semibold num">{rupees(i.total)}</Td>
                  <Td>
                    <Badge tone={INVOICE_STATUS_TONE[i.display]}>{INVOICE_STATUS_LABEL[i.display]}</Badge>
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                      {isPayable(i.display) && <InsRecordPaymentButton invoice={i} payment={pay} size="sm" />}
                      <Link href={`/insurance-vendor/invoices/${i.id}`} className="inline-flex h-9 items-center gap-1 rounded-[3px] border border-line px-3 text-[13px] font-medium hover:border-ink">
                        View <ChevronRight className="size-3.5" aria-hidden />
                      </Link>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        {filtered.length > PAGE_SIZE && <Pagination base="/insurance-vendor/invoices" params={params} page={current} pageSize={PAGE_SIZE} total={filtered.length} />}
        <p className="mt-6 text-[12.5px] text-muted">
          Every payment you&apos;ve recorded, its verification status and any refunds are on{" "}
          <Link href="/insurance-vendor/transactions" className="font-medium text-ink underline underline-offset-4">
            Transactions
          </Link>
          .
        </p>
      </div>
    </>
  );
}
