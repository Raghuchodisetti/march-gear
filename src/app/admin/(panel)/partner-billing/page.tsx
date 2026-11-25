import type { Metadata } from "next";
import Link from "@/components/admin/desk";
import { and, desc, eq, inArray, like, ne, or, sql, type SQL } from "drizzle-orm";
import { Paperclip } from "lucide-react";
import { getDb } from "@/db";
import { INVOICE_STATUS, partnerInvoices, partnerPayments, partners, type InvoiceStatus } from "@/db/schema";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { INVOICE_STATUS_LABEL, INVOICE_STATUS_TONE, PAYMENT_STATUS_LABEL } from "@/partner/labels";
import { requireStaff } from "@/server/auth";
import { getPlans, planNameOf } from "@/server/partner/billing";
import { AdminHeader, Badge, FilterForm, FilterSelect, Pagination, SearchInput, StatCard, Table, Td, Th, formatDateTime, pageParam, strParam } from "@/components/admin/ui";
import { IssueInvoiceButton, PaymentReview, VoidInvoiceButton } from "@/components/admin/partner-billing-actions";
import { PAYMENT_METHOD_SHORT, PAYMENT_STATUS_TONE, invoiceDisplayStatus, istDate, rupees } from "@/components/portal/billing/shared";
import { EmptyState } from "@/components/admin/partner-ui";

const Empty = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="border border-line bg-white">
    <EmptyState title={title}>{children}</EmptyState>
  </div>
);

export const metadata: Metadata = { title: "Dealer billing" };

