import type { Metadata } from "next";
import Link from "next/link";
import { Paperclip, Wallet } from "lucide-react";
import { PAYMENT_STATUS } from "@/db/enums";
import { INS_INVOICE_KIND_LABEL, PAYMENT_STATUS_LABEL } from "@/insurance/labels";
import { requireStaff } from "@/server/auth";
import { dayRange, listInsPayments, PAGE_SIZE, vendorLabel, vendorOptions } from "@/server/admin/insurance-ops";
import { AdminHeader, FilterForm, FilterSelect, Pagination, SearchInput, StatCard, Table, Td, Th, formatDateTime, formatDay, pageParam, strParam } from "@/components/admin/ui";
import { overdue, waitingLabel } from "@/components/admin/partner-ui";
import { rupees } from "@/components/portal/billing/shared";
import { DateRangeFields, EmptyBox, PaymentPill, SectionTitle, VendorLink } from "@/components/admin/insurance/ops/kit";
import { METHOD_LABEL, type Method } from "@/components/admin/insurance/ops/labels";
import { InsPaymentReview, type InsReviewPayment } from "@/components/admin/insurance/billing/actions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Insurance payments" };

const BASE = "/admin/insurance/payments";

type Row = Awaited<ReturnType<typeof listInsPayments>>["rows"][number];
const review = (r: Row): InsReviewPayment => ({
  id: r.p.id,
  amount: r.p.amount,
  method: r.p.method,
  utr: r.p.utr,
  paidOn: r.p.paidOn,
  proof: r.p.proof,
  submittedAt: formatDateTime(r.p.createdAt),
  vendor: vendorLabel(r),
  invoice: { number: r.invoiceNumber, total: r.invoiceTotal, description: r.invoiceDescription, alreadyVerified: r.invoiceVerified, dueOn: r.invoiceDue },
});

