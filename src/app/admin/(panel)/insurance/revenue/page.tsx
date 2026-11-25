import type { Metadata } from "next";
import Link from "@/components/admin/desk";
import { ChevronDown, Download } from "lucide-react";
import { INS_INVOICE_KIND_LABEL } from "@/insurance/labels";
import { requireStaff } from "@/server/auth";
import { dayRange, insuranceSettings, loadLedger, recentInsPayments, summariseLedger, vendorLabel, type DayRange } from "@/server/admin/insurance-ops";
import { AdminHeader, Panel, Table, Td, Th, filterInput, formatDateTime, formatDay, hrefWith, strParam } from "@/components/admin/ui";
import { LinkTabs } from "@/components/admin/partner-ui";
import { buttonClasses } from "@/components/ui/button";
import { istDate, rupees } from "@/components/portal/billing/shared";
import { RevenueChart } from "@/components/admin/insurance/billing/revenue-chart";
import { BucketTable, Money, signed } from "@/components/admin/insurance/billing/kit";
import { PaymentPill, SectionTitle, VendorLink } from "@/components/admin/insurance/ops/kit";
import { METHOD_LABEL } from "@/components/admin/insurance/ops/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Revenue & billing" };

const BASE = "/admin/insurance/revenue";
const PERIODS = { all: "All time", month: "This month", "90": "Last 90 days", fy: "This financial year" } as const;
/** Tab order (object keys that look like numbers would sort first). */
const PERIOD_ORDER = ["all", "month", "90", "fy"] as const;
type Period = keyof typeof PERIODS | "custom";