const PAGE = 30;
const dealerName = (r: { trade: string | null; legal: string | null; ref: string }) => r.trade || r.legal || r.ref;

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff();
  const sp = await searchParams;
  const tab = strParam(sp.tab) === "invoices" ? "invoices" : "payments";
  const status = strParam(sp.status);
  const dealer = strParam(sp.dealer);
  const q = strParam(sp.q)?.slice(0, 40);
  const page = pageParam(sp.page);
  // Search text is matched literally (% and _ are not wildcards).
  const like_ = `%${(q ?? "").replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const dealerId = dealer && /^\d+$/.test(dealer) ? Number(dealer) : undefined;
  const validStatus = status && (INVOICE_STATUS as readonly string[]).includes(status) ? (status as InvoiceStatus) : undefined;
  const today = istDate();
  // Start of this month in IST, as the UTC datetime stored in paid_at.
  const monthStartUtc = new Date(`${today.slice(0, 7)}-01T00:00:00+05:30`).toISOString().slice(0, 19).replace("T", " ");
  const db = getDb();

  const party = { trade: partners.tradeName, legal: partners.legalName, ref: partners.reference };
  const [plans, approved, queue, decided, summary] = await Promise.all([
    getPlans(),
    db.select({ id: partners.id, ...party, plan: partners.plan }).from(partners).where(eq(partners.status, "approved")),
    db
      .select({ payment: partnerPayments, invoice: partnerInvoices, ...party })
      .from(partnerPayments)
      .innerJoin(partnerInvoices, eq(partnerInvoices.id, partnerPayments.invoiceId))
      .innerJoin(partners, eq(partners.id, partnerPayments.partnerId))
      .where(eq(partnerPayments.status, "submitted"))
      .orderBy(partnerPayments.createdAt),
    db
      .select({ payment: partnerPayments, number: partnerInvoices.number, ...party })
      .from(partnerPayments)
      .innerJoin(partnerInvoices, eq(partnerInvoices.id, partnerPayments.invoiceId))
      .innerJoin(partners, eq(partners.id, partnerPayments.partnerId))
      .where(ne(partnerPayments.status, "submitted"))
      .orderBy(desc(partnerPayments.createdAt))
      .limit(15),
    db
      .select({
        outstanding: sql<string>`COALESCE(SUM(CASE WHEN ${partnerInvoices.status} = 'due' THEN ${partnerInvoices.total} ELSE 0 END), 0)`,
        overdue: sql<string>`COALESCE(SUM(CASE WHEN ${partnerInvoices.status} = 'due' AND ${partnerInvoices.dueOn} < ${today} THEN 1 ELSE 0 END), 0)`,
        collected: sql<string>`COALESCE(SUM(CASE WHEN ${partnerInvoices.status} = 'paid' AND ${partnerInvoices.paidAt} >= ${monthStartUtc} THEN ${partnerInvoices.total} ELSE 0 END), 0)`,
      })
      .from(partnerInvoices),
  ]);
  const queueTotal = queue.reduce((s, r) => s + r.payment.amount, 0);
  const s = summary[0];

  // Invoices tab
  const conds: (SQL | undefined)[] = [
    dealerId ? eq(partnerInvoices.partnerId, dealerId) : undefined,
    validStatus === "overdue"
      ? and(eq(partnerInvoices.status, "due"), sql`${partnerInvoices.dueOn} < ${today}`)
      : validStatus === "due"
        ? and(eq(partnerInvoices.status, "due"), sql`${partnerInvoices.dueOn} >= ${today}`)
        : validStatus
          ? eq(partnerInvoices.status, validStatus)
          : undefined,
    q ? or(like(partnerInvoices.number, like_), like(partners.tradeName, like_), like(partners.legalName, like_), like(partners.reference, like_)) : undefined,
  ];
  const where = and(...conds);
  const [invoices, [{ total }]] =
    tab === "invoices"
      ? await Promise.all([
          db
            .select({ invoice: partnerInvoices, ...party })
            .from(partnerInvoices)
            .innerJoin(partners, eq(partners.id, partnerInvoices.partnerId))
            .where(where)
            .orderBy(desc(partnerInvoices.createdAt), desc(partnerInvoices.id))
            .limit(PAGE)
            .offset((page - 1) * PAGE),
          db.select({ total: sql<number>`COUNT(*)` }).from(partnerInvoices).innerJoin(partners, eq(partners.id, partnerInvoices.partnerId)).where(where),
        ])
      : [[], [{ total: 0 }]];
  const dealerOptions = approved.map((d) => ({ id: d.id, name: dealerName(d), reference: d.ref, plan: d.plan })).sort((a, b) => a.name.localeCompare(b.name));
  const verifyingIds = tab === "invoices" ? invoices.filter((i) => i.invoice.status === "verifying").map((i) => i.invoice.id) : [];
  const pendingByInvoice = verifyingIds.length
    ? new Set((await db.select({ id: partnerPayments.invoiceId }).from(partnerPayments).where(and(inArray(partnerPayments.invoiceId, verifyingIds), eq(partnerPayments.status, "submitted")))).map((r) => r.id))
    : new Set<number>();

  const tabLink = (t: string, label: string, n?: number) => (
    <Link
      href={t === "payments" ? "/admin/partner-billing" : "/admin/partner-billing?tab=invoices"}
      aria-current={tab === t ? "page" : undefined}
      className={cn("relative -mb-px inline-flex items-center gap-2 border-b-2 pb-3 text-[14px] font-medium transition-colors", tab === t ? "border-red text-ink" : "border-transparent text-muted hover:text-ink")}
    >
      {label}
      {n ? <span className="rounded-full bg-red px-1.5 py-0.5 text-[10.5px] font-semibold leading-none text-white num">{n}</span> : null}
    </Link>
  );

  return (
    <>
      <AdminHeader
        title="Dealer billing"
        description="No payment gateway is connected: dealers pay by bank transfer, UPI or cheque and record the reference. Check each one against the bank statement before verifying."
        actions={<IssueInvoiceButton dealers={dealerOptions} plans={plans} defaultDealer={dealerId} />}
      />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Payments to verify" value={queue.length} note={queue.length ? `${rupees(queueTotal)} recorded` : "All caught up"} tone={queue.length ? "red" : undefined} href="/admin/partner-billing" />
        <StatCard label="Outstanding" value={rupees(Number(s?.outstanding ?? 0))} note="Unpaid invoices, incl. GST" href="/admin/partner-billing?tab=invoices&status=due" />
        <StatCard label="Overdue invoices" value={Number(s?.overdue ?? 0)} href="/admin/partner-billing?tab=invoices&status=overdue" />
        <StatCard label="Collected this month" value={rupees(Number(s?.collected ?? 0))} note="Verified payments" />
      </div>

      <nav className="mb-6 flex gap-7 border-b border-line" aria-label="Billing sections">
        {tabLink("payments", "Payments to verify", queue.length)}
        {tabLink("invoices", "Invoices")}
      </nav>

      {tab === "payments" ? (
        <>
          {queue.length === 0 ? (
            <Empty title="No payments waiting for verification">When a dealer records a bank transfer, UPI or cheque payment it appears here to check against the bank statement.</Empty>
          ) : (
          <Table>
            <thead>
              <tr>
                <Th>Dealer</Th>
                <Th>Invoice</Th>
                <Th>Payment</Th>
                <Th>Paid on</Th>
                <Th>Recorded</Th>
                <Th className="relative text-right">
                  <span className="sr-only">Review</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {queue.map((r) => {
                const short = r.invoice.total - r.payment.amount;
                return (
                  <tr key={r.payment.id}>
                    <Td>
                      <Link href={`/admin/dealers/details?id=${r.payment.partnerId}`} className="font-medium hover:text-red">
                        {dealerName(r)}
                      </Link>
                      <p className="text-[12px] text-muted num">{r.ref}</p>
                    </Td>
                    <Td>
                      <Link href={`/admin/partner-billing/invoices/${r.invoice.id}`} className="font-medium num hover:text-red">
                        {r.invoice.number}
                      </Link>
                      <p className="text-[12px] text-muted num">{rupees(r.invoice.total)}</p>
                    </Td>
                    <Td>
                      <p className="font-semibold num">{rupees(r.payment.amount)}</p>
                      <p className="break-all text-[12px] text-muted">
                        {PAYMENT_METHOD_SHORT[r.payment.method]} · <span className="num">{r.payment.utr}</span>
                      </p>
                      {short !== 0 && <p className="text-[12px] font-medium text-[#9a5b00]">{short > 0 ? `${rupees(short)} short` : `${rupees(-short)} over`}</p>}
                      {r.payment.proof && (
                        <a href={`/dealer/files/${r.payment.proof.id}`} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-[12px] font-medium hover:text-red">
                          <Paperclip className="size-3" aria-hidden /> Proof
                        </a>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">{formatDate(r.payment.paidOn)}</Td>
                    <Td className="whitespace-nowrap text-muted">{formatDateTime(r.payment.createdAt)}</Td>
                    <Td className="text-right">
                      <PaymentReview
                        p={{
                          id: r.payment.id,
                          amount: r.payment.amount,
                          method: r.payment.method,
                          utr: r.payment.utr,
                          paidOn: r.payment.paidOn,
                          proof: r.payment.proof,
                          submittedAt: formatDateTime(r.payment.createdAt),
                          dealer: dealerName(r),
                          invoice: { number: r.invoice.number, total: r.invoice.total, plan: `${planNameOf(plans, r.invoice.plan)} plan`, period: `${formatDate(r.invoice.periodStart)} – ${formatDate(r.invoice.periodEnd)}` },
                        }}
                      />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          )}

          <h2 className="mb-3 mt-10 text-[15px] font-semibold">Recent decisions</h2>
          {decided.length === 0 ? (
            <Empty title="No payments decided yet">Verified and rejected payments are listed here.</Empty>
          ) : (
          <Table>
            <thead>
              <tr>
                <Th>Dealer</Th>
                <Th>Invoice</Th>
                <Th>Payment</Th>
                <Th>Decision</Th>
                <Th>Remarks</Th>
              </tr>
            </thead>
            <tbody>
              {decided.map((r) => (
                <tr key={r.payment.id}>
                  <Td>{dealerName(r)}</Td>
                  <Td>
                    <Link href={`/admin/partner-billing/invoices/${r.payment.invoiceId}`} className="num hover:text-red">
                      {r.number}
                    </Link>
                  </Td>
                  <Td>
                    <span className="font-medium num">{rupees(r.payment.amount)}</span>
                    <span className="block text-[12px] text-muted num">{r.payment.utr}</span>
                  </Td>
                  <Td>
                    <Badge tone={PAYMENT_STATUS_TONE[r.payment.status]}>{PAYMENT_STATUS_LABEL[r.payment.status]}</Badge>
                  </Td>
                  <Td className="max-w-[320px] text-[13px] text-muted">{r.payment.remarks ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          )}
        </>
      ) : (
        <>
          <FilterForm resetHref="/admin/partner-billing?tab=invoices" hasFilters={Boolean(dealerId || validStatus || q)}>
            <input type="hidden" name="tab" value="invoices" />
            <SearchInput value={q} placeholder="Invoice no. or dealer" />
            <FilterSelect name="dealer" label="All dealers" value={dealerId ? String(dealerId) : undefined} options={dealerOptions.map((d) => ({ value: String(d.id), label: `${d.name} (${d.reference})` }))} />
            <FilterSelect name="status" label="All statuses" value={validStatus} options={INVOICE_STATUS.map((v) => ({ value: v, label: INVOICE_STATUS_LABEL[v] }))} />
          </FilterForm>
          {invoices.length === 0 ? (
            <Empty title="No invoices match">{dealerId || validStatus || q ? "Try another dealer, status or search." : "Invoices issued to dealers appear here."}</Empty>
          ) : (
          <Table>
            <thead>
              <tr>
                <Th>Invoice</Th>
                <Th>Dealer</Th>
                <Th>Period</Th>
                <Th className="text-right">Total</Th>
                <Th>Due</Th>
                <Th>Status</Th>
                <Th className="relative text-right">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(({ invoice: i, ...d }) => {
                const display = invoiceDisplayStatus(i, today);
                return (
                  <tr key={i.id}>
                    <Td>
                      <Link href={`/admin/partner-billing/invoices/${i.id}`} className="font-medium num hover:text-red">
                        {i.number}
                      </Link>
                      <p className="text-[12px] text-muted">{planNameOf(plans, i.plan)} plan</p>
                    </Td>
                    <Td>
                      <Link href={`/admin/partner-billing?tab=invoices&dealer=${i.partnerId}`} className="hover:text-red">
                        {dealerName(d)}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap text-muted">
                      {formatDate(i.periodStart)} – {formatDate(i.periodEnd)}
                    </Td>
                    <Td className="text-right font-semibold num">{rupees(i.total)}</Td>
                    <Td className={cn("whitespace-nowrap", display === "overdue" && "font-medium text-red")}>{formatDate(i.dueOn)}</Td>
                    <Td>
                      <Badge tone={INVOICE_STATUS_TONE[display]}>{INVOICE_STATUS_LABEL[display]}</Badge>
                      {pendingByInvoice.has(i.id) && <p className="mt-1 text-[11.5px] text-muted">Payment waiting above</p>}
                    </Td>
                    <Td className="text-right">{i.status === "due" && <VoidInvoiceButton invoiceId={i.id} number={i.number} />}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          )}
          <Pagination base="/admin/partner-billing" params={{ tab: "invoices", dealer: dealerId ? String(dealerId) : undefined, status: validStatus, q }} page={page} pageSize={PAGE} total={Number(total)} />
        </>
      )}
    </>
  );
}