function ProofLink({ r }: { r: Row }) {
  return r.p.proof ? (
    <a href={`/insurance-vendor/files/${r.p.proof.id}`} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex max-w-full items-center gap-1 text-[12px] font-medium hover:text-red">
      <Paperclip className="size-3 shrink-0" aria-hidden /> <span className="truncate">Proof</span>
    </a>
  ) : (
    <p className="text-[12px] text-muted">No proof</p>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff();
  const sp = await searchParams;
  const range = dayRange(strParam(sp.from), strParam(sp.to));
  const params = { q: strParam(sp.q)?.slice(0, 60), vendor: strParam(sp.vendor), status: strParam(sp.status), method: strParam(sp.method), from: range.from, to: range.to };
  const [{ queue, rows, total, page }, vendors] = await Promise.all([listInsPayments(params, pageParam(sp.page)), vendorOptions()]);
  const hasFilters = Object.values(params).some(Boolean);
  const now = new Date().getTime();
  const queueSum = queue.reduce((s, r) => s + r.p.amount, 0);
  const oldest = queue[0]?.p.createdAt;

  return (
    <>
      <AdminHeader
        title="Payments"
        description="No payment gateway is connected: vendors pay MarchGear invoices by bank transfer, UPI or cheque and record the reference. Open the proof and check the bank statement before verifying."
      />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-3 [&>*:last-child]:col-span-2 lg:[&>*:last-child]:col-span-1">
        <StatCard label="Payments to verify" value={queue.length} tone={queue.length ? "red" : undefined} note={queue.length ? `${rupees(queueSum)} recorded by vendors` : "All caught up"} />
        <StatCard label="Oldest waiting" value={oldest ? waitingLabel(oldest, now) : "—"} note={oldest && overdue(oldest, now) ? "Past the 48-hour target" : "Target: within 48 hours"} />
        <StatCard label="Matching the filters" value={total} note="All payments below" />
      </div>

      <SectionTitle className="mt-0">Waiting for verification</SectionTitle>
      {queue.length === 0 ? (
        <EmptyBox icon={<Wallet aria-hidden className="size-5" />} title="No payments waiting">
          When a vendor records a bank transfer, UPI or cheque payment it appears here, oldest first.
        </EmptyBox>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Vendor</Th>
              <Th>Invoice</Th>
              <Th>Payment</Th>
              <Th>Paid on</Th>
              <Th>Waiting</Th>
              <Th className="relative text-right">
                <span className="sr-only">Review</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {queue.map((r) => {
              const balance = r.invoiceTotal - r.invoiceVerified;
              const diff = balance - r.p.amount;
              return (
                <tr key={r.p.id}>
                  <Td className="max-w-[220px]">
                    <VendorLink id={r.vendorId} name={vendorLabel(r)} reference={r.vendorRef} />
                  </Td>
                  <Td>
                    <Link href={`/admin/insurance/invoices/${r.p.invoiceId}`} className="font-medium num hover:text-red">
                      {r.invoiceNumber}
                    </Link>
                    <p className="text-[12px] text-muted">
                      {INS_INVOICE_KIND_LABEL[r.invoiceKind]} · <span className="num">{rupees(r.invoiceTotal)}</span>
                    </p>
                  </Td>
                  <Td className="min-w-[160px]">
                    <p className="font-semibold num">{rupees(r.p.amount)}</p>
                    <p className="break-all text-[12px] text-muted">
                      {METHOD_LABEL[r.p.method as Method]} · <span className="num">{r.p.utr}</span>
                    </p>
                    {diff !== 0 && <p className="text-[12px] font-medium text-[#9a5b00]">{diff > 0 ? `${rupees(diff)} short of the balance` : `${rupees(-diff)} over the balance`}</p>}
                    <ProofLink r={r} />
                  </Td>
                  <Td className="whitespace-nowrap">{formatDay(r.p.paidOn)}</Td>
                  <Td className={cn("whitespace-nowrap text-[12.5px]", overdue(r.p.createdAt, now) ? "font-semibold text-red" : "text-muted")}>{waitingLabel(r.p.createdAt, now)}</Td>
                  <Td className="text-right">
                    <InsPaymentReview p={review(r)} />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      <SectionTitle>All payments</SectionTitle>
      <FilterForm resetHref={BASE} hasFilters={hasFilters}>
        <SearchInput value={params.q} placeholder="UTR, invoice no. or vendor" />
        <FilterSelect name="vendor" label="All vendors" value={params.vendor} options={vendors} />
        <FilterSelect name="status" label="Any status" value={params.status} options={PAYMENT_STATUS.map((s) => ({ value: s, label: PAYMENT_STATUS_LABEL[s] }))} />
        <FilterSelect name="method" label="Any method" value={params.method} options={(Object.keys(METHOD_LABEL) as Method[]).map((m) => ({ value: m, label: METHOD_LABEL[m] }))} />
        <DateRangeFields from={params.from} to={params.to} label="Paid between (IST)" />
      </FilterForm>
      {rows.length === 0 ? (
        <EmptyBox title={hasFilters ? "No payments match" : "No payments yet"}>{hasFilters ? "Try another vendor, status or date range." : "Payments vendors record against their invoices are listed here."}</EmptyBox>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Vendor</Th>
              <Th>Invoice</Th>
              <Th className="text-right">Amount</Th>
              <Th>Method &amp; reference</Th>
              <Th>Paid on</Th>
              <Th>Status</Th>
              <Th>Remarks</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.p.id}>
                <Td className="max-w-[200px]">
                  <VendorLink id={r.vendorId} name={vendorLabel(r)} />
                </Td>
                <Td>
                  <Link href={`/admin/insurance/invoices/${r.p.invoiceId}`} className="font-medium num hover:text-red">
                    {r.invoiceNumber}
                  </Link>
                  <p className="text-[12px] text-muted">{INS_INVOICE_KIND_LABEL[r.invoiceKind]}</p>
                </Td>
                <Td className="text-right font-semibold num">{rupees(r.p.amount)}</Td>
                <Td className="min-w-[150px]">
                  <p>{METHOD_LABEL[r.p.method as Method]}</p>
                  <p className="break-all text-[12px] text-muted num">{r.p.utr}</p>
                  <ProofLink r={r} />
                </Td>
                <Td className="whitespace-nowrap">{formatDay(r.p.paidOn)}</Td>
                <Td className="min-w-[150px]">
                  <PaymentPill status={r.p.status} />
                  <p className="mt-1 text-[11.5px] text-muted">{r.p.verifiedAt ? `${r.verifier ?? "Staff"} · ${formatDateTime(r.p.verifiedAt)}` : `Recorded ${formatDateTime(r.p.createdAt)}`}</p>
                  {r.p.status === "submitted" && (
                    <div className="mt-2">
                      <InsPaymentReview p={review(r)} />
                    </div>
                  )}
                </Td>
                <Td className="max-w-[260px] text-[13px] text-muted">{r.p.remarks ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination base={BASE} params={params} page={page} pageSize={PAGE_SIZE} total={total} />
    </>
  );
}
