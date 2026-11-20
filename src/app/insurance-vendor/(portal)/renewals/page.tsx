import type { Metadata } from "next";
import Link from "next/link";
import { INS_RENEWAL_STATUS } from "@/db/enums";
import { INS_RENEWAL_STATUS_LABEL } from "@/insurance/labels";
import { cn } from "@/lib/utils";
import { requireInsurer, vendorName } from "@/server/insurance/context";
import { RENEWAL_WINDOWS, enquiryAccess, getRenewal, parseRenewalFilters, queryRenewals, renewalCounts, renewalFilterParams, teamMembers } from "@/server/insurance/crm";
import { insuranceSettings } from "@/server/insurance/quote-builder";
import { Pagination, PortalHeader, filterInput, hrefWith, pageParam } from "@/components/portal/ui";
import { LinkTabs } from "@/components/admin/partner-ui";
import { istDate } from "@/components/portal/billing/shared";
import { RenewalsView } from "@/components/insurance/vendor/renewals/renewals-view";

export const metadata: Metadata = { title: "Renewals" };

const PAGE_SIZE = 25;
const BASE = "/insurance-vendor/renewals";

export default async function Page({ searchParams }: PageProps<"/insurance-vendor/renewals">) {
  const ctx = await requireInsurer({ perm: "renewals.manage" });
  const sp = await searchParams;
  const { renewalWindowDays } = await insuranceSettings();
  const f = parseRenewalFilters(sp, renewalWindowDays);
  const page = pageParam(sp.page);
  const viewAll = enquiryAccess(ctx) === "all";
  const openId = Number.parseInt(typeof sp.renewal === "string" ? sp.renewal : "", 10);

  const [list, counts, members, selected] = await Promise.all([
    queryRenewals(ctx, f, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    renewalCounts(ctx, f, renewalWindowDays),
    teamMembers(ctx.vendor.id),
    Number.isFinite(openId) && openId > 0 ? getRenewal(ctx, openId) : Promise.resolve(null),
  ]);
  const params = renewalFilterParams(f, renewalWindowDays);
  const windows = [...new Set([...RENEWAL_WINDOWS, renewalWindowDays])].sort((a, b) => a - b);
  const hasFilters = Boolean(f.q || f.status || f.assigned || f.sort !== "expiry");
  const tab = (view: string, label: string, count: number) => ({ key: view, label, count, href: hrefWith(BASE, { ...params, view: view === "upcoming" ? undefined : view, within: undefined, page: undefined, renewal: undefined }, {}) });

  const emptyHint =
    f.view === "upcoming"
      ? `No open renewals expire in the next ${f.within} days${hasFilters ? " with these filters" : ""}. Renewal enquiries from customers, policies you mark as issued and renewals you add appear here.`
      : f.view === "overdue"
        ? "No overdue follow-ups. Nice work."
        : f.view === "expired"
          ? "No expired or lapsed policies."
          : f.view === "renewed"
            ? "Nothing renewed yet."
            : "Renewal enquiries from customers, policies you mark as issued and renewals you add yourself appear here.";

  return (
    <>
      <PortalHeader
        title="Renewals"
        description={viewAll ? `Policies coming up for renewal — upcoming means expiring within ${renewalWindowDays} days (your renewal window).` : "Renewals assigned to you."}
      />

      <LinkTabs
        active={f.view}
        items={[
          tab("upcoming", `Upcoming · ${f.view === "upcoming" ? f.within : renewalWindowDays} days`, counts.views.upcoming),
          tab("overdue", "Overdue follow-ups", counts.views.overdue),
          tab("expired", "Expired or lapsed", counts.views.expired),
          tab("renewed", "Renewed", counts.views.renewed),
          tab("all", "All", counts.views.all),
        ]}
      />

      {f.view === "upcoming" && (
        <nav aria-label="Expiring within" className="mb-4 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[12.5px] text-muted">Expiring within</span>
          {windows.map((w) => (
            <Link
              key={w}
              href={hrefWith(BASE, { ...params, within: w === renewalWindowDays ? undefined : String(w), page: undefined, renewal: undefined }, {})}
              aria-current={f.within === w ? "page" : undefined}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-[3px] border px-3 text-[12.5px] font-medium transition-colors",
                f.within === w ? "border-ink bg-ink text-white" : "border-line bg-white text-ink/80 hover:border-ink/40",
              )}
            >
              {w} days <span className={cn("num", f.within === w ? "text-white/70" : "text-muted")}>{counts.windows[w] ?? 0}</span>
            </Link>
          ))}
        </nav>
      )}

      <form method="get" className="mb-5 flex flex-col gap-2 border border-line bg-white p-3 md:flex-row md:flex-wrap md:items-center">
        {f.view !== "upcoming" && <input type="hidden" name="view" value={f.view} />}
        {f.view === "upcoming" && f.within !== renewalWindowDays && <input type="hidden" name="within" value={f.within} />}
        <input type="search" name="q" defaultValue={f.q} placeholder="Name, mobile, registration or policy no." aria-label="Search renewals" className={cn(filterInput, "w-full md:w-80")} />
        <select name="status" defaultValue={f.status ?? ""} aria-label="Status" className={cn(filterInput, "cursor-pointer")}>
          <option value="">All statuses</option>
          {INS_RENEWAL_STATUS.map((s) => (
            <option key={s} value={s}>
              {INS_RENEWAL_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        {viewAll && (
          <select name="assigned" defaultValue={f.assigned ?? ""} aria-label="Assigned executive" className={cn(filterInput, "cursor-pointer")}>
            <option value="">Any executive</option>
            <option value="me">Assigned to me</option>
            <option value="none">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        )}
        <select name="sort" defaultValue={f.sort} aria-label="Sort" className={cn(filterInput, "cursor-pointer")}>
          <option value="expiry">Expiring soonest</option>
          <option value="follow_up">Follow-up due soonest</option>
          <option value="newest">Recently added</option>
        </select>
        <div className="flex gap-2 md:ml-auto">
          {hasFilters && (
            <Link href={hrefWith(BASE, { view: params.view, within: params.within }, {})} className="inline-flex h-10 items-center px-3 text-[13px] font-medium text-muted hover:text-ink">
              Reset
            </Link>
          )}
          <button type="submit" className="inline-flex h-10 flex-1 items-center justify-center rounded-[3px] bg-ink px-5 text-[13px] font-medium text-white transition-colors hover:bg-ink-3 md:flex-none">
            Apply
          </button>
        </div>
      </form>

      <RenewalsView
        rows={list.rows}
        selected={selected}
        members={members}
        can={{ assign: ctx.can("enquiries.assign") && viewAll, quotes: ctx.can("quotes.manage") }}
        now={new Date().getTime()}
        today={istDate()}
        vendorName={vendorName(ctx.vendor)}
        emptyHint={emptyHint}
      />
      {list.total > PAGE_SIZE && <Pagination base={BASE} params={params} page={page} pageSize={PAGE_SIZE} total={list.total} />}
      {list.total > 0 && list.total <= PAGE_SIZE && (
        <p className="mt-4 text-[13px] text-muted num">
          {list.total} renewal{list.total === 1 ? "" : "s"}
        </p>
      )}
    </>
  );
}
