import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlarmClock, CalendarClock, Download, SlidersHorizontal } from "lucide-react";
import { INS_INTENTS, INS_LEAD_STATUS } from "@/db/enums";
import { INS_INTENT_LABEL, INS_LEAD_STATUS_LABEL, INS_LEAD_STATUS_TONE } from "@/insurance/labels";
import { cn } from "@/lib/utils";
import { requireInsurer } from "@/server/insurance/context";
import { enquiryAccess, enquiryCounts, enquiryFilterParams, parseEnquiryFilters, productOptions, queryEnquiries, sourceOptions, teamMembers } from "@/server/insurance/crm";
import { Pagination, PortalHeader, filterInput, hrefWith, pageParam } from "@/components/portal/ui";
import { istDate } from "@/components/portal/billing/shared";
import { EnquiryTable } from "@/components/insurance/vendor/crm/enquiry-table";
import { sourceLabel } from "@/components/insurance/vendor/crm/shared";

export const metadata: Metadata = { title: "Customer enquiries" };

const PAGE_SIZE = 25;
const BASE = "/insurance-vendor/enquiries";

const DOT: Record<string, string> = {
  red: "bg-red",
  amber: "bg-[#d68a00]",
  blue: "bg-[#2456a6]",
  green: "bg-[#1e7a3c]",
  neutral: "bg-muted",
  dark: "bg-ink",
};

