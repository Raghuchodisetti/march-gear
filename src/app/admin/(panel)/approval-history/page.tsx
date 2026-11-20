import type { Metadata } from "next";
import Link from "next/link";
import { Download, Lock, ScrollText } from "lucide-react";
import { APPROVAL_TARGETS } from "@/db/enums";
import { HISTORY_PAGE_SIZE, historyFilterOptions, isCalendarDay, listApprovalHistory } from "@/server/admin/partners";
import { requireStaff } from "@/server/auth";
import { buttonClasses } from "@/components/ui/button";
import { AdminHeader, FilterForm, FilterSelect, Pagination, SearchInput, filterInput, formatDateTime, hrefWith, pageParam, strParam } from "@/components/admin/ui";
import { HistoryList, statusLabel } from "@/components/admin/partner-history";
import { ActionPill, EmptyState, TARGET_LABEL, actionLabel, targetHref } from "@/components/admin/partner-ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Approval history" };

const SIDES = [
  { value: "admin", label: "MarchGear staff" },
  { value: "dealer", label: "Dealers" },
  { value: "system", label: "System" },
];
const dateParam = (v: string | string[] | undefined) => {
  const s = strParam(v);
  return isCalendarDay(s) ? s : undefined;
};

export default async function ApprovalHistoryPage({ searchParams }: PageProps<"/admin/approval-history">) {
  await requireStaff();
  const sp = await searchParams;
  const params = {
    q: strParam(sp.q),
    partner: strParam(sp.partner),
    target: strParam(sp.target),
    action: strParam(sp.action),
    side: strParam(sp.side),
    from: dateParam(sp.from),
    to: dateParam(sp.to),
  };
  const [{ rows, total, page }, options] = await Promise.all([listApprovalHistory({ ...params, page: pageParam(sp.page) }), historyFilterOptions()]);
  const hasFilters = Object.values(params).some(Boolean);
  const base = "/admin/approval-history";

  return (
    <>
      <AdminHeader
        title="Approval history"
        description="Every submission and decision across dealer accounts, documents, brands, vehicles, offers and change requests — with staff-only internal notes."
        actions={
          <a href={hrefWith(`${base}/export`, params, {})} download className={buttonClasses({ variant: "outline", size: "sm" })}>
            <Download className="size-4" aria-hidden /> Export CSV
          </a>
        }
      />

      <FilterForm resetHref={base} hasFilters={hasFilters}>
        <SearchInput value={params.q} placeholder="Remarks, dealer, reference, person…" />
        <FilterSelect name="partner" label="All dealers" value={params.partner} options={options.dealers} />
        <FilterSelect name="target" label="Every workflow" value={params.target} options={APPROVAL_TARGETS.map((t) => ({ value: t, label: TARGET_LABEL[t] }))} />
        <FilterSelect name="action" label="Any action" value={params.action} options={options.actions.map((a) => ({ value: a, label: actionLabel(a) }))} />
        <FilterSelect name="side" label="Anyone" value={params.side} options={SIDES} />
        <fieldset className="flex min-w-0 items-center gap-2">
          <legend className="sr-only">Between (IST)</legend>
          <input type="date" name="from" defaultValue={params.from} aria-label="From (IST)" className={cn(filterInput, "min-w-0 flex-1 md:w-[150px] md:flex-none")} />
          <span className="text-[12.5px] text-muted">to</span>
          <input type="date" name="to" defaultValue={params.to} aria-label="To (IST)" className={cn(filterInput, "min-w-0 flex-1 md:w-[150px] md:flex-none")} />
        </fieldset>
      </FilterForm>

      {rows.length === 0 ? (
        <div className="border border-line bg-white">
          <EmptyState icon={<ScrollText aria-hidden className="size-5" />} title={hasFilters ? "Nothing matches these filters" : "No history yet"}>
            {hasFilters ? "Try a wider date range or fewer filters." : "Applications, submissions and decisions are recorded here as they happen."}
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="border border-line bg-white p-4 md:hidden">
            <HistoryList entries={rows} showPartner />
          </div>
          <div className="hidden overflow-x-auto border border-line bg-white md:block">
            <table className="w-full min-w-[1040px] border-collapse text-left text-[13.5px]">
              <thead>
                <tr className="text-[12px] text-muted">
                  {["When (IST)", "Dealer", "About", "Action", "Status", "Remarks", "By"].map((h) => (
                    <th key={h} className="border-b border-line bg-mist/60 px-4 py-3 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const internal = r.action === "internal_note";
                  const from = statusLabel(r.target, r.fromStatus);
                  const to = statusLabel(r.target, r.toStatus);
                  return (
                    <tr key={r.id} className={cn("align-top transition-colors hover:bg-mist/40", internal && "bg-mist/40")}>
                      <td className="min-w-[120px] border-b border-line px-4 py-3 text-[12.5px]">{formatDateTime(r.createdAt)}</td>
                      <td className="max-w-[200px] border-b border-line px-4 py-3">
                        <Link href={`/admin/dealers/details?id=${r.partnerId}`} className="block truncate font-medium hover:text-red">
                          {r.partnerName || r.partnerRef}
                        </Link>
                        <span className="text-[12px] text-muted">{r.partnerRef}</span>
                      </td>
                      <td className="min-w-[150px] max-w-[220px] border-b border-line px-4 py-3">
                        <Link href={targetHref(r.target, r.targetId, r.partnerId)} className="hover:text-red">
                          {TARGET_LABEL[r.target]}
                        </Link>
                        {r.targetLabel && <span className="block truncate text-[12px] text-muted">{r.targetLabel}</span>}
                      </td>
                      <td className="border-b border-line px-4 py-3">
                        <ActionPill action={r.action} />
                        {internal && (
                          <span className="mt-1 flex items-center gap-1 text-[11px] text-muted">
                            <Lock aria-hidden className="size-3" /> Staff only
                          </span>
                        )}
                      </td>
                      <td className="min-w-[140px] border-b border-line px-4 py-3 text-[12.5px]">{from || to ? <>{from ?? "—"} → <span className="font-medium">{to ?? "—"}</span></> : <span className="text-muted">—</span>}</td>
                      <td className="min-w-[220px] max-w-[300px] border-b border-line px-4 py-3">
                        {r.remarks ? <p className="line-clamp-4 whitespace-pre-line break-words text-[13px]">{r.remarks}</p> : <span className="text-muted">—</span>}
                      </td>
                      <td className="whitespace-nowrap border-b border-line px-4 py-3 text-[12.5px]">
                        {r.actorName ?? "—"}
                        <span className="block text-muted">{r.actorSide === "admin" ? "MarchGear" : r.actorSide === "dealer" ? "Dealer" : "System"}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      <Pagination base={base} params={params} page={page} pageSize={HISTORY_PAGE_SIZE} total={total} />
    </>
  );
}
