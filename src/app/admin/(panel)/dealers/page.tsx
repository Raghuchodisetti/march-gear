import type { Metadata } from "next";
import Link from "@/components/admin/desk";
import { ClipboardCheck, ExternalLink, FileSearch, ScrollText, Store } from "lucide-react";
import { PLAN_STATUS_LABEL } from "@/partner/labels";
import { planById } from "@/partner/plans";
import { PARTNER_SORTS, PARTNERS_PAGE_SIZE, listPartners } from "@/server/admin/partners";
import { requireStaff } from "@/server/auth";
import { Button } from "@/components/ui/button";
import { AdminHeader, FilterForm, Pagination, SearchInput, filterInput, formatDay, hrefWith, pageParam, strParam } from "@/components/admin/ui";
import { EmptyState, IN_REVIEW, LinkTabs, PartnerPill, WITH_DEALER, overdue, waitingLabel } from "@/components/admin/partner-ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dealer partners" };

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "queue", label: "Waiting for review" },
  { key: "with_dealer", label: "With dealer" },
  { key: "approved", label: "Approved" },
  { key: "suspended", label: "Suspended" },
  { key: "rejected", label: "Rejected" },
  { key: "deactivated", label: "Deactivated" },
  { key: "draft", label: "Drafts" },
] as const;

