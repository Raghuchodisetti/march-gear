import type { Metadata } from "next";
import Link from "@/components/admin/desk";
import { ClipboardCheck, FileSearch, Landmark, ShieldCheck } from "lucide-react";
import { INS_VENDOR_CATEGORIES } from "@/db/enums";
import { INS_VENDOR_CATEGORY_SHORT, INS_VENDOR_IN_REVIEW } from "@/insurance/labels";
import { PLAN_STATUS_LABEL } from "@/partner/labels";
import { INS_VENDOR_SORTS, INS_VENDORS_PAGE_SIZE, listInsVendors } from "@/server/admin/insurance";
import { requireStaff } from "@/server/auth";
import { getCatalog } from "@/server/catalog";
import { Button } from "@/components/ui/button";
import { AdminHeader, FilterForm, FilterSelect, Pagination, SearchInput, filterInput, formatDay, hrefWith, pageParam, strParam } from "@/components/admin/ui";
import { EmptyState, INS_VENDOR_WITH_VENDOR, LinkTabs, SlaAge, StatusPill, VendorPill, daysUntil } from "@/components/admin/insurance/ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Insurance vendors" };

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "queue", label: "Waiting for review" },
  { key: "with_vendor", label: "With vendor" },
  { key: "approved", label: "Approved" },
  { key: "suspended", label: "Suspended" },
  { key: "rejected", label: "Rejected" },
  { key: "draft", label: "Drafts" },
] as const;

function Licence({ until, today }: { until: string | null; today: string }) {
  if (!until) return <span className="text-muted">—</span>;
  const d = daysUntil(until, today);
  return (
    <span className={cn("num", d < 0 ? "font-semibold text-red" : d <= 60 ? "font-medium text-[#9a5b00]" : "")}>
      {formatDay(until)}
      {d < 0 ? <span className="block text-[11.5px]">Expired</span> : d <= 60 ? <span className="block text-[11.5px]">In {d} days</span> : null}
    </span>
  );
}

