import type { Metadata } from "next";
import Link from "@/components/admin/desk";
import { Download, ReceiptText } from "lucide-react";
import { INS_INVOICE_KINDS, INVOICE_STATUS } from "@/db/enums";
import { INS_INVOICE_KIND_LABEL, INVOICE_STATUS_LABEL } from "@/insurance/labels";
import { requireStaff } from "@/server/auth";
import { billableVendorOptions, dayRange, insuranceSettings, listInsInvoices, loadLedger, PAGE_SIZE, summariseLedger, vendorLabel, vendorOptions } from "@/server/admin/insurance-ops";
import { AdminHeader, FilterForm, FilterSelect, Pagination, SearchInput, StatCard, Table, Td, Th, formatDay, hrefWith, pageParam, strParam } from "@/components/admin/ui";
import { buttonClasses } from "@/components/ui/button";
import { istDate, rupees } from "@/components/portal/billing/shared";
import { DateRangeFields, EmptyBox, InvoicePill, VendorLink } from "@/components/admin/insurance/ops/kit";
import { CreateInvoiceButton } from "@/components/admin/insurance/billing/actions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Insurance invoices" };

const BASE = "/admin/insurance/invoices";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff();
  const sp = await searchParams;
  const range = dayRange(strParam(sp.from), strParam(sp.to));
  const params = { q: strParam(sp.q)?.slice(0, 60), vendor: strParam(sp.vendor), kind: strParam(sp.kind), status: strParam(sp.status), from: range.from, to: range.to };
  const today = istDate();
  const [{ rows, total, page }, vendors, billable, settings, ledger] = await Promise.all([listInsInvoices(params, pageParam(sp.page)), vendorOptions(), billableVendorOptions(), insuranceSettings(), loadLedger()]);
  const month = summariseLedger(ledger, { from: `${today.slice(0, 7)}-01`, to: today }, today);
  const verifying = ledger.invoices.filter((i) => i.status === "verifying").length;
  const hasFilters = Object.values(params).some(Boolean);

  return (
    <>
      <AdminHeader
        title="Invoices"
        description="Every MarchGear invoice to insurance vendors — subscriptions, advertising, lead fees and one-off charges. Numbered MGI/yy-yy/00001, 18% GST added."
        actions={
          <>
            <a href={hrefWith(`${BASE}/export`, params, {})} download className={buttonClasses({ variant: "outline", size: "sm" })}>
              <Download className="size-4" aria-hidden /> Export CSV
            </a>
            <CreateInvoiceButton vendors={billable} leadFeeEnabled={settings.leadFeeEnabled} leadFeeAmount={settings.leadFeeAmount} paymentTermsDays={settings.paymentTermsDays} defaultVendor={params.vendor} />
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Outstanding" value={rupees(month.outstanding)} note={`${month.outstandingCount} unpaid · incl. GST`} href={`${BASE}?status=unpaid`} />
        <StatCard label="Overdue" value={rupees(month.overdue)} tone={month.overdueCount ? "red" : undefined} note={`${month.overdueCount} past due date`} href={`${BASE}?status=overdue`} />
        <StatCard label="Payment being verified" value={verifying} note="Waiting in Payments" href="/admin/insurance/payments" />
        <StatCard label="Collected this month" value={rupees(month.collected)} note="Verified payments − refunds" href="/admin/insurance/revenue?period=month" />
      </div>

      <FilterForm resetHref={BASE} hasFilters={hasFilters}>
        <SearchInput value={params.q} placeholder="Invoice no., description or vendor" />
        <FilterSelect name="vendor" label="All vendors" value={params.vendor} options={vendors} />
        <FilterSelect name="kind" label="Every kind" value={params.kind} options={INS_INVOICE_KINDS.map((k) => ({ value: k, label: INS_INVOICE_KIND_LABEL[k] }))} />
        <FilterSelect name="status" label="Any status" value={params.status} options={[{ value: "unpaid", label: "Unpaid (due, overdue or verifying)" }, ...INVOICE_STATUS.map((s) => ({ value: s, label: INVOICE_STATUS_LABEL[s] }))]} />
        <DateRangeFields from={params.from} to={params.to} label="Billing period between (IST)" />
      </FilterForm>

      {rows.length === 0 ? (
        <EmptyBox icon={<ReceiptText aria-hidden className="size-5" />} title={hasFilters ? "No invoices match" : "No invoices yet"}>
          {hasFilters ? "Try another vendor, kind, status or period." : "Subscription, advertising and lead-fee invoices appear here as they're raised."}
        </EmptyBox>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Invoice</Th>
              <Th>Vendor</Th>
              <Th>Period</Th>
              <Th className="text-right">Total</Th>
              <Th className="text-right">Paid</Th>
              <Th>Due</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => {
              const balance = i.status === "void" ? 0 : Math.max(0, i.total - i.verified);
              return (
                <tr key={i.id} className="transition-colors hover:bg-mist/40">
                  <Td className="min-w-[200px] max-w-[300px]">
                    <Link href={`${BASE}/${i.id}`} className="block font-medium num hover:text-red">
                      {i.number}
                    </Link>
                    <p className="text-[12px] font-medium text-muted">{INS_INVOICE_KIND_LABEL[i.kind]}</p>
                    <p className="line-clamp-2 text-[12px] text-muted">{i.description}</p>
                  </Td>
                  <Td className="max-w-[200px]">
                    <VendorLink id={i.vendorId} name={vendorLabel(i)} reference={i.vendorRef} />
                  </Td>
                  <Td className="whitespace-nowrap text-[12.5px] text-muted">{i.periodStart === i.periodEnd ? formatDay(i.periodStart) : `${formatDay(i.periodStart)} – ${formatDay(i.periodEnd)}`}</Td>
                  <Td className="text-right font-semibold num">{rupees(i.total)}</Td>
                  <Td className="text-right num">
                    {rupees(i.verified)}
                    {balance > 0 && i.verified > 0 && <p className="text-[11.5px] text-[#9a5b00]">{rupees(balance)} left</p>}
                    {i.refunded > 0 && <p className="text-[11.5px] text-muted">{rupees(i.refunded)} refunded</p>}
                  </Td>
                  <Td className={cn("whitespace-nowrap", i.display === "overdue" && "font-medium text-red")}>{formatDay(i.dueOn)}</Td>
                  <Td>
                    <InvoicePill status={i.display} />
                    {i.pending > 0 && (
                      <Link href="/admin/insurance/payments" className="mt-1 block text-[11.5px] font-medium text-red hover:underline">
                        Payment to verify
                      </Link>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      <Pagination base={BASE} params={params} page={page} pageSize={PAGE_SIZE} total={total} />
    </>
  );
}
