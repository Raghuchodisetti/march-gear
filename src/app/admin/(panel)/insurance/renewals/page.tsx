import type { Metadata } from "next";
import Link from "@/components/admin/desk";
import { RefreshCw } from "lucide-react";
import { INS_RENEWAL_STATUS } from "@/db/enums";
import { INS_RENEWAL_OPEN, INS_RENEWAL_STATUS_LABEL } from "@/insurance/labels";
import { requireStaff } from "@/server/auth";
import { DUE_WINDOWS, listInsRenewals, PAGE_SIZE, vendorLabel, vendorOptions } from "@/server/admin/insurance-ops";
import { AdminHeader, FilterForm, FilterSelect, Pagination, SearchInput, StatCard, Table, Td, Th, formatDateTime, formatDay, hrefWith, pageParam, strParam } from "@/components/admin/ui";
import { LinkTabs } from "@/components/admin/partner-ui";
import { daysBetween, istDate, rupees } from "@/components/portal/billing/shared";
import { EmptyBox, RenewalPill, VendorLink } from "@/components/admin/insurance/ops/kit";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Renewals" };

const BASE = "/admin/insurance/renewals";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff();
  const sp = await searchParams;
  const params = { q: strParam(sp.q)?.slice(0, 80), vendor: strParam(sp.vendor), status: strParam(sp.status), due: strParam(sp.due), followup: strParam(sp.followup) };
  const [{ rows, total, page, counts }, vendors] = await Promise.all([listInsRenewals(params, pageParam(sp.page)), vendorOptions()]);
  const hasFilters = Object.values(params).some(Boolean);
  const today = istDate();
  const now = new Date().getTime();
  const tab = params.followup === "overdue" ? "overdue" : params.due ?? "all";
  const keep = { q: params.q, vendor: params.vendor };

  return (
    <>
      <AdminHeader
        title="Renewals"
        description="Policies coming up for renewal across all vendors. Renewals are each vendor's own business — this view is for oversight only; vendors work them in their portal."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Expiring in 7 days" value={counts.d7} tone={counts.d7 ? "red" : undefined} note={`${counts.d15} within 15 days`} href={`${BASE}?due=7`} />
        <StatCard label="Expiring in 30 days" value={counts.d30} note={`${counts.d45} within 45 days`} href={`${BASE}?due=30`} />
        <StatCard label="Overdue follow-ups" value={counts.overdue} tone={counts.overdue ? "red" : undefined} note="Open renewals past their follow-up" href={`${BASE}?followup=overdue`} />
        <StatCard label="Renewed in 30 days" value={counts.renewed} note={`${counts.expired} expired without renewal`} href={`${BASE}?status=renewed`} />
      </div>

      <LinkTabs
        active={tab}
        items={[
          { key: "all", label: "All", href: hrefWith(BASE, keep, {}) },
          ...DUE_WINDOWS.map((d) => ({ key: d, label: `Next ${d} days`, count: counts[`d${d}` as "d7"], href: hrefWith(BASE, keep, { due: d }) })),
          { key: "expired", label: "Expired, open", count: counts.expired, href: hrefWith(BASE, keep, { due: "expired" }) },
          { key: "overdue", label: "Overdue follow-ups", count: counts.overdue, href: hrefWith(BASE, keep, { followup: "overdue" }) },
        ]}
      />

      <FilterForm resetHref={BASE} hasFilters={hasFilters}>
        {params.due && <input type="hidden" name="due" value={params.due} />}
        {params.followup && <input type="hidden" name="followup" value={params.followup} />}
        <SearchInput value={params.q} placeholder="Customer, mobile, reg., policy no., REN-…" />
        <FilterSelect name="vendor" label="All vendors" value={params.vendor} options={vendors} />
        <FilterSelect name="status" label="Any status" value={params.status} options={INS_RENEWAL_STATUS.map((s) => ({ value: s, label: INS_RENEWAL_STATUS_LABEL[s] }))} />
      </FilterForm>

      {rows.length === 0 ? (
        <EmptyBox icon={<RefreshCw aria-hidden className="size-5" />} title={hasFilters ? "No renewals match" : "No renewals yet"}>
          {hasFilters ? "Try another window, status or vendor." : "Renewals appear when customers ask for renewal quotes or vendors add issued policies."}
        </EmptyBox>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Customer</Th>
              <Th>Vehicle &amp; policy</Th>
              <Th>Vendor</Th>
              <Th>Expiry</Th>
              <Th>Status</Th>
              <Th>Follow-up</Th>
              <Th className="text-right">Premium</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ r, assignee, ...v }) => {
              const left = daysBetween(today, r.expiryDate);
              const open = INS_RENEWAL_OPEN.includes(r.status);
              const late = open && r.followUpAt && r.followUpAt.getTime() < now;
              return (
                <tr key={r.id} className="transition-colors hover:bg-mist/40">
                  <Td className="min-w-[160px]">
                    <p className="font-medium">{r.name}</p>
                    <p className="text-[12px] text-muted">
                      <span className="num">{r.reference}</span> · <span className="whitespace-nowrap num">+91 {r.mobile}</span>
                    </p>
                    {r.enquiryId && (
                      <Link href={`/admin/insurance/enquiries/${r.enquiryId}`} className="text-[12px] font-medium text-red hover:underline">
                        Enquiry
                      </Link>
                    )}
                  </Td>
                  <Td className="min-w-[180px]">
                    <p>{[r.brandName, r.modelName].filter(Boolean).join(" ") || "—"}</p>
                    <p className="text-[12px] text-muted">{[r.regNumber, r.year, r.fuel].filter(Boolean).join(" · ")}</p>
                    <p className="text-[12px] text-muted">{[r.currentInsurer, r.policyNumber].filter(Boolean).join(" · ")}</p>
                  </Td>
                  <Td className="min-w-[150px] max-w-[200px]">
                    <VendorLink id={v.vendorId} name={vendorLabel(v)} />
                    <p className="text-[12px] text-muted">{assignee ? `Owner: ${assignee}` : "Unassigned"}</p>
                  </Td>
                  <Td className="whitespace-nowrap">
                    <p>{formatDay(r.expiryDate)}</p>
                    {open && (
                      <p className={cn("text-[12px] font-medium", left < 0 ? "text-red" : left <= 7 ? "text-[#9a5b00]" : "text-muted")}>
                        {left < 0 ? `Expired ${-left} day${left === -1 ? "" : "s"} ago` : left === 0 ? "Expires today" : `In ${left} day${left === 1 ? "" : "s"}`}
                      </p>
                    )}
                  </Td>
                  <Td>
                    <RenewalPill status={r.status} />
                    {r.renewedAt && <p className="mt-1 text-[11.5px] text-muted">Renewed {formatDay(r.renewedAt)}</p>}
                  </Td>
                  <Td className={cn("whitespace-nowrap text-[12.5px]", late ? "font-medium text-red" : "text-muted")}>{r.followUpAt ? formatDateTime(r.followUpAt) : "—"}</Td>
                  <Td className="text-right num">{r.premium ? rupees(r.premium) : "—"}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      <Pagination base={BASE} params={params} page={page} pageSize={PAGE_SIZE} total={total} />
    </>
  );
}