function periodRange(period: Period, custom: DayRange, today: string): DayRange {
  if (period === "custom") return custom;
  if (period === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
  if (period === "90") return { from: new Date(Date.parse(`${today}T00:00:00Z`) - 89 * 86_400_000).toISOString().slice(0, 10), to: today };
  if (period === "fy") {
    const y = Number(today.slice(0, 4));
    const start = Number(today.slice(5, 7)) >= 4 ? y : y - 1;
    return { from: `${start}-04-01`, to: today };
  }
  return {};
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff();
  const sp = await searchParams;
  const today = istDate();
  const custom = dayRange(strParam(sp.from), strParam(sp.to));
  const p = strParam(sp.period);
  const period: Period = custom.from || custom.to ? "custom" : p && p in PERIODS ? (p as Period) : "all";
  const range = periodRange(period, custom, today);
  const [ledger, recent, settings] = await Promise.all([loadLedger(), recentInsPayments(12), insuranceSettings()]);
  const s = summariseLedger(ledger, range, today);
  const exportParams = { from: range.from, to: range.to };
  const label = period === "custom" ? `${range.from ? formatDay(range.from) : "Start"} – ${range.to ? formatDay(range.to) : "today"}` : PERIODS[period];
  const showLeadFees = settings.leadFeeEnabled || s.hasLeadFees;
  const ads = s.byKind.advertising;
  const subs = s.byKind.subscription;
  const leads = s.byKind.lead_fee;

  return (
    <>
      <AdminHeader
        title="Revenue & billing"
        description="Insurance vendor revenue. Collected is cash actually received — verified payments less refunds. Outstanding is what's still unpaid on open invoices. The two are never added together."
        actions={
          <details className="group relative">
            <summary className={cn(buttonClasses({ variant: "outline", size: "sm" }), "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>
              <Download className="size-4" aria-hidden /> Export CSV <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="absolute left-0 z-20 mt-1 w-64 max-w-[calc(100vw-32px)] border border-line bg-white py-1 shadow-soft md:left-auto md:right-0">
              {(
                [
                  ["summary", "Revenue summary", "KPIs, streams, months, vendors"],
                  ["invoices", "Invoices", "Issued in the period"],
                  ["payments", "Payments", "Paid in the period, every status"],
                  ["refunds", "Refunds", "Refunded in the period"],
                ] as const
              ).map(([type, name, note]) => (
                <a key={type} href={hrefWith(`${BASE}/export`, exportParams, { type })} download className="block px-4 py-2.5 text-[13px] hover:bg-mist">
                  <span className="block font-medium">{name}</span>
                  <span className="block text-[12px] text-muted">{note}</span>
                </a>
              ))}
            </div>
          </details>
        }
      />

      <LinkTabs
        className="mb-3"
        active={period}
        items={[
          ...PERIOD_ORDER.map((k) => ({ key: k, label: PERIODS[k], href: hrefWith(BASE, {}, { period: k === "all" ? undefined : k }) })),
          ...(period === "custom" ? [{ key: "custom", label: "Custom", href: hrefWith(BASE, exportParams, {}) }] : []),
        ]}
      />
      <form method="get" className="mb-6 flex flex-wrap items-center gap-2 text-[13px]">
        <span className="basis-full text-muted sm:basis-auto">Custom period (IST)</span>
        <input type="date" name="from" defaultValue={custom.from} aria-label="From" className={cn(filterInput, "min-w-0 flex-1 sm:w-[150px] sm:flex-none")} />
        <span className="text-muted">to</span>
        <input type="date" name="to" defaultValue={custom.to} aria-label="To" className={cn(filterInput, "min-w-0 flex-1 sm:w-[150px] sm:flex-none")} />
        <button type="submit" className="inline-flex h-10 items-center rounded-[3px] bg-ink px-4 text-[13px] font-medium text-white hover:bg-ink-3">
          Apply
        </button>
      </form>

      {/* Money in vs money owed — two separate bands, never summed. */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section aria-labelledby="collected-h" className="min-w-0 border border-line bg-white">
          <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-3">
            <h2 id="collected-h" className="text-[13px] font-semibold">
              Collected <span className="font-normal text-muted">· {label}</span>
            </h2>
            <p className="text-[12px] text-muted">Verified payments − refunds, by the day paid</p>
          </header>
          <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3 [&>*:first-child]:col-span-2 [&>*:last-child]:col-span-2 sm:[&>*:first-child]:col-span-3 sm:[&>*:last-child]:col-span-1">
            <Money label="Total collected" value={s.collected} tone="green" size="lg" note="Verified payments less refunds, incl. GST" />
            <Money label="Verified payments" value={s.gross} note="Before refunds" href="/admin/insurance/payments?status=verified" />
            <Money label="Refunds" value={s.refunded} note="Paid back" href="/admin/insurance/refunds" />
            <Money label="Net revenue" value={s.net} note="Collected, excl. GST" />
          </div>
        </section>
        <section aria-labelledby="outstanding-h" className="min-w-0 border border-line border-l-[3px] border-l-[#9a5b00] bg-white">
          <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-3">
            <h2 id="outstanding-h" className="text-[13px] font-semibold">
              Outstanding <span className="font-normal text-muted">· as of today</span>
            </h2>
            <p className="text-[12px] text-muted">Not collected</p>
          </header>
          <div className="grid grid-cols-2 gap-px bg-line [&>*:first-child]:col-span-2">
            <Money label="Unpaid invoices" value={s.outstanding} tone="amber" size="lg" note={`${s.outstandingCount} invoice${s.outstandingCount === 1 ? "" : "s"}`} href="/admin/insurance/invoices?status=unpaid" />
            <Money label="Overdue" value={s.overdue} tone={s.overdue ? "red" : undefined} note={`${s.overdueCount} past due`} href="/admin/insurance/invoices?status=overdue" />
            <Money label="Awaiting verification" value={s.awaitingVerification} note={`${s.awaitingCount} payment${s.awaitingCount === 1 ? "" : "s"} to check`} href="/admin/insurance/payments" />
          </div>
        </section>
      </div>

      <div className={cn("mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2", showLeadFees ? "xl:grid-cols-4" : "xl:grid-cols-3")}>
        {[
          { label: "Advertising revenue", b: ads, href: "/admin/advertising" },
          { label: "Vendor subscriptions", b: subs, href: "/admin/insurance/invoices?kind=subscription" },
          ...(showLeadFees ? [{ label: "Lead generation (where permitted)", b: leads, href: "/admin/insurance/invoices?kind=lead_fee" }] : []),
        ].map(({ label: l, b, href }) => (
          <div key={l} className="border border-line bg-white">
            <Money label={l} value={b?.collected ?? 0} note={`${rupees(b?.invoiced ?? 0)} invoiced · ${rupees(b?.outstanding ?? 0)} outstanding`} href={href} />
          </div>
        ))}
        <div className="border border-line bg-white p-5">
          <p className="text-[12.5px] font-medium text-muted">Placement revenue</p>
          {s.byPlacement.length === 0 ? (
            <p className="mt-2 text-[13px] text-muted">No advertising invoices in this period.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {s.byPlacement.slice(0, 4).map((pl) => (
                <li key={pl.key} className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="min-w-0 truncate">{pl.label}</span>
                  <span className="shrink-0 font-semibold num">{signed(pl.collected)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[12px] text-muted">Advertising collected, by placement</p>
        </div>
      </div>
      {!showLeadFees && <p className="mt-2 text-[12px] text-muted">Lead-generation revenue is hidden: lead fees are off in insurance settings and none have been invoiced.</p>}

      <SectionTitle>Monthly revenue — last 12 months</SectionTitle>
      <Panel>
        <RevenueChart months={s.monthly} />
        <details className="mt-4 border-t border-line pt-3">
          <summary className="cursor-pointer text-[13px] font-medium text-muted hover:text-ink">Show as a table</summary>
          <div className="relative mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-[13px]">
              <thead>
                <tr className="text-[12px] text-muted">
                  <th className="border-b border-line py-2 font-semibold">Month</th>
                  <th className="border-b border-line py-2 text-right font-semibold">Invoiced</th>
                  <th className="border-b border-line py-2 text-right font-semibold">Collected</th>
                </tr>
              </thead>
              <tbody>
                {s.monthly.map((m) => (
                  <tr key={m.month}>
                    <td className="border-b border-line py-2">
                      {MONTHS[Number(m.month.slice(5, 7)) - 1]} {m.month.slice(0, 4)}
                    </td>
                    <td className="border-b border-line py-2 text-right num">{rupees(m.invoiced)}</td>
                    <td className="border-b border-line py-2 text-right num">{rupees(m.collected)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Panel>

      <div className="grid grid-cols-1 gap-x-6 xl:grid-cols-2">
        <div className="min-w-0">
          <SectionTitle>Revenue by vendor</SectionTitle>
          <div className="border border-line bg-white">
            <BucketTable rows={s.byVendor} first="Vendor" empty="No vendor billing in this period." />
          </div>
        </div>
        <div className="min-w-0">
          <SectionTitle>Revenue by stream</SectionTitle>
          <div className="border border-line bg-white">
            <BucketTable rows={s.kinds.filter((k) => showLeadFees || k.key !== "lead_fee").map((k) => ({ ...k, label: INS_INVOICE_KIND_LABEL[k.key as keyof typeof INS_INVOICE_KIND_LABEL] ?? k.label, href: `/admin/insurance/invoices?kind=${k.key}` }))} first="Stream" empty="No invoices yet." />
          </div>
        </div>
        <div className="min-w-0">
          <SectionTitle action={<Link href="/admin/advertising" className="text-[13px] font-medium text-red hover:underline">Ad campaigns</Link>}>Revenue by ad campaign</SectionTitle>
          <div className="border border-line bg-white">
            <BucketTable rows={s.byCampaign} first="Ad campaign" empty="No advertising invoices in this period." />
          </div>
        </div>
        <div className="min-w-0">
          <SectionTitle>Revenue by product category</SectionTitle>
          <div className="border border-line bg-white">
            <BucketTable rows={s.byCategory} first="Category" empty="No invoices in this period." />
          </div>
          <p className="mt-2 text-[12px] text-muted">Sponsored-product advertising is counted under its product&apos;s category; everything else is not product-specific.</p>
        </div>
        <div className="min-w-0">
          <SectionTitle>Advertising by placement</SectionTitle>
          <div className="border border-line bg-white">
            <BucketTable rows={s.byPlacement} first="Placement" empty="No advertising invoices in this period." />
          </div>
        </div>
      </div>

      <SectionTitle action={<Link href="/admin/insurance/payments" className="text-[13px] font-medium text-red hover:underline">All payments</Link>}>Payment history</SectionTitle>
      {recent.length === 0 ? (
        <div className="border border-line bg-white px-5 py-10 text-center text-[13.5px] text-muted">No payments recorded yet.</div>
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
            </tr>
          </thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r.p.id}>
                <Td className="max-w-[220px]">
                  <VendorLink id={r.vendorId} name={vendorLabel(r)} />
                </Td>
                <Td>
                  <Link href={`/admin/insurance/invoices/${r.p.invoiceId}`} className="font-medium num hover:text-red">
                    {r.invoiceNumber}
                  </Link>
                  <p className="text-[12px] text-muted">{INS_INVOICE_KIND_LABEL[r.invoiceKind]}</p>
                </Td>
                <Td className="text-right font-semibold num">{rupees(r.p.amount)}</Td>
                <Td>
                  <p>{METHOD_LABEL[r.p.method]}</p>
                  <p className="break-all text-[12px] text-muted num">{r.p.utr}</p>
                </Td>
                <Td className="whitespace-nowrap">{formatDay(r.p.paidOn)}</Td>
                <Td>
                  <PaymentPill status={r.p.status} />
                  <p className="mt-1 text-[11.5px] text-muted">{r.p.verifiedAt ? `${r.verifier ?? "Staff"} · ${formatDateTime(r.p.verifiedAt)}` : `Recorded ${formatDateTime(r.p.createdAt)}`}</p>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
