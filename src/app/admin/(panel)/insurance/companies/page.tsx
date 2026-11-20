import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Building2, Plus } from "lucide-react";
import { INS_COMPANIES_PAGE_SIZE, listInsCompanies } from "@/server/admin/insurance";
import { requireStaff } from "@/server/auth";
import { Button } from "@/components/ui/button";
import { AdminHeader, FilterForm, Pagination, SearchInput, formatDay, hrefWith, pageParam, strParam } from "@/components/admin/ui";
import { EmptyState, LinkTabs, StatusPill } from "@/components/admin/insurance/ui";

export const metadata: Metadata = { title: "Insurance companies" };

export default async function InsuranceCompaniesPage({ searchParams }: PageProps<"/admin/insurance/companies">) {
  await requireStaff();
  const sp = await searchParams;
  const params = { q: strParam(sp.q), status: strParam(sp.status) };
  const { rows, total, page, counts } = await listInsCompanies({ ...params, page: pageParam(sp.page) });
  const base = "/admin/insurance/companies";

  return (
    <>
      <AdminHeader
        title="Insurance companies"
        description="The underwriters customers see as providers. Staff manage these; insurer vendors are linked to theirs. Deactivating a company hides every product it underwrites."
        actions={
          <Button href={`${base}/new`} size="sm" icon={<Plus className="size-4" aria-hidden />}>
            Add company
          </Button>
        }
      />
      <LinkTabs
        active={params.status ?? ""}
        items={[
          { key: "", label: "All", count: counts.all, href: hrefWith(base, { q: params.q }, {}) },
          { key: "active", label: "Active", count: counts.active, href: hrefWith(base, { q: params.q }, { status: "active" }) },
          { key: "inactive", label: "Inactive", count: counts.inactive, href: hrefWith(base, { q: params.q }, { status: "inactive" }) },
          { key: "verified", label: "Claim figures verified", href: hrefWith(base, { q: params.q }, { status: "verified" }) },
        ]}
      />
      <FilterForm resetHref={hrefWith(base, { status: params.status }, {})} hasFilters={Boolean(params.q)}>
        {params.status && <input type="hidden" name="status" value={params.status} />}
        <SearchInput value={params.q} placeholder="Name, slug, headquarters, registration no…" />
      </FilterForm>

      {rows.length === 0 ? (
        <div className="border border-line bg-white">
          <EmptyState icon={<Building2 aria-hidden className="size-5" />} title={params.q || params.status ? "No companies match" : "No insurance companies yet"}>
            {params.q || params.status ? "Try another search or tab." : "Add the insurers whose products are sold on MarchGear. Approving an insurer vendor can also create its company."}
          </EmptyState>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`${base}/${c.id}`} className="flex h-full gap-4 border border-line bg-white p-5 transition-colors hover:border-ink/30">
                <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[3px] border border-line bg-white">
                  {c.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.logo} alt="" className="max-h-full max-w-full object-contain p-1.5" loading="lazy" />
                  ) : (
                    <Building2 aria-hidden className="size-5 text-muted" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 break-words text-[14.5px] font-semibold">{c.name}</span>
                    {!c.isActive && <StatusPill tone="neutral">Inactive</StatusPill>}
                  </span>
                  <span className="mt-0.5 block truncate text-[12.5px] text-muted">
                    {[c.headquarters, c.vendorName ? `Vendor: ${c.vendorName}` : "No insurer vendor"].filter(Boolean).join(" · ")}
                  </span>
                  <span className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px]">
                    <span className="num">
                      <span className="font-semibold">{c.products}</span> product{c.products === 1 ? "" : "s"} · {c.published} live
                    </span>
                    {c.claimInfo?.verified ? (
                      <span className="inline-flex items-center gap-1 font-medium text-[#1e7a3c]">
                        <BadgeCheck aria-hidden className="size-3.5" /> {c.claimInfo.settlementRatio}% · {c.claimInfo.year}
                      </span>
                    ) : c.claimInfo?.settlementRatio !== null && c.claimInfo?.settlementRatio !== undefined ? (
                      <span className="text-[#9a5b00]">Claim figure not verified</span>
                    ) : (
                      <span className="text-muted">No claim figures</span>
                    )}
                  </span>
                  <span className="mt-1.5 block text-[11.5px] text-muted">Updated {formatDay(c.updatedAt)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination base={base} params={params} page={page} pageSize={INS_COMPANIES_PAGE_SIZE} total={total} />
    </>
  );
}
