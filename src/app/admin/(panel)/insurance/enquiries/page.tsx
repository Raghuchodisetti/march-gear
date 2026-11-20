import type { Metadata } from "next";
import Link from "next/link";
import { Download, Inbox } from "lucide-react";
import { INS_INTENTS, INS_LEAD_STATUS } from "@/db/enums";
import { INS_INTENT_LABEL, INS_LEAD_STATUS_LABEL, INS_PRODUCT_CATEGORY_LABEL } from "@/insurance/labels";
import { requireStaff } from "@/server/auth";
import { dayRange, enquiryCounts, enquiryFilterOptions, listInsEnquiries, PAGE_SIZE, vendorLabel } from "@/server/admin/insurance-ops";
import { buttonClasses } from "@/components/ui/button";
import { AdminHeader, FilterForm, FilterSelect, Pagination, SearchInput, StatCard, Table, Td, Th, formatDay, hrefWith, pageParam, strParam } from "@/components/admin/ui";
import { rupees } from "@/components/portal/billing/shared";
import { ConversionPill, DateRangeFields, EmptyBox, LeadPill, VendorLink, conversionState } from "@/components/admin/insurance/ops/kit";
import { CONVERSION_LABEL, INS_TARGET_LABEL, sourceLabel } from "@/components/admin/insurance/ops/labels";

export const metadata: Metadata = { title: "Insurance enquiries" };

const BASE = "/admin/insurance/enquiries";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStaff();
  const sp = await searchParams;
  const range = dayRange(strParam(sp.from), strParam(sp.to));
  const params = {
    q: strParam(sp.q)?.slice(0, 80),
    vendor: strParam(sp.vendor),
    status: strParam(sp.status),
    intent: strParam(sp.intent),
    product: strParam(sp.product),
    company: strParam(sp.company),
    city: strParam(sp.city),
    source: strParam(sp.source),
    conversion: strParam(sp.conversion),
    from: range.from,
    to: range.to,
  };
  const [{ rows, total, page }, counts, options] = await Promise.all([listInsEnquiries(params, pageParam(sp.page)), enquiryCounts(), enquiryFilterOptions()]);
  const hasFilters = Object.values(params).some(Boolean);

  return (
    <>
      <AdminHeader
        title="Enquiries"
        description="Every customer quote request, across all insurance vendors. Policies are “reported” by the vendor until MarchGear verifies them."
        actions={
          // A plain download link: a client-side <Link> would fetch the route twice.
          <a href={hrefWith(`${BASE}/export`, params, {})} download className={buttonClasses({ variant: "outline", size: "sm" })}>
            <Download className="size-4" aria-hidden /> Export CSV
          </a>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Received today (IST)" value={counts.today} note={`${counts.total.toLocaleString("en-IN")} in total`} />
        <StatCard label="New, not yet picked up" value={counts.fresh} href={`${BASE}?status=new`} />
        <StatCard label="Policies to verify" value={counts.reported} tone={counts.reported ? "red" : undefined} note="Reported by the vendor" href={`${BASE}?conversion=reported`} />
        <StatCard label="Verified conversions" value={counts.verified} note="Checked by MarchGear" href={`${BASE}?conversion=verified`} />
      </div>

      <FilterForm resetHref={BASE} hasFilters={hasFilters}>
        <SearchInput value={params.q} placeholder="Name, mobile, ENQ-…, reg., policy no., vendor" />
        <FilterSelect name="vendor" label="All vendors" value={params.vendor} options={options.vendors} />
        <FilterSelect name="status" label="Any status" value={params.status} options={INS_LEAD_STATUS.map((s) => ({ value: s, label: INS_LEAD_STATUS_LABEL[s] }))} />
        <FilterSelect name="intent" label="New & renewal" value={params.intent} options={INS_INTENTS.map((s) => ({ value: s, label: INS_INTENT_LABEL[s] }))} />
        <FilterSelect name="conversion" label="Any conversion" value={params.conversion} options={(Object.keys(CONVERSION_LABEL) as (keyof typeof CONVERSION_LABEL)[]).map((k) => ({ value: k, label: CONVERSION_LABEL[k] }))} />
        {options.products.length > 0 && <FilterSelect name="product" label="All products" value={params.product} options={options.products} />}
        {options.companies.length > 0 && <FilterSelect name="company" label="All insurers" value={params.company} options={options.companies} />}
        {options.cities.length > 0 && <FilterSelect name="city" label="All cities" value={params.city} options={options.cities.map((c) => ({ value: c, label: c }))} />}
        {options.sources.length > 1 && <FilterSelect name="source" label="All sources" value={params.source} options={options.sources.map((s) => ({ value: s, label: sourceLabel(s) }))} />}
        <DateRangeFields from={params.from} to={params.to} label="Received between (IST)" />
      </FilterForm>

      {rows.length === 0 ? (
        <EmptyBox icon={<Inbox aria-hidden className="size-5" />} title={hasFilters ? "No enquiries match these filters" : "No enquiries yet"}>
          {hasFilters ? "Try a wider date range or fewer filters." : "Quote requests from the public insurance pages appear here as soon as customers send them."}
        </EmptyBox>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Enquiry</Th>
              <Th>Vehicle</Th>
              <Th>Vendor &amp; product</Th>
              <Th>Status</Th>
              <Th>{INS_TARGET_LABEL.conversion}</Th>
              <Th className="text-right">Quotes</Th>
              <Th>Received</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const conv = conversionState(e);
              return (
                <tr key={e.id} className="transition-colors hover:bg-mist/40">
                  <Td className="min-w-[160px]">
                    <Link href={`${BASE}/${e.id}`} className="block font-medium hover:text-red">
                      {e.name}
                    </Link>
                    <p className="text-[12px] text-muted">
                      <span className="num">{e.reference}</span> · {INS_INTENT_LABEL[e.intent]}
                    </p>
                    <p className="text-[12px] text-muted num">+91 {e.mobile}</p>
                  </Td>
                  <Td className="min-w-[160px]">
                    <p>{[e.brandName, e.modelName].filter(Boolean).join(" ") || "—"}</p>
                    <p className="text-[12px] text-muted">{[e.variantName, e.year, e.fuel].filter(Boolean).join(" · ") || ""}</p>
                    <p className="text-[12px] text-muted">{[e.city, e.state].filter(Boolean).join(", ")}</p>
                  </Td>
                  <Td className="min-w-[160px] max-w-[220px]">
                    <VendorLink id={e.vendorId} name={vendorLabel(e)} />
                    <p className="truncate text-[12px] text-muted">
                      {e.productName ?? "Product removed"}
                      {e.productCategory ? ` · ${INS_PRODUCT_CATEGORY_LABEL[e.productCategory]}` : ""}
                    </p>
                  </Td>
                  <Td>
                    <LeadPill status={e.status} />
                    <p className="mt-1 text-[11.5px] text-muted">{sourceLabel(e.source)}</p>
                  </Td>
                  <Td className="min-w-[150px]">
                    {conv === "none" ? <span className="text-[12.5px] text-muted">—</span> : <ConversionPill state={conv} />}
                    {e.policyNumber && <p className="mt-1 break-all text-[12px] text-muted num">{e.policyNumber}</p>}
                    {e.policyPremium ? <p className="text-[12px] text-muted num">{rupees(e.policyPremium)} premium</p> : null}
                  </Td>
                  <Td className="text-right num">{e.quotes}</Td>
                  <Td className="whitespace-nowrap text-[12.5px] text-muted">
                    {formatDay(e.createdAt)}
                    <span className="block">{e.createdAt.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" })}</span>
                  </Td>
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