export default async function DealersPage({ searchParams }: PageProps<"/admin/dealers">) {
  await requireStaff();
  const sp = await searchParams;
  const params = { q: strParam(sp.q), status: strParam(sp.status), sort: strParam(sp.sort) };
  const { rows, total, page, byStatus, now } = await listPartners({ ...params, page: pageParam(sp.page) });
  const all = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const tabCount = (k: string) =>
    k === "" ? all : k === "queue" ? IN_REVIEW.reduce((a, s) => a + byStatus[s], 0) : k === "with_dealer" ? WITH_DEALER.reduce((a, s) => a + byStatus[s], 0) : byStatus[k as keyof typeof byStatus];
  const hasFilters = Boolean(params.q || params.sort);

  return (
    <>
      <AdminHeader
        title="Dealer partners"
        description="Every dealership that has applied to MarchGear — search, filter and open any partner to review it."
        actions={
          <>
            <Button href="/admin/approval-history" variant="outline" size="sm" icon={<ScrollText className="size-4" aria-hidden />}>
              Approval history
            </Button>
            <Button href="/admin/dealers/verification" size="sm" icon={<ClipboardCheck className="size-4" aria-hidden />}>
              Verification queue
            </Button>
          </>
        }
      />

      <LinkTabs active={params.status ?? ""} items={STATUS_TABS.map((t) => ({ key: t.key, label: t.label, count: tabCount(t.key), href: hrefWith("/admin/dealers", params, { status: t.key || undefined, page: undefined }) }))} />

      <FilterForm resetHref={hrefWith("/admin/dealers", { status: params.status }, {})} hasFilters={hasFilters}>
        {params.status && <input type="hidden" name="status" value={params.status} />}
        <SearchInput value={params.q} placeholder="Name, reference, GST, city, owner email…" />
        <select name="sort" defaultValue={params.sort ?? ""} aria-label="Sort" className={cn(filterInput, "cursor-pointer md:w-auto")}>
          {Object.entries(PARTNER_SORTS).map(([value, label]) => (
            <option key={value} value={value === "newest" ? "" : value}>
              {label}
            </option>
          ))}
        </select>
      </FilterForm>

      {rows.length === 0 ? (
        <div className="border border-line bg-white">
          <EmptyState icon={<Store className="size-5" aria-hidden />} title={params.q || params.status ? "No dealers match" : "No dealer applications yet"}>
            {params.q || params.status ? "Try another search or status." : "Dealerships appear here as soon as they start the partner application at /dealer/register."}
          </EmptyState>
        </div>
      ) : (
        <>
          {/* Phones: cards */}
          <ul className="space-y-3 md:hidden">
            {rows.map((d) => (
              <li key={d.id} className="border border-line bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/admin/dealers/details?id=${d.id}`} className="min-w-0">
                    <span className="block truncate text-[14.5px] font-semibold">{d.name}</span>
                    <span className="block truncate text-[12.5px] text-muted">
                      {d.reference} · {[d.city, d.state].filter(Boolean).join(", ") || "Location not set"}
                    </span>
                  </Link>
                  <PartnerPill status={d.status} />
                </div>
                <p className="mt-2 truncate text-[12.5px] text-muted">{d.ownerEmail}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button href={`/admin/dealers/details?id=${d.id}`} size="sm" variant="outline">
                    Open
                  </Button>
                  {IN_REVIEW.includes(d.status) && (
                    <Button href={`/admin/dealers/verification?id=${d.id}`} size="sm" icon={<FileSearch className="size-4" aria-hidden />}>
                      Review
                    </Button>
                  )}
                  {IN_REVIEW.includes(d.status) && <span className={cn("text-[12px]", overdue(d.submittedAt, now) ? "font-semibold text-red" : "text-muted")}>Waiting {waitingLabel(d.submittedAt, now)}</span>}
                </div>
              </li>
            ))}
          </ul>

          {/* Tablets & desktop: table */}
          <div className="hidden overflow-x-auto border border-line bg-white md:block">
            <table className="w-full min-w-[1080px] border-collapse text-left text-[13.5px]">
              <thead>
                <tr className="text-[12px] text-muted">
                  {["Dealer", "Owner", "Location", "GST", "Status", "Plan", "Activity", ""].map((h, i) => (
                    <th key={i} className="border-b border-line bg-mist/60 px-4 py-3 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => {
                  const waiting = IN_REVIEW.includes(d.status);
                  return (
                    <tr key={d.id} className="align-top transition-colors hover:bg-mist/40">
                      <td className="min-w-[230px] border-b border-line px-4 py-3">
                        <Link href={`/admin/dealers/details?id=${d.id}`} className="font-semibold hover:text-red">
                          {d.name}
                        </Link>
                        <span className="mt-0.5 block text-[12px] text-muted">
                          <span className="whitespace-nowrap">{d.reference}</span>
                          {d.legalName && d.tradeName && d.legalName !== d.tradeName ? ` · ${d.legalName}` : ""}
                        </span>
                      </td>
                      <td className="max-w-[220px] border-b border-line px-4 py-3">
                        <span className="block truncate">{d.ownerName}</span>
                        <span className="block truncate text-[12px] text-muted">{d.ownerEmail}</span>
                      </td>
                      <td className="min-w-[120px] border-b border-line px-4 py-3">{[d.city, d.state].filter(Boolean).join(", ") || <span className="text-muted">—</span>}</td>
                      <td className="border-b border-line px-4 py-3 font-mono text-[12.5px]">{d.gst || <span className="font-sans text-muted">—</span>}</td>
                      <td className="border-b border-line px-4 py-3">
                        <PartnerPill status={d.status} />
                        {d.status === "draft" && <span className="mt-1 block text-[11.5px] text-muted">Step {d.step} of 7</span>}
                      </td>
                      <td className="whitespace-nowrap border-b border-line px-4 py-3">
                        {d.status === "approved" || d.status === "suspended" ? (
                          <>
                            {planById(d.plan).name}
                            <span className="block text-[12px] text-muted">{PLAN_STATUS_LABEL[d.planStatus]}</span>
                          </>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap border-b border-line px-4 py-3 text-[12.5px]">
                        {waiting ? (
                          <span className={cn(overdue(d.submittedAt, now) ? "font-semibold text-red" : "text-ink")}>Waiting {waitingLabel(d.submittedAt, now)}</span>
                        ) : d.approvedAt ? (
                          <span>Approved {formatDay(d.approvedAt)}</span>
                        ) : (
                          <span className="text-muted">Joined {formatDay(d.createdAt)}</span>
                        )}
                        <span className="block text-muted num">
                          {d.vehicles} live listing{d.vehicles === 1 ? "" : "s"}
                          {d.pendingItems ? <span className="font-medium text-red"> · {d.pendingItems} to review</span> : null}
                        </span>
                      </td>
                      <td className="border-b border-line px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          {waiting && (
                            <Link href={`/admin/dealers/verification?id=${d.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-[3px] bg-red px-2.5 text-[12.5px] font-medium text-white hover:bg-red-600">
                              <FileSearch aria-hidden className="size-3.5" /> Review
                            </Link>
                          )}
                          <Link href={`/admin/dealers/details?id=${d.id}`} className="inline-flex h-8 items-center rounded-[3px] border border-line px-2.5 text-[12.5px] font-medium hover:border-ink">
                            Open
                          </Link>
                          {d.publicDealerId && d.status === "approved" && (
                            <Link href={`/dealers/${d.publicDealerId}`} target="_blank" aria-label={`Public listing of ${d.name}`} title="Public listing" className="inline-flex size-8 items-center justify-center rounded-[3px] border border-line text-muted hover:border-ink hover:text-ink">
                              <ExternalLink aria-hidden className="size-3.5" />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      <Pagination base="/admin/dealers" params={params} page={page} pageSize={PARTNERS_PAGE_SIZE} total={total} />
    </>
  );
}