export default async function Page({ searchParams }: PageProps<"/insurance-vendor/enquiries">) {
  const ctx = await requireInsurer();
  const access = enquiryAccess(ctx);
  if (!access) redirect("/insurance-vendor/dashboard?denied=1");
  const sp = await searchParams;
  const f = parseEnquiryFilters(sp);
  const page = pageParam(sp.page);
  const viewAll = access === "all";

  const [list, counts, members, products, sources] = await Promise.all([
    queryEnquiries(ctx, f, {
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    enquiryCounts(ctx, f),
    viewAll ? teamMembers(ctx.vendor.id) : Promise.resolve([]),
    productOptions(ctx.vendor.id),
    sourceOptions(ctx.vendor.id),
  ]);

  const params = enquiryFilterParams(f);
  const exportQuery = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1]))).toString();
  const hasFilters = Object.values(params).some(Boolean);
  const moreOpen = Boolean(f.source || f.from || f.to || f.due);
  const chip = (active: boolean) =>
    cn(
      "inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-[3px] border px-3 text-[12.5px] font-medium transition-colors duration-300",
      active ? "border-ink bg-ink text-white" : "border-line bg-white text-ink/80 hover:border-ink/40",
    );

  return (
    <>
      <PortalHeader
        title="Customer enquiries"
        description={
          viewAll ? "Quote requests from MarchGear customers for your products — plus the renewals your team prepares quotes for." : "Enquiries assigned to you. Your manager assigns new ones."
        }
        actions={
          <a
            href={`${BASE}/export${exportQuery ? `?${exportQuery}` : ""}`}
            className="inline-flex h-9 items-center gap-2 rounded-[3px] border border-ink/15 bg-white px-3.5 text-[13px] font-medium transition-colors hover:border-ink"
          >
            <Download aria-hidden className="size-4" /> Export CSV
          </a>
        }
      />

      {/* Counts by status for the current filters */}
      <nav aria-label="Filter by status" className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
        <Link href={hrefWith(BASE, params, { status: undefined, page: undefined })} className={chip(!f.status)} aria-current={!f.status ? "page" : undefined}>
          All <span className={cn("num", f.status ? "text-muted" : "text-white/70")}>{counts.total}</span>
        </Link>
        {INS_LEAD_STATUS.map((s) => (
          <Link key={s} href={hrefWith(BASE, params, { status: s, page: undefined })} className={chip(f.status === s)} aria-current={f.status === s ? "page" : undefined}>
            <span aria-hidden className={cn("size-1.5 rounded-full", DOT[INS_LEAD_STATUS_TONE[s]])} />
            {INS_LEAD_STATUS_LABEL[s]} <span className={cn("num", f.status === s ? "text-white/70" : "text-muted")}>{counts.byStatus[s]}</span>
          </Link>
        ))}
      </nav>
      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href={hrefWith(BASE, params, {
            due: f.due === "today" ? undefined : "today",
            page: undefined,
          })}
          className={chip(f.due === "today")}
        >
          <CalendarClock aria-hidden className="size-3.5" /> Follow-ups due today <span className="num">{counts.dueToday}</span>
        </Link>
        <Link
          href={hrefWith(BASE, params, {
            due: f.due === "overdue" ? undefined : "overdue",
            page: undefined,
          })}
          className={cn(chip(f.due === "overdue"), f.due !== "overdue" && counts.overdue > 0 && "border-red/30 text-red")}
        >
          <AlarmClock aria-hidden className="size-3.5" /> Overdue <span className="num">{counts.overdue}</span>
        </Link>
      </div>

      <form method="get" className="mb-5 border border-line bg-white">
        <div className="flex flex-col gap-2 p-3 md:flex-row md:flex-wrap md:items-center">
          <input type="search" name="q" defaultValue={f.q} placeholder="Name, mobile, registration or reference" aria-label="Search enquiries" className={cn(filterInput, "w-full md:w-80")} />
          <div className="grid grid-cols-2 gap-2 md:contents">
            <select name="status" defaultValue={f.status ?? ""} aria-label="Status" className={cn(filterInput, "min-w-0 cursor-pointer")}>
              <option value="">All statuses</option>
              {INS_LEAD_STATUS.map((s) => (
                <option key={s} value={s}>
                  {INS_LEAD_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <select name="intent" defaultValue={f.intent ?? ""} aria-label="Intent" className={cn(filterInput, "min-w-0 cursor-pointer")}>
              <option value="">New & renewal</option>
              {INS_INTENTS.map((s) => (
                <option key={s} value={s}>
                  {INS_INTENT_LABEL[s]}
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
            {viewAll && (
              <select name="assigned" defaultValue={f.assigned ?? ""} aria-label="Assigned to" className={cn(filterInput, "min-w-0 cursor-pointer")}>
                <option value="">Anyone</option>
                <option value="me">Assigned to me</option>
                <option value="none">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
            <select name="sort" defaultValue={f.sort} aria-label="Sort" className={cn(filterInput, "min-w-0 cursor-pointer")}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="follow_up">Follow-up due soonest</option>
              <option value="expiry">Policy expiring soonest</option>
              <option value="updated">Recently updated</option>
              <option value="name">Customer A–Z</option>
            </select>
          </div>
          <div className="flex gap-2 md:ml-auto">
            {hasFilters && (
              <Link href={BASE} className="inline-flex h-10 items-center px-3 text-[13px] font-medium text-muted hover:text-ink">
                Reset
              </Link>
            )}
            <button
              type="submit"
              className="inline-flex h-10 flex-1 items-center justify-center rounded-[3px] bg-ink px-5 text-[13px] font-medium text-white transition-colors hover:bg-ink-3 md:flex-none"
            >
              Apply
            </button>
          </div>
        </div>
        <details open={moreOpen} className="group border-t border-line">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-[12.5px] font-medium text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
            <SlidersHorizontal aria-hidden className="size-3.5" /> More filters
            <span className="text-muted/70 group-open:hidden">· source, dates, follow-ups</span>
          </summary>
          <div className="grid grid-cols-1 gap-2 px-3 pb-3 sm:grid-cols-2 lg:grid-cols-4">
            <select name="source" defaultValue={f.source ?? ""} aria-label="Source" className={cn(filterInput, "min-w-0 cursor-pointer")}>
              <option value="">Any source</option>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {sourceLabel(s)}
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
            <select name="due" defaultValue={f.due ?? ""} aria-label="Follow-up" className={cn(filterInput, "min-w-0 cursor-pointer")}>
              <option value="">Any follow-up</option>
              <option value="today">Follow-up due today</option>
              <option value="overdue">Follow-up overdue</option>
            </select>
          </div>
        </details>
      </form>

      <EnquiryTable
        rows={list.rows}
        now={new Date().getTime()}
        today={istDate()}
        sort={f.sort}
        params={params}
        emptyTitle={hasFilters ? "No enquiries match" : "No enquiries yet"}
        emptyHint={
          hasFilters
            ? "Nothing matches these filters. Clear them to see every enquiry."
            : viewAll
              ? "When customers ask for a quote on one of your published products, the enquiry arrives here."
              : "When an enquiry is assigned to you, it appears here."
        }
      />
      {list.total > PAGE_SIZE && <Pagination base={BASE} params={params} page={page} pageSize={PAGE_SIZE} total={list.total} />}
      {list.total > 0 && list.total <= PAGE_SIZE && (
        <p className="mt-4 text-[13px] text-muted num">
          {list.total} enquir{list.total === 1 ? "y" : "ies"}
        </p>
      )}
    </>
  );
}
