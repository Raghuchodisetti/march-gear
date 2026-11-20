import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { INS_QUOTE_AUTHORIZATION } from "@/db/enums";
import { INS_QUOTE_AUTH_SHORT, INS_QUOTE_STATUS_LABEL } from "@/insurance/labels";
import { cn } from "@/lib/utils";
import { requireInsurer } from "@/server/insurance/context";
import { productOptions } from "@/server/insurance/crm";
import { QUOTE_DISPLAY_FILTERS, parseQuoteFilters, queryQuotes, quoteCounts, quoteFilterParams } from "@/server/insurance/quote-builder";
import { Pagination, PortalHeader, filterInput, hrefWith, pageParam } from "@/components/portal/ui";
import { formatIstDay, formatTime } from "@/components/portal/crm/pipeline";
import { istDate, rupees } from "@/components/portal/billing/shared";
import { AuthBadge, QuoteStatusBadge, formatDayShort } from "@/components/insurance/vendor/crm/badges";
import { daysFrom, formatMobile } from "@/components/insurance/vendor/crm/shared";

export const metadata: Metadata = { title: "Quotes" };

const PAGE_SIZE = 25;
const BASE = "/insurance-vendor/quotes";

export default async function Page({ searchParams }: PageProps<"/insurance-vendor/quotes">) {
  const ctx = await requireInsurer({ perm: "quotes.manage" });
  const sp = await searchParams;
  const f = parseQuoteFilters(sp);
  const page = pageParam(sp.page);
  const [list, counts, products] = await Promise.all([queryQuotes(ctx, f, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }), quoteCounts(ctx, f), productOptions(ctx.vendor.id)]);
  const params = quoteFilterParams(f);
  const hasFilters = Object.values(params).some(Boolean);
  const today = istDate();
  const chip = (active: boolean) =>
    cn(
      "inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-[3px] border px-3 text-[12.5px] font-medium transition-colors duration-300",
      active ? "border-ink bg-ink text-white" : "border-line bg-white text-ink/80 hover:border-ink/40",
    );

  return (
    <>
      <PortalHeader
        title="Quotes"
        description="Every quotation your team has prepared — drafts, sent, viewed and answered. Start a new one from a customer enquiry."
        actions={
          <Link href="/insurance-vendor/enquiries" className="inline-flex h-9 items-center gap-2 rounded-[3px] bg-ink px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-ink-3">
            <FileText aria-hidden className="size-4" /> New quote from an enquiry
          </Link>
        }
      />

      <nav aria-label="Filter by status" className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
        <Link href={hrefWith(BASE, params, { status: undefined, page: undefined })} className={chip(!f.status)}>
          All <span className={cn("num", f.status ? "text-muted" : "text-white/70")}>{counts.total}</span>
        </Link>
        {QUOTE_DISPLAY_FILTERS.map((s) => (
          <Link key={s} href={hrefWith(BASE, params, { status: s, page: undefined })} className={chip(f.status === s)}>
            {INS_QUOTE_STATUS_LABEL[s]} <span className={cn("num", f.status === s ? "text-white/70" : "text-muted")}>{counts.counts[s]}</span>
          </Link>
        ))}
      </nav>

      <form method="get" className="mb-5 flex flex-col gap-2 border border-line bg-white p-3 md:flex-row md:flex-wrap md:items-center">
        {f.status && <input type="hidden" name="status" value={f.status} />}
        {f.enquiry && <input type="hidden" name="enquiry" value={f.enquiry} />}
        <input type="search" name="q" defaultValue={f.q} placeholder="Quote or enquiry reference, customer, mobile" aria-label="Search quotes" className={cn(filterInput, "w-full md:w-80")} />
        <select name="auth" defaultValue={f.auth ?? ""} aria-label="Authorisation" className={cn(filterInput, "cursor-pointer")}>
          <option value="">Indicative & authorised</option>
          {INS_QUOTE_AUTHORIZATION.map((a) => (
            <option key={a} value={a}>
              {INS_QUOTE_AUTH_SHORT[a]}
            </option>
          ))}
        </select>
        <select name="product" defaultValue={f.product ? String(f.product) : ""} aria-label="Product" className={cn(filterInput, "min-w-0 cursor-pointer md:max-w-[220px]")}>
          <option value="">Any product</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-[12.5px] text-muted">
          From
          <input type="date" name="from" defaultValue={f.from} className={cn(filterInput, "min-w-0 flex-1")} />
        </label>
        <label className="flex items-center gap-2 text-[12.5px] text-muted">
          To
          <input type="date" name="to" defaultValue={f.to} className={cn(filterInput, "min-w-0 flex-1")} />
        </label>
        <div className="flex gap-2 md:ml-auto">
          {hasFilters && (
            <Link href={BASE} className="inline-flex h-10 items-center px-3 text-[13px] font-medium text-muted hover:text-ink">
              Reset
            </Link>
          )}
          <button type="submit" className="inline-flex h-10 flex-1 items-center justify-center rounded-[3px] bg-ink px-5 text-[13px] font-medium text-white transition-colors hover:bg-ink-3 md:flex-none">
            Apply
          </button>
        </div>
      </form>

      {list.rows.length === 0 ? (
        <div className="flex flex-col items-center border border-line bg-white px-6 py-16 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-mist">
            <FileText aria-hidden className="size-5 text-ink/60" />
          </span>
          <p className="mt-4 font-display text-[18px] font-semibold">{hasFilters ? "No quotes match" : "No quotes yet"}</p>
          <p className="mx-auto mt-2 max-w-md text-[14px] text-muted">{hasFilters ? "Clear the filters to see every quote." : "Open a customer enquiry and choose “Create quote” to build your first quotation."}</p>
        </div>
      ) : (
        <>
          <ul className="space-y-2 md:hidden">
            {list.rows.map((q) => (
              <li key={q.id}>
                <Link href={`${BASE}/${q.id}`} className="block border border-line bg-white p-4 active:bg-mist/60">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[13px] font-semibold">{q.reference}</p>
                      <p className="mt-0.5 truncate text-[13.5px]">{q.enquiry.name}</p>
                    </div>
                    <p className="shrink-0 text-[15px] font-semibold num">{rupees(q.total)}</p>
                  </div>
                  <p className="mt-2 truncate text-[12.5px] text-muted">{q.product?.name ?? "Product removed"}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <QuoteStatusBadge status={q.display} />
                    <AuthBadge auth={q.authorization} />
                    <span className="ml-auto text-[12px] text-muted num">valid until {formatDayShort(q.validUntil)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <div className="relative hidden overflow-x-auto border border-line bg-white md:block">
            <table className="w-full min-w-[960px] border-collapse text-left text-[13.5px]">
              <thead>
                <tr className="bg-mist/60 text-[12px] text-muted">
                  <th className="border-b border-line py-3 pl-4 pr-3 font-semibold">Quote</th>
                  <th className="border-b border-line px-3 py-3 font-semibold">Customer</th>
                  <th className="border-b border-line px-3 py-3 font-semibold">Product</th>
                  <th className="border-b border-line px-3 py-3 font-semibold">Authorisation</th>
                  <th className="border-b border-line px-3 py-3 text-right font-semibold">Total</th>
                  <th className="border-b border-line px-3 py-3 font-semibold">Valid until</th>
                  <th className="border-b border-line px-3 py-3 font-semibold">Status</th>
                  <th className="border-b border-line py-3 pl-3 pr-4 font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((q) => {
                  const left = daysFrom(today, q.validUntil);
                  const open = q.display === "submitted" || q.display === "viewed";
                  return (
                    <tr key={q.id} className="group relative transition-colors hover:bg-mist/50">
                      <td className="border-b border-line py-3.5 pl-4 pr-3 align-top">
                        <Link href={`${BASE}/${q.id}`} className="whitespace-nowrap font-mono text-[13px] font-semibold after:absolute after:inset-0 after:content-[''] group-hover:underline group-hover:underline-offset-4">
                          {q.reference}
                        </Link>
                        <p className="mt-0.5 whitespace-nowrap font-mono text-[11.5px] text-muted">{q.enquiry.reference}</p>
                      </td>
                      <td className="border-b border-line px-3 py-3.5 align-top">
                        <p className="max-w-[180px] truncate font-medium" title={q.enquiry.name}>{q.enquiry.name}</p>
                        <p className="text-[12px] text-muted num">+91 {formatMobile(q.enquiry.mobile)}</p>
                        <p className="max-w-[180px] truncate text-[12px] text-muted" title={q.enquiry.vehicle}>{q.enquiry.vehicle}</p>
                      </td>
                      <td className="border-b border-line px-3 py-3.5 align-top">
                        <p className="max-w-[170px] truncate" title={q.product?.name}>{q.product?.name ?? <span className="text-muted">Product removed</span>}</p>
                        {q.idv > 0 && <p className="text-[12px] text-muted num">IDV {rupees(q.idv)}</p>}
                      </td>
                      <td className="border-b border-line px-3 py-3.5 align-top">
                        <AuthBadge auth={q.authorization} />
                        {q.insurerQuoteRef && <p className="mt-1 max-w-[150px] truncate font-mono text-[11.5px] text-muted">{q.insurerQuoteRef}</p>}
                      </td>
                      <td className="border-b border-line px-3 py-3.5 text-right align-top font-semibold num">{rupees(q.total)}</td>
                      <td className="whitespace-nowrap border-b border-line px-3 py-3.5 align-top text-[13px] num">
                        {formatDayShort(q.validUntil)}
                        {open && <span className={cn("block text-[11.5px]", left <= 2 ? "text-[#9a5b00]" : "text-muted")}>{left === 0 ? "Expires today" : `${left} day${left === 1 ? "" : "s"} left`}</span>}
                      </td>
                      <td className="border-b border-line px-3 py-3.5 align-top">
                        <QuoteStatusBadge status={q.display} />
                        {q.viewedAt && q.display !== "viewed" && <p className="mt-1 text-[11.5px] text-muted">Viewed</p>}
                      </td>
                      <td className="whitespace-nowrap border-b border-line py-3.5 pl-3 pr-4 align-top text-[12.5px] text-muted num">
                        <span className="block text-ink/80">{formatIstDay(q.submittedAt ?? q.createdAt)}</span>
                        <span className="block">{q.submittedAt ? `Sent ${formatTime(q.submittedAt)}` : `Drafted ${formatTime(q.createdAt)}`}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {list.total > PAGE_SIZE && <Pagination base={BASE} params={params} page={page} pageSize={PAGE_SIZE} total={list.total} />}
      {list.total > 0 && list.total <= PAGE_SIZE && (
        <p className="mt-4 text-[13px] text-muted num">
          {list.total} quote{list.total === 1 ? "" : "s"}
        </p>
      )}
    </>
  );
}