export default async function InsuranceVendorsPage({ searchParams }: PageProps<"/admin/insurance/vendors">) {
  await requireStaff();
  const sp = await searchParams;
  const params = { q: strParam(sp.q), status: strParam(sp.status), category: strParam(sp.category), state: strParam(sp.state), plan: strParam(sp.plan), sort: strParam(sp.sort) };
  const [{ rows, total, page, byStatus, states, now, today }, catalog] = await Promise.all([listInsVendors({ ...params, page: pageParam(sp.page) }), getCatalog()]);
  const plans = catalog.content.insurerPlans.plans;
  const planName = (id: string) => plans.find((p) => p.id === id)?.name ?? id;
  const all = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const tabCount = (k: string) =>
    k === "" ? all : k === "queue" ? INS_VENDOR_IN_REVIEW.reduce((a, s) => a + byStatus[s], 0) : k === "with_vendor" ? INS_VENDOR_WITH_VENDOR.reduce((a, s) => a + byStatus[s], 0) : byStatus[k as keyof typeof byStatus];
  const hasFilters = Boolean(params.q || params.sort || params.category || params.state || params.plan);
  const base = "/admin/insurance/vendors";

  return (
    <>
      <AdminHeader
        title="Insurance vendors"
        description="Insurers and registered intermediaries on the marketplace — search, filter and open any vendor to review it."
        actions={
          <>
            <Button href="/admin/insurance/companies" variant="outline" size="sm" icon={<Landmark className="size-4" aria-hidden />}>
              Insurance companies
            </Button>
            <Button href="/admin/insurance/vendor-approvals" size="sm" icon={<ClipboardCheck className="size-4" aria-hidden />}>
              Verification queue
            </Button>
          </>
        }
      />

      <LinkTabs active={params.status ?? ""} items={STATUS_TABS.map((t) => ({ key: t.key, label: t.label, count: tabCount(t.key), href: hrefWith(base, params, { status: t.key || undefined, page: undefined }) }))} />

      <FilterForm resetHref={hrefWith(base, { status: params.status }, {})} hasFilters={hasFilters}>
        {params.status && <input type="hidden" name="status" value={params.status} />}
        <SearchInput value={params.q} placeholder="Name, reference, GSTIN, licence, owner email…" />
        <FilterSelect name="category" label="Any category" value={params.category} options={INS_VENDOR_CATEGORIES.map((c) => ({ value: c, label: INS_VENDOR_CATEGORY_SHORT[c] }))} />
        <FilterSelect name="state" label="Any state" value={params.state} options={states.map((s) => ({ value: s, label: s }))} />
        <FilterSelect name="plan" label="Any plan" value={params.plan} options={plans.map((p) => ({ value: p.id, label: p.name }))} />
        <select name="sort" defaultValue={params.sort ?? ""} aria-label="Sort" className={cn(filterInput, "cursor-pointer md:w-auto")}>
          {Object.entries(INS_VENDOR_SORTS).map(([value, label]) => (
            <option key={value} value={value === "newest" ? "" : value}>
              {label}
            </option>
          ))}
        </select>
      </FilterForm>
      <p className="-mt-1 mb-3 text-[12.5px] text-muted num">
        {total.toLocaleString("en-IN")} vendor{total === 1 ? "" : "s"}
        {hasFilters || params.status ? " match" : ""}
      </p>

      {rows.length === 0 ? (
        <div className="border border-line bg-white">
          <EmptyState icon={<ShieldCheck className="size-5" aria-hidden />} title={hasFilters || params.status ? "No vendors match" : "No vendor applications yet"}>
            {hasFilters || params.status ? "Try another search or filter." : "Insurers and intermediaries appear here as soon as they start registering at /insurance-vendor."}
          </EmptyState>
        </div>
      ) : (
        <>
          <ul className="space-y-3 md:hidden">
            {rows.map((v) => (
              <li key={v.id} className="border border-line bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`${base}/${v.id}`} className="min-w-0">
                    <span className="block truncate text-[14.5px] font-semibold">{v.name}</span>
                    <span className="block truncate text-[12.5px] text-muted">
                      {v.reference} · {v.category ? INS_VENDOR_CATEGORY_SHORT[v.category] : "Category not set"}
                    </span>
                  </Link>
                  <VendorPill status={v.status} />
                </div>
                <p className="mt-2 truncate text-[12.5px] text-muted">
                  {[v.city, v.state].filter(Boolean).join(", ") || "Location not set"} · {v.ownerEmail}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button href={`${base}/${v.id}`} size="sm" variant="outline">
                    Open
                  </Button>
                  {INS_VENDOR_IN_REVIEW.includes(v.status) && (
                    <Button href={`/admin/insurance/vendor-approvals?id=${v.id}`} size="sm" icon={<FileSearch className="size-4" aria-hidden />}>
                      Review
                    </Button>
                  )}
                  {INS_VENDOR_IN_REVIEW.includes(v.status) && <SlaAge since={v.submittedAt} now={now} prefix="Waiting" />}
                </div>
              </li>
            ))}
          </ul>

          <div className="relative hidden overflow-x-auto border border-line bg-white md:block">
            <table className="w-full min-w-[1040px] border-collapse text-left text-[13.5px]">
              <thead>
                <tr className="text-[12px] text-muted">
                  {["Vendor", "Category", "Location", "Licence valid until", "Status", "Plan", "Activity", ""].map((h, i) => (
                    <th key={i} className="border-b border-line bg-mist/60 px-4 py-3 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => {
                  const waiting = INS_VENDOR_IN_REVIEW.includes(v.status);
                  return (
                    <tr key={v.id} className="align-top transition-colors hover:bg-mist/40">
                      <td className="min-w-[200px] max-w-[280px] border-b border-line px-4 py-3">
                        <Link href={`${base}/${v.id}`} className="font-semibold hover:text-red">
                          {v.name}
                        </Link>
                        <span className="mt-0.5 block whitespace-nowrap text-[12px] text-muted">{v.reference}</span>
                        <span className="block max-w-[210px] truncate text-[12px] text-muted" title={v.ownerEmail}>
                          {v.ownerEmail}
                        </span>
                      </td>
                      <td className="border-b border-line px-4 py-3">{v.category ? INS_VENDOR_CATEGORY_SHORT[v.category] : <span className="text-muted">—</span>}</td>
                      <td className="min-w-[120px] border-b border-line px-4 py-3">{[v.city, v.state].filter(Boolean).join(", ") || <span className="text-muted">—</span>}</td>
                      <td className="whitespace-nowrap border-b border-line px-4 py-3">
                        <Licence until={v.licenceValidUntil} today={today} />
                        {v.licenceNumber && <span className="block font-mono text-[11.5px] text-muted">{v.licenceNumber}</span>}
                      </td>
                      <td className="border-b border-line px-4 py-3">
                        <VendorPill status={v.status} />
                        {v.status === "draft" && <span className="mt-1 block text-[11.5px] text-muted">Step {v.step} of 7</span>}
                      </td>
                      <td className="whitespace-nowrap border-b border-line px-4 py-3">
                        {v.status === "approved" || v.status === "suspended" ? (
                          <>
                            {planName(v.plan)}
                            <span className="block text-[12px] text-muted">{PLAN_STATUS_LABEL[v.planStatus]}</span>
                          </>
                        ) : (
                          <span className="text-muted">{planName(v.plan)}</span>
                        )}
                      </td>
                      <td className="min-w-[150px] border-b border-line px-4 py-3 text-[12.5px]">
                        {waiting ? <SlaAge since={v.submittedAt} now={now} prefix="Waiting" className="text-[12.5px]" /> : v.approvedAt ? <span>Approved {formatDay(v.approvedAt)}</span> : <span className="text-muted">Joined {formatDay(v.createdAt)}</span>}
                        <span className="block text-muted num">
                          {v.published} live product{v.published === 1 ? "" : "s"}
                          {v.pendingItems ? <span className="font-medium text-red"> · {v.pendingItems} to review</span> : null}
                        </span>
                      </td>
                      <td className="border-b border-line px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {waiting && (
                            <Link href={`/admin/insurance/vendor-approvals?id=${v.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-[3px] bg-red px-2.5 text-[12.5px] font-medium text-white hover:bg-red-600">
                              <FileSearch aria-hidden className="size-3.5" /> Review
                            </Link>
                          )}
                          <Link href={`${base}/${v.id}`} className="inline-flex h-8 items-center rounded-[3px] border border-line px-2.5 text-[12.5px] font-medium hover:border-ink">
                            Open
                          </Link>
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
      <Pagination base={base} params={params} page={page} pageSize={INS_VENDORS_PAGE_SIZE} total={total} />
      {rows.some((r) => r.status === "suspended") && (
        <p className="mt-3 text-[12.5px] text-muted">
          <StatusPill tone="dark">Suspended</StatusPill> vendors&apos; products are hidden from the website automatically until they&apos;re reactivated.
        </p>
      )}
    </>
  );
}
