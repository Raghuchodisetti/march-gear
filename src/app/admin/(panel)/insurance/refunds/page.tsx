import type { Metadata } from "next";
import Link from "next/link";
import { Undo2 } from "lucide-react";
import { INS_INVOICE_KIND_LABEL } from "@/insurance/labels";
import { requireStaff } from "@/server/auth";
import { dayRange, listInsRefunds, loadLedger, PAGE_SIZE, refundableInvoices, summariseLedger, vendorLabel, vendorOptions } from "@/server/admin/insurance-ops";
import { AdminHeader, FilterForm, FilterSelect, Pagination, SearchInput, StatCard, Table, Td, Th, formatDateTime, formatDay, pageParam, strParam } from "@/components/admin/ui";
import { istDate, rupees } from "@/components/portal/billing/shared";
import { DateRangeFields, EmptyBox, Notice, VendorLink } from "@/components/admin/insurance/ops/kit";
import { RecordRefundButton } from "@/components/admin/insurance/billing/actions";

export const metadata: Metadata = { title: "Refunds" };

const BASE = "/admin/insurance/refunds";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireStaff();
  const sp = await searchParams;
  const range = dayRange(strParam(sp.from), strParam(sp.to));
  const params = { q: strParam(sp.q)?.slice(0, 60), vendor: strParam(sp.vendor), from: range.from, to: range.to };
  const today = istDate();
  const isAdmin = me.role === "admin";
  const [{ rows, total, amount, page }, vendors, refundable, ledger] = await Promise.all([listInsRefunds(params, pageParam(sp.page)), vendorOptions(), isAdmin ? refundableInvoices() : Promise.resolve([]), loadLedger()]);
  const all = summariseLedger(ledger, {}, today);
  const month = summariseLedger(ledger, { from: `${today.slice(0, 7)}-01`, to: today }, today);
  const hasFilters = Object.values(params).some(Boolean);

  return (
    <>
      <AdminHeader
        title="Refunds"
        description="Money MarchGear has paid back to insurance vendors. There's no payment gateway: make the transfer from the bank, then record it here with its reference. Refunds reduce collected revenue."
        actions={<RecordRefundButton invoices={refundable} isAdmin={isAdmin} />}
      />

      {!isAdmin && (
        <Notice tone="info" className="mb-6">
          Only MarchGear admins can record refunds. You can see every refund and its reference.
        </Notice>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Refunded, all time" value={rupees(all.refunded)} note={`${ledger.refunds.length} refund${ledger.refunds.length === 1 ? "" : "s"}`} />
        <StatCard label="Refunded this month" value={rupees(month.refunded)} />
        <StatCard label="Matching the filters" value={rupees(amount)} note={`${total} refund${total === 1 ? "" : "s"}`} />
        <StatCard label="Collected, all time" value={rupees(all.collected)} note={`${rupees(all.gross)} verified − ${rupees(all.refunded)} refunded`} href="/admin/insurance/revenue" />
      </div>

      <FilterForm resetHref={BASE} hasFilters={hasFilters}>
        <SearchInput value={params.q} placeholder="Refund ref., reason, invoice no. or vendor" />
        <FilterSelect name="vendor" label="All vendors" value={params.vendor} options={vendors} />
        <DateRangeFields from={params.from} to={params.to} label="Refunded between (IST)" />
      </FilterForm>

      {rows.length === 0 ? (
        <EmptyBox icon={<Undo2 aria-hidden className="size-5" />} title={hasFilters ? "No refunds match" : "No refunds recorded"}>
          {hasFilters ? "Try another vendor or date range." : "Refunds are recorded against paid invoices, up to what was verified on them."}
        </EmptyBox>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Refunded on</Th>
              <Th>Vendor</Th>
              <Th>Invoice</Th>
              <Th className="text-right">Amount</Th>
              <Th>Reference</Th>
              <Th>Reason</Th>
              <Th>Recorded</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ r, by, paymentUtr, invoiceNumber, invoiceKind, invoiceTotal, ...v }) => (
              <tr key={r.id}>
                <Td className="whitespace-nowrap">{formatDay(r.refundedOn)}</Td>
                <Td className="max-w-[200px]">
                  <VendorLink id={v.vendorId} name={vendorLabel(v)} reference={v.vendorRef} />
                </Td>
                <Td>
                  <Link href={`/admin/insurance/invoices/${r.invoiceId}`} className="font-medium num hover:text-red">
                    {invoiceNumber}
                  </Link>
                  <p className="text-[12px] text-muted">
                    {INS_INVOICE_KIND_LABEL[invoiceKind]} · {rupees(invoiceTotal)}
                  </p>
                </Td>
                <Td className="text-right font-semibold num">{rupees(r.amount)}</Td>
                <Td className="min-w-[140px]">
                  <p className="break-all num">{r.reference}</p>
                  {paymentUtr && <p className="break-all text-[12px] text-muted">Against payment {paymentUtr}</p>}
                </Td>
                <Td className="min-w-[200px] max-w-[300px] text-[13px]">{r.reason}</Td>
                <Td className="whitespace-nowrap text-[12.5px] text-muted">
                  {by ?? "Staff"}
                  <span className="block">{formatDateTime(r.createdAt)}</span>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination base={BASE} params={params} page={page} pageSize={PAGE_SIZE} total={total} />
    </>
  );
}
